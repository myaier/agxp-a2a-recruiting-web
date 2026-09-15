// 选期望职位（/onboard/job）—— 2026-08-20 按 BOSS 截图顺序重排：
// 完善资料屏的职位行点进来，替代旧的底部弹层，升级为全屏 + 多选（上限 10）。
//
// Task 7（B 契约）：两模式仅一套 JSX —— 展示与数据/状态分离：
//   · 展示正文 src/组件/期望职位选择正文（纯展示，B 契约冻结的 props），
//     版式 = 大标题 → 搜索 → 左一级栏 + 右二级标题/三级职位分组 → 底部已选/保存；
//   · Backend 目录状态由页面局部钩子 use期望职位目录 拥有：选择一级即自动加载其
//     二级分组与各组三级首屏（一级高亮持续绑定一级 ID，二级是小标题不是按钮）；
//   · Mock 把 职业分类树 映射成同一展示结构，不发请求、行为不变。
// 页面保留真实目录引用（Backend）、选择上限（onboarding 10 / 意向 1）、保存与跳转；
// 点具体职位只切换本页临时选择，仍通过底部「保存」回填既有目标。

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 轻提示 } from '../组件/轻提示';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 职业分类树 } from '../数据/职业分类';
import type { BFFTaxonomyItem } from '../数据/BFF契约';
import { 期望职位选择正文, type 期望职位组, type 目录尾态 } from '../组件/期望职位选择正文';
import { use期望职位目录 } from './期望职位目录钩子';

/** 期望职位上限：与 BOSS 同档（与 学生分流 的快捷片共用同一档）*/
const 职位上限 = 10;

/** 无请求模式（Mock / 尚无数据）的空尾态：恒无加载、无错误、无下一页 */
const 空尾态: 目录尾态 = {
  加载中: false,
  错误: null,
  还有: false,
  加载更多: () => undefined,
  重试: () => undefined,
};

export default function 选期望职位() {
  const { 返回 } = use导航();
  const { 状态: 全局, 派发, 数据源模式, 目录查询 } = use应用状态();
  const 是后端 = 数据源模式 === 'backend';
  const [查询参数] = useSearchParams();

  // 「添加求职期望」页的期望职位行点进来时带 ?来源=意向（规格：单选，写 意向草稿.期望职位）。
  // 不带这个参数就是注册引导的原路径 —— 那条路径的多选 + 写 引导预填 行为一个字都没动。
  const 来自意向 = 查询参数.get('来源') === '意向';

  // ── Mock 已选 state（保持原逻辑不变）──
  const [已选, 设已选] = useState<string[]>(() =>
    来自意向
      ? 全局.意向草稿.期望职位 === ''
        ? []
        : [全局.意向草稿.期望职位]
      : 全局.引导预填?.职位 ?? []
  );
  const [当前大类, 设当前大类] = useState(职业分类树[0].大类);
  const [关键词, 设关键词] = useState('');

  // ── Backend 已选 state：完整项（id + display_name），ID 去重 ──
  const [已选引用, 设已选引用] = useState<BFFTaxonomyItem[]>(() => {
    if (!是后端) return [];
    if (来自意向) {
      const 引用 = 全局.意向草稿.职位引用;
      return 引用 ? [{ id: 引用.id, display_name: 引用.display_name, parent_id: null, selectable: true, has_children: false }] : [];
    }
    const 引用们 = 全局.引导预填?.职位引用们 ?? [];
    return 引用们.map((条) => ({ id: 条.id, display_name: 条.display_name, parent_id: null, selectable: true, has_children: false }));
  });

  // ── Backend 目录：页面局部钩子拥有三层目录状态与按键查找；选中集合仍在页面 ──
  const 目录 = use期望职位目录({
    查询: 是后端 ? 目录查询?.查询Taxonomy : undefined,
    搜索词: 关键词,
    已选键们: 已选引用.map((条) => 条.id),
  });

  // ── Mock 切换（保持原逻辑不变）──
  const 切换 = (名: string) => {
    设已选((旧) => {
      if (来自意向) return 旧.includes(名) ? [] : [名];
      if (旧.includes(名)) return 旧.filter((条) => 条 !== 名);
      if (旧.length >= 职位上限) {
        轻提示(`最多选 ${职位上限} 个`);
        return 旧;
      }
      return [...旧, 名];
    });
  };

  // ── Backend 切换：只切换本页临时选择，不保存不关闭；上限与单选语义同 Mock ──
  const 切换后端 = (键: string) => {
    const 项 = 目录.按键取项(键);
    if (!项 || !项.selectable) return;
    设已选引用((旧) => {
      if (来自意向) return 旧.some((条) => 条.id === 键) ? [] : [项];
      if (旧.some((条) => 条.id === 键)) return 旧.filter((条) => 条.id !== 键);
      if (旧.length >= 职位上限) {
        轻提示(`最多选 ${职位上限} 个`);
        return 旧;
      }
      return [...旧, 项];
    });
  };

  const 保存 = () => {
    if (是后端) {
      if (来自意向) {
        const 选 = 已选引用[0];
        派发({
          型: '改意向草稿',
          补丁: {
            期望职位: 选?.display_name ?? '',
            职位引用: 选 ? { id: 选.id, display_name: 选.display_name } : undefined,
          },
        });
      } else {
        派发({
          型: '存引导预填',
          // review-r3 R3-Minor-1：Backend 无引导预填时城市回落为空（不写 ['上海']），
          // 否则会落一个无引用的「上海」字符串，看起来像选中但下一步按钮因缺 refs 仍禁用。
          城市们: 全局.引导预填?.城市们 ?? [],
          职位: 已选引用.map((条) => 条.display_name),
          城市引用们: 全局.引导预填?.城市引用们 ?? [],
          职位引用们: 已选引用.map((条) => ({ id: 条.id, display_name: 条.display_name })),
        });
      }
      返回();
      return;
    }
    if (来自意向) {
      派发({ 型: '改意向草稿', 补丁: { 期望职位: 已选[0] ?? '' } });
      返回();
      return;
    }
    派发({
      型: '存引导预填',
      城市们: 全局.引导预填?.城市们 ?? ['上海'],
      职位: 已选,
      城市引用们: [],
      职位引用们: [],
    });
    返回();
  };

  // ── 两模式的展示输入（下面只有一套 JSX：期望职位选择正文）──
  const 已选数 = 是后端 ? 已选引用.length : 已选.length;
  const 词 = 关键词.trim();

  // Mock：职业分类树 → B 契约展示结构（本地树、无请求；键 = 名称）
  const Mock已选集 = new Set(已选);
  const Mock项 = (名: string) => ({ 键: 名, 名称: 名, 选中: Mock已选集.has(名), 禁用: false });
  const Mock组们: 期望职位组[] =
    词 === ''
      ? (职业分类树.find((组) => 组.大类 === 当前大类)?.分组 ?? []).map((分) => ({
          键: 分.组名,
          标题: 分.组名,
          项们: 分.岗位.map(Mock项),
          尾态: 空尾态,
        }))
      : [
          {
            // 搜索直接命中平铺：跨所有大类匹配小类名，命中即平铺（沿用原页行为）
            键: '搜索结果',
            标题: '',
            项们: 职业分类树
              .flatMap((组) => 组.分组.flatMap((分) => 分.岗位))
              .filter((名) => 名.includes(词))
              .map(Mock项),
            尾态: 空尾态,
          },
        ];

  return (
    <期望职位选择正文
      搜索词={关键词}
      改搜索词={设关键词}
      根项们={
        是后端
          ? 目录.根项们
          : 职业分类树.map((组) => ({ 键: 组.大类, 名称: 组.大类, 选中: 组.大类 === 当前大类 }))
      }
      切换根={(键) => {
        if (是后端) {
          目录.切换根(键);
          return;
        }
        设当前大类(键);
      }}
      根尾态={是后端 ? 目录.根尾态 : 空尾态}
      组们={是后端 ? 目录.组们 : Mock组们}
      右尾态={是后端 ? 目录.右尾态 : 空尾态}
      已选={
        是后端
          ? 已选引用.map((条) => ({ 键: 条.id, 名称: 条.display_name }))
          : 已选.map((名) => ({ 键: 名, 名称: 名 }))
      }
      切换选择={(键) => {
        if (是后端) {
          切换后端(键);
          return;
        }
        切换(键);
      }}
      移除={(键) => {
        if (是后端) {
          // 按 ID 移除（同名两条互不误删）；不需要目录项即可删
          设已选引用((旧) => 旧.filter((条) => 条.id !== 键));
          return;
        }
        切换(键);
      }}
      保存={保存}
      可保存={已选数 > 0}
      返回={返回}
    />
  );
}
