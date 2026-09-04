// 帮助与客服 —— 「我的 › 其他功能 › 帮助与客服」。
//
// 分类片筛选 + 手风琴问答（一次只展开一条）+ 底部客服卡。
// Mock 问答内容优先解释双盲机制和隐私 —— 这两件事是新用户最不放心、也最容易误解的地方。
//
// Backend：不读 Mock 常见问答，按当前 active role 只显示一份角色正确的最小 FAQ
// （只描述现有功能边界，未知角色不猜测）；热线、工作时间、许可证与「转人工客服」
// 都没有权威来源，客服键位槽改显不可点击的「人工客服暂未开放」。Agent 功能按钮
// 按角色进入 /agent 或 /hr/agent。

import { useEffect, useMemo, useState } from 'react';
import 样式 from './我的功能页.module.css';
import { 次级页外壳, 返回栏, 滚动区 } from '../组件/通用';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 路径 } from '../路由/路径表';
import { 常见问答 } from '../数据/模拟数据';
import type { 问答条 } from '../数据/类型';

/** Backend 候选侧最小 FAQ：只描述现有功能边界，不承诺没有合同的客服或时限。 */
const Backend候选问答 = [
  { 编号: 'BC-01', 分类: '隐私与披露', 问: '企业什么时候能看到我的资料？', 答: '是否披露以当前 MatchCase 阶段和你的披露选择为准。' },
  { 编号: 'BC-02', 分类: '阶段进展', 问: '在哪里查看匹配进展？', 答: '在“在谈”中打开对应 MatchCase 查看阶段和待处理动作。' },
] as const satisfies readonly 问答条[];

/** Backend 招聘侧最小 FAQ：不出现候选隐私问题。 */
const Backend招聘问答 = [
  { 编号: 'BR-01', 分类: '岗位管理', 问: '怎样发布和管理岗位？', 答: '从招聘端“我的”进入发布岗位或岗位管理。' },
  { 编号: 'BR-02', 分类: '阶段进展', 问: '在哪里查看候选进展？', 答: '在人才页打开对应 MatchCase 查看阶段和待处理动作。' },
] as const satisfies readonly 问答条[];

export default function 帮助与客服() {
  const { 返回, 跳转 } = use导航();
  // 交付 G：Backend 没有 AI 代理自由对话，客服卡的推荐话术与按钮不能承诺「问我的 AI 代理」
  const { 数据源模式, 后端状态 } = use应用状态();
  const 是Backend = 数据源模式 === 'backend';
  const 当前角色 = 后端状态.主体?.last_used_role ?? null;

  // Backend 按当前角色选一份最小 FAQ，未知角色为空；Mock 用既有 常见问答 原型
  const 页面问答 = useMemo<readonly 问答条[]>(() => {
    if (!是Backend) return 常见问答;
    if (当前角色 === 'candidate') return Backend候选问答;
    if (当前角色 === 'recruiter') return Backend招聘问答;
    return [];
  }, [是Backend, 当前角色]);
  const 全部分类 = ['全部', ...new Set(页面问答.map((条) => 条.分类))];

  const [分类, 设分类] = useState('全部');
  const [展开, 设展开] = useState<string | null>(页面问答[0]?.编号 ?? null);
  const [提示, 设提示] = useState<string | null>(null);

  // role/mode 变化换了 FAQ 表：分类复位「全部」、展开项回到新表首项，旧表选择不残留
  useEffect(() => {
    设分类('全部');
    设展开(页面问答[0]?.编号 ?? null);
  }, [页面问答]);

  useEffect(() => {
    if (!提示) return;
    const 定时 = window.setTimeout(() => 设提示(null), 1800);
    return () => window.clearTimeout(定时);
  }, [提示]);

  const 过滤后 = 分类 === '全部' ? 页面问答 : 页面问答.filter((条) => 条.分类 === 分类);

  return (
    <次级页外壳>
      <返回栏 返回={返回} 标题="帮助与客服" />

      <滚动区 样式覆盖={{ padding: '14px 18px 24px' }}>
        <div className={样式.分类行}>
          {全部分类.map((项) => (
            <button
              key={项}
              className={`${样式.分类片} ${分类 === 项 ? 样式.分类片选中 : ''} 可点`}
              onClick={() => 设分类(项)}
            >
              {项}
            </button>
          ))}
        </div>

        {过滤后.map((条) => {
          const 开 = 展开 === 条.编号;
          return (
            <button
              key={条.编号}
              className={`${样式.问答条} 可点`}
              onClick={() => 设展开(开 ? null : 条.编号)}
            >
              <span className={样式.问行}>
                <span className={样式.问文}>{条.问}</span>
                <span className={样式.展开号}>{开 ? '−' : '+'}</span>
              </span>
              {开 ? <span className={样式.答文}>{条.答}</span> : null}
            </button>
          );
        })}

        <div className={样式.客服卡}>
          <div className={样式.客服标题}>还是没解决？</div>
          <div className={样式.客服说明}>
            {是Backend
              ? '当前 Backend 模式不提供 AI 代理自由对话。真实匹配请到市场，真实阶段请到在谈查看。'
              : '先问你的 AI 代理 —— 它知道你每一单的上下文，能直接告诉你这一单卡在哪。涉及账号、认证、投诉的问题再转人工。'}
          </div>
          <div className={样式.客服键行}>
            <button
              className={`${样式.客服主键} 可点`}
              onClick={() => 跳转(是Backend && 当前角色 === 'recruiter' ? 路径.企业问AI代理 : 路径.问AI代理)}
            >
              {是Backend ? '查看 AI 代理功能' : '问我的 AI 代理'}
            </button>
            {是Backend ? (
              // 没有客服合同：同一键位槽显示不可点击说明，不伪造入口
              <span className={样式.客服次键}>人工客服暂未开放</span>
            ) : (
              <button
                className={`${样式.客服次键} 可点`}
                onClick={() => 设提示('人工客服 8:00–22:00 · 400-000-0000')}
              >
                转人工客服
              </button>
            )}
          </div>
        </div>

        {!是Backend ? (
          <div className={样式.版本}>
            服务热线 400-000-0000 · 工作时间 8:00–22:00
            <br />
            人力资源服务许可证 · 算法举报 · 资质证照
          </div>
        ) : null}
      </滚动区>

      {提示 ? <div className={样式.浮层提示}>{提示}</div> : null}
    </次级页外壳>
  );
}