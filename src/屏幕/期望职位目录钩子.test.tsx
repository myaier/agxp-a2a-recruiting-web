// 期望职位目录钩子 测试（Task 7 / B 契约）：
// 页面局部 Backend 目录控制器 —— 注入现有 查询Taxonomy('job-categories')（签名不变），
// 返回 根项们/组们/各级尾态/按键取项。核心行为：
//   · 真实三级 fixture（含同名组/叶子）：挂载读根 → 自动选第一根 → 自动读二级 →
//     无第二次点击就出现多组标题与三级叶子；一级持续选中；
//   · 各组独立加载/失败/重试/分页，一组失败不清兄弟组，游标不串；
//   · 视图 generation：快速换根/换词、版本换代不回写旧响应；
//   · 搜索：可选叶子进直接结果组；命中的根自动查二级再查三级；命中的二级自动查三级；
//     相同 ID 只展示一次可选项，同名组不合并；清空搜索恢复最近根。

import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, type Mock } from 'vitest';
import { use期望职位目录, type 期望职位目录查询 } from './期望职位目录钩子';
import type { BFFTaxonomyItem } from '../数据/BFF契约';
import type { 目录页 } from '../数据/招聘数据源类型';

/** 造一枚目录项 */
function 节点(id: string, 名称: string, 覆盖: Partial<BFFTaxonomyItem> = {}): BFFTaxonomyItem {
  return { id, display_name: 名称, parent_id: null, selectable: false, has_children: false, ...覆盖 };
}

function 页(items: BFFTaxonomyItem[], nextCursor: string | null = null, catalogVersion = 'v1'): 目录页<BFFTaxonomyItem> {
  return { items, nextCursor, catalogVersion };
}

/** 把 vi.fn 桩收成「钩子接受的查询方法 + 可观察 mock」交集体 */
type 查询桩 = Mock & 期望职位目录查询;

const 桩 = (实现: (kind: string, query: { parentId?: string; q?: string; cursor?: string }) => Promise<目录页<BFFTaxonomyItem>>): 查询桩 =>
  vi.fn(实现) as unknown as 查询桩;

/**
 * 真实三级 fixture（对齐已核验目录快照的形状）：
 *   根「产品」(tax_42k4…) 下有二级分组「产品经理」(tax_itkh…) 与「游戏策划」，
 *   「产品经理」组下有可选叶子「产品经理」(tax_2sss…)（与组同名）与「AI产品经理」。
 */
const 三级查询桩 = (): ReturnType<typeof 桩> =>
  桩(async (_kind, query) => {
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

/** 挂载并等到首根的多组三级叶子自动出现（无第二次点击） */
async function 挂载到三级(查询: 期望职位目录查询, 已选键们: readonly string[] = []) {
  const 视图 = renderHook(() => use期望职位目录({ 查询, 搜索词: '', 已选键们 }));
  await waitFor(() => {
    expect(视图.result.current.组们.flatMap((组) => 组.项们)).toHaveLength(3);
  });
  return 视图;
}

/** 工具：分组标题们 */
const 标题们 = (状态: { 组们: { 标题: string }[] }): string[] => 状态.组们.map((组) => 组.标题);

/** 取指定标题组的项名们（标题为空串 = 直接结果组） */
const 组项名们 = (组们: { 标题: string; 项们: { 名称: string }[] }[], 标题: string): string[] =>
  组们.filter((组) => 组.标题 === 标题).flatMap((组) => 组.项们.map((项) => 项.名称));

describe('use期望职位目录 自动分组', () => {
  it('点一级（含挂载自动选首根）后无第二次点击就出现多组标题与三级叶子，一级持续选中', async () => {
    const 查询 = 三级查询桩();
    const 视图 = await 挂载到三级(查询);
    const 状态 = 视图.result.current;
    // 两枚二级组标题，各带自己的三级叶子
    expect(标题们(状态)).toEqual(['产品经理', '游戏策划']);
    const 叶子 = 状态.组们.flatMap((组) => 组.项们.map((项) => 项.名称));
    expect(叶子).toContain('产品经理'); // 同名叶子与组并存（ID 不同）
    expect(叶子).toContain('AI产品经理');
    expect(叶子).toContain('游戏策划师');
    // 一级持续选中（高亮绑定一级 ID，不因下钻丢失）
    expect(状态.根项们.find((项) => 项.键 === 'tax_42k463flvnxtm6ayeabxhuiequ')?.选中).toBe(true);
    // 挂载只发根/二级/各三级首屏，无需第二次点击
    expect(查询.mock.calls.some((调用) => JSON.stringify(调用[1]).includes('tax_itkhtoz22mnbizmljydkoyegbi'))).toBe(true);
  });

  it('点击另一根：旧根响应不回写，新根的组与叶子出现，根高亮迁移', async () => {
    const { promise: 慢Promise, resolve: 慢Resolve } = deferred<目录页<BFFTaxonomyItem>>();
    const 查询 = 桩(async (_kind, query) => {
      if (!query.parentId) {
        return 页([节点('tax_a', '大类A', { has_children: true }), 节点('tax_b', '大类B', { has_children: true })]);
      }
      if (query.parentId === 'tax_a') return 慢Promise;
      if (query.parentId === 'tax_b') {
        return 页([节点('tax_b_g', 'B组', { parent_id: 'tax_b', has_children: true })]);
      }
      if (query.parentId === 'tax_b_g') {
        return 页([节点('tax_b_l', 'B叶子', { parent_id: 'tax_b_g', selectable: true })]);
      }
      return 页([]);
    });
    const 视图 = renderHook(() => use期望职位目录({ 查询: 查询, 搜索词: '', 已选键们: [] }));
    await waitFor(() => expect(视图.result.current.根项们).toHaveLength(2));
    // 快速切到 B（A 的二级响应还在飞）
    await act(async () => {
      视图.result.current.切换根('tax_b');
    });
    await waitFor(() => expect(组项名们(视图.result.current.组们, 'B组')).toEqual(['B叶子']));
    // A 的慢响应到达：不覆盖 B 的右栏
    await act(async () => {
      慢Resolve(页([节点('tax_a_g', 'A组旧', { parent_id: 'tax_a', has_children: true })]));
    });
    expect(标题们(视图.result.current)).toEqual(['B组']);
    expect(视图.result.current.根项们.find((项) => 项.键 === 'tax_b')?.选中).toBe(true);
    expect(视图.result.current.根项们.find((项) => 项.键 === 'tax_a')?.选中).toBe(false);
  });

  it('一组失败不清兄弟组：失败组独立重试后恢复', async () => {
    const 查询 = 桩(async (_kind, query) => {
      if (!query.parentId) return 页([节点('tax_a', '产品', { has_children: true })]);
      if (query.parentId === 'tax_a') {
        return 页([
          节点('tax_g1', '组一', { parent_id: 'tax_a', has_children: true }),
          节点('tax_g2', '组二', { parent_id: 'tax_a', has_children: true }),
        ]);
      }
      if (query.parentId === 'tax_g1') throw new Error('组一炸了');
      if (query.parentId === 'tax_g2') {
        return 页([节点('tax_l2', '叶子二', { parent_id: 'tax_g2', selectable: true })]);
      }
      return 页([]);
    });
    const 视图 = renderHook(() => use期望职位目录({ 查询: 查询, 搜索词: '', 已选键们: [] }));
    await waitFor(() => expect(视图.result.current.组们).toHaveLength(2));
    // 组一失败带错误与重试入口，组二叶子仍在
    const 组一 = 视图.result.current.组们.find((组) => 组.标题 === '组一');
    const 组二 = 视图.result.current.组们.find((组) => 组.标题 === '组二');
    expect(typeof 组一?.尾态.错误).toBe('string');
    expect(组一?.尾态.错误?.length).toBeGreaterThan(0);
    expect(组二?.项们.map((项) => 项.名称)).toEqual(['叶子二']);
    // 重试组一成功后叶子出现，组二不受影响
    查询.mockImplementation(vi.fn(async (_kind: string, query: { parentId?: string }) => {
      if (query.parentId === 'tax_g1') {
        return 页([节点('tax_l1', '叶子一', { parent_id: 'tax_g1', selectable: true })]);
      }
      if (query.parentId === 'tax_a') {
        return 页([
          节点('tax_g1', '组一', { parent_id: 'tax_a', has_children: true }),
          节点('tax_g2', '组二', { parent_id: 'tax_a', has_children: true }),
        ]);
      }
      if (query.parentId === 'tax_g2') {
        return 页([节点('tax_l2', '叶子二', { parent_id: 'tax_g2', selectable: true })]);
      }
      return 页([节点('tax_a', '产品', { has_children: true })]);
    }));
    await act(async () => {
      组一?.尾态.重试();
    });
    await waitFor(() => {
      expect(组项名们(视图.result.current.组们, '组一')).toEqual(['叶子一']);
    });
    expect(组项名们(视图.result.current.组们, '组二')).toEqual(['叶子二']);
  });

  it('分组加载更多只追加该组，分页不串 cursor', async () => {
    const 查询 = 桩(async (_kind, query) => {
      if (!query.parentId) return 页([节点('tax_a', '产品', { has_children: true })]);
      if (query.parentId === 'tax_a') {
        return 页([
          节点('tax_g1', '组一', { parent_id: 'tax_a', has_children: true }),
          节点('tax_g2', '组二', { parent_id: 'tax_a', has_children: true }),
        ]);
      }
      if (query.parentId === 'tax_g1') {
        return query.cursor === 'g1c1'
          ? 页([节点('tax_l1b', '叶子一B', { parent_id: 'tax_g1', selectable: true })])
          : 页([节点('tax_l1a', '叶子一A', { parent_id: 'tax_g1', selectable: true })], 'g1c1');
      }
      if (query.parentId === 'tax_g2') {
        return query.cursor === 'g2c1'
          ? 页([节点('tax_l2b', '叶子二B', { parent_id: 'tax_g2', selectable: true })])
          : 页([节点('tax_l2a', '叶子二A', { parent_id: 'tax_g2', selectable: true })], 'g2c1');
      }
      return 页([]);
    });
    const 视图 = renderHook(() => use期望职位目录({ 查询: 查询, 搜索词: '', 已选键们: [] }));
    await waitFor(() => expect(视图.result.current.组们).toHaveLength(2));
    const 组一 = 视图.result.current.组们.find((组) => 组.标题 === '组一');
    expect(组一?.尾态.还有).toBe(true);
    // 只对组一加载更多：组二不追加、游标不串
    await act(async () => {
      组一?.尾态.加载更多();
    });
    await waitFor(() => expect(组项名们(视图.result.current.组们, '组一')).toEqual(['叶子一A', '叶子一B']));
    expect(组项名们(视图.result.current.组们, '组二')).toEqual(['叶子二A']);
    expect(查询.mock.calls.some((调用) => (调用[1] as { cursor?: string }).cursor === 'g2c1')).toBe(false);
    // 组一第二次加载更多带着组一的游标
    await act(async () => {
      视图.result.current.组们.find((组) => 组.标题 === '组一')?.尾态.加载更多();
    });
    expect(查询.mock.calls.some((调用) => (调用[1] as { cursor?: string }).cursor === 'g1c1')).toBe(true);
    expect(组项名们(视图.result.current.组们, '组一')).toEqual(['叶子一A', '叶子一B']); // 无更多（第二页游标尽）
  });

  it('追加页换版本：放弃旧游标与缓存，强制刷新从首屏重开，不混版本', async () => {
    let 三级首页调用 = 0;
    const 查询 = 桩(async (_kind, query) => {
      if (!query.parentId) return 页([节点('tax_a', '产品', { has_children: true })]);
      if (query.parentId === 'tax_a') {
        return 页([节点('tax_g1', '组一', { parent_id: 'tax_a', has_children: true })]);
      }
      if (query.parentId === 'tax_g1') {
        if (query.cursor === 'dead_cur') {
          return 页([节点('tax_old', '旧页叶子', { parent_id: 'tax_g1', selectable: true })], null, 'v2');
        }
        三级首页调用 += 1;
        if (三级首页调用 === 1) {
          return 页([节点('tax_l1', '叶子旧', { parent_id: 'tax_g1', selectable: true })], 'dead_cur', 'v1');
        }
        return 页([节点('tax_l1v2', '叶子新', { parent_id: 'tax_g1', selectable: true })], null, 'v2');
      }
      return 页([]);
    });
    const 视图 = renderHook(() => use期望职位目录({ 查询: 查询, 搜索词: '', 已选键们: [] }));
    await waitFor(() => expect(组项名们(视图.result.current.组们, '组一')).toEqual(['叶子旧']));
    await act(async () => {
      视图.result.current.组们[0]?.尾态.加载更多();
    });
    // 换版重开：整组替换为新版本首屏，旧叶子与死游标都不再出现
    await waitFor(() => expect(组项名们(视图.result.current.组们, '组一')).toEqual(['叶子新']));
    expect(
      查询.mock.calls.some(
        (调用) => ((调用 as unknown[])[2] as { 强制刷新?: boolean } | undefined)?.强制刷新 === true,
      ),
    ).toBe(true);
    const 重开后调用数 = 查询.mock.calls.length;
    await act(async () => {
      视图.result.current.组们[0]?.尾态.加载更多();
    });
    expect(查询.mock.calls.slice(重开后调用数).some((调用) => (调用[1] as { cursor?: string }).cursor === 'dead_cur')).toBe(false);
  });

  it('根加载更多追加新根；二级加载更多对新增组自动启动三级首屏', async () => {
    let 根页调用 = 0;
    let 二级页调用 = 0;
    const 查询 = 桩(async (_kind, query) => {
      if (!query.parentId && query.cursor === 'root_c1') {
        return 页([节点('tax_b', '设计', { has_children: true })], null);
      }
      if (!query.parentId && !query.cursor) {
        根页调用 += 1;
        return 页([节点('tax_a', '产品', { has_children: true })], 'root_c1');
      }
      if (query.parentId === 'tax_a' && query.cursor === 'lv2_c1') {
        return 页([节点('tax_g2', '组二', { parent_id: 'tax_a', has_children: true })], null);
      }
      if (query.parentId === 'tax_a' && !query.cursor) {
        二级页调用 += 1;
        return 页([节点('tax_g1', '组一', { parent_id: 'tax_a', has_children: true })], 'lv2_c1');
      }
      if (query.parentId === 'tax_g1') {
        return 页([节点('tax_l1', '叶子一', { parent_id: 'tax_g1', selectable: true })]);
      }
      if (query.parentId === 'tax_g2') {
        return 页([节点('tax_l2', '叶子二', { parent_id: 'tax_g2', selectable: true })]);
      }
      return 页([]);
    });
    const 视图 = renderHook(() => use期望职位目录({ 查询: 查询, 搜索词: '', 已选键们: [] }));
    await waitFor(() => expect(标题们(视图.result.current)).toEqual(['组一']));
    // 根加载更多
    await act(async () => {
      视图.result.current.根尾态.加载更多();
    });
    await waitFor(() => expect(视图.result.current.根项们.map((项) => 项.名称)).toEqual(['产品', '设计']));
    // 二级加载更多：新增组自动加载三级首屏
    await act(async () => {
      视图.result.current.右尾态.加载更多();
    });
    await waitFor(() => {
      expect(标题们(视图.result.current)).toEqual(['组一', '组二']);
      expect(组项名们(视图.result.current.组们, '组二')).toEqual(['叶子二']);
    });
    // 组一的三级没有被重发（首屏只对新增组）
    expect(查询.mock.calls.filter((调用) => (调用[1] as { parentId?: string }).parentId === 'tax_g1')).toHaveLength(1);
  });

  it('按键取项按 ID 返回真实目录项（同名组/叶子以 ID 区分）', async () => {
    const 查询 = 三级查询桩();
    const 视图 = await 挂载到三级(查询);
    const 组项 = 视图.result.current.按键取项('tax_itkhtoz22mnbizmljydkoyegbi');
    const 叶项 = 视图.result.current.按键取项('tax_2sssgq7pajylyrsooukbgorpye');
    expect(组项?.display_name).toBe('产品经理');
    expect(组项?.selectable).toBe(false);
    expect(叶项?.display_name).toBe('产品经理');
    expect(叶项?.selectable).toBe(true);
    expect(叶项?.id).not.toBe(组项?.id);
  });

  it('已选键们回填选中态；无子项组呈现空态而不是加载卡死', async () => {
    const 查询 = 桩(async (_kind, query) => {
      if (!query.parentId) return 页([节点('tax_a', '产品', { has_children: true })]);
      if (query.parentId === 'tax_a') {
        return 页([
          节点('tax_g1', '空组', { parent_id: 'tax_a', has_children: false }),
          节点('tax_g2', '有货组', { parent_id: 'tax_a', has_children: true }),
        ]);
      }
      if (query.parentId === 'tax_g2') {
        return 页([节点('tax_l2', '产品经理', { parent_id: 'tax_g2', selectable: true })]);
      }
      return 页([]);
    });
    const 视图 = renderHook(() => use期望职位目录({ 查询: 查询, 搜索词: '', 已选键们: ['tax_l2'] }));
    await waitFor(() => expect(视图.result.current.组们).toHaveLength(2));
    const 空组 = 视图.result.current.组们.find((组) => 组.标题 === '空组');
    const 有货组 = 视图.result.current.组们.find((组) => 组.标题 === '有货组');
    expect(空组?.项们).toEqual([]);
    expect(空组?.尾态.加载中).toBe(false);
    expect(空组?.尾态.错误).toBeNull();
    expect(空组?.尾态.还有).toBe(false);
    expect(有货组?.项们[0]?.选中).toBe(true);
  });
});

describe('use期望职位目录 搜索', () => {
  it('可选叶子进直接结果组；命中的根自动查二级再查三级；同名组不合并、相同 ID 只展示一次', async () => {
    const 查询 = 桩(async (_kind, query) => {
      if (query.q === '产品') {
        return 页([
          节点('tax_2sssgq7pajylyrsooukbgorpye', '产品经理', { selectable: true }),
          节点('tax_itkhtoz22mnbizmljydkoyegbi', '产品经理', { parent_id: 'tax_42k4', has_children: true }), // 与叶子同名、非可选 → 只作组标题
          节点('tax_root_game', '游戏', { has_children: true }),
        ]);
      }
      if (query.parentId === 'tax_itkhtoz22mnbizmljydkoyegbi') {
        return 页([
          节点('tax_2sssgq7pajylyrsooukbgorpye', '产品经理', { parent_id: 'tax_itkhtoz22mnbizmljydkoyegbi', selectable: true }),
          节点('tax_leaf_ai', 'AI产品经理', { parent_id: 'tax_itkhtoz22mnbizmljydkoyegbi', selectable: true }),
        ]);
      }
      if (query.parentId === 'tax_root_game') {
        return 页([节点('tax_group_g', '电竞', { parent_id: 'tax_root_game', has_children: true })]);
      }
      if (query.parentId === 'tax_group_g') {
        return 页([节点('tax_leaf_g', '电竞选手', { parent_id: 'tax_group_g', selectable: true })]);
      }
      return 页([]);
    });
    const 视图 = renderHook(() => use期望职位目录({ 查询: 查询, 搜索词: '产品', 已选键们: [] }));
    await waitFor(() => expect(组项名们(视图.result.current.组们, '游戏')).toEqual(['电竞选手']));
    const 组们 = 视图.result.current.组们;
    // 直接结果组：空标题、含直接命中的可选叶子（保持 API 次序）
    expect(组项名们(组们, '')).toEqual(['产品经理']);
    // 命中的非可选节点各成同名标题组；同名组不合并（键 = 节点 ID）
    const 产品经理组们 = 组们.filter((组) => 组.标题 === '产品经理');
    expect(产品经理组们).toHaveLength(1);
    expect(产品经理组们[0]?.键).toBe('tax_itkhtoz22mnbizmljydkoyegbi');
    // 命中根「游戏」自动查二级再查三级：组内出现三级叶子
    expect(组们.find((组) => 组.键 === 'tax_root_game')?.项们.map((项) => 项.名称)).toEqual(['电竞选手']);
    // 相同 ID 只展示一次可选项：直接结果里的 产品经理 不再出现在二级命中组里
    expect(产品经理组们[0]?.项们.map((项) => 项.键)).toEqual(['tax_leaf_ai']);
  });

  it('搜索直接结果组追加：第 2 页只进可选叶子，非可选命中不渲染成禁用职位卡', async () => {
    const 查询 = 桩(async (_kind, query) => {
      if (query.q === '产品' && query.cursor === 's_c1') {
        return 页([
          节点('tax_p2_leaf', '产品二页', { selectable: true }),
          // 第 2 页的非可选命中：与首页同口径 —— 只能作组标题，不能变成禁用职位卡
          节点('tax_p2_group', '产品组', { has_children: true }),
        ], null);
      }
      if (query.q === '产品') {
        return 页([节点('tax_p1_leaf', '产品一页', { selectable: true })], 's_c1');
      }
      return 页([]);
    });
    const 视图 = renderHook(() => use期望职位目录({ 查询: 查询, 搜索词: '产品', 已选键们: [] }));
    await waitFor(() => expect(组项名们(视图.result.current.组们, '')).toEqual(['产品一页']));
    const 直接组 = 视图.result.current.组们.find((组) => 组.标题 === '');
    expect(直接组?.尾态.还有).toBe(true);
    // 加载更多：追加页只并入可选叶子
    await act(async () => {
      直接组?.尾态.加载更多();
    });
    await waitFor(() => expect(组项名们(视图.result.current.组们, '')).toEqual(['产品一页', '产品二页']));
    const 直接组2 = 视图.result.current.组们.find((组) => 组.标题 === '');
    // 非可选命中不以禁用卡出现在直接结果组，也不新建命中组（页 2 命中组从简不补建）
    expect(直接组2?.项们.map((项) => 项.键)).toEqual(['tax_p1_leaf', 'tax_p2_leaf']);
    expect(视图.result.current.组们.filter((组) => 组.标题 === '产品组')).toHaveLength(0);
    // 追加后游标已尽，不再有下一页
    expect(直接组2?.尾态.还有).toBe(false);
  });

  it('清空搜索恢复最近根且旧搜索响应不回写；快速换词旧词结果作废', async () => {
    const { promise: 慢Promise, resolve: 慢Resolve } = deferred<目录页<BFFTaxonomyItem>>();
    const 查询 = 桩(async (_kind, query) => {
      if (!query.parentId && !query.q) {
        return 页([节点('tax_a', '产品', { has_children: true })]);
      }
      if (query.parentId === 'tax_a') {
        return 页([节点('tax_g1', '产品经理', { parent_id: 'tax_a', has_children: true })]);
      }
      if (query.parentId === 'tax_g1') {
        return 页([节点('tax_l1', '产品专员', { parent_id: 'tax_g1', selectable: true })]);
      }
      if (query.q === '旧词') return 慢Promise;
      if (query.q === '新词') {
        return 页([节点('tax_new', '新词叶子', { selectable: true })]);
      }
      return 页([]);
    });
    const { result, rerender } = renderHook(
      (词: string) => use期望职位目录({ 查询: 查询, 搜索词: 词, 已选键们: [] }),
      { initialProps: '' },
    );
    await waitFor(() => expect(标题们({ 组们: result.current.组们 })).toEqual(['产品经理']));
    // 输入旧词（响应慢），再快速换新词
    await act(async () => {
      rerender('旧词');
    });
    await act(async () => {
      rerender('新词');
    });
    await waitFor(() => expect(组项名们(result.current.组们, '')).toEqual(['新词叶子']));
    // 旧词响应到达：不回写
    await act(async () => {
      慢Resolve(页([节点('tax_stale', '旧词叶子', { selectable: true })]));
    });
    expect(组项名们(result.current.组们, '')).toEqual(['新词叶子']);
    // 清空搜索：恢复最近根的浏览视图（组标题还在），无搜索组
    await act(async () => {
      rerender('');
    });
    await waitFor(() => expect(标题们({ 组们: result.current.组们 })).toEqual(['产品经理']));
    expect(组项名们(result.current.组们, '产品经理')).toEqual(['产品专员']);
  });
});

/** deferred promise：测试控制异步 resolve 时机 */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((ok) => {
    resolve = ok;
  });
  return { promise, resolve };
}
