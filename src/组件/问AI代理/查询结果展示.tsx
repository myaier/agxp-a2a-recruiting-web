// 查询结果展示：求职端助手成功回复的固定展示组件（Plan 合同 B / Spec §4 + §10 展示增量）。
// 整条成功回复 = 无 cards 用现有 代理气泡（Markdown 正文 + 消息时间）；有 cards 用
// 代理气泡框 外观="求职" 简报（同一条 created_at 的时间只在整条气泡之后显示一次），
// 正文在前（Markdown），其后一条结果分割线，三类结果按 cards 原序内嵌、各带中文类型标题：
// 岗位推荐逐项复用 求职推荐卡（原市场卡 + 卡内中文匹配理由）、在谈列表逐项复用 求职在谈卡、
// 在谈详情 = 同一张在谈卡 + 附属摘要段落（白卡 + 既有小节标题/正文样式），历次总结用原生
// details/summary 展开，不新造手风琴。查询时间字段按协议解码保留但不在 UI 展示（§10.2）。
// 映射纪律（Spec §4）：真实字段原样映射；DTO 合法缺失（null）出既有占位，空白文本按缺失，
// 数组真实为空出空态；不补后端没给的招聘类型/办公方式/公司/分数/Logo/发布人，
// 不用前端生成评语，内部标识 ID（evaluation_id/case_id/summary id）不作正文结论。
// 薪资带复用 发现推荐映射 导出的既有 薪资文案，匹配理由复用同一表的 助手匹配理由。
// 导航与解读全走 props 回调，不读 Provider、不发请求、无状态副作用；
// 整个回复不是点击区，可点元素都在卡/键自身。
import type { ReactElement } from 'react';
import 求职推荐卡 from '../列表卡片/求职推荐卡';
import 求职在谈卡 from '../列表卡片/求职在谈卡';
import type { JobEvaluationEvidenceItem } from '../../数据/招聘数据源/连续代谈';
import type {
  AssistantCard,
  AssistantJobItem,
  AssistantNegotiationDetail,
  AssistantNegotiationItem,
  AssistantReply,
} from '../../数据/招聘数据源/助手会话';
import { 助手匹配理由, 薪资文案 } from '../../数据/发现推荐映射';
import { 聊天正文 } from '../聊天气泡';
import { 代理气泡, 代理气泡框 } from './对话展示';
import 对话样式 from './对话展示.module.css';
import 简报样式 from './简报展示.module.css';
import 样式 from './查询结果展示.module.css';

export interface 查询结果展示属性 {
  回复: AssistantReply;
  /** 本条 AssistantMessage.created_at：整条回复的用户/Agent 两侧共用（Spec §10.4）。 */
  时间: string;
  打开岗位: (jobId: string) => void;
  打开在谈: (recordId: string) => void;
  解读在谈: (item: AssistantNegotiationItem) => void;
  解读禁用: boolean;
}

// ── 闭表：assistant phase → 阶段标题（Task 3 冻结映射，无表外键）；色系只取现有
//    四阶段（同 列表卡片映射.从连续到阶段 对 pre-Case 标题的兜底），不编 S0–S3 ──

const 在谈阶段标题表 = {
  accepted: '已受理',
  evaluating: '评估中',
  evaluation_failed: '评估失败',
  refused: '未进入在谈',
  case_started: '已进入在谈',
} as const;

/** 初评 next_action 的中文文案（闭合三员）；判断词保留 wire 原词，与既有详情页同口径。 */
const 下一动作文案表 = {
  stop: '停止推进',
  review: '人工复核',
  promote_to_a2a: '继续推进',
} as const;

/** 市场卡 发布人头像的中性配色（发现推荐映射 同值；该表未导出，按同一中性值重申，不按身份派生）。 */
const 中性发布人配色 = { 底色: '#5b7a9a', 字色: '#fff' } as const;

/** 禁用委托槽的占位回调：委托禁用=true 时按钮不可点，回调永不触发。 */
const 不动作 = () => undefined;

// ── 后端已知卡片的中文类型标题（Spec §10.2 完整映射）：按解码后的 kind 直接映射，
//    不根据正文/列表有无项目/下标猜测。satisfies 覆盖 AssistantCard['kind'] 全部成员，
//    联合类型后续扩展已知成员时漏填标题会被静态检查发现；重复类型保留独立结果不合并。 ──
const 结果标题 = {
  job_recommendations: '推荐岗位',
  negotiation_list: '在谈列表',
  negotiation_detail: '在谈详情',
} as const satisfies Record<AssistantCard['kind'], string>;

/** 列表标题右侧的数量：当前返回数量（不是全库总数）；详情不伪造列表数量。 */
function 数量文案(卡片: AssistantCard): string | null {
  if (卡片.kind === 'job_recommendations') return `${卡片.data.items.length} 个岗位`;
  if (卡片.kind === 'negotiation_list') return `${卡片.data.items.length} 条在谈`;
  return null;
}

/** trim 后无有效字符的段不算已知内容（同 求职在谈卡 的缺失规则）：空白不得冒充已知值。 */
function 已知文(值: string | null): string | null {
  return 值 !== null && 值.trim() !== '' ? 值 : null;
}

/** 岗位 availability=unavailable 的项目：禁项目导航、禁解读（Spec §5 的显式禁用例外）。 */
function 岗位可查看(项: AssistantNegotiationItem): boolean {
  return 项.job.availability !== 'unavailable';
}

export function 查询结果展示({
  回复,
  时间,
  打开岗位,
  打开在谈,
  解读在谈,
  解读禁用,
}: 查询结果展示属性): ReactElement {
  // 无 cards（含 visibility=unavailable 的固定提示）：现有普通代理气泡，只出 Markdown 正文。
  if (回复.cards.length === 0) {
    return <代理气泡 外观="求职" 内容={回复.text} 正文格式="markdown" 时间={时间} />;
  }
  return (
    <代理气泡框 外观="求职" 简报 时间={时间}>
      {/* 端差挂点：简报样式的端差后代选择器要认本模块的 .求职（同 简报展示 的用法） */}
      <div className={简报样式.求职}>
        <聊天正文 内容={回复.text} 格式="markdown" 类名={简报样式.简报正文} />
        {/* 正文与结果之间一条分割线（§10.2）：已知卡片在场才有，不孤立出现 */}
        <hr className={样式.结果分割线} />
        {回复.cards.map((卡片, 序) => (
          <section key={`${序}-${卡片.kind}`} className={样式.结果区}>
            <div className={样式.类型标题行}>
              <span className={样式.类型标题}>{结果标题[卡片.kind]}</span>
              {数量文案(卡片) !== null ? (
                <span className={样式.类型数量}>{数量文案(卡片)}</span>
              ) : null}
            </div>
            <结果区
              卡片={卡片}
              打开岗位={打开岗位}
              打开在谈={打开在谈}
              解读在谈={解读在谈}
              解读禁用={解读禁用}
            />
          </section>
        ))}
      </div>
    </代理气泡框>
  );
}

function 结果区({
  卡片,
  打开岗位,
  打开在谈,
  解读在谈,
  解读禁用,
}: {
  卡片: AssistantCard;
  打开岗位: (jobId: string) => void;
  打开在谈: (recordId: string) => void;
  解读在谈: (item: AssistantNegotiationItem) => void;
  解读禁用: boolean;
}) {
  if (卡片.kind === 'job_recommendations') {
    return (
      <>
        {卡片.data.items.length === 0 ? (
          <div className={样式.次要行}>暂无推荐岗位</div>
        ) : (
          卡片.data.items.map((项, 序) => (
            <岗位项 key={项.job_id} 项={项} 序={序} 打开岗位={打开岗位} />
          ))
        )}
        {卡片.data.next_cursor !== null ? (
          <div className={样式.次要行}>可继续问‘下一批’</div>
        ) : null}
      </>
    );
  }
  if (卡片.kind === 'negotiation_list') {
    return (
      <>
        {卡片.data.items.length === 0 ? (
          <div className={样式.次要行}>暂无在谈记录</div>
        ) : (
          卡片.data.items.map((项, 序) => (
            <在谈项
              key={项.record_id}
              项={项}
              序={序}
              打开在谈={打开在谈}
              解读在谈={解读在谈}
              解读禁用={解读禁用}
            />
          ))
        )}
        {卡片.data.next_cursor !== null ? (
          <div className={样式.次要行}>可继续问‘下一批’</div>
        ) : null}
      </>
    );
  }
  return (
    <详情项 项={卡片.data} 打开在谈={打开在谈} 解读在谈={解读在谈} 解读禁用={解读禁用} />
  );
}

// ── 岗位推荐项：原市场卡 + 附属区（safe_reasons + 委托说明）──

/** 标签 = [office_location, annual_salary_months !== null 时的 "n 薪"]：空地点显式「地点未知」，
 *  年薪月数缺席不假设薪数；招聘类型/办公方式 wire 未提供，不制造事实。 */
function 岗位标签(项: AssistantJobItem): string[] {
  return [
    已知文(项.office_location) ?? '地点未知',
    ...(项.annual_salary_months !== null ? [`${项.annual_salary_months} 薪`] : []),
  ];
}

function 岗位项({
  项,
  序,
  打开岗位,
}: {
  项: AssistantJobItem;
  序: number;
  打开岗位: (jobId: string) => void;
}) {
  return (
    <div className={样式.项}>
      <div className={样式.项序}>{序 + 1}</div>
      <求职推荐卡
        公司={已知文(项.organization_name)}
        公司简介={null}
        公司首字={null}
        公司图片URL={null}
        职位={已知文(项.title) ?? '职位信息未知'}
        薪资={薪资文案(项.salary_lower, 项.salary_upper, 项.salary_period)}
        标签={岗位标签(项)}
        匹配分={null}
        发布人={null}
        发布人首字={null}
        发布人底色={中性发布人配色.底色}
        发布人字色={中性发布人配色.字色}
        已委托={false}
        委托禁用={true}
        委托={不动作}
        打开={() => 打开岗位(项.job_id)}
        匹配理由={助手匹配理由(项.safe_reasons)}
      />
    </div>
  );
}

// ── 在谈项（列表/详情共用卡面）：求职在谈卡 + 卡外「让 AI 解读」次级动作 ──

/** 卡面统一由 求职在谈卡 承担：公司/简介/字标/分后端未提供，全给 null 由卡面出既有占位；
 *  职位/薪资/城市真实字段缺失给既有占位词；阶段标题按 phase 闭表，needs_action 真才显示
 *  「需要你」，不可查看项目卡面显示岗位信息不可查看。 */
function 在谈卡面({
  项,
  打开在谈,
}: {
  项: AssistantNegotiationItem;
  打开在谈: (recordId: string) => void;
}) {
  const 不可查看 = !岗位可查看(项);
  const 地点 = 已知文(项.job.location);
  return (
    <求职在谈卡
      公司={null}
      公司简介={null}
      公司字标={null}
      公司图片URL={null}
      匹配分={null}
      薪资={已知文(项.job.public_salary_range) ?? '薪资未知'}
      职位={已知文(项.job.title) ?? '职位信息未知'}
      标签={地点 !== null ? [地点] : []}
      阶段={{
        标题: 在谈阶段标题表[项.phase],
        色系: '匿名初筛',
        待办: false,
        徽标: 项.needs_action ? '需要你' : null,
        文本: 不可查看 ? '岗位信息不可查看' : '',
        注意说明: null,
      }}
      禁用={不可查看}
      打开={() => 打开在谈(项.record_id)}
    />
  );
}

/** 「让 AI 解读」：在谈项目之外的独立次级动作（不嵌套进卡 button）；解读禁用控制所有次级动作，
 *  不可查看项目一并禁用。点击回调收整项，正文模板由页面接线层按可信 record_id 组装。 */
function 解读键({
  项,
  解读在谈,
  解读禁用,
}: {
  项: AssistantNegotiationItem;
  解读在谈: (item: AssistantNegotiationItem) => void;
  解读禁用: boolean;
}) {
  return (
    <button
      className={`${对话样式.快捷键} 可点`}
      disabled={解读禁用 || !岗位可查看(项)}
      onClick={() => 解读在谈(项)}
    >
      让 AI 解读
    </button>
  );
}

function 在谈项({
  项,
  序,
  打开在谈,
  解读在谈,
  解读禁用,
}: {
  项: AssistantNegotiationItem;
  序: number;
  打开在谈: (recordId: string) => void;
  解读在谈: (item: AssistantNegotiationItem) => void;
  解读禁用: boolean;
}) {
  return (
    <div className={样式.项}>
      <div className={样式.项序}>{序 + 1}</div>
      <在谈卡面 项={项} 打开在谈={打开在谈} />
      <div className={样式.附属}>
        <解读键 项={项} 解读在谈={解读在谈} 解读禁用={解读禁用} />
      </div>
    </div>
  );
}

// ── 在谈详情摘要：同一张在谈卡 + 附属摘要段落（初评 / 条件确认）──

function 详情项({
  项,
  打开在谈,
  解读在谈,
  解读禁用,
}: {
  项: AssistantNegotiationDetail;
  打开在谈: (recordId: string) => void;
  解读在谈: (item: AssistantNegotiationItem) => void;
  解读禁用: boolean;
}) {
  return (
    <div className={样式.项}>
      <在谈卡面 项={项} 打开在谈={打开在谈} />
      <div className={样式.附属}>
        <解读键 项={项} 解读在谈={解读在谈} 解读禁用={解读禁用} />
        <初评段 评={项.agent_summary.public_evaluation} />
        <条件确认段 确认={项.agent_summary.condition_confirmation} />
      </div>
    </div>
  );
}

/** 公开信息初评段：判断/摘要/完整证据三组/next_action 中文文案；null 显式暂无，
 *  证据数组真实为空显式「无」，不用前端生成评语。 */
function 初评段({
  评,
}: {
  评: AssistantNegotiationDetail['agent_summary']['public_evaluation'];
}) {
  return (
    <div className={样式.摘要段}>
      <div className={简报样式.松一档标题}>公开信息初评</div>
      {评 === null ? (
        <div className={样式.次要行}>暂无公开初评</div>
      ) : (
        <>
          <div className={样式.摘要行}>{`结论：${评.decision}`}</div>
          <div className={样式.摘要行}>{评.summary}</div>
          <证据组块 组名="匹配" 项们={评.evidence.matches} />
          <证据组块 组名="冲突" 项们={评.evidence.conflicts} />
          <证据组块 组名="待确认" 项们={评.evidence.unknowns} />
          <div className={样式.摘要行}>{`建议：${下一动作文案表[评.next_action]}`}</div>
        </>
      )}
    </div>
  );
}

/** 证据行照实呈现 wire 事实（dimension/code/source），与既有详情页同一口径，不翻译不评分。 */
function 证据组块({
  组名,
  项们,
}: {
  组名: string;
  项们: readonly JobEvaluationEvidenceItem[];
}) {
  return (
    <>
      <div className={样式.摘要行}>{组名}</div>
      {项们.length === 0 ? (
        <div className={样式.次要行}>无</div>
      ) : (
        项们.map((项, 序) => (
          <div key={`${序}-${项.code}`} className={样式.摘要行}>
            {`${项.dimension} · ${项.code} · ${项.source}`}
          </div>
        ))
      )}
    </>
  );
}

/** 条件确认段：最新确认摘要 + 历次总结（原生 details/summary 展开，遵循返回顺序）；
 *  null 区块显式暂无，case_id/stage_status 等内部坐标不作正文结论。 */
function 条件确认段({
  确认,
}: {
  确认: AssistantNegotiationDetail['agent_summary']['condition_confirmation'];
}) {
  return (
    <div className={样式.摘要段}>
      <div className={简报样式.松一档标题}>条件确认</div>
      {确认 === null ? (
        <div className={样式.次要行}>暂无条件确认</div>
      ) : (
        <>
          {确认.latest_summary === null ? (
            <div className={样式.次要行}>暂无确认摘要</div>
          ) : (
            <div className={样式.摘要行}>{确认.latest_summary.summary}</div>
          )}
          {确认.summaries.length > 0 ? (
            <details className={样式.历次}>
              <summary>历次摘要</summary>
              {确认.summaries.map((总结, 序) => (
                <div key={`${序}-${总结.id}`} className={样式.摘要行}>{总结.summary}</div>
              ))}
            </details>
          ) : null}
        </>
      )}
    </div>
  );
}
