import type { 旅程ID } from '../类型';

// 七个稳定视觉场景，顺序固定：报告、基线目录和候选基线 review 目录都按这个顺序输出。
export const 真实后端场景们 = [
  'candidate-resume-loaded',
  'candidate-intentions-loaded',
  'candidate-disclosure-loaded',
  'candidate-resume-updated',
  'recruiter-card-loaded',
  'recruiter-company-loaded',
  'recruiter-jobs-after-create',
] as const;

export type 真实后端场景ID = typeof 真实后端场景们[number];

// 旅程→场景：视觉场景复用四条业务旅程，不额外登录或重复 CRUD。
// session-isolation 不产出截图；`--journey all` 展开成五条旅程即覆盖全部七个场景。
export const 旅程场景映射: Record<旅程ID, readonly 真实后端场景ID[]> = {
  'candidate-load': ['candidate-resume-loaded', 'candidate-intentions-loaded', 'candidate-disclosure-loaded'],
  'candidate-crud': ['candidate-resume-updated'],
  'recruiter-load': ['recruiter-card-loaded', 'recruiter-company-loaded'],
  'recruiter-crud': ['recruiter-jobs-after-create'],
  'session-isolation': [],
  'hosted-agent': [],
};

// 基线、候选和 diff 三处使用同一个文件名约定。
export function 场景文件名(场景: 真实后端场景ID): string {
  return `${场景}.png`;
}
