// 薪资要求双滚轮弹层（2026-08-21 按「添加求职期望」截图 4 新增）。
//
// 从底部升起的弹层：左列选下限、右列选上限，档位 3–100 千元、步长 1。
// 壳复用 弹层框架（遮罩 + Escape 关闭 + 焦点恢复），滚动手感复用 内嵌双滚轮
// （scroll-snap 吸附 + 停下 90ms 取落点 + 中间档高亮底），不另起炉灶。
//
// 与 数字滚轮层 的区别：那是单列，这里要同时定下限和上限两个数。

import { useState } from 'react';
import 样式 from './薪资区间层.module.css';
import 弹层框架 from './弹层框架';
import 内嵌双滚轮 from './内嵌双滚轮';

/** 档位：3–100 千元，步长 1。上下限两列共用同一份档表。 */
const 档位表 = Array.from({ length: 98 }, (_, 序) => 3 + 序);

/** 下限/上限未填时的落点（截图里首开就停在 10 / 11） */
const 默认下限 = 10;
const 默认上限 = 11;

interface 属性 {
  /** 已选下限，千元；null = 还没选过 */
  下限: number | null;
  /** 已选上限，千元；null = 还没选过 */
  上限: number | null;
  确认: (下: number, 上: number) => void;
  取消: () => void;
}

/** 把外部传进来的值夹进档表范围，防止历史脏数据（如 0 或 200）让滚轮定位不到档 */
function 夹到档内(值: number | null, 兜底: number): number {
  if (值 === null) return 兜底;
  return Math.min(Math.max(值, 档位表[0]), 档位表[档位表.length - 1]);
}

const 标题文案 = '薪资要求(月薪，单位:千元)';

export default function 薪资区间层({ 下限, 上限, 确认, 取消 }: 属性) {
  const [下限值, 设下限值] = useState(() => 夹到档内(下限, 默认下限));
  const [上限值, 设上限值] = useState(() => 夹到档内(上限, 默认上限));

  // 两列各滚各的，中途允许出现上限 < 下限的中间态（否则一列会把另一列顶着跑，手感很差）；
  // 只在点「确定」这一刻把上限抬到等于下限，既不报错也不把用户的选择静默丢掉。
  const 点确定 = () => {
    const 最终上限 = Math.max(上限值, 下限值);
    确认(下限值, 最终上限);
  };

  return (
    <弹层框架 标签={标题文案} 遮罩类名={样式.遮罩} 面板类名={样式.层} 关闭={取消} 层级={71}>
      <div className={样式.顶栏}>
        <button type="button" className={`${样式.取消键} 可点`} onClick={取消}>
          取消
        </button>
        <span className={样式.标题}>{标题文案}</span>
        <button type="button" className={`${样式.确认键} 可点`} onClick={点确定}>
          确定
        </button>
      </div>

      <div className={样式.轮区}>
        <内嵌双滚轮
          左档={档位表}
          右档={档位表}
          左值={下限值}
          右值={上限值}
          设左值={设下限值}
          设右值={设上限值}
          左名="薪资下限"
          右名="薪资上限"
          左单位="K"
          右单位="K"
        />
      </div>
    </弹层框架>
  );
}
