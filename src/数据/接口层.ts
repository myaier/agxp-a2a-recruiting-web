// API 层：屏幕通过这一层拿数据。
//
// 两套数据源共存：
//   · 演示域（模拟数据源 / 数据）——只属于未接后端的演示域，供尚未接 BFF 的屏幕继续跑；
//     接后端的屏幕改用 创建招聘数据源 返回的 后端 HTTP招聘数据源。
//   · 后端域（招聘数据）——按运行配置在 mock / backend 间切换；backend 模式构造 HTTP 数据源，
//     接口失败绝不回退 Mock。
//
// 方案第 3 节的技术边界要求「Web 层负责接口调用」，第 4 节要求「补齐 API 层」。

import * as 演示 from './模拟数据';
import type { 在谈单, 市场职位, 消息条目, 往来条目, 规则, 求职意向 } from './类型';
import { 解析运行配置, type 运行配置, type 后端环境 } from '../配置/运行配置';
import { 创建BFF客户端 } from './HTTP客户端';
import { 创建HTTP招聘数据源, type HTTP招聘数据源 } from './HTTP招聘数据源';
import { 创建岗位附属存储 } from './前端附属数据';

/** 演示域数据源契约：只用于未接后端的演示读取。后端就位后用 HTTP招聘数据源。 */
export interface 数据源 {
  取在谈列表(意向: string): Promise<在谈单[]>;
  取在谈单(编号: string): Promise<在谈单 | undefined>;
  取市场列表(意向: string): Promise<市场职位[]>;
  取消息列表(): Promise<消息条目[]>;
  取往来记录(编号: string): Promise<往来条目[]>;
  取规则(): Promise<{ 全局: 规则[]; 意向级: 规则[] }>;
  取求职意向(): Promise<求职意向[]>;
}

/** 演示域：直接返回演示数据，加一点延迟让加载态看得见。只属于未接后端的演示域。 */
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

/** 演示域当前生效数据源：只供未接后端的屏幕使用。 */
export const 数据 = 模拟数据源;

// ── 后端域：数据源判别联合 ──

export type 招聘数据源选择 =
  | { 模式: 'mock' }
  | { 模式: 'backend'; 后端环境: 后端环境; 后端: HTTP招聘数据源 };

export interface 招聘数据源依赖 {
  创建HTTP: (后端环境: 后端环境) => HTTP招聘数据源;
}

const 默认依赖: 招聘数据源依赖 = {
  创建HTTP: (后端环境) =>
    创建HTTP招聘数据源({
      client: 创建BFF客户端(),
      后端环境,
      附属存储: 创建岗位附属存储(globalThis.localStorage),
    }),
};

/**
 * 按运行配置选择数据源。mock 直接返回；backend 构造 HTTP 数据源。
 * 接口失败绝不回退 Mock——不在 catch 里返回模拟数据源。
 */
export function 创建招聘数据源(config: 运行配置, deps: 招聘数据源依赖 = 默认依赖): 招聘数据源选择 {
  if (config.数据源 === 'mock') return { 模式: 'mock' };
  return { 模式: 'backend', 后端环境: config.后端环境, 后端: deps.创建HTTP(config.后端环境) };
}

/** 后端域当前生效数据源：按运行配置在 mock / backend 间切换。 */
export const 招聘数据: 招聘数据源选择 = 创建招聘数据源(解析运行配置(import.meta.env));