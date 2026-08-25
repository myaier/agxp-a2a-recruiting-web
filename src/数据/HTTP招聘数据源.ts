// HTTP 招聘数据源：把 BFF /api/v1 的闭合契约映射成页面领域方法。
// 浏览器只请求同源 /api/v1；所有请求 credentials: 'include'（由 HTTP客户端 设置）。
// 接口失败绝不回退 Mock —— 本模块不 import 模拟数据/企业端模拟数据/接口层。
//
// 简历保存按分区 diff：profile → summary → skills → experiences/projects → educations → certificates，
// 只写 JSON.stringify 后变化的分区；中途任一失败都 GET 权威快照并附在 BFF错误.权威简历 上。
// 目录精确解析用 ?q= 前缀搜索 + 游标翻页，只接受 display_name 完全相等且 selectable 的唯一项。

import { BFF错误, type BFF请求选项, type BFF响应 } from './HTTP客户端';
import type {
  BFF当前会话,
  BFF登录尝试,
  BFF主体,
  BFF角色,
  BFF简历,
  BFF经历,
  BFF项目,
  BFF教育,
  BFF证书,
  BFF目录引用,
  BFFOwnerIntention,
  BFFOwnerJob,
  BFFTaxonomyItem,
  BFFLocationItem,
  BFFInstitutionItem,
} from './BFF契约';
import type { 后端环境 } from '../配置/运行配置';
import type { 岗位附属存储 } from './前端附属数据';
import type {
  页面简历快照,
  页面简历写入,
  页面意向快照,
  页面岗位快照,
  目录页,
  Taxonomy查询,
  Location查询,
  Institution查询,
  意向草稿型,
  意向映射上下文,
  首次意向输入,
  岗位映射上下文,
} from './招聘数据源类型';
import type { 在招岗位, 求职意向 } from './类型';
import {
  从BFF简历,
  从BFF意向,
  从BFF岗位,
  转资料写入,
  转经历写入,
  转教育写入,
  转证书写入,
  转意向写入,
  转首次意向写入,
  转岗位创建,
  转岗位补丁,
} from './后端映射';

// ── 列表/回执 DTO（OpenAPI 中的分页与 mutation receipt，只在本模块内用）──

interface BFF岗位页 {
  jobs: BFFOwnerJob[];
  next_cursor?: string | null;
}
interface BFF意向列表 {
  intentions: BFFOwnerIntention[];
}
interface BFF目录页<T extends { id: string; display_name: string }> {
  items: T[];
  next_cursor: string | null;
  catalog_version: string;
}
interface BFF简历条目变更 {
  entry: {
    kind: 'experience' | 'project' | 'education' | 'certificate';
    experience?: BFF经历;
    project?: BFF项目;
    education?: BFF教育;
    certificate?: BFF证书;
  };
  aggregate_revision: number;
}
interface BFF删除回执 {
  deleted: boolean;
}
interface BFF意向删除回执 {
  intention_id: string;
  status: string;
}
interface BFF登录完成 {
  identity_id: string;
  session_id: string;
  expires_at: string;
  next_action: { type: 'completed' | 'enter_code' | 'redirect' };
}
interface BFF登出回执 {
  logged_out: boolean;
}

// 分页目录查询只覆盖这三个 taxonomy 端点；locations / education-institutions 固定路径单独映射。
type Taxonomy类别 = 'job-categories' | 'industries' | 'majors';

type 写入步骤 = () => Promise<unknown>;

function 修订etag(revision: number): string {
  return `"${revision}"`;
}

export interface HTTP招聘数据源依赖 {
  client: { 请求: <T>(options: BFF请求选项) => Promise<BFF响应<T>> };
  后端环境: 后端环境;
  附属存储: 岗位附属存储;
}

export interface HTTP招聘数据源 {
  恢复会话(): Promise<BFF当前会话>;
  开始手机登录(手机号11位: string): Promise<BFF登录尝试>;
  开始微信登录(): Promise<BFF登录尝试>;
  完成手机登录(attemptId: string, code4位: string): Promise<BFF当前会话>;
  退出登录(): Promise<void>;
  读取主体(): Promise<BFF主体>;
  确保角色(role: BFF角色): Promise<BFF主体>;
  记录当前角色(role: BFF角色): Promise<BFF主体>;
  查询Taxonomy(kind: Taxonomy类别, query: Taxonomy查询): Promise<目录页<BFFTaxonomyItem>>;
  查询Location(query: Location查询): Promise<目录页<BFFLocationItem>>;
  查询Institution(query: Institution查询): Promise<目录页<BFFInstitutionItem>>;
  清空目录缓存(): void;
  读取简历(): Promise<页面简历快照>;
  保存简历(next: 页面简历写入, previous: BFF简历): Promise<页面简历快照>;
  读取意向(): Promise<页面意向快照>;
  创建意向(draft: 意向草稿型, context: 意向映射上下文): Promise<页面意向快照>;
  创建首次意向(input: 首次意向输入): Promise<页面意向快照>;
  更新意向(id: string, draft: 意向草稿型, context: 意向映射上下文): Promise<页面意向快照>;
  删除意向(id: string, revision: number): Promise<页面意向快照>;
  读取岗位(): Promise<页面岗位快照>;
  创建岗位(job: 在招岗位, context: 岗位映射上下文): Promise<页面岗位快照>;
  更新岗位(job: 在招岗位, previous: BFFOwnerJob, context: 岗位映射上下文): Promise<页面岗位快照>;
  归档岗位(id: string, revision: number): Promise<页面岗位快照>;
  重开岗位(id: string, revision: number): Promise<页面岗位快照>;
  删除岗位(id: string, revision: number): Promise<页面岗位快照>;
}

export function 创建HTTP招聘数据源(deps: HTTP招聘数据源依赖): HTTP招聘数据源 {
  const { client, 后端环境, 附属存储 } = deps;
  const 请求 = client.请求;
  // 目录页面缓存：分页查询的 in-flight 去重 + 已请求页面缓存。key = endpoint?normalizedQuery。
  // 只缓存当前 session 已请求页面；清空目录缓存 清空它。
  const 目录页面缓存 = new Map<string, Promise<unknown>>();

  /** 把查询参数编码成稳定 query string：丢掉 undefined 与空串，limit:20 与缺省都稳定。 */
  function 编码查询(entries: [string, string | number | undefined][]): string {
    const params = new URLSearchParams();
    for (const [key, value] of entries) if (value !== undefined && value !== '') params.set(key, String(value));
    return params.toString();
  }

  /** 一页查询：同 key in-flight 去重；失败时从缓存里删掉这个 key 再抛。 */
  async function 查询一页<T extends BFF目录引用>(path: `/api/v1/catalog/${string}`, query: string): Promise<目录页<T>> {
    const key = `${path}?${query}`;
    const existing = 目录页面缓存.get(key) as Promise<目录页<T>> | undefined;
    if (existing) return existing;
    const pending = 请求<BFF目录页<T>>({ path: `${path}${query ? `?${query}` : ''}` as `/api/v1/${string}` })
      .then(({ result }) => ({ items: result.items, nextCursor: result.next_cursor, catalogVersion: result.catalog_version }))
      .catch((error) => { 目录页面缓存.delete(key); throw error; });
    目录页面缓存.set(key, pending);
    return pending;
  }

  async function 读取意向(): Promise<页面意向快照> {
    const { result } = await 请求<BFF意向列表>({ path: '/api/v1/me/intentions?status=active' });
    const 列表: 求职意向[] = result.intentions.map(从BFF意向);
    const 服务端: Record<string, BFFOwnerIntention> = {};
    for (const 项 of result.intentions) 服务端[项.intention_id] = 项;
    return { 列表, 服务端 };
  }

  async function 读取岗位(): Promise<页面岗位快照> {
    const 全部: BFFOwnerJob[] = [];
    let cursor: string | undefined;
    while (true) {
      const path = cursor
        ? (`/api/v1/recruiter/jobs?cursor=${encodeURIComponent(cursor)}` as `/api/v1/${string}`)
        : '/api/v1/recruiter/jobs';
      const { result } = await 请求<BFF岗位页>({ path });
      全部.push(...result.jobs);
      cursor = result.next_cursor ?? undefined;
      if (!cursor) break;
    }
    const 列表 = 全部.map((dto) => 从BFF岗位(dto, 附属存储.读取(后端环境, dto.job_id)));
    const 服务端: Record<string, BFFOwnerJob> = {};
    for (const 项 of 全部) 服务端[项.job_id] = 项;
    return { 列表, 服务端 };
  }

  function 写入岗位附属(jobId: string, job: 在招岗位): void {
    const 附属: { 加分关键词?: string[]; 实习转正?: boolean } = {};
    if (job.加分关键词) 附属.加分关键词 = job.加分关键词;
    if (job.实习转正 !== undefined) 附属.实习转正 = job.实习转正;
    附属存储.写入(后端环境, jobId, 附属);
  }

  /**
   * 简历分区 diff：profile → summary → skills → experiences/projects → educations → certificates。
   * 每分区比较 JSON.stringify，只写变化分区。条目按 编号 与 previous 对齐：
   * 新条目 POST、已有且变化 PATCH、消失 DELETE；嵌套项目同理。
   * 中途失败 → GET 权威快照附在 BFF错误.权威简历 上后抛出；成功 → GET 最终快照返回。
   */
  async function 保存简历(next: 页面简历写入, previous: BFF简历): Promise<页面简历快照> {
    const 旧页面 = 从BFF简历(previous);

    // 简历写入直接用表单里选择器保存的目录引用（行业引用/学校引用/专业引用）取 id，
    // 不再保存前从 previous 快照建目录 + 确保目录 反查。缺引用的完整条目由 必需引用 抛客户端校验错。

    const 步骤: 写入步骤[] = [];

    // profile
    if (JSON.stringify(转资料写入(next.基本信息)) !== JSON.stringify(转资料写入(旧页面.基本信息))) {
      const body = 转资料写入(next.基本信息);
      步骤.push(() => 请求<BFF简历>({ path: '/api/v1/me/resume/profile', method: 'PATCH', body, ifMatch: 修订etag(previous.profile_revision) }).then((r) => r.result));
    }
    // summary
    if (JSON.stringify(next.个人优势) !== JSON.stringify(旧页面.个人优势)) {
      步骤.push(() => 请求<BFF简历>({ path: '/api/v1/me/resume/summary', method: 'PATCH', body: { value: next.个人优势 }, ifMatch: 修订etag(previous.summary_revision) }).then((r) => r.result));
    }
    // skills
    if (JSON.stringify(next.技能) !== JSON.stringify(旧页面.技能)) {
      步骤.push(() => 请求<BFF简历>({ path: '/api/v1/me/resume/skills', method: 'PATCH', body: { skills: next.技能 }, ifMatch: 修订etag(previous.skills_revision) }).then((r) => r.result));
    }

    // experiences + nested projects：用 旧页面.经历（已是页面形态）做 diff
    const 旧经历PageMap = new Map(旧页面.经历.map((e) => [e.编号, e]));
    // onboarding 中间屏会先建一条空白经历/教育段（公司/行业/开始 或 学校/专业/开始 任一为空），
    // 此时 BFF 写入需要的目录精确 ID 解析不出来会抛错，或 start_month 为空被 BFF 拒，
    // 阻塞流程。这些不完整条目跳过服务端写入，保留在本地页面态里由后续屏补齐再发；其它分区照常 diff。
    // 已知局限（#2）：若中途发生 rehydration（刷新/切身份），跳过段只靠本地页面态保留，
    // 服务端快照里没有它们 → 水合后端简历 会用服务端权威把它们从本地清掉。
    // 彻底修需要独立的本地 onboarding-draft 状态（rehydration 不擦），超出本轮范围，暂不实现。
    const 跳过经历 = new Set<string>();
    for (const 段 of next.经历) {
      const 旧Page = 旧经历PageMap.get(段.编号);
      if (段.公司 === '' || 段.行业 === '' || 段.开始 === '') {
        跳过经历.add(段.编号);
        continue;
      }
      if (!旧Page) {
        const body = 转经历写入(段);
        // 新建经历的 POST 响应带回服务端分配的 id；用这个 id 再 POST 它的项目。
        // 旧实现只 POST 经历主体，项目 diff 仅对已有经历跑 → 新建带项目时项目丢失。
        步骤.push(async () => {
          const { result } = await 请求<BFF简历条目变更>({ path: '/api/v1/me/resume/experiences', method: 'POST', body, 幂等: true });
          const 新经历Id = result.entry.experience?.id;
          if (!新经历Id) return;
          // 将本地条目编号更新为服务端 id：若后续项目 POST 失败，catch 路径 GET 的权威快照
          // 已包含这条经历（服务端 id），重试时 previous 也有它 → diff 判定为已有条目，
          // 不会重复 POST 经历。项目也会 POST 到正确的服务端 id 下。
          段.编号 = 新经历Id;
          for (const 项目 of 段.项目 ?? []) {
            const 项目body = { name: 项目.名称, role: 项目.角色, result: 项目.结果 };
            await 请求<BFF简历条目变更>({ path: `/api/v1/me/resume/experiences/${新经历Id}/projects`, method: 'POST', body: 项目body, 幂等: true });
          }
        });
      } else if (JSON.stringify(旧Page) !== JSON.stringify(段)) {
        // 经历段变化：PATCH 经历主体，再 diff 嵌套项目
        const body = 转经历写入(段);
        步骤.push(() => 请求<BFF简历>({ path: `/api/v1/me/resume/experiences/${段.编号}`, method: 'PATCH', body, ifMatch: 修订etag(previous.experiences.find((e) => e.id === 段.编号)!.revision) }).then((r) => r.result));
        步骤.push(...项目步骤(段, previous.experiences.find((e) => e.id === 段.编号)!));
      }
    }
    for (const 旧 of previous.experiences) {
      if (!next.经历.some((段) => 段.编号 === 旧.id)) {
        const id = 旧.id;
        const ifMatch = 修订etag(旧.revision);
        步骤.push(() => 请求<BFF简历>({ path: `/api/v1/me/resume/experiences/${id}`, method: 'DELETE', ifMatch }).then((r) => r.result));
      }
    }

    // educations
    const 旧教育PageMap = new Map(旧页面.教育.map((e) => [e.编号, e]));
    const 跳过教育 = new Set<string>();
    for (const 段 of next.教育) {
      const 旧Page = 旧教育PageMap.get(段.编号);
      if (段.学校 === '' || 段.专业 === '' || 段.开始 === '') {
        跳过教育.add(段.编号);
        continue;
      }
      if (!旧Page) {
        const body = 转教育写入(段);
        步骤.push(() => 请求<BFF简历条目变更>({ path: '/api/v1/me/resume/educations', method: 'POST', body, 幂等: true }).then((r) => r.result));
      } else if (JSON.stringify(旧Page) !== JSON.stringify(段)) {
        const body = 转教育写入(段);
        步骤.push(() => 请求<BFF简历>({ path: `/api/v1/me/resume/educations/${段.编号}`, method: 'PATCH', body, ifMatch: 修订etag(previous.educations.find((e) => e.id === 段.编号)!.revision) }).then((r) => r.result));
      }
    }
    for (const 旧 of previous.educations) {
      if (!next.教育.some((段) => 段.编号 === 旧.id)) {
        const id = 旧.id;
        const ifMatch = 修订etag(旧.revision);
        步骤.push(() => 请求<BFF简历>({ path: `/api/v1/me/resume/educations/${id}`, method: 'DELETE', ifMatch }).then((r) => r.result));
      }
    }

    // certificates
    const 旧证书PageMap = new Map(旧页面.证书.map((c) => [c.编号, c]));
    for (const 段 of next.证书) {
      const 旧Page = 旧证书PageMap.get(段.编号);
      if (!旧Page) {
        const body = 转证书写入(段);
        步骤.push(() => 请求<BFF简历条目变更>({ path: '/api/v1/me/resume/certificates', method: 'POST', body, 幂等: true }).then((r) => r.result));
      } else if (JSON.stringify(旧Page) !== JSON.stringify(段)) {
        const body = 转证书写入(段);
        步骤.push(() => 请求<BFF简历>({ path: `/api/v1/me/resume/certificates/${段.编号}`, method: 'PATCH', body, ifMatch: 修订etag(previous.certificates.find((c) => c.id === 段.编号)!.revision) }).then((r) => r.result));
      }
    }
    for (const 旧 of previous.certificates) {
      if (!next.证书.some((段) => 段.编号 === 旧.id)) {
        const id = 旧.id;
        const ifMatch = 修订etag(旧.revision);
        步骤.push(() => 请求<BFF简历>({ path: `/api/v1/me/resume/certificates/${id}`, method: 'DELETE', ifMatch }).then((r) => r.result));
      }
    }

    try {
      for (const 步 of 步骤) await 步();
    } catch (error) {
      const { result: 权威 } = await 请求<BFF简历>({ path: '/api/v1/me/resume' });
      if (error instanceof BFF错误) error.权威简历 = 权威;
      throw error;
    }
    const { result: 最终 } = await 请求<BFF简历>({ path: '/api/v1/me/resume' });
    const 最终页面 = 从BFF简历(最终);
    // 跳过的本地不完整条目（onboarding 中间屏建的教育/经历段，BFF 还没有）不进 服务端快照，
    // 但要留在返回的页面态里，否则 水合后端简历 会用服务端权威把它们从本地清掉，
    // 后续屏读 简历教育[0] 就是空、之前选的学历/学校/专业全丢。
    // 服务端快照 仍是 BFF 权威，下次保存的 previous 还是服务端版，补齐的条目会作为新条目 POST。
    if (跳过经历.size === 0 && 跳过教育.size === 0) return 最终页面;
    const 跳过经历段 = next.经历.filter((段) => 跳过经历.has(段.编号));
    const 跳过教育段 = next.教育.filter((段) => 跳过教育.has(段.编号));
    return { ...最终页面, 经历: [...最终页面.经历, ...跳过经历段], 教育: [...最终页面.教育, ...跳过教育段] };
  }

  /** 嵌套项目 diff：新 POST、变化 PATCH、消失 DELETE。 */
  function 项目步骤(段: { 编号: string; 项目?: { 编号: string; 名称: string; 角色: string; 结果: string }[] }, 旧: BFF经历): 写入步骤[] {
    const 出: 写入步骤[] = [];
    const 旧项目Map = new Map((旧.projects ?? []).map((p) => [p.id, p]));
    const 新项目Ids = new Set((段.项目 ?? []).map((p) => p.编号));
    for (const 项目 of 段.项目 ?? []) {
      const 旧项目 = 旧项目Map.get(项目.编号);
      if (!旧项目) {
        const body = { name: 项目.名称, role: 项目.角色, result: 项目.结果 };
        出.push(() => 请求<BFF简历条目变更>({ path: `/api/v1/me/resume/experiences/${段.编号}/projects`, method: 'POST', body, 幂等: true }).then((r) => r.result));
      } else if (JSON.stringify({ 编号: 旧项目.id, 名称: 旧项目.name, 角色: 旧项目.role, 结果: 旧项目.result }) !== JSON.stringify(项目)) {
        const body = { name: 项目.名称, role: 项目.角色, result: 项目.结果 };
        出.push(() => 请求<BFF简历>({ path: `/api/v1/me/resume/experiences/${段.编号}/projects/${项目.编号}`, method: 'PATCH', body, ifMatch: 修订etag(旧项目.revision) }).then((r) => r.result));
      }
    }
    for (const 旧项目 of 旧.projects ?? []) {
      if (!新项目Ids.has(旧项目.id)) {
        const id = 旧项目.id;
        const ifMatch = 修订etag(旧项目.revision);
        出.push(() => 请求<BFF简历>({ path: `/api/v1/me/resume/experiences/${段.编号}/projects/${id}`, method: 'DELETE', ifMatch }).then((r) => r.result));
      }
    }
    return 出;
  }

  return {
    恢复会话() {
      return 请求<BFF当前会话>({ path: '/api/v1/session' }).then((r) => r.result);
    },
    开始手机登录(手机号11位) {
      return 请求<BFF登录尝试>({
        path: '/api/v1/auth/login-attempts',
        method: 'POST',
        body: { provider: 'phone_otp', input: { phone: `+86${手机号11位}` } },
        幂等: true,
      }).then((r) => r.result);
    },
    开始微信登录() {
      return 请求<BFF登录尝试>({
        path: '/api/v1/auth/login-attempts',
        method: 'POST',
        body: { provider: 'wechat', input: { mock_openid: 'mock-openid-sample-001' } },
        幂等: true,
      }).then((r) => r.result);
    },
    完成手机登录(attemptId, code4位) {
      return 请求<BFF登录完成>({
        path: `/api/v1/auth/login-attempts/${attemptId}/complete`,
        method: 'POST',
        body: { proof: { code: code4位 } },
        幂等: true,
      }).then((r) => ({ identity_id: r.result.identity_id, session_id: r.result.session_id, expires_at: r.result.expires_at }));
    },
    退出登录() {
      return 请求<BFF登出回执>({ path: '/api/v1/auth/logout', method: 'POST' }).then(() => undefined);
    },
    读取主体() {
      return 请求<BFF主体>({ path: '/api/v1/me' }).then((r) => r.result);
    },
    确保角色(role) {
      return 请求<BFF主体>({ path: `/api/v1/me/roles/${role}`, method: 'PUT', body: {} }).then((r) => r.result);
    },
    记录当前角色(role) {
      return 请求<BFF主体>({ path: '/api/v1/me/preferences/last-used-role', method: 'PUT', body: { role } }).then((r) => r.result);
    },
    查询Taxonomy(kind, query) {
      const path = `/api/v1/catalog/${kind}` as `/api/v1/catalog/${string}`;
      const query_string = 编码查询([
        ['parent_id', query.parentId],
        ['q', query.q],
        ['cursor', query.cursor],
        ['limit', query.limit],
      ]);
      return 查询一页<BFFTaxonomyItem>(path, query_string);
    },
    查询Location(query) {
      const path = '/api/v1/catalog/locations';
      const query_string = 编码查询([
        ['q', query.q],
        ['country_code', query.countryCode],
        ['admin1_code', query.admin1Code],
        ['cursor', query.cursor],
        ['limit', query.limit],
      ]);
      return 查询一页<BFFLocationItem>(path, query_string);
    },
    查询Institution(query) {
      const path = '/api/v1/catalog/education-institutions';
      const query_string = 编码查询([
        ['q', query.q],
        ['country_code', query.countryCode],
        ['location_id', query.locationId],
        ['cursor', query.cursor],
        ['limit', query.limit],
      ]);
      return 查询一页<BFFInstitutionItem>(path, query_string);
    },
    清空目录缓存() {
      目录页面缓存.clear();
    },
    读取简历() {
      return 请求<BFF简历>({ path: '/api/v1/me/resume' }).then((r) => 从BFF简历(r.result));
    },
    保存简历,
    读取意向,
    async 创建意向(draft, context) {
      await 请求<BFFOwnerIntention>({ path: '/api/v1/me/intentions', method: 'POST', body: 转意向写入(draft, context), 幂等: true });
      return 读取意向();
    },
    async 创建首次意向(input) {
      await 请求<BFFOwnerIntention>({
        path: '/api/v1/me/intentions',
        method: 'POST',
        body: 转首次意向写入(input),
        幂等: true,
      });
      return 读取意向();
    },
    async 更新意向(id, draft, context) {
      if (!context.原始) throw new Error('更新意向需要原始意向');
      await 请求<BFFOwnerIntention>({
        path: `/api/v1/me/intentions/${id}`,
        method: 'PATCH',
        body: 转意向写入(draft, context),
        ifMatch: 修订etag(context.原始.revision),
      });
      return 读取意向();
    },
    async 删除意向(id, revision) {
      await 请求<BFF意向删除回执>({ path: `/api/v1/me/intentions/${id}`, method: 'DELETE', ifMatch: 修订etag(revision) });
      return 读取意向();
    },
    读取岗位,
    async 创建岗位(job, context) {
      const { result } = await 请求<BFFOwnerJob>({
        path: '/api/v1/recruiter/jobs',
        method: 'POST',
        body: 转岗位创建(job, { 公司: context.公司 }),
        幂等: true,
      });
      写入岗位附属(result.job_id, job);
      return 读取岗位();
    },
    async 更新岗位(job, previous, context) {
      await 请求<BFFOwnerJob>({
        path: `/api/v1/recruiter/jobs/${job.编号}`,
        method: 'PATCH',
        body: 转岗位补丁(job, { 原始: previous, 公司: context.公司 }),
        ifMatch: 修订etag(previous.revision),
      });
      写入岗位附属(job.编号, job);
      return 读取岗位();
    },
    async 归档岗位(id, revision) {
      await 请求<BFFOwnerJob>({ path: `/api/v1/recruiter/jobs/${id}/archive`, method: 'POST', ifMatch: 修订etag(revision) });
      return 读取岗位();
    },
    async 重开岗位(id, revision) {
      await 请求<BFFOwnerJob>({ path: `/api/v1/recruiter/jobs/${id}/reopen`, method: 'POST', ifMatch: 修订etag(revision) });
      return 读取岗位();
    },
    async 删除岗位(id, revision) {
      await 请求<BFF删除回执>({ path: `/api/v1/recruiter/jobs/${id}`, method: 'DELETE', ifMatch: 修订etag(revision) });
      附属存储.删除(后端环境, id);
      return 读取岗位();
    },
  };
}