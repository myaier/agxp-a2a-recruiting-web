// A17 我的简历 · 编辑页（从「我的」头像 / 宫格进入）
//
// 结构：返回栏（居中标题）→ 代理诊断绿条 → 基本信息 → 工作经历（含关键项目）
// → 教育经历 → 专业技能 → 资格证书 → 个人优势 → 附件简历 → 再加一个求职意向。
// 每一块都读全局简历切片，写入口只有一个（工作经历页 / 基本信息页），这一屏负责
// 「看全 + 跳到对应编辑屏」，不做第二套编辑器 —— 两套编辑器必然写出两份不一致的数据。
//
// 这是本人视角，所以真名可以直接显示；对方视角是 组件/简历预览层.tsx，那里永远只有代号。

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import 样式 from './我的简历.module.css';
import { 次级页外壳, 返回栏, 滚动区, 表单条目 } from '../组件/通用';
import 确认层 from '../组件/确认层';
import { 简历附件区, type 附件展示行 } from '../组件/简历附件区';
import type { 滑动操作 } from '../组件/滑动行';
import { 轻提示 } from '../组件/轻提示';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { use应用状态 } from '../状态/应用状态';
import { 附件错误文案, 附件状态文案, 校验附件PDF } from '../流程/附件简历交互';
import { use附件简历刷新 } from '../流程/附件简历刷新';
import { use附件PDF预览 } from '../流程/附件简历预览';
import { 取后端错误文案 } from '../数据/HTTP客户端';
import { 折算工作年限 } from '../数据/匹配对齐';
import type { BFF附件简历 } from '../数据/BFF契约';
import type { 基本信息 as 基本信息类型, 简历经历段, 简历教育段, 简历证书 } from '../数据/类型';
import type { 附件变更结果 } from '../状态/后端/类型';

/** 'yyyy-MM' → 'yyyy.MM'；null → '至今' */
function 显示年月(值: string | null): string {
  return 值 ? 值.replace('-', '.') : '至今';
}

/** 身份 → 简历上的状态说法。「在职」默认保密求职，这是本产品的常态；
 *  '' 是真实的未选择空态（M），不冒充任何档位 */
const 状态文案: Record<基本信息类型['身份'], string> = {
  '': '未填写',
  在校: '在校 · 看机会',
  在职: '在职 · 保密求职中',
  离职: '离职 · 随时到岗',
};

/** 一条完整度检查结果：文案 + 点行跳去补的编辑屏 */
export interface 完整度项 {
  文案: string;
  去处: string;
}

/**
 * 资料完整度检查（Backend）：按真实简历切片把缺口分成「待补全」（核对必需）
 * 与「可提升」（选填建议）两类。学生豁免只认 身份 === '在校'；证书只进可提升，
 * 不增加待补全计数；技能不设「至少五项」这类无合同阈值。
 */
export function 检查资料完整度(input: {
  基本信息: 基本信息类型;
  经历: readonly 简历经历段[];
  教育: readonly 简历教育段[];
  技能: readonly string[];
  证书: readonly 简历证书[];
}): { 待补全: 完整度项[]; 可提升: 完整度项[] } {
  const 待补全: 完整度项[] = [];
  const 可提升: 完整度项[] = [];
  if (input.基本信息.真名.trim() === '') {
    待补全.push({ 文案: '姓名还没填写', 去处: 路径.基本信息 });
  }
  // M：空身份是真实的「当前状态」缺口，不算成在职
  if (input.基本信息.身份 === '') {
    待补全.push({ 文案: '当前状态还没选择', 去处: 路径.求职状态 });
  }
  if (input.基本信息.身份 !== '在校' &&
      折算工作年限(input.基本信息.开始工作年) === null) {
    待补全.push({ 文案: '开始工作年还没正确填写', 去处: 路径.基本信息 });
  }
  if (input.基本信息.身份 !== '在校' && input.经历.length === 0) {
    待补全.push({ 文案: '工作经历还没填写', 去处: 路径.工作经历 });
  }
  const 缺内容 = input.经历.filter((段) => 段.内容.trim() === '').length;
  if (缺内容 > 0) {
    待补全.push({ 文案: `${缺内容} 段工作经历还没写工作内容`, 去处: 路径.工作经历 });
  }
  if (input.教育.length === 0) {
    待补全.push({ 文案: '教育经历还没填写', 去处: 路径.工作经历 });
  }
  if (input.技能.length === 0) {
    待补全.push({ 文案: '专业技能还没填写', 去处: 路径.工作经历 });
  }
  if (input.经历.length > 0 && input.经历.every((段) => (段.项目 ?? []).length === 0)) {
    可提升.push({ 文案: '可以补充关键项目', 去处: 路径.工作经历 });
  }
  if (input.证书.length === 0) {
    可提升.push({ 文案: '如有资格证书，可以补充（选填）', 去处: 路径.工作经历 });
  }
  return { 待补全, 可提升 };
}

// ── core editors §5.3（Task 8）：Mock 附件模拟 —— 本页局部生命周期，零请求零 mutation ──

/** Mock 模拟解析状态（附件解析状态的子集）：不伪造 pending（等待态是 Backend 轮询的产物） */
type Mock解析状态 = 'not_started' | 'processing' | 'succeeded' | 'failed';

/** Mock 行状态 → 说明的闭合映射（沿用 附件状态文案 的同一套产品文案；failed 取可重试口径） */
const Mock解析文案: Record<Mock解析状态, string> = {
  not_started: '尚未识别',
  processing: '正在识别',
  succeeded: '识别完成',
  failed: '识别失败 · 可重试',
};

/** 一条模拟附件行：稳定模拟键与显示名分离。演示说明 只承载原 Mock 演示行的静态说明，
 *  状态一旦被模拟动作改变即改用状态文案（不把演示文案冒充解析状态）。 */
type Mock附件行 = { 键: string; 名称: string; 状态: Mock解析状态; 演示说明?: string };

/** 模拟附件上限：与 Backend limits.max_files 的既有附件上限一致（演示口径，不宣称合同值） */
const 模拟附件上限 = 3;

/** 模拟解析从 正在识别 到终态的演示节拍（本页生命周期内的局部定时，卸载即清） */
const 模拟解析毫秒 = 1200;

/** 测试注入：置真后下一次模拟解析以 failed 终态收尾（产品运行恒为 false，无调试面板）。
 *  错误状态通过注入验证（设计 §4.2），Mock 不伪造解析结果、不生成内容/PDF。 */
export const 注入模拟解析失败 = { 启用: false };

/** 演示初值：以原 Mock 附件名称作为首条，保留原静态说明；离页即回到这份初值（不持久化） */
function 演示附件初值(): Mock附件行[] {
  return [
    { 键: 'mock_att_0', 名称: '沈亦舟_简历_2026.pdf', 状态: 'not_started', 演示说明: '初筛通过后发送 PDF 原件' },
  ];
}

/** 模拟行的说明：状态未动过且带演示说明时保留原静态说明，否则用状态文案 */
function Mock行说明(行: Mock附件行): string {
  return 行.状态 === 'not_started' && 行.演示说明 !== undefined ? 行.演示说明 : Mock解析文案[行.状态];
}

/** 两模式共用的左滑动作矩阵输入：字面量并集，矩阵只关心 not_started / failed 两个分支 */
type 附件解析简 = BFF附件简历['current_version']['parse']['status'];

/** 附件待处理动作（唯一挂起槽）：create/replace 由 ＋ 与行内替换进入并挂起所选文件，
 *  parse/delete 各自挂起触发行的标识。确认层同一调用结构由这个槽派生 props。 */
type 待处理动作形 =
  | { kind: 'create' }
  | { kind: 'replace'; fileId: string }
  | { kind: 'parse'; fileId: string }
  | { kind: 'delete'; fileId: string };

export default function 我的简历() {
  const { 返回, 跳转 } = use导航();
  // 全部简历数据读全局切片：在工作经历页 / 基本信息页改完，这里立刻是新的
  const { 状态: 全局, 操作, 数据源模式, 后端状态 } = use应用状态();
  const 经历列表 = 全局.简历经历;

  // P2 Task 6 + core editors §5.3（Task 8）：附件简历卡两模式共用 简历附件区 展示。
  // 一次只开一行滑动（打开附件编号 两模式同源）；附件待处理动作收进唯一挂起槽 待处理动作
  //（create/replace 共用授权层并锁定触发动作的真实 file ID / 模拟键，显式解析与删除
  // 各自挂起），确认层由这一个槽派生同一套 props，不再维护多套 modal JSX。
  // Backend：四个 mutation 都过 执行附件变更 的返回值门再提示；Mock：同意后本地模拟，
  // 零请求零 mutation，成功与否以行状态变化呈现（不宣称真实上传/识别）。
  const [打开附件编号, 设打开附件编号] = useState<string | null>(null);
  const [待处理动作, 设待处理动作] = useState<待处理动作形 | null>(null);
  const [待确认文件, 设待确认文件] = useState<File | null>(null);
  const [附件提交中, 设附件提交中] = useState(false);
  const 附件选择框 = useRef<HTMLInputElement>(null);
  const 附件库 = 数据源模式 === 'backend' ? 后端状态.附件简历库 : null;
  // 两种模式收成同一份行投影（诊断区与附件区都用）：不新增分组标题或布局节点，只按模式换文案与行尾
  const 是后端 = 数据源模式 === 'backend';
  // Mock 模拟行：本页局部生命周期，选择文件后沿现有验证与同意步骤，离页回演示初值
  const [模拟附件行们, 设模拟附件行们] = useState<Mock附件行[]>(演示附件初值);
  const 模拟键序 = useRef(1);
  const 模拟解析定时 = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // 卸载清理：模拟解析的异步状态不跨页存活（局部受清理的异步状态）
  useEffect(() => () => {
    for (const 定时 of 模拟解析定时.current.values()) clearTimeout(定时);
    模拟解析定时.current.clear();
  }, []);
  // Backend 页面可见期轮询附件解析状态（钩子内部自判 Mock / 未登录 / 角色，静默）；
  // 预览钩子只在点击行后才开窗，挂载本身零副作用
  use附件简历刷新(数据源模式 === 'backend');
  const { 打开附件PDF } = use附件PDF预览();

  /**
   * 代理诊断（标注 2026-08-18 21:22 重做）：这块的定位是「告诉用户哪里还缺信息」，
   * 所以按真实数据逐项算缺口，每条点一下直接跳去补 —— 不做写作辅导，
   * 也不提任何薪资筹码（代理不谈薪资，那是意向确认后你和 HR 自己谈的）。
   */
  const 诊断项 = (() => {
    const 项: { 文案: string; 去处: string }[] = [];
    if (!全局.基本信息.真名.trim() || !全局.基本信息.开始工作年) {
      项.push({ 文案: '基本信息没填全 —— 匿名初筛靠它核对年限要求', 去处: 路径.基本信息 });
    }
    const 缺内容 = 经历列表.filter((条) => !条.内容.trim());
    if (缺内容.length > 0) {
      项.push({
        文案: `${缺内容.length} 段工作经历还没写工作内容 —— 递交简历阶段对方只能看到职位名`,
        去处: 路径.工作经历,
      });
    }
    const 无项目 = 经历列表.filter((条) => !条.项目 || 条.项目.length === 0);
    if (无项目.length === 经历列表.length && 经历列表.length > 0) {
      项.push({ 文案: '还没填关键项目 —— 这是代理判断方向对口最直接的依据', 去处: 路径.工作经历 });
    }
    if (全局.简历技能.length < 5) {
      项.push({
        文案: `专业技能只有 ${全局.简历技能.length} 个 —— 初筛核对技术域时能用的证据偏少`,
        去处: 路径.工作经历,
      });
    }
    if (全局.简历教育.length === 0) {
      项.push({ 文案: '教育经历还没填 —— 很多岗位把学历写进硬性条件', 去处: 路径.工作经历 });
    }
    if (全局.简历证书.length === 0) {
      项.push({ 文案: '还没填资格证书（选填）—— 有的话是硬性核对的加分项', 去处: 路径.工作经历 });
    }
    return 项;
  })();
  // Backend 完整度检查：同一诊断区与列表行，按真实简历切片分「待补全 / 可提升」两类；
  // 标题计数只读待补全，证书等选填建议只进可提升。上面的原型 诊断项 仍是 Mock 专用口径。
  const 完整度 = 检查资料完整度({
    基本信息: 全局.基本信息,
    经历: 经历列表,
    教育: 全局.简历教育,
    技能: 全局.简历技能,
    证书: 全局.简历证书,
  });
  const Backend诊断项 = [
    ...完整度.待补全.map((项) => ({ ...项, 类别: '待补全' as const })),
    ...完整度.可提升.map((项) => ({ ...项, 类别: '可提升' as const })),
  ];
  const Backend摘要 = 完整度.待补全[0] !== undefined
    ? `待补全 · ${完整度.待补全[0].文案}`
    : 完整度.可提升[0] !== undefined
      ? `可提升 · ${完整度.可提升[0].文案}`
      : '硬性条件核对需要的信息都齐了';
  const Backend展开键文案 = 完整度.待补全.length > 0 ? '去补全' : '看建议';
  const 诊断有行 = 是后端 ? Backend诊断项.length > 0 : 诊断项.length > 0;
  const 诊断行 = 是后端
    ? Backend诊断项.map((项) => ({
        键: `${项.类别} · ${项.文案}`,
        文案: `${项.类别} · ${项.文案}`,
        去处: 项.去处,
        行尾: 项.类别 === '待补全' ? '去补 ›' : '去完善 ›',
      }))
    : 诊断项.map((条) => ({ 键: 条.文案, 文案: 条.文案, 去处: 条.去处, 行尾: '去补 ›' }));

  const 教育列表 = 全局.简历教育;
  const 技能列表 = 全局.简历技能;
  const 证书列表 = 全局.简历证书;
  const 基本 = 全局.基本信息;

  // 诊断条「去查看」展开代理挑出的待优化项；附件行点一下给一条说明，避免点了没反应
  const [展开诊断, 设展开诊断] = useState(false);
  const [显示附件说明, 设显示附件说明] = useState(false);
  // 姓名支持行内改（标注意见 #6）；其余三项是派生值或别处的写入口，点了跳过去改
  // 姓名草稿：逐字输入只改本地态，blur/Enter 才调一次 操作.保存简历，避免每个按键产生 HTTP PATCH
  const [改名中, 设改名中] = useState(false);
  const [姓名草稿, 设姓名草稿] = useState(基本.真名);

  const 保存姓名 = async () => {
    设改名中(false);
    if (姓名草稿.trim() === 基本.真名.trim()) return;
    // M：姓名走 profile 分区，身份未定时先去状态页收口，不靠数据源「跳过 profile」假装保存成功
    if (数据源模式 === 'backend' && 基本.身份 === '') {
      轻提示('请先选择求职状态');
      跳转(路径.求职状态);
      return;
    }
    try {
      await 操作.保存简历({
        基本信息: { ...基本, 真名: 姓名草稿 },
        个人优势: 全局.个人优势,
        技能: 技能列表,
        经历: 经历列表,
        教育: 教育列表,
        证书: 证书列表,
      });
    } catch (错误) {
      轻提示(取后端错误文案(错误));
    }
  };

  // ── 附件动作处理（P2 Task 6 + core editors §5.3 Task 8）──

  /** 四个 mutation 共用的返回值门：已换代（会话已转移）静默不提示，
      已提交 才发成功文案；失败走 附件错误文案 的闭合表。不允许在 await 后无条件 toast。 */
  async function 执行附件变更(run: () => Promise<附件变更结果>, successCopy: string): Promise<boolean> {
    try {
      const result = await run();
      if (result === '已换代') return false;
      轻提示(successCopy);
      return true;
    } catch (error) {
      轻提示(附件错误文案(error, 附件库?.limits ?? null));
      return false;
    }
  }

  /** ＋ / 行内替换 共用的文件选择：立即清 input value（允许重选同一文件），
      本地预检（扩展名 / media type / 快照大小上限）过了只挂起待授权 —— 同意前零网络零 mutation。 */
  function 选中附件文件(事件: ChangeEvent<HTMLInputElement>) {
    const 文件 = 事件.target.files?.[0];
    事件.target.value = '';
    if (!文件) return;
    const 错误 = 校验附件PDF(文件, 附件库?.limits ?? null);
    if (错误) {
      轻提示(错误);
      return;
    }
    设待确认文件(文件);
  }

  /** 清掉某行的模拟解析定时：替换/删除/重新解析前先收掉，迟到的定时不得改写新状态 */
  function 清模拟解析定时(键: string) {
    const 定时 = 模拟解析定时.current.get(键);
    if (定时 !== undefined) {
      clearTimeout(定时);
      模拟解析定时.current.delete(键);
    }
  }

  // ── Mock 模拟（零请求零 mutation）：同意后才动本地模拟状态，行状态变化即反馈 ──

  function 模拟创建附件(file: File) {
    const 键 = `mock_att_${模拟键序.current++}`;
    设模拟附件行们((旧行们) => [...旧行们, { 键, 名称: file.name, 状态: 'not_started' as const }]);
  }

  /** 替换保留点击目标身份：键（行身份）不动，名称换成新挑的文件，解析状态重置
      （未完成的模拟解析定时一并清掉） */
  function 模拟替换附件(键: string, 名称: string) {
    清模拟解析定时(键);
    设模拟附件行们((旧行们) =>
      旧行们.map((行) => (行.键 === 键 ? { 键: 行.键, 名称, 状态: 'not_started' as const } : 行)));
  }

  function 模拟删除附件(键: string) {
    清模拟解析定时(键);
    设模拟附件行们((旧行们) => 旧行们.filter((行) => 行.键 !== 键));
  }

  /** 模拟解析 not_started → processing →（局部定时）succeeded / 注入 failed：
      不生成解析内容、不伪造 pending，定时受卸载与本行后续动作清理。 */
  function 模拟解析附件(键: string) {
    清模拟解析定时(键);
    设模拟附件行们((旧行们) => 旧行们.map((行) => (行.键 === 键 ? { ...行, 状态: 'processing' as const } : 行)));
    模拟解析定时.current.set(键, setTimeout(() => {
      模拟解析定时.current.delete(键);
      const 终态: Mock解析状态 = 注入模拟解析失败.启用 ? 'failed' : 'succeeded';
      设模拟附件行们((旧行们) => 旧行们.map((行) => (行.键 === 键 ? { ...行, 状态: 终态 } : 行)));
    }, 模拟解析毫秒));
  }

  /** 授权层「同意并继续」：空位 create / 行内 replace。执行时捕获 待处理动作 与所选文件，
      replace 只替换触发动作的那一行真实 file ID（重排不变 index）；成功后层关，
      失败保留权威行仅提示；Mock 同意后本地模拟，确认前无变更。 */
  async function 同意上传附件() {
    if (!待确认文件 || !待处理动作 || 附件提交中) return;
    if (待处理动作.kind !== 'create' && 待处理动作.kind !== 'replace') return;
    const file = 待确认文件;
    const target = 待处理动作;
    if (是后端) {
      设附件提交中(true);
      try {
        if (target.kind === 'create') {
          await 执行附件变更(() => 操作.创建附件简历(file, true), '简历已上传，正在识别');
        } else {
          await 执行附件变更(() => 操作.替换附件简历(target.fileId, file, true), '简历已上传，正在识别');
        }
      } finally {
        设附件提交中(false);
        设待确认文件(null);
        设待处理动作(null);
      }
      return;
    }
    if (target.kind === 'create') 模拟创建附件(file);
    else 模拟替换附件(target.fileId, file.name);
    设待确认文件(null);
    设待处理动作(null);
  }

  /** 解析授权层「同意并继续」：显式 parse 只对触发行发请求（consent 字面量 true）；
      Mock 走本地模拟解析。 */
  async function 同意解析附件() {
    if (!待处理动作 || 待处理动作.kind !== 'parse' || 附件提交中) return;
    const fileId = 待处理动作.fileId;
    if (是后端) {
      设附件提交中(true);
      try {
        await 执行附件变更(() => 操作.请求附件解析(fileId, true), '已开始识别简历');
      } finally {
        设附件提交中(false);
        设待处理动作(null);
      }
      return;
    }
    模拟解析附件(fileId);
    设待处理动作(null);
  }

  /** 删除确认「删除附件简历」：确认前不动任何状态，行一直在权威/模拟列表里。 */
  async function 确认删除附件() {
    if (!待处理动作 || 待处理动作.kind !== 'delete' || 附件提交中) return;
    const fileId = 待处理动作.fileId;
    if (是后端) {
      设附件提交中(true);
      try {
        await 执行附件变更(() => 操作.删除附件简历(fileId), '附件简历已删除');
      } finally {
        设附件提交中(false);
        设待处理动作(null);
      }
      return;
    }
    模拟删除附件(fileId);
    设待处理动作(null);
  }

  /** 状态 → 左滑动作矩阵（设计 §8.2）：not_started=解析、failed=重新解析，
      pending/processing/succeeded 无解析动作；替换 / 删除全态可用。
      标识 = Backend 真实 file ID（闭包捕获，不因重排变 index）/ Mock 模拟键 —— 两模式同一矩阵。 */
  function 附件动作(解析: 附件解析简, 标识: string): 滑动操作[] {
    const 动作: 滑动操作[] = [];
    if (解析 === 'not_started' || 解析 === 'failed') {
      动作.push({
        文字: 解析 === 'not_started' ? '解析' : '重新解析',
        按下: () => 设待处理动作({ kind: 'parse', fileId: 标识 }),
      });
    }
    动作.push({
      文字: '替换',
      按下: () => {
        // 先锁定这一行的标识再开文件框：授权时只替换它，与 ＋ 的 create 路径互斥
        设待处理动作({ kind: 'replace', fileId: 标识 });
        附件选择框.current?.click();
      },
    });
    动作.push({ 文字: '删除', 危险: true, 按下: () => 设待处理动作({ kind: 'delete', fileId: 标识 }) });
    return 动作;
  }

  // 两模式收成同一份行投影喂给共用附件区：Backend 权威库（真实 file ID），Mock 模拟行
  //（模拟键）—— 同一可见结构，不按数据源选另一套 JSX。状态文案走 附件状态文案 / Mock行说明。
  const Backend附件行们: 附件展示行[] = (附件库?.items ?? []).map((file) => ({
    键: file.file_id,
    名称: file.display_name,
    说明: 附件状态文案(file),
    操作们: 附件动作(file.current_version.parse.status, file.file_id),
    打开: () => { void 打开附件PDF(file.file_id); },
  }));
  const Mock附件行们: 附件展示行[] = 模拟附件行们.map((行) => ({
    键: 行.键,
    名称: 行.名称,
    说明: Mock行说明(行),
    操作们: 附件动作(行.状态, 行.键),
    打开: () => 设显示附件说明((旧) => !旧),
  }));

  /** 确认层 props 由唯一挂起槽派生：上传/解析授权同一套文案，删除用自己的标题/执行文
      —— 同一调用结构，不维护多套 modal JSX；取消只清挂起态，零 mutation。
      上传/替换必须等所选文件挂起才出层（确认前无变更），解析/删除挂起即出。 */
  const 附件确认层 = (() => {
    if (待处理动作 === null) return null;
    if (待处理动作.kind === 'create' || 待处理动作.kind === 'replace') {
      if (待确认文件 === null) return null;
    }
    if (待处理动作.kind === 'delete') {
      return {
        标题: '删除附件简历？',
        正文: '删除后无法恢复。',
        执行文: '删除附件简历',
        执行: () => { void 确认删除附件(); },
      };
    }
    return {
      标题: '允许 AI 识别这份简历？',
      正文: '这份 PDF 将发送给受控模型服务进行简历识别，可能包含个人信息。确认后才会上传并开始处理。',
      执行文: '同意并继续',
      执行: () => { void (待处理动作.kind === 'parse' ? 同意解析附件() : 同意上传附件()); },
    };
  })();

  // 工作年限是派生值：空/非法/未来年份一律「未填写」，绝不用当前年补文本伪造起始年
  const 折算年限 = 折算工作年限(基本.开始工作年);

  return (
    <次级页外壳>
      <返回栏 返回={返回} 标题="我的简历" 居中标题 />

      {/* 代理诊断绿条：代理把简历里「谈判时会吃亏」的地方挑出来。
          Backend 改叫「资料完整度检查」：标题计数只读待补全，行内加类别前缀，
          节点结构与 class 与 Mock 完全同套 */}
      <div className={样式.诊断区}>
        <div className={样式.诊断条}>
          <span className={样式.诊断标}>
            {是后端
              ? (完整度.待补全.length > 0
                ? `◈ 资料完整度检查 · ${完整度.待补全.length} 处待补全`
                : '◈ 资料完整度检查 · 资料已补全')
              : (诊断项.length > 0
                ? `◈ AI代理诊断 · ${诊断项.length} 处待补全`
                : '◈ AI代理诊断 · 资料已补全')}
          </span>
          <span className={`${样式.诊断说明} 单行`}>
            {是后端
              ? Backend摘要
              : (诊断项.length > 0 ? 诊断项[0].文案 : '硬性条件核对需要的信息都齐了')}
          </span>
          {诊断有行 ? (
            <button
              className={`${样式.诊断键} 可点`}
              onClick={() => 设展开诊断((旧) => !旧)}
            >
              {展开诊断 ? '收起' : (是后端 ? Backend展开键文案 : '去补全')}
            </button>
          ) : null}
        </div>

        {展开诊断 && 诊断有行 ? (
          <div className={样式.诊断详情}>
            {诊断行.map((条) => (
              <button
                key={条.键}
                className={`${样式.诊断项} 可点`}
                onClick={() => 跳转(条.去处)}
              >
                <span className={样式.诊断项文}>{条.文案}</span>
                <span className={样式.诊断项去}>{条.行尾}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <滚动区>
        <div className={样式.列表}>
          {/* 基本信息：姓名在意向确认前对企业不可见，这里是本人视角所以照实显示。
              工作年限是 开始工作年 折算出来的派生值，不给单独编辑 —— 否则会出现
              「年限写 10 年、起始年份算出来 7 年」这种代理无从核对的自相矛盾数据 */}
          <div className={样式.卡}>
            <div className={样式.卡标题}>基本信息</div>
            <div className={样式.条目区}>
              <可改条目
                标签="姓名（递交简历后披露）"
                值={改名中 ? 姓名草稿 : 基本.真名}
                编辑中={改名中}
                开始编辑={() => { 设姓名草稿(基本.真名); 设改名中(true); }}
                结束编辑={保存姓名}
                改变={设姓名草稿}
              />
              <表单条目
                标签="工作年限"
                值={
                  基本.身份 === '在校'
                    ? '应届 · 在校'
                    : 折算年限 === null
                      ? '未填写'
                      : `${折算年限} 年 · 自 ${基本.开始工作年} 年起`
                }
                按下={() => 跳转(路径.基本信息)}
              />
              <表单条目
                标签="最高学历"
                值={教育列表[0] ? `${教育列表[0].学历} · ${教育列表[0].专业}` : '未填'}
                按下={() => 跳转(路径.工作经历)}
              />
              <表单条目
                标签="当前状态"
                值={状态文案[基本.身份]}
                按下={() => 跳转(路径.基本信息)}
              />
            </div>
          </div>

          {/* 工作经历：全部段落来自全局简历切片，点任意一段进编辑屏 */}
          <div className={样式.卡}>
            <div className={样式.卡标题}>工作经历</div>
            {经历列表.map((条, 序) => (
              <button
                key={条.编号}
                className={`${样式.经历行} ${序 === 经历列表.length - 1 ? 样式.末行 : ''} 可点`}
                onClick={() => 跳转(路径.工作经历)}
              >
                <span className={样式.经历主体}>
                  <span className={样式.经历公司}>{条.公司}</span>
                  <span className={样式.经历职位}>{条.职位}</span>
                  <span className={样式.经历时间}>
                    {显示年月(条.开始)} — {显示年月(条.结束)}
                    {条.行业 ? ` · ${条.行业}` : ''}
                  </span>
                  {/* 关键项目挂在所属经历下面（全是 span：外层已经是 button，不能再套 button）*/}
                  {(条.项目 ?? []).length > 0 ? (
                    <span className={样式.项目组}>
                      {(条.项目 ?? []).map((项) => (
                        <span key={项.编号} className={样式.项目行}>
                          <span className={样式.项目名}>{项.名称 || '未命名项目'}</span>
                          {项.角色 ? <span className={样式.项目附}>{项.角色}</span> : null}
                          {项.结果 ? <span className={样式.项目结果}>{项.结果}</span> : null}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </span>
                <span className={样式.尖括号}>›</span>
              </button>
            ))}
          </div>

          {/* 教育经历：与工作经历同源，点进同一个编辑屏 */}
          <div className={样式.卡}>
            <div className={样式.卡标题}>教育经历</div>
            {教育列表.map((条, 序) => (
              <button
                key={条.编号}
                className={`${样式.经历行} ${序 === 教育列表.length - 1 ? 样式.末行 : ''} 可点`}
                onClick={() => 跳转(路径.工作经历)}
              >
                <span className={样式.经历主体}>
                  <span className={样式.经历公司}>{条.学校}</span>
                  <span className={样式.经历职位}>
                    {条.学历} · {条.专业}
                  </span>
                  <span className={样式.经历时间}>
                    {显示年月(条.开始)} — {显示年月(条.结束)}
                  </span>
                </span>
                <span className={样式.尖括号}>›</span>
              </button>
            ))}
          </div>

          {/* 专业技能：与工作经历页同源。匿名初筛按标签逐条比对岗位技术要求 */}
          <div className={样式.卡}>
            <div className={样式.卡标题}>专业技能</div>
            <button
              className={`${样式.标签行} 可点`}
              onClick={() => 跳转(路径.工作经历)}
            >
              {技能列表.length > 0 ? (
                <span className={样式.标签组}>
                  {技能列表.map((项) => (
                    <span key={项} className={样式.标签}>
                      {项}
                    </span>
                  ))}
                </span>
              ) : (
                <span className={样式.空态}>还没填技能标签，去添加</span>
              )}
              <span className={样式.尖括号}>›</span>
            </button>
          </div>

          {/* 资格证书：部分岗位把它写进硬性条件，缺了会在初筛就被刷掉 */}
          <div className={样式.卡}>
            <div className={样式.卡标题}>资格证书</div>
            {证书列表.length > 0 ? (
              证书列表.map((条, 序) => (
                <button
                  key={条.编号}
                  className={`${样式.经历行} ${序 === 证书列表.length - 1 ? 样式.末行 : ''} 可点`}
                  onClick={() => 跳转(路径.工作经历)}
                >
                  <span className={样式.经历主体}>
                    <span className={样式.证书名}>{条.名称}</span>
                    {条.年份 ? (
                      <span className={样式.经历时间}>{条.年份} 年取得</span>
                    ) : null}
                  </span>
                  <span className={样式.尖括号}>›</span>
                </button>
              ))
            ) : (
              <button
                className={`${样式.标签行} 可点`}
                onClick={() => 跳转(路径.工作经历)}
              >
                <span className={样式.空态}>还没填证书，去添加</span>
                <span className={样式.尖括号}>›</span>
              </button>
            )}
          </div>

          {/* 个人优势：数据里是带 \n 的多行串，靠 white-space: pre-line 还原换行 */}
          <div className={样式.卡}>
            <div className={样式.卡标题}>个人优势</div>
            <div className={样式.优势正文}>{全局.个人优势}</div>
          </div>

          {/* 附件简历：初筛通过后递交 PDF 原件，原件含姓名与联系方式。
              两模式共用 简历附件区（core editors §5.3）：标题/＋、PDF 行、空态、
              滑动容器同一套，不按数据源选另一套 JSX；卡外壳与文件 input 留本页。
              Backend 点行打开真实 PDF 预览（P2 Task 6）；Mock 点行走既有原型预览提示 */}
          <div className={样式.卡}>
            <简历附件区
              行们={是后端 ? Backend附件行们 : Mock附件行们}
              可添加={是后端
                ? 附件库 !== null && 附件库.items.length < 附件库.limits.max_files
                : Mock附件行们.length < 模拟附件上限}
              忙={附件提交中}
              添加={() => {
                设待处理动作({ kind: 'create' });
                附件选择框.current?.click();
              }}
              展开键={打开附件编号}
              请求展开={设打开附件编号}
            />
            <input
              ref={附件选择框}
              type="file"
              accept=".pdf,application/pdf"
              hidden
              onChange={选中附件文件}
            />
            {显示附件说明 ? (
              <div className={样式.附件提示}>原型演示：真机上在这里打开系统 PDF 预览。</div>
            ) : null}
          </div>

          {/* 多意向引导：一份简历可以挂多个求职意向，各自独立谈。
              不改注册流程，只在这里留一行轻提示，用户想起来的时候找得到入口 */}
          <button className={`${样式.加意向行} 可点`} onClick={() => 跳转(路径.添加意向)}>
            <span className={样式.加意向文}>还可以再加一个求职意向</span>
            <span className={样式.尖括号}>›</span>
          </button>
        </div>
      </滚动区>

      {/* P2 Task 6 + core editors §5.3（Task 8）：附件授权 / 确认层 —— 唯一一套 modal JSX，
          props 由待处理动作派生（上传授权的标题/正文/执行文与 完善资料（Task 5）逐字相同；
          删除用自己的标题/执行文）。取消 / 遮罩 / Escape 都只清本地挂起态，零 mutation。 */}
      {附件确认层 ? (
        <确认层
          标题={附件确认层.标题}
          正文={附件确认层.正文}
          执行文={附件确认层.执行文}
          执行={附件确认层.执行}
          取消={() => {
            设待确认文件(null);
            设待处理动作(null);
          }}
        />
      ) : null}
    </次级页外壳>
  );
}

/** 一行可行内编辑的条目（同 工作经历 屏当年的模式）：
 *  只读态复用地基 <表单条目>，点一下换成同版式输入框，切换不跳动 */
function 可改条目({
  标签,
  值,
  编辑中,
  开始编辑,
  结束编辑,
  改变,
}: {
  标签: string;
  值: string;
  编辑中: boolean;
  开始编辑: () => void;
  结束编辑: () => void;
  改变: (新值: string) => void;
}) {
  if (!编辑中) {
    return <表单条目 标签={标签} 值={值} 按下={开始编辑} />;
  }
  return (
    <div className={样式.编辑条目}>
      <div className={样式.编辑条目标签}>{标签}</div>
      <input
        className={样式.编辑条目输入}
        value={值}
        aria-label={标签}
        autoFocus
        onChange={(事件) => 改变(事件.target.value)}
        onBlur={结束编辑}
        onKeyDown={(事件) => {
          if (事件.key === 'Enter' && !事件.nativeEvent.isComposing) 结束编辑();
        }}
      />
    </div>
  );
}
