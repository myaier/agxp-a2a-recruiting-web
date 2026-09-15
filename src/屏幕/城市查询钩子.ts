// 城市查询钩子：选工作城市 / 岗位城市选择层 / 选择城市 / 引导问答 共用的按需 Location 查询。
// 搜索 250ms debounce；默认目录为固定 CN/TW/HK/MO 四支并发分页（Task 4，origin/main 合同）。
// Mock 分支不调用此钩子（查询Location 传 undefined 时所有方法空操作）。
//
// merge 调和（2026-09-14）：以 origin/main 的四支分页模型为底，叠加 picker 统一 Task 2 的
// 错误/重试兼容字段（错误 = 任一支处于「未成功且不在飞」的失败态；重试 = 四支的分支重试
// 语义，即 加载更多 的计划逻辑——失败/未完成支各取一页原页，成功且游标尽的支不动）。
// use城市搜索 同样保留防抖/全球分页/去重/换词栅栏/版本重同步 + 错误/重试字段。

import { useEffect, useRef, useState } from 'react';
import type { 目录页, Location查询 } from '../数据/招聘数据源类型';
import type { 目录查询选项 } from '../数据/招聘数据源/目录';
import type { BFFLocationItem } from '../数据/BFF契约';
import type { 城市分组配置 } from '../数据/城市与行业';
import { 轻提示 } from '../组件/轻提示';
import { 取后端错误文案 } from '../数据/HTTP客户端';

const 搜索防抖毫秒 = 250;
const 默认页大小 = 20;

export type 查询Location方法 = (q: Location查询, 选项?: 目录查询选项) => Promise<目录页<BFFLocationItem>>;

export interface 分组查询状态 {
  items: BFFLocationItem[];
  加载中: boolean;
  cursor: string | null;
  /** review-r1 P2-1：多 filter 分组（如直辖市四码）的每 filter 游标，加载更多时各取各的下一页 */
  游标们: (string | null)[];
  /** review-cx-r2：每 filter 第一页的 catalogVersion（与 游标们 对齐）—— 追加页只与
   *  同 filter 的首页版本比对，各 filter 版本各自稳定（哪怕互不相同）时不误判换代。 */
  版本们: string[];
  还有: boolean;
  已请求: boolean;
}

/** 按 ID 去重 BFFLocationItem */
function 去重(项们: BFFLocationItem[]): BFFLocationItem[] {
  const seen = new Set<string>();
  const out: BFFLocationItem[] = [];
  for (const 项 of 项们) {
    if (seen.has(项.id)) continue;
    seen.add(项.id);
    out.push(项);
  }
  return out;
}

// ── 默认目录页（Task 4）：固定 CN/TW/HK/MO 四支并发的分页目录 ──
// 每支各自持有累计页/游标/首页版本/首页是否成功；聚合项只来自四支并按 ID 去重，
// 海外精选与搜索没有写入路径。精选配置（数据/城市精选）归产品展示，这里不依赖它。

/** 固定国家顺序：大陆在前，港澳台随后 */
const 默认国家们 = ['CN', 'TW', 'HK', 'MO'] as const;

/** 一支的累计状态：失败不写 null 游标伪造完成 —— 首页未成功/有游标都还有可取页 */
interface 默认分支状态 {
  items: BFFLocationItem[];
  游标: string | null;
  版本: string;
  首页成功: boolean;
}

const 空分支: 默认分支状态 = { items: [], 游标: null, 版本: '', 首页成功: false };

/** 生产接口（Task 4）：不再返回旧「热门项们」—— 热门区改由精选配置渲染。
 *  加载中 = 任一支在飞；还有 = 任一支尚未成功首页或仍有游标（失败待重试也算）。
 *  ref 同步设 pending 防同一事件循环重复调用，useState 供渲染。
 *  picker Task 2 兼容层：错误 = 任一支「未成功且不在飞」的失败文案（失败支被 加载更多/重试
 *  接手时清空）；重试 = 分支重试语义（同 加载更多 计划），失败与成功空页分开。 */
export function use城市默认页(查询Location: 查询Location方法 | undefined) {
  const [分支们, 设分支们] = useState<Record<string, 默认分支状态>>({});
  // picker Task 2：每支的行内错误文案（null = 无失败）；重试接手时按支清空
  const [分支错误们, 设分支错误们] = useState<Record<string, string | null>>({});
  const [加载中, 设加载中] = useState(false);
  const 方法引用 = useRef(查询Location);
  方法引用.current = 查询Location;
  const 分支引用 = useRef(分支们);
  分支引用.current = 分支们;
  const 待定引用 = useRef<Set<string>>(new Set());
  // 代际：卸载/禁用查询后递增，旧完成与 finally 一律不再提交、不再清理
  const 代际 = useRef(0);
  const 可查询 = Boolean(查询Location);

  /** 提交一支的最新状态（函数式合并，并发支互不覆盖）；成功即清该支行内错误 */
  const 提交分支 = (国家: string, 分支: 默认分支状态) => {
    设分支们((旧) => ({ ...旧, [国家]: 分支 }));
    设分支错误们((旧) => (旧[国家] === undefined ? 旧 : { ...旧, [国家]: null }));
  };

  /** 拉一支的一页：游标 null = 首页，非 null = 追加页（含换代重开）。 */
  const 拉一支 = async (国家: string, 游标: string | null, 本代: number) => {
    const 方法 = 方法引用.current;
    if (!方法) return;
    try {
      const 页 =
        游标 === null
          ? await 方法({ countryCode: 国家, limit: 默认页大小 })
          : await 方法({ countryCode: 国家, cursor: 游标, limit: 默认页大小 });
      if (本代 !== 代际.current) return;
      // 跨国家响应拒收：该支整页不提交，保留原游标/可重试状态
      if (页.items.some((项) => 项.country_code !== 国家)) {
        轻提示('城市目录数据异常，请重试');
        // 行内错误可见（spec §6.1 沿既有错误提示处理），重试仍从该支原页开始
        设分支错误们((旧) => ({ ...旧, [国家]: '城市目录数据异常，请重试' }));
        return;
      }
      const 前 = 分支引用.current[国家] ?? 空分支;
      if (游标 !== null && 页.catalogVersion !== 前.版本) {
        // 同支换代：丢弃该支旧累计页/旧游标，以同国家、无游标、强制刷新重读首页；
        // 其他支不重开。重读失败保留「需从首页重开」状态，不拿旧游标重试。
        提交分支(国家, { items: [], 游标: null, 版本: '', 首页成功: false });
        try {
          const 重开 = await 方法({ countryCode: 国家, limit: 默认页大小 }, { 强制刷新: true });
          if (本代 !== 代际.current) return;
          if (重开.items.some((项) => 项.country_code !== 国家)) {
            轻提示('城市目录数据异常，请重试');
            设分支错误们((旧) => ({ ...旧, [国家]: '城市目录数据异常，请重试' }));
            return;
          }
          提交分支(国家, { items: 重开.items, 游标: 重开.nextCursor, 版本: 重开.catalogVersion, 首页成功: true });
        } catch (错误) {
          // 保留「需从首页重开」：下次 加载更多 从该支首页再试
          if (本代 === 代际.current) 设分支错误们((旧) => ({ ...旧, [国家]: 取后端错误文案(错误) }));
        }
        return;
      }
      提交分支(国家, {
        items: 游标 === null ? 页.items : 去重([...前.items, ...页.items]),
        游标: 页.nextCursor,
        版本: 页.catalogVersion,
        首页成功: true,
      });
    } catch (错误) {
      // 失败：首页失败仍待首页、追加失败保留原游标，均可重试。轻提示沿用旧默认
      // 目录的失败反馈（spec §6.1，旧实现首页/加载更多两条路径都提示，故逐支提示，
      // 全部支并发失败时四条同文案属可接受的瞬时噪音）；代际守卫让卸载/禁用后的
      // 迟到失败不再提示。picker Task 2：行内错误同步可见，接手重试时清空。
      if (本代 === 代际.current) {
        轻提示(取后端错误文案(错误));
        设分支错误们((旧) => ({ ...旧, [国家]: 取后端错误文案(错误) }));
      }
    } finally {
      if (本代 === 代际.current) {
        待定引用.current.delete(国家);
        if (待定引用.current.size === 0) 设加载中(false);
      }
    }
  };

  useEffect(() => {
    代际.current += 1;
    const 本代 = 代际.current;
    设分支们({});
    分支引用.current = {};
    设分支错误们({});
    待定引用.current.clear();
    const 方法 = 方法引用.current;
    if (!方法) {
      设加载中(false);
      return;
    }
    // 首次四请求可并发；一支失败不丢弃其他支结果（各支独立 try/catch）
    for (const 国家 of 默认国家们) 待定引用.current.add(国家);
    设加载中(true);
    void Promise.all(默认国家们.map((国家) => 拉一支(国家, null, 本代)));
    return () => { 代际.current += 1; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [可查询]);

  /** 只对未完成/失败可重试的支各取一页，跳过在飞支；成功且游标为 null 的支不再请求 */
  const 加载更多 = async () => {
    const 方法 = 方法引用.current;
    if (!方法) return;
    const 本代 = 代际.current;
    const 计划: { 国家: string; 游标: string | null }[] = [];
    for (const 国家 of 默认国家们) {
      if (待定引用.current.has(国家)) continue;
      const 分支 = 分支引用.current[国家];
      if (!分支 || !分支.首页成功) 计划.push({ 国家, 游标: null });
      else if (分支.游标 !== null) 计划.push({ 国家, 游标: 分支.游标 });
    }
    if (计划.length === 0) return;
    for (const 项 of 计划) 待定引用.current.add(项.国家);
    // picker Task 2：失败支被接手即清行内错误（在飞期间不显示，再失败再置）
    设分支错误们((旧) => {
      if (!计划.some((项) => 旧[项.国家] !== undefined && 旧[项.国家] !== null)) return 旧;
      const 新 = { ...旧 };
      for (const 项 of 计划) 新[项.国家] = null;
      return 新;
    });
    设加载中(true);
    await Promise.all(计划.map((项) => 拉一支(项.国家, 项.游标, 本代)));
  };

  const 项们 = 去重(默认国家们.flatMap((国家) => 分支们[国家]?.items ?? []));
  // 还有 = 任一未成功首页或有游标；查询禁用（Mock）时没有可取的默认页，恒 false
  const 还有 = 可查询 && 默认国家们.some((国家) => {
    const 分支 = 分支们[国家];
    return !分支 || !分支.首页成功 || 分支.游标 !== null;
  });
  // picker Task 2：任一支处于「未成功且不在飞」的失败态时错误可见；接手重试时按支清空
  const 错误 = 默认国家们.flatMap((国家) => (待定引用.current.has(国家) ? [] : [分支错误们[国家] ?? null]))
    .find((文) => 文 !== null) ?? null;

  return { 项们, 加载中, 还有, 加载更多, 错误, 重试: () => void 加载更多() };
}

/** 港澳台固定组标题（Task 4）：无视 admin1 细分，键用用户的中文名称 */
const 港澳台组名们: Record<string, string> = {
  TW: '台湾省',
  HK: '香港特别行政区',
  MO: '澳门特别行政区',
};

/** 按返回的行政区/国家字段分组（Task 4 四国默认目录）：
 *  CN 按 admin1_code 聚合，标题取非空 admin1_name，组顺序按 code 稳定；
 *  TW/HK/MO 无视 admin1 细分，键固定为三个中文名称，组内保留 display_name；
 *  缺行政区信息的项不编造分组。组只从已提交项派生，空分支/失败支不渲染假城市。 */
export function 按行政区分组(项们: BFFLocationItem[]): { 键: string; 城市们: BFFLocationItem[] }[] {
  const 国内表 = new Map<string, { 标题: string; 城市们: BFFLocationItem[] }>();
  const 港澳台表 = new Map<string, BFFLocationItem[]>();
  for (const 项 of 项们) {
    const 港澳台名 = 港澳台组名们[项.country_code];
    if (港澳台名 !== undefined) {
      const 已有 = 港澳台表.get(港澳台名);
      if (已有) 已有.push(项);
      else 港澳台表.set(港澳台名, [项]);
      continue;
    }
    if (项.country_code !== 'CN') continue;
    const 标题 = (项.admin1_name ?? '').trim();
    if (标题 === '') continue;
    const 码 = 项.admin1_code ?? '';
    const 已有 = 国内表.get(码);
    if (已有) 已有.城市们.push(项);
    else 国内表.set(码, { 标题, 城市们: [项] });
  }
  return [
    ...[...国内表.entries()]
      .sort(([甲], [乙]) => (甲 < 乙 ? -1 : 甲 > 乙 ? 1 : 0))
      .map(([, 组]) => ({ 键: 组.标题, 城市们: 组.城市们 })),
    ...(['台湾省', '香港特别行政区', '澳门特别行政区'] as const).flatMap((名) => {
      const 城市们 = 港澳台表.get(名);
      return 城市们 ? [{ 键: 名, 城市们 }] : [];
    }),
  ];
}

/** 按分组展开查询：初次展开请求第一页，直辖市四码合并后去重。 */
export function use城市分组(查询Location: 查询Location方法 | undefined) {
  const [状态表, 设状态表] = useState<Record<string, 分组查询状态>>({});
  const [展开集合, 设展开集合] = useState<Set<string>>(new Set());
  const 方法引用 = useRef(查询Location);
  方法引用.current = 查询Location;

  const 请求首页 = async (组: 城市分组配置, 强制刷新?: boolean) => {
    const 方法 = 方法引用.current;
    const 键 = 组.省;
    // 海外组：filters 为空，不发请求，直接标记已请求（展示组不制造可提交值）
    if (组.filters.length === 0) {
      设状态表((旧) => ({
        ...旧,
        [键]: { items: [], 加载中: false, cursor: null, 游标们: [], 版本们: [], 还有: false, 已请求: true },
      }));
      return;
    }
    if (!方法) return;
    设状态表((旧) => ({
      ...旧,
      [键]: { items: [], 加载中: true, cursor: null, 游标们: [], 版本们: [], 还有: false, 已请求: true },
    }));
    try {
      // review-cx-r2：并发第一页版本不一致 = 目录正在换代，不提交混合快照 —— 带缓存
      // 失效重取一组一致首页（病态服务端下有上限，超限后按各 filter 实际版本提交，
      // 后续追加仍只与同 filter 首页版本比对，不会误判重启）。
      let 页们: 目录页<BFFLocationItem>[] = [];
      for (let 尝试 = 0; 尝试 < 3; 尝试 += 1) {
        页们 = await Promise.all(
          组.filters.map((f) =>
            方法(
              { countryCode: f.countryCode, admin1Code: f.admin1Code, limit: 默认页大小 },
              强制刷新 || 尝试 > 0 ? { 强制刷新: true } : undefined,
            ),
          ),
        );
        if (new Set(页们.map((页) => 页.catalogVersion)).size <= 1) break;
      }
      const 合并 = 去重(页们.flatMap((页) => 页.items));
      const 游标们 = 页们.map((页) => 页.nextCursor);
      const 版本们 = 页们.map((页) => 页.catalogVersion);
      const 还有 = 游标们.some((c) => c !== null);
      const cursor = 游标们.find((c) => c !== null) ?? null;
      设状态表((旧) => ({
        ...旧,
        [键]: { items: 合并, 加载中: false, cursor, 游标们, 版本们, 还有, 已请求: true },
      }));
    } catch {
      设状态表((旧) => ({
        ...旧,
        [键]: { items: [], 加载中: false, cursor: null, 游标们: [], 版本们: [], 还有: false, 已请求: true },
      }));
    }
  };

  const 切换展开 = (组: 城市分组配置) => {
    const 键 = 组.省;
    if (展开集合.has(键)) return;
    设展开集合((旧) => new Set(旧).add(键));
    if (!状态表[键]?.已请求) void 请求首页(组);
  };

  const 加载更多 = async (组: 城市分组配置) => {
    const 键 = 组.省;
    const 状态 = 状态表[键];
    if (!状态 || !状态.还有 || 状态.加载中) return;
    const 方法 = 方法引用.current;
    if (!方法) return;
    设状态表((旧) => ({ ...旧, [键]: { ...旧[键], 加载中: true } }));
    try {
      // review-r1 P2-1：多 filter 分组各取各的下一页（用各自的 游标们[i]），
      // 不再只用 filters[0] 的游标——否则多 filter 组只翻第一个 filter 的第二页。
      const 页们 = await Promise.all(
        组.filters.map((f, i) => {
          const c = 状态.游标们[i];
          if (c === null) return Promise.resolve({ items: [] as BFFLocationItem[], nextCursor: null, catalogVersion: '' });
          return 方法({ countryCode: f.countryCode, admin1Code: f.admin1Code, cursor: c, limit: 默认页大小 });
        }),
      );
      // review-cx F5 / review-cx-r2：追加页只与同 filter 的第一页版本比对；任一 filter
      // 换版本 = 目录已换代 —— 不跨版本合并，整组（含各 filter 的累计页与游标）丢弃并
      // 从该组第一页重开（请求首页 即既有第一页路径，带缓存失效真重取，静默）。
      if (页们.some((页, i) => 页.catalogVersion !== '' && 页.catalogVersion !== 状态.版本们[i])) {
        await 请求首页(组, true);
        return;
      }
      const 新游标们 = 页们.map((页) => 页.nextCursor);
      设状态表((旧) => ({
        ...旧,
        [键]: {
          ...旧[键],
          items: 去重([...旧[键].items, ...页们.flatMap((页) => 页.items)]),
          加载中: false,
          游标们: 新游标们,
          cursor: 新游标们.find((c) => c !== null) ?? null,
          还有: 新游标们.some((c) => c !== null),
        },
      }));
    } catch {
      设状态表((旧) => ({ ...旧, [键]: { ...旧[键], 加载中: false } }));
    }
  };

  return { 状态表, 展开集合, 切换展开, 加载更多 };
}

/** 搜索查询：250ms debounce 后调 查询Location({ q })。
 *  review-r1 P2-2 / review-r2 R2-M-1/R2-M-2：代际 ref 守 stale response——每次输入变化（含清空）
 *  都递增代际；响应 resolve 时只有代际与最新一致才 commit。搜索保留 nextCursor，
 *  暴露 加载更多 供滚到底追加下一页（合并去重）。
 *  Task 2：失败暴露 错误/重试 —— 首页失败置错误（结果清空但错误可见，不装成成功空页）；
 *  重试用当前词重发首页（请求序号触发 effect 重跑，代次失效旧响应）；分页失败保留
 *  已有结果与当前游标，错误可见。成功后错误清空，空词也清错误。 */
export function use城市搜索(查询Location: 查询Location方法 | undefined) {
  const [词, 设词] = useState('');
  const [结果, 设结果] = useState<BFFLocationItem[]>([]);
  const [搜索中, 设搜索中] = useState(false);
  // review-r2 R2-M-1：搜索结果的下一页游标，null 表示无更多
  const [下一页游标, 设下一页游标] = useState<string | null>(null);
  const [加载中, 设加载中] = useState(false);
  const [错误, 设错误] = useState<string | null>(null);
  // Task 2：重试经请求序号触发 effect 重跑（同词重发）；代次在卸载/新词/新序号时失效
  const [请求序号, 设请求序号] = useState(0);
  const 计时 = useRef(0);
  const 代际 = useRef(0);
  // review-cx F5：本次搜索第一页的 catalogVersion —— 追加页换版本时结果整组重开
  const 版本引用 = useRef('');
  const 方法引用 = useRef(查询Location);
  方法引用.current = 查询Location;

  useEffect(() => {
    const 方法 = 方法引用.current;
    const trimmed = 词.trim();
    // review-r3 R3-I-7：每次查询词变化都重置分页状态（结果/游标/加载），避免新词带着旧游标
    // 请求（旧 cursor 配新 q）或旧 loading 残留。代际递增让在飞的旧响应成为 stale。
    代际.current += 1;
    设结果([]);
    设下一页游标(null);
    设加载中(false);
    版本引用.current = '';
    if (!方法 || trimmed === '') {
      设搜索中(false);
      设错误(null);
      return;
    }
    设搜索中(true);
    window.clearTimeout(计时.current);
    // closure 捕获本次的 代际，resolve 时比对 代际.current
    const 本次 = 代际.current;
    计时.current = window.setTimeout(async () => {
      try {
        const 页 = await 方法({ q: trimmed });
        if (本次 !== 代际.current) return; // stale：已有更新的搜索在跑/已完成
        设结果(页.items);
        设下一页游标(页.nextCursor);
        版本引用.current = 页.catalogVersion;
        设错误(null);
      } catch (错误) {
        if (本次 !== 代际.current) return;
        设结果([]);
        设下一页游标(null);
        // 失败不装成成功空页：错误可见，重试用当前词
        设错误(取后端错误文案(错误));
      } finally {
        if (本次 === 代际.current) 设搜索中(false);
      }
    }, 搜索防抖毫秒);
    return () => window.clearTimeout(计时.current);
  }, [词, 请求序号]);

  const 重试 = () => 设请求序号((旧) => 旧 + 1);

  // review-r2 R2-M-1：加载更多——用当前游标请求下一页，合并去重；代际检查防 stale 追加
  const 加载更多 = async () => {
    if (下一页游标 === null || 加载中) return;
    const 方法 = 方法引用.current;
    if (!方法) return;
    const 本次 = 代际.current;
    设加载中(true);
    try {
      const 页 = await 方法({ q: 词.trim(), cursor: 下一页游标 });
      if (本次 !== 代际.current) return;
      if (页.catalogVersion !== 版本引用.current) {
        // review-cx F5：目录换代 —— 不跨版本合并，从本查询第一页静默重开。
        // review-cx-r2：强制刷新让重开真打到服务端（缓存首页已来自旧快照）
        const 重开 = await 方法({ q: 词.trim() }, { 强制刷新: true });
        if (本次 !== 代际.current) return;
        设结果(重开.items);
        设下一页游标(重开.nextCursor);
        版本引用.current = 重开.catalogVersion;
        设错误(null);
        return;
      }
      设结果((旧) => 去重([...旧, ...页.items]));
      设下一页游标(页.nextCursor);
      设错误(null);
    } catch (错误) {
      if (本次 !== 代际.current) return;
      // 结果与当前游标保持不变，错误交给正文显示 + 重试入口
      设错误(取后端错误文案(错误));
    } finally {
      if (本次 === 代际.current) 设加载中(false);
    }
  };

  return { 词, 设词, 结果, 搜索中, 下一页游标, 加载中, 加载更多, 错误, 重试 };
}