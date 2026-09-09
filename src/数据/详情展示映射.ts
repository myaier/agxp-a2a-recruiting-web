// 详情展示映射：两条在谈详情路由共用的纯数据投影。无 I/O、无 React、不读 fixture/Context，
// 缺失一律 null（占位文案归展示层），绝不传 0/NaN 充当缺失。现有 MatchCase展示映射.ts
// 的协议语义不动；Mock 的顶栏由连接层用已有状态构造，不在 mapper 内读全局数据。
// 本 Task 先只放顶栏投影，后续 Task 的阶段/资料投影落在同一文件。

import type { P5详情正常视图 } from './MatchCase展示映射';
import type { 顶栏信息 } from '../组件/在谈详情/类型';

/**
 * P5 详情正常视图 → 顶栏信息。
 *
 * 求职端：标题 = 冻结职位名、副标题 = 城市 · 薪资带（与接线前逐字一致）；岗位上下文已由
 * 标题/副标题承载，给 null。Backend 详情没有匹配分，右侧给 null —— 展示层显示「—」并说明
 * 「匹配分缺失」，不画假分数。
 *
 * 招聘端：去名裁定 —— candidateAlias 是不透明展示文本，不进顶栏（标题/副标题 null）；
 * Backend 详情没有结构化画像字段，但画像位置全保留（字段全 null，占位文案归展示层）；
 * 冻结职位 · 城市 · 薪资带改由 岗位上下文 单独承载，不丢 Backend 已知事实。
 */
export function 从P5到详情顶栏(view: P5详情正常视图): 顶栏信息 {
  if (view.role === 'candidate') {
    return {
      端: '求职',
      标题: view.职位.职位名,
      副标题: `${view.职位.城市} · ${view.职位.薪资带}`,
      画像: null,
      右侧: { kind: '分数', 值: null },
      岗位上下文: null,
    };
  }
  return {
    端: '招聘',
    标题: null,
    副标题: null,
    画像: { 性别: null, 年限: null, 学历: null, 求职状态: null },
    右侧: { kind: '分数', 值: null },
    岗位上下文: `${view.职位.职位名} · ${view.职位.城市} · ${view.职位.薪资带}`,
  };
}
