// 发布岗位页测试的共用桩与构造辅助：mock 桩函数、组织域桩状态构造、抽屉/薪资交互
// 与 JD 导入入口辅助。由 src/屏幕/发布岗位.test.tsx 按冻结归属拆出时提取；
// 每个测试文件各自实例化本模块（vitest 按文件隔离），不跨文件共享状态。
// 原文件头注：
// 发布岗位页 Backend 提交测试（Task 7）：
// 编辑保存成功前不导航；await 操作.更新岗位 落定后才返回。
// Backend 选择器：选类别候选 + 选城市候选 → 发布带 类别引用/地点引用（id+display_name）；
// 手输城市不选候选 → 发布被拦（操作.发布岗位 不调用）。
// Mock 下 操作 内部同步 dispatch，DOM/流程由现有 onboarding E2E 覆盖。

import { screen, within } from '@testing-library/react';
import { vi } from 'vitest';
import { 页面岗位样本, BFF招聘方档案样本, BFF组织搜索项样本 } from '../测试/BFF样本';
import userEvent from '@testing-library/user-event';

export const mock返回 = vi.fn();
export const mock进企业主壳 = vi.fn();
export const mock替换跳转 = vi.fn();
export const mock跳转 = vi.fn();
export const mock更新岗位 = vi.fn();
export const mock发布岗位 = vi.fn();
export const mock删除岗位 = vi.fn();
export const mock创建JD导入 = vi.fn();
export const mock读取JD导入 = vi.fn();
// 合同 C：公司选择行走 组织操作 的目录三操作
export const mock搜索组织 = vi.fn();
export const mock创建组织 = vi.fn();
export const mock读取目录企业 = vi.fn();

// P4 互认 Task 3：结构化要求确认勾选框的可访问名称（label 内 span 文案），测试与实现共用
export const 结构化确认文案 =
  '我已确认经验和学历设置将作为自动匹配依据；补充要求不会被自动解析。修改上述内容后需要重新确认。';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let mock应用状态: any;

/** 轻提示 是挂在 document.body 上的纯 DOM 单例，RTL cleanup 不清它。
 *  每个用例开头清一次，保证「有没有弹这条」问的是本用例自己弹的。 */
export function 清空轻提示() {
  for (const 节点 of Array.from(document.body.children)) {
    const 元素 = 节点 as HTMLElement;
    if (元素.style.position === 'fixed' && 元素.style.zIndex === '999') 元素.innerHTML = '';
  }
}

export function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

/** 合同 C：经公司选择抽屉选一家企业（搜索词触发 debounce 候选查询后点候选）。
 *  搜索回执按所选企业覆盖缺省桩，保证抽屉里点得到这一行。 */
export async function 经抽屉选企业(
  用户: ReturnType<typeof userEvent.setup>,
  项: { organization_id: string; display_name: string },
) {
  mock搜索组织.mockResolvedValue({
    items: [{ ...项, legal_name: null, verification_status: 'verified' as const }],
    next_cursor: null,
  });
  await 用户.type(await screen.findByPlaceholderText('输入公司名称'), 项.display_name);
  await 用户.click(await screen.findByRole('button', { name: new RegExp(项.display_name) }, { timeout: 3000 }));
}

/** Task 3：月薪主入口改选择行 —— 点薪资选择行打开薪资区间层双滚轮，
 *  两列点档后「确定」回填原字符串字段（取消则零回填）。 */
export async function 设月薪带(
  用户: ReturnType<typeof userEvent.setup>,
  下: number,
  上: number,
) {
  await 用户.click(screen.getByRole('button', { name: '薪资下限' }));
  await screen.findByRole('listbox', { name: '薪资下限' });
  await 用户.click(within(screen.getByRole('listbox', { name: '薪资下限' })).getByRole('option', { name: String(下) }));
  await 用户.click(within(screen.getByRole('listbox', { name: '薪资上限' })).getByRole('option', { name: String(上) }));
  await 用户.click(screen.getByRole('button', { name: '确定' }));
}

/** 发岗前置校验读的桩状态形状：组织链三字段 + 合同 C 的 招聘方档案（默认无 → 无企业默认）。 */
export type 组织覆盖 = {
  企业关系列表?: unknown[];
  当前企业关系编号?: string | null;
  未认证公司声明?: string;
  企业认证?: { 姓名: string; 公司: string };
  招聘方档案?: typeof BFF招聘方档案样本 | null;
};

export function 组基础状态(覆盖: 组织覆盖 = {}) {
  return {
    岗位列表: [页面岗位样本],
    企业候选列表: [],
    企业关系列表: 覆盖.企业关系列表 ?? [],
    当前企业关系编号: 覆盖.当前企业关系编号 ?? null,
    未认证公司声明: 覆盖.未认证公司声明 ?? '星河科技',
    企业认证: 覆盖.企业认证 ?? { 姓名: '林澈', 公司: 'Mock 公司' },
    // 合同 C：企业默认来自 招聘方档案.organization_ref；缺省 null = 无默认，必须用户选择
    招聘方档案: 覆盖.招聘方档案 ?? null,
  };
}

/** 默认 Mock 桩：数据源模式 undefined → 是后端=false，与原 Mock 测试同形 */
export function 置Mock应用状态(覆盖: 组织覆盖 = {}) {
  mock应用状态 = {
    状态: 组基础状态(覆盖),
    派发: vi.fn(),
    操作: { 更新岗位: mock更新岗位, 发布岗位: mock发布岗位, 删除岗位: mock删除岗位 },
  };
}

/** Backend 桩：数据源模式 'backend' + 目录查询 seam（查询Taxonomy/查询Location 可注入）
 *  + 合同 C 的 组织操作 三方法（企业选择行 / 档案默认读取） */
export function 置Backend应用状态(
  查询Taxonomy: ReturnType<typeof vi.fn>,
  查询Location: ReturnType<typeof vi.fn>,
  覆盖: 组织覆盖 = {},
) {
  // 组织操作三方法缺省回执：抽屉搜索能点中一家公司、按 ID 读取能恢复名称。
  // 用例需要慢/失败读取时自行覆盖。
  mock搜索组织.mockReset();
  mock创建组织.mockReset();
  mock读取目录企业.mockReset();
  mock搜索组织.mockResolvedValue({ items: [BFF组织搜索项样本], next_cursor: null });
  mock创建组织.mockResolvedValue({ organization: BFF组织搜索项样本, created: true });
  mock读取目录企业.mockResolvedValue(BFF组织搜索项样本);
  mock应用状态 = {
    状态: 组基础状态(覆盖),
    派发: vi.fn(),
    操作: {
      更新岗位: mock更新岗位, 发布岗位: mock发布岗位, 删除岗位: mock删除岗位,
      创建JD导入: mock创建JD导入, 读取JD导入: mock读取JD导入,
      搜索组织: mock搜索组织, 创建组织: mock创建组织, 读取目录企业: mock读取目录企业,
    },
    数据源模式: 'backend',
    // JD 导入入口按当前角色守卫：缺省给 recruiter 主体，用例可按需改写
    后端状态: { 主体: { subject_id: 'sub_1', roles: [], last_used_role: 'recruiter' } },
    目录查询: {
      查询Taxonomy,
      查询Location,
      查询Institution: vi.fn(),
    },
  };
}

/** 通过现有 JD 导入入口设置公开要求；第三步只允许编辑私有偏好。 */
export async function 导入公开要求(要求: string) {
  mock创建JD导入.mockResolvedValue({
    import_id: 'jdi_0123456789abcdef0123456789abcdef', status: 'succeeded',
    created_at: '2026-09-03T01:02:03Z', updated_at: '2026-09-03T01:02:06Z',
    suggestion: {
      title: null, recruitment_type: null, workplace_mode: null, office_location: null,
      description: null, requirements: 要求, education_requirement: null,
      experience_requirement: null, category_source_name: null, location_source_name: null, keywords: [],
    },
  });
  const 用户 = userEvent.setup();
  await 用户.upload(screen.getByLabelText('上传 JD 文件'), new File(['%PDF-1.7'], 'role.pdf', { type: 'application/pdf' }));
  await 用户.click(screen.getByRole('button', { name: '同意并继续' }));
}
