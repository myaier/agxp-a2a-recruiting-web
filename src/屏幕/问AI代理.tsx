// A27 与AI代理对话 · 从在谈首页的「问AI代理」横幅进入。
//
// 屏幕结构（自上而下）：
//   返回栏（标题 + 右侧 ⋯）→ 对话流（第一条是今日简报卡）→ 快捷问句胶囊行 → 真输入条
//
// 三条要点：
//   · 第一条消息不是普通气泡，而是代理气泡里嵌的「今日简报」卡（统计横条 + 正文 + 脚注）
//   · 输入框真的能发：本地 useState 追加消息，代理回复由关键词规则表生成，延迟 550ms 追加
//   · 每次对话变化后自动滚到底，跟原生 IM 一致

import { useEffect, useRef, useState } from 'react';
import 样式 from './问AI代理.module.css';
import { 次级页外壳, 返回栏, 真输入条 } from '../组件/通用';
import { 盾牌图标 } from '../组件/图标';
import { use导航 } from '../路由/导航钩子';
import { 轻提示 } from '../组件/轻提示';
import { 今日简报, 代理对话初始, 快捷问句 } from '../数据/模拟数据';
import type { 代理对话条 } from '../数据/类型';

// 关键词 → mock 回复。原型不接后端，用规则表模拟代理应答；
// 顺序即优先级：先命中的先返回，最后一条是兜底。
function 生成回复(问题: string): string {
  if (问题.includes('远程')) return '搜到 7 个全远程、薪资带覆盖你底线的。要我直接去谈前 3 个吗？';
  if (问题.includes('在谈') || 问题.includes('进展'))
    return '这周 5 个在谈：云衢等你确认意向、硅基流动差 2K、华泰到岗差 15 天，另外两个我在核，不用你管。';
  if (问题.includes('薪资') || 问题.includes('底线'))
    return '你的底线 52K 只有我知道，永不披露。我只回答对方「有无交集」，不给数值。';
  if (问题.includes('去谈')) return '好，已按匿名口径接触前 3 家，进展我在往来记录里逐条留痕。';
  return '收到。我按这个口径继续谈，拿不准的地方会先来问你，不会替你破例。';
}

export default function 问AI代理() {
  const { 返回 } = use导航();
  const [对话, 设对话] = useState<代理对话条[]>(代理对话初始);
  const [草稿, 设草稿] = useState('');
  // 对话流容器：需要拿原生 DOM 节点手动滚到底，所以用 div.滚动区 而不是 <滚动区> 组件
  const 滚动引用 = useRef<HTMLDivElement>(null);

  // 对话每变一次就滚到底部（含代理 550ms 后追加的那条），保证新消息始终可见
  useEffect(() => {
    const 容器 = 滚动引用.current;
    if (!容器) return;
    容器.scrollTo({ top: 容器.scrollHeight, behavior: 'smooth' });
  }, [对话]);

  // 发送：不带参数发草稿（输入框），带参数发快捷问句
  const 发送 = (文本?: string) => {
    const 内容 = (文本 ?? 草稿).trim();
    if (!内容) return;
    // 用时刻做编号：我方那条用 时刻，代理回复用 时刻+1，保证两条 key 不撞
    const 时刻 = Date.now();
    设对话((旧) => [...旧, { 编号: 时刻, 角色: '我', 内容 }]);
    设草稿('');
    setTimeout(() => {
      设对话((旧) => [...旧, { 编号: 时刻 + 1, 角色: '代理', 内容: 生成回复(内容) }]);
    }, 550);
  };

  return (
    <次级页外壳 对话底>
      <返回栏 返回={返回} 标题="我的求职AI代理" 右侧={<button className={`${样式.更多} 可点`} onClick={() => 轻提示('更多操作待定义')}>⋯</button>} />

      {/* 对话流：屏幕内唯一滚动区 */}
      <div ref={滚动引用} className={`${样式.对话流} 滚动区`}>
        <div className={样式.对话内容}>
          {对话.map((条) => {
            if (条.角色 === '简报') return <简报气泡 key={条.编号} />;
            if (条.角色 === '我')
              return (
                <div key={条.编号} className={样式.我行}>
                  <div className={`${样式.我气泡} ${样式.气泡文字}`}>{条.内容}</div>
                </div>
              );
            return <代理气泡 key={条.编号} 内容={条.内容 ?? ''} />;
          })}
        </div>
      </div>

      {/* 快捷问句：点一下等于直接把这句话发出去 */}
      <div className={样式.快捷行}>
        {快捷问句.map((句) => (
          <button key={句} className={`${样式.快捷键} 可点`} onClick={() => 发送(句)}>
            {句}
          </button>
        ))}
      </div>

      <真输入条
        占位="让AI代理搜岗、去谈，或问进展…"
        值={草稿}
        改变={设草稿}
        发送={() => 发送()}
      />
    </次级页外壳>
  );
}

// ── 代理气泡：左侧小盾牌头像 + 左上角切平的白气泡 ─────────────────
function 代理气泡({ 内容 }: { 内容: string }) {
  return (
    <div className={样式.代理行}>
      <span className={样式.小盾牌}>
        <盾牌图标 尺寸={14} />
      </span>
      <div className={`${样式.代理气泡} ${样式.气泡文字}`}>{内容}</div>
    </div>
  );
}

// ── 今日简报：每天 09:00 / 18:00 各更新一次，套在代理气泡里当第一条消息 ──
// 「需要你」那个统计数用 --意向（红）标出来，让待决策项在一屏内最先被看到。
function 简报气泡() {
  return (
    <div className={样式.代理行}>
      <span className={样式.小盾牌}>
        <盾牌图标 尺寸={14} />
      </span>
      <div className={样式.代理气泡}>
        <div className={样式.简报头}>
          <span className={样式.简报标题}>今日简报</span>
          <span className={样式.简报时间}>09:00 更新</span>
        </div>

        {/* 四个统计数横条 */}
        <div className={样式.统计条}>
          {今日简报.统计.map((项) => (
            <div key={项.名称} className={样式.统计项}>
              <div
                className={`${样式.统计数} ${项.强调 ? 样式.统计数强调 : ''} 等宽数字`}
              >
                {项.数值}
              </div>
              <div className={样式.统计名}>{项.名称}</div>
            </div>
          ))}
        </div>

        <div className={样式.简报正文}>
          {今日简报.正文前}
          <b className={样式.简报强调}>{今日简报.正文强调}</b>
          {今日简报.正文后}
        </div>
        <div className={样式.简报脚注}>{今日简报.脚注}</div>
      </div>
    </div>
  );
}
