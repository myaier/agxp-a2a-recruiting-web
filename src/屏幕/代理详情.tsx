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
import 弹层框架 from '../组件/弹层框架';

/** 代理的权限边界：能自己做的 / 必须问你的 / 永远不做的 */
const 权限边界 = [
  {
    组: '它可以自己做',
    记: '✓',
    类: '可以',
    条目: [
      '按硬性条件做匿名初筛，不合的直接过滤',
      '按你的披露偏好递交匿名画像',
      '在你设定的规则范围内协调软性要求',
    ],
  },
  {
    组: '必须先问你',
    记: '!',
    类: '要问',
    条目: ['超出规则范围的让步', '确认意向（互换联系方式前）', '任何要动你底线的判断'],
  },
  {
    组: '它永远不做',
    记: '×',
    类: '不做',
    条目: [
      '把你的薪资数字告诉对方（只答是否落在对方区间内）',
      '把你的底线当筹码抛出去',
      '替你谈薪资与到岗时间 —— 那是你和 HR 自己谈的',
    ],
  },
];

export default function 代理详情() {
  const { 返回, 跳转 } = use导航();
  const { 状态, 派发 } = use应用状态();
  const [接入层, 设接入层] = useState(false);
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
            <span className={样式.数名}>正在并行谈</span>
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
                  ? '在飞书里直接对它下指令，谈判进展也会推到飞书'
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
            <button className={`${样式.接入键} 可点`} onClick={() => 设接入层(true)}>
              扫码接入飞书
            </button>
          )}
        </div>

        {/* ── 权限边界：代理能做什么、什么必须问你、什么永远不做 ── */}
        <div className={样式.组标}>它的权限边界</div>
        {权限边界.map((组) => (
          <div key={组.组} className={样式.边界卡}>
            <div className={样式.边界头}>
              <span className={`${样式.边界记} ${样式[`记${组.类}`]}`}>{组.记}</span>
              <span className={样式.边界标题}>{组.组}</span>
            </div>
            {组.条目.map((条) => (
              <div key={条} className={样式.边界项}>
                {条}
              </div>
            ))}
          </div>
        ))}

        <button className={`${样式.规则键} 可点`} onClick={() => 跳转(路径.规则库)}>
          管理代理规则（{生效规则数} 条生效）›
        </button>
      </滚动区>

      {/* ── 扫码接入层 ── */}
      {接入层 ? (
        <弹层框架 标签="飞书扫码接入" 遮罩类名={样式.遮罩} 面板类名={样式.接入层} 关闭={() => 设接入层(false)}>
            <span className={样式.抓手} />
            <div className={样式.层标题}>用飞书扫码</div>
            <div className={样式.层说明}>
              打开飞书 → 右上角「＋」→ 扫一扫，扫完这个代理就会出现在你的飞书里
            </div>

            <div className={样式.码框}>
              <接入二维码 />
            </div>

            <div className={样式.码注}>有效期 5 分钟 · 仅本人可用</div>

            {/* 接入后能做什么：让用户明白扫完之后的世界 */}
            <div className={样式.接入后}>
              <div className={样式.接入后标}>接入后你可以在飞书里</div>
              <div className={样式.接入后项}>· 直接问「今天有什么需要我拍板的」</div>
              <div className={样式.接入后项}>· 用一句话给代理下新规则</div>
              <div className={样式.接入后项}>· 收到卡点提醒，直接在飞书里回复决定</div>
            </div>

            <div className={样式.边界注}>
              飞书那侧只是指挥入口。你的底线与薪资数字仍然只在代理手里，不会同步出去。
            </div>

            <button
              className={`${样式.模拟完成键} 可点`}
              onClick={() => {
                设已接入(true);
                设接入层(false);
                设提示('已接入飞书 · 去飞书里试试对它说话');
              }}
            >
              我已扫码（原型演示）
            </button>
        </弹层框架>
      ) : null}

      {提示 ? <div className={样式.浮层提示}>{提示}</div> : null}
    </次级页外壳>
  );
}
