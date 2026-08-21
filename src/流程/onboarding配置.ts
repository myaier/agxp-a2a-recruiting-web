import { 路径 } from '../路由/路径表';

export type Onboarding角色 = '学生求职' | '社招求职' | '招聘方';
export type 求职类型 = '社招全职' | '校园招聘' | '实习生' | '兼职';
export type 办公偏好 = '现场' | '混合' | '全远程';
export type 求职薪资单位 = '月薪K' | '元/天';

export interface 求职初筛偏好 {
  求职类型: 求职类型[];
  办公方式: 办公偏好[];
  /** 校园招聘主要方向：预计毕业月，格式 YYYY-MM */
  毕业时间?: string;
  /** 只有选择实习生时参与匹配 */
  实习月数?: number;
  /** 只有选择实习生时参与匹配 */
  每周到岗天数?: number;
  /** 实习主要方向：最早可开始日期，格式 YYYY-MM-DD */
  实习开始日期?: string;
  /** 可选：作品集、GitHub 或项目介绍链接 */
  作品集链接?: string;
}

function 本地日期(基准: Date): string {
  const 补零 = (数: number) => String(数).padStart(2, '0');
  return `${基准.getFullYear()}-${补零(基准.getMonth() + 1)}-${补零(基准.getDate())}`;
}

function 基准日期文本(基准: Date | string): string {
  return typeof 基准 === 'string' ? 基准 : 本地日期(基准);
}

function 是真实日期(值: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(值)) return false;
  const 日期 = new Date(`${值}T00:00:00Z`);
  return !Number.isNaN(日期.getTime()) && 日期.toISOString().slice(0, 10) === 值;
}

/** date 输入与业务校验共用，避免浏览器选择器和提交规则口径不一致。 */
export function 今天日期(基准 = new Date()): string {
  return 本地日期(基准);
}

export function 校验预计毕业时间(值: string | undefined, 基准: Date | string = new Date()): string | null {
  if (!值) return '请填写预计毕业时间';
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(值)) return '预计毕业时间格式不正确';
  if (值 < 基准日期文本(基准).slice(0, 7)) return '预计毕业时间不能早于本月';
  return null;
}

export function 校验未过期日期(
  值: string | undefined,
  字段名: string,
  基准: Date | string = new Date(),
): string | null {
  if (!值) return `请填写${字段名}`;
  if (!是真实日期(值)) return `${字段名}格式不正确`;
  if (值 < 基准日期文本(基准)) return `${字段名}不能早于今天`;
  return null;
}

/** 用户常粘贴 github.com/name；存储时统一补齐 https，避免形成两种链接格式。 */
export function 规范化作品集链接(值: string): string {
  const 文本 = 值.trim();
  if (!文本) return '';
  return /^[a-z][a-z\d+.-]*:\/\//i.test(文本) ? 文本 : `https://${文本}`;
}

export function 校验作品集链接(值: string | undefined): string | null {
  if (!值?.trim()) return null;
  try {
    const 地址 = new URL(规范化作品集链接(值));
    if (!['http:', 'https:'].includes(地址.protocol) || !地址.hostname.includes('.')) {
      return '请输入有效的作品集或项目链接';
    }
    return null;
  } catch {
    return '请输入有效的作品集或项目链接';
  }
}

/** 候选最早可开始日不晚于岗位最晚接受日，即可通过日期初筛。 */
export function 实习开始日期匹配(
  候选最早日期?: string,
  岗位最晚日期?: string,
): '匹配' | '不匹配' | '信息不足' {
  if (!候选最早日期 || !岗位最晚日期 || !是真实日期(候选最早日期) || !是真实日期(岗位最晚日期)) {
    return '信息不足';
  }
  return 候选最早日期 <= 岗位最晚日期 ? '匹配' : '不匹配';
}

/**
 * 首次注册的唯一流程合同。页面跳转与自动化测试共用，新增页面时必须在这里显式登记，
 * 避免某个角色拥有采集页却被分支路由静默跳过。
 */
export const Onboarding流程: Record<Onboarding角色, string[]> = {
  学生求职: [
    路径.引导说明,
    路径.学生分流,
    路径.基本信息,
    路径.最高学历,
    路径.毕业院校,
    路径.选专业,
    路径.就读时间段,
    路径.工作经历,
    路径.求职状态,
    路径.引导问答,
    路径.披露说明,
    路径.添加头像,
    路径.主壳,
  ],
  社招求职: [
    路径.引导说明,
    路径.学生分流,
    路径.引导问答,
    路径.基本信息,
    路径.求职状态,
    路径.最高学历,
    路径.毕业院校,
    路径.选专业,
    路径.就读时间段,
    路径.工作经历,
    路径.引导问答,
    路径.披露说明,
    路径.添加头像,
    路径.主壳,
  ],
  招聘方: [
    路径.企业实名认证,
    路径.招聘名片,
    路径.发布岗位,
    路径.企业主壳,
  ],
};

/** 初筛字段必须在双方各有一个结构化数据源；自由文本只做偏好排序，不做自动淘汰。 */
export const 初筛字段矩阵 = {
  通用: ['职位/类别', '城市', '办公方式', '求职/招聘类型', '薪资带交集'],
  社招: ['工作年限', '学历', '技能', '证书与语言', '到岗状态', '作品集或项目链接'],
  学生: ['学历', '学校与专业', '预计毕业时间', '技能', '证书与语言', '作品集或项目链接'],
  实习: ['可实习月数', '每周可到岗天数', '最早可开始实习日期'],
} as const;

export function 身份首次入口(身份: '求职者' | '企业'): string {
  return 身份 === '企业' ? 路径.企业实名认证 : 路径.引导说明;
}

export function 默认求职初筛偏好(是学生: boolean): 求职初筛偏好 {
  return 是学生
    ? { 求职类型: ['实习生'], 办公方式: ['现场', '混合', '全远程'], 实习月数: 3, 每周到岗天数: 4 }
    : { 求职类型: ['社招全职'], 办公方式: ['现场', '混合', '全远程'] };
}

export function 求职初筛缺失项(偏好: 求职初筛偏好, 基准: Date | string = new Date()): string[] {
  const 缺失: string[] = [];
  if (偏好.求职类型.length === 0) 缺失.push('求职类型');
  if (偏好.求职类型.length > 1) 缺失.push('一个主要求职类型');
  if (偏好.办公方式.length === 0) 缺失.push('办公方式');
  if (偏好.求职类型.includes('校园招聘')) {
    if (!偏好.毕业时间) 缺失.push('预计毕业时间');
    else {
      const 错误 = 校验预计毕业时间(偏好.毕业时间, 基准);
      if (错误) 缺失.push(错误);
    }
  }
  if (偏好.求职类型.includes('实习生')) {
    if (!偏好.实习月数) 缺失.push('可实习月数');
    if (!偏好.每周到岗天数) 缺失.push('每周可到岗天数');
    if (!偏好.实习开始日期) 缺失.push('实习开始日期');
    else {
      const 错误 = 校验未过期日期(偏好.实习开始日期, '实习开始日期', 基准);
      if (错误) 缺失.push(错误);
    }
  }
  const 链接错误 = 校验作品集链接(偏好.作品集链接);
  if (链接错误) 缺失.push(链接错误);
  return 缺失;
}

/**
 * v1 缓存曾允许同时保存校招和实习，会让月薪/日薪口径冲突。
 * 迁移时优先保留与已存薪资单位一致的方向；没答过薪资时保留原数组的第一个非实习方向。
 */
export function 迁移主要求职类型(偏好: 求职初筛偏好, 已存薪资单位?: 求职薪资单位): 求职初筛偏好 {
  if (偏好.求职类型.length <= 1) return 偏好;
  const 主要 =
    已存薪资单位 === '元/天' && 偏好.求职类型.includes('实习生')
      ? '实习生'
      : 偏好.求职类型.find((类型) => 类型 !== '实习生') ?? '实习生';
  return { ...偏好, 求职类型: [主要] };
}

/** 主要求职类型为实习时按日薪采集。 */
export function 判断求职薪资单位(偏好?: 求职初筛偏好): 求职薪资单位 {
  return 偏好?.求职类型.length === 1 && 偏好.求职类型[0] === '实习生' ? '元/天' : '月薪K';
}
