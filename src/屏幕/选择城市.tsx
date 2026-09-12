// 选择城市（/intentions/cities）—— 「添加求职期望」的次级页 A，多选 0/9。
//
// 版式照规格截图 3 自上而下：✕ 关闭 → 大标题「选择城市」+ 右上 N/9 → 副标题 → 搜索框 →
// 当前/历史访问城市 → 热门城市 → 行政区分组 → 底部已选 chips + 保存。
// 正文 JSX（标题/搜索/列表/已选/保存）在两模式共用的 备选城市选择正文（Task 3，core editors
// 展示统一），本页只做两模式的控制映射：把数据源控制映射为同一组 props。
//
// 与 选工作城市（/onboard/city，单选工作城市）的分工：那屏选**一个**主工作城市，
// 这屏选**另外**最多 9 个感兴趣城市，落 意向草稿.感兴趣城市们，互不覆盖。
//
// Task 3（core editors）：两分支都迁移到共用正文 ——
//   Backend 复用 选工作城市 同一套查询钩子（use城市默认页/use城市搜索）：热门区是不带 q 的
//   默认目录页，分组标题只用返回的 admin1_name（缺失退 country_name，均缺不入分组但仍
//   热门/搜索可见）；「加载更多」沿用现有控件挂在当前可见列表尾。已选按 ID 去重，主城市
//   禁用；ID 映射表由本页维护并保留选中引用，不从可见页按名称反查。
//   Mock 分组种子复用 城市字典（省份即行政区），局部分页把省份组切片，模拟与 Backend 相同的
//   可见状态；搜索沿用 中文名/规范化拼音 子串匹配（城市拼音/全部城市 保留此用途）。
//   原 A–Z 分节与右侧字母索引条按批准的视觉差异整体移除（本轮起运行代码对 use城市分组 零消费，按计划约束保留）。

import { useMemo, useRef, useState } from 'react';
import { 次级页外壳 } from '../组件/通用';
import {
  备选城市选择正文,
  type 城市按钮值,
} from '../组件/备选城市选择正文';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 热门城市, 城市字典 } from '../数据/城市与行业';
import { 城市拼音, 全部城市 } from '../数据/城市首字母';
import type { BFFLocationItem } from '../数据/BFF契约';
import { use城市默认页, use城市搜索, 按行政区分组 } from './城市查询钩子';

/** 感兴趣城市多选上限（规格：其他感兴趣城市（N/9））*/
const 城市上限 = 9;

/** Mock 局部分页每次展示的省份组数：切片 城市字典，模拟与 Backend 默认页相同的可见状态 */
const Mock每次组数 = 6;

export default function 选择城市() {
  const { 返回 } = use导航();
  const { 状态: 全局, 派发, 数据源模式, 目录查询 } = use应用状态();
  const 是后端 = 数据源模式 === 'backend';

  // 主城市（Backend = 工作城市引用 ID / Mock = 草稿 工作城市 名）：不进入备选列表（可见但禁用）
  const 主城市Id = 是后端 ? 全局.意向草稿.工作城市引用?.id : undefined;
  const Mock主城市 = 全局.意向草稿.工作城市;

  // ── 已选 state ──
  // Backend：BFFLocationItem[]（完整项，含 id/display_name），ID 去重；Mock：string[]，字符串去重。
  // 保存时映射为 目录选择值（只取 id + display_name）。
  // 进页时取草稿里已有的选择；改动先落本地，点保存才写回 —— 中途 ✕ 退出不留脏数据。
  // review-r1 F7：初始选择与 toggle 同一清洗 —— 按 ID 去重并排除主城市（Mock 排除主城市
  // 名、按 9 上限截断），否则历史脏数据让计数虚高、主城市重复占名额。
  const [已选引用, 设已选引用] = useState<BFFLocationItem[]>(() => {
    if (!是后端) return [];
    const seen = new Set<string>();
    const 初始: BFFLocationItem[] = [];
    for (const 条 of 全局.意向草稿.感兴趣城市引用们 ?? []) {
      if (条.id === 主城市Id || seen.has(条.id)) continue;
      seen.add(条.id);
      初始.push({ id: 条.id, display_name: 条.display_name } as BFFLocationItem);
    }
    return 初始;
  });
  const [已选, 设已选] = useState<string[]>(() =>
    是后端
      ? 已选引用.map((条) => 条.display_name)
      : 全局.意向草稿.感兴趣城市们.filter((城) => 城 !== Mock主城市).slice(0, 城市上限),
  );

  // Backend 展示键（= 项 ID）→ 完整目录项 的映射表：本页维护并保留选中引用。
  // 热门/默认页/搜索结果每见一次就登记一次，切回已选 chip 或翻页前的项都能拿到完整引用，
  // 不按名称反查。进页先装草稿里已有的引用。
  const 项映射 = useRef<Map<string, BFFLocationItem>>(new Map());
  if (是后端) {
    for (const 条 of 已选引用) 项映射.current.set(条.id, 条);
  }

  // ── 搜索 / 默认目录页查询（Backend 分支，复用 选工作城市 同一套钩子；Mock 分支空操作）──
  const 查询Location = 是后端 ? 目录查询?.查询Location : undefined;
  const { 词, 设词, 结果: 搜索结果项, 搜索中, 下一页游标: 搜索下一页, 加载中: 搜索加载中, 加载更多: 搜索加载更多 } = use城市搜索(查询Location);
  const { 热门项们, 项们: 默认项们, 加载中: 默认加载中, 还有: 默认还有, 加载更多: 默认加载更多 } = use城市默认页(查询Location);

  // Mock 局部分页：省份组切片数量
  const [Mock组数, 设Mock组数] = useState(Mock每次组数);

  const 已选数 = 是后端 ? 已选引用.length : 已选.length;
  const 选满 = 已选数 >= 城市上限;

  const 切换后端 = (项: BFFLocationItem) => {
    // 主城市不进入备选列表
    if (项.id === 主城市Id) return;
    设已选引用((旧) => {
      if (旧.some((条) => 条.id === 项.id))
        return 旧.filter((条) => 条.id !== 项.id);
      // 选满后未选中的城片已经 disabled，这里是兜底
      if (旧.length >= 城市上限) return 旧;
      return [...旧, 项];
    });
  };

  // Mock 分支切换（保持原逻辑不变）
  const 切换 = (城: string) => {
    设已选((旧) => {
      if (旧.includes(城)) return 旧.filter((条) => 条 !== 城);
      // 选满后未选中的城片已经 disabled，这里是兜底：宁可什么都不发生，也不越过上限
      if (旧.length >= 城市上限) return 旧;
      return [...旧, 城];
    });
  };

  const 保存 = () => {
    if (是后端) {
      派发({
        型: '改意向草稿',
        补丁: {
          感兴趣城市们: 已选引用.map((条) => 条.display_name),
          感兴趣城市引用们: 已选引用.map((条) => ({ id: 条.id, display_name: 条.display_name })),
        },
      });
    } else {
      派发({ 型: '改意向草稿', 补丁: { 感兴趣城市们: 已选 } });
    }
    返回();
  };

  // 中文名和全拼都算命中：输「杭」「hangzhou」「hang」都出杭州（Mock 分支本地过滤）
  const 搜索词 = 词.trim().toLowerCase();
  const 搜索结果 = useMemo(
    () =>
      搜索词 === ''
        ? []
        : 全部城市.filter((城) => 城.includes(搜索词) || (城市拼音[城] ?? '').includes(搜索词)),
    [搜索词],
  );

  // ── 当前可见列表的加载/分页归属（正文只有一套「加载中/还有/加载更多」props）──
  const 在搜索 = 搜索词 !== '';
  const 加载中 = 是后端 ? (在搜索 ? 搜索中 || 搜索加载中 : 默认加载中) : false;
  const 还有 = 在搜索
    ? 是后端 && 搜索下一页 !== null
    : 是后端
      ? 默认还有
      : Mock组数 < 城市字典.length;
  const 加载更多 = () => {
    if (!是后端) {
      if (!在搜索) 设Mock组数((旧) => 旧 + Mock每次组数);
      return;
    }
    void (在搜索 ? 搜索加载更多() : 默认加载更多());
  };

  /** 展示键 → 完整目录项：登记一次，切换时按 ID 拿回完整引用 */
  const 记录引用 = (项: BFFLocationItem): BFFLocationItem => {
    项映射.current.set(项.id, 项);
    return 项;
  };

  /** Backend 城市按钮值：按 ID 识别；主城市禁用；选满后未选中禁用 */
  const 后端片 = (项: BFFLocationItem): 城市按钮值 => {
    const 选中 = 已选引用.some((条) => 条.id === 项.id);
    return {
      键: 项.id,
      名称: 项.display_name,
      选中,
      禁用: (选满 && !选中) || 项.id === 主城市Id,
    };
  };

  /** Mock 城市按钮值：城名即稳定键 */
  const Mock片 = (城: string): 城市按钮值 => ({
    键: 城,
    名称: 城,
    选中: 已选.includes(城),
    禁用: 选满 && !已选.includes(城),
  });

  // ── 两模式的展示输入（下面只有一套 props）──
  // 当前/历史访问城市：Backend 用已批准的缺失态「暂未获取定位」，Mock 用演示值上海
  const 位置项们: 城市按钮值[] = 是后端
    ? [{ 键: '暂未获取定位', 名称: '暂未获取定位', 选中: false, 禁用: true }]
    : [Mock片('上海')];
  const 热门片们: 城市按钮值[] = 是后端
    ? 热门项们.map((项) => 后端片(记录引用(项)))
    : 热门城市.map(Mock片);
  const 分组片们 = 是后端
    ? 按行政区分组(默认项们).map((组) => ({
        键: 组.键,
        标题: 组.键,
        项们: 组.城市们.map((项) => 后端片(记录引用(项))),
      }))
    : 城市字典.slice(0, Mock组数).map((组) => ({
        键: 组.省,
        标题: 组.省,
        项们: 组.城市.map(Mock片),
      }));
  const 搜索片们: 城市按钮值[] = 是后端
    ? 搜索结果项.map((项) => 后端片(记录引用(项)))
    : 搜索结果.map(Mock片);
  const 已选片们: 城市按钮值[] = 是后端
    ? 已选引用.map((条) => ({ 键: 条.id, 名称: 条.display_name, 选中: true, 禁用: false }))
    : 已选.map((城) => ({ 键: 城, 名称: 城, 选中: true, 禁用: false }));

  /** 正文只交稳定键：Backend 按 ID 查映射表拿回完整引用，Mock 键即城名 */
  const 切换键 = (键: string) => {
    if (!是后端) {
      切换(键);
      return;
    }
    const 项 = 项映射.current.get(键);
    if (项) 切换后端(项);
  };

  return (
    // 2026-08-24 全站选择风格统一（C1 定稿）：页底改白底
    <次级页外壳 白底>
      <备选城市选择正文
        搜索词={词}
        改搜索词={设词}
        位置项们={位置项们}
        热门项们={热门片们}
        分组们={分组片们}
        搜索项们={搜索片们}
        已选项们={已选片们}
        加载中={加载中}
        还有={还有}
        加载更多={加载更多}
        切换={切换键}
        取消={返回}
        保存={保存}
      />
    </次级页外壳>
  );
}