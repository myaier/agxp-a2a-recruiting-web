// 工作经历 · 教育目录（教育学校/专业全屏子视图）
// 由 src/屏幕/工作经历.test.tsx 按冻结归属拆出：教育目录职责（Task 2 学校/专业全屏子视图）。

import {
  mock跳转,
  mock返回,
  mock轻提示,
  mock确认分区,
  mock更新草稿,
  mock应用状态,
  render工作经历,
  登记工作经历,
} from './工作经历.测试辅助';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type 简历教育段 } from '../数据/类型';
import userEvent from '@testing-library/user-event';
import 工作经历 from './工作经历';

登记工作经历(工作经历);

vi.mock('../路由/导航钩子', () => ({ use导航: () => ({ 跳转: mock跳转, 返回: mock返回 }) }));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));
vi.mock('../组件/轻提示', () => ({ 轻提示: mock轻提示 }));

// ── Task 2（editor-catalog-fullscreen）：教育 学校/专业 改为字段点击行 + 全屏子视图 ──
// 父编辑页保持挂载（hidden + 显式 display:none 隔离），子视图是 次级页外壳 的内容兄弟；
// 每次打开把父草稿当前名称复制为搜索初词并查询（空名称 = 空词，不发请求、无候选）；
// 搜索/候选/游标/失败重试都在子视图，关闭即销毁（重复打开按当前名称重查，不为永久空表）；
// 父草稿只在选中有效候选时原子更新（名称+引用一起落、随后只关闭），取消/搜索编辑/翻页
// 都不碰父草稿；Backend 引用只来自所点行的稳定 ID（同名不同 ID 不串、按 ID 标记选中），
// Mock 沿名称落文本不落引用（命中行按名称标记）；失败如实上屏给重试，不伪装成空态；
// 关闭按 A 恢复触发行焦点与父滚动位置，首次挂载不抢焦点；同一实现服务 onboarding 与
// 我的简历两个路由入口。
describe('工作经历 教育学校/专业全屏子视图（Task 2）', () => {
  beforeEach(() => {
    mock跳转.mockClear();
    mock返回.mockClear();
    mock轻提示.mockClear();
    mock确认分区.mockClear();
    mock更新草稿.mockClear();
  });

  /** 存简历 里首条教育段（无则 undefined） */
  function 首条教育(): { 学校: string; 学校引用?: unknown; 专业: string; 专业引用?: unknown } | undefined {
    const 派发 = mock应用状态.派发;
    const 调用 = 派发.mock.calls.find(
      (c: unknown[]) => (c[0] as { 型?: string })?.型 === '存简历',
    )?.[0] as { 教育: { 学校: string; 学校引用?: unknown; 专业: string; 专业引用?: unknown }[] } | undefined;
    return 调用?.教育[0];
  }

  /** 存简历 派发次数（选择/翻页/取消都不该发，完成才发） */
  function 存简历次数(): number {
    return mock应用状态.派发.mock.calls.filter((c: unknown[]) => (c[0] as { 型?: string })?.型 === '存简历').length;
  }

  /** 带双引用的教育段：完成后不会被「请从候选学校/专业中选择」拦下 */
  const 带引用教育: 简历教育段 = {
    编号: 'edu_ref',
    学校: '复旦大学',
    学校引用: { id: 'inst_fudan', display_name: '复旦大学' },
    学历: '硕士',
    专业: '计算机',
    专业引用: { id: 'tax_cs', display_name: '计算机' },
    开始: '2019-09',
    结束: '2023-06',
  };

  const 清华一页 = (id = 'inst_thu') => ({
    items: [{
      id,
      display_name: '清华大学',
      location: { id: 'loc_bj', display_name: '北京', country_name: '中国' },
      selectable: true,
    }],
    nextCursor: null,
    catalogVersion: 'v2',
  });
  const 计算机一页 = () => ({
    items: [{ id: 'tax_cs', display_name: '计算机科学与技术', parent_id: null, selectable: true, has_children: false }],
    nextCursor: null,
    catalogVersion: 'v2',
  });

  it('选中候选原子写名称/引用并只关闭子视图；各自取消不清另一字段引用；保存仍由完成触发', async () => {
    render工作经历({
      数据源: 'backend',
      查询Institution: vi.fn(async (_q: { q?: string }) => 清华一页()),
      查询Taxonomy: vi.fn(async (_kind: string) => 计算机一页()),
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('添加教育经历'));

    // 学校：字段行打开全屏子视图 → 搜索 → 点候选 → 名称+引用落草稿、子视图关闭
    await 用户.click(screen.getByRole('button', { name: /学校名称/ }));
    const 学校层 = await screen.findByRole('dialog', { name: '选择学校' });
    await 用户.type(within(学校层).getByPlaceholderText('搜索学校名称'), '清华');
    await 用户.click(await within(学校层).findByRole('button', { name: '清华大学' }));
    expect(screen.queryByRole('dialog', { name: '选择学校' })).toBeNull();
    expect(screen.getByRole('button', { name: /学校名称/ }).textContent).toContain('清华大学');

    // 专业同走子视图；随后学校子视图只取消 —— 两字段引用都不被清（失败反例：进子页清掉另一字段引用）
    await 用户.click(screen.getByRole('button', { name: /^专业/ }));
    const 专业层 = await screen.findByRole('dialog', { name: '选择专业' });
    await 用户.type(within(专业层).getByPlaceholderText('搜索专业名称'), '计算机');
    await 用户.click(await within(专业层).findByRole('button', { name: '计算机科学与技术' }));
    expect(screen.queryByRole('dialog', { name: '选择专业' })).toBeNull();
    await 用户.click(screen.getByRole('button', { name: /学校名称/ }));
    await screen.findByRole('dialog', { name: '选择学校' });
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '选择学校' })).toBeNull());

    // 选择/取消只写本页草稿：不派发存简历、不调保存资源 —— 保存仍由原表单「完成」触发
    expect(存简历次数()).toBe(0);
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    const 教育 = 首条教育();
    expect(教育?.学校).toBe('清华大学');
    expect(教育?.学校引用).toEqual({ id: 'inst_thu', display_name: '清华大学' });
    expect(教育?.专业).toBe('计算机科学与技术');
    expect(教育?.专业引用).toEqual({ id: 'tax_cs', display_name: '计算机科学与技术' });
  });

  it('打开复制父草稿当前名称为初词并查询；搜索是独立 state，编辑不写父草稿、取消不取消父选择', async () => {
    const 查询Institution = vi.fn(async (q: { q?: string }) => ({
      items:
        q.q === '复旦大学'
          ? [{
              id: 'inst_fudan', display_name: '复旦大学',
              location: { id: 'loc_sh', display_name: '上海', country_name: '中国' }, selectable: true,
            }]
          : q.q === '交通'
            ? [{
                id: 'inst_jt', display_name: '上海交通大学',
                location: { id: 'loc_sh', display_name: '上海', country_name: '中国' }, selectable: true,
              }]
            : [],
      nextCursor: null,
      catalogVersion: 'v2',
    }));
    render工作经历({
      数据源: 'backend',
      查询Institution,
      查询Taxonomy: vi.fn(async () => 计算机一页()),
      教育: [带引用教育],
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('复旦大学')); // 教育卡进编辑页
    const 学校行 = screen.getByRole('button', { name: /学校名称/ });
    expect(学校行.textContent).toContain('复旦大学');
    await 用户.click(学校行);
    const 学校层 = await screen.findByRole('dialog', { name: '选择学校' });

    // 初词 = 父草稿当前名称，打开即按它查询；当前值区域持续可见，目录命中行按 ref ID 标记
    expect((within(学校层).getByPlaceholderText('搜索学校名称') as HTMLInputElement).value).toBe('复旦大学');
    await waitFor(() => expect(查询Institution).toHaveBeenCalledWith(expect.objectContaining({ q: '复旦大学' }), undefined));
    expect(within(学校层).getByText('当前学校').parentElement!.textContent).toContain('复旦大学');
    expect(within(学校层).getByRole('button', { name: '复旦大学' }).textContent).toContain('✓');

    // 搜索用独立 state：改词出别的候选，但父草稿值不动、当前值区域仍是旧已选值
    const 搜索框 = within(学校层).getByPlaceholderText('搜索学校名称') as HTMLInputElement;
    await 用户.clear(搜索框);
    await 用户.type(搜索框, '交通');
    await within(学校层).findByRole('button', { name: '上海交通大学' });
    expect(学校行.textContent).toContain('复旦大学');
    expect(within(学校层).getByText('当前学校').parentElement!.textContent).toContain('复旦大学');

    // 取消（Escape）：父草稿原值与引用保持（取消搜索不更改资源、不取消父选择）
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '选择学校' })).toBeNull());
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    const 教育 = 首条教育();
    expect(教育?.学校).toBe('复旦大学');
    expect(教育?.学校引用).toEqual({ id: 'inst_fudan', display_name: '复旦大学' });
  });

  it('空名称打开保持空词行为：不发目录请求也无候选；输入后才查询', async () => {
    const 查询Institution = vi.fn(async (_q: { q?: string }) => 清华一页());
    render工作经历({
      数据源: 'backend',
      查询Institution,
      查询Taxonomy: vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' })),
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('添加教育经历'));
    await 用户.click(screen.getByRole('button', { name: /学校名称/ }));
    const 学校层 = await screen.findByRole('dialog', { name: '选择学校' });
    expect((within(学校层).getByPlaceholderText('搜索学校名称') as HTMLInputElement).value).toBe('');
    await new Promise((解决) => setTimeout(解决, 320));
    expect(查询Institution).not.toHaveBeenCalled();
    expect(within(学校层).queryByRole('button', { name: '清华大学' })).toBeNull();
    await 用户.type(within(学校层).getByPlaceholderText('搜索学校名称'), '清华');
    await waitFor(() => expect(查询Institution).toHaveBeenCalledWith(expect.objectContaining({ q: '清华' }), undefined));
    await within(学校层).findByText('北京 · 中国');
  });

  it('Backend 同名不同 ID：按稳定键落引用并准确提交', async () => {
    render工作经历({
      数据源: 'backend',
      查询Institution: vi.fn(async (_q: { q?: string }) => ({
        items: [
          {
            id: 'inst_same_a', display_name: '清华大学',
            location: { id: 'loc_bj', display_name: '北京', country_name: '中国' }, selectable: true,
          },
          {
            id: 'inst_same_b', display_name: '清华大学',
            location: { id: 'loc_tw', display_name: '新竹', country_name: '中国' }, selectable: true,
          },
        ],
        nextCursor: null,
        catalogVersion: 'v2',
      })),
      查询Taxonomy: vi.fn(async (_kind: string) => 计算机一页()),
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('添加教育经历'));
    await 用户.click(screen.getByRole('button', { name: /学校名称/ }));
    const 学校层 = await screen.findByRole('dialog', { name: '选择学校' });
    await 用户.type(within(学校层).getByPlaceholderText('搜索学校名称'), '清华');
    // 两行同名：选第二行（不同 ID），副行区分城市
    const 同名行 = await within(学校层).findAllByRole('button', { name: '清华大学' });
    expect(同名行.length).toBe(2);
    await 用户.click(同名行[1]!);
    await 用户.click(screen.getByRole('button', { name: /^专业/ }));
    const 专业层 = await screen.findByRole('dialog', { name: '选择专业' });
    await 用户.type(within(专业层).getByPlaceholderText('搜索专业名称'), '计算机');
    await 用户.click(await within(专业层).findByRole('button', { name: '计算机科学与技术' }));
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    const 教育 = 首条教育();
    expect(教育?.学校).toBe('清华大学');
    expect(教育?.学校引用).toEqual({ id: 'inst_same_b', display_name: '清华大学' });
    expect(教育?.专业引用).toEqual({ id: 'tax_cs', display_name: '计算机科学与技术' });
  });

  it('当前引用按 ref ID 标记同名行：只勾真实引用那一行（Mock 无引用，按名称标记）', async () => {
    render工作经历({
      数据源: 'backend',
      查询Institution: vi.fn(async (_q: { q?: string }) => ({
        items: [
          {
            id: 'inst_dup_a', display_name: '清华大学',
            location: { id: 'loc_bj', display_name: '北京', country_name: '中国' }, selectable: true,
          },
          {
            id: 'inst_dup_b', display_name: '清华大学',
            location: { id: 'loc_tw', display_name: '新竹', country_name: '中国' }, selectable: true,
          },
        ],
        nextCursor: null,
        catalogVersion: 'v2',
      })),
      查询Taxonomy: vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' })),
      教育: [{ ...带引用教育, 学校: '清华大学', 学校引用: { id: 'inst_dup_b', display_name: '清华大学' } }],
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('清华大学'));
    await 用户.click(screen.getByRole('button', { name: /学校名称/ }));
    const 学校层 = await screen.findByRole('dialog', { name: '选择学校' });
    const 同名行 = await within(学校层).findAllByRole('button', { name: '清华大学' });
    expect(同名行.length).toBe(2);
    expect(同名行[0]!.textContent).not.toContain('✓');
    expect(同名行[1]!.textContent).toContain('✓');
  });

  it('目录缺失的旧文本只在当前值区域可见，不伪造可选行；旧文本无引用完成被拦（自由文本不冒充引用）', async () => {
    const 查询Institution = vi.fn(async (_q: { q?: string }) => ({ items: [], nextCursor: null, catalogVersion: 'v2' }));
    render工作经历({
      数据源: 'backend',
      查询Institution,
      查询Taxonomy: vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' })),
      教育: [{ 编号: 'edu_old', 学校: '某未收录大学', 学历: '本科', 专业: '考古学', 开始: '2016-09', 结束: '2020-06' }],
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('某未收录大学'));
    await 用户.click(screen.getByRole('button', { name: /学校名称/ }));
    const 学校层 = await screen.findByRole('dialog', { name: '选择学校' });
    // 初词 = 旧文本并查询，但目录无此项：当前值区域持续可见，不伪造可选行
    expect(within(学校层).getByText('当前学校').parentElement!.textContent).toContain('某未收录大学');
    await waitFor(() => expect(查询Institution).toHaveBeenCalledWith(expect.objectContaining({ q: '某未收录大学' }), undefined));
    expect(within(学校层).queryByRole('button', { name: '某未收录大学' })).toBeNull();
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '选择学校' })).toBeNull());
    // 旧文本没有引用：既有完成守卫拦下，不派发存简历
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    expect(mock轻提示).toHaveBeenCalledWith('请从候选学校中选择');
    expect(存简历次数()).toBe(0);
  });

  it('搜索失败不伪装成空态：错误如实上屏，重试用同一词恢复候选', async () => {
    let 已失败 = false;
    const 查询Institution = vi.fn(async (_q: { q?: string }) => {
      if (!已失败) {
        已失败 = true;
        throw new Error('网络错误');
      }
      return 清华一页();
    });
    render工作经历({
      数据源: 'backend',
      查询Institution,
      查询Taxonomy: vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' })),
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('添加教育经历'));
    await 用户.click(screen.getByRole('button', { name: /学校名称/ }));
    const 学校层 = await screen.findByRole('dialog', { name: '选择学校' });
    await 用户.type(within(学校层).getByPlaceholderText('搜索学校名称'), '清华');
    expect(await within(学校层).findByText('加载失败，请重试')).toBeTruthy();
    expect(within(学校层).queryByRole('button', { name: '清华大学' })).toBeNull();
    // 重试：同一词重发查询，候选恢复（重复打开/重试不能成为永久空列表）
    await 用户.click(within(学校层).getByRole('button', { name: '加载失败，请重试' }));
    expect(await within(学校层).findByRole('button', { name: '清华大学' })).toBeTruthy();
    expect(查询Institution.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('Backend 旧词迟到响应不回填子视图候选（代际守卫沿用）', async () => {
    let 放行旧词: () => void = () => {};
    const 查询Institution = vi.fn(async (q: { q?: string }) => {
      if (q.q === '清') {
        // 旧词的响应悬挂，测试尾段才放行 —— 慢的旧搜索不得覆盖新词结果
        return new Promise((解决) => {
          放行旧词 = () => 解决({
            items: [{
              id: 'inst_old', display_name: '清華舊詞大學',
              location: { id: 'loc_old', display_name: '旧城', country_name: '旧国' }, selectable: true,
            }],
            nextCursor: null,
            catalogVersion: 'v1',
          });
        }) as never;
      }
      return 清华一页();
    });
    render工作经历({
      数据源: 'backend',
      查询Institution,
      查询Taxonomy: vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' })),
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('添加教育经历'));
    await 用户.click(screen.getByRole('button', { name: /学校名称/ }));
    const 学校层 = await screen.findByRole('dialog', { name: '选择学校' });
    const 搜索框 = within(学校层).getByPlaceholderText('搜索学校名称') as HTMLInputElement;
    // 先敲「清」并等过 250ms 防抖（旧词请求在飞），再补「华」触发新代际
    await 用户.type(搜索框, '清');
    await new Promise((解决) => setTimeout(解决, 320));
    await 用户.type(搜索框, '华');
    await within(学校层).findByText('清华大学');
    // 旧词响应此刻才迟到：不得回填候选，也不得清掉新词结果
    await act(async () => {
      放行旧词();
    });
    await new Promise((解决) => setTimeout(解决, 20));
    expect(within(学校层).getByText('清华大学')).toBeTruthy();
    expect(within(学校层).queryByText('清華舊詞大學')).toBeNull();
    expect(within(学校层).queryByText('旧城 · 旧国')).toBeNull();
  });

  // review 终审 Issue 2：加载更多在飞时改词 —— 换词 effect 必须同步复位 加载中，
  // 否则迟到响应被代际作废、finally 守卫跳过重置，新搜索的 加载更多 永久「加载中…」并禁用。
  it('加载更多在飞时改词：新搜索结果可正常翻页，不卡永久加载中', async () => {
    let 放行旧游标页: () => void = () => {};
    const 查询Institution = vi.fn(async (q: { q?: string; cursor?: string }) => {
      if (q.q === '清' && !q.cursor) {
        return {
          items: [{
            id: 'inst_thu', display_name: '清华大学',
            location: { id: 'loc_bj', display_name: '北京', country_name: '中国' }, selectable: true,
          }],
          nextCursor: 'c1',
          catalogVersion: 'v2',
        };
      }
      if (q.cursor === 'c1') {
        // 追加页请求悬挂，改词后才放行 —— 作废的响应不得把 加载中 永久挂起
        return new Promise((解决) => {
          放行旧游标页 = () => 解决({
            items: [{
              id: 'inst_pk', display_name: '北京大學',
              location: { id: 'loc_bj2', display_name: '北京', country_name: '中国' }, selectable: true,
            }],
            nextCursor: null,
            catalogVersion: 'v2',
          });
        }) as never;
      }
      if (q.q === '华' && !q.cursor) {
        return {
          items: [{
            id: 'inst_hust', display_name: '华中科技大学',
            location: { id: 'loc_wh', display_name: '武汉', country_name: '中国' }, selectable: true,
          }],
          nextCursor: 'c2',
          catalogVersion: 'v2',
        };
      }
      return {
        items: [{
          id: 'inst_hust2', display_name: '华中农业大学',
          location: { id: 'loc_wh2', display_name: '武汉', country_name: '中国' }, selectable: true,
        }],
        nextCursor: null,
        catalogVersion: 'v2',
      };
    });
    render工作经历({
      数据源: 'backend',
      查询Institution,
      查询Taxonomy: vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' })),
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('添加教育经历'));
    await 用户.click(screen.getByRole('button', { name: /学校名称/ }));
    const 学校层 = await screen.findByRole('dialog', { name: '选择学校' });
    const 搜索框 = within(学校层).getByPlaceholderText('搜索学校名称') as HTMLInputElement;
    // 搜「清」出带游标结果 → 点加载更多（追加页请求在飞）
    await 用户.type(搜索框, '清');
    await within(学校层).findByRole('button', { name: '清华大学' });
    await 用户.click(within(学校层).getByRole('button', { name: '加载更多' }));
    expect(within(学校层).getByRole('button', { name: '加载更多' }).textContent).toBe('加载中…');
    expect(within(学校层).getByRole('button', { name: '加载更多' })).toHaveProperty('disabled', true);
    // 在飞时改词：代际 +1、游标清空，加载中 必须同步复位
    await 用户.clear(搜索框);
    await 用户.type(搜索框, '华');
    await within(学校层).findByRole('button', { name: '华中科技大学' });
    expect(within(学校层).getByRole('button', { name: '加载更多' }).textContent).toBe('加载更多');
    expect(within(学校层).getByRole('button', { name: '加载更多' })).toHaveProperty('disabled', false);
    // 迟到响应此刻作废：不得回填，也不得把加载中 拉回 true
    await act(async () => {
      放行旧游标页();
    });
    await new Promise((解决) => setTimeout(解决, 20));
    expect(within(学校层).queryByRole('button', { name: '北京大學' })).toBeNull();
    // 新搜索结果带游标：加载更多 可点并按新游标翻页（修复前永久禁用）
    await 用户.click(within(学校层).getByRole('button', { name: '加载更多' }));
    await within(学校层).findByRole('button', { name: '华中农业大学' });
    expect(查询Institution).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: '华', cursor: 'c2' }),
      undefined,
    );
  });

  it('学校追加页返回不同版本：丢弃累计页与游标，从第一页重开；后续游标是新版本的', async () => {
    const 页 = (items: unknown[], nextCursor: string | null, 版本: string) => ({ items, nextCursor, catalogVersion: 版本 });
    const 查询Institution = vi.fn(async (q: { q?: string; cursor?: string }, 选项?: { 强制刷新?: boolean }) => {
      if (q.q === '清' && !q.cursor) {
        return 选项?.强制刷新
          ? 页([{ id: 'inst_v2', display_name: '復旦大學', location: { id: 'loc_sh', display_name: '上海', country_name: '中国' } }], 'inst_cur_v2', 'v2')
          : 页([{ id: 'inst_v1', display_name: '清华大学', location: { id: 'loc_bj', display_name: '北京', country_name: '中国' } }], 'inst_cur_v1', 'v1');
      }
      if (q.cursor === 'inst_cur_v1') {
        // 追加页来自新快照：不与 v1 首页合并，触发重开
        return 页([{ id: 'inst_old', display_name: '北京大學', location: { id: 'loc_bj2', display_name: '北京', country_name: '中国' } }], null, 'v2');
      }
      return 页([], null, 'v2');
    });
    render工作经历({
      数据源: 'backend',
      查询Taxonomy: vi.fn(async () => 页([], null, 'v2')),
      查询Institution,
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('添加教育经历'));
    await 用户.click(screen.getByRole('button', { name: /学校名称/ }));
    const 学校层 = await screen.findByRole('dialog', { name: '选择学校' });
    const 搜索框 = within(学校层).getByPlaceholderText('搜索学校名称') as HTMLInputElement;
    await 用户.type(搜索框, '清');
    await new Promise((解决) => setTimeout(解决, 320));
    await within(学校层).findByText('北京 · 中国');
    // 翻页：追加页换版本 → 不做 v1∪v2 合并，重开出 v2 第一页
    await 用户.click(within(学校层).getByRole('button', { name: '加载更多' }));
    await within(学校层).findByText('復旦大學');
    expect(within(学校层).queryByText('北京大學')).toBeNull();
    expect(within(学校层).queryByText('清华大学')).toBeNull();
    // 后续翻页用 v2 的游标
    const 重开调用数 = 查询Institution.mock.calls.length;
    await 用户.click(within(学校层).getByRole('button', { name: '加载更多' }));
    await waitFor(() => expect(查询Institution.mock.calls.length).toBeGreaterThan(重开调用数));
    expect(查询Institution).toHaveBeenNthCalledWith(
      重开调用数 + 1,
      expect.objectContaining({ q: '清', cursor: 'inst_cur_v2' }),
      undefined,
    );
  });

  it('Mock：名录子串候选/分页/按名称标记，选中落文本不落引用且只关闭；完成无引用门槛', async () => {
    render工作经历({
      数据源: 'mock',
      教育: [{ 编号: 'edu_m', 学校: '清华大学', 学历: '本科', 专业: '软件工程', 开始: '2016-09', 结束: '2020-06' }],
    });
    const 用户 = userEvent.setup();
    await 用户.click(screen.getByText('清华大学'));
    await 用户.click(screen.getByRole('button', { name: /学校名称/ }));
    const 学校层 = await screen.findByRole('dialog', { name: '选择学校' });
    // 初词复制：按当前名称过滤名录，命中行按名称标记 ✓
    expect((within(学校层).getByPlaceholderText('搜索学校名称') as HTMLInputElement).value).toBe('清华大学');
    expect(within(学校层).getByRole('button', { name: '清华大学' }).textContent).toContain('✓');
    // 搜索独立：改词出全名录子串命中，首页 8 条后「加载更多」翻页
    const 搜索框 = within(学校层).getByPlaceholderText('搜索学校名称') as HTMLInputElement;
    await 用户.clear(搜索框);
    await 用户.type(搜索框, '大学');
    await within(学校层).findByRole('button', { name: '清华大学' });
    expect(within(学校层).queryByRole('button', { name: '同济大学' })).toBeNull();
    await 用户.click(within(学校层).getByRole('button', { name: '加载更多' }));
    await within(学校层).findByText('同济大学');
    // 选另一所：名称落父草稿（Mock 不落引用），子视图关闭
    await 用户.click(within(学校层).getByRole('button', { name: '复旦大学' }));
    expect(screen.queryByRole('dialog', { name: '选择学校' })).toBeNull();
    expect(screen.getByRole('button', { name: /学校名称/ }).textContent).toContain('复旦大学');
    await 用户.click(screen.getByRole('button', { name: '完成' }));
    const 教育 = 首条教育();
    expect(教育?.学校).toBe('复旦大学');
    expect(教育?.学校引用).toBeUndefined();
  });

  it('打开时父编辑页 hidden 保持挂载且子视图在 wrapper 外；关闭恢复触发行焦点与滚动；首次挂载不抢焦点', async () => {
    render工作经历({ 数据源: 'mock' });
    const 用户 = userEvent.setup();
    // 首次挂载不恢复焦点
    expect(document.activeElement).toBe(document.body);
    await 用户.click(screen.getByText('添加教育经历'));
    const 学校行 = screen.getByRole('button', { name: /学校名称/ });
    const 滚动节点 = 学校行.closest('.滚动区') as HTMLElement;
    expect(滚动节点).toBeTruthy();
    滚动节点.scrollTop = 96;
    await 用户.click(学校行);
    const 学校层 = await screen.findByRole('dialog', { name: '选择学校' });
    // 父编辑页 wrapper hidden + 显式 display:none；全屏子视图不在 hidden 祖先里
    const 隐藏区 = document.querySelector('div[hidden]') as HTMLElement;
    expect(隐藏区).toBeTruthy();
    expect(隐藏区.style.display).toBe('none');
    expect(隐藏区.contains(学校层)).toBe(false);
    // 父表单没有卸载（失败反例：返回卸载整个教育表单）——学校行还在 DOM 里，只是退出无障碍树
    expect(隐藏区.contains(学校行)).toBe(true);
    expect(screen.queryByRole('button', { name: /学校名称/ })).toBeNull();
    // Escape 关闭：焦点回触发行、滚动还原，教育表单原样恢复
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '选择学校' })).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /学校名称/ }));
    expect(滚动节点.scrollTop).toBe(96);
    expect(screen.getByRole('button', { name: '完成' })).toBeTruthy();
  });

  it('同一实现服务两个路由入口：onboarding 旅程与我的简历日常编辑都走同一子视图选中并保存', async () => {
    const 走完选中 = async () => {
      const 用户 = userEvent.setup();
      await 用户.click(screen.getByText('复旦大学'));
      await 用户.click(screen.getByRole('button', { name: /学校名称/ }));
      const 学校层 = await screen.findByRole('dialog', { name: '选择学校' });
      await 用户.type(within(学校层).getByPlaceholderText('搜索学校名称'), '清华');
      await 用户.click(await within(学校层).findByRole('button', { name: '清华大学' }));
      await 用户.click(screen.getByRole('button', { name: '完成' }));
      expect(首条教育()?.学校).toBe('清华大学');
      expect(首条教育()?.学校引用).toEqual({ id: 'inst_thu', display_name: '清华大学' });
    };
    const 通用选项 = {
      数据源: 'backend' as const,
      查询Institution: vi.fn(async (_q: { q?: string }) => 清华一页()),
      查询Taxonomy: vi.fn(async () => 计算机一页()),
      教育: [带引用教育],
    };

    // 入口一：onboarding 注册旅程（后端 + 引导预填在场，草稿走建档）
    const 旅程 = render工作经历({ ...通用选项, 建档: { 资料: { 教育: [带引用教育] } } });
    await 走完选中();
    旅程.卸载();

    // 入口二：我的简历日常编辑（无旅程标记，直接写全局切片）
    render工作经历({ ...通用选项 });
    await 走完选中();
  });
});
