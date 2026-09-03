// D0/D0b/D0c 发布岗位 —— 三步合一：基础信息 → 职位描述 → 职位要求 + 硬性条件。
//
// 一个屏两态：
//   · 新建（/hr/post-job）—— 三步向导，进度条 + 「下一步」，最后一步发布；
//   · 编辑（/hr/post-job/:id）—— 预填该岗全部字段，三步变成可直接点的分段切换，
//     主按钮任何一步都是「保存修改」，改完就走，不必再走完三步。
//
// 同构镜像：分步 + 顶部分段进度条来自求职端 引导问答（A3），
// 表单条目版式（小标签 + 大值输入 + 分隔线）来自求职端 工作经历 编辑页，
// 大 textarea 卡来自 引导问答 的个人优势题，像素值一比一保留。
//
// 双盲语义：薪资只有岗位自己的带（区间），没有任何报价 / 出价 UI；
// 硬性条件交给 AI 代理在匿名初筛执行，数值互不披露。

import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import 样式 from './发布岗位.module.css';
import 数字滚轮层 from '../组件/数字滚轮层';
import { 代理横幅, 主按钮, 次级页外壳, 滚动区, 页面大标题, 返回栏 } from '../组件/通用';
import { 轻提示 } from '../组件/轻提示';
import 确认层 from '../组件/确认层';
import { BFF错误, 取后端错误文案 } from '../数据/HTTP客户端';
import { 校验附件PDF } from '../流程/附件简历交互';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import 弹层框架 from '../组件/弹层框架';
import { use应用状态 } from '../状态/应用状态';
import { 职业分类表, 查大类 } from '../数据/职业分类';
import { use城市搜索 } from './城市查询钩子';
import { 合并目录页 } from '../数据/目录选择';
import { 可用企业关系 } from '../数据/组织映射';
import { 空岗位硬性事实 } from '../数据/类型';
import type { 在招岗位, 岗位硬性事实 } from '../数据/类型';
import type { 目录选择值 } from '../数据/招聘数据源类型';
import type { BFFTaxonomyItem, BFFJD导入失败码 } from '../数据/BFF契约';

const 步骤顺序 = ['基础信息', '职位描述', '职位要求'] as const;

// ── Task 5 四问硬性事实:录入 UI 已删(用户 2026-08-26「不应该有这个硬性条件」,
// 按三层采集原则改为①阶段代理按岗现问一次)。服务端 hard_requirements 合同不变:
// 四员完整对象仍随岗位提交(新岗全「未说明」,编辑岗原值带走),字段与存量数据零改动。 ──

/** 办公方式快捷片。标注意见 2026-08-18：「混合 3+2」写成「混合」就行 ——
 *  具体几天几天由代理在谈判中核对，不该在发布时钉死 */
const 办公方式选项 = ['现场', '混合', '全远程'];

type 招聘类型 = NonNullable<在招岗位['招聘类型']>;
/** 招聘类型（BOSS 对照补齐 2026-08-19）。发布后不可改 ——
 *  它决定代理对「年限」这条硬性条件的核对口径（校招/实习不按年限筛） */
const 招聘类型选项: 招聘类型[] = ['社招全职', '校园招聘', '实习生', '兼职'];

/** 类型宫格的副标：一句话说清各自面向谁 —— 选它之后整张表单跟着变 */
const 招聘类型副标: Record<招聘类型, string> = {
  社招全职: '面向有工作经验的人选',
  校园招聘: '面向应届毕业生，按届别筛选',
  实习生: '在校生实习，按天计薪',
  兼职: '灵活排班，按小时计薪',
};

/** 各类型的计薪单位：社招/校招走月薪 K，实习按天、兼职按时 */
const 薪资单位 = (型: 招聘类型) => (型 === '实习生' ? '元/天' : 型 === '兼职' ? '元/时' : 'K');

/** 校园招聘届别随当前年份滚动，避免每年手工改一遍并出现过期选项。 */
const 当前年 = new Date().getFullYear();
const 届别选项 = ['不限', ...Array.from({ length: 5 }, (_, 序) => `${当前年 + 序} 届`)];

/** 这个类型要不要按年限筛：校招/实习面向没有工龄的人，经验档整个隐藏 */
const 按年限筛 = (型: 招聘类型) => 型 === '社招全职' || 型 === '兼职';

/** 这个类型有没有年薪月数：按天/按时计薪的没有 */
const 有年薪月数 = (型: 招聘类型) => 型 === '社招全职' || 型 === '校园招聘';

/** 经验要求档位。「不限」不写进合同，其余生成一条「X经验」硬性条件 */
const 经验要求选项 = ['不限', '1-3 年', '3-5 年', '5 年以上', '10 年以上'];

/** 最低学历档位。「不限」不写进合同，其余生成一条「X及以上」硬性条件 */
const 最低学历选项 = ['不限', '大专', '本科', '硕士', '博士'];

/** 这条硬性条件是不是经验条（含存量数据的「5 年以上」这种没带「经验」后缀的写法） */
const 是经验条 = (条: string) => /^\d+(?:-\d+)?\s*年以上(经验)?$/.test(条);

/** 这条硬性条件是不是学历条 */
const 是学历条 = (条: string) => /^(大专|本科|硕士|博士)及以上$/.test(条);

// ── P0 修复 Task 6：服务端 422 的岗位表单投影 ──────────────────────
// 只把「已知字段路径 × 已知空值类 reason」翻成用户能照做的中文；未知路径或未知
// reason 一律落通用岗位文案 —— 机器 reason 绝不原样上屏。
const 可本地化空值原因 = new Set(['required', 'blank', 'must_not_be_blank']);
const 岗位字段文案: Record<string, string> = {
  'hiring_organization_claim.display_name': '请填写公司名称',
  office_location: '请填写办公地点',
  description: '请填写职位描述',
  requirements: '请填写职位要求',
};

/** 归一字段路径：点分（a.b）与 JSON Pointer（/a/b）两种写法收敛成同一把 key。 */
function 归一字段路径(path: string): string {
  return path.startsWith('/') ? path.slice(1).replaceAll('/', '.') : path;
}

export function 取岗位提交错误文案(error: unknown): string {
  if (!(error instanceof BFF错误) || error.code !== 'validation_failed') {
    return 取后端错误文案(error);
  }
  for (const field of error.fieldErrors) {
    const message = 岗位字段文案[归一字段路径(field.path)];
    if (message && 可本地化空值原因.has(field.reason)) return message;
  }
  return '请检查岗位信息';
}

/** 从存量硬性条件里把经验档拆出来，如 '5 年以上经验' → '5 年以上'；拆不出返回 null */
function 拆出经验(条件: string[] | undefined): string | null {
  const 命中 = (条件 ?? []).find(是经验条);
  return 命中 ? 命中.replace(/经验$/, '').trim() : null;
}

/** 从存量硬性条件里把学历档拆出来，如 '本科及以上' → '本科'；拆不出返回 null */
function 拆出学历(条件: string[] | undefined): string | null {
  const 命中 = (条件 ?? []).find(是学历条);
  return 命中 ? 命中.replace(/及以上$/, '') : null;
}


/** 新建岗位时预填的硬性条件（对应下面那份交易网关的 JD 预填文案；
 *  经验条走结构化档位，不在这里重复）*/
// 新岗位不能带用户从未确认过的隐藏硬条件；结构化必填项会在第三步生成初筛合同。
const 硬性条件预填: string[] = [];

// 新岗位不预填具体 JD：切换到校招或实习时，资深后端的演示文案
// 会与招聘类型直接冲突，也容易被用户没检查就发布。
const 职位描述预填 = '';
const 职位要求预填 = '';


/** 今天的 'YYYY-MM-DD'。新岗位的发布时间，岗位详情的状态卡读它 */
function 今天日期(): string {
  const 今 = new Date();
  const 补零 = (数: number) => String(数).padStart(2, '0');
  return `${今.getFullYear()}-${补零(今.getMonth() + 1)}-${补零(今.getDate())}`;
}

/** 「50-65K」→ ['50', '65']。存量数据只有这一种写法，解析不出来就退回空串让用户重填 */
function 拆薪资带(薪资带: string): [string, string] {
  const 命中 = /^(\d+)\s*-\s*(\d+)/.exec(薪资带.trim());
  return 命中 ? [命中[1], 命中[2]] : ['', ''];
}

// ── JD PDF 建议稿导入（页面本地运行态，2026-09-03）────────────────────
// 只在 Backend + recruiter 新建岗位接线；consent 前零 mutation；pending/processing
// 用约 3 秒 setTimeout 链串行轮询（隐藏暂停、恢复立即读）；新旧轮用页面 generation +
// import ID 双栅栏隔离迟到结果。导入状态不落 localStorage/sessionStorage。

type JD导入阶段 = 'idle' | 'uploading' | 'pending' | 'processing' | 'succeeded' | 'failed';
type JD重试动作 = 'create' | 'read' | 'none';

interface JD导入页面状态 {
  generation: number;
  phase: JD导入阶段;
  file: File | null;
  idempotencyKey: string | null;
  importId: string | null;
  retry: JD重试动作;
  error: string | null;
}

const 初始JD导入状态: JD导入页面状态 = {
  generation: 0,
  phase: 'idle',
  file: null,
  idempotencyKey: null,
  importId: null,
  retry: 'none',
  error: null,
};

/** 后端 terminal failed 的四值闭集文案（Spec §9.2）。 */
const JD失败码文案: Record<BFFJD导入失败码, string> = {
  invalid_pdf: '仅支持有效、未加密且不含主动内容的 PDF',
  document_too_complex: '内容过多或过于复杂，请换一份 PDF',
  parser_invalid_output: '未能识别这份 JD，可重新上传或手动填写',
  parser_temporarily_unavailable: '识别服务繁忙，请稍后重试或手动填写',
};

/** JD 专用闭合错误文案：绝不上屏后端 message、request ID、provider 或模型输出。 */
function 取JD错误文案(error: unknown): string {
  const unavailable = 'JD 服务暂时不可用，请稍后重试或手动填写';
  if (!(error instanceof BFF错误)) return unavailable;
  const known: Record<string, string> = {
    invalid_pdf: JD失败码文案.invalid_pdf,
    job_draft_import_too_large: '文件过大，请选择较小的 PDF',
    document_too_complex: JD失败码文案.document_too_complex,
    processing_consent_required: '请重新确认后再继续',
    upload_in_progress: 'JD 正在上传，请稍后重试',
    idempotency_in_progress: 'JD 正在上传，请稍后重试',
    idempotency_conflict: '上传意图已变化，请重新选择文件',
    parser_invalid_output: JD失败码文案.parser_invalid_output,
    parser_temporarily_unavailable: JD失败码文案.parser_temporarily_unavailable,
    job_draft_import_not_found: '这次识别已失效，请重新上传',
    storage_unavailable: unavailable,
    invalid_response: '服务返回异常，请稍后重试',
  };
  if (known[error.code]) return known[error.code];
  return unavailable;
}

/** POST 异常允许显式重试创建的闭合集合：结果未知或临时失败才复用同一 File + 幂等键。 */
function JD创建错误可重试(error: unknown): boolean {
  if (!(error instanceof BFF错误)) return false;
  return error.code === 'network_error' || error.status === 503 ||
    error.code === 'operation_outcome_unknown' || error.code === 'storage_unavailable' ||
    error.code === 'upload_in_progress' || error.code === 'idempotency_in_progress';
}

/** GET 异常允许显式重试读取的闭合集合：只重读同一 import ID，绝不重新 POST。 */
function JD读取错误可重试(error: unknown): boolean {
  if (!(error instanceof BFF错误)) return false;
  return error.code === 'network_error' || error.status === 503 || error.code === 'storage_unavailable';
}

/** 基础信息步 里的 JD 横幅是纯数据 props（复用现有 代理横幅，不新增组件）。 */
interface JD横幅属性 {
  前文: string;
  强调: string;
  动作文: string;
  按下: () => void;
}

export default function 发布岗位() {
  const { id: 路由岗位编号 } = useParams<{ id: string }>();
  const { 返回, 进企业主壳, 进企业初始化, 替换跳转 } = use导航();
  // 注册流的招聘名片跳过来时在 history.state 上做了标记(刷新不丢);
  // 应用内入口(岗位管理/在谈/推荐的 ＋)没有标记 → 发布后不再播初始化页
  const 从注册流 = Boolean((useLocation().state as { 从注册流?: boolean } | null)?.从注册流);
  const { 状态, 派发, 操作, 数据源模式, 目录查询 } = use应用状态();
  const 是后端 = 数据源模式 === 'backend';
  // 提交/删除并发锁：await 操作.* 期间拒绝重复点击，不改变按钮样式
  const 提交锁 = useRef(false);

  // 编辑态：URL 带编号且能在岗位列表里找到。找不到（如刚被删掉）就退化成新建，
  // 不给死屏 —— 原型里任何入口都必须点得开
  const 编辑目标 = 路由岗位编号
    ? 状态.岗位列表.find((岗) => 岗.编号 === 路由岗位编号) ?? null
    : null;
  const 编辑态 = 编辑目标 !== null;

  const [预填下限, 预填上限] = 编辑目标 ? 拆薪资带(编辑目标.薪资带) : ['', ''];

  const [第几步, 设第几步] = useState(0);

  // ── 第一步：基础信息 ──
  const [岗位名称, 设岗位名称] = useState(编辑目标?.名称 ?? '');
  const [工作城市, 设工作城市] = useState(编辑目标?.城市 ?? '');
  const [办公地, 设办公地] = useState(编辑目标?.办公地 ?? '');
  const [薪资下限, 设薪资下限] = useState(预填下限);
  const [薪资上限, 设薪资上限] = useState(预填上限);
  const [年薪月数, 设年薪月数] = useState<number | null>(编辑目标?.年薪月数 ?? null);
  const [月数轮, 设月数轮] = useState(false);
  const [办公方式, 设办公方式] = useState(编辑目标?.办公方式 ?? '');
  const [招聘类型, 设招聘类型] = useState<招聘类型>(编辑目标?.招聘类型 ?? '社招全职');
  const [届别, 设届别] = useState(编辑目标?.届别 ?? '不限');
  const [职位类别, 设职位类别] = useState(编辑目标?.职位类别 ?? '');
  // Task 7：Backend 类别选择器选中的目录引用（id + display_name）；Mock 始终 undefined。
  // 选中 selectable 叶子时原子写入 职位类别（字符串）+ 类别引用；编辑态从 从BFF岗位 带入。
  const [类别引用, 设类别引用] = useState<目录选择值 | undefined>(编辑目标?.类别引用);
  const [类别层开, 设类别层开] = useState(false);
  // Task 7：Backend 工作城市选择器选中的 Location 引用；手输 clears it（undefined）。
  // 编辑态从 从BFF岗位 带入；Mock 始终 undefined（自由文本，无候选）。
  const [地点引用, 设地点引用] = useState<目录选择值 | undefined>(编辑目标?.地点引用);
  // Backend 工作城市搜索（250ms debounce）；Mock 不调用钩子（自由文本，无候选行）
  const { 设词: 设城市搜索词, 结果: 城市候选, 搜索中: 城市搜索中, 下一页游标: 城市下一页, 加载中: 城市加载中, 加载更多: 城市加载更多 } = use城市搜索(
    是后端 ? 目录查询?.查询Location : undefined,
  );
  // 实习要求（BOSS 对照补齐 2026-08-20）：只有招聘类型 = 实习生 时录入与落库。
  // 实习生看的是「实习几个月 · 每周到岗几天」，不是工龄档
  const [实习月数, 设实习月数] = useState(编辑目标?.实习月数 ?? 3);
  const [每周天数, 设每周天数] = useState(编辑目标?.每周天数 ?? 5);
  const [实习轮, 设实习轮] = useState<'月数' | '天数' | null>(null);
  const [实习转正, 设实习转正] = useState<boolean | null>(编辑目标?.实习转正 ?? null);
  // 职位关键词:录入口已删(2026-08-26 标注);存量岗位编辑时原值随提交保留不丢
  const [职位关键词] = useState<string[]>(编辑目标?.职位关键词 ?? []);
  // 编辑态底部「删除」的二次确认
  const [待删, 设待删] = useState(false);
  // 一键上传 JD(2026-09-01 → 2026-09-03 接线):consent → POST → 串行轮询 → 建议稿
  const JD文件框 = useRef<HTMLInputElement>(null);
  // JD 导入运行态只在当前挂载周期内存里（Spec §5.3）：generation 隔离同页多轮，
  // importId 隔离同轮多请求；文件、幂等键、建议、import ID 一律不持久化。
  const [JD状态, 设JD状态] = useState(初始JD导入状态);
  const [待确认JD, 设待确认JD] = useState<{ generation: number; file: File; key: string } | null>(null);
  // 状态同步双写 ref：POST/GET 结算读的是最新 generation，不吃一渲染旧的闭包值。
  const JD状态引用 = useRef(JD状态);
  const JD已挂载 = useRef(false);
  const JD定时器 = useRef<ReturnType<typeof setTimeout> | null>(null);
  const JD读取中 = useRef(false);

  const 更新JD状态 = (next: JD导入页面状态) => {
    JD状态引用.current = next;
    设JD状态(next);
  };

  const 清JD定时器 = useCallback(() => {
    if (JD定时器.current !== null) clearTimeout(JD定时器.current);
    JD定时器.current = null;
  }, []);

  useEffect(() => {
    JD已挂载.current = true;
    return () => {
      JD已挂载.current = false;
      清JD定时器();
    };
  }, [清JD定时器]);

  /** 页面级栅栏：挂载中 + generation 一致（带 importId 时还要同轮同任务）。 */
  const 本轮仍有效 = (generation: number, importId?: string) => {
    const current = JD状态引用.current;
    return JD已挂载.current && current.generation === generation &&
      (importId === undefined || current.importId === importId);
  };

  const 安排JD读取 = (generation: number, importId: string) => {
    清JD定时器();
    if (document.hidden || !本轮仍有效(generation, importId)) return;
    JD定时器.current = setTimeout(() => void 读取本轮JD(generation, importId), 3000);
  };

  /** 当前轮的一次 GET：单飞（JD读取中），结算按状态推进或终局，异常按闭合集合决定 read 重试。 */
  const 读取本轮JD = async (generation: number, importId: string): Promise<void> => {
    if (JD读取中.current) {
      // 已有 GET 在飞（多半是旧轮的迟到读）：同一时刻仍最多一个 GET，但本轮不丢拍
      安排JD读取(generation, importId);
      return;
    }
    JD读取中.current = true;
    try {
      const result = await 操作.读取JD导入(importId);
      if (!本轮仍有效(generation, importId) || result === '已换代') return;
      if (result.status === 'succeeded') {
        清JD定时器();
        更新JD状态({ ...JD状态引用.current, phase: 'succeeded', retry: 'none', error: null });
        return;
      }
      if (result.status === 'failed') {
        清JD定时器();
        更新JD状态({ ...JD状态引用.current, phase: 'failed', retry: 'none', error: JD失败码文案[result.failure_code] });
        return;
      }
      更新JD状态({ ...JD状态引用.current, phase: result.status, retry: 'none', error: null });
      安排JD读取(generation, importId);
    } catch (error) {
      if (!本轮仍有效(generation, importId)) return;
      清JD定时器();
      更新JD状态({
        ...JD状态引用.current, phase: 'failed', importId,
        error: 取JD错误文案(error),
        retry: JD读取错误可重试(error) ? 'read' : 'none',
      });
    } finally {
      JD读取中.current = false;
    }
  };

  /** 当前轮的一次 POST：四种状态都合法；异常保留 File+键，只有闭合集合给 create 重试。 */
  const 创建本轮JD = async (generation: number, file: File, key: string): Promise<void> => {
    try {
      const result = await 操作.创建JD导入(file, key);
      if (!本轮仍有效(generation) || result === '已换代') return;
      if (result.status === 'succeeded') {
        清JD定时器();
        更新JD状态({ ...JD状态引用.current, phase: 'succeeded', retry: 'none', error: null });
        return;
      }
      if (result.status === 'failed') {
        清JD定时器();
        更新JD状态({ ...JD状态引用.current, phase: 'failed', retry: 'none', error: JD失败码文案[result.failure_code] });
        return;
      }
      更新JD状态({ ...JD状态引用.current, phase: result.status, importId: result.import_id, retry: 'none', error: null });
      安排JD读取(generation, result.import_id);
    } catch (error) {
      if (!本轮仍有效(generation)) return;
      清JD定时器();
      更新JD状态({
        ...JD状态引用.current, phase: 'failed', importId: null,
        error: 取JD错误文案(error),
        retry: JD创建错误可重试(error) ? 'create' : 'none',
      });
    }
  };

  /** 确认层「同意并继续」：busy guard 挡重复同意，起飞前清任务坐标。 */
  const 提交待确认JD = () => {
    if (JD状态引用.current.phase === 'uploading') return;
    const 待 = 待确认JD;
    if (!待) return;
    设待确认JD(null);
    更新JD状态({
      ...JD状态引用.current, phase: 'uploading',
      file: 待.file, idempotencyKey: 待.key,
      importId: null, retry: 'none', error: null,
    });
    void 创建本轮JD(待.generation, 待.file, 待.key);
  };

  /** 失败横幅的「重试 ›」：按状态分派，create 复用同一 File+键，read 只重读同一任务。 */
  const 重试JD = () => {
    const current = JD状态引用.current;
    if (current.phase === 'uploading') return;
    if (current.retry === 'create' && current.file && current.idempotencyKey) {
      更新JD状态({ ...current, phase: 'uploading', error: null });
      void 创建本轮JD(current.generation, current.file, current.idempotencyKey);
    } else if (current.retry === 'read' && current.importId) {
      void 读取本轮JD(current.generation, current.importId);
    }
  };

  /** 隐藏文件框的选择：清 value 后分支 —— 编辑态零动作，非法文件只弹 toast，
   *  Mock 只回执，Backend 新建的合法 PDF 递增 generation 开新轮并弹 consent。 */
  const 选择JD文件 = (事件: React.ChangeEvent<HTMLInputElement>) => {
    const 文件 = 事件.currentTarget.files?.[0];
    事件.currentTarget.value = '';
    if (!文件 || 编辑态) return;
    const 问题 = 校验附件PDF(文件, null);
    if (问题) {
      轻提示(问题);
      return;
    }
    if (!是后端) {
      轻提示('已选择，可继续手动填写');
      return;
    }
    const generation = JD状态引用.current.generation + 1;
    清JD定时器();
    // 新合法 PDF：旧轮 timer/import/error 清零、phase 复位 idle —— 从 uploading/failed 也能重新起轮
    更新JD状态({
      generation, phase: 'idle', file: null, idempotencyKey: null,
      importId: null, retry: 'none', error: null,
    });
    设待确认JD({ generation, file: 文件, key: `jd-import-${crypto.randomUUID()}` });
  };

  /** 横幅动作拉起文件框：uploading 的 busy guard 是 no-op，其余状态都允许重新起轮。 */
  const 拉起JD文件框 = () => {
    if (JD状态引用.current.phase === 'uploading') return;
    JD文件框.current?.click();
  };

  // 可见性自持有一份监听（卸载即移除）：隐藏清 timer，恢复且在 pending/processing、
  // 无在飞 GET 时立即读一次；在飞的 GET 由它自己的结算安排下一拍。
  useEffect(() => {
    const 处理可见性 = () => {
      if (!JD已挂载.current) return;
      if (document.hidden) {
        清JD定时器();
        return;
      }
      const current = JD状态引用.current;
      if ((current.phase === 'pending' || current.phase === 'processing') &&
        !JD读取中.current && current.importId !== null) {
        void 读取本轮JD(current.generation, current.importId);
      }
    };
    document.addEventListener('visibilitychange', 处理可见性);
    return () => document.removeEventListener('visibilitychange', 处理可见性);
    // 读取本轮JD 读的全部是 ref 与稳定 操作 引用，闭包不捕获渲染态
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [清JD定时器]);

  /** JD 横幅四元组（Spec §9.1）：失败态把闭合 error 投影进现有横幅文案。 */
  const JD横幅: JD横幅属性 = (() => {
    switch (JD状态.phase) {
      case 'uploading':
        return { 前文: '正在上传 JD', 强调: '', 动作文: '上传 JD ›', 按下: 拉起JD文件框 };
      case 'pending':
      case 'processing':
        return { 前文: '正在识别 JD', 强调: '', 动作文: '上传 JD ›', 按下: 拉起JD文件框 };
      case 'succeeded':
        return { 前文: '已识别，请检查建议', 强调: '', 动作文: '重新上传 ›', 按下: 拉起JD文件框 };
      case 'failed':
        return JD状态.retry === 'create' || JD状态.retry === 'read'
          ? { 前文: JD状态.error ?? '', 强调: '', 动作文: '重试 ›', 按下: 重试JD }
          : { 前文: JD状态.error ?? '', 强调: '', 动作文: '重新上传 ›', 按下: 拉起JD文件框 };
      default:
        return { 前文: '把 JD 给我，', 强调: '这张表我来填', 动作文: '上传 JD ›', 按下: 拉起JD文件框 };
    }
  })();

  // ── 第二步 / 第三步：描述与要求 ──
  const [职位描述, 设职位描述] = useState(编辑目标?.职位描述 ?? 职位描述预填);
  // P0 修复 Task 4：职位要求恢复为独立可编辑字段 —— 真实 BFF 的 JobCreate 把
  // description 与 requirements 当两条互不复制的必填文本
  const [职位要求, 设职位要求] = useState(编辑目标?.职位要求 ?? 职位要求预填);
  // 经验 / 学历是结构化档位：编辑存量岗位时优先读字段，老数据从硬性条件里拆
  const [经验要求, 设经验要求] = useState(
    编辑目标 ? 编辑目标.经验要求 ?? 拆出经验(编辑目标.硬性条件) ?? '不限' : '不限'
  );
  const [最低学历, 设最低学历] = useState(
    编辑目标 ? 编辑目标.最低学历 ?? 拆出学历(编辑目标.硬性条件) ?? '不限' : '不限'
  );
  // 录入 UI 已删（标注 2026-08-20 14:46：只留筛选要求），但存量岗位的手动条不能丢：
  // 原样带着走，与档位生成的经验/学历条一起写回合同
  const 硬性条件 = (编辑目标?.硬性条件 ?? 硬性条件预填).filter(
    (条) => !是经验条(条) && !是学历条(条)
  );
  // Task 5：存量手动条的只读展示源（原文显示、不在三态块里改写）；组装仍走上面过滤后的 合同
  const 存量硬性条件 = 编辑目标?.硬性条件 ?? [];
  // 给 AI 代理的筛选要求（标注 13:40）：自由文本偏好，代理按它筛选候选和谈
  const [筛选要求, 设筛选要求] = useState(编辑目标?.筛选要求 ?? '');
  // ── Task 5：四问硬性事实。每个岗位的表单里都有一份独立完整拷贝 ——
  // 新岗从 空岗位硬性事实 复制起步（全部 未说明），编辑岗从存量的值复制带入；
  // 惰性初始化 + 拷贝，避免与 Mock 列表里的岗位对象共享引用被顺手改掉。
  // 保存失败（如 409 重读）不回滚这四个本地选择，等用户下一次显式保存。
  const [硬性事实] = useState<岗位硬性事实>(
    () => 编辑目标?.硬性事实 ? { ...编辑目标.硬性事实 } : { ...空岗位硬性事实 },
  );

  /**
   * 第一步确认会决定后续表单和匹配口径的基础字段。
   * 返回问题时一律带上「它在第几步」——这些控件只渲染在第一步，在别的步骤点保存时
   * 光弹 toast 不切步，用户当前屏上根本看不见那个控件，看着就是「点了没反应」。
   */
  const 第一步缺失 = (): { 文案: string; 步骤: number } | null => {
    if (岗位名称.trim() === '') return { 文案: '请填写岗位名称', 步骤: 0 };
    if (职位类别 === '') return { 文案: '请选择职位类别', 步骤: 0 };
    if (办公方式 === '') return { 文案: '请选择办公方式', 步骤: 0 };
    // 「最晚可接受实习开始日期」这道闸门随字段一起撤（产品负责人 2026-08-22：
    // 「最晚可接受实习开始日期…这个删了吧，没啥用」；该字段无书面出处）。
    // 转正机会这条留着 —— 同批澄清「实习生转正可以加，其他的都不要加」
    if (招聘类型 === '实习生' && 实习转正 === null) {
      return { 文案: '请确认是否提供转正机会', 步骤: 0 };
    }
    return null;
  };

  /** 提示并把用户带到出问题的那一步；能走就返回 true */
  const 可离开第一步 = (): boolean => {
    const 缺 = 第一步缺失();
    if (!缺) return true;
    轻提示(缺.文案);
    设第几步(缺.步骤);
    return false;
  };

  /**
   * 薪资校验（第三步交卷前）：必填，且下限不得高于上限。
   * 薪资写反（65-50K）看着只是笔误，但代理对外只交换「带宽是否有交集」这一个结论，
   * 区间反了交集就永远算不出来 —— 双盲下唯一能交换的东西直接失真，所以必须挡在发布前。
   */
  const 薪资缺失 = (): string | null => {
    if (薪资下限.trim() === '' || 薪资上限.trim() === '') return '请填写薪资带';
    if (Number(薪资下限) > Number(薪资上限)) return '薪资下限不能高于上限';
    if (有年薪月数(招聘类型) && 年薪月数 === null) return '请确认年薪月数';
    return null;
  };

  const 岗位信息缺失 = (): { 文案: string; 步骤: number } | null => {
    // P0 修复 Task 4：JobCreate 的三条独立必填文本在这里先挡一道，
    // 页面直接给可行动文案并把用户带回对应步骤，不让 422 从服务端兜回来。
    if (!职位描述.trim()) return { 步骤: 1, 文案: '请填写职位描述' };
    if (!职位要求.trim()) return { 步骤: 2, 文案: '请填写职位要求' };
    if (!工作城市.trim()) return { 步骤: 2, 文案: '请填写工作城市' };
    // Task 7：Backend 工作城市必须从候选选（落 地点引用）；手输未选时阻止发布
    if (是后端 && !地点引用) return { 步骤: 2, 文案: '请从候选城市中选择' };
    // 公司声明只在 Backend 新建岗位时有意义（Mock 发岗语义冻结，仍走 企业认证.公司）：
    // 新建走 JobCreate，没有可用的 verified 关系时 未认证公司声明 就是 claim 的唯一来源，
    // 必须非空。编辑走 JobPatch —— 请求里根本不带客户端 claim，服务端沿用岗位原有的
    // 那份声明，这里没有任何东西要护；何况本页没有公司名输入框（它在招聘名片屏），
    // 换设备（未认证公司声明 是设备本地态）或关系被撤销时挡在这里，这条 toast 无从消解。
    const verified = 状态.企业关系列表.some(
      (项) => 项.affiliation_id === 状态.当前企业关系编号 && 可用企业关系(项),
    );
    if (是后端 && !编辑态 && !verified && !状态.未认证公司声明.trim()) {
      // review-final：文案必须指路。本页没有公司名输入框，只说「请填写公司名称」
      // 等于把用户弹回第二步去找一个不存在的字段。（文件头 岗位字段文案 里的同名
      // 映射是服务端 422 的投影，属于契约层，不跟这条页面前置校验同步改。）
      return { 步骤: 2, 文案: '请先在招聘名片填写公司名称' };
    }
    if (!办公地.trim()) return { 步骤: 2, 文案: '请填写办公地点' };
    // 面试轮次 / 招聘紧急度 两道闸门随字段一起撤（产品负责人 2026-08-22：
    // 「这个面试轮次写上面是干什么的，应该删掉吧」「这个招聘紧急程度也删了吧，感觉没什么用」）。
    // 剩下的岗位名称 / 职位类别 / 办公方式 / 薪资带 是发岗真必需项，闸门不动
    return null;
  };

  /** 把当前表单拼成完整岗位对象。编辑态沿用原编号 / 状态 / 在谈数，不被表单覆盖。
   *  Task 7：Backend 带 类别引用/地点引用（选择器保存）；Mock 两者 undefined（ omitted）。 */
  const 组装岗位 = (编号: string, 底: 在招岗位 | null): 在招岗位 => {
    const 单位 = 薪资单位(招聘类型);
    return {
      编号,
      名称: 岗位名称.trim(),
      薪资带: `${薪资下限.trim()}-${薪资上限.trim()}${单位 === 'K' ? 'K' : ` ${单位}`}`,
      状态: 底?.状态 ?? '在招',
      在谈数: 底?.在谈数 ?? 0,
      城市: 工作城市.trim(),
      // Task 7：Backend 选择器保存的目录引用；Mock 始终 undefined（可选字段 omitted）
      类别引用,
      地点引用,
      办公地: 办公地.trim(),
      办公方式,
      招聘类型,
      届别: 招聘类型 === '校园招聘' ? 届别 : undefined,
      职位类别,
      // 校招/实习不按年限筛：无论档位残留什么值，落库一律「不限」
      经验要求: 按年限筛(招聘类型) ? 经验要求 : '不限',
      最低学历,
      年薪月数: 有年薪月数(招聘类型) ? 年薪月数 ?? undefined : undefined,
      // 实习要求只对实习岗有意义：换成别的类型就整项不落库，岗位详情那一行也跟着不出现
      实习月数: 招聘类型 === '实习生' ? 实习月数 : undefined,
      每周天数: 招聘类型 === '实习生' ? 每周天数 : undefined,
      实习转正: 招聘类型 === '实习生' ? 实习转正 ?? undefined : undefined,
      职位关键词: 职位关键词.length ? [...职位关键词] : undefined,
      // 加分项 UI 已删（2026-08-24），DTO 字段可选、不再提交
      // 编辑不改发布时间；新岗位落今天
      发布于: 底?.发布于 ?? 今天日期(),
      职位描述: 职位描述.trim(),
      职位要求: 职位要求.trim(),
      筛选要求: 筛选要求.trim() || undefined,
      // 合同 = 结构化档位（学历 → 经验/届别）+ 手动条件。「不限」不产生合同条
      硬性条件: [
        ...(最低学历 !== '不限' ? [`${最低学历}及以上`] : []),
        ...(按年限筛(招聘类型) && 经验要求 !== '不限' ? [`${经验要求}经验`] : []),
        ...(招聘类型 === '校园招聘' && 届别 !== '不限' ? [`${届别}毕业`] : []),
        ...硬性条件,
      ],
      // Task 5：四问硬性事实独立随对象提交 —— 没点过的问保持 未说明 原样发出，
      // 四员永远齐全（服务端 hard_requirements 必收完整块）；与上面的 legacy 合同互不影响
      硬性事实: { ...硬性事实 },
    };
  };


  /** 保存 / 发布。编辑态原地保存后返回，新建态发布后进企业主壳。
   *  Backend 先 await 操作.更新岗位/发布岗位，成功才显示当前轻提示并导航；
   *  失败复用现有轻提示，不增加 Loading 态。 */
  const 提交 = async () => {
    if (提交锁.current) return;
    if (!可离开第一步()) return;
    const 薪资错 = 薪资缺失();
    if (薪资错) {
      轻提示(薪资错);
      设第几步(2);
      return;
    }
    const 信息错 = 岗位信息缺失();
    if (信息错) {
      轻提示(信息错.文案);
      设第几步(信息错.步骤);
      return;
    }

    提交锁.current = true;
    try {
      if (编辑目标) {
        // 改硬性条件 = 改代理的核对合同：代理按新条件增量核对，
        // 但已经推进到的阶段既不回退也不跳跃（业务约束 4）
        await 操作.更新岗位(组装岗位(编辑目标.编号, 编辑目标));
        轻提示('岗位已保存');
        返回();
        return;
      }

      // 一次派发完整岗位，避免先建半成品再补字段时编号或计薪单位错位。
      const 预期编号 = `P-${String(状态.岗位列表.length + 1).padStart(2, '0')}`;
      await 操作.发布岗位(组装岗位(预期编号, null));
      轻提示('岗位已发布');
      派发({ 型: '企业切Tab', Tab: '人才' });
      // 注册流首发岗 → 先播一次性的企业初始化页(2026-08-25 乙方案);应用内发岗直进主壳
      if (从注册流) 进企业初始化();
      else 进企业主壳();
    } catch (错误) {
      // 诊断只留在开发态；生产用户只看到本地化文案，绝不泄露内部错误对象。
      if (import.meta.env.DEV) console.error('岗位提交失败', 错误);
      轻提示(取岗位提交错误文案(错误));
    } finally {
      提交锁.current = false;
    }
  };

  /** 这个岗位下还在谈的候选人数：有人在谈就不许直接删（同 岗位管理 的口径）*/
  const 在谈人数 = 编辑目标
    ? 状态.企业候选列表.filter((候) => 候.岗位编号 === 编辑目标.编号).length
    : 0;

  /**
   * 工作城市输入变更（Task 7）：
   *   Backend —— 手输更新字符串、触发 250ms debounce 候选查询、并清掉旧 地点引用（未选候选时阻止发布）；
   *   Mock —— 只更新字符串（自由文本，无候选）。
   * 点候选时由 选城市候选 单独设 工作城市 + 地点引用 + 清候选。
   */
  const 改工作城市 = (值: string) => {
    设工作城市(值);
    if (是后端) {
      设城市搜索词(值);
      设地点引用(undefined);
    }
  };

  /** Backend 点城市候选：原子写入 工作城市 + 地点引用，清掉候选行 */
  const 选城市候选 = (项: { id: string; display_name: string }) => {
    设工作城市(项.display_name);
    设地点引用({ id: 项.id, display_name: 项.display_name });
    设城市搜索词('');
  };

  /** 编辑态底部「删除」：有人在谈先拦住，否则弹二次确认 */
  const 请求删除 = () => {
    if (在谈人数 > 0) {
      轻提示(`还有 ${在谈人数} 位在谈候选，请先停止招聘`);
      return;
    }
    设待删(true);
  };

  /** 新建态的「下一步」：走到最后一步才提交 */
  const 下一步 = () => {
    if (第几步 === 0 && !可离开第一步()) return;
    if (第几步 < 步骤顺序.length - 1) {
      设第几步(第几步 + 1);
      return;
    }
    提交();
  };

  /** 编辑态的分段切换：从第一步跳走时同样先过校验 */
  const 跳到步 = (序: number) => {
    if (序 === 第几步) return;
    if (第几步 === 0 && !可离开第一步()) return;
    设第几步(序);
  };

  const 上一步 = () => {
    // 编辑态点返回就是离开这一屏（分段之间用上方的切换条走，不做后退堆栈）
    if (编辑态 || 第几步 === 0) 返回();
    else 设第几步(第几步 - 1);
  };

  return (
    // 2026-08-24 全站选择风格统一（C1 定稿）：页底改白底
    <次级页外壳 白底>

      {/* 一键上传 JD 的隐藏文件框：只收 PDF；选中即清 value 允许重选同一文件；
          consent 前零请求（2026-09-03 接线，位置与 inline style 不变） */}
      <input
        ref={JD文件框}
        aria-label="上传 JD 文件"
        type="file"
        accept=".pdf,application/pdf"
        style={{ display: 'none' }}
        onChange={选择JD文件}
      />
      <div className={样式.发布壳} aria-busy={JD状态.phase === 'uploading'}>
        <返回栏 返回={上一步} 标题={编辑态 ? '编辑岗位' : undefined} />

        {编辑态 ? (
          /* 编辑态：三步变成可直接点的分段 —— 只想改个薪资带的人不该被迫走完三屏 */
          <div className={样式.分段行}>
            {步骤顺序.map((步, 序) => (
              <button
                key={步}
                className={`${样式.分段} ${序 === 第几步 ? 样式.分段选中 : ''} 可点`}
                onClick={() => 跳到步(序)}
              >
                {步}
              </button>
            ))}
          </div>
        ) : null /* 新建态不再显示步名（标注 13:53：进度类元素全撤）；编辑态的分段是功能页签，保留 */}

        {第几步 === 0 ? (
          <基础信息步
            编辑态={编辑态}
            JD横幅={JD横幅}
            岗位名称={岗位名称}
            设岗位名称={设岗位名称}
            办公方式={办公方式}
            设办公方式={设办公方式}
            招聘类型={招聘类型}
            选招聘类型={(项) => {
              // 类型是表单的「开关」。切换后清空计薪字段，让发布人重新确认，
              // 既避免月薪/日薪单位错位，也不用演示默认值代替真实预算。
              设招聘类型(项);
              设薪资下限('');
              设薪资上限('');
              设年薪月数(null);
              if (项 === '实习生') 设实习转正(null);
            }}
            届别={届别}
            设届别={设届别}
            职位类别={职位类别}
            开类别层={() => 设类别层开(true)}
            实习月数={实习月数}
            设实习月数={设实习月数}
            每周天数={每周天数}
            设每周天数={设每周天数}
            实习轮={实习轮}
            设实习轮={设实习轮}
            实习转正={实习转正}
            设实习转正={设实习转正}
          />
        ) : null}
        {第几步 === 1 ? (
          <职位描述步 文本={职位描述} 设文本={设职位描述} />
        ) : null}
        {第几步 === 2 ? (
          <职位要求步
            编辑态={编辑态}
            招聘类型={招聘类型}
            经验要求={经验要求}
            设经验要求={设经验要求}
            最低学历={最低学历}
            设最低学历={设最低学历}
            薪资下限={薪资下限}
            设薪资下限={设薪资下限}
            薪资上限={薪资上限}
            设薪资上限={设薪资上限}
            年薪月数={年薪月数}
            设年薪月数={设年薪月数}
            月数轮={月数轮}
            设月数轮={设月数轮}
            工作城市={工作城市}
            设工作城市={改工作城市}
            办公地={办公地}
            设办公地={设办公地}
            职位要求={职位要求}
            设职位要求={设职位要求}
            筛选要求={筛选要求}
            设筛选要求={设筛选要求}
            // Task 5：四问硬性事实三态钮 + 存量手动条只读展示（第三步 硬性条件 区）
            存量硬性条件={存量硬性条件}
            是后端={是后端}
            地点引用={地点引用}
            城市候选={城市候选}
            城市搜索中={城市搜索中}
            选城市候选={选城市候选}
            城市下一页={城市下一页}
            城市加载中={城市加载中}
            城市加载更多={城市加载更多}
          />
        ) : null}

        {编辑态 ? (
          /* 编辑态底部双键（BOSS 对照 2026-08-20）：删除 + 保存。
             删除不可逆，走二次确认；有在谈候选时点了会被拦下 */
          <div className={样式.底键区}>
            <button className={`${样式.删除键} 可点`} onClick={请求删除}>
              删除
            </button>
            <button className={`${样式.保存键} 可点`} onClick={提交}>
              保存
            </button>
          </div>
        ) : (
          <主按钮
            文字={第几步 === 步骤顺序.length - 1 ? '发布岗位并开始寻访' : '下一步'}
            按下={下一步}
          />
        )}

        {/* 删除二次确认：删除后岗位与全部记录都不再保留，必须显式点掉 */}
        {待删 && 编辑目标 ? (
          <弹层框架 标签={`删除岗位${编辑目标.名称}`} 遮罩类名={样式.删遮罩} 面板类名={样式.删确认框} 位置="居中" 关闭={() => 设待删(false)}>
              <div className={样式.删标题}>删除「{编辑目标.名称}」？</div>
              <div className={样式.删正文}>
                删除后这个岗位和它的全部记录都不再保留，且不可撤销。
                如果只是暂时不招，用「停止招聘」归档更合适 —— 档案留着，随时能重新开放。
              </div>
              <div className={样式.删键行}>
                <button className={`${样式.删取消} 可点`} onClick={() => 设待删(false)}>
                  取消
                </button>
                <button
                  className={`${样式.删执行} 可点`}
                  onClick={async () => {
                    if (提交锁.current) return;
                    提交锁.current = true;
                    try {
                      await 操作.删除岗位(编辑目标.编号);
                      设待删(false);
                      轻提示(`「${编辑目标.名称}」已删除`);
                      // 岗位没了，回退栈里的岗位详情也就没了，直接替换回岗位管理
                      替换跳转(路径.岗位管理);
                    } catch (错误) {
                      // 失败保留弹层，复用现有轻提示，不增加 Loading 态
                      轻提示(取后端错误文案(错误));
                    } finally {
                      提交锁.current = false;
                    }
                  }}
                >
                  删除
                </button>
              </div>
          </弹层框架>
        ) : null}

        {/* JD 导入 consent：复用现有 确认层，文案冻结（Spec §7.1）；取消零 mutation */}
        {待确认JD ? (
          <确认层
            标题="允许 AI 识别这份职位描述？"
            正文="这份 PDF 将发送给受控模型服务进行职位信息识别。确认后才会上传并开始处理。"
            执行文="同意并继续"
            执行={提交待确认JD}
            取消={() => 设待确认JD(null)}
          />
        ) : null}

        {类别层开 ? (
          是后端 ? (
            /* Task 7：Backend 按 查询Taxonomy('job-categories') 展开两级，selectable 叶子原子保存 */
            <职业分类层后端
              查询Taxonomy={目录查询?.查询Taxonomy}
              当前引用={类别引用}
              选定={(项) => {
                // 预填（2026-08-24）：名称为空或还等于上一次预填值（用户没改过）
                // 时，跟着新选的类别叶子走；用户手改过的名称绝不覆盖
                if (岗位名称.trim() === '' || 岗位名称 === 职位类别) {
                  设岗位名称(项.display_name);
                }
                设职位类别(项.display_name);
                设类别引用({ id: 项.id, display_name: 项.display_name });
                设类别层开(false);
              }}
              关闭={() => 设类别层开(false)}
            />
          ) : (
            <职业分类层
              当前={职位类别}
              选定={(项) => {
                // 预填同 Backend 路径：名称没被用户改过时跟着类别叶子走
                if (岗位名称.trim() === '' || 岗位名称 === 职位类别) {
                  设岗位名称(项);
                }
                设职位类别(项);
                设类别引用(undefined);
                设类别层开(false);
              }}
              关闭={() => 设类别层开(false)}
            />
          )
        ) : null}
      </div>
    </次级页外壳>
  );
}

// ── 职业分类两级选择层：左栏大类、右栏小类（同省市选择器的形）──
function 职业分类层({
  当前,
  选定,
  关闭,
}: {
  当前: string;
  选定: (小类: string) => void;
  关闭: () => void;
}) {
  const [活动大类, 设活动大类] = useState(() => 查大类(当前));
  const 当前组 = 职业分类表.find((组) => 组.大类 === 活动大类) ?? 职业分类表[0];

  return (
    <弹层框架 标签="选择职位类别" 遮罩类名={样式.分类遮罩} 面板类名={样式.分类层} 关闭={关闭}>
        <span className={样式.分类抓手} />
        <div className={样式.分类标题}>职位类别</div>
        <div className={样式.分类体}>
          {/* 左栏：大类 */}
          <div className={`${样式.大类栏} 滚动区`}>
            {职业分类表.map((组) => (
              <button
                key={组.大类}
                className={`${样式.大类项} ${组.大类 === 活动大类 ? 样式.大类项选中 : ''} 可点`}
                onClick={() => 设活动大类(组.大类)}
              >
                {组.大类}
              </button>
            ))}
          </div>
          {/* 右栏：小类 */}
          <div className={`${样式.小类栏} 滚动区`}>
            {当前组.小类.map((项) => (
              <button
                key={项}
                className={`${样式.小类项} ${项 === 当前 ? 样式.小类项选中 : ''} 可点`}
                onClick={() => 选定(项)}
              >
                {项}
                {项 === 当前 ? <span className={样式.小类勾}>✓</span> : null}
              </button>
            ))}
          </div>
        </div>
    </弹层框架>
  );
}

// ── Task 7：Backend 职业分类两级选择层 ——
// 左栏 roots，右栏当前 root 的子项；非 selectable 子项按 parentId 展开下一级（替换右栏），
// selectable 叶子原子回调 选定（同时写 职位类别 字符串 + 类别引用）。
// 复用 选期望职位.tsx 的 查询Taxonomy('job-categories') 形，但单选 + 弹层外壳。
// review-r3 R3-I-5：root/child 分页（nextCursor + dedup load-more）；
// review-r3 R3-I-6：导航代际守 stale——快速切大类时慢的旧子项不覆盖新的。
function 职业分类层后端({
  查询Taxonomy,
  当前引用,
  选定,
  关闭,
}: {
  查询Taxonomy?: (kind: 'job-categories', query: { parentId?: string; q?: string; cursor?: string; limit?: number }) => Promise<{ items: BFFTaxonomyItem[]; nextCursor: string | null; catalogVersion: string }>;
  当前引用: 目录选择值 | undefined;
  选定: (项: BFFTaxonomyItem) => void;
  关闭: () => void;
}) {
  const 方法引用 = useRef(查询Taxonomy);
  方法引用.current = 查询Taxonomy;
  const [根项, 设根项] = useState<BFFTaxonomyItem[]>([]);
  const [当前根, 设当前根] = useState<BFFTaxonomyItem | null>(null);
  const [子项, 设子项] = useState<BFFTaxonomyItem[]>([]);
  // review-r3 R3-I-5：分页游标 + 加载中状态
  const [根游标, 设根游标] = useState<string | null>(null);
  const [根加载中, 设根加载中] = useState(false);
  const [子项游标, 设子项游标] = useState<string | null>(null);
  const [子项加载中, 设子项加载中] = useState(false);
  // review-r3 R3-I-6：导航代际守 stale；R3-I-8：当前根 ref
  const 导航代际 = useRef(0);
  const 当前根引用 = useRef(当前根);
  当前根引用.current = 当前根;

  // mount：读 roots，默认选第一枚并预载其子项
  useEffect(() => {
    const 方法 = 方法引用.current;
    if (!方法) return;
    void (async () => {
      try {
        const 页 = await 方法('job-categories', { limit: 50 });
        设根项(页.items);
        设根游标(页.nextCursor);
        if (页.items.length > 0 && !当前根) {
          设当前根(页.items[0]);
          const 本次 = ++导航代际.current;
          try {
            const 子页 = await 方法('job-categories', { parentId: 页.items[0].id, limit: 50 });
            if (本次 !== 导航代际.current) return;
            设子项(子页.items);
            设子项游标(子页.nextCursor);
          } catch {
            if (本次 !== 导航代际.current) return;
            设子项([]);
            设子项游标(null);
          }
        }
      } catch {
        设根项([]);
        设根游标(null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // review-r3 R3-I-5：根加载更多
  const 根加载更多 = async () => {
    if (根游标 === null || 根加载中) return;
    const 方法 = 方法引用.current;
    if (!方法) return;
    设根加载中(true);
    try {
      const 页 = await 方法('job-categories', { cursor: 根游标, limit: 50 });
      设根项((旧) => 合并目录页(旧, 页.items));
      设根游标(页.nextCursor);
    } catch {
      // 失败不动
    } finally {
      设根加载中(false);
    }
  };

  // review-r3 R3-I-5/I-8：子项加载更多——导航代际 + 当前根双重守 stale
  const 子项加载更多 = async () => {
    if (子项游标 === null || 子项加载中 || !当前根) return;
    const 方法 = 方法引用.current;
    if (!方法) return;
    const 本次导航 = 导航代际.current;
    const 目标根id = 当前根.id;
    设子项加载中(true);
    try {
      const 页 = await 方法('job-categories', { parentId: 目标根id, cursor: 子项游标, limit: 50 });
      if (本次导航 !== 导航代际.current || 当前根引用.current?.id !== 目标根id) return;
      设子项((旧) => 合并目录页(旧, 页.items));
      设子项游标(页.nextCursor);
    } catch {
      if (本次导航 !== 导航代际.current || 当前根引用.current?.id !== 目标根id) return;
    } finally {
      if (本次导航 === 导航代际.current && 当前根引用.current?.id === 目标根id) 设子项加载中(false);
    }
  };

  // 左栏点 root：加载它的子项到右栏
  // review-r3 R3-I-6：导航代际守 stale——快速切大类时慢的旧子项不覆盖新的
  const 选根 = async (项: BFFTaxonomyItem) => {
    设当前根(项);
    设子项([]);
    设子项游标(null);
    const 方法 = 方法引用.current;
    if (!方法) return;
    const 本次 = ++导航代际.current;
    try {
      const 子页 = await 方法('job-categories', { parentId: 项.id, limit: 50 });
      if (本次 !== 导航代际.current) return;
      设子项(子页.items);
      设子项游标(子页.nextCursor);
    } catch {
      if (本次 !== 导航代际.current) return;
      设子项([]);
      设子项游标(null);
    }
  };

  // 右栏点子项：非 selectable → 按 parentId 展开下一级（替换右栏）；
  // selectable 叶子 → 原子回调 选定，由父组件写 职位类别 + 类别引用
  const 切子项 = (项: BFFTaxonomyItem) => {
    if (!项.selectable) {
      设当前根(项);
      设子项([]);
      设子项游标(null);
      const 方法 = 方法引用.current;
      if (方法) {
        const 本次 = ++导航代际.current;
        void (async () => {
          try {
            const 子页 = await 方法('job-categories', { parentId: 项.id, limit: 50 });
            if (本次 !== 导航代际.current) return;
            设子项(子页.items);
            设子项游标(子页.nextCursor);
          } catch {
            if (本次 !== 导航代际.current) return;
            设子项([]);
            设子项游标(null);
          }
        })();
      }
      return;
    }
    选定(项);
  };

  return (
    <弹层框架 标签="选择职位类别" 遮罩类名={样式.分类遮罩} 面板类名={样式.分类层} 关闭={关闭}>
      <span className={样式.分类抓手} />
      <div className={样式.分类标题}>职位类别</div>
      <div className={样式.分类体}>
        {/* 左栏：大类（roots） */}
        <div className={`${样式.大类栏} 滚动区`}>
          {根项.map((项) => (
            <button
              key={项.id}
              className={`${样式.大类项} ${(当前根?.id ?? '') === 项.id ? 样式.大类项选中 : ''} 可点`}
              onClick={() => 选根(项)}
            >
              {项.display_name}
            </button>
          ))}
          {/* review-r3 R3-I-5：根分页加载更多 */}
          {根游标 !== null ? (
            <button
              className="可点"
              onClick={根加载更多}
              disabled={根加载中}
              style={{ width: '100%', padding: '10px', color: 'var(--最弱)' }}
            >
              {根加载中 ? '加载中…' : '加载更多'}
            </button>
          ) : null}
        </div>
        {/* 右栏：当前 root 的子项；非 selectable 继续展开，selectable 叶子原子选定 */}
        <div className={`${样式.小类栏} 滚动区`}>
          {子项.map((项) => (
            <button
              key={项.id}
              className={`${样式.小类项} ${(当前引用?.id ?? '') === 项.id ? 样式.小类项选中 : ''} 可点`}
              onClick={() => 切子项(项)}
              aria-disabled={!项.selectable ? true : undefined}
            >
              {项.display_name}
              {(当前引用?.id ?? '') === 项.id ? <span className={样式.小类勾}>✓</span> : null}
            </button>
          ))}
          {/* review-r3 R3-I-5：子项分页加载更多 */}
          {子项游标 !== null ? (
            <button
              className="可点"
              onClick={子项加载更多}
              disabled={子项加载中}
              style={{ width: '100%', padding: '10px', color: 'var(--最弱)' }}
            >
              {子项加载中 ? '加载中…' : '加载更多'}
            </button>
          ) : null}
        </div>
      </div>
    </弹层框架>
  );
}

// ── D0 第一步：基础信息 —— 招聘类型先选（它是整张表单的开关）→ 名称 → 类别 → 办公方式 ──
function 基础信息步({
  编辑态,
  JD横幅,
  岗位名称,
  设岗位名称,
  办公方式,
  设办公方式,
  招聘类型: 当前招聘类型,
  选招聘类型,
  届别: 当前届别,
  设届别,
  职位类别: 当前职位类别,
  开类别层,
  实习月数,
  设实习月数,
  每周天数,
  设每周天数,
  实习轮,
  设实习轮,
  实习转正,
  设实习转正,
}: {
  编辑态: boolean;
  /** JD 导入横幅四元组（纯数据 props）：状态文案/动作由页面运行态投影，本层只摆放 */
  JD横幅: JD横幅属性;
  岗位名称: string;
  设岗位名称: (值: string) => void;
  办公方式: string;
  设办公方式: (值: string) => void;
  招聘类型: 招聘类型;
  选招聘类型: (值: 招聘类型) => void;
  届别: string;
  设届别: (值: string) => void;
  职位类别: string;
  开类别层: () => void;
  实习月数: number;
  设实习月数: (值: number) => void;
  每周天数: number;
  设每周天数: (值: number) => void;
  实习轮: '月数' | '天数' | null;
  设实习轮: (值: '月数' | '天数' | null) => void;
  实习转正: boolean | null;
  设实习转正: (值: boolean) => void;
}) {
  // 三个「发布后不可修改」的字段（招聘类型 / 名称 / 类别；城市在第三步同样锁）：
  // 换了它们等于换了一个岗位，正在谈的候选人手里的合同就失效了，所以编辑态锁死
  const 提示不可改 = () => 轻提示('发布后不可修改，如需变更请新发一个岗位');

  return (
    <滚动区 样式覆盖={{ paddingBottom: 12 }}>
      <页面大标题
        标题={编辑态 ? '基础信息' : '岗位基础信息'}
      />

      {/* 一键上传 JD(2026-09-01 用户定稿):用主页同款代理横幅收 JD ——
          这是代理的活,就用代理的语气开口。2026-09-03 接线:横幅文案/动作由页面
          JD 运行态投影(四元组纯数据 props)。编辑态不出现(岗位已存在,不再从 JD 起手) */}
      {编辑态 ? null : (
        <div className={样式.上传JD区}>
          <代理横幅
            前文={JD横幅.前文}
            强调={JD横幅.强调}
            动作文={JD横幅.动作文}
            按下={JD横幅.按下}
          />
        </div>
      )}

      <div className={样式.表单区}>
        {/* 招聘类型宫格：放最前（BOSS 同位），选中项决定后面表单长什么样 */}
        <div className={样式.编辑条目}>
          <div className={样式.条目标签}>
            招聘类型{编辑态 ? <span className={样式.锁标}>发布后不可改</span> : null}
          </div>
          <div className={样式.类型宫格}>
            {招聘类型选项.map((项) => (
              <button
                key={项}
                className={`${样式.类型块} ${当前招聘类型 === 项 ? 样式.类型块选中 : ''} 可点`}
                onClick={() => (编辑态 ? 提示不可改() : 选招聘类型(项))}
                aria-pressed={当前招聘类型 === 项}
              >
                <span className={样式.类型名}>{项}</span>
                <span className={样式.类型副}>{招聘类型副标[项]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 校园招聘专属：招收届别（选了会写进硬性条件合同，如「2027 届毕业」）*/}
        {当前招聘类型 === '校园招聘' ? (
          <div className={样式.编辑条目}>
            <div className={样式.条目标签}>招收届别</div>
            <div className={样式.快捷片行}>
              {届别选项.map((项) => (
                <button
                  key={项}
                  className={`${样式.快捷片} ${当前届别 === 项 ? 样式.快捷片选中 : ''} 可点`}
                  onClick={() => 设届别(项)}
                  aria-pressed={当前届别 === 项}
                >
                  {项}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* 实习专属：实习时长 + 每周到岗天数。两个数字都走滚轮，值域整齐、手输反而麻烦 */}
        {当前招聘类型 === '实习生' ? (
          <div className={样式.编辑条目}>
            <div className={样式.条目标签}>实习要求</div>
            <div className={样式.薪资行}>
              <button className={`${样式.计薪键} 可点`} onClick={() => 设实习轮('月数')}>
                <span className="等宽数字">{实习月数}</span>
                <span className={样式.计薪单位}>个月</span>
              </button>
              <button className={`${样式.计薪键} 可点`} onClick={() => 设实习轮('天数')}>
                <span className={样式.计薪单位}>每周</span>
                <span className="等宽数字">{每周天数}</span>
                <span className={样式.计薪单位}>天</span>
              </button>
            </div>
            <div className={样式.条目标签}>是否提供转正机会</div>
            <div className={样式.快捷片行}>
              <button
                className={`${样式.快捷片} ${实习转正 === true ? 样式.快捷片选中 : ''} 可点`}
                onClick={() => 设实习转正(true)}
                aria-pressed={实习转正 === true}
              >
                提供转正机会
              </button>
              <button
                className={`${样式.快捷片} ${实习转正 === false ? 样式.快捷片选中 : ''} 可点`}
                onClick={() => 设实习转正(false)}
                aria-pressed={实习转正 === false}
              >
                暂不提供
              </button>
            </div>
          </div>
        ) : null}

        {/* 顺序 2026-08-24 对调（产品负责人）：先选职位类别，岗位名称按所选
            叶子预填，用户在预填基础上改 —— 预填逻辑见容器组件 选定类别 */}
        {/* 职位类别：两级级联选择（标注 00:21，像选省份那样 大类 → 小类）。
            标注 2026-08-22：未选时原来写「请选择职位类别」，改成一行版式后
            这句就贴在「职位类别」标签右边，同样四个字读着更像重复 ——
            改用本页 年薪月数 已经在用的「请选择」，不新造措辞。 */}
        <button
          className={`${样式.选择条目} 可点`}
          onClick={() => (编辑态 ? 提示不可改() : 开类别层())}
        >
          <span className={样式.条目标签}>
            职位类别{编辑态 ? <span className={样式.锁标}>发布后不可改</span> : null}
          </span>
          <span className={样式.选择条目值行}>
            <span className={样式.条目值}>
              {当前职位类别 ? `${查大类(当前职位类别)} · ${当前职位类别}` : '请选择'}
            </span>
            <span className={样式.尖括号}>›</span>
          </span>
        </button>

        <div className={样式.编辑条目}>
          <div className={样式.条目标签}>
            岗位名称{编辑态 ? <span className={样式.锁标}>发布后不可改</span> : null}
          </div>
          <input
            className={样式.条目输入}
            value={岗位名称}
            placeholder="必填，如：资深后端工程师 · 交易网关"
            readOnly={编辑态}
            onClick={编辑态 ? 提示不可改 : undefined}
            onChange={(事件) => 设岗位名称(事件.target.value)}
          />
        </div>

        <div className={样式.编辑条目}>
          <div className={样式.条目标签}>办公方式</div>
          <div className={样式.快捷片行}>
            {办公方式选项.map((项) => (
              <button
                key={项}
                className={`${样式.快捷片} ${办公方式 === 项 ? 样式.快捷片选中 : ''} 可点`}
                onClick={() => 设办公方式(项)}
                aria-pressed={办公方式 === 项}
              >
                {项}
              </button>
            ))}
          </div>
        </div>
      </div>

      {实习轮 ? (
        <数字滚轮层
          标题={实习轮 === '月数' ? '实习时长' : '每周到岗'}
          初值={实习轮 === '月数' ? 实习月数 : 每周天数}
          最小={1}
          最大={实习轮 === '月数' ? 24 : 7}
          单位={实习轮 === '月数' ? '个月' : '天'}
          确认={(值) => {
            if (实习轮 === '月数') 设实习月数(值);
            else 设每周天数(值);
            设实习轮(null);
          }}
          取消={() => 设实习轮(null)}
        />
      ) : null}
    </滚动区>
  );
}

/** 薪资数字输入：只收数字，单位挂在框内右侧（月薪 K / 日薪 元/天 / 时薪 元/时） */
function 薪资数字框({
  值,
  改变,
  名称,
  单位 = 'K',
}: {
  值: string;
  改变: (值: string) => void;
  名称: string;
  单位?: string;
}) {
  return (
    <span className={样式.薪资框}>
      <input
        className={`${样式.薪资数字输入} 等宽数字`}
        value={值}
        placeholder="必填"
        inputMode="numeric"
        aria-label={名称}
        onChange={(事件) => 改变(事件.target.value.replace(/\D/g, '').slice(0, 4))}
      />
      <span className={样式.薪资单位}>{单位}</span>
    </span>
  );
}

// ── D0b 第二步：职位描述（大 textarea）──
function 职位描述步({
  文本,
  设文本,
}: {
  文本: string;
  设文本: (值: string) => void;
}) {
  return (
    <滚动区 样式覆盖={{ paddingBottom: 12 }}>
      <页面大标题
        标题="职位描述"
        说明="写清楚岗位的职责和工作内容，候选人会在岗位详情中看到。"
      />


      <div className={样式.描述卡}>
        <textarea
          className={样式.描述输入}
          value={文本}
          onChange={(事件) => 设文本(事件.target.value)}
          placeholder="例如：负责什么业务、解决什么问题、与哪些团队协作"
          maxLength={5000}
          aria-label="职位描述"
        />
        <div className={样式.描述底}>
          <span className={`${样式.描述计数} 等宽数字`}>{文本.length} / 5000</span>
        </div>
      </div>

      {/* 技能词池按标注 2026-08-26 删除(「必须具备的技能部分删掉」);
          加分项此前已按 2026-08-24 标注删除。存量岗位已选的关键词数据保留,
          职位要求步的 AI 初筛卡照常展示,只是不再在此录入 */}
    </滚动区>
  );
}

// ── D0c 第三步：选择职位要求（BOSS 步骤二的信息集合）——
// 经验 / 学历 / 薪资 / 地址 全在这一步的最上面，一屏看全；
// 往下才是写给人看的职位要求文本 + 交给代理执行的硬性条件合同。
function 职位要求步({
  编辑态,
  招聘类型: 当前类型,
  经验要求: 当前经验,
  设经验要求,
  最低学历: 当前学历,
  设最低学历,
  薪资下限,
  设薪资下限,
  薪资上限,
  设薪资上限,
  年薪月数,
  设年薪月数,
  月数轮,
  设月数轮,
  工作城市,
  设工作城市,
  办公地,
  设办公地,
  职位要求,
  设职位要求,
  筛选要求,
  设筛选要求,
  存量硬性条件,
  是后端,
  地点引用,
  城市候选,
  城市搜索中,
  选城市候选,
  城市下一页,
  城市加载中,
  城市加载更多,
}: {
  编辑态: boolean;
  招聘类型: 招聘类型;
  经验要求: string;
  设经验要求: (值: string) => void;
  最低学历: string;
  设最低学历: (值: string) => void;
  薪资下限: string;
  设薪资下限: (值: string) => void;
  薪资上限: string;
  设薪资上限: (值: string) => void;
  年薪月数: number | null;
  设年薪月数: (值: number) => void;
  月数轮: boolean;
  设月数轮: (开: boolean) => void;
  工作城市: string;
  设工作城市: (值: string) => void;
  办公地: string;
  设办公地: (值: string) => void;
  // P0 修复 Task 4：写给候选人看的职位要求（与职位描述互相独立的必填文本）
  职位要求: string;
  设职位要求: (值: string) => void;
  筛选要求: string;
  设筛选要求: (值: string) => void;
  // Task 5：四问硬性事实（服务端 hard_requirements 的页面投影）
  /** 存量手动条原文（只读展示，不改写） */
  存量硬性条件: string[];
  // Task 7：Backend 工作城市候选行
  是后端: boolean;
  地点引用: 目录选择值 | undefined;
  城市候选: { id: string; display_name: string }[];
  城市搜索中: boolean;
  选城市候选: (项: { id: string; display_name: string }) => void;
  // review-r2 R2-M-1：城市搜索分页
  城市下一页: string | null;
  城市加载中: boolean;
  城市加载更多: () => void;
}) {
  const { 跳转 } = use导航();
  const 提示不可改 = () => 轻提示('发布后不可修改，如需变更请新发一个岗位');
  const 单位 = 薪资单位(当前类型);
  // 日薪/时薪走滚轮（标注 2026-08-20 14:50）：值域整齐，手输反而麻烦
  const [计薪轮, 设计薪轮] = useState<'下限' | '上限' | null>(null);
  const 薪资标签 =
    单位 === 'K' ? '薪资带（月薪 · K）' : 单位 === '元/天' ? '日薪（元/天）' : '时薪（元/时）';

  return (
    <滚动区 样式覆盖={{ paddingBottom: 12 }}>
      <页面大标题 标题="职位要求" />

      <div className={样式.表单区}>
        {/* 经验要求：校招/实习面向没有工龄的人，这一档整个不出现 */}
        {按年限筛(当前类型) ? (
          <div className={样式.编辑条目}>
            <div className={样式.条目标签}>经验要求（自动匹配读取）</div>
            <div className={样式.快捷片行}>
              {经验要求选项.map((项) => (
                <button
                  key={项}
                className={`${样式.快捷片} ${当前经验 === 项 ? 样式.快捷片选中 : ''} 可点`}
                onClick={() => 设经验要求(项)}
                aria-pressed={当前经验 === 项}
                >
                  {项}
                </button>
              ))}
            </div>
          </div>
        ) : null /* 校招/实习不按年限筛，经验档位整块收起（标注 14:44：说明小字删） */}

        <div className={样式.编辑条目}>
          <div className={样式.条目标签}>最低学历（自动匹配读取）</div>
          <div className={样式.快捷片行}>
            {最低学历选项.map((项) => (
              <button
                key={项}
                className={`${样式.快捷片} ${当前学历 === 项 ? 样式.快捷片选中 : ''} 可点`}
                onClick={() => 设最低学历(项)}
                aria-pressed={当前学历 === 项}
              >
                {项}
              </button>
            ))}
          </div>
        </div>

        <div className={样式.编辑条目}>
          <div className={样式.条目标签}>{薪资标签}</div>
          <div className={样式.薪资行}>
            {单位 === 'K' ? (
              <>
                <薪资数字框 值={薪资下限} 改变={设薪资下限} 名称="薪资下限" 单位={单位} />
                <span className={样式.薪资连字}>—</span>
                <薪资数字框 值={薪资上限} 改变={设薪资上限} 名称="薪资上限" 单位={单位} />
              </>
            ) : (
              <>
                <button
                  className={`${样式.计薪键} 可点`}
                  onClick={() => 设计薪轮('下限')}
                >
                  <span className="等宽数字">{薪资下限 || '—'}</span>
                  <span className={样式.计薪单位}>{单位}</span>
                </button>
                <span className={样式.薪资连字}>—</span>
                <button
                  className={`${样式.计薪键} 可点`}
                  onClick={() => 设计薪轮('上限')}
                >
                  <span className="等宽数字">{薪资上限 || '—'}</span>
                  <span className={样式.计薪单位}>{单位}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* 年薪月数只对按月计薪的类型有意义 */}
        {有年薪月数(当前类型) ? (
          <button className={`${样式.选择条目} 可点`} onClick={() => 设月数轮(true)}>
            <span className={样式.条目标签}>年薪月数</span>
            <span className={样式.选择条目值行}>
              <span className={`${样式.条目值} 等宽数字`}>{年薪月数 === null ? '请选择' : `${年薪月数} 薪`}</span>
              <span className={样式.尖括号}>›</span>
            </span>
          </button>
        ) : null}
        {/* 薪资承诺:原「AI 初筛条件确认」卡里唯一有信息量的一句,
            卡随 2026-08-26 标注删除后降格为薪资字段下的一行小字 */}
        <div className={样式.薪资小注}>薪资仅判断双方区间是否匹配，不询问或协商具体金额。</div>

        <div className={样式.编辑条目}>
          <div className={样式.条目标签}>
            工作城市{编辑态 ? <span className={样式.锁标}>发布后不可改</span> : null}
            {/* Task 7：Backend 城市必须从候选选；已选时在标签右侧标一个轻提示 */}
            {是后端 && !编辑态 && 地点引用 ? <span className={样式.锁标}>已选</span> : null}
          </div>
          <input
            className={样式.条目输入}
            value={工作城市}
            placeholder={是后端 ? '搜索城市名，从下方候选选择' : '如：上海'}
            readOnly={编辑态}
            onClick={编辑态 ? 提示不可改 : undefined}
            onChange={(事件) => 设工作城市(事件.target.value)}
          />
          {/* Task 7：Backend 工作城市候选行 —— 复用 快捷片 样式，点候选原子写入 工作城市 + 地点引用。
              Mock 分支无候选行（自由文本）。继续输入清掉 地点引用，未选候选时发布会被 拦截。 */}
          {是后端 && !编辑态 && 工作城市.trim() !== '' && !地点引用 ? (
            <div className={样式.快捷片行}>
              {城市搜索中 ? <span className={样式.条件空提示}>搜索中…</span> : null}
              {城市候选.map((项) => (
                <button
                  key={项.id}
                  className={`${样式.快捷片} 可点`}
                  onClick={() => 选城市候选(项)}
                >
                  {项.display_name}
                </button>
              ))}
              {!城市搜索中 && 城市候选.length === 0 ? (
                <span className={样式.条件空提示}>没有匹配的城市，换个词试试。</span>
              ) : null}
              {/* review-r2 R2-M-1：搜索返回 nextCursor 时显示「加载更多」 */}
              {城市下一页 !== null ? (
                <button className={`${样式.快捷片} 可点`} onClick={城市加载更多} disabled={城市加载中}>
                  {城市加载中 ? '加载中…' : '加载更多'}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* 办公地点到楼宇级：候选人要据此判断通勤，只给城市不够用。 */}
        <div className={样式.编辑条目}>
          <div className={样式.条目标签}>办公地点</div>
          <input
            className={样式.条目输入}
            value={办公地}
            placeholder="如：浦东新区世纪大道 1568 号中建大厦 28 层"
            onChange={(事件) => 设办公地(事件.target.value)}
          />
        </div>

      </div>

      {/* P0 修复 Task 4：恢复独立的职位要求输入 —— BFF 的 requirements 是必填且
          不能由 description 顶替（页面/操作/映射三层各挡一道） */}
      <div className={样式.要求文标}>给候选人看的职位要求（补充文字，不自动解析为硬门槛）</div>
      <div className={样式.描述卡}>
        <textarea
          className={样式.描述输入}
          value={职位要求}
          onChange={(事件) => 设职位要求(事件.target.value)}
          placeholder="请填写候选人需要具备的经验、能力与条件"
          maxLength={5000}
          aria-label="给候选人看的职位要求（补充文字，不自动解析为硬门槛）"
        />
        <div className={样式.描述底}>
          <span className={`${样式.描述计数} 等宽数字`}>{职位要求.length} / 5000</span>
        </div>
      </div>

      {/* 「AI 初筛条件确认」卡按标注 2026-08-26 删除:chips 全为同页表单复述;
          唯一有信息量的薪资承诺句已降格为薪资区的小字 */}

      <div className={样式.硬性区}>
        {/* 四问硬性事实钮按标注 2026-08-26 删除(数据合同保留,见文件顶部说明);
            存量手动硬性条只在有值时展示,不再有常驻「硬性条件」节 */}
        {存量硬性条件.length > 0 ? (
          <>
            <div className={样式.条目标签}>硬性条件</div>
            <div className={样式.已选片行}>
              {存量硬性条件.map((条) => (
                <span key={条} className={样式.存量片}>{条}</span>
              ))}
            </div>
          </>
        ) : null}

        {/* 自由文本只做偏好排序，不能作为自动淘汰条件。 */}
        <div className={样式.筛选要求标}>
          {/* 「只影响排序…」小字已删(用户 2026-08-31 定稿:标题直接贴输入框) */}
          <span className={样式.筛选要求题}>补充加分偏好（可选）</span>
        </div>
        <textarea
          className={样式.筛选要求输入}
          value={筛选要求}
          placeholder="例如：985/211 或指定院校优先、有大厂或创业公司经历、重点看系统设计能力"
          rows={3}
          maxLength={200}
          onChange={(事件) => 设筛选要求(事件.target.value)}
        />
        {/* 已选加分片随加分项选择器一起删（2026-08-24） */}
      </div>

      {/* 发布即同意（BOSS 合规行）：编辑态不重复展示 */}
      {!编辑态 ? (
        <div className={样式.同意行}>
          发布岗位即表示同意遵守
          <button className={`${样式.同意链接} 可点`} onClick={() => 跳转(路径.用户协议)}>
            《工作蜂招聘行为规范》
          </button>
          ，违规将可能导致岗位下架与账号锁定。
        </div>
      ) : null}

      {/* 计薪轮：日薪 / 时薪。步长 10 —— 标注 2026-08-22「这个根据一次 10 块来加，
          而不是现在的 1 块」。按 1 递增时 50→800 有 751 档，滚到目标价要划半天。 */}
      {计薪轮 ? (
        <数字滚轮层
          标题={薪资单位(当前类型) === '元/天' ? '日薪' : '时薪'}
          初值={Number(计薪轮 === '下限' ? 薪资下限 : 薪资上限) || (薪资单位(当前类型) === '元/天' ? 200 : 40)}
          最小={薪资单位(当前类型) === '元/天' ? 50 : 20}
          最大={薪资单位(当前类型) === '元/天' ? 800 : 200}
          单位={薪资单位(当前类型) === '元/天' ? '元/天' : '元/时'}
          步长={10}
          确认={(值) => {
            if (计薪轮 === '下限') 设薪资下限(String(值));
            else 设薪资上限(String(值));
            设计薪轮(null);
          }}
          取消={() => 设计薪轮(null)}
        />
      ) : null}

      {月数轮 ? (
        <数字滚轮层
          标题="年薪月数"
          初值={年薪月数 ?? 12}
          最小={12}
          最大={36}
          单位="薪"
          确认={(值) => {
            设年薪月数(值);
            设月数轮(false);
          }}
          取消={() => 设月数轮(false)}
        />
      ) : null}

    </滚动区>
  );
}
