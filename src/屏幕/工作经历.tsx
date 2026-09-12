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
// Task 5（core editors §5.2）：教育 学校/专业 候选行共用组件（原页内两份候选 JSX 迁出）
import { 教育目录候选列表, type 教育候选 } from '../组件/教育目录候选列表';
// Task 6（core editors §5.2）：经历 所属行业 底部选择层正文共用组件（原页内两模式两套 JSX 迁出）
import {
  简历行业选择正文,
  type 简历行业行,
  type 简历行业分段,
} from '../组件/简历行业选择正文';
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
import type { BFFTaxonomyItem, BFFInstitutionItem } from '../数据/BFF契约';
import type { 建档编辑中草稿, 建档条目种类, 建档明确删除条目, 候选引导建档草稿 } from '../数据/资料缓存';
import type { 目录选择值 } from '../数据/招聘数据源类型';
import { 学校副标题, 合并目录页 } from '../数据/目录选择';
import { 高校名录 } from '../数据/高校名录';
import { 专业名录 } from '../数据/专业名录';

/** 一段工作经历。开始/结束用 input[type=month] 的 yyyy-MM 格式；结束 null = 至今 */
/** 行业快捷片：点一下填入，省得手机上打字 */
const 常见行业 = ['互联网', '金融科技', 'AI / 大模型', '企业服务', '云计算', '电商', '游戏', '硬件'];

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

// ── 教育经历编辑页：学校 / 学历（快捷片）/ 专业 / 起止年月（滚轮）────
// review-r1 P1-3：学校/专业 输入走候选（与 毕业院校/选专业 同口径），点候选才落引用，
// 继续输入清引用，没点候选阻止保存。
// Task 5（core editors §5.2）：候选行 JSX 迁出到共用 教育目录候选列表，学校/专业在两模式
// 都调用 —— 输入框、词、候选显隐、选中引用、250ms 查询、目录版本/迟到响应守卫仍在本外层。
// Mock 用现有 高校名录/专业名录 演示种子做局部子串搜索/分页（稳定模拟键与名称分离），
// 选中只落文本（沿用本地选择控制，不落引用）；Backend 回调通过当前查询页的稳定键解析回
// 引用（同名不同 ID 不串），不在展示层查 DTO。
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
  const { 数据源模式, 目录查询 } = use应用状态();
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
  // 选候选这类动作会连着调两次 改，逐次回调只能看到过期的 草稿。
  const 变更引用 = useRef(变更);
  变更引用.current = 变更;
  useEffect(() => {
    const { 编号, ...字段 } = 草稿;
    变更引用.current?.({ 种类: 'education', 本地编号: 编号, 字段 });
  }, [草稿]);
  const [滚轮, 设滚轮] = useState<'开始' | '结束' | null>(null);
  // Backend 学校候选 + 专业候选
  const [学校候选, 设学校候选] = useState<BFFInstitutionItem[]>([]);
  const [专业候选, 设专业候选] = useState<BFFTaxonomyItem[]>([]);
  // review-r2 R2-M-1：学校/专业搜索分页游标
  const [学校下一页, 设学校下一页] = useState<string | null>(null);
  const [专业下一页, 设专业下一页] = useState<string | null>(null);
  const [学校加载中, 设学校加载中] = useState(false);
  const [专业加载中, 设专业加载中] = useState(false);
  const 学校计时 = useRef(0);
  const 专业计时 = useRef(0);
  // review-r1 P2-2 / review-r2 R2-M-2：代际 ref 守 stale response——清空也递增，load-more 也检查
  const 学校代际 = useRef(0);
  const 专业代际 = useRef(0);
  // review-r1 F5：本查询第一页的 catalogVersion —— 追加页换版本时不跨版本合并，
  // 丢弃累计页与游标从第一页静默重开（沿 城市查询钩子 的版本引用做法，留在本页局部）。
  const 学校版本引用 = useRef('');
  const 专业版本引用 = useRef('');
  const 学校方法引用 = useRef(目录查询?.查询Institution);
  学校方法引用.current = 目录查询?.查询Institution;
  const 专业方法引用 = useRef(目录查询?.查询Taxonomy);
  专业方法引用.current = 目录查询?.查询Taxonomy;
  // 毕业早于入学一定是滚错档：不拦住，这段教育会带着「2020.09 — 2018.06」一直存下去
  const 时间错误 = 校验起止年月(草稿.开始, 草稿.结束, '入学时间', '毕业时间');
  const 可完成 = 草稿.学校.trim() !== '' && 草稿.专业.trim() !== '' && !时间错误;

  const 改 = <K extends keyof 简历教育段>(键: K, 值: 简历教育段[K]) =>
    设草稿((旧) => ({ ...旧, [键]: 值 }));

  // Backend 学校搜索：250ms debounce 后 查询Institution({ q })
  useEffect(() => {
    if (!是后端) return;
    const 方法 = 学校方法引用.current;
    const trimmed = 草稿.学校.trim();
    if (!方法 || trimmed === '') {
      // review-r2 R2-M-2：清空输入时也递增代际，让在飞的慢响应成为 stale
      学校代际.current += 1;
      设学校候选([]);
      设学校下一页(null);
      return;
    }
    window.clearTimeout(学校计时.current);
    const 本次 = ++学校代际.current;
    学校计时.current = window.setTimeout(async () => {
      try {
        const 页 = await 方法({ q: trimmed, limit: 20 });
        if (本次 !== 学校代际.current) return;
        设学校候选(页.items);
        设学校下一页(页.nextCursor);
        学校版本引用.current = 页.catalogVersion;
      } catch {
        if (本次 !== 学校代际.current) return;
        设学校候选([]);
        设学校下一页(null);
      }
    }, 教育搜索防抖毫秒);
    return () => window.clearTimeout(学校计时.current);
  }, [草稿.学校, 是后端]);

  // Backend 专业搜索：250ms debounce 后 查询Taxonomy('majors', { q })
  useEffect(() => {
    if (!是后端) return;
    const 方法 = 专业方法引用.current;
    const trimmed = 草稿.专业.trim();
    if (!方法 || trimmed === '') {
      专业代际.current += 1;
      设专业候选([]);
      设专业下一页(null);
      return;
    }
    window.clearTimeout(专业计时.current);
    const 本次 = ++专业代际.current;
    专业计时.current = window.setTimeout(async () => {
      try {
        const 页 = await 方法('majors', { q: trimmed, limit: 20 });
        if (本次 !== 专业代际.current) return;
        设专业候选(页.items);
        设专业下一页(页.nextCursor);
        专业版本引用.current = 页.catalogVersion;
      } catch {
        if (本次 !== 专业代际.current) return;
        设专业候选([]);
        设专业下一页(null);
      }
    }, 教育搜索防抖毫秒);
    return () => window.clearTimeout(专业计时.current);
  }, [草稿.专业, 是后端]);

  // review-r2 R2-M-1：学校/专业搜索加载更多——用当前游标请求下一页，合并去重；代际检查防 stale。
  // review-r1 F5：追加页 catalogVersion 与本查询第一页不同 → 目录换代，不跨版本合并：
  // 丢弃累计页与游标，从本查询第一页静默重开（强制刷新让重开真打到服务端）。
  const 学校加载更多 = async () => {
    if (学校下一页 === null || 学校加载中) return;
    const 方法 = 学校方法引用.current;
    if (!方法) return;
    const 本次 = 学校代际.current;
    设学校加载中(true);
    try {
      const 页 = await 方法({ q: 草稿.学校.trim(), cursor: 学校下一页, limit: 20 });
      if (本次 !== 学校代际.current) return;
      if (页.catalogVersion !== 学校版本引用.current) {
        const 重开 = await 方法({ q: 草稿.学校.trim(), limit: 20 }, { 强制刷新: true });
        if (本次 !== 学校代际.current) return;
        设学校候选(重开.items);
        设学校下一页(重开.nextCursor);
        学校版本引用.current = 重开.catalogVersion;
        return;
      }
      设学校候选((旧) => 合并目录页(旧, 页.items));
      设学校下一页(页.nextCursor);
    } catch {
      if (本次 !== 学校代际.current) return;
    } finally {
      if (本次 === 学校代际.current) 设学校加载中(false);
    }
  };
  const 专业加载更多 = async () => {
    if (专业下一页 === null || 专业加载中) return;
    const 方法 = 专业方法引用.current;
    if (!方法) return;
    const 本次 = 专业代际.current;
    设专业加载中(true);
    try {
      const 页 = await 方法('majors', { q: 草稿.专业.trim(), cursor: 专业下一页, limit: 20 });
      if (本次 !== 专业代际.current) return;
      if (页.catalogVersion !== 专业版本引用.current) {
        const 重开 = await 方法('majors', { q: 草稿.专业.trim(), limit: 20 }, { 强制刷新: true });
        if (本次 !== 专业代际.current) return;
        设专业候选(重开.items);
        设专业下一页(重开.nextCursor);
        专业版本引用.current = 重开.catalogVersion;
        return;
      }
      设专业候选((旧) => 合并目录页(旧, 页.items));
      设专业下一页(页.nextCursor);
    } catch {
      if (本次 !== 专业代际.current) return;
    } finally {
      if (本次 === 专业代际.current) 设专业加载中(false);
    }
  };

  const 改学校 = (值: string) => {
    改('学校', 值);
    // 继续输入立即清除旧引用（只有点候选才落引用）；Mock 演示候选重开并重置分页
    if (草稿.学校引用 !== undefined) 改('学校引用', undefined);
    设学校演示收起(false);
    设学校演示页数(1);
  };
  const 改专业 = (值: string) => {
    改('专业', 值);
    if (草稿.专业引用 !== undefined) 改('专业引用', undefined);
    设专业演示收起(false);
    设专业演示页数(1);
  };
  const 选学校候选 = (项: BFFInstitutionItem) => {
    改('学校', 项.display_name);
    改('学校引用', { id: 项.id, display_name: 项.display_name } as 目录选择值);
    设学校候选([]);
  };
  const 选专业候选 = (项: BFFTaxonomyItem) => {
    改('专业', 项.display_name);
    改('专业引用', { id: 项.id, display_name: 项.display_name } as 目录选择值);
    设专业候选([]);
  };
  // Task 5：共用候选的稳定键 → 引用/文本 解析都在本外层，组件只按 键 回报点击
  const 选学校键 = (键: string) => {
    if (是后端) {
      const 项 = 学校候选.find((项) => 项.id === 键);
      if (项) 选学校候选(项);
      return;
    }
    const 项 = 学校演示项们.find((项) => 项.键 === 键);
    if (项) {
      改学校(项.名称);
      // Mock 点候选即收起（同 Backend 点候选行为）；文本已由 改学校 落草稿
      设学校演示收起(true);
    }
  };
  const 选专业键 = (键: string) => {
    if (是后端) {
      const 项 = 专业候选.find((项) => 项.id === 键);
      if (项) 选专业候选(项);
      return;
    }
    const 项 = 专业演示项们.find((项) => 项.键 === 键);
    if (项) {
      改专业(项.名称);
      设专业演示收起(true);
    }
  };

  // ── Mock 演示候选：现有学校/专业名录种子 + 局部子串搜索/分页 ──────────
  // 只为本轮共用展示驱动可见状态（收起/页数），不建跨页 Mock service、不发请求。
  // 稳定模拟键 = 种子下标（与名称分离）；选中的行沿 毕业院校 Mock 口径按当前词回显。
  const [学校演示收起, 设学校演示收起] = useState(false);
  const [学校演示页数, 设学校演示页数] = useState(1);
  const [专业演示收起, 设专业演示收起] = useState(false);
  const [专业演示页数, 设专业演示页数] = useState(1);
  const 学校词 = 草稿.学校.trim();
  const 专业词 = 草稿.专业.trim();
  const 学校演示命中 = 学校词 === '' ? [] : 高校名录.filter((名) => 名.includes(学校词));
  const 专业演示命中 = 专业词 === '' ? [] : 专业名录.filter((名) => 名.includes(专业词));
  const 学校演示项们: 教育候选[] = 是后端 || 学校演示收起
    ? []
    : 学校演示命中
        .slice(0, 学校演示页数 * 教育演示每页条数)
        .map((名) => ({ 键: `mock_inst_${高校名录.indexOf(名)}`, 名称: 名, 选中: 名 === 学校词 }));
  const 专业演示项们: 教育候选[] = 是后端 || 专业演示收起
    ? []
    : 专业演示命中
        .slice(0, 专业演示页数 * 教育演示每页条数)
        .map((名) => ({ 键: `mock_major_${专业名录.indexOf(名)}`, 名称: 名, 选中: 名 === 专业词 }));
  // 两模式统一进组件的展示状态：Backend = 真实查询页，Mock = 演示切片
  const 学校项们: 教育候选[] = 是后端
    ? 学校候选.map((项) => ({
        键: 项.id,
        名称: 项.display_name,
        副文: 学校副标题(项),
        选中: 草稿.学校引用?.id === 项.id,
      }))
    : 学校演示项们;
  const 专业项们: 教育候选[] = 是后端
    ? 专业候选.map((项) => ({
        键: 项.id,
        名称: 项.display_name,
        选中: 草稿.专业引用?.id === 项.id,
      }))
    : 专业演示项们;
  const 学校还有 = 是后端
    ? 学校下一页 !== null
    : !学校演示收起 && 学校演示命中.length > 学校演示项们.length;
  const 专业还有 = 是后端
    ? 专业下一页 !== null
    : !专业演示收起 && 专业演示命中.length > 专业演示项们.length;
  const 学校演示加载更多 = () => {
    if (学校演示命中.length > 学校演示项们.length) 设学校演示页数((旧) => 旧 + 1);
  };
  const 专业演示加载更多 = () => {
    if (专业演示命中.length > 专业演示项们.length) 设专业演示页数((旧) => 旧 + 1);
  };

  return (
    // 2026-08-24 全站选择风格统一（C1 定稿）：页底白底
    <次级页外壳 白底>
      <返回栏
        返回={取消}
        标题="教育经历"
        右侧={
          <button
            className={`${样式.完成键} ${可完成 ? '' : 样式.完成键灰} 可点`}
            onClick={() => {
              // 原来点灰按钮什么都不发生，用户不知道卡在哪一项 —— 照经历编辑页的做法给轻提示。
              // 报错顺序也跟经历编辑页对齐：先必填、后时间，两页体感一致
              if (草稿.学校.trim() === '' || 草稿.专业.trim() === '') {
                轻提示('学校、专业是必填的');
                return;
              }
              // review-r1 P1-3：Backend 没点过候选 → 阻止保存
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
        <div className={样式.编辑条目}>
          <div className={样式.条目标签}>学校名称</div>
          <input
            className={样式.条目输入}
            value={草稿.学校}
            placeholder="必填"
            onChange={(事件) => 改学校(事件.target.value)}
          />
          {/* Task 5：学校候选走共用 教育目录候选列表（学校名 + 「城市 · 国家」副行 + 列表尾加载更多）；
              显隐条件沿原稿（有候选或还有下一页才渲染） */}
          {学校项们.length > 0 || 学校还有 ? (
            <教育目录候选列表
              项们={学校项们}
              加载中={学校加载中}
              还有={学校还有}
              选定={选学校键}
              加载更多={是后端 ? 学校加载更多 : 学校演示加载更多}
            />
          ) : null}
        </div>

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

        <div className={样式.编辑条目}>
          <div className={样式.条目标签}>专业</div>
          <input
            className={样式.条目输入}
            value={草稿.专业}
            placeholder="必填"
            onChange={(事件) => 改专业(事件.target.value)}
          />
          {/* Task 5：专业候选走同一共用列表（无副行）；显隐条件沿原稿 */}
          {专业项们.length > 0 || 专业还有 ? (
            <教育目录候选列表
              项们={专业项们}
              加载中={专业加载中}
              还有={专业还有}
              选定={选专业键}
              加载更多={是后端 ? 专业加载更多 : 专业演示加载更多}
            />
          ) : null}
        </div>

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
    </次级页外壳>
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
  const { 数据源模式, 目录查询 } = use应用状态();
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
  // Backend 行业列表：弹层打开时按需 查询Taxonomy('industries')，支持一级展开取子项
  const [行业根项, 设行业根项] = useState<BFFTaxonomyItem[]>([]);
  const [行业子项表, 设行业子项表] = useState<Record<string, BFFTaxonomyItem[]>>({});
  // 非 selectable 子项展开后的孙项（>2 级 taxonomy）
  const [行业孙项表, 设行业孙项表] = useState<Record<string, BFFTaxonomyItem[]>>({});
  // review-r3 R3-I-5：分页游标 + 加载中状态（root / child / grandchild 三层各自记游标）
  const [行业根游标, 设行业根游标] = useState<string | null>(null);
  const [行业根加载中, 设行业根加载中] = useState(false);
  const [行业子项游标表, 设行业子项游标表] = useState<Record<string, string | null>>({});
  const [行业子项加载中表, 设行业子项加载中表] = useState<Record<string, boolean>>({});
  const [行业孙项游标表, 设行业孙项游标表] = useState<Record<string, string | null>>({});
  const [行业孙项加载中表, 设行业孙项加载中表] = useState<Record<string, boolean>>({});
  // review-r1 F5：根/子查询第一页的 catalogVersion —— 追加页换版本时整组重开（本页局部）
  const 行业根版本引用 = useRef('');
  const 行业子项版本表 = useRef<Record<string, string>>({});
  const 行业方法引用 = useRef(目录查询?.查询Taxonomy);
  行业方法引用.current = 目录查询?.查询Taxonomy;
  // 年月滚轮打开在哪一侧：null = 没开
  const [滚轮, 设滚轮] = useState<'开始' | '结束' | null>(null);
  const 至今 = 草稿.结束 === null;
  // 离职早于入职一定是滚错档。结束 = null 是「至今」，合法，校验函数会跳过它
  const 时间错误 = 校验起止年月(草稿.开始, 草稿.结束, '入职时间', '离职时间');
  const 必填齐 = 草稿.公司.trim() !== '' && 草稿.职位.trim() !== '' && 草稿.开始 !== '';
  const 可完成 = 必填齐 && !时间错误;

  const 改 = <键 extends keyof 简历经历段>(键名: 键, 值: 简历经历段[键]) =>
    设草稿((旧) => ({ ...旧, [键名]: 值 }));

  // Backend：弹层打开时加载行业 roots；点根项再按 parentId 取子项
  // review-r3 R3-I-5：保留 nextCursor 以支持分页加载更多
  useEffect(() => {
    if (!是后端 || !行业层) return;
    const 方法 = 行业方法引用.current;
    if (!方法) return;
    void (async () => {
      try {
        const 页 = await 方法('industries', { limit: 50 });
        设行业根项(页.items);
        设行业根游标(页.nextCursor);
        行业根版本引用.current = 页.catalogVersion;
      } catch {
        设行业根项([]);
        设行业根游标(null);
      }
    })();
  }, [是后端, 行业层]);

  // review-r3 R3-I-5：root 加载更多
  // review-r1 F5：追加页换版本 → 根列表整组从第一页静默重开，不跨版本合并。
  const 行业根加载更多 = async () => {
    if (行业根游标 === null || 行业根加载中) return;
    const 方法 = 行业方法引用.current;
    if (!方法) return;
    设行业根加载中(true);
    try {
      const 页 = await 方法('industries', { cursor: 行业根游标, limit: 50 });
      if (页.catalogVersion !== 行业根版本引用.current) {
        const 重开 = await 方法('industries', { limit: 50 }, { 强制刷新: true });
        设行业根项(重开.items);
        设行业根游标(重开.nextCursor);
        行业根版本引用.current = 重开.catalogVersion;
        return;
      }
      设行业根项((旧) => 合并目录页(旧, 页.items));
      设行业根游标(页.nextCursor);
    } catch {
      // 失败不动，用户可再点
    } finally {
      设行业根加载中(false);
    }
  };

  // review-r1 F4：展开失败不写「已展开」记录（否则入口守卫挡住重试），经既有轻提示说明
  const 展开行业根 = async (项: BFFTaxonomyItem) => {
    if (行业子项表[项.id]) return;
    const 方法 = 行业方法引用.current;
    if (!方法) return;
    try {
      const 子页 = await 方法('industries', { parentId: 项.id, limit: 50 });
      设行业子项表((旧) => ({ ...旧, [项.id]: 子页.items }));
      设行业子项游标表((旧) => ({ ...旧, [项.id]: 子页.nextCursor }));
      行业子项版本表.current[项.id] = 子页.catalogVersion;
    } catch (错误) {
      轻提示(取后端错误文案(错误));
    }
  };

  // review-r3 R3-I-5：child 加载更多（按 parentId 记游标）
  // review-r1 F5：追加页换版本 → 该父项的子列表整组从第一页静默重开。
  const 行业子项加载更多 = async (根id: string) => {
    const 游标 = 行业子项游标表[根id];
    if (游标 === null || 行业子项加载中表[根id]) return;
    const 方法 = 行业方法引用.current;
    if (!方法) return;
    设行业子项加载中表((旧) => ({ ...旧, [根id]: true }));
    try {
      const 页 = await 方法('industries', { parentId: 根id, cursor: 游标, limit: 50 });
      if (页.catalogVersion !== 行业子项版本表.current[根id]) {
        const 重开 = await 方法('industries', { parentId: 根id, limit: 50 }, { 强制刷新: true });
        设行业子项表((旧) => ({ ...旧, [根id]: 重开.items }));
        设行业子项游标表((旧) => ({ ...旧, [根id]: 重开.nextCursor }));
        行业子项版本表.current[根id] = 重开.catalogVersion;
        return;
      }
      设行业子项表((旧) => ({ ...旧, [根id]: 合并目录页(旧[根id] ?? [], 页.items) }));
      设行业子项游标表((旧) => ({ ...旧, [根id]: 页.nextCursor }));
    } catch {
      // 失败不动
    } finally {
      设行业子项加载中表((旧) => ({ ...旧, [根id]: false }));
    }
  };

  // 非 selectable 子项：按 parentId 取孙项（>2 级 taxonomy），展开为嵌套列表
  // review-r1 F4：展开失败不写空孙表（否则入口守卫挡住重试），经既有轻提示说明
  const 展开行业子 = async (项: BFFTaxonomyItem) => {
    if (行业孙项表[项.id]) return;
    const 方法 = 行业方法引用.current;
    if (!方法) return;
    try {
      const 孙页 = await 方法('industries', { parentId: 项.id, limit: 50 });
      设行业孙项表((旧) => ({ ...旧, [项.id]: 孙页.items }));
      设行业孙项游标表((旧) => ({ ...旧, [项.id]: 孙页.nextCursor }));
    } catch (错误) {
      轻提示(取后端错误文案(错误));
    }
  };

  // review-r3 R3-I-5：grandchild 加载更多（按 parentId 记游标）
  const 行业孙项加载更多 = async (子id: string) => {
    const 游标 = 行业孙项游标表[子id];
    if (游标 === null || 行业孙项加载中表[子id]) return;
    const 方法 = 行业方法引用.current;
    if (!方法) return;
    设行业孙项加载中表((旧) => ({ ...旧, [子id]: true }));
    try {
      const 页 = await 方法('industries', { parentId: 子id, cursor: 游标, limit: 50 });
      设行业孙项表((旧) => ({ ...旧, [子id]: 合并目录页(旧[子id] ?? [], 页.items) }));
      设行业孙项游标表((旧) => ({ ...旧, [子id]: 页.nextCursor }));
    } catch {
      // 失败不动
    } finally {
      设行业孙项加载中表((旧) => ({ ...旧, [子id]: false }));
    }
  };

  // ── 工作业绩（原「关键项目」，标注 14:28 改名）：挂在这一段经历里面，不做独立大分节 ──
  // 业绩脱离了公司和时间就没有可核对性（「这件事是在哪家公司、什么时候做的」），
  // 所以它必须长在经历段内部，而不是简历里另起一个平级分节。
  const 项目列表 = 草稿.项目 ?? [];
  const 写项目 = (新列表: 简历项目[]) => 改('项目', 新列表);
  const 改项目 = <键 extends keyof 简历项目>(编号: string, 键名: 键, 值: 简历项目[键]) =>
    写项目(项目列表.map((条) => (条.编号 === 编号 ? { ...条, [键名]: 值 } : 条)));

  // ── Task 6（core editors §5.2）：行业层正文迁出共用 简历行业选择正文 ──
  // 页面把现有根/子/孙三层展开状态按当前渲染顺序映射为分段：每段是既有列表（根列表 /
  // 某展开根的子列表 / 某展开子的孙列表）及其分页尾的展示批次，不是新树存储；各列表
  // 独立的 busy/还有/加载更多 原样进入所属分段（展开的子列表把外层行打断时沿渲染顺序
  // 切片，只有带分页尾的最后一段携带 还有/加载中/加载更多）。选中回显按稳定 ID
  //（行业引用.id 比对，同名条目不相互覆盖）；可展开按 has_children 原样读取，
  // 可选按 selectable 原样读取。组件按 键 回报点击，本外层解析回目录项 —— 同名不同
  // ID 不串，不按显示名反查。单选关闭/回填时机、查询版本与错误轻提示都在原位置不动。
  const 行业行们 = (项们: BFFTaxonomyItem[], 层级: 简历行业行['层级']): 简历行业行[] =>
    项们.map((项) => ({
      键: 项.id,
      名称: 项.display_name,
      层级,
      选中: 草稿.行业引用?.id === 项.id,
      可选: 项.selectable,
      // 父项用于展开不当叶子提交：非 selectable 且按契约有子项才可展开；
      // 孙层（第 3 层）再往下已超出现有三层控件承载（见报告 PM 缺口），不展开也不提交
      可展开: !项.selectable && 项.has_children === true && 层级 < 2,
      展开中: false,
    }));
  const 行业分段们: 简历行业分段[] = (() => {
    if (!是后端) {
      // Mock：现有 常见行业 本地目录作模拟目录，同一正文；稳定模拟键与名称分离
      return [
        {
          键: '行业-常见',
          行们: 常见行业.map((名称, 序) => ({
            键: `mock_ind_${序}`,
            名称,
            层级: 0 as const,
            选中: 草稿.行业 === 名称,
            可选: true,
            可展开: false,
            展开中: false,
          })),
          加载中: false,
          还有: false,
          加载更多: () => {},
        },
      ];
    }
    const 分段们: 简历行业分段[] = [];
    let 根行们: 简历行业行[] = [];
    const 落根段 = (带尾: boolean) => {
      if (根行们.length === 0 && !带尾) return;
      分段们.push({
        键: `行业根-${分段们.length}`,
        行们: 根行们,
        加载中: 带尾 && 行业根加载中,
        还有: 带尾 && 行业根游标 !== null,
        加载更多: 行业根加载更多,
      });
      根行们 = [];
    };
    for (const 根 of 行业根项) {
      根行们.push(...行业行们([根], 0));
      const 子项 = 行业子项表[根.id];
      if (子项 === undefined) continue;
      落根段(false);
      let 子行们: 简历行业行[] = [];
      const 落子段 = (带尾: boolean) => {
        if (子行们.length === 0 && !带尾) return;
        分段们.push({
          键: `行业子-${根.id}-${分段们.length}`,
          行们: 子行们,
          加载中: 带尾 && (行业子项加载中表[根.id] ?? false),
          还有: 带尾 && 行业子项游标表[根.id] !== null,
          加载更多: () => void 行业子项加载更多(根.id),
        });
        子行们 = [];
      };
      for (const 子 of 子项) {
        子行们.push(...行业行们([子], 1));
        const 孙项 = 行业孙项表[子.id];
        if (孙项 === undefined) continue;
        落子段(false);
        分段们.push({
          键: `行业孙-${子.id}`,
          行们: 行业行们(孙项, 2),
          加载中: 行业孙项加载中表[子.id] ?? false,
          // 原稿孙尾只在列表非空且有游标时渲染，照原样
          还有: 孙项.length > 0 && 行业孙项游标表[子.id] !== null,
          加载更多: () => void 行业孙项加载更多(子.id),
        });
      }
      落子段(行业子项游标表[根.id] !== null);
    }
    落根段(行业根游标 !== null);
    return 分段们;
  })();
  // 组件点击回调按稳定键解析回目录项（根/子/孙三层当前已载列表），同名不同 ID 不串
  const 选定行业键 = (键: string) => {
    if (!是后端) {
      const 行 = 行业分段们[0]?.行们.find((行) => 行.键 === 键);
      if (行 === undefined) return;
      // Mock 沿用本地选择控制：只落文本（不落引用，完成守卫无引用门槛）
      改('行业', 行.名称);
      设行业层(false);
      return;
    }
    const 项 =
      行业根项.find((条) => 条.id === 键)
      ?? Object.values(行业子项表).flat().find((条) => 条.id === 键)
      ?? Object.values(行业孙项表).flat().find((条) => 条.id === 键);
    if (项 === undefined || !项.selectable) return;
    改('行业', 项.display_name);
    改('行业引用', { id: 项.id, display_name: 项.display_name } as 目录选择值);
    设行业层(false);
  };
  const 展开行业键 = (键: string) => {
    const 根 = 行业根项.find((条) => 条.id === 键);
    if (根 !== undefined) {
      void 展开行业根(根);
      return;
    }
    const 子 = Object.values(行业子项表).flat().find((条) => 条.id === 键);
    if (子 !== undefined) void 展开行业子(子);
  };

  return (
    // 2026-08-24 全站选择风格统一（C1 定稿）：页底白底
    <次级页外壳 白底>
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
        <div className={样式.编辑条目}>
          <div className={样式.条目标签}>公司名称</div>
          <input
            className={样式.条目输入}
            value={草稿.公司}
            placeholder="必填"
            onChange={(事件) => 改('公司', 事件.target.value)}
          />
        </div>

        {/* 所属行业：标注意见 21:43 —— 不摊一排快捷片，改成和「公司名称」同款的
            点击行，点开从底部选择层里挑（也可在层里手输），选完回填 */}
        <button className={`${样式.选择条目} 可点`} onClick={() => 设行业层(true)}>
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

      {/* 行业选择层：常见行业一行一条，底部留手输入口 */}
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

      {/* 行业选择层：Task 6 迁出共用 简历行业选择正文（分段 = 既有列表及其分页尾的展示批次）。
          review-r3 R3-Minor-2 保留：Backend 不提供自由文本（完成守卫要求 行业引用），
          自填经可选 自填 仅 Mock 传入；Backend 必须从目录叶子里选。 */}
      {行业层 ? (
        <简历行业选择正文
          分段们={行业分段们}
          展开={展开行业键}
          选定={选定行业键}
          关闭={() => 设行业层(false)}
          自填={
            是后端
              ? undefined
              : { 值: 草稿.行业, 修改: (值: string) => 改('行业', 值), 确认: () => 设行业层(false) }
          }
        />
      ) : null}
    </次级页外壳>
  );
}
