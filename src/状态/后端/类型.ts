// 后端操作组合的纯类型文件（无 React 依赖、无运行时副作用）。
// Provider 把稳定 ref 与 React setter 组成 后端操作依赖 传给各域操作工厂，工厂返回操作方法；
// 根 应用操作 是三个域操作子接口的交集，公开 shape 与拆分前逐字一致。
//
// 对根 状态 / 动作 只使用 type-only import，运行时依赖方向保持「根组合 → 域实现」，
// 不建立互相调用的域模块。

import type { BFF主体, BFF简历, BFFOwnerIntention, BFFOwnerJob } from '../../数据/BFF契约';
import type { 页面简历写入, 意向草稿型, 首次意向输入 } from '../../数据/招聘数据源类型';
import type { 在招岗位 } from '../../数据/类型';
import type { HTTP招聘数据源 } from '../../数据/HTTP招聘数据源';
import type { 动作, 状态 } from '../应用状态';

export interface 后端状态 {
  初始化: '跳过' | '进行中' | '完成';
  已登录: boolean;
  主体: BFF主体 | null;
  简历快照: BFF简历 | null;
  意向快照: Record<string, BFFOwnerIntention>;
  岗位快照: Record<string, BFFOwnerJob>;
}

export type 更新后端状态 = (更新: (旧: 后端状态) => 后端状态) => void;
export type 可变引用<T> = { current: T };

export interface 后端操作依赖 {
  是后端: boolean;
  后端: HTTP招聘数据源 | null;
  派发: (动作: 动作) => void;
  设后端状态: 更新后端状态;
  后端状态引用: 可变引用<后端状态>;
  状态引用: 可变引用<状态>;
  锁: 可变引用<Set<string>>;
  尝试引用: 可变引用<string | null>;
  主体标识引用: 可变引用<string | null>;
  会话代际: 可变引用<number>;
}

export interface 会话操作 {
  开始手机登录(phone: string): Promise<void>;
  完成手机登录(code: string): Promise<void>;
  微信登录(): Promise<string | null>;
  退出登录(): Promise<void>;
  切身份(to: '求职者' | '招聘方'): Promise<void>;
}

export interface 候选操作 {
  保存简历(next: 页面简历写入): Promise<void>;
  保存个人优势(text: string): Promise<void>;
  保存意向(draft: 意向草稿型): Promise<void>;
  保存首次意向(input: 首次意向输入): Promise<void>;
  删除意向(id: string): Promise<void>;
}

export interface 岗位操作 {
  发布岗位(job: 在招岗位): Promise<void>;
  更新岗位(job: 在招岗位): Promise<void>;
  归档岗位(id: string): Promise<void>;
  重开岗位(id: string): Promise<void>;
  删除岗位(id: string): Promise<void>;
}

export type 应用操作 = 会话操作 & 候选操作 & 岗位操作;