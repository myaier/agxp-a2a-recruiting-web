// 帮助与客服 —— 「我的 › 其他功能 › 帮助与客服」。
//
// 分类片筛选 + 手风琴问答（一次只展开一条）+ 底部客服卡。
// 问答内容优先解释双盲机制和隐私 —— 这两件事是新用户最不放心、也最容易误解的地方。

import { useEffect, useState } from 'react';
import 样式 from './我的功能页.module.css';
import { 次级页外壳, 返回栏, 滚动区 } from '../组件/通用';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { 常见问答 } from '../数据/模拟数据';

const 全部分类 = ['全部', ...new Set(常见问答.map((条) => 条.分类))];

export default function 帮助与客服() {
  const { 返回, 跳转 } = use导航();
  const [分类, 设分类] = useState('全部');
  const [展开, 设展开] = useState<string | null>('Q-01');
  const [提示, 设提示] = useState<string | null>(null);

  useEffect(() => {
    if (!提示) return;
    const 定时 = window.setTimeout(() => 设提示(null), 1800);
    return () => window.clearTimeout(定时);
  }, [提示]);

  const 过滤后 = 分类 === '全部' ? 常见问答 : 常见问答.filter((条) => 条.分类 === 分类);

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
            先问你的 AI 代理 —— 它知道你每一单的上下文，能直接告诉你这一单卡在哪。
            涉及账号、认证、投诉的问题再转人工。
          </div>
          <div className={样式.客服键行}>
            <button className={`${样式.客服主键} 可点`} onClick={() => 跳转(路径.问AI代理)}>
              问我的 AI 代理
            </button>
            <button
              className={`${样式.客服次键} 可点`}
              onClick={() => 设提示('人工客服 8:00–22:00 · 400-000-0000')}
            >
              转人工客服
            </button>
          </div>
        </div>

        <div className={样式.版本}>
          服务热线 400-000-0000 · 工作时间 8:00–22:00
          <br />
          人力资源服务许可证 · 算法举报 · 资质证照
        </div>
      </滚动区>

      {提示 ? <div className={样式.浮层提示}>{提示}</div> : null}
    </次级页外壳>
  );
}
