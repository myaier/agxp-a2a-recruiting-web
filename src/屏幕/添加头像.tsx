// 添加头像（/onboard/avatar）—— 2026-08-20 按 BOSS 截图顺序重排：注册流最后一屏。
// 大圆上传位（选图片压成 dataURL）+ 4 枚我们自己的 人像头 渐变纪念章可选。
// 头像落 全局.求职头像（dataURL 或 '章:N'，localStorage 键 AGXP求职头像v1，
// 实现镜像 招聘头像 切片）。「开启求职之旅」→ 替换跳转进主壳，后退不能回注册流。

import { useRef } from 'react';
import 样式 from './入职引导.module.css';
import 人像头 from '../组件/人像头';
import { 次级页外壳, 返回栏, 页面大标题, 主按钮, 滚动区 } from '../组件/通用';
import { 相机图标 } from '../组件/图标';
import { 轻提示 } from '../组件/轻提示';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';

/** 四枚虚拟纪念章：键值经散列后渐变索引 5/0/1/2 互不相同，四枚颜色各异 */
const 纪念章编号们 = [1, 2, 3, 4] as const;

/** 把用户选的照片压成 256×256 居中裁切的 JPEG dataURL —— 原图可能好几 MB，
 *  localStorage 装不下也没必要装（与 招聘名片 的压法同源） */
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

export default function 添加头像() {
  const { 返回, 进主壳 } = use导航();
  const { 状态: 全局, 派发 } = use应用状态();
  const 文件框 = useRef<HTMLInputElement>(null);
  const 头像 = 全局.求职头像;
  // 纪念章上压真名首字：与 人像头 在别处「化名首字」的用法同构
  const 首字 = 全局.基本信息.真名.charAt(0);

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
    <次级页外壳>
      <返回栏 返回={返回} />

      <页面大标题 标题="添加头像" />

      <滚动区 样式覆盖={{ padding: '4px 22px 12px' }}>
        <div className={样式.头像区}>
          {/* 大圆上传位：没选时是相机占位；选了照片显示照片；选了纪念章显示纪念章 */}
          <button
            className={`${样式.大圆} 可点`}
            onClick={() => 文件框.current?.click()}
            aria-label="上传头像照片"
          >
            {头像?.startsWith('data:image/') ? (
              <img className={样式.头像图} src={头像} alt="" />
            ) : 头像?.startsWith('章:') ? (
              <人像头 键={`章${头像.slice(2)}`} 首字={首字} 尺寸={128} />
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

          <div className={样式.虚拟头像提示}>也可以选择下方虚拟头像</div>

          {/* 四枚渐变纪念章：点选即落全局，选中的带描边环 */}
          <div className={样式.章行}>
            {纪念章编号们.map((编号) => {
              const 选中 = 头像 === `章:${编号}`;
              return (
                <button
                  key={编号}
                  className={`${样式.章钮} ${选中 ? 样式.章钮选中 : ''} 可点`}
                  onClick={() => 派发({ 型: '存求职头像', 图: `章:${编号}` })}
                  aria-pressed={选中}
                  aria-label={`虚拟头像 ${编号}`}
                >
                  <人像头 键={`章${编号}`} 首字={首字} 尺寸={56} />
                </button>
              );
            })}
          </div>
        </div>
      </滚动区>

      <主按钮 文字="开启求职之旅" 按下={进主壳} />
    </次级页外壳>
  );
}
