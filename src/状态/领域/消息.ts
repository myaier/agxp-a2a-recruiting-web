// 消息域 reducer：双端未读和读消息。
// 从根 归约 按业务 owner 拆出，case body 逐字搬移。播种未读表 / 数未读 仍由根模块保留
// （初始状态播种 + 屏幕导入数未读），本文件只接管读消息 case。对根 状态 只使用 type-only import。

import type { 状态 } from '../应用状态';

export interface 消息状态 {
  /** 会话编号 → 未读条数。0 = 有未读但不计数（只画红点的那种），键不存在 = 已读。 */
  消息未读: Record<string, number>;
  /** 企业端会话未读表（与 消息未读 同构，两端各谈各的，不共用一张表）*/
  企业消息未读: Record<string, number>;
}

export type 消息动作 =
  | { 型: '读消息'; 编号: string }
  | { 型: '企业读消息'; 编号: string };

export type 消息归约 = (旧: 状态, 动作: 消息动作) => 状态;

export const 归约消息: 消息归约 = (旧, 动作) => {
  switch (动作.型) {
    // 点开一行会话就把它读掉：未读徽标与底部导航角标同源于这张表，一次点清两处。
    // 键不存在时原样返回旧状态（幂等）—— 已读的行再点不该产生新状态对象，
    // 那会让整棵树白重渲一次
    case '读消息': {
      if (!(动作.编号 in 旧.消息未读)) return 旧;
      const 余 = { ...旧.消息未读 };
      delete 余[动作.编号];
      return { ...旧, 消息未读: 余 };
    }
    case '企业读消息': {
      if (!(动作.编号 in 旧.企业消息未读)) return 旧;
      const 余 = { ...旧.企业消息未读 };
      delete 余[动作.编号];
      return { ...旧, 企业消息未读: 余 };
    }
    default: {
      const 不可能: never = 动作;
      return 不可能;
    }
  }
};