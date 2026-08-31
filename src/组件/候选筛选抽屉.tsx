// 候选筛选抽屉 —— 顶栏「筛选 ▾」升起的底部层，候选推荐 与 企业在谈候选 共用。
//
// 它不是过滤器。这个产品里筛人本来就是 AI 代理干的活，用户手工勾一遍档位条件、
// 关掉就没了，等于白说。所以这一层是「给代理的硬性要求」清单：企业规则一排一条，
// 每行一个输入框，可改、可删、可新增，改完失焦当场落进规则库，下一轮代理照它筛。
//
// P6 模式边界：写规则的入口收敛到 企业代理设置（canonical，右上「管理规则 ›」）。
// Backend 下这一层转只读 —— 权威企业规则按行展示为纯文本，无输入、无删除、无新增；
// 且与 规则库 同一口径：recruiter rules 未水合前不出清单，宁缺勿错。
// Mock 保持原型交互原样：可改、可删、可新增，失焦即落库。
//
// 因此这里没有城市 / 学历 / 求职状态那类档位选项 —— 档位是把要求压成平台预设的几档，
// 而规则行让用户用自己的话写（「必须双休」这类要求没有任何档位表达得了）。
//
// 【为什么没有薪资维度】双盲机制里薪资数字双向不披露，企业侧拿不到候选人的期望数字，
// 只知道「带宽是否有交集」。用户当然可以自己写一条薪资规则，但平台不主动给这个入口。

import { useState, type KeyboardEvent } from 'react';
import 样式 from './候选筛选抽屉.module.css';
import { use应用状态 } from '../状态/应用状态';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import 弹层框架 from './弹层框架';

interface 候选筛选抽屉属性 {
  关闭: () => void;
  /** 「只看收藏」的当前值；与 切只看收藏 同时在场才渲染开关（P4：调用方自持 useState）*/
  只看收藏?: boolean;
  /** 切换「只看收藏」；纯本地状态，不发任何请求 */
  切只看收藏?: (value: boolean) => void;
}

export default function 候选筛选抽屉({ 关闭, 只看收藏, 切只看收藏 }: 候选筛选抽屉属性) {
  const { 状态, 派发, 数据源模式, 后端状态 } = use应用状态();
  const { 跳转 } = use导航();

  // P6：Backend 只读；权威规则展示同 规则库 门控 —— rules 成功前不出清单
  const 是Backend = 数据源模式 === 'backend';
  const 可显示规则 = 数据源模式 === 'mock' || 后端状态.Agent规则水合.recruiter.rules === '成功';

  // 只存被改动过的那几行；没动过的行直接显示规则库里的原值，避免打开层就整份复制一遍
  const [编辑文本, 设编辑文本] = useState<Record<string, string>>({});
  // 新增行的内容；null = 当前没有在新增
  const [新行, 设新行] = useState<string | null>(null);

  /** 已有行失焦即落库。清空视为放弃这次编辑（要删就点行尾 ✕，不靠清空来删） */
  const 提交编辑 = (编号: string, 原内容: string) => {
    const 内容 = (编辑文本[编号] ?? 原内容).trim();
    设编辑文本((旧) => {
      const 新 = { ...旧 };
      delete 新[编号];
      return 新;
    });
    if (内容 && 内容 !== 原内容) 派发({ 型: '企业改规则', 编号, 内容 });
  };

  /** 新增行失焦即落库；内容为空就当这一行没写过 */
  const 提交新行 = () => {
    const 内容 = (新行 ?? '').trim();
    设新行(null);
    if (内容) 派发({ 型: '企业新增规则', 内容, 来源: '筛选设定' });
  };

  /** 回车 = 写完这一行：交给失焦逻辑落库，手机上也顺手收起键盘 */
  const 回车即失焦 = (事件: KeyboardEvent<HTMLInputElement>) => {
    if (事件.key === 'Enter' && !事件.nativeEvent.isComposing) 事件.currentTarget.blur();
  };

  return (
    <弹层框架
      标签="告诉AI代理你的硬性要求"
      遮罩类名={样式.遮罩}
      面板类名={样式.抽屉}
      关闭={关闭}
      层级={61}
    >
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

        <div className={`${样式.内容区} 滚动区`}>
          {是Backend ? (
            // Backend：权威企业规则按行展示为纯文本 —— 增改删一律去 企业代理设置
            (可显示规则
              ? 状态.企业规则.map((条) => (
                  <div key={条.编号} className={样式.规则只读行}>
                    {条.内容}
                  </div>
                ))
              : null)
          ) : (
            <>
              {状态.企业规则.map((条) => (
                <div key={条.编号} className={样式.规则行}>
                  <input
                    className={样式.规则输入}
                    value={编辑文本[条.编号] ?? 条.内容}
                    enterKeyHint="done"
                    onChange={(事件) =>
                      设编辑文本({ ...编辑文本, [条.编号]: 事件.target.value })
                    }
                    onBlur={() => 提交编辑(条.编号, 条.内容)}
                    onKeyDown={回车即失焦}
                  />
                  <button
                    className={`${样式.删行} 可点`}
                    onClick={() => 派发({ 型: '企业删规则', 编号: 条.编号 })}
                    aria-label={`删除规则 ${条.内容}`}
                  >
                    ✕
                  </button>
                </div>
              ))}

              {新行 !== null ? (
                <div className={样式.规则行}>
                  <input
                    className={样式.规则输入}
                    value={新行}
                    autoFocus
                    enterKeyHint="done"
                    onChange={(事件) => 设新行(事件.target.value)}
                    onBlur={提交新行}
                    onKeyDown={回车即失焦}
                  />
                  {/* 按下就失焦会先触发 提交新行，那样点 ✕ 反而把这行存下来了；
                      拦掉 mousedown 的默认行为，保证 ✕ 的语义就是丢弃这一行 */}
                  <button
                    className={`${样式.删行} 可点`}
                    onMouseDown={(事件) => 事件.preventDefault()}
                    onClick={() => 设新行(null)}
                    aria-label="放弃这一条"
                  >
                    ✕
                  </button>
                </div>
              ) : null}

              <button className={`${样式.添加行} 可点`} onClick={() => 设新行('')}>
                ＋ 添加规则
              </button>
            </>
          )}
        </div>

        {/* P4：规则清单之后的唯一本地过滤开关。只看收藏 不问服务端 ——
            它只过滤本屏已经完整加载的当前候选快照，两个可选 props 都在场才渲染
            （调用方不传就保持这层是纯规则清单，Mock 路径零变化）。
            label 包裹的就是这个开关按钮（labelable element），lint 只认 input 系，故局部豁免 */}
        {只看收藏 !== undefined && 切只看收藏 !== undefined ? (
          // eslint-disable-next-line jsx-a11y/label-has-associated-control
          <label className={样式.收藏筛选行}>
            <span>只看收藏</span>
            <button
              role="switch"
              aria-label="只看收藏"
              aria-checked={只看收藏}
              className={`${样式.收藏筛选开关} ${只看收藏 ? 样式.收藏筛选已开 : ''} 可点`}
              onClick={() => 切只看收藏(!只看收藏)}
            />
          </label>
        ) : null}

        {/* 每一行都是即时落库，所以底部这一键只负责收起来 */}
        <button className={`${样式.完成键} 可点`} onClick={关闭}>
          完成
        </button>
    </弹层框架>
  );
}
