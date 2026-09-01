// 页面内嵌的双列滚轮（2026-08-20 按 BOSS 截图顺序重排新增）。
// 创建在线简历的「出生年月」（年 1970–2010 / 月 1–12）与
// 就读时间段的「入学年 / 毕业年」（2000–2030）共用。
//
// 滚动手感与 引导问答 的薪资轮同源：scroll-snap-type: y mandatory 让浏览器
// 负责吸附，停下（90ms 无新事件）后算一次落点；中间一行有高亮底。
// 与 数字滚轮层 的区别：那是底部弹层，这里直接铺在页面卡片里（截图形态）。
//
// 交互机制（键盘、点档直选、aria-activedescendant、90ms 防抖与程序 scroll 抑制）
// 收敛在 use可访问滚轮 —— 内嵌双滚轮 / 薪资区间层 等共用一套合同，本组件只留版式。

import 样式 from './内嵌双滚轮.module.css';
import { use可访问滚轮 } from './可访问滚轮';

const 行高 = 46;

export default function 内嵌双滚轮({
  左档,
  右档,
  左值,
  右值,
  设左值,
  设右值,
  左名,
  右名,
  左单位 = '',
  右单位 = '',
}: {
  左档: number[];
  右档: number[];
  左值: number;
  右值: number;
  设左值: (值: number) => void;
  设右值: (值: number) => void;
  /** 无障碍名，如「出生年」/「出生月」 */
  左名: string;
  右名: string;
  /** 档位后缀，如「年」「月」 */
  左单位?: string;
  右单位?: string;
}) {
  return (
    <div className={样式.轮容器}>
      {/* 中间档高亮底：不接收点击 */}
      <div className={样式.轮高亮} />
      <单列 档表={左档} 值={左值} 设值={设左值} 名称={左名} 单位={左单位} />
      <单列 档表={右档} 值={右值} 设值={设右值} 名称={右名} 单位={右单位} />
    </div>
  );
}

function 单列({
  档表,
  值,
  设值,
  名称,
  单位,
}: {
  档表: number[];
  值: number;
  设值: (值: number) => void;
  名称: string;
  单位: string;
}) {
  const {
    滚轮引用,
    活动项编号,
    处理滚动,
    处理按键,
    取选项属性,
  } = use可访问滚轮({ 选项: 档表, 值, 设值, 行高 });

  return (
    <div className={样式.列包}>
      <div
        ref={滚轮引用}
        className={`${样式.滚轮} 滚动区`}
        onScroll={处理滚动}
        onKeyDown={处理按键}
        role="listbox"
        tabIndex={0}
        aria-label={名称}
        aria-activedescendant={活动项编号}
      >
        {档表.map((档, 序号) => (
          <div
            key={档}
            className={样式.档}
            role="option"
            aria-selected={档 === 值}
            {...取选项属性(序号)}
          >
            {/* 档里只留数字。标注 2026-08-22：「这个年应该是固定的，用户只用转动数字就行，
                包括后面的这个月份，不用每个滚轮数字后面都带有年和月」*/}
            <span className={`${档 === 值 ? 样式.档选中 : 样式.档未选} 等宽数字`}>{档}</span>
          </div>
        ))}
      </div>
      {/* 单位钉在滚动区**外面**：滚动时它不动，垂直居中正对高亮档。
          每一列各挂一个，所以「年」「月」不会混成一列的标签。 */}
      {单位 ? <span className={样式.固定单位}>{单位}</span> : null}
    </div>
  );
}
