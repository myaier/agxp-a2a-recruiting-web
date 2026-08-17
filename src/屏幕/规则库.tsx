// A10·B AI代理规则库 · 清单版
//
// 产品含义：用户在任何一段往来记录里发的叮嘱，都会沉淀成一条长期规则来约束 AI 代理。
// 所以这一屏的规则**不能**用本地 useState —— 必须读全局状态里的 全局规则 / 意向级规则，
// 这样「往来记录 → 记成规则」新增的那条会真的出现在这里，开关也能被别的屏看到。
//
// 结构：提示条 → 全局规则分组卡 → 意向级分组卡 → 虚线「＋ 手动添加规则」→ 尾注。

import { useState } from 'react';
import 样式 from './规则库.module.css';
import { 次级页外壳, 返回栏, 滚动区, 开关 } from '../组件/通用';
import { use应用状态 } from '../状态/应用状态';
import { use导航 } from '../路由/导航钩子';
import type { 规则 } from '../数据/类型';

export default function 规则库() {
  const { 状态, 派发 } = use应用状态();
  const { 返回 } = use导航();

  // 手动添加：折叠态是一条虚线按钮，点开后原地变成输入行（不另开弹层，减少一次跳转）
  const [添加中, 设添加中] = useState(false);
  const [新规则文本, 设新规则文本] = useState('');

  // 返回栏右侧的「N 条生效」= 两组规则里 生效 为 true 的总数
  const 生效数 =
    状态.全局规则.filter((条) => 条.生效).length +
    状态.意向级规则.filter((条) => 条.生效).length;

  // 提交手动添加：写进全局规则并标注来源，随后收起输入行
  const 提交新规则 = () => {
    const 内容 = 新规则文本.trim();
    if (!内容) return;
    派发({ 型: '新增规则', 内容, 来源: '你手动添加 · 刚刚' });
    设新规则文本('');
    设添加中(false);
  };

  return (
    <次级页外壳>
      <返回栏
        返回={返回}
        标题="AI代理规则库"
        右侧={<span className={`${样式.生效数} 等宽数字`}>{生效数} 条生效</span>}
      />

      <div className={样式.提示条}>
        <div className={样式.提示文字}>
          在任何谈判时间线里发的叮嘱，都会自动沉淀到这里，长期约束你的AI代理。
        </div>
      </div>

      <滚动区>
        <div className={样式.列表}>
          <div className={样式.分组标}>全 局 规 则 · 所 有 谈 判 生 效</div>
          <div className={样式.卡}>
            {状态.全局规则.map((条, 序) => (
              <规则行
                key={条.编号}
                条={条}
                切换={() => 派发({ 型: '切规则开关', 编号: 条.编号 })}
                末条={序 === 状态.全局规则.length - 1}
              />
            ))}
          </div>

          <div className={样式.分组标}>意 向 级 · 仅「AI 产 品 经 理」</div>
          <div className={样式.卡}>
            {状态.意向级规则.map((条, 序) => (
              <规则行
                key={条.编号}
                条={条}
                切换={() => 派发({ 型: '切规则开关', 编号: 条.编号 })}
                末条={序 === 状态.意向级规则.length - 1}
              />
            ))}
          </div>

          {添加中 ? (
            <div className={样式.添加输入行}>
              <input
                className={样式.添加输入框}
                placeholder="例：不接受大小周的岗位直接过滤"
                value={新规则文本}
                onChange={(事件) => 设新规则文本(事件.target.value)}
                onKeyDown={(事件) => {
                  if (事件.key === 'Enter') 提交新规则();
                  if (事件.key === 'Escape') 设添加中(false);
                }}
                enterKeyHint="done"
                autoFocus
              />
              <button
                className={`${样式.取消添加} 可点`}
                onClick={() => {
                  设新规则文本('');
                  设添加中(false);
                }}
              >
                取消
              </button>
              <button className={`${样式.确认添加} 可点`} onClick={提交新规则}>
                加入
              </button>
            </div>
          ) : (
            <button className={`${样式.手动添加} 可点`} onClick={() => 设添加中(true)}>
              <span className={样式.添加圆}>＋</span>
              <span className={样式.添加文字}>手动添加规则</span>
            </button>
          )}

          <div className={样式.尾注}>
            关闭的规则立即停用但保留记录；点任意规则可查看诞生它的那段对话。
          </div>
        </div>
      </滚动区>
    </次级页外壳>
  );
}

// ── 单条规则：左侧「编号 + 内容 + 来源」，右侧开关。停用后内容字色转灰但记录保留 ──
function 规则行({
  条,
  切换,
  末条,
}: {
  条: 规则;
  切换: () => void;
  末条: boolean;
}) {
  return (
    <div className={`${样式.规则行} ${末条 ? 样式.末条 : ''}`}>
      <div className={样式.规则主体}>
        <div className={样式.规则头}>
          <span className={`${样式.规则编号} 等宽数字`}>{条.编号}</span>
          <span className={`${样式.规则内容} ${条.生效 ? '' : 样式.已停用}`}>{条.内容}</span>
        </div>
        <div className={样式.规则来源}>{条.来源}</div>
      </div>
      <开关 开={条.生效} 切换={切换} />
    </div>
  );
}
