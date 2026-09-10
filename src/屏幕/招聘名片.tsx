// R9 招聘名片 · 招聘方注册第二步（名片 → 发岗）。
//
// 业务口径（2026-08-18 用户定，见 数据/类型.ts 顶部的完整说明）：匿名是单向的 ——
// 这张名片从第一轮起就对候选人可见，候选人对你则是代号，确认意向后才露真名。
//
// P1C 起分双分支，共用 组件/招聘名片/招聘名片展示（接口 B）这一份表单/预览 JSX：
//   Mock    —— 三行收笔落全局（读 企业认证 fixture，落 存企业认证，去发岗）。
//   Backend —— 姓名槽显示 verified_name ?? public_name（verified 即只读），职务落 title，
//              一次保存调 保存招聘方档案；公司槽读 current affiliation / 未认证声明，
//              多个可用关系列出待选、不自动猜。公司格是受控输入，和姓名/职务一样只在
//              按下保存 里落库（不再 blur 即落，否则按钮会抢在 blur 之前吃掉这一下）。
//              头像走原子保存：选图只生成 object URL
//              内存预览（不压 data URL、不落 存招聘头像），保存时调 替换招聘方头像，
//              成功后由 operation 用响应里的 avatar_url/revision 替换权威档案、回收预览。
//
// 本文件只剩连接：数据投影、保存事务、头像生命周期、选图校验都留在这里；
// 展示不读数据源模式/全局状态、不发请求。两栈持久化时机不同（收笔 vs 受控），
// 用 名片输入 的两种模式表达，不为共用代码统一。

import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import 招聘名片展示 from '../组件/招聘名片/招聘名片展示';
import type { 名片输入 } from '../组件/招聘名片/招聘名片展示';
import { 轻提示 } from '../组件/轻提示';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 路径 } from '../路由/路径表';
import { 压成头像 } from '../组件/头像处理';
import { 从BFF招聘身份 } from '../数据/组织映射';
import { 取后端错误文案 } from '../数据/HTTP客户端';

export default function 招聘名片() {
  const { 数据源模式 } = use应用状态();
  return 数据源模式 === 'backend' ? <后端名片 /> : <Mock名片 />;
}

// ── Backend：诚实名片（服务端事实 + 一次保存）──────────────────────

/** 头像上传的冻结边界（P1B runtime）：只收 PNG/JPEG，单文件 ≤ 10 MiB */
const 头像字节上限 = 10 * 1024 * 1024;

function 后端名片() {
  const { 跳转, 返回 } = use导航();
  const { 状态, 操作, 后端状态 } = use应用状态();
  // 注册流标记由招聘路由守卫 / 选身份写进 history.state：只有它决定保存成功后是继续去发岗，
  // 还是（应用内普通编辑）留在本屏。应用内进来的名片没有这个标记
  const 位置 = useLocation();
  const 从注册流 = Boolean((位置.state as { 从注册流?: boolean } | null)?.从注册流);
  const 身份 = 从BFF招聘身份(
    状态.招聘方档案, 状态.企业关系列表, 状态.当前企业关系编号, 状态.企业管理员申请列表,
  );
  // 显式判定，不从公司名推断：姓名槽 = verified_name ?? public_name；只有无实名才可编辑公开名
  const 显示姓名 = 身份.verifiedName ?? 身份.publicName;
  const 可编辑公开名 = 身份.verifiedName === null;
  const 可选关系 = 身份.affiliations.filter((项) => 项.selectable);

  const [公开名, 设公开名] = useState(身份.publicName);
  const [职务, 设职务] = useState(身份.title);
  // 水合晚于进屏时同步服务端权威值；保存成功后 re-hydrate 回写的是同一份内容
  useEffect(() => {
    设公开名(身份.publicName);
  }, [身份.publicName]);
  useEffect(() => {
    设职务(身份.title);
  }, [身份.title]);

  // ── 头像原子保存：只留 object URL 内存预览，保存成功才让服务端响应成为权威 ──
  const [头像文件, 设头像文件] = useState<File | null>(null);
  const [头像预览, 设头像预览] = useState<string | null>(null);
  const 预览引用 = useRef<string | null>(null);
  /** 换新预览前先回收旧的；地址为 null 即清空 */
  function 换预览(地址: string | null) {
    if (预览引用.current !== null) URL.revokeObjectURL(预览引用.current);
    预览引用.current = 地址;
    设头像预览(地址);
  }
  /** 预览收口：回收 object URL 并丢弃待上传文件（成功或作废两条路都走这里） */
  function 收口预览() {
    换预览(null);
    设头像文件(null);
  }
  // unmount 回收 object URL（内存预览不落任何全局状态）
  useEffect(() => () => {
    if (预览引用.current !== null) URL.revokeObjectURL(预览引用.current);
  }, []);
  // 账号变化：上一账号的预览与待上传文件一并作废，不把旧文件传给新账号
  const 主体标识 = 后端状态.主体?.subject_id ?? null;
  const 首次渲染 = useRef(true);
  useEffect(() => {
    if (首次渲染.current) {
      首次渲染.current = false;
      return;
    }
    if (预览引用.current !== null) 收口预览();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [主体标识]);

  // ── 公司：受控字段，权威值 = current affiliation，没有关系时回落未认证声明 ──
  // 原来这一格是 defaultValue + onBlur 收笔：全新招聘方在名片上填完公司直接按保存，
  // 按钮抢在 blur 之前吃掉这一下，声明从没落过 —— 发岗那边拿到空 company claim。
  // 现在输入即入 state，落库统一由 按下保存 这一条有序路径负责。
  const 权威公司 = 身份.currentAffiliation?.organizationName ?? 状态.未认证公司声明;
  const [公司, 设公司] = useState(权威公司);
  // 权威值变化（水合晚于进屏 / 选了任职企业）或换账号都要重新同步，不把上一份留在框里
  useEffect(() => 设公司(权威公司), [主体标识, 权威公司]);
  /** 没有 current affiliation 时，未认证声明是发岗 company claim 的唯一来源，必填 */
  const 需要公司声明 = 身份.currentAffiliation === null;

  // 单飞保存：按钮 disabled 挡住鼠标，保存锁挡住 disabled 生效前的重入（键盘连按 / 竞态）
  const [保存中, 设保存中] = useState(false);
  const 保存锁 = useRef(false);

  /** 一次保存 = 公司声明 → 档案 PATCH →（有待传头像才）头像 CAS，顺序固定。
   *  本地校验不通过一律不发请求；失败保留输入、预览与文件，用户按同一个键重试。 */
  async function 按下保存() {
    if (保存锁.current) return;
    const publicName = 公开名.trim();
    const title = 职务.trim();
    const company = 公司.trim();
    if (!publicName) {
      轻提示('请填写姓名');
      return;
    }
    if (需要公司声明 && !company) {
      // 有可用任职关系却还没选当前：公司格在这一态根本不渲染（见下方 声明 prop 条件），
      // 叫用户「填写公司名称」是死路 —— 这一态的正解是回去选当前任职企业
      轻提示(可选关系.length > 0 ? '请选择当前任职企业' : '请填写公司名称');
      return;
    }
    保存锁.current = true;
    设保存中(true);
    try {
      // 声明是账号内本地事实（不建 Organization），先落它再写档案：档案成功后
      // 发岗立刻能读到同一份 claim
      if (需要公司声明) 操作.保存未认证公司声明(company);
      const 档案 = await 操作.保存招聘方档案({ public_name: publicName, title });
      if (头像文件) {
        // 头像 If-Match 必须用 PATCH 响应里的新 revision：dispatch 后 state ref 要到
        // 下一个 React 提交才更新，此刻读 ref 拿到的是旧 revision（真实 BFF 会 409）
        await 操作.替换招聘方头像(头像文件, 档案.revision);
        收口预览();
      }
      // 注册流：档案已经在服务端了，接着去发岗；应用内普通编辑留在本屏
      if (从注册流) 跳转(路径.发布岗位, { 从注册流: true });
      else 轻提示('保存成功'); // 成功响应之后才提示
    } catch (错误) {
      // 409/503 等失败保留 file 与预览，用户检查后按同一个保存键重试
      轻提示(取后端错误文案(错误));
    } finally {
      保存锁.current = false;
      设保存中(false);
    }
  }

  /** 事件已由展示剥掉：这里只收 File，校验与暂存原样保留 */
  function 选了照片(文件: File) {
    if (文件.type !== 'image/png' && 文件.type !== 'image/jpeg') {
      轻提示('仅支持 PNG / JPEG 图片');
      return;
    }
    if (文件.size > 头像字节上限) {
      轻提示('图片不超过 10 MiB');
      return;
    }
    // 只生成内存预览：不压 data URL、不派发 存招聘头像，服务端成功前一切只是暂存
    换预览(URL.createObjectURL(文件));
    设头像文件(文件);
  }

  // Backend 不落 存招聘头像：预览优先，权威头像始终来自 招聘方档案.avatar_url
  const 头像地址 = 头像预览 ?? 身份.avatarUrl;

  return (
    <招聘名片展示
      预览={{
        // 预览姓名用权威值（verified 优先），职务/公司用本地受控值
        姓名: 显示姓名,
        职务,
        公司,
        图片: 头像地址,
        暂存图片: 头像预览 !== null,
        已认证: 身份.personalVerification.code === 'verified',
      }}
      姓名={
        可编辑公开名
          ? { 类型: '公开名', 输入: { 模式: '受控', 值: 公开名, 修改: 设公开名 } }
          : { 类型: '只读', 值: 显示姓名 }
      }
      职务={{ 模式: '受控', 值: 职务, 修改: 设职务 }}
      公司={{
        // 关系按身份投影逐项映射，当前态显式传入，不在展示里猜
        关系: 身份.affiliations.map((项) => ({
          id: 项.id,
          名称: 项.organizationName,
          角色: 项.roleLabel,
          状态: 项.statusLabel,
          可选: 项.selectable,
          当前: 身份.currentAffiliation?.id === 项.id,
        })),
        选择: (id) => void 操作.选择企业关系(id).catch((错误) => 轻提示(取后端错误文案(错误))),
        待选提示: 可选关系.length > 1 && !身份.currentAffiliation,
        // 没有任何可选关系且无 current：未认证声明是发岗 company claim 唯一来源，输入面不能缺席
        声明: 可选关系.length === 0 && 需要公司声明
          ? { 标签: '公司（未认证声明）', 输入: { 模式: '受控', 值: 公司, 修改: 设公司 } }
          : null,
      }}
      选照片={选了照片}
      保存={按下保存}
      保存文字={从注册流 ? '保存并继续' : '保存'}
      保存中={保存中}
      返回={返回}
      打开公司资料={() => 跳转(路径.公司档案编辑)}
    />
  );
}

// ── Mock：就地编辑原型（收笔落全局）───────────────────────────────

/** 可就地编辑的字段（标注 2026-08-20 13:35：认证已撤，公司也直接改） */
type 表单键 = '姓名' | '职务' | '公司';

function Mock名片() {
  const { 跳转, 返回 } = use导航();
  // 姓名与公司来自全局（企业认证切片），职务为设计稿 R9 预填值
  const { 状态, 派发 } = use应用状态();

  async function 选了照片(文件: File) {
    try {
      派发({ 型: '存招聘头像', 图: await 压成头像(文件) });
      轻提示('头像已更新');
    } catch {
      轻提示('这张图片读不出来，换一张试试');
    }
  }
  // 三行的值直接读全局企业认证，本屏不留副本。原来放在 useState 里，
  // 点「公司主页资料」跳次级页会让本屏卸载，改到一半的职务当场丢回旧值 ——
  // 与 添加意向 顶部注释里写过的同一个坑（真相要放全局，不放组件）
  const 表单值: Record<表单键, string> = {
    姓名: 状态.企业认证.姓名,
    职务: 状态.企业认证.职务 ?? '技术 VP',
    公司: 状态.企业认证.公司,
  };

  /** 收笔：失焦或回车都走这里，当场落全局（不再等底部主按钮）。空白视作没改 ——
   *  不允许把字段清空成空串，否则这一行会塌成没有值的空条目 */
  function 收笔(键: 表单键, 输入值: string) {
    const 新值 = 输入值.trim();
    if (新值 && 新值 !== 表单值[键]) {
      const 新表单 = { ...表单值, [键]: 新值 };
      派发({ 型: '存企业认证', 姓名: 新表单.姓名, 公司: 新表单.公司, 职务: 新表单.职务 });
    }
  }

  /** Mock 三行都是收笔时机：defaultValue + 失焦落全局，不用受控（持久化时机不换） */
  function 收笔输入(键: 表单键): 名片输入 {
    return { 模式: '收笔', 值: 表单值[键], 收笔: (输入值) => 收笔(键, 输入值) };
  }

  return (
    <招聘名片展示
      预览={{
        姓名: 表单值.姓名,
        职务: 表单值.职务,
        公司: 表单值.公司,
        图片: 状态.招聘头像,
        暂存图片: false,
        已认证: false,
      }}
      姓名={{ 类型: '姓名', 输入: 收笔输入('姓名') }}
      职务={收笔输入('职务')}
      公司={{
        // Mock 没有任职关系概念：关系恒空，声明输入总是提供
        关系: [],
        选择: () => {},
        待选提示: false,
        声明: { 标签: '公司', 输入: 收笔输入('公司') },
      }}
      选照片={选了照片}
      保存={() => {
        // 认证步已撤（标注 13:32/13:35）：名片就是姓名与公司的录入源，保存时落全局。
        // 逐行的改动在收笔时已经落过一次，这里再落一次是为了把「职务从没编辑过」时
        // 展示用的默认值也钉进全局 —— 否则去发岗位那边读到的职务是空的
        派发({ 型: '存企业认证', 姓名: 表单值.姓名, 公司: 表单值.公司, 职务: 表单值.职务 });
        // 「从注册流」写进 history.state：发布岗位据此在发布后走一次性的企业初始化页;
        // 应用内(岗位管理等)进来的发岗没有这个标记,发布后照旧直进主壳
        跳转(路径.发布岗位, { 从注册流: true });
      }}
      保存文字="保存 · 去发岗位"
      保存中={false}
      返回={返回}
      打开公司资料={() => 跳转(路径.公司档案编辑)}
    />
  );
}
