// 会话域数据源：BFF /api/v1 session / auth / principal 的闭合契约映射。
// 从 HTTP招聘数据源 按真实后端 owner 拆出，协议代码（path / method / body / 幂等）原样搬移，
// 不改 URL、body、DTO 校验或错误透传。接口失败绝不回退 Mock。

import type { BFF请求选项, BFF响应 } from '../HTTP客户端';
import type { BFF当前会话, BFF登录尝试, BFF主体, BFF角色 } from '../BFF契约';

interface BFF登录完成 {
  identity_id: string;
  session_id: string;
  expires_at: string;
  next_action: { type: 'completed' | 'enter_code' | 'redirect' };
}
interface BFF登出回执 {
  logged_out: boolean;
}

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

export interface 会话数据源 {
  恢复会话(): Promise<BFF当前会话>;
  开始手机登录(手机号11位: string): Promise<BFF登录尝试>;
  开始微信登录(): Promise<BFF登录尝试>;
  完成手机登录(attemptId: string, code4位: string): Promise<BFF当前会话>;
  退出登录(): Promise<void>;
  读取主体(): Promise<BFF主体>;
  确保角色(role: BFF角色): Promise<BFF主体>;
  记录当前角色(role: BFF角色): Promise<BFF主体>;
}

export function 创建会话数据源(请求: 请求函数): 会话数据源 {
  return {
    恢复会话() {
      return 请求<BFF当前会话>({ path: '/api/v1/session' }).then((r) => r.result);
    },
    开始手机登录(手机号11位) {
      return 请求<BFF登录尝试>({
        path: '/api/v1/auth/login-attempts',
        method: 'POST',
        body: { provider: 'phone_otp', input: { phone: `+86${手机号11位}` } },
        幂等: true,
      }).then((r) => r.result);
    },
    开始微信登录() {
      return 请求<BFF登录尝试>({
        path: '/api/v1/auth/login-attempts',
        method: 'POST',
        body: { provider: 'wechat', input: { mock_openid: 'mock-openid-sample-001' } },
        幂等: true,
      }).then((r) => r.result);
    },
    完成手机登录(attemptId, code4位) {
      return 请求<BFF登录完成>({
        path: `/api/v1/auth/login-attempts/${attemptId}/complete`,
        method: 'POST',
        body: { proof: { code: code4位 } },
        幂等: true,
      }).then((r) => ({ identity_id: r.result.identity_id, session_id: r.result.session_id, expires_at: r.result.expires_at }));
    },
    退出登录() {
      return 请求<BFF登出回执>({ path: '/api/v1/auth/logout', method: 'POST' }).then(() => undefined);
    },
    读取主体() {
      return 请求<BFF主体>({ path: '/api/v1/me' }).then((r) => r.result);
    },
    确保角色(role) {
      return 请求<BFF主体>({ path: `/api/v1/me/roles/${role}`, method: 'PUT', body: {} }).then((r) => r.result);
    },
    记录当前角色(role) {
      return 请求<BFF主体>({ path: '/api/v1/me/preferences/last-used-role', method: 'PUT', body: { role } }).then((r) => r.result);
    },
  };
}