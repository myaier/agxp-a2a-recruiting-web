// 个人信息(求职端)—— 「我」页顶部头像行的落点(2026-08-26 用户指定,版式参照 BOSS 直聘同名页)。
//
// 此前头像行直接跳「我的简历」,与常用功能宫格里的「我的简历」入口重复;
// 用户裁定:点名字/头像应该看到的是**账号身份**(头像/姓名/联系方式),不是简历。
// 招聘端的镜像是「招聘名片」——两端从此对称:头像行都进"我是谁",简历/岗位走各自宫格。
//
// 字段口径:
//   · 姓名读 全局.基本信息.真名,编辑入口保持唯一(基本信息页),本屏只展示、点击跳编辑;
//   · 手机/微信/邮箱读 简历联系方式(样例假值,接后端换接口字段);
//     手机与微信参照 BOSS 打码展示——即使是自己的页面,肩后一瞥不该看光;
//   · 披露时机的口径在披露偏好页(设置里进),本屏不放入口(2026-08-26 标注删除)。

import { useRef } from 'react';
import 样式 from './个人信息.module.css';
import { 次级页外壳, 返回栏, 页面大标题, 滚动区, 表单条目 } from '../组件/通用';
import { 相机图标 } from '../组件/图标';
import { 轻提示 } from '../组件/轻提示';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 路径 } from '../路由/路径表';
import { 简历联系方式 } from '../数据/模拟数据';

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

/** 把用户选的照片压成 256×256 居中裁切的 JPEG dataURL(与 添加头像/招聘名片 同一压法) */
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
        const 源边 = Math.min(图.width, 图.height);
        笔.drawImage(图, (图.width - 源边) / 2, (图.height - 源边) / 2, 源边, 源边, 0, 0, 边, 边);
        成(画布.toDataURL('image/jpeg', 0.85));
      };
      图.src = String(读.result);
    };
    读.readAsDataURL(文件);
  });
}

export default function 个人信息() {
  const { 返回, 跳转 } = use导航();
  const { 状态, 派发 } = use应用状态();
  const 文件框 = useRef<HTMLInputElement>(null);
  const 真名 = 状态.基本信息.真名;

  async function 选了照片(事件: React.ChangeEvent<HTMLInputElement>) {
    const 文件 = 事件.target.files?.[0];
    事件.target.value = '';
    if (!文件) return;
    try {
      派发({ 型: '存求职头像', 图: await 压成头像(文件) });
      轻提示('头像已更新');
    } catch {
      轻提示('这张图片读不出来，换一张试试');
    }
  }

  return (
    <次级页外壳 白底>
      <返回栏 返回={返回} />
      <页面大标题 标题="个人信息" />

      <滚动区 样式覆盖={{ padding: '6px 22px 0' }}>
        {/* ── 头像行:标签在左,预览圆在右,整行可点换头像 ── */}
        <button className={`${样式.头像条目} 可点`} onClick={() => 文件框.current?.click()}>
          <span className={样式.条目标签}>头像</span>
          <span className={样式.头像位}>
            {状态.求职头像?.startsWith('data:image/') ? (
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

        {/* 姓名:展示真名,编辑入口保持唯一 —— 点击去基本信息页改 */}
        <表单条目 标签="姓名" 值={真名 || '未填写'} 按下={() => 跳转(路径.基本信息)} />

        {/* ── 联系方式三行:纯展示,打码,不带尖括号(没有编辑流,不摆假入口)── */}
        <div className={样式.展示条目}>
          <span className={样式.条目标签}>手机号</span>
          <span className={`${样式.条目值} 等宽数字`}>{打码手机(简历联系方式.手机)}</span>
        </div>
        <div className={样式.展示条目}>
          <span className={样式.条目标签}>微信号</span>
          <span className={样式.条目值}>{打码微信(简历联系方式.微信)}</span>
        </div>
        <div className={样式.展示条目}>
          <span className={样式.条目标签}>邮箱</span>
          <span className={`${样式.条目值} 单行`}>{简历联系方式.邮箱}</span>
        </div>
      </滚动区>
    </次级页外壳>
  );
}
