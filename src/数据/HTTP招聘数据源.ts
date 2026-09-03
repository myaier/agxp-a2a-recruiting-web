// HTTP 招聘数据源：把 BFF /api/v1 的闭合契约映射成页面领域方法。
// 浏览器只请求同源 /api/v1；所有请求 credentials: 'include'（由 HTTP客户端 设置）。
// 接口失败绝不回退 Mock —— 本模块不 import 模拟数据/企业端模拟数据/接口层。
//
// 2026-08-25 P0 按真实后端 owner 拆成五个域 facade：会话 / 目录 / 简历 / 意向 / 岗位。
// 2026-08-26 P1C 加入第六个域 facade：组织（RecruiterProfile / Affiliation / 企业管理员申请 / 企业档案与媒体）。
// 2026-08-27 P3 加入第七个域 facade：隐私（PrivacyView 整读 / 补丁 / 组织屏蔽与解除）+ 组织搜索。
// 2026-08-27 P6 加入第八个域 facade：Agent 规则与提案（agent-rules / agent-rule-proposals）。
// 2026-08-28 P4 加入第九个域 facade：发现推荐（job-recommendations / candidate-recommendations / 双端委托）。
// 2026-08-28 P2 加入第十个域 facade：附件简历（resume-files 上传/替换/删除/解析/下载）。
// 2026-08-29 P5 加入第十一个域 facade：MatchCase（双端 match-cases 工作区/历史/详情/S0–S3 命令/叮嘱/PDF）。
// 2026-08-30 P7 加入第十二个域 facade：真人会话（双端 conversations 收件箱/详情/消息/发送/已读）。
// 2026-09-01 P8 加入第十三个域 facade：P8 控制面（账号安全/换绑/退出其他设备/导出/注销/反馈/举报）。
// 2026-09-03 简历预填 加入第十四个域 facade：onboarding resume-prefill.v1 只读建议（parse-result）。
// 2026-09-03 JD导入 加入第十五个域 facade：job-draft-imports 建议稿创建与轮询读取。
// 2026-09-03 接触记录 加入第十六个域 facade：候选 me/contact-events 接触事件分页读取。
// 根 HTTP招聘数据源 是各域的交集，创建HTTP招聘数据源 只组合现有实现，不给既有域新增空方法，
// 也不改变 URL、body、DTO 校验、错误映射或幂等行为。各域协议代码原样留在对应域文件里。

import type { BFF客户端 } from './HTTP客户端';
import type { 后端环境 } from '../配置/运行配置';
import type { 岗位附属存储 } from './前端附属数据';
import type { 会话数据源 } from './招聘数据源/会话';
import type { 目录数据源 } from './招聘数据源/目录';
import type { 简历数据源 } from './招聘数据源/简历';
import type { 意向数据源 } from './招聘数据源/意向';
import type { 岗位数据源 } from './招聘数据源/岗位';
import type { 组织数据源 } from './招聘数据源/组织';
import type { 隐私数据源 } from './招聘数据源/隐私';
import type { Agent规则数据源 } from './招聘数据源/Agent规则';
import type { 发现推荐数据源 } from './招聘数据源/发现推荐';
import type { 附件简历数据源 } from './招聘数据源/附件简历';
import type { MatchCase数据源 } from './招聘数据源/MatchCase';
import type { 真人会话数据源 } from './招聘数据源/真人会话';
import type { P8控制面数据源 } from './招聘数据源/P8控制面';
import type { 简历预填数据源 } from './招聘数据源/简历预填';
import type { JD导入数据源 } from './招聘数据源/JD导入';
import type { 接触记录数据源 } from './招聘数据源/接触记录';
import { 创建会话数据源 } from './招聘数据源/会话';
import { 创建目录数据源 } from './招聘数据源/目录';
import { 创建简历数据源 } from './招聘数据源/简历';
import { 创建意向数据源 } from './招聘数据源/意向';
import { 创建岗位数据源 } from './招聘数据源/岗位';
import { 创建组织数据源 } from './招聘数据源/组织';
import { 创建隐私数据源 } from './招聘数据源/隐私';
import { 创建Agent规则数据源 } from './招聘数据源/Agent规则';
import { 创建发现推荐数据源 } from './招聘数据源/发现推荐';
import { 创建附件简历数据源 } from './招聘数据源/附件简历';
import { 创建MatchCase数据源 } from './招聘数据源/MatchCase';
import { 创建真人会话数据源 } from './招聘数据源/真人会话';
import { 创建P8控制面数据源 } from './招聘数据源/P8控制面';
import { 创建简历预填数据源 } from './招聘数据源/简历预填';
import { 创建JD导入数据源 } from './招聘数据源/JD导入';
import { 创建接触记录数据源 } from './招聘数据源/接触记录';

export interface HTTP招聘数据源依赖 {
  client: Pick<BFF客户端, '请求' | '请求二进制'>;
  后端环境: 后端环境;
  附属存储: 岗位附属存储;
}

export type HTTP招聘数据源 = 会话数据源 & 目录数据源 & 简历数据源 &
  意向数据源 & 岗位数据源 & 组织数据源 & 隐私数据源 & Agent规则数据源 &
  发现推荐数据源 & 附件简历数据源 & MatchCase数据源 & 真人会话数据源 & P8控制面数据源 &
  简历预填数据源 & JD导入数据源 & 接触记录数据源;

export function 创建HTTP招聘数据源(deps: HTTP招聘数据源依赖): HTTP招聘数据源 {
  const 请求 = deps.client.请求;
  return {
    ...创建会话数据源(请求),
    ...创建目录数据源(请求),
    ...创建简历数据源(请求),
    ...创建意向数据源(请求),
    ...创建岗位数据源(请求, deps.后端环境, deps.附属存储),
    ...创建组织数据源(请求),
    ...创建隐私数据源(请求),
    ...创建Agent规则数据源(请求),
    ...创建发现推荐数据源(请求),
    ...创建附件简历数据源(deps.client),
    ...创建MatchCase数据源(deps.client),
    ...创建真人会话数据源(请求),
    ...创建P8控制面数据源(请求),
    ...创建简历预填数据源(请求),
    ...创建JD导入数据源(请求),
    ...创建接触记录数据源(请求),
  };
}