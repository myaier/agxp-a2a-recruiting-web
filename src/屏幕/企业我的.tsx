// D13 企业「我的」Tab · 状态入口 + 功能宫格 —— 求职端 A15（我的.tsx）的同构镜像
//
// 版式与求职端一比一：右上两枚工具图标（切换身份 / 设置）→ 头像行（公司首字深绿底
// 圆头像 + 公司名 + 认证人认证身份胶囊）→ 四个统计数 → 代理状态毛玻璃卡（我的招聘
// AI代理 → 企业代理设置）→ 常用/其他功能宫格 → 页脚合规小字。
// 只替换数据源（企业信息）与文案视角（求职者 → 招聘方），字号、间距、圆角全部不动。
//
// 屏内只有「功能宫格 + 页脚」这一段滚动，上半部分钉住不动 —— 与同构源一致：
// 公司状态是常驻信息，功能入口才是可翻的列表。

import { useEffect, type ComponentType } from 'react';
import 样式 from './企业我的.module.css';
import { 主页外壳, 滚动区 } from '../组件/通用';
import {
  齿轮图标,
  身份切换图标,
  简历图标,
  靶心图标,
  旗帜图标,
  层级图标,
  归档图标,
  问号图标,
  禁止图标,
} from '../组件/图标';
import 代理标 from '../组件/代理标';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { use应用状态 } from '../状态/应用状态';
import { 轻提示 } from '../组件/轻提示';
import { 从BFF招聘身份 } from '../数据/组织映射';
import { P5范围键 } from '../状态/后端/MatchCase操作';
import { 取P5Open统计 } from '../状态/后端/MatchCase统计';

/** 图标.tsx 里所有图标共用的属性签名 —— 宫格数据里要存「图标组件本身」，所以需要这个类型 */
type 图标组件 = ComponentType<{ 尺寸?: number; 色?: string; 线宽?: number }>;

/** 宫格里的一格。目标为 null 表示还没打通后端，点了走 轻提示 兜底（禁止死按钮） */
interface 宫格条目 {
  名称: string;
  图标: 图标组件;
  目标: string | null;
  /** 未打通入口的提示文案；缺省用「名称 正在开发中」 */
  提示?: string;
}

/** 统计行的一格。按下 = 这个数字可点，落到对应的在谈候选档；不给 按下 就是纯展示 */
interface 统计格 {
  数值: string;
  名称: string;
  色: string;
  按下?: () => void;
}

/** 统计数的取色：模拟数据里存的是语义色名，这里翻成 CSS 变量（与求职端同一张表） */
function 取统计色(色名: string): string {
  if (色名 === '深绿') return 'var(--深绿)';
  if (色名 === '次要') return 'var(--次要浅)';
  return 'var(--墨)';
}

export default function 企业我的() {
  const { 跳转 } = use导航();
  const { 状态, 派发, 数据源模式, 后端状态, 操作 } = use应用状态();
  const 在招数 = 状态.岗位列表.filter((岗) => 岗.状态 === '在招').length;

  // P6：规则计数只认已水合的权威规则 —— Backend 未水合时不出计数（宁缺勿错，
  // 不把 Mock 种子数当真，与 企业代理设置 门控同一口径）
  const 可显示招聘规则数 = 数据源模式 === 'mock' || 后端状态.Agent规则水合.recruiter.rules === '成功';
  const 生效规则数 = 状态.企业规则.filter((条) => 条.生效).length;

  // P1C：Backend 只读 从BFF招聘身份() 的 view model（不直接解释 DTO），
  // 公司 = current affiliation / 未认证声明；个人与任职状态分开、显式判定，
  // 不从公司名非空推导 verified。Mock 仍读 企业认证 fixture。
  const 是后端 = 数据源模式 === 'backend';
  // Mock 模式的 状态 不携带组织字段（页面也不读）：用 ?? 兜底，映射结果在 Mock 分支不被消费
  const 身份 = 从BFF招聘身份(
    状态.招聘方档案 ?? null,
    状态.企业关系列表 ?? [],
    状态.当前企业关系编号 ?? null,
    状态.企业管理员申请列表 ?? [],
  );
  const 显示公司 = 是后端
    ? (身份.currentAffiliation?.organizationName ?? 状态.未认证公司声明)
    : 状态.企业认证.公司;
  // Backend MatchCase 真相源：在谈/待拍板/意向达成只读当前 recruiter/owner 的权威
  // summary；在招岗位继续读 Job。每次挂载刷新，失败时显示 —，不回退分页或 Mock。
  const P5Scope = P5范围键.summary('recruiter');
  const 当前SubjectId = 后端状态.主体?.last_used_role === 'recruiter'
    ? 后端状态.主体.subject_id
    : null;
  const Backend统计 = 取P5Open统计(后端状态.P5摘要.recruiter, 当前SubjectId);

  // 进屏 / 换主体：注册 summary 可见范围并权威刷新（与 P5 列表同款栅栏）；
  // 离开本屏清回 null。Mock 分支不注册、零 P5 请求。
  useEffect(() => {
    if (!是后端 || 当前SubjectId === null) return;
    操作.设置P5范围('recruiter', P5Scope);
    void 操作.加载摘要('recruiter').catch(() => undefined);
    return () => 操作.设置P5范围('recruiter', null);
  }, [是后端, 当前SubjectId, P5Scope, 操作]);

  // 「在谈」不可点（2026-08-25 用户裁定，与求职端同改）：它此前派发「企业看全部在谈」，
  // 会改写人才页的持久状态（子视图切「在谈」、范围切「全部」），主页不该被「我」页影响。
  // 「待拍板」保留可点：招聘方每天登录第一个要看的东西，跨岗位算的数落到「全部岗位」档（拦路 5）。
  // 「在招岗位」「意向达成」没有对应的列表档，保持不可点，不做假入口。
  const 原Mock统计: 统计格[] = [
    { 数值: String(在招数), 名称: '在招岗位', 色: '墨' },
    {
      数值: String(状态.企业候选列表.length),
      名称: '在谈',
      色: '深绿',
    },
    {
      数值: String(状态.企业候选列表.filter((条) => 条.需要你).length),
      名称: '待拍板',
      色: '深绿',
      按下: () => 派发({ 型: '企业看全部在谈', 档: '待我拍板' }),
    },
    {
      数值: String(状态.企业候选列表.filter((条) => 条.阶段 === '意向确认').length),
      名称: '意向达成',
      色: '次要',
    },
  ];
  const 统计: 统计格[] = 是后端 ? [
    { 数值: String(在招数), 名称: '在招岗位', 色: '墨' },
    {
      数值: Backend统计.open,
      名称: '在谈',
      色: '深绿',
    },
    {
      数值: Backend统计.needsAction,
      名称: '待拍板',
      色: '深绿',
      按下: () => 派发({ 型: '企业看全部在谈', 档: '待我拍板' }),
    },
    {
      数值: Backend统计.completed,
      名称: '意向达成',
      色: '次要',
    },
  ] : 原Mock统计;


  const 常用功能: 宫格条目[] = [
    { 名称: '发布岗位', 图标: 简历图标, 目标: 路径.发布岗位 },
    { 名称: '岗位管理', 图标: 靶心图标, 目标: 路径.岗位管理 },
    { 名称: 'AI代理设置', 图标: 旗帜图标, 目标: 路径.企业代理设置 },
    // 标注 2026-08-20 16:40：公司主页（只读）与公司资料（编辑）重复，只留编辑入口
    { 名称: '公司资料', 图标: 简历图标, 目标: 路径.公司档案编辑 },
  ];
  const 其他功能: 宫格条目[] = [
    // 披露策略此前指向 /hr/settings（整个设置页），现在指向它自己的那一屏
    { 名称: '披露策略', 图标: 层级图标, 目标: 路径.企业披露策略 },
    // 位置与图标都对齐求职端「我的 › 其他功能」的第 2 格（我的.tsx 的历史代谈），
    // 两端同一个动作的归档就在同一个地方找得到
    { 名称: '历史代谈', 图标: 归档图标, 目标: 路径.企业归档 },
    { 名称: '已筛掉', 图标: 禁止图标, 目标: 路径.已筛候选 },
    // 「归档岗位」与「岗位管理」指向同一个 /hr/jobs，重复入口已删（岗位管理页内
    // 已有「已归档」分组）；不新增 ?view=archived 之类的直达参数
    { 名称: '帮助与客服', 图标: 问号图标, 目标: 路径.帮助与客服 },
  ];

  /** 宫格的统一点击：有目标就跳转，没有就给一条轻提示兜底 */
  const 打开 = (项: 宫格条目) => {
    if (项.目标) 跳转(项.目标);
    else 轻提示(项.提示 ?? `${项.名称} 正在开发中`);
  };

  return (
    <主页外壳 白底>
      {/* ── 右上工具行：切换身份 / 设置 ── */}
      <div className={样式.工具行}>
        <button
          className={`${样式.工具键} 可点`}
          onClick={() => 跳转(路径.切换身份自企业端)}
          aria-label="切换身份"
        >
          <身份切换图标 />
        </button>
        <button
          className={`${样式.工具键} 可点`}
          onClick={() => 跳转(路径.企业设置)}
          aria-label="设置"
        >
          <齿轮图标 />
        </button>
      </div>

      {/* ── 头像行：整行可点，进「招聘名片」（= 企业对外形象的编辑入口，
             镜像求职端头像行 → 我的简历）。Backend 状态胶囊只按服务端事实各说各的 ── */}
      <button className={`${样式.头像行} 可点`} onClick={() => 跳转(路径.招聘名片)}>
        <span className={样式.头像}>{显示公司.charAt(0)}</span>
        <span className={样式.头像信息}>
          <span className={`${样式.姓名} 单行`}>{显示公司 || '完善招聘名片'}</span>
          <span className={样式.状态行}>
            {是后端 ? (
              <>
                <span className={样式.状态胶囊}>个人：{身份.personalVerification.label}</span>
                <span className={样式.状态胶囊}>
                  任职：{身份.currentAffiliation?.statusLabel ?? '无'}
                </span>
              </>
            ) : (
              <span className={样式.招聘名片}>招聘名片 ✎</span>
            )}
          </span>
        </span>
        <span className={样式.尖括号}>›</span>
      </button>

      {/* ── 四个统计数：从全局实时算（回归发现原来读写死的 企业信息.统计，
             发布/归档岗位后数字不动，与岗位管理页对不上）。
             带 按下 的两格渲染成 button（可点，进对应的在谈候选档），其余仍是 div ── */}
      <div className={样式.统计行}>
        {统计.map((项) =>
          项.按下 ? (
            <button key={项.名称} className={`${样式.统计项} 可点`} onClick={项.按下}>
              <span className={`${样式.统计数} 等宽数字`} style={{ color: 取统计色(项.色) }}>
                {项.数值}
              </span>
              <span className={样式.统计名}>{项.名称}</span>
            </button>
          ) : (
            <div key={项.名称} className={样式.统计项}>
              <span className={`${样式.统计数} 等宽数字`} style={{ color: 取统计色(项.色) }}>
                {项.数值}
              </span>
              <span className={样式.统计名}>{项.名称}</span>
            </div>
          )
        )}
      </div>

      {/* ── 代理状态毛玻璃卡：压在顶部渐变头上，「管理 ›」进企业代理设置 ── */}
      <button className={`${样式.代理卡} 可点`} onClick={() => 跳转(路径.企业代理设置)}>
        <代理标
          尺寸={30}
          脸色="#ffffff"
          眼色="var(--墨)"
          描边色="var(--墨)"
          描边宽={2.6}
        />
        <span className={样式.代理文字}>
          <span className={样式.代理标题行}>
            <span className={样式.代理标题}>我的招聘AI代理</span>
            {/* 在线绿点：代理正在后台并行寻访的可视信号（Backend 没有 runtime presence
                合同，不得声称在线） */}
            {!是后端 ? <span className={样式.在线点} /> : null}
          </span>
          <span className={`${样式.代理状态} 单行`}>
            {是后端 ? 在招数 + ' 个在招岗位' : '在线 · 正为 ' + 在招数 + ' 个岗位并行寻访'}
            {/* 规则计数未水合时（Backend）整段不出，不渲染 0 也不拿 Mock 数充数 */}
            {可显示招聘规则数 ? (
              <> · 规则 {生效规则数} 条生效</>
            ) : null}
          </span>
        </span>
        <span className={样式.管理}>管理 ›</span>
      </button>

      {/* ── 功能宫格区：屏内唯一滚动容器，底部留 130 给悬浮玻璃导航 ── */}
      <滚动区>
        <div className={样式.功能区}>
          <宫格卡 标题="常用功能" 项目={常用功能} 打开={打开} 主色 />
          <宫格卡 标题="其他功能" 项目={其他功能} 打开={打开} />
          {/* 占位运营页脚没有合同来源（热线/许可证均未确认），只在 Mock 渲染 */}
          {!是后端 ? (
            <div className={样式.页脚}>
              服务热线 400-000-0000 · 工作时间 8:00–22:00
              <br />
              人力资源服务许可证 · 算法举报 · 资质证照
            </div>
          ) : null}
        </div>
      </滚动区>
    </主页外壳>
  );
}

/**
 * 功能宫格卡：白卡 + 标题 + 4 列图标格（与求职端同构）。
 * 主色 = true 时图标底用淡绿底 + 深绿描线（常用功能），否则用浅灰底 + 次要色（其他功能），
 * 靠这一层颜色差把「常用」和「其他」在视觉上分开，而不用额外的分组标题层级。
 */
function 宫格卡({
  标题,
  项目,
  打开,
  主色 = false,
}: {
  标题: string;
  项目: 宫格条目[];
  打开: (项: 宫格条目) => void;
  主色?: boolean;
}) {
  return (
    <div className={样式.宫格卡}>
      <div className={样式.宫格标题}>{标题}</div>
      <div className={样式.宫格}>
        {项目.map((项) => {
          const 图标 = 项.图标;
          return (
            <button key={项.名称} className={`${样式.宫格项} 可点`} onClick={() => 打开(项)}>
              <span className={`${样式.宫格图标底} ${主色 ? '' : 样式.次色底}`}>
                <图标 色={主色 ? 'var(--深绿)' : 'var(--次要)'} />
              </span>
              <span className={样式.宫格名}>{项.名称}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
