// 年月滚轮选择层（标注意见 2026-08-18：在职时间做成滑动的滚轮）。
//
// 原来用 <input type="month">：iOS 上确实弹原生滚轮，但桌面是日历下拉、
// Android 各家实现不一，同一个原型在三个地方长得不一样，评审时对不上。
// 这里自绘一套，滚动手感与 A3c 薪资轮同源（scroll-snap 吸附 + 停下再取值）。
//
// 边界由 最小 / 最大 收口：入职不能选到未来，离职不能早于入职。
// 年份切换后若当前月越界（如最大是 2026-08，年切到 2026 时 9-12 月要消失），
// 月列表会跟着收缩并把选中值夹回范围内。

import { useEffect, useState } from 'react';
import 样式 from './年月滚轮层.module.css';
import 弹层框架 from './弹层框架';
import { use可访问滚轮 } from './可访问滚轮';

const 行高 = 40;

interface 属性 {
  标题: string;
  /** 'yyyy-MM'，空串表示还没选过，默认落在最大值那一档 */
  初值: string;
  /** 'yyyy-MM'，可选下界 */
  最小?: string;
  /** 'yyyy-MM'，可选上界 */
  最大?: string;
  确认: (值: string) => void;
  取消: () => void;
}

/** 'yyyy-MM' → [年, 月]，非法输入返回 null */
function 拆(值: string): [number, number] | null {
  const 命中 = /^(\d{4})-(\d{2})$/.exec(值);
  if (!命中) return null;
  return [Number(命中[1]), Number(命中[2])];
}

const 拼 = (年: number, 月: number) => `${年}-${String(月).padStart(2, '0')}`;

export default function 年月滚轮层({ 标题, 初值, 最小, 最大, 确认, 取消 }: 属性) {
  const 下界 = 最小 ? 拆(最小) : null;
  const 上界 = 最大 ? 拆(最大) : null;
  const 今年 = new Date().getFullYear();

  const 起年 = 下界?.[0] ?? 1980;
  const 止年 = 上界?.[0] ?? 今年;
  const 年列表 = Array.from({ length: Math.max(1, 止年 - 起年 + 1) }, (_, 序) => 起年 + 序);

  // 没有初值时落在上界（多数场景是「现在」），比落在 1980 少滚几十下
  const 初 = 拆(初值) ?? 上界 ?? [今年, new Date().getMonth() + 1];
  const [年, 设年] = useState(Math.min(Math.max(初[0], 起年), 止年));
  const [月, 设月] = useState(初[1]);

  // 当前年份下允许的月：贴着下界那年从下界月起，贴着上界那年到上界月止
  const 月起 = 下界 && 年 === 下界[0] ? 下界[1] : 1;
  const 月止 = 上界 && 年 === 上界[0] ? 上界[1] : 12;
  const 月列表 = Array.from({ length: Math.max(1, 月止 - 月起 + 1) }, (_, 序) => 月起 + 序);

  // 年一变，月可能越界（如上界 2026-08，从 2025 切到 2026 时 9 月非法）
  useEffect(() => {
    if (月 < 月起) 设月(月起);
    else if (月 > 月止) 设月(月止);
  }, [月, 月起, 月止]);

  return (
    <弹层框架 标签={标题} 遮罩类名={样式.遮罩} 面板类名={样式.层} 关闭={取消} 层级={71}>
        <div className={样式.顶栏}>
          <button className={`${样式.取消键} 可点`} onClick={取消}>
            取消
          </button>
          <span className={样式.标题}>{标题}</span>
          <button className={`${样式.确认键} 可点`} onClick={() => 确认(拼(年, 月))}>
            完成
          </button>
        </div>

        <div className={样式.轮区}>
          {/* 中间那一档的高亮底，不接收点击 */}
          <div className={样式.高亮带} />
          <滚轮列 选项={年列表} 值={年} 设值={设年} 单位="年" 名称="年份" />
          <滚轮列 选项={月列表} 值={月} 设值={设月} 单位="月" 名称="月份" />
        </div>
    </弹层框架>
  );
}

/** 一列滚轮。上下各垫两行的内边距，首尾档也能滚到正中间 */
function 滚轮列({
  选项,
  值,
  设值,
  单位,
  名称,
}: {
  选项: number[];
  值: number;
  设值: (值: number) => void;
  单位: string;
  名称: string;
}) {
  // 键盘、点档直选、aria-activedescendant、90ms 防抖与程序 scroll 抑制收敛在 use可访问滚轮
  // （与 内嵌双滚轮 / 数字滚轮层 / 引导问答 薪资轮 同一套合同），这里只留版式。
  // 月份列表随年份收缩时不在这做夹紧：上面的父组件 effect 负责把 月 夹回合法档，
  // Hook 只认夹紧后的受控值，active descendant 自然跟着落到新那一档。
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
      {/* 单位钉在滚动区外、垂直居中正对高亮带。年列挂「年」、月列挂「月」，两列各一个不会混 */}
      <span className={样式.固定单位}>{单位}</span>
    </div>
  );
}
