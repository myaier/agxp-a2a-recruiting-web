// 添加头像（/onboard/avatar）—— 2026-08-20 按 BOSS 截图顺序重排：注册流最后一屏。
// 大圆上传位（选图片压成 dataURL）。标注 2026-08-20 18:07：我们设计的虚拟头像删掉，只留用户自己上传。
// 头像落 全局.求职头像；Provider 统一按模式/环境/账号隔离缓存。
// 「完成注册」（标注 2026-08-24：原「开启求职之旅」营销腔，产品负责人终定）→ 替换跳转进主壳，后退不能回注册流。

import { useRef } from 'react';
import 样式 from './入职引导.module.css';
import { 次级页外壳, 返回栏, 页面大标题, 主按钮, 滚动区 } from '../组件/通用';
import { 相机图标 } from '../组件/图标';
import { 轻提示 } from '../组件/轻提示';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 压成头像 } from '../组件/头像处理';

export default function 添加头像() {
  const { 返回, 进初始化 } = use导航();
  const { 状态: 全局, 派发, 数据源模式, 操作 } = use应用状态();
  const 文件框 = useRef<HTMLInputElement>(null);
  const 头像 = 全局.求职头像;

  /** 注册收尾：先进初始化页（2026-08-25 用户定稿的乙方案），
      播完由初始化页替换进主壳；落地回主页而不是上次停留的 Tab（2026-08-20） */
  const 开启 = () => {
    派发({ 型: '切Tab', Tab: '职位' });
    派发({ 型: '切子视图', 子视图: '在谈' });
    // 注册完成（设计 §9 / Task 7）：作废候选 onboarding 预填轮与恢复元数据
    //（内存建议 + session 存储一起清），完成注册后旧建议绝不再残留。预填域
    // Backend-only，Mock 会话零预填操作。清完再走既有初始化导航。
    if (数据源模式 === 'backend') 操作.清候选Onboarding预填();
    进初始化();
  };

  async function 选了照片(事件: React.ChangeEvent<HTMLInputElement>) {
    const 文件 = 事件.target.files?.[0];
    事件.target.value = ''; // 允许再次选同一张
    if (!文件) return;
    try {
      派发({ 型: '存求职头像', 图: await 压成头像(文件) });
    } catch {
      轻提示('这张图片读不出来，换一张试试');
    }
  }

  return (
    <次级页外壳 白底>
      <返回栏 返回={返回} />

      <页面大标题 标题="添加头像" />

      <滚动区 样式覆盖={{ padding: '4px 22px 12px' }}>
        <div className={样式.头像区}>
          {/* 大圆 = 唯一的头像入口（标注 18:07：虚拟头像删掉，让用户自己上传）*/}
          <button
            className={`${样式.大圆} 可点`}
            onClick={() => 文件框.current?.click()}
            aria-label="上传头像照片"
          >
            {头像?.startsWith('data:image/') ? (
              <img className={样式.头像图} src={头像} alt="" />
            ) : (
              <相机图标 尺寸={30} 色="var(--弱化)" />
            )}
          </button>
          <input
            ref={文件框}
            type="file"
            accept="image/*"
            className={样式.隐藏文件框}
            onChange={选了照片}
          />
        </div>
      </滚动区>

      <主按钮 文字="完成注册" 按下={开启} />
    </次级页外壳>
  );
}
