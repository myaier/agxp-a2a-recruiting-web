// 我的 AI 代理 · 详情与接入 —— 问AI代理页右上「⋯」进来（标注 2026-08-18 21:37）。
//
// 这一屏回答两个问题：
//   1「我的代理是谁、它按什么在替我谈」—— 身份卡 + 生效规则 + 权限边界；
//   2「怎么在别的地方指挥它」—— 扫码把代理接到飞书，之后在飞书里直接下指令。
//
// 接入这件事在双盲产品里有个必须写清楚的边界：飞书那侧只是一个「指挥入口」，
// 你的底线与薪资数字仍然只在代理手里，不会因为接了外部 IM 就流出去。

import { useEffect, useState } from 'react';
import 样式 from './代理详情.module.css';
import { 次级页外壳, 返回栏, 滚动区 } from '../组件/通用';
import 代理标 from '../组件/代理标';
import 接入二维码 from '../组件/接入二维码';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { use应用状态 } from '../状态/应用状态';


export default function 代理详情() {
  const { 返回, 跳转 } = use导航();
  const { 状态, 派发, 数据源模式, 后端状态 } = use应用状态();
  const 已接入 = 状态.飞书已接入;
  const 设已接入 = (接入: boolean) => 派发({ 型: '设飞书接入', 接入 });
  // 接入通道：默认命令行；点「飞书扫码」码才生成/刷新（切换即重挂）
  const [接入道, 设接入道] = useState<'命令行' | '飞书'>('命令行');
  const [提示, 设提示] = useState<string | null>(null);

  useEffect(() => {
    if (!提示) return;
    const 定时 = window.setTimeout(() => 设提示(null), 1800);
    return () => window.clearTimeout(定时);
  }, [提示]);

  // P6：规则计数只认已水合的权威规则 —— Backend 未水合时不出计数（宁缺勿错，
  // 不把 Mock 种子数当真，与 规则库 门控同一口径）
  const 可显示候选规则数 = 数据源模式 === 'mock' || 后端状态.Agent规则水合.candidate.rules === '成功';
  const 生效规则数 = 可显示候选规则数
    ? 状态.全局规则.filter((条) => 条.生效).length +
      状态.意向级规则.filter((条) => 条.生效).length
    : null;
  const 在谈数 = 状态.在谈列表.length;

  return (
    <次级页外壳>
      <返回栏 返回={返回} 标题="我的 AI 代理" />

      <滚动区 样式覆盖={{ padding: '6px 18px 24px' }}>
        {/* ── 身份卡：代理标 + 在线状态 + 两个实时数 ── */}
        <div className={样式.身份卡}>
          <span className={样式.标位}>
            <代理标 尺寸={44} 脸色="#ffffff" 眼色="var(--墨)" 描边色="var(--墨)" 描边宽={2.4} />
          </span>
          <div className={样式.身份文}>
            <div className={样式.身份名行}>
              <span className={样式.身份名}>我的求职AI代理</span>
              <span className={样式.在线点} />
              <span className={样式.在线字}>在线</span>
            </div>
          </div>
        </div>

        <div className={样式.数行}>
          <div className={样式.数项}>
            <span className={`${样式.数} 等宽数字`}>{在谈数}</span>
            <span className={样式.数名}>正在代谈</span>
          </div>
          {/* 规则计数未水合时整格不出（Backend），不渲染 0 也不拿 Mock 数充数 */}
          {生效规则数 !== null ? (
            <div className={样式.数项}>
              <span className={`${样式.数} 等宽数字`}>{生效规则数}</span>
              <span className={样式.数名}>条规则生效</span>
            </div>
          ) : null}
          <div className={样式.数项}>
            <span className={`${样式.数} 等宽数字`}>186</span>
            <span className={样式.数名}>累计筛过岗位</span>
          </div>
        </div>

        {/* ── 接到飞书：这一屏的主操作 ── */}
        {/* ── 接入方式（2026-08-24 定稿：甲白纸化 + 双入口）──
            默认选中 Agent 命令行（终端块）；点「飞书扫码」二维码才生成/刷新
            （原型层面 = 切换即重挂）。展开区下方的「接入后你可以」三行沿用
            原扫码弹层的现成文案，去掉「在飞书里」限定 —— 两个通道都适用。 */}
        <div className={样式.接入方式标}>接入方式</div>
        <div className={样式.接入选行}>
          <button
            className={`${样式.接入选钮} ${接入道 === '命令行' ? 样式.接入选中 : ''} 可点`}
            onClick={() => 设接入道('命令行')}
            aria-pressed={接入道 === '命令行'}
          >
            {接入道 === '命令行' ? '✓ ' : ''}Agent 命令行
          </button>
          <button
            className={`${样式.接入选钮} ${接入道 === '飞书' ? 样式.接入选中 : ''} 可点`}
            onClick={() => 设接入道('飞书')}
            aria-pressed={接入道 === '飞书'}
          >
            {接入道 === '飞书' ? '✓ ' : ''}飞书扫码
          </button>
        </div>

        {接入道 === '命令行' ? (
          <div className={样式.终端块}>
            <div className={样式.终端行}>$ agxp agent connect --me</div>
            <div className={样式.终端注}># 在你的终端运行，代理即接入本机</div>
            <button
              className={`${样式.复制命令键} 可点`}
              onClick={() => {
                navigator.clipboard?.writeText('agxp agent connect --me');
                设提示('命令已复制');
              }}
            >
              复制命令
            </button>
          </div>
        ) : 已接入 ? (
          <div className={样式.已接入区}>
            <div className={样式.已接入行}>
              <span className={样式.已接入标}>✓ 沈亦舟 · 飞书</span>
              <button
                className={`${样式.解绑键} 可点`}
                onClick={() => {
                  设已接入(false);
                  设提示('已解除飞书接入');
                }}
              >
                解除
              </button>
            </div>
          </div>
        ) : (
          <div className={样式.内联码区}>
            <div className={样式.码框}>
              <接入二维码 />
            </div>
            <div className={样式.码注}>有效期 5 分钟 · 仅本人可用</div>
            <button
              className={`${样式.模拟完成键} 可点`}
              onClick={() => {
                设已接入(true);
                设提示('已接入飞书 · 去飞书里试试对它说话');
              }}
            >
              我已扫码（原型演示）
            </button>
          </div>
        )}

        {/* 接入后能干什么（标注 2026-08-24「把文案加上」）：原弹层现成三行 */}
        <div className={样式.接入后区}>
          <div className={样式.接入后标}>接入后你可以</div>
          <div className={样式.接入后项}>· 直接问「今天有什么需要我拍板的」</div>
          <div className={样式.接入后项}>· 用一句话给代理下新规则</div>
          <div className={样式.接入后项}>· 收到卡点提醒，直接回复决定</div>
        </div>

        {/* 权限边界三卡按标注 2026-08-24 整段删除（「把下面它的边界直接删了」）*/}

        <button className={`${样式.规则键} 可点`} onClick={() => 跳转(路径.规则库)}>
          {生效规则数 !== null ? `管理代理规则（${生效规则数} 条生效）›` : '管理代理规则 ›'}
        </button>
      </滚动区>


      {提示 ? <div className={样式.浮层提示}>{提示}</div> : null}
    </次级页外壳>
  );
}
