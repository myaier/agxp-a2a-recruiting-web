// A3a–A3g 引导问答（向导）—— 移植 RN 版 应用/屏幕/引导问答.js，像素值一比一。
//
// 一页一题（进度条按标注 2026-08-20 13:00 删除，onboarding 一律不带进度条），题目全序：
// 期望职位 → 工作城市 → 期望薪资 → 硬性排除 → 个人优势（五题）。
// 到岗节奏题已挪去 /onboard/status 求职状态屏（2026-08-20 按 BOSS 截图顺序重排）。
// 返回键：第一题退出本屏（回上一屏），其余题回上一题。
//
// 本屏在社招合同里出现两次（薪资段 / 偏好段），靠地址上的 ?stage= 区分自己是哪一次，
// 每一段问哪几题、答完去哪，全部由 流程/onboarding配置 的 向导题序 / 向导出口 决定。
//
// 「答案只存在内存里」这条旧口径已经不成立：期望职位 / 工作城市 / 期望薪资 / 个人优势
// 都在离开该题时落全局（2026-08-21 修数据静默丢失），只有草稿态的输入还留在 useState。
//
// 薪资那一题 RN 里靠 snapToInterval 做原生吸附，Web 上改用
// scroll-snap-type: y mandatory + scroll-snap-align: center —— 吸附交给浏览器，
// 只需在滚动停下后算一次落点，比 RN 版更省代码且手感一致。

import { useEffect, useMemo, useRef, useState, type UIEvent } from 'react';
import { useLocation } from 'react-router-dom';
import 样式 from './引导问答.module.css';
import { 主按钮, 单选点, 开关, 次级页外壳, 滚动区, 页面大标题, 返回栏 } from '../组件/通用';
import { 放大镜图标 } from '../组件/图标';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 轻提示 } from '../组件/轻提示';
import { 取后端错误文案 } from '../数据/HTTP客户端';
import { 个人优势文本 } from '../数据/模拟数据';
import { 城市字典, 热门城市, 行业字典 } from '../数据/城市与行业';
import { use城市搜索, use城市默认页, 按行政区分组 } from './城市查询钩子';
import { use可访问滚轮 } from '../组件/可访问滚轮';
import type { BFFTaxonomyItem, BFFLocationItem } from '../数据/BFF契约';
import type { 目录查询选项 } from '../数据/招聘数据源/目录';
import type { 屏蔽项 } from '../数据/类型';
import { 合并目录页 } from '../数据/目录选择';
import {
  并入建档草稿,
  判断求职薪资单位,
  向导出口,
  向导段参数名,
  向导题序,
  规范化作品集链接,
  校验作品集链接,
  默认求职初筛偏好,
  空求职初筛偏好,
  读向导段,
  type 向导题名,
  type 求职薪资单位,
} from '../流程/onboarding配置';
import { 取个人优势预填, 取可恢复个人优势建议 } from '../流程/候选Onboarding简历预填';
import { 创建空候选预填状态 } from '../状态/后端/类型';

export default function 引导问答() {
  const { 跳转, 返回 } = use导航();
  const { 状态: 全局, 派发, 操作, 数据源模式, 目录查询, 后端状态 } = use应用状态();
  const 是后端 = 数据源模式 === 'backend';
  const 位置 = useLocation();
  const 查询 = new URLSearchParams(位置.search);
  const 段 = 读向导段(查询.get(向导段参数名));
  // J-PILOT-02 Task 4 同款纪律：只有注册旅程（引导预填 非 null，由 学生分流 的
  // 启程引导 在进旅程前派发）才碰建档草稿 —— 本屏在日常编辑语境也可达，不能回归。
  const 旅程中 = 是后端 && 全局.引导预填 !== null;
  const 建档 = 旅程中 ? 全局.引导预填?.建档 : undefined;
  const 当前薪资单位 = 判断求职薪资单位(全局.引导预填?.筛选偏好);
  const 已存薪资单位 = 全局.引导预填?.薪资?.单位 ?? '月薪K';
  const 薪资已答 = Boolean(全局.引导预填?.薪资 && 已存薪资单位 === 当前薪资单位);

  // 题序在挂载时算一次就冻结。原来是每次 render 现 filter：而 filter 读的
  // 引导预填 / 薪资已答 恰恰会被「答题」这个动作本身改写 —— 用户答完薪资，
  // 题目集合当场从 5 题塌到 2 题，而游标还停在原处，于是取到 undefined、整屏空白。
  // 冻结之后「这一段问哪几题」在进屏时就定死，答题只推游标、不动集合。
  const [题序] = useState<向导题名[]>(() =>
    向导题序({
      段,
      已有引导预填: Boolean(全局.引导预填),
      在校: 全局.基本信息.身份 === '在校',
    })
  );
  // 游标存**题名**而不是下标：下标只有配上「题序永不变」才成立，而题序本来就是派生的；
  // 存题名则游标本身就是一道题，「取到 undefined」这种状态在类型上就不存在。
  // J-PILOT-02 Task 9（Spec §6「恢复…题目」）：挂载游标从草稿 位置.题序 恢复 ——
  // 缺席或越界（跨段旧下标 / 损坏值）回 题序[0]，同样绝不取 undefined。
  const [当前题, 设当前题] = useState<向导题名>(() => {
    const 恢复序 = 建档?.位置?.题序;
    return 恢复序 !== undefined && 恢复序 >= 0 && 恢复序 < 题序.length ? 题序[恢复序] : 题序[0];
  });
  const 当前序 = 题序.indexOf(当前题);
  /** 游标推进/回退时把题目下标落进草稿 位置（Task 9：刷新后恢复到中断的那道题）。
   *  写入走既有 并入建档草稿 通道：其它草稿字段与在飞 待写入 槽原样保留。
   *  硬性排除 例外：它的答案与下标在 下一题 里同一次写完（分两次写会拿过期的
   *  建档 互相覆盖，与 工作经历 存() 同一纪律），这里不再单独写；从 硬性排除
   *  退回上一题也不改写下标 —— 刷新仍回到离开前的那道题。 */
  const 记题序 = (序: number) => {
    if (!旅程中 || 当前题 === '硬性排除') return;
    操作.更新候选建档草稿(并入建档草稿(建档, {
      位置: { pathname: 位置.pathname, search: 位置.search, 题序: 序 },
    }));
  };

  // ── 各题的答案（前两题被跳过时，初值直接取引导预填；城市已是多选数组）──
  // Task 6：Backend 模式不得把硬编码默认当成已选答案 —— 未从 引导预填 refs 得到时初始为空。
  // Mock 模式保留原硬编码默认（产品种子数据，E2E 覆盖依赖它）。
  const [已选职位, 设已选职位] = useState<string[]>(
    全局.引导预填?.职位 ?? (是后端 ? [] : ['后端开发', '交易 / 支付系统', '金融科技（行业）'])
  );
  const [已选城市, 设已选城市] = useState<string[]>(
    全局.引导预填?.城市们 ?? (是后端 ? [] : ['上海'])
  );
  // Backend 选中候选的目录引用（与已选字符串同源，落盘时原子写入 引导预填）
  const [已选职位引用, 设已选职位引用] = useState<BFFTaxonomyItem[]>(
    是后端 ? (全局.引导预填?.职位引用们 ?? []).map((条) => ({ id: 条.id, display_name: 条.display_name, parent_id: null, selectable: true, has_children: false })) : []
  );
  const [已选城市引用, 设已选城市引用] = useState<BFFLocationItem[]>(
    是后端 ? (全局.引导预填?.城市引用们 ?? []).map((条) => ({ id: 条.id, display_name: 条.display_name, country_code: '', country_name: '', admin1_code: '', admin1_name: '', timezone: '', population: 0 })) : []
  );
  // 没答过薪资时两轮都落在「面议」（档值 0，档表第一档，所以轮子停在最上面），
  // 右轮按既有规则换成空位，等用户自己往下滚去调 —— 标注 2026-08-22：
  // 「用户打开这个页面初始是从面议，然后用户自己再去做调整」。
  // 答过的（薪资已答）仍然回显用户存的值，不一并改成面议。
  const [薪资下限, 设薪资下限] = useState(薪资已答 ? (全局.引导预填?.薪资?.下限 ?? 0) : 0);
  const [薪资上限, 设薪资上限] = useState(薪资已答 ? (全局.引导预填?.薪资?.上限 ?? 0) : 0);
  // 默认一个都不选（标注 2026-08-22：「这些默认是不点的，用户有需求可以自己点」）。
  // 替用户预设两条红线，等于替他做了一个他从没做过的决定，而且他多半不会注意到自己「设过」。
  //
  // J-PILOT-02 Task 7：这一题的答案不写硬排除 —— 四张固定卡换算成固定诉求文案、
  // 用户自定义原文逐字另存，两者一起进首次意向的 private_preferences（Spec §5.1）。
  // 因此两个载体分开存：排除项 只放四张卡的原标签，自定义诉求 放用户自己的话。
  const [排除项, 设排除项] = useState<string[]>(() => 建档?.排除项 ?? []);
  const [自定义诉求, 设自定义诉求] = useState<string[]>(() => 建档?.自定义诉求 ?? []);
  // 原 Mock 网格里两者显示在一起（不改布局）：分流看的是「这一下点/写的是什么」，
  // 不是「这段文字长得像不像卡片」—— 行内输入写出来的一律是用户原话（见 提交自定义诉求）。
  const 排除已选 = [...排除项, ...自定义诉求];
  /** 网格点击：当前在哪个载体里就从哪个载体里去掉；两边都没有说明点的是未选中的固定卡。
   *  先看 自定义诉求：与卡片同名的用户原话（含草稿恢复的）必须点得掉，
   *  绝不能反过来往 排除项 里塞一张卡，多出一条删不掉的「不接受…」。 */
  const 切换排除 = (项: string) => {
    if (自定义诉求.includes(项)) 设自定义诉求((旧) => 旧.filter((条) => 条 !== 项));
    else if (排除项.includes(项)) 设排除项((旧) => 旧.filter((条) => 条 !== 项));
    else 设排除项((旧) => [...旧, 项]);
  };
  /** 行内输入提交：用户自己写的话逐字进 自定义诉求，与卡片同名也不改写（Spec §5.1）。 */
  const 提交自定义诉求 = (词: string) => 设自定义诉求((旧) => [...旧, 词]);
  // 候选 onboarding 预填（Spec §8 /wizard）：draft.summary 只在偏好段的个人优势题作初值
  // （社招首次薪资段不应用）；当前已有个人优势或轮不可建议时原样取 全局.个人优势
  const 预填状态 = 后端状态?.候选预填状态 ?? 创建空候选预填状态();
  const [自我介绍, 设自我介绍] = useState(() => 取个人优势预填(预填状态, 段, 全局.个人优势));
  // 作品集链接 2026-08-22 从求职偏好迁进简历切片（它是简历内容，不是求职偏好）。
  // 唯一的实际输入行在 工作经历 屏（GitHub/URL 行 2026-08-24 已从本屏移除，不恢复）；
  // 本屏只剩末题的校验/规范化控制，Task 7 起它读的是同一份草稿值与修改状态：
  // 属性缺省 = 用户没改（回显权威），存在（含 null）= 用户已改。
  const 链接已改 = 建档?.资料 !== undefined && '作品集链接' in 建档.资料;
  const 作品集链接 = 链接已改 ? (建档!.资料!.作品集链接 ?? '') : 全局.简历作品集链接;
  const 存作品集链接 = (值: string) => {
    派发({ 型: '存作品集链接', 链接: 值 });
    if (旅程中) 操作.更新候选建档草稿(并入建档草稿(建档, { 资料: { 作品集链接: 值 === '' ? null : 值 } }));
  };
  const 作品集错误 = 校验作品集链接(作品集链接);
  // S：个人优势「恢复」的来源按模式分流 —— Backend 只认当前轮 ready/eligible/未确认的
  // 真实 summary 建议（null 时不渲染恢复按钮）；Mock 保留原型种子文本恢复。
  const 可恢复真实建议 = 取可恢复个人优势建议(预填状态, 段);
  const 恢复文本 = 是后端 ? 可恢复真实建议 : 个人优势文本;

  // Task 5：Backend 的职位/城市字符串答案一律由选中的目录引用派生 ——
  // 原来靠按名字 toggle 同步，两条同名目录项会把彼此的字符串抵消掉。
  const 已选职位名们 = 是后端 ? 已选职位引用.map((条) => 条.display_name) : 已选职位;
  const 已选城市名们 = 是后端 ? 已选城市引用.map((条) => 条.display_name) : 已选城市;

  /** 多选题共用的「有则去掉、无则加上」 */
  const 造切换 = (设值: (更新: (旧: string[]) => string[]) => void) => (项: string) =>
    设值((旧) => (旧.includes(项) ? 旧.filter((条) => 条 !== 项) : [...旧, 项]));

  // 落盘统一挂在「离开这一题」上，而不是「第一次答这一题」——
  // 原来薪资只在 !薪资已答 时派发，用户退回来改完再走，改动会被静默丢掉；
  // 期望职位 / 工作城市 则干脆从不派发，被 reducer 的兜底默认值顶掉（选了 3 个职位，存进去是空数组）。
  const 落盘当前题 = () => {
    if (当前题 === '期望职位' || 当前题 === '工作城市') {
      // Task 6：Backend 分支把选中候选的 refs 原子写入 引导预填；Mock 分支仍占位空数组。
      const 城市引用们 = 是后端
        ? 已选城市引用.map((条) => ({ id: 条.id, display_name: 条.display_name }))
        : [];
      const 职位引用们 = 是后端
        ? 已选职位引用.map((条) => ({ id: 条.id, display_name: 条.display_name }))
        : [];
      派发({ 型: '存引导预填', 城市们: 已选城市名们, 职位: 已选职位名们, 城市引用们, 职位引用们 });
    }
    if (当前题 === '期望薪资') {
      // Task 5B：草稿动作自带基底 —— 向导传本地城市/职位与目录引用，reducer 不再兜底默认
      派发({
        型: '存薪资预填',
        下限: 薪资下限,
        上限: 薪资上限,
        单位: 当前薪资单位,
        城市们: 已选城市名们,
        职位: 已选职位名们,
        城市引用们: 已选城市引用.map((条) => ({ id: 条.id, display_name: 条.display_name })),
        职位引用们: 已选职位引用.map((条) => ({ id: 条.id, display_name: 条.display_name })),
      });
    }
    // Task 7 的 硬性排除 载体落草稿挪进 下一题：它的答案要与 Task 9 的题目下标
    // 同一次 更新候选建档草稿 写完（见 下一题），这里不再各自写一遍。
    // 个人优势 的落盘移到 下一题 里异步处理（操作.保存个人优势 + 操作.保存首次意向）
  };

  const 下一题 = async () => {
    // 最后一题（个人优势）：作品集链接仍本地派发，个人优势 + 首次意向 走真实写入
    if (当前题 === '个人优势') {
      // 只在规范化真的改变了值时回写（与 工作经历 屏的失焦规范化同一守卫）：
      // 本屏没有 URL 输入行，无条件回写会把「用户没改过」变成「改过」——
      // 简历未水合时权威值是空串，那一下就会往草稿里盖 null，完成时清掉服务端已有 URL。
      const 规范 = 规范化作品集链接(作品集链接);
      if (规范 !== 作品集链接) 存作品集链接(规范);
      try {
        await 操作.保存个人优势(自我介绍);
        // 候选 onboarding 预填（Spec §8）：summary 确认紧跟 保存个人优势 成功 ——
        // 与随后的首次意向请求成败无关，不把已写入的 summary 伪装成未保存
        操作.确认候选Onboarding预填分区('summary');
        // Task 6：Backend 分支带上选中候选的 refs，映射层直接用引用.id，不再反查目录。
        const 职位引用 = 是后端 && 已选职位引用.length > 0
          ? { id: 已选职位引用[0].id, display_name: 已选职位引用[0].display_name }
          : undefined;
        const 城市引用们 = 是后端
          ? 已选城市引用.map((条) => ({ id: 条.id, display_name: 条.display_name }))
          : undefined;
        await 操作.保存首次意向({
          职位们: 已选职位名们,
          城市们: 已选城市名们,
          薪资: { 下限: 薪资下限, 上限: 薪资上限, 单位: 当前薪资单位 },
          // Task 5B：默认偏好只进 Mock 演示；Backend 缺席的偏好就是空的，
          // 不在首次意向里虚构用户从未选过的类型/办公方式
          筛选偏好: 全局.引导预填?.筛选偏好
            ?? (是后端 ? 空求职初筛偏好() : 默认求职初筛偏好(全局.基本信息.身份 === '在校')),
          // 固定卡与用户原文各自进各自的载体：映射层按卡片顺序拼固定文案、
          // 用户原文逐字附在其后，一起进 private_preferences，不写硬排除（Spec §5.1）
          排除项,
          自定义诉求,
          职位引用,
          城市引用们,
        });
        跳转(向导出口(段));
      } catch (错误) {
        轻提示(取后端错误文案(错误));
      }
      return;
    }
    // Task 7 + Task 9：硬性排除 的两个载体随离开该题落进建档草稿（刷新/返回不丢
    // 用户答案），并与题目下标同一次 更新候选建档草稿 写完 —— 分两次写会拿过期的
    // 建档 互相覆盖（与 工作经历 存() 同一纪律）；其余题的落盘只派发 引导预填
    // 根动作，不碰建档草稿。
    if (当前题 === '硬性排除' && 旅程中) {
      操作.更新候选建档草稿(并入建档草稿(建档, {
        排除项,
        自定义诉求,
        位置: { pathname: 位置.pathname, search: 位置.search, 题序: 当前序 + 1 },
      }));
    } else {
      落盘当前题();
    }
    // 题序已冻结，推进必须显式写出来。原来学生答完薪资不改游标，靠「题序自己收缩、
    // 索引自然落到下一题」这个巧合对齐 —— 游标语义于是和用户看到的题对不上，
    // 用户在第 2 题按返回，代码却以为在第 1 题，直接把人退出了整个向导。
    if (当前序 < 题序.length - 1) {
      设当前题(题序[当前序 + 1]);
      记题序(当前序 + 1);
    }
    // 出口由段决定：薪资段回 基本信息 继续补档案，偏好段才是注册流末段去 披露说明。
    // 原来无论哪一段都无条件去 披露说明，社招第一次进向导两步就能冲到披露页，
    // 把 基本信息 → 工作经历 之间的 7 屏整段跳过。
    else 跳转(向导出口(段));
  };

  const 上一题 = () => {
    if (当前序 === 0) 返回();
    else {
      设当前题(题序[当前序 - 1]);
      记题序(当前序 - 1);
    }
  };

  // 按钮文案：两道多选题回显已选数量，最后一题是「保存并继续」
  const 按钮文字 =
    当前题 === '工作城市'
      ? `保存（已选 ${已选城市名们.length}）`
      : 当前题 === '期望职位'
        ? `保存（已选 ${已选职位名们.length}）`
        : 当前题 === '个人优势'
          ? '保存并继续'
          : '下一步';

  return (
    // 2026-08-24 全站选择风格统一（C1 定稿）：页底改白底
    <次级页外壳 白底>
      <div className={样式.引导壳}>
        <返回栏 返回={上一题} />

        {当前题 === '期望职位' ? (
          <期望职位题
            已选={已选职位}
            切换={造切换(设已选职位)}
            设已选={设已选职位}
            是后端={是后端}
            查询Taxonomy={目录查询?.查询Taxonomy}
            已选引用={已选职位引用}
            设已选引用={设已选职位引用}
          />
        ) : null}
        {当前题 === '工作城市' ? (
          <城市题
            已选={已选城市}
            切换={造切换(设已选城市)}
            是后端={是后端}
            查询Location={目录查询?.查询Location}
            已选引用={已选城市引用}
            设已选引用={设已选城市引用}
          />
        ) : null}
        {当前题 === '期望薪资' ? (
          <薪资题
            下限={薪资下限}
            设下限={设薪资下限}
            上限={薪资上限}
            设上限={设薪资上限}
            单位={当前薪资单位}
          />
        ) : null}
        {当前题 === '硬性排除'
          ? <排除题 已选={排除已选} 切换={切换排除} 提交自定义={提交自定义诉求} />
          : null}
        {当前题 === '个人优势' ? (
          <优势题
            文本={自我介绍}
            设文本={设自我介绍}
            恢复文案={是后端 ? '恢复简历识别建议' : '重新从简历提取'}
            恢复={恢复文本 === null ? null : () => 设自我介绍(恢复文本)}
          />
        ) : null}

        <主按钮
          文字={按钮文字}
          按下={下一题}
          禁用={
            (当前题 === '工作城市' && 已选城市名们.length === 0) ||
            (当前题 === '个人优势' && Boolean(作品集错误))
          }
        />
      </div>
    </次级页外壳>
  );
}

// ── 两模式共用的展示输入（Task 5）：同样的输入 → 同样的 DOM ──
/** 距底多少像素算「滚到底」——只用来判定，不改任何布局 */
const 到底余量 = 64;
/** 底部已选条的一枚 chip：键是稳定标识（Backend 用目录 ID，同名两条互不误删） */
interface 已选条目 {
  键: string;
  文字: string;
}
/** 右栏说明卡 */
interface 说明卡数据 {
  键: string;
  名: string;
  说明: string;
  已选计数: number;
  选中: boolean;
  /** 既不能下钻也不能选的目录项：保留展示，但不响应点击 */
  不可操作?: boolean;
  按下: () => void;
}
/** 细选层的一枚方向 */
interface 细选片 {
  键: string;
  文字: string;
  选中: boolean;
  不可操作?: boolean;
  按下: () => void;
}
/** 城市片 */
interface 城市片 {
  键: string;
  文字: string;
  选中: boolean;
  禁用?: boolean;
  按下: () => void;
}

// ── A3b2 期望职位：左侧分类栏 + 右侧行业卡 + 底部已选条 ─────────
const 职位分类 = [
  '行业分类',
  '后端开发',
  '架构',
  '基础平台',
  '算法',
  '数据',
  '前端',
  '测试 / 运维',
  '安全',
];

function 期望职位题({
  已选,
  切换,
  设已选,
  是后端,
  查询Taxonomy,
  已选引用,
  设已选引用,
}: {
  已选: string[];
  切换: (项: string) => void;
  设已选: (更新: (旧: string[]) => string[]) => void;
  是后端: boolean;
  查询Taxonomy: ((kind: 'job-categories', query: { parentId?: string; q?: string; cursor?: string; limit?: number }, 选项?: 目录查询选项) => Promise<{ items: BFFTaxonomyItem[]; nextCursor: string | null; catalogVersion: string }>) | undefined;
  已选引用: BFFTaxonomyItem[];
  设已选引用: (更新: (旧: BFFTaxonomyItem[]) => BFFTaxonomyItem[]) => void;
}) {
  const [分类, 设分类] = useState('行业分类');
  const [行业, 设行业] = useState('金融科技');
  const [关键词, 设关键词] = useState('');
  // 二级细选页：点行业卡后进来选具体方向（标注意见 2026-08-17 21:45）
  const [细选行业, 设细选行业] = useState<string | null>(null);

  // ── Backend：按需 查询Taxonomy('job-categories')，roots → 按 parentId 下钻 → 按 q 搜索 ──
  const [根项, 设根项] = useState<BFFTaxonomyItem[]>([]);
  const [当前根, 设当前根] = useState<BFFTaxonomyItem | null>(null);
  const [子项, 设子项] = useState<BFFTaxonomyItem[]>([]);
  const [搜索结果项, 设搜索结果项] = useState<BFFTaxonomyItem[]>([]);
  // Task 5：细选层的下钻路径（层数由 has_children 决定，不写死两层）——
  // 顶元素就是当前细选节点，返回键弹一层，弹空就关掉细选层。
  const [细选路径, 设细选路径] = useState<BFFTaxonomyItem[]>([]);
  const [细选项们, 设细选项们] = useState<BFFTaxonomyItem[]>([]);
  const [细选游标, 设细选游标] = useState<string | null>(null);
  const [细选加载中, 设细选加载中] = useState(false);
  const 计时 = useRef(0);
  const 方法引用 = useRef(查询Taxonomy);
  方法引用.current = 查询Taxonomy;
  // review-r3 R3-I-5：分页游标 + 加载中状态（root / child / search / 细选）
  const [根游标, 设根游标] = useState<string | null>(null);
  const [根加载中, 设根加载中] = useState(false);
  const [子项游标, 设子项游标] = useState<string | null>(null);
  const [子项加载中, 设子项加载中] = useState(false);
  const [搜索游标, 设搜索游标] = useState<string | null>(null);
  const [搜索加载中, 设搜索加载中] = useState(false);
  // review-cx F5（冻结合同 2）：各查询第一页的 catalogVersion —— 追加页返回不同版本时
  // 不跨版本合并，丢弃该查询累计的旧页与游标并从该查询第一页静默重开（版本归各自查询）。
  const [根版本, 设根版本] = useState('');
  const [子项版本, 设子项版本] = useState('');
  const [搜索版本, 设搜索版本] = useState('');
  const [细选版本, 设细选版本] = useState('');
  // review-r3 R3-I-6：代际 ref 守 stale response——慢的旧搜索/子项不覆盖新的
  const 搜索代际 = useRef(0);
  const 导航代际 = useRef(0);
  const 细选代际 = useRef(0);
  // review-r3 R3-I-8：当前根 ref——子项加载更多提交前确认当前根仍是发起请求的那个根
  const 当前根引用 = useRef(当前根);
  当前根引用.current = 当前根;
  const 细选节点 = 细选路径[细选路径.length - 1] ?? null;
  const 细选节点引用 = useRef(细选节点);
  细选节点引用.current = 细选节点;

  useEffect(() => {
    if (!是后端) return;
    const 方法 = 方法引用.current;
    if (!方法) return;
    void (async () => {
      try {
        const 页 = await 方法('job-categories', { limit: 50 });
        设根项(页.items);
        设根游标(页.nextCursor);
        设根版本(页.catalogVersion);
        if (页.items.length > 0 && !当前根) {
          设当前根(页.items[0]);
          // review-r3 R3-I-6：导航代际守 stale（预载第一枚子项）
          const 本次 = ++导航代际.current;
          设子项加载中(true);
          try {
            const 子页 = await 方法('job-categories', { parentId: 页.items[0].id, limit: 50 });
            if (本次 !== 导航代际.current) return;
            设子项(子页.items);
            设子项游标(子页.nextCursor);
            设子项版本(子页.catalogVersion);
          } catch (错误) {
            if (本次 !== 导航代际.current) return;
            设子项([]);
            设子项游标(null);
            轻提示(取后端错误文案(错误));
          } finally {
            if (本次 === 导航代际.current) 设子项加载中(false);
          }
        }
      } catch (错误) {
        设根项([]);
        设根游标(null);
        轻提示(取后端错误文案(错误));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [是后端]);

  const 搜词 = 关键词.trim();
  useEffect(() => {
    if (!是后端) return;
    const 方法 = 方法引用.current;
    if (!方法) return;
    // review-r3 R3-I-7：每次查询词变化都重置分页状态（结果/游标/加载），避免新词带着旧游标请求
    搜索代际.current += 1;
    设搜索结果项([]);
    设搜索游标(null);
    设搜索加载中(false);
    设搜索版本('');
    if (搜词 === '') return;
    window.clearTimeout(计时.current);
    const 本次 = 搜索代际.current;
    计时.current = window.setTimeout(async () => {
      try {
        const 页 = await 方法('job-categories', { q: 搜词, limit: 50 });
        if (本次 !== 搜索代际.current) return;
        设搜索结果项(页.items);
        设搜索游标(页.nextCursor);
        设搜索版本(页.catalogVersion);
      } catch (错误) {
        if (本次 !== 搜索代际.current) return;
        设搜索结果项([]);
        设搜索游标(null);
        轻提示(取后端错误文案(错误));
      }
    }, 250);
    return () => window.clearTimeout(计时.current);
  }, [搜词, 是后端]);

  // review-r3 R3-I-5：根的下一页（滚到底触发）
  const 根加载更多 = async () => {
    if (根游标 === null || 根加载中) return;
    const 方法 = 方法引用.current;
    if (!方法) return;
    设根加载中(true);
    try {
      const 页 = await 方法('job-categories', { cursor: 根游标, limit: 50 });
      if (页.catalogVersion !== 根版本) {
        // review-cx F5：目录换代 —— 旧游标是死页，从根查询第一页静默重开。
        // review-cx-r2：强制刷新让重开真打到服务端（缓存首页已来自旧快照）
        const 重开 = await 方法('job-categories', { limit: 50 }, { 强制刷新: true });
        设根项(重开.items);
        设根游标(重开.nextCursor);
        设根版本(重开.catalogVersion);
        return;
      }
      设根项((旧) => 合并目录页(旧, 页.items));
      设根游标(页.nextCursor);
    } catch (错误) {
      // 游标不动，用户再滚一次就是重试
      轻提示(取后端错误文案(错误));
    } finally {
      设根加载中(false);
    }
  };

  // review-r3 R3-I-5/I-8：子项的下一页——导航代际 + 当前根双重守 stale
  const 子项加载更多 = async () => {
    if (子项游标 === null || 子项加载中 || !当前根) return;
    const 方法 = 方法引用.current;
    if (!方法) return;
    const 本次导航 = 导航代际.current;
    const 目标根id = 当前根.id;
    设子项加载中(true);
    try {
      const 页 = await 方法('job-categories', { parentId: 目标根id, cursor: 子项游标, limit: 50 });
      if (本次导航 !== 导航代际.current || 当前根引用.current?.id !== 目标根id) return;
      if (页.catalogVersion !== 子项版本) {
        // review-cx F5：目录换代 —— 子项整组替换为新版本第一页（既有 parentId 路径，静默）。
        // review-cx-r2：强制刷新让重开真打到服务端（缓存首页已来自旧快照）
        const 重开 = await 方法('job-categories', { parentId: 目标根id, limit: 50 }, { 强制刷新: true });
        if (本次导航 !== 导航代际.current || 当前根引用.current?.id !== 目标根id) return;
        设子项(重开.items);
        设子项游标(重开.nextCursor);
        设子项版本(重开.catalogVersion);
        return;
      }
      设子项((旧) => 合并目录页(旧, 页.items));
      设子项游标(页.nextCursor);
    } catch (错误) {
      if (本次导航 !== 导航代际.current || 当前根引用.current?.id !== 目标根id) return;
      轻提示(取后端错误文案(错误));
    } finally {
      if (本次导航 === 导航代际.current && 当前根引用.current?.id === 目标根id) 设子项加载中(false);
    }
  };

  // review-r3 R3-I-5：搜索结果的下一页
  const 搜索加载更多 = async () => {
    if (搜索游标 === null || 搜索加载中) return;
    const 方法 = 方法引用.current;
    if (!方法) return;
    const 本次 = 搜索代际.current;
    设搜索加载中(true);
    try {
      const 页 = await 方法('job-categories', { q: 搜词, cursor: 搜索游标, limit: 50 });
      if (本次 !== 搜索代际.current) return;
      if (页.catalogVersion !== 搜索版本) {
        // review-cx F5：目录换代 —— 搜索结果整组替换为新版本第一页（静默）。
        // review-cx-r2：强制刷新让重开真打到服务端（缓存首页已来自旧快照）
        const 重开 = await 方法('job-categories', { q: 搜词, limit: 50 }, { 强制刷新: true });
        if (本次 !== 搜索代际.current) return;
        设搜索结果项(重开.items);
        设搜索游标(重开.nextCursor);
        设搜索版本(重开.catalogVersion);
        return;
      }
      设搜索结果项((旧) => 合并目录页(旧, 页.items));
      设搜索游标(页.nextCursor);
    } catch (错误) {
      if (本次 !== 搜索代际.current) return;
      轻提示(取后端错误文案(错误));
    } finally {
      if (本次 === 搜索代际.current) 设搜索加载中(false);
    }
  };

  // Task 5：细选层的一层内容（进入 / 返回上一层都走它），代际守 stale
  const 载细选 = async (节点: BFFTaxonomyItem) => {
    const 方法 = 方法引用.current;
    设细选项们([]);
    设细选游标(null);
    设细选版本('');
    if (!方法) return;
    const 本次 = ++细选代际.current;
    设细选加载中(true);
    try {
      const 页 = await 方法('job-categories', { parentId: 节点.id, limit: 50 });
      if (本次 !== 细选代际.current) return;
      设细选项们(页.items);
      设细选游标(页.nextCursor);
      设细选版本(页.catalogVersion);
    } catch (错误) {
      if (本次 !== 细选代际.current) return;
      设细选项们([]);
      设细选游标(null);
      轻提示(取后端错误文案(错误));
    } finally {
      if (本次 === 细选代际.current) 设细选加载中(false);
    }
  };

  const 细选加载更多 = async () => {
    const 节点 = 细选节点;
    if (细选游标 === null || 细选加载中 || !节点) return;
    const 方法 = 方法引用.current;
    if (!方法) return;
    const 本次 = 细选代际.current;
    设细选加载中(true);
    try {
      const 页 = await 方法('job-categories', { parentId: 节点.id, cursor: 细选游标, limit: 50 });
      if (本次 !== 细选代际.current || 细选节点引用.current?.id !== 节点.id) return;
      if (页.catalogVersion !== 细选版本) {
        // review-cx F5：目录换代 —— 细选列表整组替换为新版本第一页（静默）。
        // review-cx-r2：强制刷新让重开真打到服务端（缓存首页已来自旧快照）
        const 重开 = await 方法('job-categories', { parentId: 节点.id, limit: 50 }, { 强制刷新: true });
        if (本次 !== 细选代际.current || 细选节点引用.current?.id !== 节点.id) return;
        设细选项们(重开.items);
        设细选游标(重开.nextCursor);
        设细选版本(重开.catalogVersion);
        return;
      }
      设细选项们((旧) => 合并目录页(旧, 页.items));
      设细选游标(页.nextCursor);
    } catch (错误) {
      if (本次 !== 细选代际.current || 细选节点引用.current?.id !== 节点.id) return;
      轻提示(取后端错误文案(错误));
    } finally {
      if (本次 === 细选代际.current && 细选节点引用.current?.id === 节点.id) 设细选加载中(false);
    }
  };

  // 行业是单选语义：换行业时要把旧的「xx（行业）」标签替换掉，而不是 toggle 追加，
  // 否则圆点亮的和底部已选标签会脱节（亮的没标签、有标签的没亮）
  const 选行业 = (名称: string) => {
    设行业(名称);
    设已选((旧) => [...旧.filter((条) => !条.endsWith('（行业）')), `${名称}（行业）`]);
  };

  // 点整张卡 = 选中该行业 + 进入二级细选页挑具体方向
  const 进细选 = (名称: string) => {
    选行业(名称);
    设细选行业(名称);
  };

  // Backend 选中：只有 selectable 的节点才能写成引用；已选按 ID 去重，同名两条互不误删
  const 切换选中 = (项: BFFTaxonomyItem) => {
    设已选引用((旧) => (旧.some((条) => 条.id === 项.id) ? 旧.filter((条) => 条.id !== 项.id) : [...旧, 项]));
  };

  // Backend 点目录项：可下钻看 has_children，可写引用看 selectable，两者独立判断。
  // 两者同真时现有控件表达不了「选此节点 / 继续下钻」，保留导航、不猜选择（PM 缺口见报告）。
  const 点目录项 = (项: BFFTaxonomyItem, 在细选层: boolean) => {
    if (项.has_children) {
      设细选路径((旧) => (在细选层 ? [...旧, 项] : [项]));
      void 载细选(项);
      return;
    }
    if (!项.selectable) return;
    切换选中(项);
  };

  const 细选返回 = () => {
    const 上一层 = 细选路径.slice(0, -1);
    设细选路径(上一层);
    细选代际.current += 1;
    设细选项们([]);
    设细选游标(null);
    设细选版本('');
    设细选加载中(false);
    const 顶 = 上一层[上一层.length - 1];
    if (顶) void 载细选(顶);
  };

  const 选根 = async (项: BFFTaxonomyItem) => {
    设当前根(项);
    当前根引用.current = 项;
    设子项([]);
    设子项游标(null);
    设子项版本('');
    const 方法 = 方法引用.current;
    if (!方法) return;
    // review-r3 R3-I-6：导航代际守 stale——快速切大类时慢的旧子项不覆盖新的
    const 本次 = ++导航代际.current;
    设子项加载中(true);
    try {
      const 子页 = await 方法('job-categories', { parentId: 项.id, limit: 50 });
      if (本次 !== 导航代际.current) return;
      设子项(子页.items);
      设子项游标(子页.nextCursor);
      设子项版本(子页.catalogVersion);
    } catch (错误) {
      if (本次 !== 导航代际.current) return;
      设子项([]);
      设子项游标(null);
      轻提示(取后端错误文案(错误));
    } finally {
      if (本次 === 导航代际.current) 设子项加载中(false);
    }
  };

  // 搜索词同时匹配一级行业名和二级方向名，保证搜索框是真能用的
  const 词 = 关键词.trim();
  const 过滤后行业 =
    词 === ''
      ? 行业字典
      : 行业字典.filter(
          (组) => 组.行业.includes(词) || 组.细分.some((项) => 项.includes(词))
        );

  const 当前组 = 行业字典.find((组) => 组.行业 === 细选行业) ?? null;

  // ── 两模式的展示输入（下面只有一套 JSX）──
  const 左栏项们: { 键: string; 文字: string; 当前: boolean; 按下: () => void }[] = 是后端
    ? 根项.map((项) => ({
        键: 项.id,
        文字: 项.display_name,
        当前: 当前根?.id === 项.id,
        按下: () => void 选根(项),
      }))
    : 职位分类.map((项) => ({
        键: 项,
        文字: 项,
        当前: 分类 === 项,
        按下: () => 设分类(项),
      }));
  // 说明卡：Backend 目录没有 Mock 的行业说明，就把真实空值传进原说明位置，不补文案
  const 说明卡们: 说明卡数据[] = 是后端
    ? (搜词 === '' ? 子项 : 搜索结果项).map((项) => ({
        键: 项.id,
        名: 项.display_name,
        说明: '',
        已选计数: 已选引用.filter((条) => 条.parent_id === 项.id).length,
        选中: 已选引用.some((条) => 条.id === 项.id),
        不可操作: !项.has_children && !项.selectable,
        按下: () => 点目录项(项, false),
      }))
    : 过滤后行业.map((组) => ({
        键: 组.行业,
        名: 组.行业,
        说明: 组.说明,
        已选计数: 组.细分.filter((项) => 已选.includes(`${项}（方向）`)).length,
        选中: 行业 === 组.行业,
        按下: () => 进细选(组.行业),
      }));
  const 已选条目们: 已选条目[] = 是后端
    ? 已选引用.map((条) => ({ 键: 条.id, 文字: 条.display_name }))
    : 已选.map((项) => ({ 键: 项, 文字: 项 }));
  const 移除已选 = (键: string) => {
    if (!是后端) {
      切换(键);
      return;
    }
    const 目标 = 已选引用.find((条) => 条.id === 键);
    if (目标) 切换选中(目标);
  };

  // Task 5：继续加载只挂在既有滚动容器上，游标归各自的查询
  const 造滚动加载 = (加载: () => Promise<void>) => (事件: UIEvent<HTMLDivElement>) => {
    if (!是后端) return;
    const 元素 = 事件.currentTarget;
    if (元素.scrollTop + 元素.clientHeight < 元素.scrollHeight - 到底余量) return;
    void 加载();
  };

  const 细选内容: { 标题: string; 说明: string; 项们: 细选片[] } | null = 是后端
    ? 细选节点
      ? {
          标题: 细选节点.display_name,
          // Backend 目录没有 Mock 的行业说明：真实空值进原说明位置
          说明: '',
          项们: 细选项们.map((项) => ({
            键: 项.id,
            文字: 项.display_name,
            选中: 已选引用.some((条) => 条.id === 项.id),
            不可操作: !项.has_children && !项.selectable,
            按下: () => 点目录项(项, true),
          })),
        }
      : null
    : 当前组
      ? {
          标题: 当前组.行业,
          说明: 当前组.说明,
          项们: 当前组.细分.map((项) => {
            const 标签 = `${项}（方向）`;
            return {
              键: 项,
              文字: 项,
              选中: 已选.includes(标签),
              按下: () => 切换(标签),
            };
          }),
        }
      : null;

  return (
    <div className={样式.题体}>
      <div className={样式.标题上移4}>
        <页面大标题 标题="期望职位是" />
      </div>

      <搜索条 占位={是后端 ? '搜索职位 / 方向' : '搜索行业 / 方向'} 值={关键词} 改变={设关键词} />

      <div className={样式.两栏}>
        <div className={`${样式.左栏} 滚动区`} onScroll={造滚动加载(根加载更多)}>
          {左栏项们.map((项) => (
            <button
              key={项.键}
              className={`${样式.左栏项} ${项.当前 ? 样式.左栏项选中 : ''} 可点`}
              onClick={项.按下}
            >
              {项.文字}
            </button>
          ))}
        </div>

        <div
          className={`${样式.右栏} 滚动区`}
          onScroll={造滚动加载(搜词 === '' ? 子项加载更多 : 搜索加载更多)}
        >
          {说明卡们.map((卡) => (
            <button
              key={卡.键}
              className={`${样式.行业卡} ${卡.选中 ? 样式.行业卡选中 : ''} 可点`}
              onClick={卡.按下}
              aria-disabled={卡.不可操作 ? true : undefined}
            >
              <单选点 选中={卡.选中} 尺寸={19} />
              <span className={样式.行业文字组}>
                <span className={样式.行业名}>
                  {卡.名}
                  {卡.已选计数 > 0 ? (
                    <span className={样式.方向计数}>{卡.已选计数} 个方向</span>
                  ) : null}
                </span>
                <span className={样式.行业说明}>{卡.说明}</span>
              </span>
              <span className={样式.尖括号}>›</span>
            </button>
          ))}
          {说明卡们.length === 0 ? (
            <div className={样式.搜索无结果}>
              {是后端 && (子项加载中 || 搜索加载中) ? '加载中…' : '没有匹配的方向，换个词试试。'}
            </div>
          ) : null}
        </div>
      </div>

      <已选条 条目们={已选条目们} 移除={移除已选} />

      {细选内容 ? (
        <方向细选页
          标题={细选内容.标题}
          说明={细选内容.说明}
          项们={细选内容.项们}
          条目们={已选条目们}
          移除={移除已选}
          滚动={是后端 ? 造滚动加载(细选加载更多) : undefined}
          返回={是后端 ? 细选返回 : () => 设细选行业(null)}
        />
      ) : null}
    </div>
  );
}

/** 行业二级细选页：盖住整个引导壳（含进度条和主按钮），自带顶栏和已选条。
 *  Task 5：Backend 用同一层承载真实目录的下一级（层数由 has_children 决定）。*/
function 方向细选页({
  标题,
  说明,
  项们,
  条目们,
  移除,
  滚动,
  返回,
}: {
  标题: string;
  说明: string;
  项们: 细选片[];
  条目们: 已选条目[];
  移除: (键: string) => void;
  滚动?: (事件: UIEvent<HTMLDivElement>) => void;
  返回: () => void;
}) {
  const 本层已选 = 项们.filter((项) => 项.选中);

  return (
    <div className={样式.细选层}>
      <div className={样式.细选顶栏}>
        <button className={`${样式.细选返回} 可点`} onClick={返回} aria-label="返回行业列表">
          ‹
        </button>
        <span className={样式.细选标题}>{标题}</span>
        <button className={`${样式.细选完成} 可点`} onClick={返回}>
          完成
        </button>
      </div>

      <div className={样式.细选说明}>{说明}</div>
      <div className={样式.细选提示}>
        选具体方向，可多选{本层已选.length > 0 ? ` · 已选 ${本层已选.length} 个` : ''}
      </div>

      <div className={`${样式.细选列表} 滚动区`} onScroll={滚动}>
        <div className={样式.细选卡}>
            {项们.map((项) => (
              <button
                key={项.键}
                className={`${样式.细选项} ${项.选中 ? 样式.细选项选中 : ''} 可点`}
                onClick={项.按下}
                aria-disabled={项.不可操作 ? true : undefined}
              >
                <span>{项.文字}</span>
                <span className={样式.细选勾}>{项.选中 ? '✓' : ''}</span>
              </button>
            ))}
        </div>
      </div>

      <已选条 条目们={条目们} 移除={移除} />
    </div>
  );
}

// ── A3b 工作城市：当前定位 + 热门 + 按省份铺开（标注意见 21:45）────
function 城市题({
  已选,
  切换,
  是后端,
  查询Location,
  已选引用,
  设已选引用,
}: {
  已选: string[];
  切换: (项: string) => void;
  是后端: boolean;
  查询Location: ((q: { q?: string; countryCode?: string; admin1Code?: string; cursor?: string; limit?: number }) => Promise<{ items: BFFLocationItem[]; nextCursor: string | null; catalogVersion: string }>) | undefined;
  已选引用: BFFLocationItem[];
  设已选引用: (更新: (旧: BFFLocationItem[]) => BFFLocationItem[]) => void;
}) {
  // Backend：搜索 250ms debounce；默认目录页（不发 q）供热门区与行政区分组
  const { 词, 设词, 结果: 搜索结果项, 搜索中 } = use城市搜索(是后端 ? 查询Location : undefined);
  const { 热门项们, 项们: 默认项们 } = use城市默认页(是后端 ? 查询Location : undefined);
  const 搜词 = 词.trim();

  // Backend 切换：按 ID 去重，同名两条互不误删
  const 切换后端 = (项: BFFLocationItem) => {
    设已选引用((旧) =>
      旧.some((条) => 条.id === 项.id) ? 旧.filter((条) => 条.id !== 项.id) : [...旧, 项],
    );
  };

  // 搜索跨全国匹配，省名也算命中（输「浙」出浙江全省），比只搜热门 15 城实用
  const 搜索结果 =
    搜词 === ''
      ? []
      : 城市字典.flatMap((组) =>
          组.省.includes(搜词) ? 组.城市 : 组.城市.filter((城) => 城.includes(搜词))
        );

  // ── 两模式的展示输入（下面只有一套 JSX）──
  const 后端片 = (项: BFFLocationItem, 键?: string): 城市片 => ({
    键: 键 ?? 项.id,
    文字: 项.display_name,
    选中: 已选引用.some((条) => 条.id === 项.id),
    按下: () => 切换后端(项),
  });
  const Mock片 = (城: string, 键?: string): 城市片 => ({
    键: 键 ?? 城,
    文字: 城,
    选中: 已选.includes(城),
    按下: () => 切换(城),
  });

  // 当前定位：Backend 用已批准的缺失态，不假选上海
  const 定位片: 城市片 = 是后端
    ? { 键: '当前定位', 文字: '暂未获取定位', 选中: false, 禁用: true, 按下: () => {} }
    : Mock片('上海');
  const 热门片们: 城市片[] = 是后端
    ? 热门项们.map((项) => 后端片(项, `热门-${项.id}`))
    : 热门城市.map((城) => Mock片(城));
  const 分组们: { 键: string; 标题: string; 片们: 城市片[] }[] = 是后端
    ? 按行政区分组(默认项们).map((组) => ({
        键: 组.键,
        标题: 组.键,
        片们: 组.城市们.map((项) => 后端片(项, `${组.键}-${项.id}`)),
      }))
    : 城市字典.map((组) => ({
        键: 组.省,
        标题: 组.省,
        片们: 组.城市.map((城) => Mock片(城, `${组.省}-${城}`)),
      }));
  const 搜索片们: 城市片[] = 是后端
    ? 搜索结果项.map((项) => 后端片(项))
    : 搜索结果.map((城) => Mock片(城));
  const 已选条目们: 已选条目[] = 是后端
    ? 已选引用.map((条) => ({ 键: 条.id, 文字: 条.display_name }))
    : 已选.map((城) => ({ 键: 城, 文字: 城 }));
  const 移除已选 = (键: string) => {
    if (!是后端) {
      切换(键);
      return;
    }
    const 目标 = 已选引用.find((条) => 条.id === 键);
    if (目标) 切换后端(目标);
  };

  return (
    <div className={样式.题体}>
      <div className={样式.标题上移2}>
        <页面大标题 标题="你理想的工作城市是" />
      </div>

      <搜索条 占位="搜索城市 / 省份" 值={词} 改变={设词} />

      <滚动区 样式覆盖={{ padding: '12px 18px 10px' }}>
        {搜词 === '' ? (
          <>
            <div className={样式.分组标}>当 前 定 位</div>
            <div className={样式.城市网格}>{城市键(定位片)}</div>

            <div className={`${样式.分组标} ${样式.分组标间距}`}>热 门 城 市</div>
            <div className={样式.城市网格}>{热门片们.map(城市键)}</div>

            {/* 按省份铺开：一省一组，省名当分组标 */}
            {分组们.map((组) => (
              <div key={组.键}>
                <div className={`${样式.分组标} ${样式.分组标间距}`}>{组.标题}</div>
                <div className={样式.城市网格}>{组.片们.map(城市键)}</div>
              </div>
            ))}
          </>
        ) : (
          <>
            <div className={样式.分组标}>搜 索 结 果</div>
            <div className={样式.城市网格}>{搜索片们.map(城市键)}</div>
            {搜索片们.length === 0 && !搜索中 ? (
              <div className={样式.搜索无结果}>没有匹配的城市，换个词试试。</div>
            ) : null}
          </>
        )}
      </滚动区>

      <已选条 条目们={已选条目们} 移除={移除已选} />
    </div>
  );
}

function 城市键(片: 城市片) {
  return (
    <button
      key={片.键}
      className={`${样式.城市键} ${片.选中 ? 样式.城市键选中 : ''} 可点`}
      onClick={片.按下}
      disabled={片.禁用}
    >
      {/* 2026-08-24 全站选择风格统一（C1 定稿）：✓ 改由 CSS ::before 前置渲染，去掉文字尾缀避免双勾 */}
      {片.文字}
    </button>
  );
}

// ── A3c 期望薪资：双滚轮 + 手填（标注意见 21:47）─────────────
const 行高 = 46;
/**
 * 薪资档位（标注意见 2026-08-18：从 1K 开始、最高 250K；手填行同日按标注删除）。
 * 变步长，低段密、高段疏 —— 应届与实习集中在 1–10K，每 1K 一档才够用；
 * 高段再密排要滚上百下。
 *   1–10K → 1K 一档；10–30K → 2K；30–80K → 5K；80–250K → 10K。
 * 右轮（上限）单独多一档 260K：上限必须能大于最高的下限，否则下限选 250K 时上限没得选。
 */
const 薪资档 = [
  0, // 面议（标注 2026-08-20 12:55）
  ...Array.from({ length: 10 }, (_, 序) => 序 + 1), // 1–10
  ...Array.from({ length: 10 }, (_, 序) => 12 + 序 * 2), // 12–30
  ...Array.from({ length: 10 }, (_, 序) => 35 + 序 * 5), // 35–80
  ...Array.from({ length: 17 }, (_, 序) => 90 + 序 * 10), // 90–250
];
const 上限薪资档 = [...薪资档, 260];
const 日薪档 = [
  0,
  ...Array.from({ length: 16 }, (_, 序) => 50 + 序 * 10), // 50–200
  ...Array.from({ length: 15 }, (_, 序) => 220 + 序 * 20), // 220–500
  ...Array.from({ length: 6 }, (_, 序) => 550 + 序 * 50), // 550–800
  // 2026-09-08 产品负责人：「现在有的实习工资都 2000 了」—— 800 以上放到 2000；
  // 同日又指出「超过 1000 之后右边每次就涨 100」太粗，改成 50 一档（与 550–800 段同步长）
  ...Array.from({ length: 24 }, (_, 序) => 850 + 序 * 50), // 850–2000
];
const 上限日薪档 = [...日薪档, 2200];

/**
 * 上限档表：跟着下限走，两条规则叠加。
 *
 * ① **带宽帽**（标注 2026-08-23：「25K 最多可以滑到 50K，10K 最多滑到 15K，
 *    要不然有的人把范围设的太大了」）。两个例子推出的规则：
 *    月薪 ≤10K → 下限 × 1.5；>10K → 下限 × 2。
 *    低薪段（应届 / 实习）的合理带宽本来就窄，高段才放得开。
 *    日薪按同一口径，分界取 200 元/天（≈ 月薪 10K 的日均量级）。
 *
 * ② **下限附近加密到 1 步长**（标注同日：「我选 26k 的时候，右边最高应该是 27K，
 *    中间多跳过了一个」）。薪资区间的宽度通常不大，需要精确的正是紧挨下限那一段；
 *    「26 到 200」这种跨度不需要 1K 精度，所以只在近段加密，远段沿用原表步长。
 *
 * 兜底：帽算出来若不足 下限 + 最小带宽，抬到 下限 + 最小带宽 ——
 * 否则下限很小时（如 1K，×1.5 = 1.5）会算出一个连一档都放不下的帽，右轮直接空掉。
 */
export function 算上限档表(下限: number, 全表: number[], 是日薪: boolean): number[] {
  if (下限 <= 0) return [];
  const 最小带宽 = 是日薪 ? 50 : 3;

  // 带宽帽：低段 1.5 倍、高段 2 倍，中间**线性过渡**而不是在分界点上突变。
  // 突变的后果实测过：10K 帽 15K、12K 帽 24K —— 差 2K 的两个人可选带宽差 9K。
  const 低界 = 是日薪 ? 200 : 10;
  const 高界 = 是日薪 ? 500 : 25;
  const 倍率 =
    下限 <= 低界 ? 1.5
    : 下限 >= 高界 ? 2
    : 1.5 + (0.5 * (下限 - 低界)) / (高界 - 低界);
  // 帽还要夹在档表自身的上界内：下限 250K 时 ×2 = 500K，而月薪档表最高只到 260K，
  // 不夹的话下面「帽必须可选」那一步会硬塞一个表外的数进滚轮。
  const 表上界 = 全表[全表.length - 1];
  const 帽 = Math.min(表上界, Math.max(Math.round(下限 * 倍率), 下限 + 最小带宽));

  // 近段加密：跨度取下限的 20%，不是固定值。
  // 固定 10K 时高段会被 1K 步长占满 —— 150K 的档排成 151、152…160，
  // 而年薪 150K 的人不在意 1K 差别，滚 20 档还够不到帽。
  // 步长同理按量级取：低段 1K 够细，高段 1K 是噪音。
  const 加密跨度 = Math.max(是日薪 ? 50 : 5, Math.round(下限 * 0.2));
  const 加密步长 =
    是日薪 ? (下限 >= 400 ? 20 : 10)
    : 下限 >= 80 ? 5
    : 下限 >= 30 ? 2
    : 1;

  const 近段止 = Math.min(下限 + 加密跨度, 帽);
  const 近段: number[] = [];
  for (let 档 = 下限 + 加密步长; 档 <= 近段止; 档 += 加密步长) 近段.push(档);

  // 远段沿用原档表的变步长，只取近段之后、帽以内的
  const 远段 = 全表.filter((档) => 档 > 近段止 && 档 <= 帽);

  // 帽本身必须可选：近段/远段都没覆盖到时补上（否则「最多能到多少」反而选不着）
  const 合并 = [...近段, ...远段];
  // 帽本身必须可选：近段/远段都没覆盖到时补上（否则「最多能到多少」反而选不着）。
  // 帽已夹在表上界内，所以这里补进去的一定是合法值。
  if (合并.length === 0 || 合并[合并.length - 1] !== 帽) {
    if (帽 > 下限) 合并.push(帽);
  }
  return 合并;
}


function 薪资题({
  下限,
  设下限,
  上限,
  设上限,
  单位,
}: {
  下限: number;
  设下限: (档: number) => void;
  上限: number;
  设上限: (档: number) => void;
  单位: 求职薪资单位;
}) {
  const 是日薪 = 单位 === '元/天';
  const 下限档表 = 是日薪 ? 日薪档 : 薪资档;
  // 上限档表跟着下限收：只留严格大于下限的档（标注 2026-08-23：
  // 「当左边最低选择 1k 的时候，右边的最高就应该是 2k 起步」）。
  // 原来上限是固定全量表，滚轮里明晃晃列着「最高 1K」这种比下限还小的档 ——
  // 虽然选完下限时有事后兜底会把过小的上限抬上去，但那是**选错之后再纠正**，
  // 用户先看到一堆本来就不该存在的选项。直接从档表里去掉，非法组合就滚不出来。
  // 下限 = 0（面议）时右轮整个换成空位、根本不渲染，所以这里不用为它特判。
  const 上限全表 = 是日薪 ? 上限日薪档 : 上限薪资档;
  const 上限档表 = 算上限档表(下限, 上限全表, 是日薪);
  const 自动带宽 = 是日薪 ? 100 : 10;
  const 最高上限 = 是日薪 ? 2200 : 260;
  // 轮上只写 `460/天`，不写 `460元/天`（标注 2026-08-22 15:17：「把这个元去掉」）。
  // 月薪那一档本来就是 `50K` 不带「元」，日薪带上「元」是两档不一致。
  // 注意这只是**轮子上的显示**：数据里的单位仍是 '元/天'（求职薪资单位 的取值），
  // 匹配和落盘都读那个，别把两者混成一个。
  const 显示单位 = 是日薪 ? '/天' : 'K';
  return (
    <滚动区 样式覆盖={{ paddingBottom: 12 }}>
      <页面大标题 标题={是日薪 ? '期望实习日薪是？' : '期望现金月薪是？'} />

      <div className={样式.薪资卡}>
        <div className={样式.薪资头}>
          <span className={样式.薪资头文字}>最低</span>
          <span className={样式.薪资头文字}>最高</span>
        </div>
        <div className={样式.轮容器}>
          {/* 中间档高亮底 + 两轮之间的连字符，都不接收点击 */}
          <div className={样式.轮高亮} />
          <span className={样式.轮连字}>{下限 === 0 ? '' : '—'}</span>
          <薪资轮
            值={下限}
            设值={(档) => {
              设下限(档);
              // 标注 2026-08-20 13:15：选面议 → 最高清空；从面议滚回数字 → 最高给回默认带宽
              if (档 === 0) 设上限(0);
              else if (上限 === 0 || 上限 < 档) 设上限(Math.min(档 + 自动带宽, 最高上限));
            }}
            名称={是日薪 ? '最低日薪' : '最低月薪'}
            档表={下限档表}
            单位={显示单位}
          />
          {下限 === 0 ? (
            <div className={样式.薪资轮空位} aria-hidden />
          ) : (
            <薪资轮
              值={上限}
              设值={设上限}
              名称={是日薪 ? '最高日薪' : '最高月薪'}
              档表={上限档表}
              单位={显示单位}
            />
          )}
        </div>
      </div>
    </滚动区>
  );
}

function 薪资轮({
  值,
  设值,
  名称,
  档表 = 薪资档,
  单位 = 'K',
}: {
  值: number;
  设值: (档: number) => void;
  名称: string;
  /** 左轮用 薪资档，右轮用 上限薪资档（多一档 260K）*/
  档表?: number[];
  /** 轮上显示的后缀，不是数据单位：月薪 `K`、日薪 `/天` */
  单位?: 'K' | '/天';
}) {
  // 定位 / 防抖取值 / 键盘 / 点档直选 / aria-activedescendant 都收敛在 use可访问滚轮，
  // 与 内嵌双滚轮 / 数字滚轮层 / 年月滚轮层 同一套合同（本屏的 DOM 与版式不动）。
  const {
    滚轮引用,
    活动项编号,
    处理滚动,
    处理按键,
    取选项属性,
  } = use可访问滚轮({ 选项: 档表, 值, 设值, 行高 });

  return (
    <div className={样式.薪资列包}>
      <div
        ref={滚轮引用}
        className={`${样式.薪资轮} 滚动区`}
        onScroll={处理滚动}
        onKeyDown={处理按键}
        role="listbox"
        tabIndex={0}
        aria-label={名称}
        aria-activedescendant={活动项编号}
      >
        {档表.map((档, 序号) => (
          <div
            key={档}
            className={样式.薪资档}
            role="option"
            aria-selected={档 === 值}
            {...取选项属性(序号)}
          >
            {/* 档里只留数字（面议那一档是「面议」两个字）。标注 2026-08-22：
                「这个年应该是固定的，用户只用转动数字就行……不用每个滚轮数字后面都带有年和月」*/}
            <span className={`${档 === 值 ? 样式.档选中 : 样式.档未选} 等宽数字`}>
              {档 === 0 ? '面议' : 档}
            </span>
          </div>
        ))}
      </div>
      {/* 单位钉在滚动区外、垂直居中正对高亮档，滚动时不动；最低/最高两列各挂一个。
          选中「面议」时藏起来（用 visibility 而不是拆节点，免得整组左右跳）——
          面议档从来就不带单位，挂个 K 会读成「面议K」。 */}
      <span className={`${样式.薪资固定单位}${值 === 0 ? ` ${样式.薪资固定单位隐藏}` : ''}`}>
        {单位}
      </span>
    </div>
  );
}

// ── A3e 硬性排除 ─────────────────────────────────────────────
const 排除候选 = ['大小周', '纯外包 / 乙方', '全现场办公', '频繁出差'];

/** Backend 无法把文字变成组织身份时的统一说明（显示名不是身份，名称匹配不算选择）。 */
const 需明确公司文案 = '无法确认具体公司，请先明确选择要屏蔽的公司';

function 排除题({ 已选, 切换, 提交自定义 }: {
  已选: string[];
  切换: (项: string) => void;
  提交自定义: (词: string) => void;
}) {
  const { 状态: 全局, 数据源模式, 操作 } = use应用状态();
  const 是后端 = 数据源模式 === 'backend';
  // 学生分流：实习公司通常不必屏蔽，一键开关默认关；社会人现雇主本来就该挡，默认开
  const 在校生 = 全局.基本信息.身份 === '在校';
  // 简历里出现过的公司（含现雇主）：一键屏蔽的来源
  const 简历里的公司 = useMemo(
    () => [...new Set(全局.简历经历.map((条) => 条.公司).filter(Boolean))],
    [全局.简历经历]
  );
  // J-PILOT-02 Task 7（Spec §3.4 / §5.2）：Backend 的屏蔽状态只能来自权威隐私快照 ——
  // 简历里的公司名只是文字，既不默认显示成已屏蔽，也不能因社招身份自动写入；
  // 一键开关与「再加一家」都没有真实组织结果可选（Plan PM_BLOCKED），一律阻止写并说明。
  const 权威屏蔽: 屏蔽项[] = 是后端 ? 全局.屏蔽名单 : [];
  const [一键屏蔽简历公司, 设一键屏蔽简历公司] = useState(是后端 ? false : !在校生);
  const [屏蔽公司, 设屏蔽公司] = useState<string[]>(是后端 || 在校生 ? [] : 简历里的公司);
  const [公司录入中, 设公司录入中] = useState(false);
  const [公司草稿, 设公司草稿] = useState('');
  // 解除在途：沿用现有禁用承载，不新增控件；成功与否一律以权威快照为准
  const [解除中, 设解除中] = useState<string | null>(null);

  const 提交公司 = () => {
    const 名 = 公司草稿.trim();
    if (是后端) {
      // 自由文本不是 organization_id：不发请求、不摆假成功 chip，只说明缺什么
      if (名 !== '') 轻提示(需明确公司文案);
      设公司草稿('');
      设公司录入中(false);
      return;
    }
    if (名 !== '' && !屏蔽公司.includes(名)) 设屏蔽公司((旧) => [...旧, 名]);
    设公司草稿('');
    设公司录入中(false);
  };

  const 切一键屏蔽 = () => {
    if (是后端) {
      // 一键不得绕过真实组织选择，更不能拿搜索首命中顶替用户的明确选择
      轻提示(需明确公司文案);
      return;
    }
    const 新值 = !一键屏蔽简历公司;
    设一键屏蔽简历公司(新值);
    设屏蔽公司((旧) =>
      新值
        ? [...new Set([...旧, ...简历里的公司])]
        : 旧.filter((名) => !简历里的公司.includes(名))
    );
  };

  /** Backend 解除：成功才由权威快照撤掉 chip；失败保留原状并复用既有轻提示报错。
   *  只对 手动添加 开放单击直解 —— 建档时自动加入的当前雇主/关联公司按 Spec §5.2
   *  必须先过风险确认，本屏没有那层确认（也不新增），所以在这里只说明、不代用户确认。 */
  const 解除屏蔽 = async (条: 屏蔽项) => {
    if (条.来源 !== '手动添加') {
      轻提示('当前雇主 / 关联公司的屏蔽需要风险确认，请到屏蔽名单页解除');
      return;
    }
    设解除中(条.组织编号);
    try {
      // 传完整条目：操作层按 条目.来源 推导是否需要风险确认（与 屏蔽名单 屏同一规则）
      await 操作.解除组织屏蔽(条);
    } catch (错误) {
      轻提示(取后端错误文案(错误));
    } finally {
      设解除中(null);
    }
  };

  // 两模式共用同一枚 chip 的展示与位置，只有来源与「点掉」的含义不同
  const 屏蔽标签们 = 是后端
    ? 权威屏蔽.map((条) => ({
        键: 条.组织编号,
        文字: 条.名称,
        禁用: 解除中 === 条.组织编号,
        按下: () => { void 解除屏蔽(条); },
      }))
    : 屏蔽公司.map((名) => ({
        键: 名,
        文字: 名,
        禁用: false,
        按下: () => 设屏蔽公司((旧) => 旧.filter((条) => 条 !== 名)),
      }));

  return (
    <滚动区 样式覆盖={{ paddingBottom: 12 }}>
      <页面大标题 标题="哪些情况直接排除？" />

      <div className={样式.排除区}>
        <排除选项 已选={已选} 切换={切换} 提交自定义={提交自定义} />

        <div className={样式.屏蔽公司卡}>
          <div className={样式.屏蔽公司头}>
            <div>
              <div className={样式.屏蔽公司标题}>屏蔽公司</div>
              <div className={样式.屏蔽公司说明}>简历里出现过的公司</div>
            </div>
            {/* 标注 11:58：改成一键开关 —— 简历里的公司一次性全屏蔽，
                不必逐个手输（打开时把简历公司并进列表，关掉时撤走） */}
            <开关
              标签="一键屏蔽简历中的公司"
              开={一键屏蔽简历公司}
              切换={切一键屏蔽}
            />
          </div>

          <button
            className={`${样式.屏蔽公司添加} 可点`}
            onClick={() => 设公司录入中(true)}
          >
            ＋ 再加一家
          </button>

          {公司录入中 ? (
            <行内输入
              占位="公司名，可只写关键词"
              值={公司草稿}
              改变={设公司草稿}
              提交={提交公司}
            />
          ) : null}

          {屏蔽标签们.length > 0 ? (
            <div className={样式.屏蔽公司标签组}>
              {屏蔽标签们.map((条) => (
                <button
                  key={条.键}
                  className={`${样式.已选标签} 可点`}
                  disabled={条.禁用}
                  onClick={条.按下}
                >
                  {条.文字} ✕
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </滚动区>
  );
}

// ──「到岗节奏」题（原 A3f）已整体挪去 求职状态 屏 /onboard/status ──

// ── A3g 个人优势（备忘录式编辑 + GitHub）──────────────────────

function 优势题({ 文本, 设文本, 恢复文案, 恢复 }: {
  文本: string;
  设文本: (值: string) => void;
  恢复文案: string;
  /** null = 无可恢复来源（Backend 无当前轮真实建议），整行不渲染 */
  恢复: (() => void) | null;
}) {

  return (
    <滚动区 样式覆盖={{ paddingBottom: 12 }}>
      <页面大标题
        标题="分享一下自己的个人优势"
        说明="已根据你上传的简历预先提取，直接删改即可。"
      />

      <div className={样式.优势卡}>
        <textarea
          className={样式.优势输入}
          value={文本}
          onChange={(事件) => 设文本(事件.target.value)}
          maxLength={500}
          aria-label="个人优势"
        />
        <div className={样式.优势底}>
          <span className={样式.优势提示}>✕ 删除一行：长按段落</span>
          <span className={`${样式.优势计数} 等宽数字`}>{文本.length} / 500</span>
        </div>
      </div>

      {/* 指向「工作经历」页的专业技能区块。这里只指路、不再复制一套标签编辑器：
          一是技能只该有一个写入口，二是本屏答案存在内存里，中途跳走会全丢。
          技能必须是标签而不是这段自由文本（标注 13:18 指路小字删）。 */}
      {/* 与 工作经历 屏的「作品集或项目链接」区块共用同一个简历字段，任一入口修改都立即持久化。 */}
        {/* GitHub/作品集链接行按标注 2026-08-24 挪走 ——
            同一字段在「在线简历」屏的 作品集或项目链接 小节（作品集下方），
            这里不再重复出现 */}

      {/* 恢复 = 把编辑框写回真实来源：Mock 是原型种子文本；Backend 是当前轮服务端建议。
          Backend 无可用建议时（恢复 === null）整行不出现，不虚构「可恢复」的假动作 */}
      {恢复 ? (
        <div className={样式.优势工具行}>
          <button className={`${样式.优势工具主} 可点`} onClick={恢复}>
            ◈ {恢复文案}
          </button>
        </div>
      ) : null}

    </滚动区>
  );
}

// ── 搜索条（期望职位 / 工作城市 共用，可真实输入并过滤）─────────
function 搜索条({
  占位,
  值,
  改变,
}: {
  自动聚焦?: boolean;
  占位: string;
  值: string;
  改变: (文本: string) => void;
}) {
  return (
    <div className={样式.搜索条}>
      <放大镜图标 尺寸={15} 色="var(--最弱)" 线宽={2.2} />
      <input
        className={样式.搜索输入}
        placeholder={占位}
        value={值}
        onChange={(事件) => 改变(事件.target.value)}
      />
    </div>
  );
}

// ── 底部已选条（点标签 ✕ 移除）───────────────────────────────
function 已选条({ 条目们, 移除 }: { 条目们: 已选条目[]; 移除: (键: string) => void }) {
  return (
    <div className={样式.已选条}>
      <span className={样式.已选标}>已选</span>
      <div className={样式.已选标签组}>
        {条目们.map((条) => (
          <button
            key={条.键}
            className={`${样式.已选标签} 可点`}
            onClick={() => 移除(条.键)}
          >
            {条.文字} ✕
          </button>
        ))}
      </div>
    </div>
  );
}

// ── 行内录入行（自定义排除条件 / 屏蔽公司 共用）────────────────
function 行内输入({
  自动聚焦 = true,
  占位,
  值,
  改变,
  提交,
}: {
  自动聚焦?: boolean;
  占位: string;
  值: string;
  改变: (文本: string) => void;
  提交: () => void;
}) {
  return (
    <div className={样式.行内输入行}>
      <input
        className={样式.行内输入}
        placeholder={占位}
        value={值}
        onChange={(事件) => 改变(事件.target.value)}
        onKeyDown={(事件) => {
          if (事件.key === 'Enter') 提交();
        }}
        enterKeyHint="done"
        autoFocus={自动聚焦}
      />
      <button className={`${样式.行内确认} 可点`} onClick={提交}>
        添加
      </button>
    </div>
  );
}

/** 新增意向与首次引导共享原有两列排除项和常驻行内输入。
 *  提交自定义 缺省即 切换：日常新增意向仍是单一载体（网格与输入同进 已选），行为不变；
 *  首次引导传入自己的写入口，让行内输入的原话进 自定义诉求 而不是按名字当成卡片。 */
export function 排除选项({ 已选, 切换, 自动聚焦 = true, 提交自定义: 写自定义 = 切换 }: {
  已选: string[];
  切换: (项: string) => void;
  自动聚焦?: boolean;
  提交自定义?: (词: string) => void;
}) {
  const [自定义草稿, 设自定义草稿] = useState('');
  // 用户自己写的排除条件也进同一个网格，写完即视为已选
  const 全部候选 = [...排除候选, ...已选.filter((项) => !排除候选.includes(项))];

  const 提交自定义 = () => {
    const 词 = 自定义草稿.trim();
    if (词 !== '' && !已选.includes(词)) 写自定义(词);
    设自定义草稿('');
  };

  return <>
        <div className={样式.排除网格}>
          {全部候选.map((项) => {
            const 选中 = 已选.includes(项);
            return (
              <button
                key={项}
                className={`${样式.排除键} ${选中 ? 样式.排除键选中 : ''} 可点`}
                onClick={() => 切换(项)}
              >
                {/* 2026-08-24 全站选择风格统一（C1 定稿）：✓ 改由 CSS ::before 前置渲染，去掉文字尾缀避免双勾 */}
                {项}
              </button>
            );
          })}
        </div>

        {/* 标注 2026-08-20 13:06/13:18：输入框常驻，小字引导写不喜欢的工作偏好 */}
        <div className={样式.自定义标}>自定义 · 写下你不喜欢的工作偏好，AI代理筛选时帮你挡掉</div>
        <行内输入
          自动聚焦={自动聚焦}
          占位="用你自己的话写"
          值={自定义草稿}
          改变={设自定义草稿}
          提交={提交自定义}
        />

  </>;
}
