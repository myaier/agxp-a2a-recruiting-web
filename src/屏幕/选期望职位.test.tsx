// 选期望职位 页面测试（Task 7 / B 契约）：
// 两模式仅一套 JSX（期望职位选择正文）。Backend 由页面局部钩子按需 查询Taxonomy('job-categories')：
// 挂载读根 → 自动选首根 → 自动读二级 → 串行自动加载各组三级首屏（无第二次点击）；
// 二级是小标题不是按钮，一级高亮持续绑定一级 ID；翻页走各级「加载更多」。
// 页面保留真实引用、上限（onboarding 10 / 意向 1）、保存与跳转；点职位只切换临时选择。

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import 选期望职位 from './选期望职位';
import type { BFFTaxonomyItem } from '../数据/BFF契约';
import type { 目录页 } from '../数据/招聘数据源类型';

/** 造一枚目录项 */
function 节点(id: string, 名称: string, 覆盖: Partial<BFFTaxonomyItem> = {}): BFFTaxonomyItem {
  return { id, display_name: 名称, parent_id: null, selectable: false, has_children: false, ...覆盖 };
}

function 页(items: BFFTaxonomyItem[], nextCursor: string | null = null, catalogVersion = 'v2'): 目录页<BFFTaxonomyItem> {
  return { items, nextCursor, catalogVersion };
}

const mock返回 = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mock应用状态: any;

vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 返回: mock返回 }) }));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

function render选期望职位(选项: {
  数据源: 'backend' | 'mock';
  来源?: '意向' | null;
  查询Taxonomy?: ReturnType<typeof vi.fn>;
  引导预填?: { 城市们: string[]; 职位: string[]; 职位引用们?: { id: string; display_name: string }[]; 城市引用们?: unknown[] } | null;
  意向草稿?: { 期望职位: string; 职位引用?: { id: string; display_name: string } | null };
}) {
  const 派发 = vi.fn();
  mock应用状态 = {
    数据源模式: 选项.数据源,
    目录查询:
      选项.数据源 === 'backend'
        ? {
            查询Location: vi.fn(),
            查询Taxonomy: 选项.查询Taxonomy ?? vi.fn(),
            查询Institution: vi.fn(),
          }
        : null,
    状态: {
      引导预填: 选项.引导预填 === undefined ? { 城市们: ['上海'], 职位: [] } : 选项.引导预填,
      意向草稿: 选项.意向草稿 ?? { 期望职位: '' },
    },
    派发,
  };
  const 初始 = 选项.来源 ? [`/onboard/job?来源=${选项.来源}`] : ['/onboard/job'];
  render(
    <MemoryRouter initialEntries={初始}>
      <选期望职位 />
    </MemoryRouter>,
  );
  return { 派发 };
}

/** 真实三级 fixture（对齐已核验目录快照形状，含同名组/叶子）：
 *  根「产品」下有二级「产品经理」「游戏策划」；「产品经理」组下有同名可选叶子与「AI产品经理」。 */
function 三级查询() {
  return vi.fn(async (_kind: string, query: { parentId?: string; q?: string; cursor?: string }) => {
    if (!query.parentId && !query.q && !query.cursor) {
      return 页([
        节点('tax_42k463flvnxtm6ayeabxhuiequ', '产品', { has_children: true }),
        节点('tax_root_design', '设计', { has_children: true }),
      ]);
    }
    if (query.parentId === 'tax_42k463flvnxtm6ayeabxhuiequ') {
      return 页([
        节点('tax_itkhtoz22mnbizmljydkoyegbi', '产品经理', { parent_id: 'tax_42k463flvnxtm6ayeabxhuiequ', has_children: true }),
        节点('tax_group_game', '游戏策划', { parent_id: 'tax_42k463flvnxtm6ayeabxhuiequ', has_children: true }),
      ]);
    }
    if (query.parentId === 'tax_itkhtoz22mnbizmljydkoyegbi') {
      return 页([
        节点('tax_2sssgq7pajylyrsooukbgorpye', '产品经理', { parent_id: 'tax_itkhtoz22mnbizmljydkoyegbi', selectable: true }),
        节点('tax_leaf_ai', 'AI产品经理', { parent_id: 'tax_itkhtoz22mnbizmljydkoyegbi', selectable: true }),
      ]);
    }
    if (query.parentId === 'tax_group_game') {
      return 页([节点('tax_leaf_game', '游戏策划师', { parent_id: 'tax_group_game', selectable: true })]);
    }
    return 页([]);
  });
}

describe('选期望职位 Backend（B 契约自动分组）', () => {
  beforeEach(() => {
    mock返回.mockClear();
  });

  it('点一级（含挂载自动选首根）后无第二次点击就出现多组标题与叶子；二级是标题不是按钮；一级持续选中', async () => {
    const 查询Taxonomy = 三级查询();
    render选期望职位({ 数据源: 'backend', 查询Taxonomy });
    // 左栏首根自动选中并高亮
    const 产品 = await screen.findByText('产品');
    expect(产品.className).toContain('职大类当前');
    // 多组标题 + 各组三级叶子自动出现（无第二次点击）
    expect(await screen.findByRole('heading', { name: '产品经理' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: '游戏策划' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'AI产品经理' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '游戏策划师' })).toBeTruthy();
    // 同名组与同名叶子并存：叶子是按钮，标题是 heading
    expect(screen.getByRole('button', { name: '产品经理' })).toBeTruthy();
    // 二级标题不可点击（无同名 button 的标题除外——「游戏策划」标题没有对应按钮）
    expect(screen.queryByRole('button', { name: '游戏策划' })).toBeNull();
    // 一级持续选中
    expect(产品.className).toContain('职大类当前');
  });

  it('点三级职位只切换本页临时选择，不保存不派发；保存才回填 职位引用们', async () => {
    const 查询Taxonomy = 三级查询();
    const { 派发 } = render选期望职位({ 数据源: 'backend', 查询Taxonomy });
    await userEvent.click(await screen.findByRole('button', { name: 'AI产品经理' }));
    await userEvent.click(await screen.findByRole('button', { name: '游戏策划师' }));
    // 点选本身零派发、零关闭（页面仍在，已选条出现）
    expect(派发).not.toHaveBeenCalled();
    expect(mock返回).not.toHaveBeenCalled();
    expect(screen.getByText('已选')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'AI产品经理 ✕' })).toBeTruthy();
    // 底部保存才回填
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '存引导预填',
        职位: ['AI产品经理', '游戏策划师'],
        职位引用们: [
          { id: 'tax_leaf_ai', display_name: 'AI产品经理' },
          { id: 'tax_leaf_game', display_name: '游戏策划师' },
        ],
      }),
    );
    expect(mock返回).toHaveBeenCalledTimes(1);
  });

  it('意向来源单选：点第二枚替换第一枚，保存写 职位引用', async () => {
    const 查询Taxonomy = 三级查询();
    const { 派发 } = render选期望职位({ 数据源: 'backend', 来源: '意向', 查询Taxonomy });
    await userEvent.click(await screen.findByRole('button', { name: 'AI产品经理' }));
    await userEvent.click(screen.getByRole('button', { name: '游戏策划师' }));
    expect(screen.queryByRole('button', { name: 'AI产品经理 ✕' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '改意向草稿',
        补丁: expect.objectContaining({
          期望职位: '游戏策划师',
          职位引用: { id: 'tax_leaf_game', display_name: '游戏策划师' },
        }),
      }),
    );
  });

  it('同名不同 ID 的已选条各自独立移除，保存按 ID 各自独立', async () => {
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string }) => {
      if (!query.parentId) return 页([节点('cat_root', '技术', { has_children: true })]);
      if (query.parentId === 'cat_root') return 页([节点('cat_g', '组', { parent_id: 'cat_root', has_children: true })]);
      if (query.parentId === 'cat_g') {
        return 页([
          节点('job_a', '产品经理', { parent_id: 'cat_g', selectable: true }),
          节点('job_b', '产品经理', { parent_id: 'cat_g', selectable: true }),
        ]);
      }
      return 页([]);
    });
    const { 派发 } = render选期望职位({ 数据源: 'backend', 查询Taxonomy });
    const 用户 = userEvent.setup();
    const 两枚 = await waitFor(() => {
      const 全部 = screen.getAllByRole('button', { name: '产品经理' });
      expect(全部).toHaveLength(2);
      return 全部;
    });
    await 用户.click(两枚[0]!);
    await 用户.click(两枚[1]!);
    const chips = screen.getAllByRole('button', { name: '产品经理 ✕' });
    expect(chips).toHaveLength(2);
    await 用户.click(chips[0]!);
    expect(screen.getAllByRole('button', { name: '产品经理 ✕' })).toHaveLength(1);
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '存引导预填',
        职位引用们: [{ id: 'job_b', display_name: '产品经理' }],
      }),
    );
  });

  it('已选预填回显 chips、移除后保存不写回；上限 10 满额后追加无效', async () => {
    const 预填引用们 = Array.from({ length: 10 }, (_, 序) => ({ id: `job_${序}`, display_name: `岗位${序}` }));
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string }) => {
      if (!query.parentId) return 页([节点('cat_root', '产品', { has_children: true })]);
      if (query.parentId === 'cat_root') return 页([节点('cat_g', '组', { parent_id: 'cat_root', has_children: true })]);
      if (query.parentId === 'cat_g') return 页([节点('job_new', '新岗位', { parent_id: 'cat_g', selectable: true })]);
      return 页([]);
    });
    const { 派发 } = render选期望职位({
      数据源: 'backend',
      查询Taxonomy,
      引导预填: { 城市们: ['上海'], 职位: 预填引用们.map((条) => 条.display_name), 职位引用们: 预填引用们 },
    });
    // 预填回显 chips
    expect(await screen.findByText('岗位0 ✕')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /✕/ })).toHaveLength(10);
    // 满额 10：再点新岗位被拦截（轻提示 + 不追加）
    await userEvent.click(screen.getByRole('button', { name: '新岗位' }));
    expect(screen.queryByText('新岗位 ✕')).toBeNull();
    expect(screen.getAllByRole('button', { name: /✕/ })).toHaveLength(10);
    // 移除一枚后保存：引用少一条，新岗位可再选
    await userEvent.click(screen.getByText('岗位0 ✕'));
    expect(screen.queryByText('岗位0 ✕')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '新岗位' }));
    expect(screen.getByText('新岗位 ✕')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '存引导预填',
        职位引用们: [...预填引用们.slice(1), { id: 'job_new', display_name: '新岗位' }],
      }),
    );
  });

  it('快切另一根：旧根慢响应不覆盖新根的组与叶子', async () => {
    let 慢解!: (值: 目录页<BFFTaxonomyItem>) => void;
    const 慢Promise = new Promise<目录页<BFFTaxonomyItem>>((ok) => {
      慢解 = ok;
    });
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string }) => {
      if (!query.parentId) {
        return 页([节点('cat_a', '大类A', { has_children: true }), 节点('cat_b', '大类B', { has_children: true })]);
      }
      if (query.parentId === 'cat_a') return 慢Promise;
      if (query.parentId === 'cat_b') return 页([节点('cat_bg', 'B组', { parent_id: 'cat_b', has_children: true })]);
      if (query.parentId === 'cat_bg') return 页([节点('job_b', 'B叶子', { parent_id: 'cat_bg', selectable: true })]);
      return 页([]);
    });
    render选期望职位({ 数据源: 'backend', 查询Taxonomy });
    await screen.findByText('大类A');
    await userEvent.click(screen.getByText('大类B'));
    expect(await screen.findByText('B叶子')).toBeTruthy();
    // A 的慢二级响应到达：不覆盖 B
    慢解(页([节点('cat_ag', 'A组旧', { parent_id: 'cat_a', has_children: true })]));
    await waitFor(() => expect(查询Taxonomy).toHaveBeenCalled());
    expect(screen.getByText('B组')).toBeTruthy();
    expect(screen.queryByText('A组旧')).toBeNull();
  });

  it('一组失败不清兄弟组；失败组重试后恢复', async () => {
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string }) => {
      if (!query.parentId) return 页([节点('cat_root', '产品', { has_children: true })]);
      if (query.parentId === 'cat_root') {
        return 页([
          节点('cat_g1', '组一', { parent_id: 'cat_root', has_children: true }),
          节点('cat_g2', '组二', { parent_id: 'cat_root', has_children: true }),
        ]);
      }
      if (query.parentId === 'cat_g1') throw new Error('组一失败');
      if (query.parentId === 'cat_g2') return 页([节点('job_2', '叶子二', { parent_id: 'cat_g2', selectable: true })]);
      return 页([]);
    });
    render选期望职位({ 数据源: 'backend', 查询Taxonomy });
    await screen.findByText('组一');
    // 组一失败：错误 + 重试出现在该组位置；组二叶子仍在
    expect(await screen.findByText('请求失败，请稍后再试')).toBeTruthy();
    expect(screen.getByText('叶子二')).toBeTruthy();
    (查询Taxonomy as ReturnType<typeof vi.fn>).mockImplementation((async (_kind: string, query: { parentId?: string }) => {
      if (query.parentId === 'cat_g1') return 页([节点('job_1', '叶子一', { parent_id: 'cat_g1', selectable: true })]);
      if (query.parentId === 'cat_root') {
        return 页([
          节点('cat_g1', '组一', { parent_id: 'cat_root', has_children: true }),
          节点('cat_g2', '组二', { parent_id: 'cat_root', has_children: true }),
        ]);
      }
      if (query.parentId === 'cat_g2') return 页([节点('job_2', '叶子二', { parent_id: 'cat_g2', selectable: true })]);
      return 页([节点('cat_root', '产品', { has_children: true })]);
    }) as never);
    await userEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(await screen.findByText('叶子一')).toBeTruthy();
    expect(screen.getByText('叶子二')).toBeTruthy();
  });

  it('左栏「加载更多」追加新根；右栏「加载更多」对新增二级组自动启动三级首屏', async () => {
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; cursor?: string }) => {
      if (!query.parentId && query.cursor === 'root_c1') {
        return 页([节点('cat_b', '设计', { has_children: true })], null);
      }
      if (!query.parentId && !query.cursor) {
        return 页([节点('cat_a', '产品', { has_children: true })], 'root_c1');
      }
      if (query.parentId === 'cat_a' && query.cursor === 'lv2_c1') {
        return 页([节点('cat_g2', '组二', { parent_id: 'cat_a', has_children: true })], null);
      }
      if (query.parentId === 'cat_a' && !query.cursor) {
        return 页([节点('cat_g1', '组一', { parent_id: 'cat_a', has_children: true })], 'lv2_c1');
      }
      if (query.parentId === 'cat_g1') return 页([节点('job_1', '叶子一', { parent_id: 'cat_g1', selectable: true })]);
      if (query.parentId === 'cat_g2') return 页([节点('job_2', '叶子二', { parent_id: 'cat_g2', selectable: true })]);
      return 页([]);
    });
    render选期望职位({ 数据源: 'backend', 查询Taxonomy });
    await screen.findByText('叶子一');
    // 左栏加载更多
    await userEvent.click(screen.getAllByRole('button', { name: '加载更多' })[0]!);
    expect(await screen.findByText('设计')).toBeTruthy();
    // 右栏加载更多：新增组自动启动三级首屏
    await userEvent.click(screen.getAllByRole('button', { name: '加载更多' })[0]!);
    expect(await screen.findByText('叶子二')).toBeTruthy();
    expect(screen.getByText('组一')).toBeTruthy();
  });

  it('根追加页换版本：根列表整组替换为新版本首屏，重开带 强制刷新', async () => {
    let 根首页调用 = 0;
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; cursor?: string }) => {
      if (query.parentId) return 页([]);
      if (query.cursor === 'root_cur_1') {
        return 页([节点('cat_old', '大类旧页', { has_children: true })], null, 'v3');
      }
      根首页调用 += 1;
      if (根首页调用 === 1) {
        return 页([节点('cat_a', '大类A', { has_children: true })], 'root_cur_1', 'v2');
      }
      return 页([节点('cat_c', '大类C新版', { has_children: true })], null, 'v3');
    });
    render选期望职位({ 数据源: 'backend', 查询Taxonomy });
    await screen.findByText('大类A');
    await userEvent.click(screen.getByRole('button', { name: '加载更多' }));
    await screen.findByText('大类C新版');
    expect(screen.queryByText('大类A')).toBeNull();
    expect(screen.queryByText('大类旧页')).toBeNull();
    expect(
      查询Taxonomy.mock.calls.some(
        (调用) => ((调用 as unknown[])[2] as { 强制刷新?: boolean } | undefined)?.强制刷新 === true,
      ),
    ).toBe(true);
    expect(根首页调用).toBe(2);
  });

  it('无引导预填时保存城市回落为空不是上海（R3-Minor-1）', async () => {
    const 查询Taxonomy = 三级查询();
    const { 派发 } = render选期望职位({ 数据源: 'backend', 查询Taxonomy, 引导预填: null });
    await userEvent.click(await screen.findByRole('button', { name: 'AI产品经理' }));
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '存引导预填',
        城市们: [],
        城市引用们: [],
        职位引用们: [{ id: 'tax_leaf_ai', display_name: 'AI产品经理' }],
      }),
    );
  });

  it('搜索：可选叶子进直接结果平铺，命中的父节点只作同名标题组（不可点击），清空恢复最近根', async () => {
    const 查询Taxonomy = vi.fn(async (_kind: string, query: { parentId?: string; q?: string }) => {
      if (query.q === '产品') {
        return 页([
          节点('tax_leaf_direct', '产品专员', { parent_id: 'x', selectable: true }),
          节点('tax_itkhtoz22mnbizmljydkoyegbi', '产品经理', { parent_id: 'tax_42k4', has_children: true }),
        ]);
      }
      if (!query.parentId && !query.q) {
        return 页([节点('tax_42k4', '产品', { has_children: true })]);
      }
      if (query.parentId === 'tax_42k4') {
        return 页([节点('tax_itkhtoz22mnbizmljydkoyegbi', '产品经理', { parent_id: 'tax_42k4', has_children: true })]);
      }
      if (query.parentId === 'tax_itkhtoz22mnbizmljydkoyegbi') {
        return 页([节点('tax_leaf_ai', 'AI产品经理', { parent_id: 'tax_itkh', selectable: true })]);
      }
      return 页([]);
    });
    render选期望职位({ 数据源: 'backend', 查询Taxonomy });
    await screen.findByText('产品');
    await userEvent.type(screen.getByPlaceholderText('搜索职位'), '产品');
    // 直接命中叶子平铺；命中组标题出现并自动带出职位
    expect(await screen.findByRole('button', { name: '产品专员' })).toBeTruthy();
    expect(await screen.findByRole('heading', { name: '产品经理' })).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'AI产品经理' })).toBeTruthy();
    // 命中组标题不可点击（无同名按钮被渲染为可点职位）
    expect(screen.queryByRole('button', { name: '产品经理' })).toBeNull();
    // 从搜索结果点叶子 → 已选
    await userEvent.click(screen.getByRole('button', { name: '产品专员' }));
    expect(screen.getByText('产品专员 ✕')).toBeTruthy();
    // 清空搜索：恢复最近根的浏览视图（命中组回到二级标题形态）
    await userEvent.clear(screen.getByPlaceholderText('搜索职位'));
    expect(await screen.findByRole('heading', { name: '产品经理' })).toBeTruthy();
    // 已选不因清空搜索丢失
    expect(screen.getByText('产品专员 ✕')).toBeTruthy();
  });
});

describe('选期望职位 Mock', () => {
  beforeEach(() => {
    mock返回.mockClear();
  });

  it('本地职业分类树渲染分组布局，保存带空引用数组', async () => {
    const { 派发 } = render选期望职位({ 数据源: 'mock' });
    const 用户 = userEvent.setup();
    // 左栏第一枚大类按钮
    await 用户.click(screen.getByText('互联网/AI'));
    // 右栏点一个岗位
    await 用户.click(await screen.findByText('Java'));
    // 分组标题是 heading 不是按钮（如「后端开发」标题与同名岗位并存时不混淆）
    expect(screen.getByRole('heading', { name: '后端开发' })).toBeTruthy();
    await 用户.click(screen.getByRole('button', { name: '保存' }));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({
        型: '存引导预填',
        职位: ['Java'],
        职位引用们: [],
      }),
    );
  });

  it('Mock 上限 10：预填 10 枚后再点新岗位被拦截，不追加', async () => {
    const 预填职位们 = Array.from({ length: 10 }, (_, 序) => `岗位${序}`);
    render选期望职位({
      数据源: 'mock',
      引导预填: { 城市们: ['上海'], 职位: 预填职位们 },
    });
    expect(await screen.findByText('岗位0 ✕')).toBeTruthy();
    await userEvent.click(await screen.findByText('Java'));
    expect(screen.queryByText('Java ✕')).toBeNull();
    expect(screen.getAllByRole('button', { name: /✕/ })).toHaveLength(10);
    // 移除一枚后可再选
    await userEvent.click(screen.getByText('岗位0 ✕'));
    await userEvent.click(screen.getByText('Java'));
    expect(screen.getByText('Java ✕')).toBeTruthy();
  });

  it('Mock 搜索平铺命中小类；意向来源单选', async () => {
    render选期望职位({ 数据源: 'mock' });
    // 搜索平铺：跨大类匹配，命中即平铺（空标题组，无二级标题）
    await userEvent.type(screen.getByPlaceholderText('搜索职位'), '产品');
    expect(await screen.findByRole('button', { name: '产品经理' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: '产品经理' })).toBeNull();
    await userEvent.clear(screen.getByPlaceholderText('搜索职位'));
    // 清空恢复最近大类
    expect(await screen.findByRole('heading', { name: '后端开发' })).toBeTruthy();
  });

  it('意向来源单选：预填回显、保存原样写回', async () => {
    const { 派发 } = render选期望职位({ 数据源: 'mock', 来源: '意向', 意向草稿: { 期望职位: 'Java' } });
    // 预填单选回显
    expect(await screen.findByText('Java ✕')).toBeTruthy();
    expect(派发).not.toHaveBeenCalled();
    // 保存原样写回
    await userEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(派发).toHaveBeenCalledWith(
      expect.objectContaining({ 型: '改意向草稿', 补丁: { 期望职位: 'Java' } }),
    );
  });
});