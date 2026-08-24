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
  const { 状态, 派发 } = use应用状态();
  const 已接入 = 状态.飞书已接入;
  const 设已接入 = (接入: boolean) => 派发({ 型: '设飞书接入', 接入 });
  const [提示, 设提示] = useState<string | null>(null);

  useEffect(() => {
    if (!提示) return;
    const 定时 = window.setTimeout(() => 设提示(null), 1800);
    return () => window.clearTimeout(定时);
  }, [提示]);

  const 生效规则数 =
    状态.全局规则.filter((条) => 条.生效).length +
    状态.意向级规则.filter((条) => 条.生效).length;
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
          <div className={样式.数项}>
            <span className={`${样式.数} 等宽数字`}>{生效规则数}</span>
            <span className={样式.数名}>条规则生效</span>
          </div>
          <div className={样式.数项}>
            <span className={`${样式.数} 等宽数字`}>186</span>
            <span className={样式.数名}>累计筛过岗位</span>
          </div>
        </div>

        {/* ── 接到飞书：这一屏的主操作 ── */}
        <div className={样式.接入卡}>
          <div className={样式.接入头}>
            <span className={样式.飞书标} aria-hidden>
              {/* 扫码框图形：四角 + 一条扫描线。不画飞书自家 logo —— 我们只表达「扫码接入」这个动作 */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 8.5V5.6A2.6 2.6 0 0 1 5.6 3H8.5M15.5 3h2.9A2.6 2.6 0 0 1 21 5.6v2.9M21 15.5v2.9a2.6 2.6 0 0 1-2.6 2.6h-2.9M8.5 21H5.6A2.6 2.6 0 0 1 3 18.4v-2.9"
                  stroke="var(--深绿)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path d="M6 12h12" stroke="var(--橄榄)" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            <div className={样式.接入文}>
              <div className={样式.接入标题}>
                {已接入 ? '已接入飞书' : '把代理接到飞书'}
              </div>
              <div className={样式.接入说明}>
                {已接入
                  ? '在飞书里直接对它下指令，匹配与代谈进展也会推到飞书'
                  : '扫码之后，你在飞书里就能指挥这个代理，不用打开 App'}
              </div>
            </div>
          </div>

          {已接入 ? (
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
          ) : (
            <div className={样式.内联码区}>
              {/* 标注 2026-08-24：「把这个二维码直接放到页面」—— 不再点按钮开层，
                  码直接铺在卡里；原扫码弹层随之删除 */}
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
        </div>

        {/* 权限边界三卡按标注 2026-08-24 整段删除（「把下面它的边界直接删了」）*/}

        <button className={`${样式.规则键} 可点`} onClick={() => 跳转(路径.规则库)}>
          管理代理规则（{生效规则数} 条生效）›
        </button>
      </滚动区>


      {提示 ? <div className={样式.浮层提示}>{提示}</div> : null}
    </次级页外壳>
  );
}
