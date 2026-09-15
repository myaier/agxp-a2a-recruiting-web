// A2 工作经历 —— 参考 BOSS直聘 的「列表 + 全屏编辑页」形态重做（2026-08-17 用户反馈）。
//
// 两个视图，同屏切换：
//   · 列表视图：上传解析条 → 每段经历一张卡（公司 / 职位 / 起止时间 / 行业，点击进编辑）
//     → 「＋ 添加工作经历」→ 右上角「保存」进引导问答
//   · 编辑视图：公司名称 / 所属行业（快捷片 + 可输入）/ 职位名称
//     / 在职时间（原生年月选择器 + 「至今」开关）/ 工作内容（大文本）
//     必填齐「完成」才点亮；编辑已有段时底部有红字「删除这段经历」。
//
// 在职时间用 <input type="month">：iOS 弹原生年月滚轮，桌面有日历下拉，
// 不再是能输任意字符的自由文本 —— 这是上一版最大的 bug。
//
// 候选 onboarding 简历预填（Spec §8 /experience，Task 6）：首挂载同步用 取工作页预填
// 一次物化四分区（空服务端且空页面才物化；附加教育只在前四页形成的 educations[0] 之后
// 追加 slice(1)），经一次性 useLayoutEffect 走既有 存简历 通道种入根草稿；
// 保存点击用 数未完成项 对当前列表实时重数后进 轻提示「还有 N 处需要选择目录或补充必填项」
// （不用挂载时冻结的 unresolvedCount：用户补齐/删除物化条目后要放行），
// 不新增任何提示节点；确认 work 分区只在既有保存成功后。

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import 样式 from './工作经历.module.css';
import 年月滚轮层 from '../组件/年月滚轮层';
// Task 5（core editors §5.2）：教育 学校/专业 候选行共用组件；Task 2（editor-catalog-fullscreen）
// 起由 教育目录子视图 在全屏子视图里调用（原页内两份候选 JSX 与查询状态已迁入）
import { 教育目录候选列表, type 教育候选 } from '../组件/教育目录候选列表';
// Task 6（core editors §5.2）：经历 所属行业 选择正文共用组件（原页内两模式两套 JSX 迁出）
// picker 统一 Task 1：目录机制收敛到共用 行业目录钩子（查询适配在本文件注入），正文纯展示
// editor-catalog-fullscreen Task 3：承载从 72% 底部弹层换成全屏选择外壳（A 契约），目录行为不变
import {
  简历行业选择正文,
} from '../组件/简历行业选择正文';
import {
  use行业目录,
  创建模拟行业查询,
  创建目录行业查询,
  模拟行业名,
  模拟行业键们,
} from './行业目录钩子';
import type { 行业项, 查询行业页 } from '../组件/行业分类列表';
import { 次级页外壳, 返回栏, 页面大标题, 滚动区, 开关 } from '../组件/通用';
import { 轻提示 } from '../组件/轻提示';
import { use应用状态 } from '../状态/应用状态';
import { 取后端错误文案 } from '../数据/HTTP客户端';
import type { 简历经历段, 简历教育段, 简历项目, 简历证书 } from '../数据/类型';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { 并入建档草稿, 教育段缺项, 规范化作品集链接, 校验作品集链接, 校验起止年月 } from '../流程/onboarding配置';
import { 取工作页预填, 数未完成项 } from '../流程/候选Onboarding简历预填';
import { 创建空候选预填状态 } from '../状态/后端/类型';
import type { 建档编辑中草稿, 建档条目种类, 建档明确删除条目, 候选引导建档草稿 } from '../数据/资料缓存';
import type { 目录选择值, 目录页 } from '../数据/招聘数据源类型';
import { 学校副标题, 合并目录页 } from '../数据/目录选择';
import { 高校名录 } from '../数据/高校名录';
import { 专业名录 } from '../数据/专业名录';
// 合同 C：公司名称走 公司选择抽屉接线（12 个共用 props 的薄包装），搜索/创建走
// 合同 A 目录三操作；旧公司文本只预填搜索词，真实 organization_id 只来自本实例结果。
import 公司选择抽屉接线 from '../组件/公司选择抽屉接线';
import { use组织查询 } from './组织查询钩子';
import { 模拟目录搜索, 模拟目录添加 } from '../数据/企业端模拟数据';
import type { BFF组织搜索项 } from '../数据/BFF契约';
// Task 2（editor-catalog-fullscreen）：教育 学校/专业 的全屏选择子视图外壳（A 契约）
import { 全屏选择外壳 } from '../组件/全屏选择外壳';

/** 一段工作经历。开始/结束用 input[type=month] 的 yyyy-MM 格式；结束 null = 至今 */

const 学历选项 = ['大专', '本科', '硕士', '博士'];

/** 'yyyy-MM' → 'yyyy.MM'；null → '至今' */
function 显示年月(值: string | null): string {
  if (!值) return '至今';
  return 值.replace('-', '.');
}

/** 本月，'yyyy-MM'。入职 / 入学 / 离职都不该选到未来，这是滚轮的天然上界 */
const 本月 = () => new Date().toISOString().slice(0, 7);

/**
 * 「开始」侧滚轮的上界：既不能晚于已填的结束，也不能选到未来，取两者里更早的那个。
 *
 * 这是日期倒置的第一道防线 —— 结束侧本来就有 最小=开始 挡着，开始侧却一直没有上界，
 * 所以「先填结束、再把开始往后滚」这条路能滚出 2020.09 — 2018.06。
 * 第二道防线是提交前的 校验起止年月：滚轮只能挡住在这一屏改出来的倒置，
 * 挡不住旧存档里已经倒置的数据。
 */
function 开始上界(结束: string | null): string {
  const 今 = 本月();
  return 结束 && 结束 < 今 ? 结束 : 今;
}

export default function 工作经历() {
  const { 跳转, 返回 } = use导航();
  const { 状态: 全局, 派发, 操作, 数据源模式, 后端状态 } = use应用状态();
  const 是后端 = 数据源模式 === 'backend';
  // J-PILOT-02 Task 4：建档草稿在场时它就是这一屏的输入真相 —— 保存成功后的权威
  // 水合会按服务端快照重写 Context（不完整条目被 BFF 跳过后根本不在快照里），
  // 只有草稿留得住用户这一轮敲进去的内容。Mock 不涉及草稿，读写全部退回 Context。
  //
  // 旅程标记：这一屏也是日常编辑入口（我的简历 → 工作经历 / 教育 / 技能 / 证书各行）。
  // 只有注册旅程（引导预填 非 null，由 学生分流 的 启程引导 在进旅程前派发）才碰草稿：
  // 日常编辑一旦落下草稿，简历域保存 就从「非 onboarding 原路径」切到单槽 + 缺项保护
  // 那条，删除会被原样带回、教育门槛会误伤「至今在读」，那是改日常编辑业务。
  const 旅程中 = 是后端 && 全局.引导预填 !== null;
  const 建档 = 旅程中 ? 全局.引导预填?.建档 : undefined;
  // 学生分支（身份来自学生分流屏）：教育置顶，工作经历段改叫「实习经历」
  const 在校中 = (建档?.资料?.基本信息?.身份 ?? 全局.基本信息.身份) === '在校';
  const 经历区块名 = 在校中 ? '实习经历' : '工作经历';
  // 简历数据来自全局（并已持久化）：此前是本页 useState，一离开页面就回到 mock，
  // 用户「每次都要重走 onboarding 才能恢复」（2026-08-18 用户复现）
  const 经历列表 = 建档?.资料?.经历 ?? 全局.简历经历;
  const 教育列表 = 建档?.资料?.教育 ?? 全局.简历教育;
  const 技能列表 = 建档?.资料?.技能 ?? 全局.简历技能;
  const 证书列表 = 建档?.资料?.证书 ?? 全局.简历证书;
  // 作品集链接：整份简历一条，与专业技能 / 证书与语言并列的独立区块（2026-08-22 从「完善资料」屏搬来）
  // 三态（冻结合同 1）：草稿里没有这个键 = 本轮没改（保存时不带属性，不拿旧 GET 覆盖）；
  // 有键 = 用户明确编辑过，null 即清空。
  // Task 1（core editors §6.1）：本页本轮的局部编辑意图独立于 onboarding ——
  // undefined = 未触碰（输入跟随权威值，失败水合不得覆盖已触碰的输入）；
  // string | null = 本页明确编辑过（null 即明确清空）。组件卸载即清理，退出/切换主体不残留；
  // 保存成功清意图、取权威回显，失败保留输入供显式重试。
  const [链接意图, 设链接意图] = useState<string | null | undefined>(undefined);
  const 草稿链接已改 = 建档?.资料 !== undefined && '作品集链接' in 建档.资料;
  const 作品集链接 = 链接意图 !== undefined ? (链接意图 ?? '') : 草稿链接已改
    ? (建档!.资料!.作品集链接 ?? '')
    : 全局.简历作品集链接;
  const 作品集错误 = 校验作品集链接(作品集链接);
  const 存作品集链接 = (值: string) => {
    设链接意图(值 === '' ? null : 值);
    // review-r1 F1：Backend 的 全局.简历作品集链接 由权威 GET 水合 —— 保存前的逐字输入
    // 不能写它，否则「打字 → 离开不保存 → 再进来」会把未保存的值冒充成已保存值；
    // 输入只落本页局部意图（保存时随 next 带上）。Mock 没有权威水合，沿原行为即时写全局态。
    if (!是后端) 派发({ 型: '存作品集链接', 链接: 值 });
    // 清空是「明确清空」，落 null；不是缺省
    if (旅程中) 操作.更新候选建档草稿(并入建档草稿(建档, { 资料: { 作品集链接: 值 === '' ? null : 值 } }));
  };
  /** 保存时随 next 携带的三态：局部意图优先；旅程里草稿恢复的「链接已改」（刷新后
   *  意图已不在内存）也要随保存带上。未改省略属性。 */
  const 保存链接 = 链接意图 !== undefined
    ? 链接意图
    : 草稿链接已改 ? (建档!.资料!.作品集链接 ?? null) : undefined;
  /** 统一写入口：任何一块改动都连同其余块一起存（保持快照完整）。
   *  草稿增量 与四个列表在同一次 更新候选建档草稿 里写完 —— 分两次写会用过期的
   *  建档 覆盖掉前一次（闭包里的 建档 不会因为派发就变新）。 */
  const 存 = (
    改: Partial<{
      经历: 简历经历段[];
      教育: 简历教育段[];
      技能: string[];
      证书: 简历证书[];
    }>,
    草稿增量?: Partial<候选引导建档草稿>,
  ) => {
    const 下一 = {
      经历: 改.经历 ?? 经历列表,
      教育: 改.教育 ?? 教育列表,
      技能: 改.技能 ?? 技能列表,
      证书: 改.证书 ?? 证书列表,
    };
    派发({ 型: '存简历', ...下一, 基本信息: 全局.基本信息 });
    if (旅程中) 操作.更新候选建档草稿(并入建档草稿(建档, { 资料: 下一, ...草稿增量 }));
  };
  // 未完成的编辑层（Global 7 的 编辑中）：刷新回来直接回到那一层并带回已填字段
  // 恢复一次即止：取消/完成后这一层作废，再打开同一条不能把已丢弃的输入翻出来
  const [恢复编辑, 设恢复编辑] = useState(() => 建档?.编辑中);
  // null = 列表视图；'新增' = 空白编辑；其它 = 正在编辑的段编号
  const [编辑目标, 设编辑目标] = useState<string | '新增' | null>(
    恢复编辑?.种类 === 'experience' ? 恢复编辑.本地编号 : null,
  );
  // null = 不在编辑教育；'新增' = 空白；其它 = 正在编辑的教育段编号
  const [教育目标, 设教育目标] = useState<string | '新增' | null>(
    恢复编辑?.种类 === 'education' ? 恢复编辑.本地编号 : null,
  );
  /** 编辑层的每次输入都进草稿；取消/完成时显式丢弃（省略 编辑中 = 丢弃该层）。 */
  const 写编辑中 = (编辑中: 建档编辑中草稿) => {
    if (旅程中) 操作.更新候选建档草稿(并入建档草稿(建档, { 编辑中 }));
  };
  const 丢弃编辑层 = () => {
    设恢复编辑(undefined);
    if (旅程中) 操作.更新候选建档草稿(并入建档草稿(建档, { 编辑中: undefined }));
  };
  /** 明确删除的已存条目要登记：否则保存时的「缺项保护」会把服务端那条原样带回来。 */
  const 登记删除 = (种类: 建档条目种类, 本地或资源编号: string): Partial<候选引导建档草稿> => {
    const 已存 = (建档?.已存条目 ?? []).find(
      (条) => 条.种类 === 种类 && (条.资源编号 === 本地或资源编号 || 条.本地编号 === 本地或资源编号),
    );
    if (已存 === undefined) return {};
    const 登记: 建档明确删除条目 = {
      种类,
      资源编号: 已存.资源编号,
      revision: 已存.revision,
      ...(已存.父编号 !== undefined ? { 父编号: 已存.父编号 } : {}),
    };
    return { 明确删除条目: [...(建档?.明确删除条目 ?? []), 登记] };
  };
  // 技能 / 证书的行内录入草稿
  const [技能草稿, 设技能草稿] = useState('');
  // review-cx F4：证书行内输入是旅程里唯一的证书编辑控件，接 Global 7 的
  // `编辑中.certificate` 变体 —— 刷新后回填输入框原位；本地编号跨刷新保持
  //（「添加」用它落列表，同一条输入不换编号）。
  const [证书名草稿, 设证书名草稿] = useState(() =>
    恢复编辑?.种类 === 'certificate' ? (恢复编辑.字段.名称 ?? '') : '');
  const 证书编号引用 = useRef<string | null>(
    恢复编辑?.种类 === 'certificate' ? 恢复编辑.本地编号 : null);
  /** 输入即写草稿；清空输入是该控件唯一的明确放弃入口 —— 丢弃该层（编辑中 省略）。 */
  const 写证书名 = (值: string) => {
    设证书名草稿(值);
    if (!旅程中) return;
    if (值 === '') {
      证书编号引用.current = null;
      操作.更新候选建档草稿(并入建档草稿(建档, { 编辑中: undefined }));
      return;
    }
    if (证书编号引用.current === null) 证书编号引用.current = `c${Date.now()}`;
    操作.更新候选建档草稿(并入建档草稿(建档, {
      编辑中: { 种类: 'certificate', 本地编号: 证书编号引用.current, 字段: { 名称: 值 } },
    }));
  };
  // 保存 single-flight：保存中再点不重发；成功后才提示并跳转，失败提示错误且按钮恢复
  const [保存中, 设保存中] = useState(false);

  // 候选 onboarding 预填（Spec §8 /experience）：首挂载同步用 取工作页预填 算一次 ——
  // manual/inactive/已确认轮返回页面现值（四个列表原引用），只有真物化才换新数组。
  // 物化条目与手建条目走同一条 存简历 通道进根草稿：列表数据本就来自全局（2026-08-18）。
  const [工作页预填] = useState(() =>
    取工作页预填(后端状态?.候选预填状态 ?? 创建空候选预填状态(), {
      experiences: 经历列表,
      educations: 教育列表,
      skills: 技能列表,
      certificates: 证书列表,
    }),
  );
  // 一次性把物化结果种入根草稿（挂载域：work 未确认前清空物化条目、离开再回来会再次
  // 建议的非空守卫在映射层；无物化时零派发，manual/inactive/已确认流程保持现状）
  const 已种工作预填 = useRef(false);
  useLayoutEffect(() => {
    if (已种工作预填.current) return;
    已种工作预填.current = true;
    if (
      工作页预填.experiences !== 经历列表
      || 工作页预填.educations !== 教育列表
      || 工作页预填.skills !== 技能列表
      || 工作页预填.certificates !== 证书列表
    ) {
      存({
        经历: 工作页预填.experiences,
        教育: 工作页预填.educations,
        技能: 工作页预填.skills,
        证书: 工作页预填.certificates,
      });
    }
    // ref 守卫保证只跑首次：依赖表按 brief 固定，存 每渲染换标不影响语义
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [工作页预填, 存]);

  /** 加一条技能：去重 + 去空白，重复的直接吞掉不报错（用户多半只是手抖点了两次）*/
  const 加技能 = () => {
    const 词 = 技能草稿.trim();
    if (词 === '') return;
    if (!技能列表.includes(词)) 存({ 技能: [...技能列表, 词] });
    设技能草稿('');
  };

  const 加证书 = () => {
    const 名 = 证书名草稿.trim();
    if (名 === '') {
      轻提示('先填证书名称');
      return;
    }
    // 年份录入框按标注 14:31 删掉，新加的证书年份留空（列表里年份为空即不渲染）
    // review-cx F4：提交以草稿本地编号落列表（跨刷新同一身份），并显式清掉该编辑层
    存(
      {
        证书: [...证书列表, { 编号: 证书编号引用.current ?? `c${Date.now()}`, 名称: 名, 年份: '' }],
      },
      { 编辑中: undefined },
    );
    证书编号引用.current = null;
    设证书名草稿('');
  };

  /** 保存整份简历（single-flight）：经历/作品集守卫在前，保存中重复点击直接吞掉；
   * 成功以最终权威 GET 的水合为准，之后才 轻提示 并跳转下一屏。 */
  const 保存 = async () => {
    if (保存中) return;
    // 预填物化条目仍有未选目录或缺失必填：只用既有 轻提示 拦下（不渲染任何提示节点，
    // 也不猜 ID）。计数对当前列表实时求值（数未完成项）—— 用户补齐或删除物化条目后
    // 即放行，不受挂载时冻结的 unresolvedCount 牵制；编辑页完成守卫与 保存简历 同步
    // 预检仍是最终防线
    const 未完成数 = 数未完成项(经历列表, 教育列表, 证书列表);
    if (未完成数 > 0) {
      轻提示(`还有 ${未完成数} 处需要选择目录或补充必填项`);
      return;
    }
    // 工作经历可以为空（学生没实习、社招在职空窗都是常态，Global：工作经历可空）——
    // 原来这里拦社招「至少一段」，会把没有可填经历的人卡死在注册流里，且空列表本就
    // 不会创建任何空条目。改为不拦。
    // 教育必须完整：BFF 会静默跳过缺学校/专业/起止（含预计毕业）的教育条目，
    // 不拦就等于让用户带着一条根本没进服务端的教育走完注册。
    // 只在注册旅程拦（判据是旅程标记，不是「有没有草稿」—— 草稿是本页自己写出来的，
    // 拿它当判据等于自证）：日常编辑里 结束 为空是合法的「至今在读」
    // （wire 上是 end_month: null），不能顺手把在读的人锁死在这一屏。
    const 教育缺项数 = 旅程中 ? 教育列表.filter(教育段缺项).length : 0;
    if (教育缺项数 > 0) {
      轻提示('教育经历还缺学校、学历、专业或就读时间');
      return;
    }
    // 作品集链接单独存储，不在 页面简历写入 里，但同样是保存前的拦截项
    if (作品集错误) {
      轻提示(作品集错误);
      return;
    }
    // Task 1：身份为空时数据源会整体跳过 profile 分区，URL 静默丢失还 toast 成功就是假保存 ——
    // 沿 我的简历 / 个人信息 的既有「请先选择求职状态」提示收口：不发保存、不离页。
    if (是后端 && 保存链接 !== undefined
      && (建档?.资料?.基本信息?.身份 ?? 全局.基本信息.身份) === '') {
      轻提示('请先选择求职状态');
      return;
    }
    设保存中(true);
    try {
      await 操作.保存简历({
        基本信息: { ...全局.基本信息, ...建档?.资料?.基本信息 },
        个人优势: 全局.个人优势,
        技能: 技能列表,
        经历: 经历列表,
        教育: 教育列表,
        证书: 证书列表,
        // 三态：本轮没改就不带这个属性（普通 profile 编辑不该顺带覆盖服务端 URL）
        ...(保存链接 !== undefined ? { 作品集链接: 保存链接 } : {}),
      });
      // 成功后取权威回显并清意图；失败不清，输入保留供显式重试
      设链接意图(undefined);
      // 预填确认只在既有保存成功后（拒绝时分区不确认），且先于提示与跳转
      操作.确认候选Onboarding预填分区('work');
      轻提示('简历已保存');
      跳转(在校中 ? 路径.求职状态 : 路径.引导问答);
    } catch (错误) {
      轻提示(取后端错误文案(错误));
    } finally {
      设保存中(false);
    }
  };



  // ── 教育编辑视图 ──────────────────────────────────────────
  if (教育目标 !== null) {
    const 正在编辑的教育 =
      教育目标 === '新增' ? null : (教育列表.find((条) => 条.编号 === 教育目标) ?? null);
    // 刷新恢复：这一层可能是还没进列表的新条目，字段只在草稿里
    const 恢复 = 恢复编辑?.种类 === 'education' && 恢复编辑.本地编号 === 教育目标 ? 恢复编辑 : undefined;
    return (
      <教育编辑页
        初始={正在编辑的教育}
        恢复={恢复}
        变更={写编辑中}
        取消={() => {
          丢弃编辑层();
          设教育目标(null);
        }}
        完成={(段) => {
          存(
            {
              教育: 教育列表.some((条) => 条.编号 === 段.编号)
                ? 教育列表.map((条) => (条.编号 === 段.编号 ? 段 : 条))
                : [...教育列表, 段],
            },
            { 编辑中: undefined },
          );
          设恢复编辑(undefined);
          设教育目标(null);
        }}
        删除={
          正在编辑的教育 && 教育列表.length > 1
            ? () => {
                存(
                  { 教育: 教育列表.filter((条) => 条.编号 !== 正在编辑的教育.编号) },
                  { 编辑中: undefined, ...登记删除('education', 正在编辑的教育.编号) },
                );
                设恢复编辑(undefined);
                设教育目标(null);
              }
            : undefined
        }
      />
    );
  }

  // ── 编辑视图 ──────────────────────────────────────────────
  if (编辑目标 !== null) {
    const 正在编辑的段 = 编辑目标 === '新增' ? null : (经历列表.find((段) => 段.编号 === 编辑目标) ?? null);
    // 刷新恢复：这一层可能是还没进列表的新条目，字段只在草稿里
    const 恢复 = 恢复编辑?.种类 === 'experience' && 恢复编辑.本地编号 === 编辑目标 ? 恢复编辑 : undefined;
    return (
      <经历编辑页
        初始={正在编辑的段}
        恢复={恢复}
        变更={写编辑中}
        区块名={经历区块名}
        取消={() => {
          丢弃编辑层();
          设编辑目标(null);
        }}
        完成={(段) => {
          存(
            {
              经历: 经历列表.some((条) => 条.编号 === 段.编号)
                ? 经历列表.map((条) => (条.编号 === 段.编号 ? 段 : 条))
                : [...经历列表, 段],
            },
            { 编辑中: undefined },
          );
          设恢复编辑(undefined);
          设编辑目标(null);
        }}
        删除={
          正在编辑的段
            ? () => {
                存(
                  { 经历: 经历列表.filter((条) => 条.编号 !== 正在编辑的段.编号) },
                  { 编辑中: undefined, ...登记删除('experience', 正在编辑的段.编号) },
                );
                设恢复编辑(undefined);
                设编辑目标(null);
              }
            : undefined
        }
      />
    );
  }

  // ── 列表视图 ──────────────────────────────────────────────
  // 经历 / 教育两个区块抽成片段：学生分支教育置顶、经历区改叫「实习经历」，
  // 非学生保持 工作经历 → 教育经历 的现状顺序
  const 经历区 = (
    <>
      {经历列表.map((段) => (
        <button
          key={段.编号}
          className={`${样式.经历卡} 可点`}
          onClick={() => 设编辑目标(段.编号)}
        >
          <span className={样式.经历卡主体}>
            <span className={样式.经历卡头行}>
              <span className={`${样式.经历公司} 单行`}>{段.公司}</span>
              <span className={`${样式.经历时间} 等宽数字`}>
                {显示年月(段.开始)} — {显示年月(段.结束)}
              </span>
            </span>
            <span className={`${样式.经历职位} 单行`}>{段.职位}</span>
            <span className={样式.经历底行}>
              {段.行业 ? <span className={样式.经历行业}>{段.行业}</span> : null}
              {段.结束 === null && 段.隐藏 ? (
                <span className={样式.隐身徽标}>已对该公司隐身</span>
              ) : null}
            </span>
          </span>
          <span className={样式.尖括号}>›</span>
        </button>
      ))}

      <button className={`${样式.添加行} 可点`} onClick={() => 设编辑目标('新增')}>
        <span className={样式.添加加号}>＋</span>
        <span className={样式.添加文字}>添加{经历区块名}</span>
      </button>
    </>
  );

  // 教育经历：支持多段（本科+硕士），企业端简历的学校显示自这里
  const 教育区 = (
    <>
      {教育列表.map((条) => (
        <button
          key={条.编号}
          className={`${样式.经历卡} 可点`}
          onClick={() => 设教育目标(条.编号)}
        >
          <span className={样式.经历卡主体}>
            <span className={样式.经历卡头行}>
              <span className={`${样式.经历公司} 单行`}>{条.学校}</span>
              <span className={`${样式.经历时间} 等宽数字`}>
                {显示年月(条.开始)} — {显示年月(条.结束)}
              </span>
            </span>
            <span className={`${样式.经历职位} 单行`}>
              {条.学历} · {条.专业}
            </span>
          </span>
          <span className={样式.尖括号}>›</span>
        </button>
      ))}
      <button className={`${样式.添加行} 可点`} onClick={() => 设教育目标('新增')}>
        <span className={样式.添加加号}>＋</span>
        <span className={样式.添加文字}>添加教育经历</span>
      </button>
    </>
  );

  return (
    // 2026-08-24 全站选择风格统一（C1 定稿）：页底白底
    <次级页外壳 白底>
      <返回栏
        返回={返回}
        右侧={
          <button
            className={`${样式.保存} 可点`}
            onClick={保存}
            disabled={保存中}
            aria-busy={保存中 || undefined}
          >
            {保存中 ? '保存中…' : '保存'}
          </button>
        }
      />

      {/* 整屏标题不能是其中某一块的名字。原来跟着首个区块走（学生态写「教育经历」、
          非学生写「工作经历」），可这一屏装着四块：教育经历 / 实习经历（或工作经历）/
          专业技能 / 证书与语言 —— 于是学生看到的是「标题写教育经历，下面却是实习经历」
          （2026-08-22 产品负责人当场指出）。
          改用「在线简历」：四块全是简历内容，两端两态都说得通；这个词项目里已经在用
          （基本信息屏的大标题就是「创建在线简历」），不是新造的说法，也不解释什么，就是个名字。
          刻意不叫「我的简历」—— 那是 /resume 那一屏的名字，两屏重名会分不清。 */}
      <页面大标题 标题="在线简历" />

      {/* 上传条按标注 2026-08-24 删除（「前面有一个上传简历了」）——
          完善资料屏已有唯一上传入口，这里只展示与逐段编辑 */}
      <滚动区 样式覆盖={{ padding: '14px 18px 40px' }}>
        {在校中 ? (
          <>
            {教育区}
            <div className={样式.区块标}>实习经历</div>
            {经历区}
          </>
        ) : (
          <>
            {经历区}
            <div className={样式.区块标}>教育经历</div>
            {教育区}
          </>
        )}

        {/* ── 专业技能：代理做匿名初筛时按标签逐条比对岗位的技术要求，
            所以它是标签而不是一段自由文本 —— 自由文本没法逐条核对 ── */}
        <div className={样式.区块标}>专业技能</div>
        <div className={样式.技能卡}>
          {技能列表.length > 0 ? (
            <div className={样式.标签组}>
              {技能列表.map((项) => (
                <button
                  key={项}
                  className={`${样式.标签} 可点`}
                  onClick={() => 存({ 技能: 技能列表.filter((条) => 条 !== 项) })}
                  aria-label={`删除技能 ${项}`}
                >
                  {项}
                  <span className={样式.标签删}>✕</span>
                </button>
              ))}
            </div>
          ) : (
            null /* 空态提示按标注 2026-08-24 删除（「把这个小文案删掉」）*/
          )}

          <div className={样式.录入行}>
            <input
              className={样式.录入框}
              value={技能草稿}
              placeholder="如：Go、分布式事务"
              onChange={(事件) => 设技能草稿(事件.target.value)}
              onKeyDown={(事件) => {
                // isComposing：挡住中文输入法「回车上屏候选词」那一下
                if (事件.key === 'Enter' && !事件.nativeEvent.isComposing) 加技能();
              }}
              enterKeyHint="done"
            />
            <button className={`${样式.录入键} 可点`} onClick={加技能}>
              添加
            </button>
          </div>
        </div>

        {/* ── 证书与语言：软考 / CPA / 司考这类硬门槛，加上雅思 / 托福 / 日语
               这类语言证明 —— 都是岗位可能设成硬性条件的项（标注 11:56）── */}
        <div className={样式.区块标}>证书与语言</div>
        {证书列表.map((条) => (
          <div key={条.编号} className={样式.证书行}>
            <span className={样式.证书主体}>
              <span className={`${样式.证书名} 单行`}>{条.名称}</span>
              {条.年份 ? (
                <span className={`${样式.证书年} 等宽数字`}>{条.年份} 年取得</span>
              ) : null}
            </span>
            <button
              className={`${样式.行删除} 可点`}
              onClick={() => 存({ 证书: 证书列表.filter((项) => 项.编号 !== 条.编号) })}
              aria-label={`删除证书 ${条.名称}`}
            >
              ✕
            </button>
          </div>
        ))}
        <div className={样式.录入行}>
          <input
            className={样式.录入框}
            value={证书名草稿}
            placeholder="证书或语言，如 CPA、雅思 7.0"
            onChange={(事件) => 写证书名(事件.target.value)}
            onKeyDown={(事件) => {
              if (事件.key === 'Enter' && !事件.nativeEvent.isComposing) 加证书();
            }}
          />
          <button className={`${样式.录入键} 可点`} onClick={加证书}>
            添加
          </button>
        </div>

        {/* ── 作品集或项目链接（2026-08-22 从「完善资料」屏搬来）──
            产品负责人：作品集是简历内容，不是求职偏好，所以它属于这一屏。
            做成与「专业技能」「证书与语言」并列的独立区块、而不是塞进单段经历的表单里：
            一个人只有一个作品集，它是整份简历级别的；挂到某一段经历下面，
            换一段经历就得再填一次，企业端也不知道该读哪一段的那条。 */}
        <div className={样式.区块标}>作品集或项目链接</div>
        <input
          className={样式.整行输入}
          type="url"
          inputMode="url"
          value={作品集链接}
          placeholder="https://"
          aria-label="作品集或项目链接"
          aria-invalid={Boolean(作品集错误)}
          onChange={(事件) => 存作品集链接(事件.target.value)}
          // 失焦才规范化：边打字边补 https:// 会把光标顶走。
          // 规范化没改动文本就一个字也不写：只是路过（聚焦又离开）不能把回显的
          // 权威 URL 标成「用户已修改」—— 那会让保存顺带发一次 portfolio_url。
          onBlur={() => {
            const 规范 = 规范化作品集链接(作品集链接);
            if (规范 !== 作品集链接) 存作品集链接(规范);
          }}
        />
        {作品集错误 ? <div className={样式.字段错误}>{作品集错误}</div> : null}
      </滚动区>
    </次级页外壳>
  );
}

// ── 教育经历编辑页：学校（点击行 + 全屏子视图）/ 学历（快捷片）/ 专业（点击行 + 全屏子视图）
//    / 起止年月（滚轮）─────────────────────────────────────────────
// review-r1 P1-3：学校/专业曾走页内输入候选（点候选落引用、继续输入清引用）。
// Task 2（editor-catalog-fullscreen）：两字段改为点击行 + 全屏目录子视图 —— 打开时把草稿
// 当前名称复制为子页搜索初词；搜索/候选/游标/失败重试全在子视图，关闭即销毁；只有选中
// 有效候选才原子写 名称+引用 并只关闭，取消/搜索编辑/翻页都不碰父草稿（初始复制后搜索是
// 独立 state）。Backend 引用只来自所点行的稳定 ID（同名不同 ID 不串）；Mock 沿本地选择
// 控制只落文本。完成守卫保持：Backend 没有引用的旧文本不得当引用提交。
const 教育搜索防抖毫秒 = 250;
/** Mock 演示候选每页条数：只为驱动与 Backend 相同的「加载更多」可见状态 */
const 教育演示每页条数 = 8;

function 教育编辑页({
  初始,
  恢复,
  变更,
  取消,
  完成,
  删除,
}: {
  初始: 简历教育段 | null;
  /** J-PILOT-02 Task 4：刷新回来时草稿里这一层的本地编号与已填字段（可不完整）*/
  恢复?: { 本地编号: string; 字段: Omit<Partial<简历教育段>, '编号'> };
  /** 每次输入把本层写进建档草稿（Mock 不传 = 不落草稿）*/
  变更?: (编辑中: 建档编辑中草稿) => void;
  取消: () => void;
  完成: (段: 简历教育段) => void;
  删除?: () => void;
}) {
  const { 数据源模式 } = use应用状态();
  const 是后端 = 数据源模式 === 'backend';
  const [草稿, 设草稿] = useState<简历教育段>(() => {
    const 基础: 简历教育段 = 初始 ?? {
      编号: 恢复?.本地编号 ?? `edu${Date.now()}`,
      学校: '',
      学历: '本科',
      专业: '',
      开始: '2016-09',
      结束: '2020-06',
    };
    return 恢复 ? { ...基础, ...恢复.字段 } : 基础;
  });
  // 草稿每变一次就把本层写回建档草稿。用 effect 而不是在 改 里逐次回调：
  // 子视图选定这类动作会连着调两次 改，逐次回调只能看到过期的 草稿。
  const 变更引用 = useRef(变更);
  变更引用.current = 变更;
  useEffect(() => {
    const { 编号, ...字段 } = 草稿;
    变更引用.current?.({ 种类: 'education', 本地编号: 编号, 字段 });
  }, [草稿]);
  const [滚轮, 设滚轮] = useState<'开始' | '结束' | null>(null);
  // 毕业早于入学一定是滚错档：不拦住，这段教育会带着「2020.09 — 2018.06」一直存下去
  const 时间错误 = 校验起止年月(草稿.开始, 草稿.结束, '入学时间', '毕业时间');
  const 可完成 = 草稿.学校.trim() !== '' && 草稿.专业.trim() !== '' && !时间错误;

  const 改 = <K extends keyof 简历教育段>(键: K, 值: 简历教育段[K]) =>
    设草稿((旧) => ({ ...旧, [键]: 值 }));

  // ── Task 2：学校/专业 全屏目录子视图的打开状态 + A 契约父页焦点/滚动记账 ──
  const [打开目录, 设打开目录] = useState<'学校' | '专业' | null>(null);
  const 学校行引用 = useRef<HTMLButtonElement>(null);
  const 专业行引用 = useRef<HTMLButtonElement>(null);
  const 目录触发行 = useRef<HTMLButtonElement | null>(null);
  const 目录曾打开 = useRef(false);
  const 目录打开滚动 = useRef<{ 节点: HTMLElement; 顶: number }[]>([]);
  const 开目录 = (种类: '学校' | '专业') => {
    const 行 = (种类 === '学校' ? 学校行引用 : 专业行引用).current;
    // A：设打开状态前，沿触发行祖先链记录所有实际滚动节点（.滚动区）的 scrollTop
    目录触发行.current = 行 ?? null;
    目录打开滚动.current = [];
    for (let 节点 = 行?.parentElement; 节点; 节点 = 节点.parentElement) {
      if (节点.classList.contains('滚动区')) 目录打开滚动.current.push({ 节点, 顶: 节点.scrollTop });
    }
    设打开目录(种类);
  };
  // A：关闭后 wrapper 已恢复显示，先 focus({ preventScroll: true }) 回仍连接的触发行，
  // 再原样还原 scrollTop；首次挂载不恢复
  useLayoutEffect(() => {
    if (打开目录 !== null) {
      目录曾打开.current = true;
      return;
    }
    if (!目录曾打开.current) return;
    目录曾打开.current = false;
    const 触发行 = 目录触发行.current;
    if (触发行?.isConnected) 触发行.focus({ preventScroll: true });
    for (const { 节点, 顶 } of 目录打开滚动.current) 节点.scrollTop = 顶;
    目录打开滚动.current = [];
  }, [打开目录]);

  /** 选定：子视图只在选中有效候选时回调 —— 名称与引用原子落草稿，随后只关闭。
   *  Mock 沿本地选择控制不落引用（完成无引用门槛）；Backend 引用 = 子视图按稳定键构造的目录值。 */
  const 选定目录 = (种类: '学校' | '专业', 值: 目录选择值) => {
    if (种类 === '学校') {
      改('学校', 值.display_name);
      if (是后端) 改('学校引用', 值);
    } else {
      改('专业', 值.display_name);
      if (是后端) 改('专业引用', 值);
    }
    设打开目录(null);
  };

  return (
    // 2026-08-24 全站选择风格统一（C1 定稿）：页底白底
    <次级页外壳 白底>
      {/* Task 2：目录子视图打开时父表单保持挂载但 hidden + 显式 display:none 隔离 ——
          仓库没有全局 [hidden] 规则，固定 author display 会压过 UA 折叠；wrapper 接管
          外壳的满高语义（flex:1/min-height:0/纵向 flex），全屏子视图是下面的内容兄弟，
          绝不能藏进自己的 hidden 祖先。 */}
      <div
        hidden={打开目录 !== null}
        style={{ flex: 1, minHeight: 0, display: 打开目录 !== null ? 'none' : 'flex', flexDirection: 'column' }}
      >
        <返回栏
          返回={取消}
          标题="教育经历"
          右侧={
            <button
              className={`${样式.完成键} ${可完成 ? '' : 样式.完成键灰} 可点`}
              onClick={() => {
                // 原来点灰按钮什么都不发生，用户不知道卡在哪一项 —— 照经历编辑页的做法给轻提示。
                // 报错顺序也跟经历编辑页对齐：先必填、后引用、后时间，体感一致
                if (草稿.学校.trim() === '' || 草稿.专业.trim() === '') {
                  轻提示('学校、专业是必填的');
                  return;
                }
                // review-r1 P1-3：Backend 旧文本没有引用（未在子视图选中过）→ 阻止保存，
                // 自由文本不得冒充目录引用
                if (是后端 && 草稿.学校引用 === undefined) {
                  轻提示('请从候选学校中选择');
                  return;
                }
                if (是后端 && 草稿.专业引用 === undefined) {
                  轻提示('请从候选专业中选择');
                  return;
                }
                if (时间错误) {
                  轻提示(时间错误);
                  return;
                }
                完成(草稿);
              }}
            >
              完成
            </button>
          }
        />

        <滚动区 样式覆盖={{ padding: '4px 22px 40px' }}>
          {/* 学校名称：点击行打开全屏目录子视图（Task 2），不再页内输入 */}
          <button
            ref={学校行引用}
            className={`${样式.选择条目} 可点`}
            onClick={() => 开目录('学校')}
          >
            <span className={样式.条目标签}>学校名称</span>
            <span className={样式.选择条目值行}>
              <span className={`${草稿.学校 ? 样式.条目值 : 样式.条目占位} 单行`}>
                {草稿.学校 || '选择学校'}
              </span>
              <span className={样式.尖括号}>›</span>
            </span>
          </button>

          <div className={样式.编辑条目}>
            <div className={样式.条目标签}>学历</div>
            <div className={样式.行业片行}>
              {学历选项.map((项) => (
                <button
                  key={项}
                  className={`${样式.行业片} ${草稿.学历 === 项 ? 样式.行业片选中 : ''} 可点`}
                  onClick={() => 改('学历', 项)}
                >
                  {项}
                </button>
              ))}
            </div>
          </div>

          {/* 专业：与学校同一套点击行 + 全屏子视图 */}
          <button
            ref={专业行引用}
            className={`${样式.选择条目} 可点`}
            onClick={() => 开目录('专业')}
          >
            <span className={样式.条目标签}>专业</span>
            <span className={样式.选择条目值行}>
              <span className={`${草稿.专业 ? 样式.条目值 : 样式.条目占位} 单行`}>
                {草稿.专业 || '选择专业'}
              </span>
              <span className={样式.尖括号}>›</span>
            </span>
          </button>

          <div className={样式.编辑条目}>
            <div className={样式.条目标签}>在读时间</div>
            <div className={样式.时间行}>
              <button
                className={`${样式.月份键} ${时间错误 ? 样式.月份键错 : ''} 等宽数字 可点`}
                onClick={() => 设滚轮('开始')}
                aria-label="入学年月"
              >
                {草稿.开始.replace('-', '.')}
              </button>
              <span className={样式.时间连字}>—</span>
              <button
                className={`${样式.月份键} ${时间错误 ? 样式.月份键错 : ''} 等宽数字 可点`}
                onClick={() => 设滚轮('结束')}
                aria-label="毕业年月"
              >
                {草稿.结束.replace('-', '.')}
              </button>
            </div>
            {/* role=alert：两个键都是 button，button 不支持 aria-invalid，
                读屏用户靠这条即时播报的错误文案知道哪一项不对 */}
            {时间错误 ? (
              <div className={样式.字段错误} role="alert">
                {时间错误}
              </div>
            ) : null}
          </div>
        </滚动区>

        {删除 ? (
          <div style={{ padding: '0 22px 24px' }}>
            <button className={`${样式.删除键} 可点`} onClick={删除}>
              删除这段教育经历
            </button>
          </div>
        ) : null}

        {滚轮 ? (
          <年月滚轮层
            标题={滚轮 === '开始' ? '选择入学年月' : '选择毕业年月'}
            初值={滚轮 === '开始' ? 草稿.开始 : 草稿.结束}
            最小={滚轮 === '结束' ? 草稿.开始 : undefined}
            最大={滚轮 === '开始' ? 开始上界(草稿.结束) : 本月()}
            确认={(值) => {
              改(滚轮, 值);
              设滚轮(null);
            }}
            取消={() => 设滚轮(null)}
          />
        ) : null}
      </div>

      {/* Task 2：教育目录全屏子视图。开着才挂载 —— 搜索/候选/游标/失败重试随子视图
          销毁（关闭不写父草稿，重复打开按当前名称重查）；外壳按 A 契约管焦点。 */}
      {打开目录 !== null ? (
        <教育目录子视图
          字段种类={打开目录}
          当前名称={打开目录 === '学校' ? 草稿.学校 : 草稿.专业}
          当前引用={打开目录 === '学校' ? 草稿.学校引用 : 草稿.专业引用}
          选定={(值) => 选定目录(打开目录, 值)}
          关闭={() => 设打开目录(null)}
        />
      ) : null}
    </次级页外壳>
  );
}

// ── 教育目录子视图（Task 2）：学校/专业 共用的全屏选择正文（只在本文件使用）────
// 输入：字段种类、当前名称/ref 来自父层草稿，目录查询经 Context 注入，选定(目录选择值)/关闭。
// 打开时把当前名称复制为搜索初词并查询（空名称 = 空词，不发请求）；此后搜索是子视图自己的
// state。Backend 沿既有查询合同：250ms 防抖、代际守 stale、第一页版本引用、追加页换代从
// 第一页强制重开；失败如实上屏给同词重试（不伪装成空态）。Mock 用现有 高校/专业名录 本地
// 子串过滤 + 切片分页，稳定模拟键与名称分离，旧已选按名称标记。目录命中行按 ref ID 标记
//（Mock 按名称）；目录缺失的旧文本只在当前值区域可见，不伪造可选行。卸载即销毁查询。
/** Backend 目录候选的页面内行形状：稳定键 = 目录 ID；学校带「城市 · 国家」副文 */
type 教育目录候选 = { id: string; display_name: string; 副文?: string };

function 教育目录子视图({
  字段种类,
  当前名称,
  当前引用,
  选定,
  关闭,
}: {
  字段种类: '学校' | '专业';
  当前名称: string;
  当前引用: 目录选择值 | undefined;
  选定: (值: 目录选择值) => void;
  关闭: () => void;
}) {
  const { 数据源模式, 目录查询 } = use应用状态();
  const 是后端 = 数据源模式 === 'backend';
  const 是学校 = 字段种类 === '学校';
  // 打开时复制父草稿当前名称为搜索初词；此后是子视图独立 state —— 编辑搜索不写父草稿、
  // 不取消父选择
  const [词, 设词] = useState(当前名称);
  const [候选, 设候选] = useState<教育目录候选[]>([]);
  const [下一页, 设下一页] = useState<string | null>(null);
  const [加载中, 设加载中] = useState(false);
  const [查询失败, 设查询失败] = useState(false);
  const [重试序号, 设重试序号] = useState(0);
  // Mock 演示切片翻页（与 Backend 加载更多同一可见控件）
  const [演示页数, 设演示页数] = useState(1);
  const 计时 = useRef(0);
  // 代际 ref 守 stale：换词/清空/重试都递增，load-more 也检查（沿原页 review-r1 P2-2 做法）
  const 代际 = useRef(0);
  // 本查询第一页的 catalogVersion：追加页换版本时不跨版本合并，丢弃累计页从第一页重开
  //（沿原页 review-r1 F5 做法）
  const 版本引用 = useRef('');
  const 目录引用 = useRef(目录查询);
  目录引用.current = 目录查询;

  /** Backend 查询适配：两字段共用一条管道，行形状统一为 稳定 ID + 显示名（学校带副文） */
  const 查询教育页 = async (
    参数: { q: string; cursor?: string },
    选项?: { 强制刷新?: boolean },
  ): Promise<目录页<教育目录候选>> => {
    const 方法 = 目录引用.current;
    if (!方法) throw new Error('目录查询不可用');
    if (是学校) {
      const 页 = await 方法.查询Institution({ ...参数, limit: 20 }, 选项);
      return {
        items: 页.items.map((项) => ({
          id: 项.id,
          display_name: 项.display_name,
          副文: 学校副标题(项),
        })),
        nextCursor: 页.nextCursor,
        catalogVersion: 页.catalogVersion,
      };
    }
    const 页 = await 方法.查询Taxonomy('majors', { ...参数, limit: 20 }, 选项);
    return {
      items: 页.items.map((项) => ({ id: 项.id, display_name: 项.display_name })),
      nextCursor: 页.nextCursor,
      catalogVersion: 页.catalogVersion,
    };
  };

  // Backend 搜索：250ms 防抖后查询；代际守 stale；失败置 查询失败（错误不伪装成空态）
  useEffect(() => {
    if (!是后端) return;
    const trimmed = 词.trim();
    代际.current += 1;
    设候选([]);
    设下一页(null);
    // review 终审 Issue 2：换词要同步复位 加载中 —— 否则「加载更多在飞时改词」后迟到响应
    // 被代际作废、finally 守卫跳过重置，加载中 永远 true，新搜索的 加载更多 永久禁用。
    设加载中(false);
    设查询失败(false);
    // 空词：保持空态，不发请求（空名称打开的现有行为）
    if (trimmed === '') return;
    window.clearTimeout(计时.current);
    const 本次 = 代际.current;
    计时.current = window.setTimeout(async () => {
      try {
        const 页 = await 查询教育页({ q: trimmed });
        if (本次 !== 代际.current) return;
        设候选(页.items);
        设下一页(页.nextCursor);
        版本引用.current = 页.catalogVersion;
      } catch {
        if (本次 !== 代际.current) return;
        设查询失败(true);
      }
    }, 教育搜索防抖毫秒);
    return () => window.clearTimeout(计时.current);
    // 查询教育页 每渲染换标不影响语义：查询只由 词/模式/重试 驱动
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [词, 是后端, 重试序号]);

  // Backend 加载更多：当前游标请求下一页，合并去重；代际检查防 stale；追加页换版本从第一页重开
  const 加载更多 = async () => {
    if (下一页 === null || 加载中) return;
    const trimmed = 词.trim();
    const 本次 = 代际.current;
    设加载中(true);
    try {
      const 页 = await 查询教育页({ q: trimmed, cursor: 下一页 });
      if (本次 !== 代际.current) return;
      if (页.catalogVersion !== 版本引用.current) {
        const 重开 = await 查询教育页({ q: trimmed }, { 强制刷新: true });
        if (本次 !== 代际.current) return;
        设候选(重开.items);
        设下一页(重开.nextCursor);
        版本引用.current = 重开.catalogVersion;
        return;
      }
      设候选((旧) => 合并目录页(旧, 页.items));
      设下一页(页.nextCursor);
    } catch {
      if (本次 !== 代际.current) return;
      // 追加失败不动已加载页：可再点一次（沿既有加载更多口径）
    } finally {
      if (本次 === 代际.current) 设加载中(false);
    }
  };

  // ── Mock 演示候选：现有名录种子 + 局部子串搜索/切片分页 ──────────
  // 稳定模拟键 = 种子下标（与名称分离，沿原页键格式）；选中的行按名称回显（Mock 无引用）
  const 名录 = 是学校 ? 高校名录 : 专业名录;
  const 词值 = 词.trim();
  const 演示命中 = 词值 === '' ? [] : 名录.filter((名) => 名.includes(词值));
  const 演示项们: 教育候选[] = 演示命中
    .slice(0, 演示页数 * 教育演示每页条数)
    .map((名) => ({
      键: `mock_${是学校 ? 'inst' : 'major'}_${名录.indexOf(名)}`,
      名称: 名,
      选中: 名 === 当前名称,
    }));
  const 演示加载更多 = () => {
    if (演示命中.length > 演示项们.length) 设演示页数((旧) => 旧 + 1);
  };

  // 两模式统一进共用候选列表：Backend = 真实查询页（按 ref ID 标记选中），Mock = 演示切片
  const 项们: 教育候选[] = 是后端
    ? 候选.map((项) => ({
        键: 项.id,
        名称: 项.display_name,
        副文: 项.副文,
        选中: 当前引用?.id === 项.id,
      }))
    : 演示项们;
  const 还有 = 是后端 ? 下一页 !== null : 演示命中.length > 演示项们.length;

  /** 点行即选中：从本实例结果按稳定键定位（同名不同 ID 不串），引用由键与显示名构成，
   *  不按名称反查真实 ID */
  const 选定键 = (键: string) => {
    const 行 = 项们.find((项) => 项.键 === 键);
    if (行) 选定({ id: 行.键, display_name: 行.名称 });
  };

  const 改词 = (值: string) => {
    设词(值);
    设演示页数(1); // 新词重开切片（沿原页改词重置分页）
  };

  return (
    <全屏选择外壳 标题={是学校 ? '选择学校' : '选择专业'} 关闭={关闭}>
      <滚动区 样式覆盖={{ padding: '12px 22px 20px' }}>
        {/* 当前值区域：旧已选值持续可见；目录缺失的旧文本只在这里展示，不伪造可选行 */}
        <div className={样式.编辑条目}>
          <div className={样式.条目标签}>{是学校 ? '当前学校' : '当前专业'}</div>
          <div className={当前名称 ? 样式.条目值 : 样式.条目占位}>{当前名称 || '未选择'}</div>
        </div>

        <div className={样式.编辑条目}>
          <input
            className={样式.条目输入}
            value={词}
            placeholder={是学校 ? '搜索学校名称' : '搜索专业名称'}
            onChange={(事件) => 改词(事件.target.value)}
          />
        </div>

        {/* 候选走共用 教育目录候选列表（学校带「城市 · 国家」副行 + 列表尾加载更多） */}
        {项们.length > 0 || 还有 ? (
          <教育目录候选列表
            项们={项们}
            加载中={加载中}
            还有={还有}
            选定={选定键}
            加载更多={是后端 ? 加载更多 : 演示加载更多}
          />
        ) : null}

        {/* 搜索失败如实上屏，给同词重试（错误不伪装成空态） */}
        {是后端 && 查询失败 ? (
          <button
            className="可点"
            onClick={() => 设重试序号((旧) => 旧 + 1)}
            style={{ width: '100%', padding: '10px', color: 'var(--意向)' }}
          >
            加载失败，请重试
          </button>
        ) : null}
      </滚动区>
    </全屏选择外壳>
  );
}

// ── 全屏编辑页（BOSS直聘 形态：逐项表单 + 完成/删除）──────────────
function 经历编辑页({
  初始,
  恢复,
  变更,
  区块名,
  取消,
  完成,
  删除,
}: {
  初始: 简历经历段 | null;
  /** J-PILOT-02 Task 4：刷新回来时草稿里这一层的本地编号与已填字段（不含 项目）*/
  恢复?: { 本地编号: string; 字段: Omit<Partial<简历经历段>, '编号' | '项目'> };
  变更?: (编辑中: 建档编辑中草稿) => void;
  /** 学生分支叫「实习经历」，非学生叫「工作经历」，只是标题措辞，字段一致 */
  区块名: string;
  取消: () => void;
  完成: (段: 简历经历段) => void;
  删除?: () => void;
}) {
  const { 数据源模式, 操作, 后端状态 } = use应用状态();
  const 是后端 = 数据源模式 === 'backend';
  const [草稿, 设草稿] = useState<简历经历段>(() => {
    const 基础: 简历经历段 = 初始 ?? {
      编号: 恢复?.本地编号 ?? `e${Date.now()}`,
      公司: '',
      行业: '',
      职位: '',
      开始: '',
      结束: null,
      内容: '',
      // 底部两个开关的默认值：隐身默认开、实习默认关（标注 14:29）
      隐藏: true,
      实习: false,
    };
    return 恢复 ? { ...基础, ...恢复.字段 } : 基础;
  });
  // 同 教育编辑页：草稿变化后统一写回建档草稿。项目（工作业绩）不在 Global 7 的
  // 经历编辑白名单里，带上会让整条草稿被解码拒绝 —— 在飞的业绩编辑不跨刷新保留。
  // review-cx F4 裁定保持现状：业绩子表单嵌在本编辑页内、无独立编辑态，单槽 编辑中
  // 要么存 experience（丢业绩输入）要么存 project（丢经历本层在飞字段），任一分配都
  // 必然丢一边；扩白名单属冻结合同变更，已记 PM 缺口待裁定，不在本波擅自改。
  const 变更引用 = useRef(变更);
  变更引用.current = 变更;
  useEffect(() => {
    const { 编号, 项目: _不入白名单, ...字段 } = 草稿;
    变更引用.current?.({ 种类: 'experience', 本地编号: 编号, 字段 });
  }, [草稿]);
  const [行业层, 设行业层] = useState(false);
  // ── Task 3（editor-catalog-fullscreen）：行业全屏子视图的 A 契约父页焦点/滚动记账 ──
  // 打开处理器在设置打开状态前记录触发行与各祖先滚动节点（.滚动区，屏幕内唯一允许
  // 滚动的容器，多个则分别记录）的 scrollTop；关闭后由 layout effect 在 wrapper 恢复
  // 显示时先 focus({ preventScroll: true }) 回仍连接的触发行，再原样恢复 scrollTop。
  // 首次挂载不恢复（同 教育目录子视图 的记账写法）。
  const 行业行引用 = useRef<HTMLButtonElement>(null);
  const 行业曾打开 = useRef(false);
  const 行业打开滚动 = useRef<{ 节点: HTMLElement; 顶: number }[]>([]);
  const 开行业层 = () => {
    行业打开滚动.current = [];
    for (let 节点 = 行业行引用.current?.parentElement; 节点; 节点 = 节点.parentElement) {
      if (节点.classList.contains('滚动区')) 行业打开滚动.current.push({ 节点, 顶: 节点.scrollTop });
    }
    设行业层(true);
  };
  useLayoutEffect(() => {
    if (行业层) {
      行业曾打开.current = true;
      return;
    }
    if (!行业曾打开.current) return;
    行业曾打开.current = false;
    const 触发行 = 行业行引用.current;
    if (触发行?.isConnected) 触发行.focus({ preventScroll: true });
    for (const { 节点, 顶 } of 行业打开滚动.current) 节点.scrollTop = 顶;
    行业打开滚动.current = [];
  }, [行业层]);
  // 年月滚轮打开在哪一侧：null = 没开
  const [滚轮, 设滚轮] = useState<'开始' | '结束' | null>(null);
  const 至今 = 草稿.结束 === null;
  // 离职早于入职一定是滚错档。结束 = null 是「至今」，合法，校验函数会跳过它
  const 时间错误 = 校验起止年月(草稿.开始, 草稿.结束, '入职时间', '离职时间');
  const 必填齐 = 草稿.公司.trim() !== '' && 草稿.职位.trim() !== '' && 草稿.开始 !== '';
  const 可完成 = 必填齐 && !时间错误;

  const 改 = <键 extends keyof 简历经历段>(键名: 键, 值: 简历经历段[键]) =>
    设草稿((旧) => ({ ...旧, [键名]: 值 }));

  // ── 合同 C：公司选择抽屉 ─────────────────────────────────────
  // 旧公司文本只预填搜索词；真实 organization_id 只来自本实例结果（同名不同 ID 不串）。
  const [公司抽屉开, 设公司抽屉开] = useState(false);
  const 查询 = use组织查询({
    // Backend 走操作层合同 A 目录三操作；Mock 用本地 模拟企业目录，不发任何请求
    搜索: 是后端 ? 操作.搜索组织 : async (查询参数) => 模拟目录搜索(查询参数),
    创建: 是后端 ? 操作.创建组织 : async (名称) => 模拟目录添加(名称),
    作用域键: JSON.stringify([数据源模式, 后端状态?.主体?.subject_id ?? null, '工作经历']),
  });
  const 打开公司抽屉 = () => {
    // 旧公司文本（解析预填／既有快照）只作搜索词预填，不自动匹配、不创建。
    // 与上次同词也要重跑首页搜索：作废 清过词与结果，同值 设词 不会重触发 effect。
    if (查询.词 === 草稿.公司) 查询.重新查询();
    else 查询.设词(草稿.公司);
    设公司抽屉开(true);
  };
  /** 选中回填：真实 ID 与显示名一起落，关抽屉先 作废（合同 B：父页面关闭时先作废再隐藏）。 */
  const 回填公司 = (项: BFF组织搜索项) => {
    改('公司', 项.display_name);
    改('组织编号', 项.organization_id);
    查询.作废();
    设公司抽屉开(false);
  };
  const 选定公司键 = (键: string) => {
    // 选中 ID 只来自父页面：在本实例结果里定位完整项，同名不同 ID 不混淆
    const 项 = 查询.结果.find((候选) => 候选.organization_id === 键);
    if (项) 回填公司(项);
  };
  const 添加公司 = async (名称: string) => {
    const 项 = await 查询.添加(名称);
    if (项) 回填公司(项);
  };
  const 关闭公司抽屉 = () => {
    // 取消 / Escape / 遮罩：草稿不变，作废在飞请求后隐藏，旧值保持
    查询.作废();
    设公司抽屉开(false);
  };

  // ── 工作业绩（原「关键项目」，标注 14:28 改名）：挂在这一段经历里面，不做独立大分节 ──
  // 业绩脱离了公司和时间就没有可核对性（「这件事是在哪家公司、什么时候做的」），
  // 所以它必须长在经历段内部，而不是简历里另起一个平级分节。
  const 项目列表 = 草稿.项目 ?? [];
  const 写项目 = (新列表: 简历项目[]) => 改('项目', 新列表);
  const 改项目 = <键 extends keyof 简历项目>(编号: string, 键名: 键, 值: 简历项目[键]) =>
    写项目(项目列表.map((条) => (条.编号 === 编号 ? { ...条, [键名]: 值 } : 条)));

  return (
    // 2026-08-24 全站选择风格统一（C1 定稿）：页底白底
    <次级页外壳 白底>
      {/* Task 3：行业全屏子视图打开时父表单保持挂载但 hidden + 显式 display:none 隔离
          （仓库没有全局 [hidden] 规则，固定 author display 会压过 UA 折叠）；wrapper 接管
          外壳的满高语义（flex:1/min-height:0/纵向 flex），行业全屏正文是下面的内容兄弟，
          绝不能藏进自己的 hidden 祖先（同 教育目录子视图 的结构）。 */}
      <div
        hidden={行业层}
        style={{ flex: 1, minHeight: 0, display: 行业层 ? 'none' : 'flex', flexDirection: 'column' }}
      >
      <返回栏
        返回={取消}
        标题={初始 ? `编辑${区块名}` : `添加${区块名}`}
        居中标题
        右侧={
          <button
            className={`${样式.完成键} ${可完成 ? '' : 样式.完成键灰} 可点`}
            onClick={() => {
              if (!必填齐) {
                轻提示('公司、职位、入职时间是必填的');
                return;
              }
              if (时间错误) {
                轻提示(时间错误);
                return;
              }
              // 合同 C：Backend 完成必须携带真实企业 ID —— 旧公司文本只作搜索词，
              // 不自动匹配首命中／创建；缺 ID 的条目保留可见内容并提示选择。
              if (是后端 && 草稿.组织编号 === undefined) {
                轻提示('请选择公司');
                return;
              }
              // review-r2 R2-I-5：Backend 行业必须有一个可持久化的引用才能完成——
              // 旧守卫只在 行业非空但无引用 时拦截，空 行业 直接放行，保存简历 跳过该行，
              // 服务端水合后这段经历就消失了。改为要求 行业引用（隐含 行业 非空）。
              if (是后端 && 草稿.行业引用 === undefined) {
                轻提示('请从候选行业中选择');
                return;
              }
              完成(草稿);
            }}
          >
            完成
          </button>
        }
      />

      <滚动区 样式覆盖={{ padding: '6px 22px 40px' }}>
        {/* 公司名称（合同 C）：真实企业 ID 只能从 公司选择抽屉 里选 —— 旧公司文本
            是展示／搜索词，不是可提交坐标，因此这一行不再是自由输入框。 */}
        <button className={`${样式.选择条目} 可点`} onClick={打开公司抽屉}>
          <span className={样式.条目标签}>公司名称</span>
          <span className={样式.选择条目值行}>
            <span className={`${草稿.公司 ? 样式.条目值 : 样式.条目占位} 单行`}>
              {草稿.公司 || '选择公司'}
            </span>
            <span className={样式.尖括号}>›</span>
          </span>
        </button>

        {/* 所属行业：标注意见 21:43 —— 不摊一排快捷片，改成和「公司名称」同款的
            点击行；editor-catalog-fullscreen Task 3 起点开全屏行业目录挑选
            （单选选定即回填，层内无自由文本），选完回填 */}
        <button ref={行业行引用} className={`${样式.选择条目} 可点`} onClick={开行业层}>
          <span className={样式.条目标签}>所属行业</span>
          <span className={样式.选择条目值行}>
            <span className={`${草稿.行业 ? 样式.条目值 : 样式.条目占位} 单行`}>
              {草稿.行业 || '选择行业'}
            </span>
            <span className={样式.尖括号}>›</span>
          </span>
        </button>

        <div className={样式.编辑条目}>
          <div className={样式.条目标签}>职位名称</div>
          <input
            className={样式.条目输入}
            value={草稿.职位}
            placeholder="必填"
            onChange={(事件) => 改('职位', 事件.target.value)}
          />
        </div>

        {/* 在职时间：点开弹自绘年月滚轮（标注意见 2026-08-18），结束侧被「至今」接管 */}
        <div className={样式.编辑条目}>
          <div className={样式.条目标签}>在职时间</div>
          <div className={样式.时间行}>
            <button
              className={`${样式.月份键} ${草稿.开始 ? '' : 样式.月份键空} ${时间错误 ? 样式.月份键错 : ''} 等宽数字 可点`}
              onClick={() => 设滚轮('开始')}
              aria-label="入职年月"
            >
              {草稿.开始 ? 草稿.开始.replace('-', '.') : '入职年月'}
            </button>
            <span className={样式.时间连字}>—</span>
            {至今 ? (
              <span className={样式.至今占位}>至今</span>
            ) : (
              <button
                className={`${样式.月份键} ${草稿.结束 ? '' : 样式.月份键空} ${时间错误 ? 样式.月份键错 : ''} 等宽数字 可点`}
                onClick={() => 设滚轮('结束')}
                aria-label="离职年月"
              >
                {草稿.结束 ? 草稿.结束.replace('-', '.') : '离职年月'}
              </button>
            )}
            <label className={`${样式.至今开关} 可点`}>
              <input
                type="checkbox"
                checked={至今}
                onChange={(事件) => 改('结束', 事件.target.checked ? null : '')}
                className={样式.至今勾选框}
              />
              至今
            </label>
          </div>
          {时间错误 ? (
            <div className={样式.字段错误} role="alert">
              {时间错误}
            </div>
          ) : null}
        </div>

        <div className={样式.编辑条目}>
          <div className={样式.条目标签}>工作内容</div>
          {/* 标注 2026-08-20 18:14：内容要整段展开，框内滚动很难用 ——
              随文本行数自动长高（onInput 里同步 scrollHeight），不设内部滚动 */}
          <textarea
            className={样式.内容输入}
            value={草稿.内容}
            placeholder="请详细写职责、规模、结果"
            rows={1}
            ref={(节点) => {
              if (节点) {
                节点.style.height = 'auto';
                节点.style.height = `${节点.scrollHeight}px`;
              }
            }}
            onChange={(事件) => {
              事件.target.style.height = 'auto';
              事件.target.style.height = `${事件.target.scrollHeight}px`;
              改('内容', 事件.target.value);
            }}
          />
        </div>

        {/* 工作业绩：名称 / 角色 / 结果三行，多条可增删。
            只要三项里填了任意一项就跟着这段经历一起存，不设必填 —— 它是加分项，
            不该拦住用户保存经历 */}
        <div className={样式.编辑条目}>
          <div className={样式.条目标签}>
            工作业绩<span className={样式.选填注}>选填</span>
          </div>

          {项目列表.map((条, 序) => (
            <div key={条.编号} className={样式.项目卡}>
              <div className={样式.项目卡头}>
                <span className={样式.项目序}>业绩 {序 + 1}</span>
                <button
                  className={`${样式.行删除} 可点`}
                  onClick={() => 写项目(项目列表.filter((项) => 项.编号 !== 条.编号))}
                  aria-label={`删除业绩 ${序 + 1}`}
                >
                  ✕
                </button>
              </div>
              <input
                className={样式.项目输入}
                value={条.名称}
                placeholder="名称"
                onChange={(事件) => 改项目(条.编号, '名称', 事件.target.value)}
              />
              <input
                className={样式.项目输入}
                value={条.角色}
                placeholder="角色"
                onChange={(事件) => 改项目(条.编号, '角色', 事件.target.value)}
              />
              <input
                className={`${样式.项目输入} ${样式.项目末行}`}
                value={条.结果}
                placeholder="结果"
                onChange={(事件) => 改项目(条.编号, '结果', 事件.target.value)}
              />
            </div>
          ))}

          <button
            className={`${样式.添加行} ${样式.添加行紧凑} 可点`}
            onClick={() =>
              写项目([
                ...项目列表,
                { 编号: `p${Date.now()}`, 名称: '', 角色: '', 结果: '' },
              ])
            }
          >
            <span className={样式.添加加号}>＋</span>
            <span className={样式.添加文字}>添加工作业绩</span>
          </button>
        </div>

        {/* 编辑页最底部两个开关（标注 14:29）：实习标记 + 对这家公司隐身。
            新增段默认「隐藏 = 开」，编辑老段沿用该段已存的值；实习字段可缺省 */}
        <div className={样式.开关条目}>
          <span className={样式.开关标题}>本段经历是实习经历</span>
          <开关 标签="本段经历是实习经历" 开={草稿.实习 === true} 切换={() => 改('实习', !草稿.实习)} />
        </div>
        <div className={样式.开关条目}>
          <span className={样式.开关标题}>对这家公司隐藏我的信息</span>
          <开关 标签="对这家公司隐藏我的信息" 开={草稿.隐藏} 切换={() => 改('隐藏', !草稿.隐藏)} />
        </div>

        {删除 ? (
          <button className={`${样式.删除键} 可点`} onClick={删除}>
            删除这段经历
          </button>
        ) : null}
      </滚动区>

      {滚轮 ? (
        <年月滚轮层
          标题={滚轮 === '开始' ? '选择入职年月' : '选择离职年月'}
          初值={(滚轮 === '开始' ? 草稿.开始 : 草稿.结束) ?? ''}
          最小={滚轮 === '结束' ? 草稿.开始 || undefined : undefined}
          最大={滚轮 === '开始' ? 开始上界(草稿.结束) : 本月()}
          确认={(值) => {
            改(滚轮, 值);
            设滚轮(null);
          }}
          取消={() => 设滚轮(null)}
        />
      ) : null}

      {/* 合同 C：公司选择抽屉（合同 B 薄包装）；关闭已先 作废 在飞搜索/创建 */}
      {公司抽屉开 ? (
        <公司选择抽屉接线
          查询={查询}
          选中键={草稿.组织编号 ?? null}
          选定={选定公司键}
          关闭={关闭公司抽屉}
          添加={(名称) => void 添加公司(名称)}
        />
      ) : null}
      </div>

      {/* 行业全屏子视图（picker 统一 Task 1 + editor-catalog-fullscreen Task 3）：共用
          简历行业选择正文（纯展示）+ 行业目录钩子（展开/缓存/分页/重试/换代）。开着才挂载，
          是上面 hidden wrapper 的兄弟（正文不能藏进自己的 hidden 祖先）；单选选定立即写
          当前经历草稿并关闭，关闭未选择不改草稿；外壳按 A 契约管焦点/Escape。 */}
      {行业层 ? (
        <行业选择层
          草稿={草稿}
          改={改}
          关闭={() => 设行业层(false)}
        />
      ) : null}
    </次级页外壳>
  );
}

// ── 所属行业全屏子视图（picker 统一 Task 1；Task 3 起由 全屏选择外壳 承载）：
// 开着才挂载，目录机制全部来自 行业目录钩子 ──
// Backend 注入 现有 查询Taxonomy('industries') 的 DTO 适配；Mock 沿本地 行业字典 的模拟适配
//（根仅展开、细分可选，不发真实请求）。目录身份 = 模式+主体，主体变更作废旧缓存。
// 单选（上限=1）选定立即写当前经历草稿并关闭；关闭未选择时草稿不变；
// Backend 引用从稳定键取得（键 = 目录 ID，同名不同 ID 不串），不从名称重建 ID。
function 行业选择层({
  草稿,
  改,
  关闭,
}: {
  草稿: 简历经历段;
  改: <键 extends keyof 简历经历段>(键名: 键, 值: 简历经历段[键]) => void;
  关闭: () => void;
}) {
  const { 数据源模式, 目录查询, 后端状态 } = use应用状态();
  const 是后端 = 数据源模式 === 'backend';
  // 查询适配注入：getter 读最新 目录查询（不把 Context 传进展示层）
  const 取得查询方法 = useRef(() => 目录查询?.查询Taxonomy);
  取得查询方法.current = () => 目录查询?.查询Taxonomy;
  const 查询引用 = useRef<查询行业页 | null>(null);
  if (查询引用.current === null) {
    查询引用.current = 是后端 ? 创建目录行业查询(() => 取得查询方法.current()) : 创建模拟行业查询();
  }
  const 目录 = use行业目录({
    查询: 查询引用.current,
    目录身份: `${数据源模式}:${后端状态?.主体?.subject_id ?? ''}`,
  });

  // 已选回显按稳定键：Backend 勾只落 行业引用.id；Mock 沿名称草稿回显
  const 已选键 = 是后端
    ? (草稿.行业引用 ? [草稿.行业引用.id] : [])
    : (草稿.行业 === '' ? [] : 模拟行业键们(草稿.行业));

  /** 单选：立即写当前经历草稿并关闭（选定即回填，无第二条确认路径） */
  const 选择 = (项: 行业项) => {
    if (是后端) {
      改('行业', 项.名称);
      // 引用从稳定键取得（键 = 目录 ID），不从名称重建
      改('行业引用', { id: 项.键, display_name: 项.名称 } as 目录选择值);
    } else {
      const 名 = 模拟行业名(项.键);
      if (名 === undefined) return;
      // Mock 沿本地选择控制：只落文本（不落引用，完成守卫无引用门槛）
      改('行业', 名);
    }
    关闭();
  };

  return <简历行业选择正文 目录={目录} 已选键={已选键} 选择={选择} 关闭={关闭} />;
}
