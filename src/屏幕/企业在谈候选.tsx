// D5·B 在谈候选 —— 企业端定稿首页（求职端 在谈首页 A6·L + 顶部意向栏 的同构镜像）。
//
// 镜像关系：意向切换 → 在招岗位切换；在谈卡 → 候选卡。
// 卡片结构：代号头行（头像 + 代号/真名 + 画像 + 匹配分）
// → 分隔线 → 阶段标签 + 轮次 → 下一步文案 + › → 辅助文案 或 分歧对比轴。
//
// 两条交互硬规矩（与求职端相同）：
//   · 需要你拍板的卡置顶；紧急感由红色阶段标 + 「需要你」胶囊表达
//   · 卡上不放决策按钮，决策一律进候选详情页做
//
// 双盲语义（业务硬约束）：意向确认前只显示匿名昵称（陈屿）与画像；
// 「候选确认意向」后 真名 才有值，头像换成真名首字 + 深绿底。

import { useRef, useState } from 'react';
import 样式 from './企业在谈候选.module.css';
import { 主页外壳, 代理横幅, 阶段标签, 滚动区, 白卡, 公司字标, use模拟加载, 骨架卡组 } from '../组件/通用';
import 适配环 from '../组件/适配环';
import { 公文包图标, 学帽图标, 放大镜图标 } from '../组件/图标';
import { use应用状态 } from '../状态/应用状态';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import 候选筛选抽屉, {
  从画像取经验年,
  命中筛选,
  生效维度数,
  空筛选条件,
  type 候选筛选条件,
} from '../组件/候选筛选抽屉';
import { 推荐列表 } from '../数据/企业端模拟数据';
import type { 候选 } from '../数据/类型';

/**
 * 在谈候选身上没有结构化的 经验年/学历/求职状态 字段（那几项只存在于推荐候选里），
 * 所以这里做两级回退：先按编号回查推荐库拿结构化值，回查不到就从画像行里抠年限，
 * 再取不到就交 null —— 交 null 表示这一维度对他不做判断，宁可多显示也不误杀在谈的人。
 */
function 取在谈候选特征(单: 候选) {
  const 推 = 推荐列表.find((条) => 条.编号 === 单.编号);
  return {
    经验年: 推?.经验年 ?? 从画像取经验年(单.画像),
    学历: 推?.学历 ?? null,
    求职状态: 推?.求职状态 ?? null,
  };
}

export default function 企业在谈候选() {
  // 标注 2026-08-18 22:31：进入人才页要有约两秒的加载体感，然后直接看到候选
  const 数据就绪 = use模拟加载(2000);

  // ── 下拉刷新（标注 00:25）：列表顶部往下拽 → 松手转圈 0.9s ──
  const 拉区 = useRef<HTMLDivElement>(null);
  const 起点Y = useRef<number | null>(null);
  const [拉距, 设拉距] = useState(0);
  const [刷新中, 设刷新中] = useState(false);

  const 拉住 = (事件: React.PointerEvent) => {
    const 滚 = 拉区.current?.querySelector('.滚动区');
    // 只在列表已经贴顶时接管手势，否则让给正常滚动
    if (滚 && 滚.scrollTop <= 0 && !刷新中) 起点Y.current = 事件.clientY;
  };
  const 拉动 = (事件: React.PointerEvent) => {
    if (起点Y.current === null || 刷新中) return;
    const 位移 = 事件.clientY - 起点Y.current;
    设拉距(位移 > 0 ? Math.min(位移 / 2, 64) : 0);
  };
  const 松手 = () => {
    if (起点Y.current === null) return;
    起点Y.current = null;
    if (拉距 >= 46) {
      设刷新中(true);
      设拉距(46);
      window.setTimeout(() => {
        设刷新中(false);
        设拉距(0);
      }, 900);
    } else {
      设拉距(0);
    }
  };
  const { 状态 } = use应用状态();
  const { 跳转 } = use导航();
  const [筛选条件, 设筛选条件] = useState<候选筛选条件>(空筛选条件);
  const [抽屉开, 设抽屉开] = useState(false);

  // 只看当前选中岗位的候选：顶栏切岗位原来不生效，切了还是整锅端出来
  const 本岗候选 = 状态.企业候选列表.filter((单) => 单.岗位编号 === 状态.当前岗位编号);
  const 命中后 = 本岗候选.filter((单) =>
    命中筛选(取在谈候选特征(单), 筛选条件, 状态.收藏候选.includes(单.编号))
  );
  // 需要你拍板的卡置顶，其余保持原顺序
  const 排序后 = [...命中后].sort((甲, 乙) => Number(乙.需要你) - Number(甲.需要你));
  const 待拍板数 = 本岗候选.filter((单) => 单.需要你).length;

  return (
    <主页外壳>
      <岗位切换栏 筛选数={生效维度数(筛选条件)} 开筛选={() => 设抽屉开(true)} />

      <代理横幅
        前文="初筛与前几轮我已谈完，"
        强调={待拍板数 > 0 ? `${待拍板数} 个候选需要你拍板` : '暂时没有需要你拍板的'}
        按下={() => 跳转(路径.企业问AI代理)}
      />

      <div style={{ height: 10, flex: 'none' }} />

      <div
        ref={拉区}
        style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        onPointerDown={拉住}
        onPointerMove={拉动}
        onPointerUp={松手}
        onPointerCancel={松手}
      >
        {/* 下拉出来的刷新槽：高度跟手，松手到位后转圈 */}
        <div className={样式.刷新槽} style={{ height: 拉距 }}>
          <span className={`${样式.刷新圈} ${刷新中 ? 样式.刷新转 : ''}`} />
        </div>
      <滚动区>
        <div className={样式.列表}>
          {!数据就绪 ? (
            <骨架卡组 张数={3} />
          ) : 排序后.length === 0 ? (
            <div className={样式.空态}>
              {本岗候选.length === 0 ? (
                <>
                  这个岗位暂无在谈候选，
                  <br />
                  去推荐里让AI代理接触几个
                </>
              ) : (
                <>
                  没有符合筛选条件的在谈候选，
                  <br />
                  放宽条件再看看
                </>
              )}
            </div>
          ) : (
            排序后.map((单) => (
              <候选卡 key={单.编号} 单={单} 按下={() => 跳转(路径.候选详情(单.编号))} />
            ))
          )}
        </div>
      </滚动区>
      </div>

      {抽屉开 ? (
        <候选筛选抽屉
          条件={筛选条件}
          设条件={设筛选条件}
          命中数={命中后.length}
          关闭={() => 设抽屉开(false)}
        />
      ) : null}
    </主页外壳>
  );
}

// ── 顶部岗位切换栏：求职端 顶部意向栏 的镜像 ──
// 意向切换 → 在招岗位切换；＋ = 发布新岗位；放大镜 = 自己去推荐里找人。
function 岗位切换栏({ 筛选数, 开筛选 }: { 筛选数: number; 开筛选: () => void }) {
  const { 状态, 派发 } = use应用状态();
  const { 跳转 } = use导航();

  // 顶栏只放在招岗位；已归档的去岗位管理页看
  const 在招岗位 = 状态.岗位列表.filter((岗) => 岗.状态 === '在招');

  return (
    <div className={样式.顶栏}>
      <div className={样式.岗位行}>
        {在招岗位.map((岗) => {
          const 选中 = 岗.编号 === 状态.当前岗位编号;
          return (
            <button
              key={岗.编号}
              className={`${选中 ? 样式.岗位选中 : 样式.岗位未选} 单行 可点`}
              onClick={() => 派发({ 型: '切当前岗位', 编号: 岗.编号 })}
            >
              {岗位名截短(岗.名称)}
            </button>
          );
        })}
        <span className={样式.岗位行右}>
          <button
            className={`${样式.加号} 可点`}
            onClick={() => 跳转(路径.发布岗位)}
            aria-label="发布新岗位"
          >
            ＋
          </button>
          <button
            className="可点"
            onClick={() => 派发({ 型: '企业切子视图', 子视图: '推荐' })}
            aria-label="搜索候选人"
            style={{ display: 'flex', alignItems: 'center' }}
          >
            <放大镜图标 />
          </button>
        </span>
      </div>

      <div className={样式.子视图行}>
        {(['在谈', '推荐'] as const).map((视图) => (
          <button
            key={视图}
            className={`${状态.企业子视图 === 视图 ? 样式.子视图选中 : 样式.子视图未选} 可点`}
            onClick={() => 派发({ 型: '企业切子视图', 子视图: 视图 })}
          >
            {视图}
          </button>
        ))}
        <button
          className={`${样式.筛选} ${筛选数 > 0 ? 样式.筛选生效 : ''} 可点`}
          onClick={开筛选}
        >
          筛选{筛选数 > 0 ? ` · ${筛选数}` : ''} ▾
        </button>
      </div>
    </div>
  );
}

/** 岗位名截短：顶栏空间有限，只取「 · 」前的主名（资深后端工程师 · 交易网关 → 资深后端工程师） */
function 岗位名截短(名称: string): string {
  return 名称.split(' · ')[0];
}

// ── 候选卡：求职端 在谈卡 的镜像 ──
function 候选卡({ 单, 按下 }: { 单: 候选; 按下: () => void }) {
  // 双盲：意向确认且真名已互换，头像才换真名首字 + 深绿底；否则化名头像 + 灰绿底
  const 显示真名 = 单.阶段 === '意向确认' && 单.真名 ? 单.真名 : null;
  // 画像 = 「年限 · 方向 · 现职类型」
  const [年限, 方向, 现职类型] = 单.画像.split(' · ');
  const 推 = 推荐列表.find((条) => 条.编号 === 单.编号);
  const 标签组 = 推 ? [...推.亮点, 推.学历] : [];

  return (
    <白卡 按下={按下} 类名={样式.卡}>
      {/* 行1：头像 + 化名/真名 + 活跃度；右列 匹配环 + 硬性核对数 */}
      <div className={样式.头行}>
        <公司字标
          首字={显示真名 ? 显示真名.charAt(0) : 单.头像字}
          底色={显示真名 ? 'var(--深绿)' : 'var(--初筛底)'}
          字色={显示真名 ? 'var(--白)' : 'var(--初筛)'}
          描边={!显示真名}
          字号={显示真名 ? 15 : 13}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className={样式.名行}>
            <span className={`${样式.代号名} 单行`}>{显示真名 ?? 单.代号}</span>
          </div>
          {/* 行2：年限 ｜ 学历 ｜ 到岗（BOSS 的基本行，面议位放到岗） */}
          <div className={`${样式.基本行} 单行`}>
            {年限}
            {单.学历 ? <><span className={样式.竖分}>｜</span>{单.学历}</> : null}
            {单.到岗 ? <><span className={样式.竖分}>｜</span>{单.到岗}</> : null}
          </div>
        </div>
        <div className={样式.右列}>
          <适配环 分={单.匹配分} 标={null} />
          {单.硬性通过 ? (
            <span className={`${样式.硬性数} 等宽数字`}>硬性 {单.硬性通过}</span>
          ) : null}
        </div>
      </div>

      {/* 行3/4/5：现职 · 方向 / 在找 / 学校 · 专业 */}
      <div className={样式.信息行}>
        <公文包图标 尺寸={14} 色="var(--次要浅)" />
        <span className={`${样式.信息文} 单行`}>
          {现职类型 ?? 单.画像} · {方向}
        </span>
      </div>
      {单.学校 ? (
        <div className={样式.信息行}>
          <学帽图标 尺寸={14} 色="var(--次要浅)" />
          <span className={`${样式.信息文} 单行`}>
            {单.学校} · {单.专业}
          </span>
        </div>
      ) : null}

      {/* 标签行：结构化亮点（回查推荐库；查不到不摆空行） */}
      {标签组.length > 0 ? (
        <div className={样式.标签行}>
          {标签组.map((标签) => (
            <span key={标签} className={样式.标签}>
              {标签}
            </span>
          ))}
        </div>
      ) : null}

            {/* 阶段区：与求职端一比一 */}
      <div className={样式.阶段区}>
        {/* 标注 11:07：下一步文字并到阶段标签同一行 */}
        <div className={样式.阶段头}>
          <阶段标签 阶段={单.阶段} 待你={单.需要你} />
          <div className={`${样式.下一步} 单行`}>{单.下一步}</div>
          <span style={{ color: 'var(--最弱)', fontSize: 16, fontWeight: 300 }}>›</span>
        </div>

        {/* 与求职端在谈卡同步（标注 18:00）：小字全部去掉，靠下一步大字表达 */}
      </div>
    </白卡>
  );
}
