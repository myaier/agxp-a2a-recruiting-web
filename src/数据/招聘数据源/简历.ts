// 简历域数据源：BFF /api/v1/me/resume 的读取与分区 diff 保存。
// 从 HTTP招聘数据源 按真实后端 owner 拆出，协议代码（path / method / body / If-Match / 幂等 / 分区 diff /
// 嵌套项目 / 中途失败 GET 权威快照）原样搬移，不改 URL、body、DTO 校验或错误透传。接口失败绝不回退 Mock。
// J-PILOT-02 Task 3：保存简历 追加可选 跟踪 —— 每个实际请求前 发送前 固定命令（重试复用原
// 幂等键/ifMatch），成功后立即 已确认 交该命令回执（条目 id/revision/aggregate_revision、
// 单例分区对应 revision），之后才继续下一步或 GET；跟踪缺省时行为与原实现逐字一致。

import { BFF错误, type BFF请求选项, type BFF响应 } from '../HTTP客户端';
import type { BFF简历, BFF经历, BFF项目, BFF教育, BFF证书 } from '../BFF契约';
import type { 页面简历快照, 页面简历写入, 建档待写入, 建档写入跟踪, 建档写入回执 } from '../招聘数据源类型';
import { 从BFF简历, 转资料写入, 转经历写入, 转教育写入, 转证书写入 } from '../后端映射';

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

type 写入步骤 = () => Promise<unknown>;
type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

function 修订etag(revision: number): string {
  return `"${revision}"`;
}

/** 创建回执只存该种类已返回的 id/revision/aggregate_revision；响应缺本命令条目时不得编造身份。 */
function 条目创建回执(变更: BFF简历条目变更): 建档写入回执 {
  const 条 = 变更.entry;
  if (条.kind === 'experience' && 条.experience) {
    return { id: 条.experience.id, revision: 条.experience.revision, aggregate_revision: 变更.aggregate_revision };
  }
  if (条.kind === 'project' && 条.project) {
    return { id: 条.project.id, revision: 条.project.revision, aggregate_revision: 变更.aggregate_revision };
  }
  if (条.kind === 'education' && 条.education) {
    return { id: 条.education.id, revision: 条.education.revision, aggregate_revision: 变更.aggregate_revision };
  }
  if (条.kind === 'certificate' && 条.certificate) {
    return { id: 条.certificate.id, revision: 条.certificate.revision, aggregate_revision: 变更.aggregate_revision };
  }
  return { aggregate_revision: 变更.aggregate_revision };
}

function 找经历(dto: BFF简历, id: string): BFF经历 | undefined {
  return dto.experiences.find((e) => e.id === id);
}
function 找项目(dto: BFF简历, 父编号: string, id: string): BFF项目 | undefined {
  return 找经历(dto, 父编号)?.projects?.find((p) => p.id === id);
}
function 找教育(dto: BFF简历, id: string): BFF教育 | undefined {
  return dto.educations.find((e) => e.id === id);
}
function 找证书(dto: BFF简历, id: string): BFF证书 | undefined {
  return dto.certificates.find((c) => c.id === id);
}

/**
 * 键序无关的稳定序列化：对象按排序键递归展开（数组保序）。
 * J-PILOT-02 fix：教育 diff 原用整对象 JSON.stringify 比较 —— 权威页快照按 转教育
 * 的规范键序建对象，注册流草稿的学校/专业引用是各屏逐次追加的键，插入序不同，
 * 内容未变的条目被判「已变化」，每次后续保存都发一次多余的
 * PATCH /me/resume/educations/{id}（同 id CAS，幂等但无谓写入）。只用于教育条目
 * 比较；经历/证书侧同形比较未观察到该证据，不动。
 */
function 稳定序列化(值: unknown): string {
  if (Array.isArray(值)) return `[${值.map(稳定序列化).join(',')}]`;
  if (值 !== null && typeof 值 === 'object') {
    const 记录 = 值 as Record<string, unknown>;
    return `{${Object.keys(记录).sort().map((键) => `${JSON.stringify(键)}:${稳定序列化(记录[键])}`).join(',')}}`;
  }
  return JSON.stringify(值);
}

/** 更新回执只认本命令条目：响应里找不到对应条目时回空回执，绝不把其它资源的 revision 冒充。 */
function 条目更新回执(dto: BFF简历, 找条目: (dto: BFF简历) => { id: string; revision: number } | undefined): 建档写入回执 {
  const 条目 = 找条目(dto);
  return 条目 ? { id: 条目.id, revision: 条目.revision, aggregate_revision: dto.aggregate_revision } : {};
}

export interface 简历数据源 {
  读取简历(): Promise<页面简历快照>;
  保存简历(next: 页面简历写入, previous: BFF简历, 跟踪?: 建档写入跟踪): Promise<页面简历快照>;
}

/** 跟踪在场时的单步执行器；跟踪缺省时退化为原请求（普通调用保持原行为）。 */
type 步骤执行器 = <T>(
  选项: BFF请求选项,
  命令: 建档待写入 | null,
  提取回执: (回应: BFF响应<T>) => 建档写入回执,
) => Promise<BFF响应<T>>;

/**
 * 构造单步执行器：跟踪在场时 发送前 固定命令（回带原幂等键/ifMatch，创建复用原 key），
 * 成功后立即 已确认 交回执，之后才继续下一步或 GET；跟踪缺省时退化为原请求。
 */
function 创建发出(请求: 请求函数, 跟踪: 建档写入跟踪 | undefined): 步骤执行器 {
  if (跟踪 === undefined) {
    return async <T,>(选项: BFF请求选项) => 请求<T>(选项);
  }
  return async <T,>(
    选项: BFF请求选项,
    命令: 建档待写入 | null,
    提取回执: (回应: BFF响应<T>) => 建档写入回执,
  ) => {
    if (命令 === null) return 请求<T>(选项);
    const 定 = 跟踪.发送前(命令);
    const 增补: BFF请求选项 = { ...选项 };
    if (选项.幂等 === true && 定.幂等键 !== undefined) 增补.幂等键 = 定.幂等键;
    if (定.ifMatch !== undefined) 增补.ifMatch = 修订etag(定.ifMatch);
    const 回应 = await 请求<T>(增补);
    跟踪.已确认(命令, 提取回执(回应));
    return 回应;
  };
}

export function 创建简历数据源(请求: 请求函数): 简历数据源 {
  /**
   * 嵌套项目 diff：新 POST、变化 PATCH、消失 DELETE。
   */
  function 项目步骤(
    段: { 编号: string; 项目?: { 编号: string; 名称: string; 角色: string; 结果: string }[] },
    旧: BFF经历,
    跟踪: 建档写入跟踪 | undefined,
    发出: 步骤执行器,
  ): 写入步骤[] {
    const 出: 写入步骤[] = [];
    const 旧项目Map = new Map((旧.projects ?? []).map((p) => [p.id, p]));
    const 新项目Ids = new Set((段.项目 ?? []).map((p) => p.编号));
    for (const 项目 of 段.项目 ?? []) {
      const 旧项目 = 旧项目Map.get(项目.编号);
      if (!旧项目) {
        const body = { name: 项目.名称, role: 项目.角色, result: 项目.结果 };
        出.push(() => 发出<BFF简历条目变更>(
          { path: `/api/v1/me/resume/experiences/${段.编号}/projects`, method: 'POST', body, 幂等: true },
          跟踪 ? { 种类: 'project-create', 本地编号: 项目.编号, 父编号: 段.编号, 请求体: { ...body } as Record<string, unknown>, 阶段: 'prepared' as const } : null,
          (r) => 条目创建回执(r.result),
        ).then((r) => r.result));
      } else if (JSON.stringify({ 编号: 旧项目.id, 名称: 旧项目.name, 角色: 旧项目.role, 结果: 旧项目.result }) !== JSON.stringify(项目)) {
        const body = { name: 项目.名称, role: 项目.角色, result: 项目.结果 };
        出.push(() => 发出<BFF简历>(
          { path: `/api/v1/me/resume/experiences/${段.编号}/projects/${项目.编号}`, method: 'PATCH', body, ifMatch: 修订etag(旧项目.revision) },
          跟踪 ? { 种类: 'project-update', 资源编号: 项目.编号, 父编号: 段.编号, 请求体: { ...body }, ifMatch: 旧项目.revision, 阶段: 'prepared' as const } : null,
          (r) => 条目更新回执(r.result, (dto) => 找项目(dto, 段.编号, 项目.编号)),
        ).then((r) => r.result));
      }
    }
    for (const 旧项目 of 旧.projects ?? []) {
      if (!新项目Ids.has(旧项目.id)) {
        const id = 旧项目.id;
        const ifMatch = 修订etag(旧项目.revision);
        出.push(() => 发出<BFF简历>(
          { path: `/api/v1/me/resume/experiences/${段.编号}/projects/${id}`, method: 'DELETE', ifMatch },
          跟踪 ? { 种类: 'project-delete', 资源编号: id, 父编号: 段.编号, ifMatch: 旧项目.revision, 阶段: 'prepared' as const } : null,
          () => ({}),
        ).then((r) => r.result));
      }
    }
    return 出;
  }

  /**
   * 简历分区 diff：profile → summary → skills → experiences/projects → educations → certificates。
   * 每分区比较 JSON.stringify，只写变化分区。条目按 编号 与 previous 对齐：
   * 新条目 POST、已有且变化 PATCH、消失 DELETE；嵌套项目同理。
   * Task 2（onboarding 修复）：全部请求体（含嵌套项目）在推入步骤前同步物化并校验 ——
   * 任何 客户端校验错误（缺引用、证书年份非法）都在第一个 mutation 之前抛出，零请求发出。
   * 中途失败 → GET 权威快照附在 BFF错误.权威简历 上后抛出（失败绝不包装成成功）；成功 → GET 最终快照返回。
   * Task 3：跟踪在场时每个请求前 发送前、每个成功后立即 已确认（先落回执，之后才下一步或 GET）。
   */
  async function 保存简历(next: 页面简历写入, previous: BFF简历, 跟踪?: 建档写入跟踪): Promise<页面简历快照> {
    const 旧页面 = 从BFF简历(previous);

    // 跟踪执行器：发送前固定命令（回带原幂等键/ifMatch），成功后立即交回执。
    const 发出 = 创建发出(请求, 跟踪);

    // 简历写入直接用表单里选择器保存的目录引用（行业引用/学校引用/专业引用）取 id，
    // 不再保存前从 previous 快照建目录 + 确保目录 反查。缺引用的完整条目由 必需引用 抛客户端校验错。

    const 写入步骤们: 写入步骤[] = [];

    // profile。M：身份为 ''（未选择）时整个分区跳过 —— 转资料写入 会拒绝空身份，
    // Context 里 /basic 未提交的姓名/生日草稿不该阻断其余五个分区，也不许借默认档铸 body；
    // 身份非空且 profile 真有变化时才 PATCH。
    // Task 1（core editors §6.1）：作品集链接三态不再以「有建档跟踪」为可写条件 ——
    // 属性缺省（含 undefined）= 无写意图（body 不带 portfolio_url，普通资料编辑即此路径），
    // null = 明确清空，字符串 = 设置；只在本轮最终值与权威值不同时才把 portfolio_url
    // 写进 body（规范化等价值省略，不产生 URL-only PATCH）。跟踪只负责建档命令/回执，
    // 不再作为是否写 URL 的门。
    const 链接已改 = next.作品集链接 !== undefined
      && next.作品集链接 !== (旧页面.作品集链接 ?? null);
    if (next.基本信息.身份 !== ''
      && (JSON.stringify(next.基本信息) !== JSON.stringify(旧页面.基本信息) || 链接已改)) {
      const body = 链接已改
        ? 转资料写入(next.基本信息, next.作品集链接)
        : 转资料写入(next.基本信息);
      写入步骤们.push(() => 发出<BFF简历>(
        { path: '/api/v1/me/resume/profile', method: 'PATCH', body, ifMatch: 修订etag(previous.profile_revision) },
        跟踪 ? { 种类: 'profile', 请求体: { ...body }, ifMatch: previous.profile_revision, 阶段: 'prepared' as const } : null,
        (r) => ({ revision: r.result.profile_revision }),
      ).then((r) => r.result));
    }
    // summary
    if (JSON.stringify(next.个人优势) !== JSON.stringify(旧页面.个人优势)) {
      const body = { value: next.个人优势 };
      写入步骤们.push(() => 发出<BFF简历>(
        { path: '/api/v1/me/resume/summary', method: 'PATCH', body, ifMatch: 修订etag(previous.summary_revision) },
        跟踪 ? { 种类: 'summary', 请求体: { ...body }, ifMatch: previous.summary_revision, 阶段: 'prepared' as const } : null,
        (r) => ({ revision: r.result.summary_revision }),
      ).then((r) => r.result));
    }
    // skills
    if (JSON.stringify(next.技能) !== JSON.stringify(旧页面.技能)) {
      const body = { skills: next.技能 };
      写入步骤们.push(() => 发出<BFF简历>(
        { path: '/api/v1/me/resume/skills', method: 'PATCH', body, ifMatch: 修订etag(previous.skills_revision) },
        跟踪 ? { 种类: 'skills', 请求体: { ...body }, ifMatch: previous.skills_revision, 阶段: 'prepared' as const } : null,
        (r) => ({ revision: r.result.skills_revision }),
      ).then((r) => r.result));
    }

    // experiences + nested projects：用 旧页面.经历（已是页面形态）做 diff
    const 旧经历PageMap = new Map(旧页面.经历.map((e) => [e.编号, e]));
    // onboarding 中间屏会先建一条空白经历/教育段（公司/行业/开始 或 学校/专业/开始 任一为空），
    // 此时 BFF 写入需要的目录精确 ID 解析不出来会抛错，或 start_month 为空被 BFF 拒，
    // 阻塞流程。这些不完整条目跳过服务端写入，保留在本地页面态里由后续屏补齐再发；其它分区照常 diff。
    // Task 2/3 后不完整输入走 session 草稿（Task 4 接线），这里跳过语义原样保留。
    const 跳过经历 = new Set<string>();
    for (const 段 of next.经历) {
      const 旧Page = 旧经历PageMap.get(段.编号);
      if (段.公司 === '' || 段.行业 === '' || 段.开始 === '') {
        跳过经历.add(段.编号);
        continue;
      }
      if (!旧Page) {
        const 经历请求体 = 转经历写入(段);
        // 新建经历的 项目请求体与命令坐标同样在推入步骤前物化：全部映射/校验完成后才开始第一个 mutation。
        const 项目请求体们 = (段.项目 ?? []).map((项目) => ({
          name: 项目.名称,
          role: 项目.角色,
          result: 项目.结果,
        }));
        const 项目们 = 段.项目 ?? [];
        const 本地编号 = 段.编号;
        // 新建经历的 POST 响应带回服务端分配的 id；用这个 id 再 POST 它的项目。
        写入步骤们.push(async () => {
          const 回应 = await 发出<BFF简历条目变更>(
            { path: '/api/v1/me/resume/experiences', method: 'POST', body: 经历请求体, 幂等: true },
            跟踪 ? { 种类: 'experience-create', 本地编号, 请求体: { ...经历请求体 } as Record<string, unknown>, 阶段: 'prepared' as const } : null,
            (r) => 条目创建回执(r.result),
          );
          const 新经历Id = 回应.result.entry.experience?.id;
          if (!新经历Id) return;
          // 将本地条目编号更新为服务端 id：若后续项目 POST 失败，catch 路径 GET 的权威快照
          // 已包含这条经历（服务端 id），重试时 previous 也有它 → diff 判定为已有条目，
          // 不会重复 POST 经历。项目也会 POST 到正确的服务端 id 下。
          段.编号 = 新经历Id;
          // 跟踪在场时经历回执已在 发出 内立即 已确认（新经历 ID 在项目请求发出前落存储）。
          for (let 序 = 0; 序 < 项目请求体们.length; 序 += 1) {
            await 发出<BFF简历条目变更>(
              { path: `/api/v1/me/resume/experiences/${新经历Id}/projects`, method: 'POST', body: 项目请求体们[序], 幂等: true },
              跟踪 ? { 种类: 'project-create', 本地编号: 项目们[序].编号, 父编号: 新经历Id, 请求体: { ...项目请求体们[序] }, 阶段: 'prepared' as const } : null,
              (r) => 条目创建回执(r.result),
            );
          }
        });
      } else if (JSON.stringify(旧Page) !== JSON.stringify(段)) {
        // 经历段变化：PATCH 经历主体，再 diff 嵌套项目
        const body = 转经历写入(段);
        const 旧经历 = previous.experiences.find((e) => e.id === 段.编号)!;
        写入步骤们.push(() => 发出<BFF简历>(
          { path: `/api/v1/me/resume/experiences/${段.编号}`, method: 'PATCH', body, ifMatch: 修订etag(旧经历.revision) },
          跟踪 ? { 种类: 'experience-update', 资源编号: 段.编号, 请求体: { ...body }, ifMatch: 旧经历.revision, 阶段: 'prepared' as const } : null,
          (r) => 条目更新回执(r.result, (dto) => 找经历(dto, 段.编号)),
        ).then((r) => r.result));
        写入步骤们.push(...项目步骤(段, 旧经历, 跟踪, 发出));
      }
    }
    for (const 旧 of previous.experiences) {
      if (!next.经历.some((段) => 段.编号 === 旧.id)) {
        const id = 旧.id;
        const ifMatch = 修订etag(旧.revision);
        写入步骤们.push(() => 发出<BFF简历>(
          { path: `/api/v1/me/resume/experiences/${id}`, method: 'DELETE', ifMatch },
          跟踪 ? { 种类: 'experience-delete', 资源编号: id, ifMatch: 旧.revision, 阶段: 'prepared' as const } : null,
          () => ({}),
        ).then((r) => r.result));
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
        写入步骤们.push(() => 发出<BFF简历条目变更>(
          { path: '/api/v1/me/resume/educations', method: 'POST', body, 幂等: true },
          跟踪 ? { 种类: 'education-create', 本地编号: 段.编号, 请求体: { ...body } as Record<string, unknown>, 阶段: 'prepared' as const } : null,
          (r) => 条目创建回执(r.result),
        ).then((r) => r.result));
      } else if (稳定序列化(旧Page) !== 稳定序列化(段)) {
        const body = 转教育写入(段);
        const 旧教育 = previous.educations.find((e) => e.id === 段.编号)!;
        写入步骤们.push(() => 发出<BFF简历>(
          { path: `/api/v1/me/resume/educations/${段.编号}`, method: 'PATCH', body, ifMatch: 修订etag(旧教育.revision) },
          跟踪 ? { 种类: 'education-update', 资源编号: 段.编号, 请求体: { ...body }, ifMatch: 旧教育.revision, 阶段: 'prepared' as const } : null,
          (r) => 条目更新回执(r.result, (dto) => 找教育(dto, 段.编号)),
        ).then((r) => r.result));
      }
    }
    for (const 旧 of previous.educations) {
      if (!next.教育.some((段) => 段.编号 === 旧.id)) {
        const id = 旧.id;
        const ifMatch = 修订etag(旧.revision);
        写入步骤们.push(() => 发出<BFF简历>(
          { path: `/api/v1/me/resume/educations/${id}`, method: 'DELETE', ifMatch },
          跟踪 ? { 种类: 'education-delete', 资源编号: id, ifMatch: 旧.revision, 阶段: 'prepared' as const } : null,
          () => ({}),
        ).then((r) => r.result));
      }
    }

    // certificates
    const 旧证书PageMap = new Map(旧页面.证书.map((c) => [c.编号, c]));
    for (const 段 of next.证书) {
      const 旧Page = 旧证书PageMap.get(段.编号);
      if (!旧Page) {
        const body = 转证书写入(段);
        写入步骤们.push(() => 发出<BFF简历条目变更>(
          { path: '/api/v1/me/resume/certificates', method: 'POST', body, 幂等: true },
          跟踪 ? { 种类: 'certificate-create', 本地编号: 段.编号, 请求体: { ...body } as Record<string, unknown>, 阶段: 'prepared' as const } : null,
          (r) => 条目创建回执(r.result),
        ).then((r) => r.result));
      } else if (JSON.stringify(旧Page) !== JSON.stringify(段)) {
        const body = 转证书写入(段);
        const 旧证书 = previous.certificates.find((c) => c.id === 段.编号)!;
        写入步骤们.push(() => 发出<BFF简历>(
          { path: `/api/v1/me/resume/certificates/${段.编号}`, method: 'PATCH', body, ifMatch: 修订etag(旧证书.revision) },
          跟踪 ? { 种类: 'certificate-update', 资源编号: 段.编号, 请求体: { ...body }, ifMatch: 旧证书.revision, 阶段: 'prepared' as const } : null,
          (r) => 条目更新回执(r.result, (dto) => 找证书(dto, 段.编号)),
        ).then((r) => r.result));
      }
    }
    for (const 旧 of previous.certificates) {
      if (!next.证书.some((段) => 段.编号 === 旧.id)) {
        const id = 旧.id;
        const ifMatch = 修订etag(旧.revision);
        写入步骤们.push(() => 发出<BFF简历>(
          { path: `/api/v1/me/resume/certificates/${id}`, method: 'DELETE', ifMatch },
          跟踪 ? { 种类: 'certificate-delete', 资源编号: id, ifMatch: 旧.revision, 阶段: 'prepared' as const } : null,
          () => ({}),
        ).then((r) => r.result));
      }
    }

    try {
      for (const 步 of 写入步骤们) await 步();
    } catch (error) {
      // 权威回读失败不得顶替原 mutation 错误；成功条目的回执已在失败前经 跟踪.已确认 落进草稿，
      // 不因回读失败丢已知创建身份。
      try {
        const { result: 权威 } = await 请求<BFF简历>({ path: '/api/v1/me/resume' });
        if (error instanceof BFF错误) error.权威简历 = 权威;
      } catch {
        // 回读失败：保留原始错误
      }
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

  return {
    读取简历() {
      return 请求<BFF简历>({ path: '/api/v1/me/resume' }).then((r) => 从BFF简历(r.result));
    },
    保存简历,
  };
}
