// 在谈详情共用的局部展示类型（Plan 契约 A）。
//
// 只描述本页实际需要的展示输入：text/null 的语义由每个区块的明确文案决定，
// 不建立通用 reason 枚举；ReactNode 槽只用于组合本页的共享子组件，
// 禁止传入旧 Mock/Backend 整页 JSX 逃避复用。不输出全局业务 DTO。
import type { ReactNode } from 'react';

export type 详情Tab = '进度' | '资料';

export interface 顶栏信息 {
  端: '求职' | '招聘';
  标题: string | null;
  副标题: string | null;
  画像: { 性别: '男' | '女' | null; 年限: string | null; 学历: string | null; 求职状态: string | null } | null;
  右侧: { kind: '分数'; 值: number | null } | { kind: '薪资'; 值: string | null };
  岗位上下文: string | null;
}

export interface 详情外壳属性 {
  信息: 顶栏信息;
  返回: () => void;
  当前Tab: 详情Tab;
  切Tab: (tab: 详情Tab) => void;
  进度: ReactNode;
  资料: ReactNode;
  底栏: ReactNode;
  弹层?: ReactNode;
}

export interface 状态区信息 {
  阶段: string; 状态: string; 步骤: string | null;
  轮次: { 当前: number; 预算: number } | null;
  徽标: '需要你' | '需注意' | '代理处理中' | null;
  注意说明: string | null;
}

export interface 详情按钮 {
  键: string; 文案: string; 外观: '主要' | '次要' | '危险';
  禁用说明: string | null;
  执行: (() => void) | null;
}

export interface 详情动作卡信息 {
  键: string; 标题: string; 说明: string | null;
  正文?: ReactNode; 按钮们: readonly 详情按钮[];
}

export interface 事实问题属性 {
  问题: string; 草稿: string; 改草稿: (value: string) => void;
  提交: 详情按钮;
}

export type 详情底栏信息 =
  | { kind: '输入'; 占位: string; 值: string; 改变: (value: string) => void; 发送: (() => void) | null; 禁用说明: string | null }
  | { kind: '只读'; 说明: string };

export interface 终局区信息 {
  摘要: { 结束语: string; 原因: string; 定格于: string } | null;
  移交: { 说明: string; 开始私聊: 详情按钮 } | null;
}
