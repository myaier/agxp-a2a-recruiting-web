// HTTP 招聘数据源：把 BFF /api/v1 的闭合契约映射成页面领域方法。
// 浏览器只请求同源 /api/v1；所有请求 credentials: 'include'（由 HTTP客户端 设置）。
// 接口失败绝不回退 Mock —— 本模块不 import 模拟数据/企业端模拟数据/接口层。
//
// 2026-08-25 P0 按真实后端 owner 拆成五个域 facade：会话 / 目录 / 简历 / 意向 / 岗位。
// 根 HTTP招聘数据源 是五者的交集，创建HTTP招聘数据源 只组合现有实现，不给 P1–P7 新增空方法，
// 也不改变 URL、body、DTO 校验、错误映射或幂等行为。各域协议代码原样留在对应域文件里。

import type { BFF请求选项, BFF响应 } from './HTTP客户端';
import type { 后端环境 } from '../配置/运行配置';
import type { 岗位附属存储 } from './前端附属数据';
import type { 会话数据源 } from './招聘数据源/会话';
import type { 目录数据源 } from './招聘数据源/目录';
import type { 简历数据源 } from './招聘数据源/简历';
import type { 意向数据源 } from './招聘数据源/意向';
import type { 岗位数据源 } from './招聘数据源/岗位';
import { 创建会话数据源 } from './招聘数据源/会话';
import { 创建目录数据源 } from './招聘数据源/目录';
import { 创建简历数据源 } from './招聘数据源/简历';
import { 创建意向数据源 } from './招聘数据源/意向';
import { 创建岗位数据源 } from './招聘数据源/岗位';

export interface HTTP招聘数据源依赖 {
  client: { 请求: <T>(options: BFF请求选项) => Promise<BFF响应<T>> };
  后端环境: 后端环境;
  附属存储: 岗位附属存储;
}

export type HTTP招聘数据源 = 会话数据源 & 目录数据源 & 简历数据源 & 意向数据源 & 岗位数据源;

export function 创建HTTP招聘数据源(deps: HTTP招聘数据源依赖): HTTP招聘数据源 {
  const 请求 = deps.client.请求;
  return {
    ...创建会话数据源(请求),
    ...创建目录数据源(请求),
    ...创建简历数据源(请求),
    ...创建意向数据源(请求),
    ...创建岗位数据源(请求, deps.后端环境, deps.附属存储),
  };
}