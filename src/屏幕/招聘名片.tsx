// R9 招聘名片 · 招聘方注册第二步（实名认证 → 名片 → 发岗）。
//
// 同构源：添加意向.tsx（表单条目版式 + 底部编辑抽屉）。
//
// 业务口径（2026-08-18 用户定，见 数据/类型.ts 顶部的完整说明）：匿名是单向的 ——
// 这张名片从第一轮起就对候选人可见，候选人对你则是代号，确认意向后才露真名。
// 「公司」是上一步实名认证核验过的结果，带「已认证」徽标，
// 本屏不可修改（要改得重新走认证），点它给轻提示而不是死按钮。
//
// 交互：姓名 / 职务点开升起底部编辑抽屉（镜像 A21）；
// 「对候选人的一句话」是页面内直接编辑的多行输入。

import { useRef, useState } from 'react';
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

/** 可在抽屉里编辑的两个字段（公司已认证锁死，不入此表） */
type 表单键 = '姓名' | '职务';

const 表单字段表: { 键: 表单键; 标签: string }[] = [
  { 键: '姓名', 标签: '姓名' },
  { 键: '职务', 标签: '职务' },
];


/** 把用户选的照片压成 256×256 居中裁切的 JPEG dataURL —— 原图可能好几 MB，
 *  localStorage 装不下也没必要装 */
function 压成头像(文件: File): Promise<string> {
  return new Promise((成, 败) => {
    const 读 = new FileReader();
    读.onerror = () => 败(new Error('读取失败'));
    读.onload = () => {
      const 图 = new Image();
      图.onerror = () => 败(new Error('不是可用的图片'));
      图.onload = () => {
        const 边 = 256;
        const 画布 = document.createElement('canvas');
        画布.width = 边;
        画布.height = 边;
        const 笔 = 画布.getContext('2d')!;
        // 居中裁成正方形再缩放（cover）
        const 源边 = Math.min(图.width, 图.height);
        笔.drawImage(图, (图.width - 源边) / 2, (图.height - 源边) / 2, 源边, 源边, 0, 0, 边, 边);
        成(画布.toDataURL('image/jpeg', 0.85));
      };
      图.src = String(读.result);
    };
    读.readAsDataURL(文件);
  });
}

export default function 招聘名片() {
  const { 跳转, 返回 } = use导航();
  // 姓名与公司来自上一步实名认证的结果（全局），职务为设计稿 R9 预填值
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
  const [表单值, 设表单值] = useState<Record<表单键, string>>(() => ({
    姓名: 状态.企业认证.姓名,
    职务: '技术 VP',
  }));
  // 正在编辑哪个字段（null = 抽屉关着）
  const [编辑中, 设编辑中] = useState<表单键 | null>(null);
  // 抽屉草稿：确认前不写回表单，取消就丢掉
  const [草稿, 设草稿] = useState('');

  const 编辑中字段 = 表单字段表.find((字段) => 字段.键 === 编辑中);

  // 打开抽屉时把现值灌进草稿，用户看到的是「改」而不是「重填」
  function 打开编辑(键: 表单键) {
    设编辑中(键);
    设草稿(表单值[键]);
  }

  // 确认：空白视作没改（不允许把字段清空成空串，否则表单条目会塌成空行）
  function 确认编辑() {
    if (编辑中 === null) return;
    const 新值 = 草稿.trim();
    if (新值) 设表单值((旧) => ({ ...旧, [编辑中]: 新值 }));
    设编辑中(null);
  }

  return (
    <次级页外壳>
      <返回栏 返回={返回} />

      {/* 标注 22:48：说明小字删掉，只留标题 */}
      <页面大标题 标题="招聘名片" />

      <滚动区 样式覆盖={{ padding: '6px 22px 0' }}>
        {/* ── 名片预览：候选人从第一轮起看到的就是这一行（不对称双盲的实名侧）。
               头像用姓氏首字圆底，不引入图片上传 —— 招聘方实名靠的是企业认证，
               不是一张自拍；这里给的是「有个具体的人在对面」的辨识度 ── */}
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
              {表单值.职务} · {状态.企业认证.公司}
            </span>
          </span>
        </div>

        {/* ── 姓名 / 职务：点开升起编辑抽屉 ── */}
        {表单字段表.map((字段) => (
          <表单条目
            key={字段.键}
            标签={字段.标签}
            值={表单值[字段.键]}
            按下={() => 打开编辑(字段.键)}
          />
        ))}

        {/* ── 公司：实名认证核验结果，本屏不可改（标注 22:26：不挂「已认证」徽标）── */}
        <表单条目
          标签="公司"
          值={状态.企业认证.公司}
          按下={() => 轻提示('公司已实名核验，如需变更请重新认证')}
        />

        {/* ── 公司主页资料：名片是「这个人」，公司主页是「这家公司」，
               候选人两处都会看，编辑入口挨着放 ── */}
        <表单条目
          标签="公司主页资料"
          值="简介 · 文化 · 作息 · 办公地"
          按下={() => 跳转(路径.公司档案编辑)}
        />

      </滚动区>

      <主按钮 文字="保存 · 去发岗位" 按下={() => 跳转(路径.发布岗位)} />

      {/* ── 编辑抽屉（镜像 添加意向）：点遮罩或确认都关掉 ── */}
      {编辑中字段 ? (
        <>
          <div className={样式.遮罩} onClick={() => 设编辑中(null)} />
          <div className={样式.抽屉}>
            <div className={样式.抽屉头}>
              <span className={样式.抽屉标题}>{编辑中字段.标签}</span>
            </div>
            <input
              className={样式.抽屉输入}
              value={草稿}
              autoFocus
              onChange={(事件) => 设草稿(事件.target.value)}
              onKeyDown={(事件) => {
                // isComposing 挡住中文输入法「回车上屏候选词」那一下被误当确认
                if (事件.key === 'Enter' && !事件.nativeEvent.isComposing) 确认编辑();
              }}
              enterKeyHint="done"
            />
            <主按钮 文字="确定" 按下={确认编辑} />
          </div>
        </>
      ) : null}
    </次级页外壳>
  );
}
