// 详情展示映射 · 顶栏投影表测：P5 详情正常视图 → 顶栏信息（纯函数、无 I/O）。
// 钉住两端的顶栏契约：求职端标题/副标题沿用接线前口径；招聘端遵守去名裁定
// （candidateAlias 不进顶栏），画像保留全部位置且字段全 null（占位文案归展示层），
// 冻结职位 · 城市 · 薪资带由 岗位上下文 单独承载；Backend 无匹配分，右侧给 null 不给 0。

import { describe, expect, it } from 'vitest';
import { 从P5到详情顶栏 } from './详情展示映射';
import type { P5详情正常视图 } from './MatchCase展示映射';

const 别名 = 'candidate-0123456789ab';
const 意向ID = 'int_0123456789abcdef0123456789abcdef';

/** 最小正常视图：顶栏投影只读 role 与冻结职位三事实，其余字段与本投影无关。 */
function 正常视图(覆盖: Partial<P5详情正常视图> = {}): P5详情正常视图 {
  return {
    kind: '正常',
    caseId: 'mc_direct',
    role: 'candidate',
    职位: {
      jobId: 'job_0123456789abcdef0123456789abcdef',
      职位名: '平台工程师',
      城市: '上海',
      薪资带: '25-40K·16薪',
      技能: ['Go'],
    },
    intentionId: 意向ID,
    candidateAlias: null,
    阶段标题: '匿名初筛',
    状态文案: '待处理',
    步骤说明: '等待人工决定是否继续',
    轮次: { 当前: 1, 预算: 3 },
    待办: true,
    终局: false,
    详情终局: false,
    更新于: '2026-08-29T02:00:00Z',
    handoff: null,
    actions: [],
    补充问题: null,
    阶段区块: [],
    终局摘要: null,
    注意说明: null,
    ...覆盖,
  };
}

describe('从P5到详情顶栏', () => {
  it('求职端：标题 = 冻结职位名，副标题 = 城市 · 薪资带，无画像，右侧无分数给 null', () => {
    const 顶栏 = 从P5到详情顶栏(正常视图());
    expect(顶栏).toEqual({
      端: '求职',
      标题: '平台工程师',
      副标题: '上海 · 25-40K·16薪',
      画像: null,
      右侧: { kind: '分数', 值: null },
      岗位上下文: null,
    });
    // 内部意向 ID 不进任何展示字段
    expect(JSON.stringify(顶栏)).not.toContain(意向ID);
  });

  it('招聘端：candidateAlias 不进顶栏（去名裁定），画像位置全保留、字段全 null，岗位上下文单独可读', () => {
    const 顶栏 = 从P5到详情顶栏(正常视图({ role: 'recruiter', candidateAlias: 别名 }));
    expect(顶栏).toEqual({
      端: '招聘',
      标题: null,
      副标题: null,
      画像: { 性别: null, 年限: null, 学历: null, 求职状态: null },
      右侧: { kind: '分数', 值: null },
      岗位上下文: '平台工程师 · 上海 · 25-40K·16薪',
    });
    // 别名一个字都不带出（不解析成身份，也不以「缺少姓名」占位恢复姓名区）
    expect(JSON.stringify(顶栏)).not.toContain(别名);
  });
});
