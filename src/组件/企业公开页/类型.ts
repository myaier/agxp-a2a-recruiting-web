// 企业公开页的本页类型（接口 A，签名按批准 Plan 冻结）。
// 只放类型：映射在 src/数据/企业公开页展示映射.ts，渲染在 ./企业公开页展示.tsx。
// null 语义统一为「该展示位置合法缺失」，由展示组件按 Spec §3/§6 渲染明确的未知占位；
// 真实 0、合法否定值不是 null，照常显示。

/** 企业公开页的展示资料快照：BFF 公开视图与 Mock 档两条来源都投影成这一份 */
export interface 企业公开页资料 {
  名称: string | null;
  图片: string | null;
  /** 外层逐字段补未知文案后拼接；Mock 保留现有整行 */
  规模行: string;
  简介: readonly string[] | null;
  文化: string | null;
  历程: readonly { 年份: string; 事件: string }[] | null;
  业务: readonly string[] | null;
  相册: readonly string[] | null;
  产品: string | null;
  团队: readonly { 姓名: string | null; 职务: string | null; 简介: string | null }[] | null;
  作息: string | null;
  条款: readonly { 名称: string; 说明: string | null; 已核: boolean }[] | null;
  /** 接口有没有代理核对结果：false 时显示「代理核对信息未知」，不生成已核计数 */
  代理核对已知: boolean;
  地址: string | null;
  地址补充: string | null;
  反馈: readonly { 标签: string; 条数: number }[] | null;
  工商: readonly { 项: string; 值: string }[] | null;
  /** 只作用于工商条目的来源说明（Mock「已核验」）；身份核验单独由 身份.已核验 表达 */
  工商来源说明: string | null;
  身份: {
    法定名称: string | null;
    展示名称: string | null;
    核验时间: string | null;
    已核验: boolean;
    /** 真实 0 也是 0；null 才是数量未知 */
    岗位数: number | null;
    /** 数量是否带「已核验」语义（Backend 已核验在招数 true，Mock false） */
    岗位数已核验: boolean;
  };
  页脚: string;
}

export interface 企业公开页展示属性 {
  资料: 企业公开页资料;
  返回: () => void;
  /** 办公地导航能力：null = 不可用，只显示不可执行提示 */
  导航: (() => void) | null;
  /** 岗位列表能力：null = 不可用（底部无可点入口），[] = 可打开但无条目；不从数量推断 */
  岗位: { 编号: string; 职位: string; 薪资: string; 在谈: boolean; 打开: () => void }[] | null;
  /** 已有 Mock 业务说明，由外层传入；null 不渲染 */
  岗位层说明: string | null;
  条款层说明: string | null;
}
