export type 数据源模式 = 'mock' | 'backend';
export type 后端环境 = 'stg' | 'local';
export interface 运行配置 { 数据源: 数据源模式; 后端环境: 后端环境 }
export interface 代理描述 { target: string; 改写Origin: string | null }

type 环境值 = Record<string, string | boolean | undefined>;

export function 解析运行配置(env: 环境值): 运行配置 {
  const 数据源 = env.VITE_DATA_SOURCE || 'mock';
  const 后端环境 = env.VITE_BACKEND_ENV || 'stg';
  if (数据源 !== 'mock' && 数据源 !== 'backend') {
    throw new Error('VITE_DATA_SOURCE 只允许 mock 或 backend');
  }
  if (后端环境 !== 'stg' && 后端环境 !== 'local') {
    throw new Error('VITE_BACKEND_ENV 只允许 stg 或 local');
  }
  return { 数据源, 后端环境 };
}

export function 取代理描述(config: 运行配置): 代理描述 | null {
  if (config.数据源 === 'mock') return null;
  return config.后端环境 === 'local'
    ? { target: 'http://127.0.0.1:8097', 改写Origin: null }
    : { target: 'https://recruitment-stg.agxp.ai', 改写Origin: 'https://recruitment-stg.agxp.ai' };
}

export function 断言运行场景(config: 运行配置, command: string): void {
  if (command === 'build' && config.数据源 === 'backend') {
    throw new Error('Backend 数据源只支持 Vite dev');
  }
}