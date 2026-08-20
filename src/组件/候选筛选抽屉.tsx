// 候选筛选抽屉 —— 顶栏「筛选 ▾」升起的底部层，候选推荐 与 企业在谈候选 共用。
//
// 它不是一次性过滤器：这个产品里筛人本来就是 AI 代理干的活，用户手工勾一遍临时条件、
// 关掉就没了，等于白说。所以这一层是「给代理的硬性要求」的编辑器 —— 保存后做两件事：
//   ① 档位条件写回本页筛选状态，列表立即按新标准过滤；
//   ② 档位条件 + 自定义条沉淀成企业规则（来源「筛选设定」），下次代理还按它筛。
//
// 【为什么没有薪资维度】双盲机制里薪资数字双向不披露，企业侧拿不到候选人的期望数字，
// 只知道「带宽是否有交集」。所以这里绝不能出现「期望薪资 ≤ X」这类要求 ——
// 那等于把数字重新拉回台面上。带宽交集是代理在初筛里核对的事，不是人工筛选项。
//
// 未知特征一律放行（不是过滤掉）：在谈候选的数据结构里没有结构化的学历/求职状态，
// 对一个已经在谈的人凭空判「不合格」比漏筛更糟糕。

import { useState } from 'react';
import 样式 from './候选筛选抽屉.module.css';
import { use应用状态 } from '../状态/应用状态';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';

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
 * 档位型要求 → 沉淀进规则库的文案。只有非「不限」的档位才产出一条；
 * 「不限」意味着用户没提要求，往规则库里塞一条「经验不限」是噪音。
 */
export function 档位转要求文案(条件: 候选筛选条件): string[] {
  const 文案: string[] = [];
  if (条件.经验 !== '不限') 文案.push(`经验年限 ${条件.经验}`);
  if (条件.学历 !== '不限') 文案.push(`最低学历 ${条件.学历}`);
  if (条件.求职状态.length > 0) 文案.push(`求职状态限 ${条件.求职状态.join('、')}`);
  if (条件.只看收藏) 文案.push('只看已收藏的候选');
  return 文案;
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
  关闭,
}: {
  条件: 候选筛选条件;
  设条件: (新条件: 候选筛选条件) => void;
  关闭: () => void;
}) {
  const { 状态, 派发 } = use应用状态();
  const { 跳转 } = use导航();

  // 抽屉里改的是草稿：这一层是编辑器，用户按下保存那一刻才既过滤列表又沉淀成规则。
  // 层每次打开都重新挂载，所以草稿初值直接取当前生效条件即可。
  const [草稿, 设草稿] = useState<候选筛选条件>(条件);
  const [自定义条, 设自定义条] = useState<string[]>([]);
  const [输入, 设输入] = useState('');

  // 打开就让用户看见代理正在按什么筛，省得他重复写一条已经存在的要求
  const 生效规则 = 状态.企业规则.filter((条) => 条.生效);

  /** 求职状态是多选：已选再点一次就取消 */
  const 切状态 = (值: 求职状态值) =>
    设草稿({
      ...草稿,
      求职状态: 草稿.求职状态.includes(值)
        ? 草稿.求职状态.filter((条) => 条 !== 值)
        : [...草稿.求职状态, 值],
    });

  const 添加自定义 = () => {
    const 内容 = 输入.trim();
    设输入('');
    if (!内容 || 自定义条.includes(内容)) return;
    设自定义条([...自定义条, 内容]);
  };

  const 保存 = () => {
    // ① 档位条件写回本页筛选状态 —— 列表立即按新标准过滤
    设条件(草稿);

    // ② 档位条 + 自定义条沉淀成企业规则。输入框里还没回车的那句也一并算数，
    //    否则用户打完字直接点保存会白打。
    const 待沉淀 = [...档位转要求文案(草稿), ...自定义条, 输入.trim()];
    const 已有 = new Set(状态.企业规则.map((条) => 条.内容));
    待沉淀.forEach((内容) => {
      if (!内容 || 已有.has(内容)) return;
      已有.add(内容); // 本批次内也去重
      派发({ 型: '企业新增规则', 内容, 来源: '筛选设定' });
    });

    关闭();
  };

  return (
    <>
      <div className={样式.遮罩} onClick={关闭} />
      <div className={样式.抽屉} role="dialog" aria-label="告诉AI代理你的硬性要求">
        <div className={样式.抓手} />

        <div className={样式.标题行}>
          <span className={样式.标题}>告诉AI代理你的硬性要求</span>
          <button
            className={`${样式.管理规则} 可点`}
            onClick={() => {
              关闭();
              跳转(路径.企业代理设置);
            }}
          >
            管理规则 ›
          </button>
        </div>

        {生效规则.length > 0 ? (
          <div className={样式.规则条}>
            {生效规则.map((条) => (
              <span key={条.编号} className={样式.规则片}>
                {条.内容}
              </span>
            ))}
          </div>
        ) : null}

        <div className={`${样式.内容区} 滚动区`}>
          <div className={样式.组}>
            <div className={样式.组标}>经验年限</div>
            <div className={样式.片行}>
              {经验档位.map((档) => (
                <button
                  key={档}
                  className={`${样式.片} ${草稿.经验 === 档 ? 样式.片选中 : ''} 可点`}
                  onClick={() => 设草稿({ ...草稿, 经验: 档 })}
                >
                  {档}
                </button>
              ))}
            </div>
          </div>

          <div className={样式.组}>
            <div className={样式.组标}>最低学历</div>
            <div className={样式.片行}>
              {学历档位.map((档) => (
                <button
                  key={档}
                  className={`${样式.片} ${草稿.学历 === 档 ? 样式.片选中 : ''} 可点`}
                  onClick={() => 设草稿({ ...草稿, 学历: 档 })}
                >
                  {档}
                </button>
              ))}
            </div>
          </div>

          <div className={样式.组}>
            <div className={样式.组标}>求职状态</div>
            <div className={样式.片行}>
              {/* 多选维度也给一枚「不限」片：清空 = 不提这个要求，跟单选档位一个手势 */}
              <button
                className={`${样式.片} ${草稿.求职状态.length === 0 ? 样式.片选中 : ''} 可点`}
                onClick={() => 设草稿({ ...草稿, 求职状态: [] })}
              >
                不限
              </button>
              {求职状态档位.map((值) => (
                <button
                  key={值}
                  className={`${样式.片} ${草稿.求职状态.includes(值) ? 样式.片选中 : ''} 可点`}
                  onClick={() => 切状态(值)}
                >
                  {值}
                </button>
              ))}
            </div>
          </div>

          <div className={样式.组}>
            <div className={样式.组标}>收藏</div>
            <div className={样式.片行}>
              <button
                className={`${样式.片} ${草稿.只看收藏 ? '' : 样式.片选中} 可点`}
                onClick={() => 设草稿({ ...草稿, 只看收藏: false })}
              >
                不限
              </button>
              <button
                className={`${样式.片} ${草稿.只看收藏 ? 样式.片选中 : ''} 可点`}
                onClick={() => 设草稿({ ...草稿, 只看收藏: true })}
              >
                只看收藏
              </button>
            </div>
          </div>

          <div className={样式.组}>
            <div className={样式.组标}>自定义硬性要求</div>
            {自定义条.length > 0 ? (
              <div className={样式.片行}>
                {自定义条.map((条) => (
                  <span key={条} className={样式.自定义片}>
                    {条}
                    <button
                      className={`${样式.删片} 可点`}
                      onClick={() => 设自定义条(自定义条.filter((项) => 项 !== 条))}
                      aria-label={`删除 ${条}`}
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            ) : null}
            <div className={样式.输入行}>
              <input
                className={样式.输入框}
                value={输入}
                placeholder="必须双休"
                enterKeyHint="done"
                onChange={(事件) => 设输入(事件.target.value)}
                onKeyDown={(事件) => {
                  if (事件.key === 'Enter' && !事件.nativeEvent.isComposing) 添加自定义();
                }}
              />
              <button className={`${样式.添加键} 可点`} onClick={添加自定义}>
                添加
              </button>
            </div>
          </div>
        </div>

        <button className={`${样式.保存键} 可点`} onClick={保存}>
          保存 · 让代理按这个筛
        </button>
      </div>
    </>
  );
}
