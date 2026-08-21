// A10·B AI代理规则库 · 清单版
//
// 产品含义：用户在任何一段往来记录里发的叮嘱，都会沉淀成一条长期规则来约束 AI 代理。
// 所以这一屏的规则**不能**用本地 useState —— 必须读全局状态里的 全局规则 / 意向级规则，
// 这样「往来记录 → 记成规则」新增的那条会真的出现在这里，开关也能被别的屏看到。
//
// 结构：提示条 → 全局规则分组卡 → 意向级分组卡 → 虚线「＋ 手动添加规则」→ 尾注。

import { useState } from 'react';
import 样式 from './规则库.module.css';
import { 次级页外壳, 返回栏, 滚动区 } from '../组件/通用';
import { use应用状态 } from '../状态/应用状态';
import { use导航 } from '../路由/导航钩子';
import type { 规则 } from '../数据/类型';

export default function 规则库() {
  const { 状态, 派发 } = use应用状态();
  const { 返回 } = use导航();

  // 手动添加：折叠态是一条虚线按钮，点开后原地变成输入行（不另开弹层，减少一次跳转）
  const [添加中, 设添加中] = useState(false);
  const [新规则文本, 设新规则文本] = useState('');
  // 编辑制（标注 10:16）：点行进入编辑，改完保存或删除
  const [编辑中编号, 设编辑中编号] = useState<string | null>(null);
  const [编辑草稿, 设编辑草稿] = useState('');

  const 条数 = 状态.全局规则.length + 状态.意向级规则.length;

  const 保存编辑 = () => {
    if (编辑中编号 === null) return;
    const 内容 = 编辑草稿.trim();
    if (内容) 派发({ 型: '改规则', 编号: 编辑中编号, 内容 });
    设编辑中编号(null);
  };

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
        右侧={<span className={`${样式.生效数} 等宽数字`}>{条数} 条</span>}
      />

      <div className={样式.提示条}>
        <div className={样式.提示文字}>
          {/* 2026-08-20 重构后谈判进度已不是时间线，是按阶段分段的对话流，措辞跟着改 */}
          在任何一单的接洽进度里发给代理的话，都会自动沉淀到这里，长期约束你的AI代理。
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
                编辑中={编辑中编号 === 条.编号}
                草稿={编辑草稿}
                改草稿={设编辑草稿}
                开始编辑={() => {
                  设编辑中编号(条.编号);
                  设编辑草稿(条.内容);
                }}
                保存={保存编辑}
                删除={() => {
                  派发({ 型: '删规则', 编号: 条.编号 });
                  设编辑中编号(null);
                }}
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
                编辑中={编辑中编号 === 条.编号}
                草稿={编辑草稿}
                改草稿={设编辑草稿}
                开始编辑={() => {
                  设编辑中编号(条.编号);
                  设编辑草稿(条.内容);
                }}
                保存={保存编辑}
                删除={() => {
                  派发({ 型: '删规则', 编号: 条.编号 });
                  设编辑中编号(null);
                }}
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
                  // 中文输入法组合期（拼音候选词上屏那一下回车）不算提交，与企业代理设置屏 / 真输入条保持一致
                  if (事件.key === 'Enter' && !事件.nativeEvent.isComposing) 提交新规则();
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

          <div className={样式.尾注}>点任意规则可编辑或删除。</div>
        </div>
      </滚动区>
    </次级页外壳>
  );
}

// ── 单条规则：点行进入编辑（输入框 + 保存/删除），不再是开关制（标注 10:16）──
function 规则行({
  条,
  编辑中,
  草稿,
  改草稿,
  开始编辑,
  保存,
  删除,
  末条,
}: {
  条: 规则;
  编辑中: boolean;
  草稿: string;
  改草稿: (值: string) => void;
  开始编辑: () => void;
  保存: () => void;
  删除: () => void;
  末条: boolean;
}) {
  if (编辑中) {
    return (
      <div className={`${样式.规则行} ${末条 ? 样式.末条 : ''}`}>
        <div className={样式.规则主体}>
          <div className={样式.规则头}>
            <input
              className={样式.规则编辑框}
              value={草稿}
              autoFocus
              onChange={(事件) => 改草稿(事件.target.value)}
              onKeyDown={(事件) => {
                if (事件.key === 'Enter' && !事件.nativeEvent.isComposing) 保存();
              }}
              enterKeyHint="done"
            />
          </div>
          <div className={样式.编辑键行}>
            <button className={`${样式.删除键} 可点`} onClick={删除}>
              删除
            </button>
            <button className={`${样式.保存键} 可点`} onClick={保存}>
              保存
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <button className={`${样式.规则行} ${末条 ? 样式.末条 : ''} 可点`} onClick={开始编辑}>
      <div className={样式.规则主体}>
        <div className={样式.规则头}>
          <span className={样式.规则内容}>{条.内容}</span>
        </div>
        <div className={样式.规则来源}>{条.来源}</div>
      </div>
      <span className={样式.规则改}>✎</span>
    </button>
  );
}
