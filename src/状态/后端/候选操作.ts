// 后端候选域操作：简历 / 个人优势 / 意向 / 首次意向 / 删除意向 的写入。
// 从 应用状态提供者 的 useMemo 操作体按真实后端 owner 拆出，行为逐字保持：
// 写锁 / 409 权威水合 / 503 重读 / 401 统一清理 / revision 全部原样。接口失败绝不回退 Mock。
//
// J-PILOT-02 Task 3：当前 active 建档草稿在场时，保存简历/保存个人优势 接 建档写入跟踪 ——
// 先按闭合种类结算未结算单槽（received 直落身份、创建经原方法原 key 重放、CAS 权威 GET 只读核对），
// 再按已存身份映射本地编号、hydrate 缺项原样带回（条目 DELETE 只消费 明确删除条目 登记），
// 经数据源跟踪写入；锁冲突抛明确 busy 错误（不再 return 假成功）；响应/水合/草稿写都过
// 主体+会话代际栅栏。无草稿时原路径行为不变。

import { BFF错误 } from '../../数据/HTTP客户端';
import { 从BFF简历 } from '../../数据/后端映射';
import type { BFF简历 } from '../../数据/BFF契约';
import type {
  页面简历快照, 页面意向快照, 页面简历写入,
  建档待写入, 建档写入跟踪, 建档写入回执, 建档待写入种类,
} from '../../数据/招聘数据源类型';
import type { 候选引导建档草稿, 建档已存条目 } from '../../数据/资料缓存';
import type { 简历经历段, 简历教育段, 简历证书 } from '../../数据/类型';
import type { BFF候选账号档案 } from '../../数据/招聘数据源/候选账号';
import type { 后端操作依赖, 候选操作 } from './类型';
import { 清账号状态 } from './会话操作';
import { 轻提示 } from '../../组件/轻提示';

/** 意向草稿 → 求职意向.说明 文案（Mock 分支用，与 添加意向.tsx 提交 的说明格式保持一致）。 */
function 意向说明(draft: import('../../数据/招聘数据源类型').意向草稿型): string {
  const 单位 = draft.薪资周期 === 'hour' ? ' 元/时' : draft.薪资周期 === 'day' || draft.求职类型 === '实习生' ? ' 元/天' : 'K';
  const 薪资文本 =
    draft.薪资下限 === null || draft.薪资上限 === null
      ? ''
      : draft.薪资下限 === draft.薪资上限
        ? `${draft.薪资下限}${单位}`
        : `${draft.薪资下限}-${draft.薪资上限}${单位}`;
  const 期望行业文本 = draft.期望行业们.join('、');
  return 期望行业文本 === '' ? 薪资文本 : `${薪资文本}｜${期望行业文本}`;
}

// ── J-PILOT-02 Task 3：简历域建档命令的闭合种类与结算辅助（纯函数，无 React 依赖） ──

/** 简历域会产生的全部待写入种类；其它域（意向/头像/文件）槽由各自 Task 接线，此处不结算不覆盖。 */
const 简历命令种类们: readonly 建档待写入种类[] = [
  'profile', 'summary', 'skills',
  'experience-create', 'experience-update', 'experience-delete',
  'project-create', 'project-update', 'project-delete',
  'education-create', 'education-update', 'education-delete',
  'certificate-create', 'certificate-update', 'certificate-delete',
];

function 是简历命令(种类: 建档待写入种类): boolean {
  return 简历命令种类们.includes(种类);
}

/** 命令的条目种类；单例分区（profile/summary/skills）返回 null。 */
function 命令条目种类(种类: 建档待写入种类): 'experience' | 'project' | 'education' | 'certificate' | null {
  if (种类.startsWith('experience-')) return 'experience';
  if (种类.startsWith('project-')) return 'project';
  if (种类.startsWith('education-')) return 'education';
  if (种类.startsWith('certificate-')) return 'certificate';
  return null;
}

/** 命令动作：create/update/delete；单例分区返回 null。 */
function 命令动作(种类: 建档待写入种类): 'create' | 'update' | 'delete' | null {
  if (种类.endsWith('-create')) return 'create';
  if (种类.endsWith('-update')) return 'update';
  if (种类.endsWith('-delete')) return 'delete';
  return null;
}

/**
 * 同一逻辑命令判定：除 幂等键/阶段/回执 外的坐标一致 = 同一条命令。
 * 幂等键不参与比较 —— 重试方不带键也能命中原槽，创建复用原 key（Global 6）。
 * 请求体 用 JSON 序列化比较：本域全部命令体都由固定映射器（转教育写入 等）按字面键序构造，
 * session 落盘往返（JSON.parse 保序）不改变键序，序列化比较稳定，无需再做结构化归一。
 */
function 同一命令(a: 建档待写入, b: 建档待写入): boolean {
  return a.种类 === b.种类
    && (a.本地编号 ?? null) === (b.本地编号 ?? null)
    && (a.资源编号 ?? null) === (b.资源编号 ?? null)
    && (a.父编号 ?? null) === (b.父编号 ?? null)
    && (a.ifMatch ?? null) === (b.ifMatch ?? null)
    && JSON.stringify(a.请求体 ?? null) === JSON.stringify(b.请求体 ?? null);
}

/** 服务端确定拒绝：本地/远端已确定失败的 BFF 错误。409 冲突、503 未知、网络断开保留待核对。 */
function 是确定拒绝(错误: unknown): boolean {
  return 错误 instanceof BFF错误
    && 错误.status !== 401
    && 错误.status !== 409
    && !(错误.status === 503 && 错误.code === 'operation_outcome_unknown')
    && 错误.code !== 'network_error';
}

/** 把回执身份落进草稿：条目写 已存条目（项目带父编号）并替换 资料 同编号条目；单例写 已存分区。 */
function 落已存身份(建档: 候选引导建档草稿, 命令: 建档待写入, 回执: 建档写入回执): 候选引导建档草稿 {
  const 下一步: 候选引导建档草稿 = { ...建档 };
  const 条目种类 = 命令条目种类(命令.种类);
  if (条目种类 === null) {
    // 单例分区：profile/summary/skills 的 revision 写 已存分区
    if (回执.revision !== undefined) {
      下一步.已存分区 = { ...建档.已存分区, [命令.种类]: 回执.revision };
    }
    return 下一步;
  }
  const 动作 = 命令动作(命令.种类)!;
  if (动作 === 'create') {
    if (命令.本地编号 !== undefined && 回执.id !== undefined) {
      const 新身份: 建档已存条目 = {
        本地编号: 命令.本地编号,
        种类: 条目种类,
        资源编号: 回执.id,
        revision: 回执.revision ?? 0,
      };
      if (命令.父编号 !== undefined) 新身份.父编号 = 命令.父编号;
      下一步.已存条目 = [...(建档.已存条目 ?? []), 新身份];
      下一步.资料 = 替换资料条目编号(建档.资料, 条目种类, 命令.本地编号, 回执.id, 命令.父编号);
    }
    return 下一步;
  }
  if (动作 === 'update') {
    if (回执.revision !== undefined) {
      const 新revision = 回执.revision;
      下一步.已存条目 = (建档.已存条目 ?? []).map((e) =>
        e.资源编号 === 命令.资源编号 ? { ...e, revision: 新revision } : e);
    }
    return 下一步;
  }
  // delete：移除对应已存身份与明确删除登记
  下一步.已存条目 = (建档.已存条目 ?? []).filter((e) => !(e.种类 === 条目种类 && e.资源编号 === 命令.资源编号));
  下一步.明确删除条目 = (建档.明确删除条目 ?? []).filter((r) => !(r.种类 === 条目种类 && r.资源编号 === 命令.资源编号));
  return 下一步;
}

/** 已收创建回执后，把草稿 资料 里该本地编号条目的编号替换为服务器编号（刷新后映射不再重复 POST）。 */
function 替换资料条目编号(
  资料: 候选引导建档草稿['资料'],
  条目种类: 'experience' | 'project' | 'education' | 'certificate',
  本地编号: string,
  资源编号: string,
  父编号?: string,
): 候选引导建档草稿['资料'] {
  if (资料 === undefined) return 资料;
  const 下一步 = { ...资料 };
  if (条目种类 === 'experience' && 资料.经历 !== undefined) {
    下一步.经历 = 资料.经历.map((段) => 段.编号 === 本地编号 ? { ...段, 编号: 资源编号 } : 段);
  } else if (条目种类 === 'education' && 资料.教育 !== undefined) {
    下一步.教育 = 资料.教育.map((段) => 段.编号 === 本地编号 ? { ...段, 编号: 资源编号 } : 段);
  } else if (条目种类 === 'certificate' && 资料.证书 !== undefined) {
    下一步.证书 = 资料.证书.map((段) => 段.编号 === 本地编号 ? { ...段, 编号: 资源编号 } : 段);
  } else if (条目种类 === 'project' && 资料.经历 !== undefined) {
    下一步.经历 = 资料.经历.map((段) => {
      if (段.编号 !== 父编号 || 段.项目 === undefined || !段.项目.some((p) => p.编号 === 本地编号)) return 段;
      return { ...段, 项目: 段.项目.map((p) => p.编号 === 本地编号 ? { ...p, 编号: 资源编号 } : p) };
    });
  }
  return 下一步;
}

type 核对结果 =
  | { kind: '一致'; revision?: number }
  | { kind: '已删除' }
  | { kind: '未生效' }
  | { kind: '冲突' };

/**
 * CAS 只读核对（Global 6：不换 revision 盲重试）：GET 权威快照后只比较本命令请求体写到的
 * 目标字段 —— 全部相同（写已生效）或目标已删除才结算；删除未落地为 未生效（登记仍在，
 * 主保存按新 revision 重新 DELETE）；其余为冲突，保留用户编辑由调用方报错。
 */
function 只读核对目标(权威: BFF简历, 槽: 建档待写入): 核对结果 {
  const b = (槽.请求体 ?? {}) as Record<string, unknown>;
  const 键值一致 = (实际: unknown, 期望: unknown) => JSON.stringify(实际 ?? null) === JSON.stringify(期望 ?? null);
  const 每键一致 = (实际: Record<string, unknown>) => Object.keys(b).every((键) => 键值一致(实际[键], b[键]));
  switch (槽.种类) {
    case 'profile': {
      const 一致 = 每键一致(权威.profile as unknown as Record<string, unknown>);
      return 一致 ? { kind: '一致', revision: 权威.profile_revision } : { kind: '冲突' };
    }
    case 'summary':
      return 键值一致(权威.summary, b.value)
        ? { kind: '一致', revision: 权威.summary_revision }
        : { kind: '冲突' };
    case 'skills':
      return JSON.stringify(权威.skills) === JSON.stringify(b.skills ?? [])
        ? { kind: '一致', revision: 权威.skills_revision }
        : { kind: '冲突' };
    case 'experience-update': {
      const 条目 = 权威.experiences.find((e) => e.id === 槽.资源编号);
      if (条目 === undefined) return { kind: '已删除' };
      const 一致 = 每键一致({
        company: 条目.company,
        industry_id: 条目.industry.id,
        title: 条目.title,
        start_month: 条目.start_month,
        end_month: 条目.end_month,
        description: 条目.description,
        hidden: 条目.hidden,
        internship: 条目.internship,
      });
      return 一致 ? { kind: '一致', revision: 条目.revision } : { kind: '冲突' };
    }
    case 'project-update': {
      const 项目 = 权威.experiences.find((e) => e.id === 槽.父编号)?.projects?.find((p) => p.id === 槽.资源编号);
      if (项目 === undefined) return { kind: '已删除' };
      const 一致 = 每键一致({ name: 项目.name, role: 项目.role, result: 项目.result });
      return 一致 ? { kind: '一致', revision: 项目.revision } : { kind: '冲突' };
    }
    case 'education-update': {
      const 条目 = 权威.educations.find((e) => e.id === 槽.资源编号);
      if (条目 === undefined) return { kind: '已删除' };
      const 一致 = 每键一致({
        institution_id: 条目.institution.id,
        degree: 条目.degree,
        major_id: 条目.major.id,
        start_month: 条目.start_month,
        end_month: 条目.end_month,
      });
      return 一致 ? { kind: '一致', revision: 条目.revision } : { kind: '冲突' };
    }
    case 'certificate-update': {
      const 条目 = 权威.certificates.find((c) => c.id === 槽.资源编号);
      if (条目 === undefined) return { kind: '已删除' };
      const 一致 = 每键一致({ name: 条目.name, year: 条目.year });
      return 一致 ? { kind: '一致', revision: 条目.revision } : { kind: '冲突' };
    }
    case 'experience-delete': {
      const 条目 = 权威.experiences.find((e) => e.id === 槽.资源编号);
      return 条目 === undefined ? { kind: '已删除' } : { kind: '未生效' };
    }
    case 'project-delete': {
      const 项目 = 权威.experiences.find((e) => e.id === 槽.父编号)?.projects?.find((p) => p.id === 槽.资源编号);
      return 项目 === undefined ? { kind: '已删除' } : { kind: '未生效' };
    }
    case 'education-delete': {
      const 条目 = 权威.educations.find((e) => e.id === 槽.资源编号);
      return 条目 === undefined ? { kind: '已删除' } : { kind: '未生效' };
    }
    case 'certificate-delete': {
      const 条目 = 权威.certificates.find((c) => c.id === 槽.资源编号);
      return 条目 === undefined ? { kind: '已删除' } : { kind: '未生效' };
    }
    default:
      return { kind: '冲突' };
  }
}

/**
 * prepared 创建槽的重放基底：把槽里的原请求体反构造回页面条目（显示名用目录 id 占位 ——
 * 重放只经 转教育写入/转经历写入 等映射器取 引用.id 重建同一 body，不参与任何 diff 比较），
 * 让同一域原方法 保存简历 物化出与原命令完全一致的步骤；发送前 会按同命令复用原幂等键。
 * 槽坐标无法安全重建（如项目槽的父经历不在权威快照）时返回 null，保留待核对。
 */
function 从槽重建页面(基底: 页面简历写入, 槽: 建档待写入): 页面简历写入 | null {
  const body = (槽.请求体 ?? {}) as Record<string, unknown>;
  const 编号 = 槽.本地编号 ?? '';
  const 串 = (键: string) => String(body[键] ?? '');
  switch (槽.种类) {
    case 'education-create':
      return {
        ...基底,
        教育: [...基底.教育, {
          编号,
          学校: 串('institution_id'),
          学校引用: { id: 串('institution_id'), display_name: 串('institution_id') },
          学历: 串('degree'),
          专业: 串('major_id'),
          专业引用: { id: 串('major_id'), display_name: 串('major_id') },
          开始: 串('start_month'),
          结束: body.end_month === null || body.end_month === undefined ? '' : 串('end_month'),
        } satisfies 简历教育段],
      };
    case 'experience-create':
      return {
        ...基底,
        经历: [...基底.经历, {
          编号,
          公司: 串('company'),
          行业: 串('industry_id'),
          行业引用: { id: 串('industry_id'), display_name: 串('industry_id') },
          职位: 串('title'),
          开始: 串('start_month'),
          结束: body.end_month === undefined ? null : (body.end_month as string | null),
          内容: 串('description'),
          隐藏: body.hidden === undefined ? false : Boolean(body.hidden),
          ...(body.internship !== undefined ? { 实习: Boolean(body.internship) } : {}),
        } satisfies 简历经历段],
      };
    case 'certificate-create':
      return {
        ...基底,
        证书: [...基底.证书, {
          编号,
          名称: 串('name'),
          年份: body.year === null || body.year === undefined ? '' : String(body.year),
        } satisfies 简历证书],
      };
    case 'project-create': {
      const 父编号 = 槽.父编号 ?? '';
      const 父序 = 基底.经历.findIndex((段) => 段.编号 === 父编号);
      if (父序 < 0) return null;
      const 父段 = 基底.经历[父序];
      const 经历们 = [...基底.经历];
      经历们[父序] = {
        ...父段,
        项目: [...(父段.项目 ?? []), {
          编号,
          名称: 串('name'),
          角色: 串('role'),
          结果: 串('result'),
        }],
      };
      return { ...基底, 经历: 经历们 };
    }
    default:
      return null;
  }
}

export function 创建候选操作(deps: 后端操作依赖): 候选操作 {
  const { 是后端, 后端, 派发, 设后端状态, 后端状态引用, 状态引用, 锁, 主体标识引用, 会话代际 } = deps;
  // Provider 恒注入：意向权威快照统一经它提交（栅栏 + 持久化写屏障）；缺席即接线缺陷。
  if (deps.提交候选意向快照 === undefined) {
    throw new Error('提交候选意向快照 未初始化（Provider 必须一次性注入）');
  }
  // 显式非可选标注：hoisted function 声明里也读得到收窄后的类型
  const 提交候选意向快照: NonNullable<后端操作依赖['提交候选意向快照']> = deps.提交候选意向快照;
  /** 意向写操作统一的快照提交：捕获栅栏取发起时刻的主体/代际，不在结算时重取。 */
  const 提交意向快照 = (快照: 页面意向快照, subjectId: string | null, sessionGeneration: number) => {
    if (subjectId === null) return;
    提交候选意向快照({ 快照, subjectId, sessionGeneration });
  };
  // P4 Task 3 fix：三个 P4 引用随行 —— 简历/意向 401 的统一清理同样清 discovery 双 Map 与可见范围
  // codex review-r1 P2：候选预填引用同样随行 —— 否则本域 401 只摊平内存轮，outgoing subject
  // 的恢复元数据无人删，登出解绑适配器后旧 session key 跨登出残留（同账号重登复活旧轮）。
  const 账号清理依赖 = {
    派发, 设后端状态, 后端, 主体标识引用, 会话代际,
    P4范围代际: deps.P4范围代际, P4幂等意图: deps.P4幂等意图, P4可见范围: deps.P4可见范围,
    候选预填代际: deps.候选预填代际, 候选预填读取锁: deps.候选预填读取锁, 候选预填恢复: deps.候选预填恢复,
  };

  const 提交候选账号档案 = (档案: BFF候选账号档案) => {
    const 图 = 档案.avatar_url === null ? null : `${档案.avatar_url}?v=${档案.revision}`;
    派发({ 型: '存求职头像', 图 });
  };

  async function 重读候选账号档案(): Promise<BFF候选账号档案> {
    const 档案 = await 后端!.读取候选账号档案();
    提交候选账号档案(档案);
    return 档案;
  }

  /**
   * 统一处理写操作错误：401 清会话；409 用错误携带的权威简历水合；其余原样抛出。
   * Task 3：401 清理与权威水合都过发起时刻的主体/会话代际栅栏 —— 迟到旧会话的 401
   * 不清新会话，迟到水合不污染新主体。
   */
  function 处理写入错误(错误: unknown, 本次主体: string | null, 本次代际: number): never {
    const 栅栏仍立 = 主体标识引用.current === 本次主体 && 会话代际.current === 本次代际;
    if (错误 instanceof BFF错误 && 栅栏仍立) {
      if (错误.status === 401) {
        // review-r3 R3-I-2：401 收口到 清账号状态，三个支持域 + 草稿 + 目录缓存一起清
        清账号状态(账号清理依赖);
      } else if (错误.权威简历) {
        // 409 版本冲突或任一分区写入中途失败后，catch 路径已 GET 权威快照附在错误上。
        // 统一用它水合本地状态，使重试 diff 基于服务端最新值（避免重复 POST 新条目）。
        // 权威简历 是 BFF简历（生产 HTTP 层 GET 拿到的 DTO）；
        // 测试桩可能直接放已映射的 页面简历快照。两者按 'profile' 字段区分。
        const 权威 = 错误.权威简历;
        const 是原始DTO = 'profile' in 权威;
        const 页面 = 是原始DTO ? 从BFF简历(权威 as never) : 权威 as unknown as 页面简历快照;
        水合简历并保留空身份草稿(页面);
        设后端状态((旧) => ({ ...旧, 简历快照: 是原始DTO ? (权威 as never) : 旧.简历快照 }));
      }
    }
    throw 错误;
  }

  /**
   * M：权威水合不得擦掉未提交的空身份 profile 草稿（/basic 的姓名/生日等）。
   * 身份为 '' 时先记下本地基本草稿，派发 水合后端简历 后补一条 存简历 ——
   * 基本信息 取本地草稿，经历/教育/技能/证书取权威快照；身份已明确时不补派发。
   */
  function 水合简历并保留空身份草稿(
    快照: 页面简历快照,
    本地基本 = 状态引用.current.基本信息,
  ): void {
    const 空身份草稿 = 本地基本.身份 === '' ? 本地基本 : null;
    派发({ 型: '水合后端简历', 快照 });
    if (!空身份草稿) return;
    派发({
      型: '存简历',
      经历: 快照.经历,
      教育: 快照.教育,
      技能: 快照.技能,
      证书: 快照.证书,
      基本信息: 空身份草稿,
    });
  }

  // ── J-PILOT-02 Task 3：建档草稿同步写（与 更新候选建档草稿 同序：内存 ref → 尝试 session → 派发）──

  /** 同步固定内存 ref → 尝试写 subject-scoped session（失败仅轻提示刷新风险）→ 派发。 */
  const 写建档草稿 = (建档: 候选引导建档草稿): void => {
    if (deps.建档草稿引用) deps.建档草稿引用.current = 建档;
    const 存储 = deps.候选建档草稿?.current ?? null;
    if (存储 !== null && !存储.写入(建档)) {
      轻提示('本次无法保存恢复进度，刷新可能丢失');
    }
    派发({ 型: '更新候选建档草稿', 建档 });
  };

  const 取消槽 = (建档: 候选引导建档草稿): 候选引导建档草稿 => {
    const { 待写入: _已清, ...无槽 } = 建档;
    return 无槽;
  };

  /**
   * 本旅程的跟踪实现（Global 5）：
   * - 发送前：单槽守卫（未结算 prepared 槽不被另一条命令覆盖 —— 同一逻辑命令推进/重试放行，
   *   创建复用原幂等键）；新键只为 create 种类铸造（CAS 走 ifMatch，无幂等合同）。
   * - 已确认：先同步把身份落进 已存条目/已存分区 并替换 资料 条目编号，再清槽，一次草稿写完成；
   *   之后才继续下一步或 GET。
   * 主体/会话代际栅栏破防后两者都只读返回，不写新主体草稿。
   */
  function 构造跟踪(本次主体: string | null, 本次代际: number): {
    跟踪: 建档写入跟踪;
    栅栏仍立: () => boolean;
    取本槽命令: () => 建档待写入 | null;
  } {
    const 栅栏仍立 = () => 主体标识引用.current === 本次主体 && 会话代际.current === 本次代际;
    let 本槽命令: 建档待写入 | null = null;
    const 跟踪: 建档写入跟踪 = {
      发送前(命令) {
        const 现有 = deps.建档草稿引用?.current ?? null;
        if (!栅栏仍立() || 现有 === null) {
          // 栅栏破防（迟到写）或草稿已不在场（登出清理）：不落盘，请求由数据源照发、结果由栅栏丢弃
          return 命令;
        }
        const 槽 = 现有.待写入;
        if (槽 !== undefined && 槽.阶段 === 'prepared' && !同一命令(槽, 命令)) {
          // Global 6：一个槽未结算时禁止另一 mutation 覆盖 —— 先按闭合种类结算原命令再算下一步
          throw new Error('上一条写入结果未确认，请先重试或核对原步骤');
        }
        const 复用键 = 槽 !== undefined && 同一命令(槽, 命令) ? 槽.幂等键 : undefined;
        const 键 = 复用键 ?? 命令.幂等键
          ?? (命令动作(命令.种类) === 'create' ? globalThis.crypto.randomUUID() : undefined);
        const 定: 建档待写入 = { ...命令, ...(键 !== undefined ? { 幂等键: 键 } : {}), 阶段: 'prepared' };
        写建档草稿({ ...现有, 待写入: 定 });
        本槽命令 = 定;
        return 定;
      },
      已确认(命令, 回执) {
        if (!栅栏仍立()) return;
        const 现有 = deps.建档草稿引用?.current ?? null;
        if (现有 === null) return;
        let 下一步 = 落已存身份(现有, 命令, 回执);
        if (下一步.待写入 !== undefined && 同一命令(下一步.待写入, 命令)) {
          下一步 = 取消槽(下一步);
        }
        写建档草稿(下一步);
      },
    };
    return { 跟踪, 栅栏仍立, 取本槽命令: () => 本槽命令 };
  }

  /**
   * 结算未结算单槽（closed kinds，Global 6）：
   * - received（回执在手）：直接把身份落进草稿并清槽，零请求。
   * - prepared 创建：权威重读做基底，按槽的原请求体经同一域原方法（保存简历）重放，
   *   发送前 按同命令复用原幂等键，取得回执后 已确认 自动落身份清槽。
   * - prepared CAS（单例/条目 update/delete）：权威 GET 只读核对目标字段，绝不换 revision 盲重试；
   *   冲突清槽（GET 已给出终局判定，防止确定拒绝永远锁死单槽）、保留用户编辑并由调用方报错。
   * 非 resume 域槽不在此结算也不覆盖（首个 resume 命令会被 发送前 守卫拦下）。
   * 返回结算后应使用的权威 previous。
   */
  async function 结算单槽(
    previous: BFF简历,
    跟踪: 建档写入跟踪,
    本次主体: string | null,
    本次代际: number,
  ): Promise<BFF简历> {
    const 建档 = deps.建档草稿引用?.current ?? null;
    const 槽 = 建档?.待写入;
    if (建档 === null || 槽 === undefined || !是简历命令(槽.种类)) return previous;
    if (槽.阶段 === 'received') {
      写建档草稿(取消槽(落已存身份(建档, 槽, 槽.回执 ?? {})));
      return previous;
    }
    const 栅栏仍立 = () => 主体标识引用.current === 本次主体 && 会话代际.current === 本次代际;
    // prepared：先权威重读（CAS 核对基准 / 重放基底；不用旧缓存防整段误删）
    const 读出 = await 后端!.读取简历();
    const 权威 = 读出.服务端快照;
    const 条目种类 = 命令条目种类(槽.种类);
    const 动作 = 命令动作(槽.种类);
    if (动作 === 'create' && 条目种类 !== null) {
      const { 作品集链接: _省略, ...基底 } = 从BFF简历(权威);
      const 结算next = 从槽重建页面(基底, 槽);
      if (结算next === null) {
        throw new Error('上一条写入结果未确认，无法安全重放，请先核对原步骤');
      }
      const 结算快照 = await 后端!.保存简历(结算next, 权威, 跟踪);
      if (栅栏仍立()) 设后端状态((旧) => ({ ...旧, 简历快照: 结算快照.服务端快照 }));
      return 结算快照.服务端快照;
    }
    const 结果 = 只读核对目标(权威, 槽);
    if (结果.kind === '冲突') {
      const 现有 = deps.建档草稿引用?.current ?? 建档;
      写建档草稿(取消槽(现有));
      throw new BFF错误(409, 'version_conflict', '数据已在其他地方更新，请重试');
    }
    let 下一步 = deps.建档草稿引用?.current ?? 建档;
    if (结果.kind === '一致') {
      下一步 = 落已存身份(下一步, 槽, 结果.revision !== undefined ? { revision: 结果.revision } : {});
    } else if (结果.kind === '已删除' && 动作 === 'update') {
      // 目标已被删除：结算并移除已存身份；用户编辑仍在草稿，下次保存按新条目重建
      下一步 = {
        ...下一步,
        已存条目: (下一步.已存条目 ?? []).filter((e) => e.资源编号 !== 槽.资源编号),
      };
    } else if (结果.kind === '已删除' && 动作 === 'delete') {
      // 删除已生效：移除登记与已存身份
      下一步 = 落已存身份(下一步, 槽, {});
    }
    // '未生效'（删除未落地）：清槽即可，明确删除登记仍在 → 主保存按新 revision 重新 DELETE
    写建档草稿(取消槽(下一步));
    if (栅栏仍立()) 设后端状态((旧) => ({ ...旧, 简历快照: 权威 }));
    return 权威;
  }

  /** 已存身份缺于 previous 时权威重读 —— 不能以旧 previous 缺条目判定为新建（防重复 POST）。 */
  async function 确保身份在快照(建档: 候选引导建档草稿, previous: BFF简历): Promise<BFF简历> {
    const 已知 = new Set((建档.已存条目 ?? []).map((e) => e.资源编号));
    if (已知.size === 0) return previous;
    const 在场 = (id: string): boolean =>
      previous.experiences.some((e) => e.id === id || (e.projects ?? []).some((p) => p.id === id))
      || previous.educations.some((e) => e.id === id)
      || previous.certificates.some((c) => c.id === id);
    for (const id of 已知) {
      if (!在场(id)) return (await 后端!.读取简历()).服务端快照;
    }
    return previous;
  }

  /**
   * 按已存身份把 next 的本地编号映射为服务器编号（含嵌套项目），并把权威快照里有、
   * next 缺席且未登记 明确删除条目 的条目原样带回 —— hydrate/恢复缺项不得被 diff 成 DELETE
   * （条目 DELETE 只消费用户明确删除动作登记的 明确删除条目；非 onboarding 保存不走这里，
   * 保留原 diff 删除语义）。
   */
  function 准备写入(next: 页面简历写入, 权威页: 页面简历快照, 建档: 候选引导建档草稿): 页面简历写入 {
    const 身份表 = new Map<string, 建档已存条目>();
    for (const e of 建档.已存条目 ?? []) 身份表.set(`${e.种类}:${e.本地编号}`, e);
    const 明确删除 = new Set((建档.明确删除条目 ?? []).map((r) => `${r.种类}:${r.资源编号}`));

    const 经历 = next.经历.map((段) => {
      const 映射 = 身份表.get(`experience:${段.编号}`);
      const 新段: 简历经历段 = 映射 !== undefined ? { ...段, 编号: 映射.资源编号 } : { ...段 };
      if (新段.项目 !== undefined) {
        新段.项目 = 新段.项目.map((项目) => {
          const 项目映射 = 身份表.get(`project:${项目.编号}`);
          // 项目的已存身份带父编号：只在父经历已映射为同一服务器经历时才替换
          if (项目映射 !== undefined && 项目映射.父编号 === 新段.编号) {
            return { ...项目, 编号: 项目映射.资源编号 };
          }
          return { ...项目 };
        });
      }
      return 新段;
    });
    // 嵌套项目缺项保护：权威项目不在段内且未登记明确删除 → 原样带回（否则 diff 会发 DELETE）
    for (let 序 = 0; 序 < 经历.length; 序 += 1) {
      const 段 = 经历[序];
      const 旧段 = 权威页.经历.find((e) => e.编号 === 段.编号);
      if (旧段 === undefined) continue;
      const 现有项目 = new Set((段.项目 ?? []).map((p) => p.编号));
      const 补回 = (旧段.项目 ?? []).filter((p) => !现有项目.has(p.编号) && !明确删除.has(`project:${p.编号}`));
      if (补回.length > 0) 经历[序] = { ...段, 项目: [...(段.项目 ?? []), ...补回] };
    }
    const 经历ids = new Set(经历.map((段) => 段.编号));
    for (const 旧 of 权威页.经历) {
      if (!经历ids.has(旧.编号) && !明确删除.has(`experience:${旧.编号}`)) 经历.push(旧);
    }

    const 教育 = next.教育.map((段) => {
      const 映射 = 身份表.get(`education:${段.编号}`);
      return 映射 !== undefined ? { ...段, 编号: 映射.资源编号 } : { ...段 };
    });
    const 教育ids = new Set(教育.map((段) => 段.编号));
    for (const 旧 of 权威页.教育) {
      if (!教育ids.has(旧.编号) && !明确删除.has(`education:${旧.编号}`)) 教育.push(旧);
    }

    const 证书 = next.证书.map((段) => {
      const 映射 = 身份表.get(`certificate:${段.编号}`);
      return 映射 !== undefined ? { ...段, 编号: 映射.资源编号 } : { ...段 };
    });
    const 证书ids = new Set(证书.map((段) => 段.编号));
    for (const 旧 of 权威页.证书) {
      if (!证书ids.has(旧.编号) && !明确删除.has(`certificate:${旧.编号}`)) 证书.push(旧);
    }

    return { ...next, 经历, 教育, 证书 };
  }

  /**
   * 简历域保存的共享实现（保存简历 / 保存个人优势 共用）：
   * 无建档草稿走原路径；有草稿先结算单槽、按已存身份映射 + 缺项保护，经数据源跟踪写入。
   * 确定拒绝清本次未结算槽并保留表单；409/503 未知/网络断开保留待核对。
   */
  async function 简历域保存(
    next: 页面简历写入,
    本次主体: string | null,
    本次代际: number,
    水合基本 = next.基本信息,
  ): Promise<void> {
    const 栅栏仍立 = () => 主体标识引用.current === 本次主体 && 会话代际.current === 本次代际;
    let previous = 后端状态引用.current.简历快照;
    if (!previous) {
      const 读出 = await 后端!.读取简历();
      previous = 读出.服务端快照;
    }
    const 建档 = deps.建档草稿引用?.current ?? null;
    if (建档 === null) {
      // 非 onboarding：原路径（行为逐字保持）
      const 快照 = await 后端!.保存简历(next, previous);
      if (!栅栏仍立()) return;
      水合简历并保留空身份草稿(快照, 水合基本);
      设后端状态((旧) => ({ ...旧, 简历快照: 快照.服务端快照 }));
      return;
    }
    const { 跟踪, 栅栏仍立: 本轮栅栏, 取本槽命令 } = 构造跟踪(本次主体, 本次代际);
    try {
      // ① 结算未结算单槽（closed kinds）
      previous = await 结算单槽(previous, 跟踪, 本次主体, 本次代际);
      // ② 已存身份缺于 previous → 权威重读
      const 草稿 = deps.建档草稿引用?.current ?? 建档;
      previous = await 确保身份在快照(草稿, previous);
      // ③ 本地编号映射 + hydrate 缺项保护 + 明确删除门控
      const 写入 = 准备写入(next, 从BFF简历(previous), deps.建档草稿引用?.current ?? 草稿);
      // ④ 跟踪保存 + 栅栏水合
      const 快照 = await 后端!.保存简历(写入, previous, 跟踪);
      if (!本轮栅栏()) return;
      水合简历并保留空身份草稿(快照, 水合基本);
      设后端状态((旧) => ({ ...旧, 简历快照: 快照.服务端快照 }));
    } catch (错误) {
      const 槽 = deps.建档草稿引用?.current?.待写入;
      const 本槽 = 取本槽命令();
      if (槽 !== undefined && 本槽 !== null && 同一命令(槽, 本槽) && 是确定拒绝(错误)) {
        // 服务端确定拒绝：清本次未结算槽（保留表单），不把确定拒绝锁死在单槽；
        // 409/503 未知/网络断开不走这里，槽保留待核对
        const 现有 = deps.建档草稿引用?.current;
        if (现有 !== null && 现有 !== undefined) 写建档草稿(取消槽(现有));
      }
      throw 错误;
    }
  }

  /**
   * 意向写操作错误处理（镜像 处理岗位写入错误）：
   *   401 清会话（派发 空意向快照，清意向快照）；
   *   409 version_conflict / 503 operation_outcome_unknown 最终仍不确定时，调 读取意向() 重新水合，
   *     让求职意向表落回服务端最新值，避免本地乐观值覆盖冲突后的真实状态
   *     （spec §12：409 版本冲突 → 重新读取对应权威资源，不覆盖服务端新版本）；
   *   其余原样抛出。
   * 简历写操作仍走 处理写入错误（用 错误.权威简历 水合），此处不接管简历路径。
   * 不派发 Mock 意向 action（新增意向/改意向），不播种预置意向。
   */
  async function 处理意向写入错误(
    错误: unknown,
    subjectId: string | null,
    sessionGeneration: number,
  ): Promise<never> {
    if (错误 instanceof BFF错误) {
      if (错误.status === 401) {
        // review-r3 R3-I-2：意向 401 收口到 清账号状态，三个支持域 + 草稿一起清
        // （旧实现只清意向，把简历/岗位快照与引导预填留给下一个登录）
        清账号状态(账号清理依赖);
        throw 错误;
      }
      if (错误.status === 409 || 错误.status === 503) {
        const 快照 = await 后端!.读取意向();
        提交意向快照(快照, subjectId, sessionGeneration);
      }
    }
    throw 错误;
  }

  return {
    async 加载候选账号档案() {
      if (!是后端 || !后端) return;
      if (锁.current.has('候选账号档案读取')) return;
      锁.current.add('候选账号档案读取');
      const 主体 = 主体标识引用.current;
      const 代际 = 会话代际.current;
      try {
        const 档案 = await 后端.读取候选账号档案();
        if (主体标识引用.current !== 主体 || 会话代际.current !== 代际) return;
        提交候选账号档案(档案);
      } catch (错误) {
        if (错误 instanceof BFF错误 && 错误.status === 401 &&
            主体标识引用.current === 主体 && 会话代际.current === 代际) {
          清账号状态(账号清理依赖);
        }
        throw 错误;
      } finally {
        锁.current.delete('候选账号档案读取');
      }
    },
    async 保存候选头像(file) {
      if (!是后端 || !后端) return;
      if (锁.current.has('候选头像写入')) return;
      锁.current.add('候选头像写入');
      let before: BFF候选账号档案 | null = null;
      try {
        before = await 重读候选账号档案();
        const after = await 后端.替换候选头像(file, before.revision);
        提交候选账号档案(after);
      } catch (错误) {
        if (错误 instanceof BFF错误 && 错误.status === 401) {
          清账号状态(账号清理依赖);
        } else if (错误 instanceof BFF错误 &&
          ((错误.status === 409 && 错误.code === 'version_conflict') ||
           (错误.status === 503 && 错误.code === 'operation_outcome_unknown'))) {
          try {
            const current = await 重读候选账号档案();
            if (错误.status === 503 && before !== null &&
                current.revision > before.revision && current.avatar_url !== null) return;
          } catch {
            // 重读失败时保留原始写错误，避免用次生错误误导用户。
          }
        }
        throw 错误;
      } finally {
        锁.current.delete('候选头像写入');
      }
    },
    async 删除候选头像() {
      if (!是后端 || !后端) return;
      if (锁.current.has('候选头像写入')) return;
      锁.current.add('候选头像写入');
      let before: BFF候选账号档案 | null = null;
      try {
        before = await 重读候选账号档案();
        if (before.avatar_url === null) return;
        const after = await 后端.删除候选头像(before.revision);
        提交候选账号档案(after);
      } catch (错误) {
        if (错误 instanceof BFF错误 && 错误.status === 401) {
          清账号状态(账号清理依赖);
        } else if (错误 instanceof BFF错误 &&
          ((错误.status === 409 && 错误.code === 'version_conflict') ||
           (错误.status === 503 && 错误.code === 'operation_outcome_unknown'))) {
          try {
            const current = await 重读候选账号档案();
            if (错误.status === 503 && before !== null &&
                current.revision > before.revision && current.avatar_url === null) return;
          } catch {
            // 同上传：权威重读失败时仍抛原始写错误。
          }
        }
        throw 错误;
      } finally {
        锁.current.delete('候选头像写入');
      }
    },
    async 保存简历(next) {
      if (!是后端 || !后端) {
        派发({
          型: '存简历',
          经历: next.经历,
          教育: next.教育,
          技能: next.技能,
          证书: next.证书,
          基本信息: next.基本信息,
        });
        派发({ 型: '存个人优势', 文本: next.个人优势 });
        return;
      }
      // Task 3：锁冲突返回明确 busy 错误 —— 页面不推进，不再 return 假成功
      if (锁.current.has('简历保存')) throw new Error('简历保存进行中，请稍后再试');
      锁.current.add('简历保存');
      const 本次主体 = 主体标识引用.current;
      const 本次代际 = 会话代际.current;
      try {
        await 简历域保存(next, 本次主体, 本次代际);
      } catch (错误) {
        处理写入错误(错误, 本次主体, 本次代际);
      } finally {
        锁.current.delete('简历保存');
      }
    },
    async 保存个人优势(text) {
      if (!是后端 || !后端) {
        派发({ 型: '存个人优势', 文本: text });
        return;
      }
      if (锁.current.has('简历保存')) throw new Error('简历保存进行中，请稍后再试');
      锁.current.add('简历保存');
      const 本次主体 = 主体标识引用.current;
      const 本次代际 = 会话代际.current;
      try {
        let previous = 后端状态引用.current.简历快照;
        if (!previous) {
          const 读出 = await 后端.读取简历();
          previous = 读出.服务端快照;
        }
        // Summary 单独保存：不带 作品集链接 属性（属性缺省 = 未改，不从旧 GET 顺带覆盖草稿 URL
        // 或其他未提交字段；用户有意编辑的 URL 留在草稿由其明确保存动作提交）
        const { 作品集链接: _省略, ...当前页面 } = 从BFF简历(previous);
        // 水合保留的空身份草稿取本地 state（M 语义原样）：next 是按 previous 合成的，
        // 其 基本信息 是服务端值，不能拿它顶掉 /basic 未提交的本地草稿
        await 简历域保存({ ...当前页面, 个人优势: text }, 本次主体, 本次代际, 状态引用.current.基本信息);
      } catch (错误) {
        处理写入错误(错误, 本次主体, 本次代际);
      } finally {
        锁.current.delete('简历保存');
      }
    },
    async 保存意向(draft) {
      if (!是后端 || !后端) {
        const 标题 = `[${draft.工作城市}] ${draft.期望职位}`;
        const 说明 = 意向说明(draft);
        if (draft.编辑编号) 派发({ 型: '改意向', 编号: draft.编辑编号, 标题, 说明, 草稿: draft });
        else 派发({ 型: '新增意向', 标题, 说明, 草稿: draft });
        return;
      }
      const 键 = draft.编辑编号 ? `意向:${draft.编辑编号}` : '意向:new';
      if (锁.current.has(键)) return;
      锁.current.add(键);
      // 发起时刻捕获主体与代际：结算时重取当前主体会让迟到结果冒充新主体的 owner
      const 本次主体 = 主体标识引用.current;
      const 本次代际 = 会话代际.current;
      try {
        // Task 6：目录引用直接落在草稿里（Tasks 3-4），不再按需取目录；
        // 办公方式 从草稿.办公方式 读（必填草稿字段），不再硬编码 ['onsite']。
        const 原始 = draft.编辑编号 ? 后端状态引用.current.意向快照[draft.编辑编号] ?? null : null;
        const 上下文 = { 原始 };
        const 快照 = draft.编辑编号
          ? await 后端.更新意向(draft.编辑编号, draft, 上下文)
          : await 后端.创建意向(draft, 上下文);
        提交意向快照(快照, 本次主体, 本次代际);
      } catch (错误) {
        await 处理意向写入错误(错误, 本次主体, 本次代际);
      } finally {
        锁.current.delete(键);
      }
    },
    async 保存首次意向(input) {
      if (!是后端 || !后端) {
        // Mock 模式 no-op：保持当前预置意向不增加，防止重复走向导制造重复数据
        return;
      }
      // Backend 仅在当前真实意向列表为空时创建一条，已有意向时 no-op
      if (状态引用.current.求职意向表.length > 0) return;
      const 键 = '意向:new';
      if (锁.current.has(键)) return;
      锁.current.add(键);
      // 发起时刻捕获主体与代际：结算时重取当前主体会让迟到结果冒充新主体的 owner
      const 本次主体 = 主体标识引用.current;
      const 本次代际 = 会话代际.current;
      try {
        // Task 6：目录引用直接落在 input 里（引导问答 Backend 分支选中时原子保存），
        // 不再按需取目录；办公方式 从 input.筛选偏好.办公方式 读（向导答案）。
        const 快照 = await 后端.创建首次意向(input);
        提交意向快照(快照, 本次主体, 本次代际);
      } catch (错误) {
        await 处理意向写入错误(错误, 本次主体, 本次代际);
      } finally {
        锁.current.delete(键);
      }
    },
    async 删除意向(id) {
      if (!是后端 || !后端) {
        派发({ 型: '删意向', 编号: id });
        return;
      }
      const 键 = `意向:${id}`;
      if (锁.current.has(键)) return;
      锁.current.add(键);
      // 发起时刻捕获主体与代际：结算时重取当前主体会让迟到结果冒充新主体的 owner
      const 本次主体 = 主体标识引用.current;
      const 本次代际 = 会话代际.current;
      try {
        const 原始 = 后端状态引用.current.意向快照[id];
        if (!原始) return;
        const 快照 = await 后端.删除意向(id, 原始.revision);
        提交意向快照(快照, 本次主体, 本次代际);
      } catch (错误) {
        await 处理意向写入错误(错误, 本次主体, 本次代际);
      } finally {
        锁.current.delete(键);
      }
    },
  };
}
