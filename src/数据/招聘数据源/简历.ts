// 简历域数据源：BFF /api/v1/me/resume 的读取与分区 diff 保存。
// 从 HTTP招聘数据源 按真实后端 owner 拆出，协议代码（path / method / body / If-Match / 幂等 / 分区 diff /
// 嵌套项目 / 中途失败 GET 权威快照）原样搬移，不改 URL、body、DTO 校验或错误透传。接口失败绝不回退 Mock。

import { BFF错误, type BFF请求选项, type BFF响应 } from '../HTTP客户端';
import type { BFF简历, BFF经历, BFF项目, BFF教育, BFF证书 } from '../BFF契约';
import type { 页面简历快照, 页面简历写入 } from '../招聘数据源类型';
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

export interface 简历数据源 {
  读取简历(): Promise<页面简历快照>;
  保存简历(next: 页面简历写入, previous: BFF简历): Promise<页面简历快照>;
}

export function 创建简历数据源(请求: 请求函数): 简历数据源 {
  /**
   * 嵌套项目 diff：新 POST、变化 PATCH、消失 DELETE。
   */
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

  return {
    读取简历() {
      return 请求<BFF简历>({ path: '/api/v1/me/resume' }).then((r) => 从BFF简历(r.result));
    },
    保存简历,
  };
}