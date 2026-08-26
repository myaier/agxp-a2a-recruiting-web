// R9 招聘名片 · 招聘方注册第二步（名片 → 发岗）。
//
// 业务口径（2026-08-18 用户定，见 数据/类型.ts 顶部的完整说明）：匿名是单向的 ——
// 这张名片从第一轮起就对候选人可见，候选人对你则是代号，确认意向后才露真名。
//
// 交互（标注 2026-08-20 14:34 / 14:35）：姓名 / 职务 / 公司三行改成**点击就地编辑** ——
// 点哪一行，那一行的值当场变成输入框并自动聚焦，失焦或回车即保存。
// 原来那套底部升起的编辑抽屉（遮罩 + 抽屉 + 草稿 + 确定按钮）整套删掉：
// 三个字段都是一行短文本，为改一个词升起半屏抽屉是多余的一层。
//
// P1C 起分双分支：
//   Mock    —— 上述就地编辑原型原样保留（读 企业认证 fixture，落 存企业认证，去发岗）。
//   Backend —— 姓名槽显示 verified_name ?? public_name（verified 即只读），职务落 title，
//              一次保存调 保存招聘方档案；公司槽读 current affiliation / 未认证声明，
//              多个可用关系列出待选、不自动猜。头像走原子保存：选图只生成 object URL
//              内存预览（不压 data URL、不落 存招聘头像），保存时调 替换招聘方头像，
//              成功后由 operation 用响应里的 avatar_url/revision 替换权威档案、回收预览。

import { useEffect, useRef, useState } from 'react';
import 样式 from './招聘名片.module.css';
import {
  次级页外壳,
  返回栏,
  页面大标题,
  滚动区,
  表单条目,
  主按钮,
  公司字标,
} from '../组件/通用';
import { 轻提示 } from '../组件/轻提示';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 相机图标 } from '../组件/图标';
import { 路径 } from '../路由/路径表';
import { 压成头像 } from '../组件/头像处理';
import { 从BFF招聘身份 } from '../数据/组织映射';
import { 取后端错误文案 } from '../数据/HTTP客户端';

export default function 招聘名片() {
  const { 数据源模式 } = use应用状态();
  return 数据源模式 === 'backend' ? <后端名片 /> : <Mock名片 />;
}

// ── Backend：诚实名片（服务端事实 + 一次保存）──────────────────────

/** 头像上传的冻结边界（P1B runtime）：只收 PNG/JPEG，单文件 ≤ 10 MiB */
const 头像字节上限 = 10 * 1024 * 1024;

function 后端名片() {
  const { 跳转, 返回 } = use导航();
  const { 状态, 操作, 后端状态 } = use应用状态();
  const 文件框 = useRef<HTMLInputElement>(null);
  const 身份 = 从BFF招聘身份(
    状态.招聘方档案, 状态.企业关系列表, 状态.当前企业关系编号, 状态.企业管理员申请列表,
  );
  // 显式判定，不从公司名推断：姓名槽 = verified_name ?? public_name；只有无实名才可编辑公开名
  const 显示姓名 = 身份.verifiedName ?? 身份.publicName;
  const 可编辑公开名 = 身份.verifiedName === null;
  const 可选关系 = 身份.affiliations.filter((项) => 项.selectable);

  const [公开名, 设公开名] = useState(身份.publicName);
  const [职务, 设职务] = useState(身份.title);
  // 水合晚于进屏时同步服务端权威值；保存成功后 re-hydrate 回写的是同一份内容
  useEffect(() => {
    设公开名(身份.publicName);
  }, [身份.publicName]);
  useEffect(() => {
    设职务(身份.title);
  }, [身份.title]);

  // ── 头像原子保存：只留 object URL 内存预览，保存成功才让服务端响应成为权威 ──
  const [头像文件, 设头像文件] = useState<File | null>(null);
  const [头像预览, 设头像预览] = useState<string | null>(null);
  const 预览引用 = useRef<string | null>(null);
  /** 换新预览前先回收旧的；地址为 null 即清空 */
  function 换预览(地址: string | null) {
    if (预览引用.current !== null) URL.revokeObjectURL(预览引用.current);
    预览引用.current = 地址;
    设头像预览(地址);
  }
  /** 预览收口：回收 object URL 并丢弃待上传文件（成功或作废两条路都走这里） */
  function 收口预览() {
    换预览(null);
    设头像文件(null);
  }
  // unmount 回收 object URL（内存预览不落任何全局状态）
  useEffect(() => () => {
    if (预览引用.current !== null) URL.revokeObjectURL(预览引用.current);
  }, []);
  // 账号变化：上一账号的预览与待上传文件一并作废，不把旧文件传给新账号
  const 主体标识 = 后端状态.主体?.subject_id ?? null;
  const 首次渲染 = useRef(true);
  useEffect(() => {
    if (首次渲染.current) {
      首次渲染.current = false;
      return;
    }
    if (预览引用.current !== null) 收口预览();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [主体标识]);

  /** 保存一次带 public_name 与 title；失败原样抛回给按钮层（输入不清空） */
  const 保存 = () => 操作.保存招聘方档案({ public_name: 公开名, title: 职务 });

  async function 按下保存() {
    try {
      await 保存();
      if (头像文件) {
        // 头像用当前 revision 的一次原子替换；权威档案由 operation 用响应替换
        await 操作.替换招聘方头像(头像文件);
        收口预览();
      }
      轻提示('保存成功'); // 成功响应之后才提示
    } catch (错误) {
      // 409/503 等失败保留 file 与预览，用户检查后按同一个保存键重试
      轻提示(取后端错误文案(错误));
    }
  }

  async function 选了照片(事件: React.ChangeEvent<HTMLInputElement>) {
    const 文件 = 事件.target.files?.[0];
    事件.target.value = ''; // 允许再次选同一张
    if (!文件) return;
    if (文件.type !== 'image/png' && 文件.type !== 'image/jpeg') {
      轻提示('仅支持 PNG / JPEG 图片');
      return;
    }
    if (文件.size > 头像字节上限) {
      轻提示('图片不超过 10 MiB');
      return;
    }
    // 只生成内存预览：不压 data URL、不派发 存招聘头像，服务端成功前一切只是暂存
    换预览(URL.createObjectURL(文件));
    设头像文件(文件);
  }

  /** 无可用任职关系时的公司输入：落未认证声明，不创建 Organization */
  function 公司收笔(输入值: string) {
    const 新值 = 输入值.trim();
    if (新值 && 新值 !== 状态.未认证公司声明) 操作.保存未认证公司声明(新值);
  }

  const 公司显示 = 身份.currentAffiliation?.organizationName ?? 状态.未认证公司声明;
  // Backend 不落 存招聘头像：预览优先，权威头像始终来自 招聘方档案.avatar_url
  const 头像地址 = 头像预览 ?? 身份.avatarUrl;

  return (
    <次级页外壳>
      <返回栏 返回={返回} />

      <页面大标题 标题="招聘名片" />

      <滚动区 样式覆盖={{ padding: '6px 22px 0' }}>
        {/* ── 名片预览：候选人从第一轮起看到的就是这一行（不对称双盲的实名侧）── */}
        <div className={样式.预览行}>
          <button
            className={`${样式.头像键} 可点`}
            onClick={() => 文件框.current?.click()}
            aria-label="上传头像"
          >
            {头像地址 ? (
              <img
                className={样式.头像图}
                src={头像地址}
                alt={头像预览 !== null ? '头像预览' : ''}
              />
            ) : (
              <公司字标
                首字={显示姓名.charAt(0)}
                尺寸={52}
                圆角={999}
                底色="var(--墨)"
                字色="var(--荧光绿)"
                描边={false}
                字号={21}
              />
            )}
            <span className={样式.相机角标}>
              <相机图标 尺寸={11} 色="var(--正文)" />
            </span>
          </button>
          <input
            ref={文件框}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            aria-label="更换头像"
            onChange={选了照片}
          />
          <span className={样式.预览文字}>
            <span className={`${样式.预览姓名} 单行`}>
              {显示姓名 || '未设置姓名'}
              {身份.personalVerification.code === 'verified' ? (
                <span className={样式.认证标}>已认证</span>
              ) : null}
            </span>
            <span className={`${样式.预览副行} 单行`}>
              {职务 || '未设置职务'} · {公司显示 || '未设置企业'}
            </span>
          </span>
        </div>

        {/* ── 姓名：verified 只读；无实名才可编辑公开名 ── */}
        {可编辑公开名 ? (
          <div className={样式.就地条目}>
            <div className={样式.就地标签}>姓名（公开名）</div>
            <input
              className={样式.就地输入}
              aria-label="姓名"
              value={公开名}
              onChange={(事件) => 设公开名(事件.target.value)}
              enterKeyHint="done"
            />
          </div>
        ) : (
          <div className={样式.就地条目}>
            <div className={样式.就地标签}>姓名（已实名，不可修改）</div>
            <div className={样式.就地输入}>{显示姓名}</div>
          </div>
        )}

        {/* ── 职务：映射 title ── */}
        <div className={样式.就地条目}>
          <div className={样式.就地标签}>职务</div>
          <input
            className={样式.就地输入}
            aria-label="职务"
            value={职务}
            onChange={(事件) => 设职务(事件.target.value)}
            enterKeyHint="done"
          />
        </div>

        {/* ── 公司：current affiliation 的服务端事实；多个可用关系列出待选，不自动猜 ── */}
        {身份.affiliations.length > 0 ? (
          <div className={样式.就地条目}>
            <div className={样式.就地标签}>任职企业</div>
            {可选关系.length > 1 && !身份.currentAffiliation ? (
              <div className={样式.就地标签}>请选择当前任职企业</div>
            ) : null}
            {身份.affiliations.map((项) =>
              项.selectable ? (
                <button
                  key={项.id}
                  className={`${样式.就地输入} 可点`}
                  style={{ textAlign: 'left', cursor: 'pointer' }}
                  onClick={() => 操作.选择企业关系(项.id)}
                >
                  {项.organizationName} · {项.roleLabel} · {项.statusLabel}
                  {身份.currentAffiliation?.id === 项.id ? '（当前）' : ''}
                </button>
              ) : (
                <div key={项.id} className={样式.就地输入} style={{ color: 'var(--次要浅)' }}>
                  {项.organizationName} · {项.roleLabel} · {项.statusLabel}（不可选）
                </div>
              ),
            )}
          </div>
        ) : (
          <div className={样式.就地条目}>
            <div className={样式.就地标签}>公司（未认证声明）</div>
            <input
              className={样式.就地输入}
              aria-label="公司"
              defaultValue={状态.未认证公司声明}
              onBlur={(事件) => 公司收笔(事件.currentTarget.value)}
              enterKeyHint="done"
            />
          </div>
        )}

        {/* ── 公司主页资料：名片是「这个人」，公司主页是「这家公司」── */}
        <表单条目
          标签="公司主页资料"
          值="LOGO · 简介 · 规模 · 办公地"
          按下={() => 跳转(路径.公司档案编辑)}
        />
      </滚动区>

      <主按钮 文字="保存" 按下={按下保存} />
    </次级页外壳>
  );
}

// ── Mock：就地编辑原型（原实现逐字保留）───────────────────────────

/** 可就地编辑的字段（标注 2026-08-20 13:35：认证已撤，公司也直接改） */
type 表单键 = '姓名' | '职务' | '公司';

const 表单字段表: { 键: 表单键; 标签: string }[] = [
  { 键: '姓名', 标签: '姓名' },
  { 键: '职务', 标签: '职务' },
  { 键: '公司', 标签: '公司' },
];

function Mock名片() {
  const { 跳转, 返回 } = use导航();
  // 姓名与公司来自全局（企业认证切片），职务为设计稿 R9 预填值
  const { 状态, 派发 } = use应用状态();
  const 文件框 = useRef<HTMLInputElement>(null);

  async function 选了照片(事件: React.ChangeEvent<HTMLInputElement>) {
    const 文件 = 事件.target.files?.[0];
    事件.target.value = ''; // 允许再次选同一张
    if (!文件) return;
    try {
      派发({ 型: '存招聘头像', 图: await 压成头像(文件) });
      轻提示('头像已更新');
    } catch {
      轻提示('这张图片读不出来，换一张试试');
    }
  }
  // 三行的值直接读全局企业认证，本屏不留副本。原来放在 useState 里，
  // 点「公司主页资料」跳次级页会让本屏卸载，改到一半的职务当场丢回旧值 ——
  // 与 添加意向 顶部注释里写过的同一个坑（真相要放全局，不放组件）
  const 表单值: Record<表单键, string> = {
    姓名: 状态.企业认证.姓名,
    职务: 状态.企业认证.职务 ?? '技术 VP',
    公司: 状态.企业认证.公司,
  };
  // 正在就地编辑哪一行（null = 三行都在展示态）

  /** 收笔：失焦或回车都走这里，当场落全局（不再等底部主按钮）。空白视作没改 ——
   *  不允许把字段清空成空串，否则这一行会塌成没有值的空条目 */
  function 收笔(键: 表单键, 输入值: string) {
    const 新值 = 输入值.trim();
    if (新值 && 新值 !== 表单值[键]) {
      const 新表单 = { ...表单值, [键]: 新值 };
      派发({ 型: '存企业认证', 姓名: 新表单.姓名, 公司: 新表单.公司, 职务: 新表单.职务 });
    }
  }

  return (
    <次级页外壳>
      <返回栏 返回={返回} />

      {/* 标注 22:48：说明小字删掉，只留标题 */}
      <页面大标题 标题="招聘名片" />

      <滚动区 样式覆盖={{ padding: '6px 22px 0' }}>
        {/* ── 名片预览：候选人从第一轮起看到的就是这一行（不对称双盲的实名侧）── */}
        <div className={样式.预览行}>
          {/* 头像可传真人照片（标注 22:27）：候选人第一轮就看到这张脸。没传用姓氏字标兜底 */}
          <button
            className={`${样式.头像键} 可点`}
            onClick={() => 文件框.current?.click()}
            aria-label="上传头像"
          >
            {状态.招聘头像 ? (
              <img className={样式.头像图} src={状态.招聘头像} alt="" />
            ) : (
              <公司字标
                首字={表单值.姓名.charAt(0)}
                尺寸={52}
                圆角={999}
                底色="var(--墨)"
                字色="var(--荧光绿)"
                描边={false}
                字号={21}
              />
            )}
            <span className={样式.相机角标}>
              <相机图标 尺寸={11} 色="var(--正文)" />
            </span>
          </button>
          <input
            ref={文件框}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={选了照片}
          />
          <span className={样式.预览文字}>
            <span className={`${样式.预览姓名} 单行`}>{表单值.姓名}</span>
            <span className={`${样式.预览副行} 单行`}>
              {表单值.职务} · {表单值.公司}
            </span>
          </span>
        </div>

        {/* ── 姓名 / 职务 / 公司：点行即就地变输入框 ── */}
        {表单字段表.map((字段) => (
          <就地编辑条目
            key={字段.键}
            标签={字段.标签}
            值={表单值[字段.键]}
            收笔={(输入值) => 收笔(字段.键, 输入值)}
          />
        ))}

        {/* ── 公司主页资料：名片是「这个人」，公司主页是「这家公司」，
               候选人两处都会看，编辑入口挨着放 ── */}
        <表单条目
          标签="公司主页资料"
          值="LOGO · 简介 · 规模 · 办公地"
          按下={() => 跳转(路径.公司档案编辑)}
        />

      </滚动区>

      <主按钮
        文字="保存 · 去发岗位"
        按下={() => {
          // 认证步已撤（标注 13:32/13:35）：名片就是姓名与公司的录入源，保存时落全局。
          // 逐行的改动在收笔时已经落过一次，这里再落一次是为了把「职务从没编辑过」时
          // 展示用的默认值也钉进全局 —— 否则去发岗位那边读到的职务是空的
          派发({ 型: '存企业认证', 姓名: 表单值.姓名, 公司: 表单值.公司, 职务: 表单值.职务 });
          // 「从注册流」写进 history.state：发布岗位据此在发布后走一次性的企业初始化页;
          // 应用内(岗位管理等)进来的发岗没有这个标记,发布后照旧直进主壳
          跳转(路径.发布岗位, { 从注册流: true });
        }}
      />
    </次级页外壳>
  );
}

/** 一条就地编辑行（2026-08-24 标注：「把点击后的框直接去掉吧，可以直接打在
 *  这个线上。不需要专门点击弄个输入框，所有的都这样」）：
 *  不再有「展示态 ↔ 输入框」两态，这一行常驻就是一个输入框 —— 样式与原展示态
 *  的值行一比一（15.5/600、无框无底色），光标点哪儿就从哪儿写，收笔落全局。
 *  尖括号随两态一起撤：没有可展开的东西，摆着就是误导。 */
function 就地编辑条目({
  标签,
  值,
  收笔,
}: {
  标签: string;
  值: string;
  收笔: (输入值: string) => void;
}) {
  return (
    <div className={样式.就地条目}>
      <div className={样式.就地标签}>{标签}</div>
      <input
        className={样式.就地输入}
        defaultValue={值}
        aria-label={标签}
        enterKeyHint="done"
        onBlur={(事件) => 收笔(事件.currentTarget.value)}
        onKeyDown={(事件) => {
          // isComposing 挡住中文输入法「回车上屏候选词」那一下被误当收笔；
          // blur() 让收笔只走 onBlur 一条路径，避免回车与失焦各提交一次
          if (事件.key === 'Enter' && !事件.nativeEvent.isComposing) {
            事件.currentTarget.blur();
          }
        }}
      />
    </div>
  );
}
