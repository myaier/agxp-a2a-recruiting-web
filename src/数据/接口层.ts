// API 层：屏幕只通过这一层拿数据，永远不直接 import 模拟数据。
// 方案第 3 节的技术边界要求「Web 层负责接口调用」，第 4 节要求「补齐 API 层」——
// 接真后端时只需把 模拟数据源 换成 HTTP数据源，屏幕代码零改动。

import * as 演示 from './模拟数据';
import type { 在谈单, 市场职位, 消息条目, 往来条目, 规则, 求职意向 } from './类型';

/** 数据源契约。后端就位后照这份签名实现一个 HTTP 版即可。 */
export interface 数据源 {
  取在谈列表(意向: string): Promise<在谈单[]>;
  取在谈单(编号: string): Promise<在谈单 | undefined>;
  取市场列表(意向: string): Promise<市场职位[]>;
  取消息列表(): Promise<消息条目[]>;
  取往来记录(编号: string): Promise<往来条目[]>;
  取规则(): Promise<{ 全局: 规则[]; 意向级: 规则[] }>;
  取求职意向(): Promise<求职意向[]>;
}

/** 原型阶段的本地实现：直接返回演示数据，加一点延迟让加载态看得见 */
const 模拟延迟 = (毫秒 = 0) => new Promise((完成) => setTimeout(完成, 毫秒));

export const 模拟数据源: 数据源 = {
  async 取在谈列表() {
    await 模拟延迟();
    // 等你行动的卡置顶（红描边），其余保持原顺序
    return [...演示.在谈列表].sort((甲, 乙) => Number(乙.需要你) - Number(甲.需要你));
  },
  async 取在谈单(编号) {
    await 模拟延迟();
    return 演示.在谈列表.find((条) => 条.编号 === 编号);
  },
  async 取市场列表() {
    await 模拟延迟();
    return 演示.市场列表;
  },
  async 取消息列表() {
    await 模拟延迟();
    return 演示.消息列表;
  },
  async 取往来记录() {
    await 模拟延迟();
    return 演示.往来记录;
  },
  async 取规则() {
    await 模拟延迟();
    return { 全局: 演示.全局规则, 意向级: 演示.意向级规则 };
  },
  async 取求职意向() {
    await 模拟延迟();
    return 演示.求职意向列表;
  },
};

/** 当前生效的数据源。接后端时改这一行（或按环境变量切换）。 */
export const 数据 = 模拟数据源;
