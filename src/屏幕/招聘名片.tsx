// R9 招聘名片 · 招聘方注册第二步（名片 → 发岗）。
//
// 业务口径（2026-08-18 用户定，见 数据/类型.ts 顶部的完整说明）：匿名是单向的 ——
// 这张名片从第一轮起就对候选人可见，候选人对你则是代号，确认意向后才露真名。
//
// P1C 起分双分支，共用 组件/招聘名片/招聘名片展示（接口 B）这一份表单/预览 JSX：
//   Mock    —— 三行收笔落全局（读 企业认证 fixture，落 存企业认证，去发岗）。
//   Backend —— 姓名槽显示 verified_name ?? public_name（verified 即只读），职务落 title，
//              一次保存调 保存招聘方档案；合同 C 起公司行唯一权威坐标是
//              招聘方档案.organization_ref：名称经 读取目录企业 恢复、改选经 公司选择层
//              回填、PATCH 带 organization_ref，不再写或读 未认证公司声明；任职关系列表
//              只作管理关系控件，affiliation id 绝不赋给自报坐标。头像走原子保存：
//              选图只生成 object URL 内存预览（不压 data URL、不落 存招聘头像），
//              保存时调 替换招聘方头像，成功后由 operation 用响应里的 avatar_url/revision
//              替换权威档案、回收预览。
//
// 本文件只剩连接：数据投影、保存事务、头像生命周期、选图校验都留在这里；
// 展示不读数据源模式/全局状态、不发请求。两栈持久化时机不同（收笔 vs 受控），
// 用 名片输入 的两种模式表达，不为共用代码统一。

import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import 招聘名片展示 from '../组件/招聘名片/招聘名片展示';
import type { 名片输入 } from '../组件/招聘名片/招聘名片展示';
import 公司选择抽屉接线 from '../组件/公司选择抽屉接线';
import { use组织查询 } from './组织查询钩子';
import { 轻提示 } from '../组件/轻提示';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 路径 } from '../路由/路径表';
import { 压成头像 } from '../组件/头像处理';
import { 从BFF招聘身份 } from '../数据/组织映射';
import { 取后端错误文案 } from '../数据/HTTP客户端';
import { Onboarding422提示 } from '../状态/后端/Onboarding操作';
import type { BFF组织搜索项 } from '../数据/BFF契约';

export default function 招聘名片() {
  const { 数据源模式 } = use应用状态();
  return 数据源模式 === 'backend' ? <后端名片 /> : <Mock名片 />;
}

// ── Backend：诚实名片（服务端事实 + 一次保存）──────────────────────

/** 头像上传的冻结边界（P1B runtime）：只收 PNG/JPEG，单文件 ≤ 10 MiB */
const 头像字节上限 = 10 * 1024 * 1024;

function 后端名片() {
  const { 跳转, 返回 } = use导航();
  const { 状态, 操作, 后端状态, 数据源模式 } = use应用状态();
  // 注册流标记由招聘路由守卫 / 选身份写进 history.state：只有它决定保存成功后是继续去发岗，
  // 还是（应用内普通编辑）留在本屏。应用内进来的名片没有这个标记
  const 位置 = useLocation();
  const 从注册流 = Boolean((位置.state as { 从注册流?: boolean } | null)?.从注册流);
  const 身份 = 从BFF招聘身份(
    状态.招聘方档案, 状态.企业关系列表, 状态.当前企业关系编号, 状态.企业管理员申请列表,
  );
  // 显式判定，不从公司名推断：只有无实名才可编辑公开名
  const 可编辑公开名 = 身份.verifiedName === null;
  const 可选关系 = 身份.affiliations.filter((项) => 项.selectable);

  const [公开名, 设公开名] = useState(身份.publicName);
  const [职务, 设职务] = useState(身份.title);
  // 预览姓名：无实名（可编辑）时跟随公开名草稿即时预览（含清空成空串）；有实名仍是权威只读实名
  const 显示姓名 = 身份.verifiedName === null ? 公开名 : 身份.verifiedName;
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
    // 换账号：上一账号的自报草稿一并作废，读取 effect 经 读取重试 强制按新档案重跑
    //（两账号坐标相同时也要重读/复位，绝不把上一账号的公司名留给新账号）
    已改选.current = false;
    设读取重试((旧) => 旧 + 1);
    if (预览引用.current !== null) 收口预览();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [主体标识]);

  // ── 合同 C：自报公司 = 招聘方档案.organization_ref ──
  // 唯一权威坐标；名称只在初次进入 / 刷新 / 坐标变化时经 读取目录企业 恢复，
  // 绝不回退任职关系名或 未认证公司声明；用户改选草稿优先于迟到读取。
  const 档案坐标 = 状态.招聘方档案?.organization_ref ?? null;
  const [自报, 设自报] = useState<{ id: string; 名称: string } | null>(null);
  const [自报态, 设自报态] = useState<'加载中' | '错误' | '就绪'>('加载中');
  // 用户经抽屉改选后置位：此后的迟到/重读响应一律不覆盖草稿（含 409 重读）
  const 已改选 = useRef(false);
  const 读取代际 = useRef(0);
  const [读取重试, 设读取重试] = useState(0);
  useEffect(() => {
    const 本次 = ++读取代际.current;
    if (已改选.current) return;
    if (档案坐标 === null) {
      设自报(null);
      设自报态('就绪');
      return;
    }
    设自报(null);
    设自报态('加载中');
    操作.读取目录企业(档案坐标)
      .then((项) => {
        if (读取代际.current !== 本次 || 已改选.current) return;
        设自报({ id: 项.organization_id, 名称: 项.display_name });
        设自报态('就绪');
      })
      .catch(() => {
        if (读取代际.current !== 本次 || 已改选.current) return;
        设自报(null);
        设自报态('错误');
      });
  }, [档案坐标, 读取重试, 操作]);

  // ── 公司选择抽屉（合同 B）：搜索/创建走操作层目录三操作，结果 ID 只经这里回填 ──
  const [抽屉开, 设抽屉开] = useState(false);
  const 查询 = use组织查询({
    搜索: 操作.搜索组织,
    创建: 操作.创建组织,
    作用域键: JSON.stringify([数据源模式, 后端状态.主体?.subject_id ?? null, '招聘名片']),
  });
  /** 抽屉回填：草稿置位 + 关抽屉 + 作废（合同 B：父页面关闭时先作废再隐藏） */
  function 回填公司(项: BFF组织搜索项) {
    已改选.current = true;
    设自报({ id: 项.organization_id, 名称: 项.display_name });
    查询.作废();
    设抽屉开(false);
  }
  async function 添加公司(名称: string) {
    const 项 = await 查询.添加(名称);
    if (项) 回填公司(项);
  }
  function 关闭抽屉() {
    // 取消/Escape/遮罩：草稿不变，作废在飞请求后隐藏
    查询.作废();
    设抽屉开(false);
  }

  // 单飞保存：按钮 disabled 挡住鼠标，保存锁挡住 disabled 生效前的重入（键盘连按 / 竞态）
  const [保存中, 设保存中] = useState(false);
  const 保存锁 = useRef(false);

  /** 一次保存 = 档案 PATCH（带 organization_ref）→（有待传头像才）头像 CAS，顺序固定。
   *  本地校验不通过一律不发请求；失败保留输入、预览与文件，用户按同一个键重试。 */
  async function 按下保存() {
    if (保存锁.current) return;
    const publicName = 公开名.trim();
    const title = 职务.trim();
    // 必填公司只判断所选 ID：草稿优先，其次档案坐标（读取失败时仍按已存坐标提交）
    const organizationRef = 自报?.id ?? 档案坐标;
    if (!publicName) {
      轻提示('请填写姓名');
      return;
    }
    if (organizationRef === null) {
      轻提示('请选择公司');
      return;
    }
    保存锁.current = true;
    设保存中(true);
    // 顺序保存链（PATCH → 头像）共用发起保存时的 owner：PATCH 成功后主体若已切换，
    // 头像操作核对预期主体不符即中止，不把本闭包捕获的旧文件写进新账号档案
    const 发起主体 = 后端状态.主体?.subject_id ?? null;
    try {
      const 档案 = await 操作.保存招聘方档案({ public_name: publicName, title, organization_ref: organizationRef });
      if (头像文件) {
        // 头像 If-Match 必须用 PATCH 响应里的新 revision：dispatch 后 state ref 要到
        // 下一个 React 提交才更新，此刻读 ref 拿到的是旧 revision（真实 BFF 会 409）
        await 操作.替换招聘方头像(头像文件, 档案.revision, 发起主体);
        收口预览();
      }
      // 注册流：本次 profile 与选定头像都写成功后、去发岗前调用 recruiter complete
      // （stg 契约对齐 2026-09-14，Spec §5）。完成失败留在本屏可重试：名片已建、头像
      // 已传的事实不回滚（不重复创建名片 / 不重传已成功头像），重试以同一保存链为主。
      // 应用内普通编辑不强制 complete，也不跳发岗。
      if (从注册流) {
        await 操作.完成角色Onboarding('recruiter');
        跳转(路径.发布岗位, { 从注册流: true });
      } else 轻提示('保存成功'); // 成功响应之后才提示
    } catch (错误) {
      // 409/503 等失败保留 file 与预览，用户检查后按同一个保存键重试；
      // complete 的 422 按冻结 path 给可行动提示，其余交一般文案
      轻提示(Onboarding422提示(错误) ?? 取后端错误文案(错误));
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
    <>
      <招聘名片展示
        预览={{
          // 预览姓名：无实名时跟随草稿（即时预览），实名时权威只读；职务受控，公司用待保存选择名
          姓名: 显示姓名,
          职务,
          公司: 自报?.名称 ?? '',
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
          // 管理关系按身份投影逐项映射，只服务任职/管理；自报公司行独立走 organization_ref
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
          自报: {
            名称: 自报?.名称 ?? null,
            加载中: 自报态 === '加载中',
            读取错误: 自报态 === '错误',
            重试: () => 设读取重试((旧) => 旧 + 1),
            按下: () => 设抽屉开(true),
          },
          声明: null,
        }}
        选照片={选了照片}
        保存={按下保存}
        保存文字={从注册流 ? '保存并继续' : '保存'}
        保存中={保存中}
        返回={返回}
        打开公司资料={() => 跳转(路径.公司档案编辑)}
      />
      {抽屉开 ? (
        <公司选择抽屉接线
          查询={查询}
          选中键={自报?.id ?? null}
          选定={(键) => {
            // 选中 ID 只来自父页面：在本实例结果里定位完整项再回填
            const 项 = 查询.结果.find((候选) => 候选.organization_id === 键);
            if (项) 回填公司(项);
          }}
          关闭={关闭抽屉}
          添加={(名称) => void 添加公司(名称)}
        />
      ) : null}
    </>
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
        // Mock 没有任职关系概念：关系恒空，声明输入总是提供；自报选择行是 Backend 专用
        关系: [],
        选择: () => {},
        待选提示: false,
        自报: null,
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
