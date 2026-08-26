// 个人信息(求职端)—— 「我」页顶部头像行的落点(2026-08-26 用户指定,版式参照 BOSS 直聘同名页)。
//
// 此前头像行直接跳「我的简历」,与常用功能宫格里的「我的简历」入口重复;
// 用户裁定:点名字/头像应该看到的是**账号身份**(头像/姓名/联系方式),不是简历。
// 招聘端的镜像是「招聘名片」——两端从此对称:头像行都进"我是谁",简历/岗位走各自宫格。
//
// 字段口径:
//   · 姓名读 全局.基本信息.真名,本屏只展示;现有 /basic 属于注册流,不从设置页误入;
//   · 手机/微信/邮箱读 简历联系方式(样例假值,接后端换接口字段);
//     手机与微信参照 BOSS 打码展示——即使是自己的页面,肩后一瞥不该看光;
//   · 联系方式的披露时机说明不在本屏重复,披露偏好页已有整段口径,放一个入口行。

import { useRef } from 'react';
import 样式 from './个人信息.module.css';
import { 次级页外壳, 返回栏, 页面大标题, 滚动区, 表单条目 } from '../组件/通用';
import { 相机图标 } from '../组件/图标';
import { 轻提示 } from '../组件/轻提示';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 路径 } from '../路由/路径表';
import { 简历联系方式 } from '../数据/模拟数据';
import { 打码微信号, 打码手机号 } from '../数据/隐私展示';
import { 压成头像 } from '../组件/头像处理';

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

      <滚动区 样式覆盖={{ padding: '6px 22px 24px' }}>
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

        {/* 姓名只展示：/basic 是注册流，待有独立账号编辑流后再接可点入口。 */}
        <div className={样式.展示条目}>
          <span className={样式.条目标签}>姓名</span>
          <span className={`${样式.条目值} 单行`}>{真名 || '未填写'}</span>
        </div>

        {/* ── 联系方式三行:纯展示,打码,不带尖括号(没有编辑流,不摆假入口)── */}
        <div className={样式.展示条目}>
          <span className={样式.条目标签}>手机号</span>
          <span className={`${样式.条目值} 等宽数字`}>{打码手机号(简历联系方式.手机)}</span>
        </div>
        <div className={样式.展示条目}>
          <span className={样式.条目标签}>微信号</span>
          <span className={样式.条目值}>{打码微信号(简历联系方式.微信)}</span>
        </div>
        <div className={样式.展示条目}>
          <span className={样式.条目标签}>邮箱</span>
          <span className={`${样式.条目值} 单行`}>{简历联系方式.邮箱}</span>
        </div>

        {/* 这些信息什么时候给对方看 —— 口径在披露偏好页,放入口不重复文案 */}
        <表单条目 标签="披露偏好" 值="姓名与联系方式的披露时机" 按下={() => 跳转(路径.披露偏好)} />
      </滚动区>
    </次级页外壳>
  );
}
