// 单列数字滚轮（标注 2026-08-18：年薪月数从 12 往上滚；同日「直接填」手填行
// 按标注删除 —— 滚轮范围放宽到 12-36，极端值也在轮内，不再需要手填）。
// 滚动手感与薪资轮 / 年月轮同源。
// picker 统一 Task 2（2026-09-15）：新增可选离散档（档位 数组），供求职侧实习
// 月数 [1,3,6] / 每周到岗天数 [2,3,4,5] 这类只开放产品定档的字段；连续范围调用方
// （岗位 1-24 / 1-7、年薪月数 12-36、开始工作年份）合同不变。顶栏确认键统一「确定」。

import { useState } from 'react';
import 样式 from './数字滚轮层.module.css';
import 弹层框架 from './弹层框架';
import { use可访问滚轮 } from './可访问滚轮';

const 行高 = 40;

/** 档位来源二选一：调用方静态给出的离散档表，或连续闭区间（混传由类型拦下） */
type 档位输入 =
  | { 档位: readonly number[]; 最小?: never; 最大?: never; 步长?: never }
  | { 档位?: undefined; 最小: number; 最大: number;
      /** 相邻两档的间隔，默认 1。日薪/时薪用 10 —— 标注 2026-08-22：
       *  「这个根据一次 10 块来加，而不是现在的 1 块」。
       *  50→800 按 1 递增是 751 档，滚到目标价要划半天，而薪资本来就不需要精确到个位。 */
      步长?: number };

type 属性 = 档位输入 & {
  标题: string;
  /** 当前值（纯数字，不带单位） */
  初值: number;
  /** 单位后缀，如「薪」 */
  单位: string;
  确认: (值: number) => void;
  取消: () => void;
};

export default function 数字滚轮层({ 标题, 初值, 档位, 最小, 最大, 单位, 步长 = 1, 确认, 取消 }: 属性) {
  // 离散档原样用调用方的表；连续范围沿原公式生成
  const 选项: readonly number[] = 档位 ?? Array.from(
    { length: Math.floor((最大 - 最小) / 步长) + 1 },
    (_, 序) => 最小 + 序 * 步长,
  );
  // 初值可能不在档上（老数据、或步长/档表改过之后）：连续范围夹进区间后吸附到
  // 最近的档；离散档取最近档、距离相同取较小档（档表升序，先遇到的不换）——
  // 否则 选项.indexOf(值) 返回 -1，滚轮定位不到、停在第一档而显示值是另一个数。
  const 吸附 = (原: number) => {
    if (档位 !== undefined) {
      let 最近 = 档位[0];
      for (const 档 of 档位) {
        if (Math.abs(档 - 原) < Math.abs(最近 - 原)) 最近 = 档;
      }
      return 最近;
    }
    const 夹后 = Math.min(Math.max(原, 最小), 最大);
    return 最小 + Math.round((夹后 - 最小) / 步长) * 步长;
  };
  const [值, 设值] = useState(() => 吸附(初值));

  return (
    <弹层框架 标签={标题} 遮罩类名={样式.遮罩} 面板类名={样式.层} 关闭={取消} 层级={71}>
        <div className={样式.顶栏}>
          <button className={`${样式.取消键} 可点`} onClick={取消}>
            取消
          </button>
          <span className={样式.标题}>{标题}</span>
          <button className={`${样式.确认键} 可点`} onClick={() => 确认(值)}>
            确定
          </button>
        </div>

        <div className={样式.轮区}>
          <div className={样式.高亮带} />
          <滚轮列 选项={选项} 值={值} 设值={设值} 单位={单位} 名称={标题} />
        </div>
    </弹层框架>
  );
}

/** 一列滚轮。上下各垫两行内边距，首尾档也能滚到正中间 */
function 滚轮列({
  选项,
  值,
  设值,
  单位,
  名称,
}: {
  选项: readonly number[];
  值: number;
  设值: (值: number) => void;
  单位: string;
  名称: string;
}) {
  // 键盘、点档直选、aria-activedescendant、90ms 防抖与程序 scroll 抑制都收敛在
  // use可访问滚轮（与 内嵌双滚轮 / 年月滚轮层 / 引导问答 薪资轮 同一套合同），这里只留版式。
  const {
    滚轮引用,
    活动项编号,
    处理滚动,
    处理按键,
    取选项属性,
  } = use可访问滚轮({ 选项, 值, 设值, 行高 });

  return (
    <div className={样式.列包}>
      <div
        ref={滚轮引用}
        className={`${样式.列} 滚动区`}
        onScroll={处理滚动}
        onKeyDown={处理按键}
        role="listbox"
        tabIndex={0}
        aria-label={名称}
        aria-activedescendant={活动项编号}
      >
        {选项.map((项, 序号) => (
          <div
            key={项}
            className={样式.档}
            role="option"
            aria-selected={项 === 值}
            {...取选项属性(序号)}
          >
            {/* 档里只留数字。标注 2026-08-22：「不用每个滚轮数字后面都带有年和月」*/}
            <span className={`${项 === 值 ? 样式.档选中 : 样式.档未选} 等宽数字`}>{项}</span>
          </div>
        ))}
      </div>
      {/* 单位钉在滚动区外、垂直居中正对高亮带，滚动时不动 */}
      <span className={样式.固定单位}>{单位}</span>
    </div>
  );
}
