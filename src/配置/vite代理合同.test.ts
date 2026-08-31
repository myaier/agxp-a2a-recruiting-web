// P7 Task 5：Vite 代理的同源事件合同 —— /api/v1 代理必须同时转发 HTTP 与 WebSocket
// 升级（ws: true），stg 代理在 proxyReqWs 上把握手 Origin 改写为配置的 public
// origin（local 保持浏览器原 Origin），HTTP 的 proxyReq 改写继续保留。
// 走仓库既有的 ?raw 源码合同模式（应用 tsconfig 只挂 vite/client 类型）。

import { describe, expect, it } from 'vitest';
import 配置源码 from '../../vite.config.ts?raw';

describe('vite 代理合同（P7 同源事件）', () => {
  it('/api/v1 代理启用 ws: true —— 同源 WebSocket 升级也走 Vite', () => {
    expect(配置源码).toContain('ws: true');
  });

  it('stg 代理在 proxyReqWs 上改写握手 Origin', () => {
    expect(配置源码).toContain('proxyReqWs');
    expect(配置源码).toContain("proxy.on('proxyReqWs'");
  });

  it('HTTP 的 proxyReq Origin 改写保留（两条事件不能互相替代）', () => {
    expect(配置源码).toContain("proxy.on('proxyReq'");
  });
});