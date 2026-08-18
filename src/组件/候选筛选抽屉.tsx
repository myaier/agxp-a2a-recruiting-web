// 候选筛选抽屉 —— 「筛选 ▾」的真实实现，候选推荐 与 企业在谈候选 共用。
//
// 【为什么没有薪资维度】双盲机制里薪资数字双向不披露，企业侧拿不到候选人的期望数字，
// 只知道「带宽是否有交集」。所以这里绝不能出现「期望薪资 ≤ X」这类筛选条 ——
// 那等于把数字重新拉回台面上。带宽交集是代理在初筛里核对的事，不是人工筛选项。
//
// 未知特征一律放行（不是过滤掉）：在谈候选的数据结构里没有结构化的学历/求职状态，
// 对一个已经在谈的人凭空判「不合格」比漏筛更糟糕。

import 样式 from './候选筛选抽屉.module.css';
import { 开关 } from './通用';

export type 经验档 = '不限' | '3年+' | '5年+' | '8年+';
export type 学历档 = '不限' | '本科+' | '硕士+';
export type 求职状态值 = '在校' | '在职' | '离职';

export interface 候选筛选条件 {
  经验: 经验档;
  学历: 学历档;
  /** 多选；空数组 = 不限 */
  求职状态: 求职状态值[];
  只看收藏: boolean;
}

/** 候选身上可用于筛选的特征。取不到的项写 null，表示这一维度对该候选不做判断 */
export interface 候选特征 {
  经验年: number | null;
  学历: string | null;
  求职状态: string | null;
}

export const 空筛选条件: 候选筛选条件 = {
  经验: '不限',
  学历: '不限',
  求职状态: [],
  只看收藏: false,
};

const 经验档位: 经验档[] = ['不限', '3年+', '5年+', '8年+'];
const 学历档位: 学历档[] = ['不限', '本科+', '硕士+'];
const 求职状态档位: 求职状态值[] = ['在校', '在职', '离职'];

/** 经验档 → 年限下限 */
const 经验下限: Record<经验档, number> = { 不限: 0, '3年+': 3, '5年+': 5, '8年+': 8 };

/** 学历层级：只用于比较高低，不用于展示 */
const 学历层级: Record<string, number> = { 大专: 1, 本科: 2, 硕士: 3, 博士: 4 };
const 学历下限: Record<学历档, number> = { 不限: 0, '本科+': 2, '硕士+': 3 };

/** 已生效的维度个数 —— 顶栏「筛选 ▾」旁边显示的数字就是它 */
export function 生效维度数(条件: 候选筛选条件): number {
  let 计 = 0;
  if (条件.经验 !== '不限') 计 += 1;
  if (条件.学历 !== '不限') 计 += 1;
  if (条件.求职状态.length > 0) 计 += 1;
  if (条件.只看收藏) 计 += 1;
  return 计;
}

/**
 * 从画像行里抠出年限，如「9 年 · Go / 高并发交易 · 字节跳动」→ 9。
 * 在谈候选没有结构化的 经验年 字段，只有这一行文本，所以退而求其次从文本里取。
 */
export function 从画像取经验年(画像: string): number | null {
  const 命中 = /(\d+)\s*年/.exec(画像);
  return 命中 ? Number(命中[1]) : null;
}

/** 一位候选是否命中当前筛选条件。已收藏由调用方查表后传进来 */
export function 命中筛选(特征: 候选特征, 条件: 候选筛选条件, 已收藏: boolean): boolean {
  if (条件.只看收藏 && !已收藏) return false;
  // 下面三项都遵循「取不到就放行」：宁可多显示，不可误杀
  if (特征.经验年 !== null && 特征.经验年 < 经验下限[条件.经验]) return false;
  if (特征.学历 !== null && (学历层级[特征.学历] ?? 0) < 学历下限[条件.学历]) return false;
  if (
    条件.求职状态.length > 0 &&
    特征.求职状态 !== null &&
    !条件.求职状态.includes(特征.求职状态 as 求职状态值)
  ) {
    return false;
  }
  return true;
}

export default function 候选筛选抽屉({
  条件,
  设条件,
  命中数,
  关闭,
}: {
  条件: 候选筛选条件;
  设条件: (新条件: 候选筛选条件) => void;
  /** 当前条件下还剩几个人，实时显示在完成键上 */
  命中数: number;
  关闭: () => void;
}) {
  const 有条件 = 生效维度数(条件) > 0;

  /** 求职状态是多选：已选再点一次就取消 */
  const 切状态 = (值: 求职状态值) =>
    设条件({
      ...条件,
      求职状态: 条件.求职状态.includes(值)
        ? 条件.求职状态.filter((条) => 条 !== 值)
        : [...条件.求职状态, 值],
    });

  return (
    <>
      <div className={样式.遮罩} onClick={关闭} />
      <div className={样式.抽屉} role="dialog" aria-label="筛选候选">
        <div className={样式.抓手} />

        <div className={样式.标题行}>
          <span className={样式.标题}>筛选候选</span>
          <button
            className={`${样式.重置} ${有条件 ? '' : 样式.重置灰} 可点`}
            onClick={() => 设条件(空筛选条件)}
            disabled={!有条件}
          >
            重置
          </button>
        </div>

        <div className={样式.组}>
          <div className={样式.组标}>经 验</div>
          <div className={样式.片行}>
            {经验档位.map((档) => (
              <button
                key={档}
                className={`${样式.片} ${条件.经验 === 档 ? 样式.片选中 : ''} 可点`}
                onClick={() => 设条件({ ...条件, 经验: 档 })}
              >
                {档}
              </button>
            ))}
          </div>
        </div>

        <div className={样式.组}>
          <div className={样式.组标}>学 历</div>
          <div className={样式.片行}>
            {学历档位.map((档) => (
              <button
                key={档}
                className={`${样式.片} ${条件.学历 === 档 ? 样式.片选中 : ''} 可点`}
                onClick={() => 设条件({ ...条件, 学历: 档 })}
              >
                {档}
              </button>
            ))}
          </div>
        </div>

        <div className={样式.组}>
          <div className={样式.组标}>求 职 状 态（可多选）</div>
          <div className={样式.片行}>
            {求职状态档位.map((值) => (
              <button
                key={值}
                className={`${样式.片} ${条件.求职状态.includes(值) ? 样式.片选中 : ''} 可点`}
                onClick={() => 切状态(值)}
              >
                {值}
              </button>
            ))}
          </div>
        </div>

        <div className={样式.收藏行}>
          <span className={样式.收藏文字组}>
            <span className={样式.收藏标题}>只看收藏</span>
            <span className={样式.收藏说明}>你点过 ★ 的候选</span>
          </span>
          <开关 开={条件.只看收藏} 切换={() => 设条件({ ...条件, 只看收藏: !条件.只看收藏 })} />
        </div>

        <div className={样式.尾注}>
          这里没有薪资筛选项：双方的薪资数字互不披露，代理只在初筛时核对「带宽是否有交集」。
        </div>

        <button className={`${样式.完成键} 可点`} onClick={关闭}>
          查看 {命中数} 位候选
        </button>
      </div>
    </>
  );
}
