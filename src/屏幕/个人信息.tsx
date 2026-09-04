// 个人信息(求职端)—— 「我」页顶部头像行的落点(2026-08-26 用户指定,版式参照 BOSS 直聘同名页)。
//
// 此前头像行直接跳「我的简历」,与常用功能宫格里的「我的简历」入口重复;
// 用户裁定:点名字/头像应该看到的是**账号身份**(头像/姓名/联系方式),不是简历。
// 招聘端的镜像是「招聘名片」——两端对称:头像行都进"我是谁",简历/岗位走各自宫格。
//
// 编辑口径(2026-08-26 用户追加:「改成可以自己编辑和修改的,直接可以点击编辑」):
//   · 姓名/邮箱:常驻裸行输入(名片同款,直接打在线上),收笔即存;
//     姓名写的是 全局.基本信息.真名,走 操作.保存简历(Backend 模式下 PATCH 服务端);
//   · 手机号/微信号:平时打码展示(肩后一瞥不该看光),点一下当场变明文输入,
//     收笔存回并恢复打码——打码与常驻输入互斥,这两行只能做两态;
//   · 联系方式存全局 联系方式 切片(Mock 模式随简历快照持久化),
//     简历原件抬头(简历预览层)读同一切片,改完立刻生效。
//
// Task 6 双模式口径(2026-09-01 后端修复):
//   · Backend 的「账号手机号」只来自 P8 唯一 phone_otp 凭证的服务端 display
//     (登录凭证,不是披露联系方式):读取中/失败/两条以上一律「—」,无 phone_otp 落
//     「未绑定」,恰一条原样上屏;行只读,点击去账号与安全页换绑,掩码绝不进
//     可编辑组件状态,也绝不写进简历/披露联系方式。
//   · Backend 披露联系方式(简历披露手机号/邮箱/微信号)三行独立只读、固定「未接入」
//     (服务端披露写线未接入),不读 Mock 联系方式切片、零「存联系方式」派发。
//   · Mock 的手机/微信打码编辑与邮箱常驻输入逐字节保留。

import { useEffect, useRef, useState } from 'react';
import 样式 from './个人信息.module.css';
import { 次级页外壳, 返回栏, 页面大标题, 滚动区 } from '../组件/通用';
import { 相机图标 } from '../组件/图标';
import { 轻提示 } from '../组件/轻提示';
import { 取后端错误文案 } from '../数据/HTTP客户端';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { use应用状态 } from '../状态/应用状态';
import type { 联系方式型 } from '../数据/类型';
import { 压成头像 } from '../组件/头像处理';

/** 手机号打码:前三后二,中间六星(138 0217 6021 → 138******21) */
function 打码手机(号: string): string {
  const 纯 = 号.replace(/\s/g, '');
  if (纯.length < 7) return 号;
  return `${纯.slice(0, 3)}******${纯.slice(-2)}`;
}

/** 微信号打码:前三后二,中间三星(shenyizhou_88 → she***88) */
function 打码微信(号: string): string {
  if (号.length < 6) return 号;
  return `${号.slice(0, 3)}***${号.slice(-2)}`;
}

const 头像字节上限 = 10 * 1024 * 1024;

export default function 个人信息() {
  const { 返回, 跳转 } = use导航();
  const { 状态, 派发, 操作, 数据源模式, 后端状态 } = use应用状态();
  const 是后端 = 数据源模式 === 'backend';
  const 文件框 = useRef<HTMLInputElement>(null);
  const [头像保存中, 设头像保存中] = useState(false);
  const 真名 = 状态.基本信息.真名;

  // Backend 进屏按需读取凭证一次（设置页同款：零会话请求、零账号范围登记；
  // 非 force 且已成功时操作层零请求）；Mock 零 P8 调用。
  useEffect(() => {
    if (!是后端) return;
    void 操作.加载P8凭证().catch(() => undefined);
  }, [是后端, 操作]);

  // 账号手机号投影（与 设置/账号安全 同一凭证快照）：唯一 phone_otp 行的服务端
  // display 原样上屏；未成功快照（含读取失败）与两条以上一律失败关闭为「—」，
  // 绝不挑第一条、绝不客户端重掩码、绝不下探本地联系方式切片。
  const 手机凭证们 = 后端状态.credentials.data?.filter((行) => 行.provider === 'phone_otp') ?? [];
  const 账号手机号 = 后端状态.credentials.phase !== 'success'
    ? '—'
    : 手机凭证们.length === 0
      ? '未绑定'
      : 手机凭证们.length === 1
        ? 手机凭证们[0].display
        : '—';

  async function 选了照片(事件: React.ChangeEvent<HTMLInputElement>) {
    const 文件 = 事件.target.files?.[0];
    事件.target.value = '';
    if (!文件) return;
    if (文件.type !== 'image/png' && 文件.type !== 'image/jpeg') {
      轻提示('请选择 JPG 或 PNG 图片');
      return;
    }
    if (文件.size > 头像字节上限) {
      轻提示('图片不超过 10 MiB');
      return;
    }
    设头像保存中(true);
    try {
      if (是后端) await 操作.保存候选头像(文件);
      else 派发({ 型: '存求职头像', 图: await 压成头像(文件) });
      轻提示('头像已更新');
    } catch (错误) {
      轻提示(是后端 ? 取后端错误文案(错误) : '这张图片读不出来，换一张试试');
    } finally {
      设头像保存中(false);
    }
  }

  async function 移除头像() {
    if (!是后端 || 头像保存中) return;
    设头像保存中(true);
    try {
      await 操作.删除候选头像();
      轻提示('头像已移除');
    } catch (错误) {
      轻提示(取后端错误文案(错误));
    } finally {
      设头像保存中(false);
    }
  }

  /** 姓名收笔:空白或没改视作没动;改了走 保存简历(真名的写路径只有这一条 API) */
  async function 存姓名(输入值: string) {
    const 新名 = 输入值.trim();
    if (!新名 || 新名 === 真名.trim()) return;
    try {
      await 操作.保存简历({
        基本信息: { ...状态.基本信息, 真名: 新名 },
        个人优势: 状态.个人优势,
        技能: 状态.简历技能,
        经历: 状态.简历经历,
        教育: 状态.简历教育,
        证书: 状态.简历证书,
      });
    } catch (错误) {
      轻提示(取后端错误文案(错误));
    }
  }

  /** 联系方式收笔:空白视作没改(不许清空成空行) */
  function 存联系字段(键: keyof 联系方式型, 输入值: string) {
    const 新值 = 输入值.trim();
    if (新值 && 新值 !== 状态.联系方式[键]) 派发({ 型: '存联系方式', 补丁: { [键]: 新值 } });
  }

  return (
    <次级页外壳 白底>
      <返回栏 返回={返回} />
      <页面大标题 标题="个人信息" />

      <滚动区 样式覆盖={{ padding: '6px 22px 0' }}>
        {/* ── 头像行:标签在左,预览圆在右,整行可点换头像 ── */}
        <button className={`${样式.头像条目} 可点`} onClick={() => 文件框.current?.click()} disabled={头像保存中}>
          <span className={样式.条目标签}>头像</span>
          <span className={样式.头像位}>
            {状态.求职头像 ? (
              <img className={样式.头像图} src={状态.求职头像} alt="" />
            ) : (
              <span className={样式.头像字}>{真名.charAt(0) || '头'}</span>
            )}
            <span className={样式.相机角标}>
              <相机图标 尺寸={11} 色="var(--正文)" />
            </span>
          </span>
        </button>
        <input
          ref={文件框}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={选了照片}
        />
        {是后端 && 状态.求职头像 ? (
          <button className={`${样式.移除头像} 可点`} onClick={移除头像} disabled={头像保存中}>
            移除头像
          </button>
        ) : null}

        <裸行编辑 标签="姓名" 值={真名} 收笔={存姓名} />

        {是后端 ? (
          <>
            {/* 账号手机号：登录凭证，只读展示，点击去账号与安全页换绑；
                掩码绝不复制进任何可编辑输入 */}
            <button
              className={`${样式.展示条目} ${样式.整行可点} 可点`}
              aria-label="账号手机号"
              onClick={() => 跳转(路径.账号安全)}
            >
              <span className={样式.条目标签}>账号手机号</span>
              <span className={`${样式.条目值} 等宽数字`}>{账号手机号}</span>
            </button>
            {/* 披露联系方式三行独立只读：服务端披露写线未接入，固定「未接入」；
                不读 联系方式 切片、零 存联系方式 派发、零虚构 API */}
            <只读行 标签="简历披露手机号" />
            <只读行 标签="微信号" />
            <只读行 标签="邮箱" />
          </>
        ) : (
          <>
            <打码编辑 标签="手机号" 值={状态.联系方式.手机} 打码={打码手机} 数字体
              收笔={(值) => 存联系字段('手机', 值)} />
            <打码编辑 标签="微信号" 值={状态.联系方式.微信} 打码={打码微信}
              收笔={(值) => 存联系字段('微信', 值)} />

            <裸行编辑 标签="邮箱" 值={状态.联系方式.邮箱} 收笔={(值) => 存联系字段('邮箱', 值)} />
          </>
        )}
      </滚动区>
    </次级页外壳>
  );
}

/** 只读行(Backend 披露联系方式):固定「未接入」,不是按钮、没有输入,永不读本地切片 */
function 只读行({ 标签 }: { 标签: string }) {
  return (
    <div className={样式.展示条目}>
      <span className={样式.条目标签}>{标签}</span>
      <span className={样式.条目值}>未接入</span>
    </div>
  );
}

/** 常驻裸行输入(招聘名片同款):无框无底,行分隔线就是下划线,失焦/回车收笔 */
function 裸行编辑({
  标签,
  值,
  收笔,
}: {
  标签: string;
  值: string;
  收笔: (输入值: string) => void;
}) {
  return (
    <div className={样式.展示条目}>
      <span className={样式.条目标签}>{标签}</span>
      <input
        className={样式.裸输入}
        defaultValue={值}
        aria-label={标签}
        enterKeyHint="done"
        onBlur={(事件) => 收笔(事件.currentTarget.value)}
        onKeyDown={(事件) => {
          // isComposing 挡住中文输入法回车上屏那一下;blur() 让收笔只走 onBlur 一条路径
          if (事件.key === 'Enter' && !事件.nativeEvent.isComposing) {
            事件.currentTarget.blur();
          }
        }}
      />
    </div>
  );
}

/** 打码字段的两态编辑:展示态打码,点一下变明文裸输入(自动聚焦),收笔恢复打码。
 *  打码与常驻输入天然互斥——输入框里的值必须是明文,所以这两行只能做两态 */
function 打码编辑({
  标签,
  值,
  打码,
  收笔,
  数字体,
}: {
  标签: string;
  值: string;
  打码: (原: string) => string;
  收笔: (输入值: string) => void;
  数字体?: boolean;
}) {
  const [编辑中, 设编辑中] = useState(false);
  if (!编辑中) {
    return (
      <button
        className={`${样式.展示条目} ${样式.整行可点} 可点`}
        onClick={() => 设编辑中(true)}
        aria-label={`编辑${标签}`}
      >
        <span className={样式.条目标签}>{标签}</span>
        <span className={`${样式.条目值} ${数字体 ? '等宽数字' : ''}`}>{打码(值)}</span>
      </button>
    );
  }
  return (
    <div className={样式.展示条目}>
      <span className={样式.条目标签}>{标签}</span>
      <input
        className={`${样式.裸输入} ${数字体 ? '等宽数字' : ''}`}
        defaultValue={值}
        aria-label={标签}
        enterKeyHint="done"
        autoFocus
        onBlur={(事件) => {
          收笔(事件.currentTarget.value);
          设编辑中(false);
        }}
        onKeyDown={(事件) => {
          if (事件.key === 'Enter' && !事件.nativeEvent.isComposing) {
            事件.currentTarget.blur();
          }
        }}
      />
    </div>
  );
}
