// use真人会话资料（Spec §11.2）：真人会话页头身份与资料弹层的局部读取 hook。
// 只组织本页资料读取、映射与局部失败状态：读现有 provider 状态（P5详情 /
// 候选岗位详情 / 公开企业表），不建 store、不镜像 P5 DTO。身份来源铁律：
//   · 招聘页头 = Case candidateIdentity：disclosed 且有名才显真名；anonymous 保留
//     Case 代号（candidateAlias），不显被遮蔽姓名；缺名给「候选人姓名暂未提供」。
//   · 候选页头 = Case jobDetail.publisher_profile（姓名/职务/头像）+ 发布方公司：
//     公司只认当前岗位 publisher_organization_ref → 公开企业 display_name，
//     绝不拿用人企业 organization/claim 替代发布方（猎头发布 ≠ 用人企业）。
//   · 授权 context 不在场 → 资料不可用（页头回落，不透出旧身份）。
// 本轮读取门槛（Plan Task 3）：每个授权范围进会话强制一次定向读取（操作层对已有
// 成功快照的去重短路不替代本轮读取）；本轮落地前不消费旧缓存身份，手动重读期间
// 同样退回占位；读取失败（快照带错误）不展示缓存旧身份。资料降级不阻断消息读写。
// 消费按当前 范围键 直查状态：换会话/换角色/换账号当帧即换键，迟到写入落在旧键上，
// 天然污染不到新页。职位资料只来自 Case 冻结 jobDetail（缺席 = null，弹层显示
// 不可用与局部重读，绝不拿当前岗位替代历史资料）。

import { useCallback, useEffect, useRef, useState } from 'react';
import { use应用状态 } from '../../状态/应用状态';
import { P5范围键 } from '../../状态/后端/MatchCase操作';
import { 映射P5详情 } from '../../数据/MatchCase展示映射';
import { 从P5到职位资料 } from '../../数据/详情展示映射';
import { 从P5详情取对方资料, 取姓名首字, 非空 } from '../消息列表展示/会话资料映射';
import type { 匹配分析模型 } from '../../数据/匹配解释展示映射';
import type { 职位资料信息 } from '../../组件/在谈详情/类型';
import type { P7角色, P7会话项 } from '../../数据/招聘数据源/真人会话';

export function use真人会话资料(角色: P7角色, 详情: P7会话项 | null): {
  标题: string;
  副标题: string;
  对方头像URL: string | null;
  对方首字: string;
  职位资料: 职位资料信息 | null;
  /**
   * Task 6（Spec §3.5）：招聘聊天「看在线简历」层的独立分析区输入 = 本会话 Case 同一
   * gated 明细的 match_score + match_explanation（唯一总分环 + 六维行）。与页头/纸身
   * 同一读取门槛：本轮未落地 / 失权 / 快照失败一律 null —— 绝不因解释仍在缓存而展示
   * 旧分析。候选角色恒 null（聊天层是职位资料）。
   */
  在线简历分析: 匹配分析模型 | null;
  资料状态: 'loading' | 'available' | 'unavailable';
  重读资料: () => void;
} {
  const { 后端状态, 状态, 操作 } = use应用状态();

  const 授权在场 = 详情 !== null && 详情.contextStatus === 'available' && 详情.context !== null;
  const caseId = 授权在场 && 详情 !== null ? 详情.caseId : '';
  const jobRef = 授权在场 && 详情?.context?.jobRef != null ? 详情.context.jobRef : null;
  const 范围 = caseId === '' ? '' : `${角色}:${caseId}`;

  // 本轮读取状态：范围键 + pending/ok。pending = 本轮定向读取尚未落地 —— 期间
  // 不消费任何缓存身份（含上一轮成功快照），页头回落 P7 授权标签。落地跟的是
  // 本轮强制读取的 promise 结算，不是快照形状：预置/旧的成功快照不替代本轮读取。
  const [本轮, 设本轮] = useState<{ 键: string; 态: 'pending' | 'ok' } | null>(null);
  /** 公司链本轮分相（review-r2/r3）：岗位记 pending/ok/失败；企业按「态 + 编号」绑定
   *  实际请求对象 —— 迟到结算必须同时核对轮键与企业编号，不得冒名顶替新相位。 */
  const [公司轮, 设公司轮] = useState<{
    键: string;
    岗位: 'pending' | 'ok' | '失败';
    企业: { 态: 'pending' | 'ok' | '失败' | '无需求'; 编号: string | null };
  } | null>(null);
  /** 岗位轮的在飞 promise（按轮键复用）：StrictMode 重放复用同一轮真实请求，
   *  操作层读锁让路的立即返回不会被当作新轮成功（review-r3 F1）。 */
  const 岗位轮引用 = useRef<{ 键: string } | null>(null);
  const 快照 = caseId !== '' ? 后端状态.P5详情[P5范围键.detail(角色, caseId)] : undefined;

  // 进会话（换会话/换角色）强制一次定向 P5 读取 + 候选端当前岗位读取（发布方公司
  // 坐标），不加轮询；读取失败由快照错误表达，消费端按 unavailable 降级。
  useEffect(() => {
    if (范围 === '') {
      设本轮(null);
      return;
    }
    设本轮({ 键: 范围, 态: 'pending' });
    let 有效 = true;
    void 操作.读取详情(角色, caseId, true)
      .catch(() => undefined)
      .then(() => {
        if (!有效) return; // 范围已换：迟到结算不碰新范围的本轮状态
        设本轮((旧) => (旧?.键 === 范围 && 旧.态 === 'pending' ? { 键: 范围, 态: 'ok' } : 旧));
      });
    return () => {
      有效 = false;
    };
  }, [范围, 角色, caseId, 操作]);

  // 候选端公司链 · 岗位轮（review-r2 F2 / review-r3 F1）：强制读取 settle（成功/失败
  // 分开记）之前不消费缓存里的旧岗位坐标与旧企业名；404 走操作层的删缓存+标记。
  // 同轮键重放（StrictMode 双挂）复用首轮状态与请求，不把读锁让路当成功。
  useEffect(() => {
    if (!(角色 === 'candidate' && jobRef !== null)) {
      设公司轮(null);
      岗位轮引用.current = null;
      return;
    }
    const 键 = `${角色}:${jobRef}`;
    if (岗位轮引用.current?.键 === 键) return; // 同轮重放：首轮已置 pending 并发起
    岗位轮引用.current = { 键 };
    设公司轮({ 键, 岗位: 'pending', 企业: { 态: '无需求', 编号: null } });
    void 操作.读取候选岗位详情(jobRef, true).then(
      () => {
        设公司轮((旧) => (旧?.键 === 键 && 旧.岗位 === 'pending' ? { ...旧, 岗位: 'ok' } : 旧));
      },
      () => {
        设公司轮((旧) => (旧?.键 === 键 && 旧.岗位 === 'pending' ? { ...旧, 岗位: '失败' } : 旧));
      },
    );
  }, [角色, jobRef, 操作]);

  // 候选端公司链 · 企业轮（review-r3 F1）：只在本轮岗位成功后按当时的
  // publisher_organization_ref 发起；相位带编号，回调同时核对轮键与编号 —— 旧编号的
  // 迟到成功不能把新编号的 pending/失败改写成 ok（不可用编号不落旧缓存）。
  const 发布方编号 = (() => {
    if (!(角色 === 'candidate' && jobRef !== null)) return null;
    const 岗位 = 后端状态.候选岗位详情[jobRef];
    const 编号 = 岗位?.publisher_organization_ref?.trim() ?? '';
    return 编号 === '' || 状态.不可用公开企业编号.includes(编号) ? null : 编号;
  })();
  useEffect(() => {
    if (!(角色 === 'candidate' && jobRef !== null)) return;
    const 键 = `${角色}:${jobRef}`;
    const 轮 = 公司轮;
    if (轮?.键 !== 键 || 轮.岗位 !== 'ok') return; // 本轮岗位成功前不读企业（不消费旧坐标）
    if (发布方编号 === null) {
      if (轮.企业.态 === 'pending') 设公司轮({ ...轮, 企业: { 态: '无需求', 编号: null } });
      return;
    }
    if (轮.企业.编号 === 发布方编号 && (轮.企业.态 === 'pending' || 轮.企业.态 === 'ok')) return;
    设公司轮({ ...轮, 企业: { 态: 'pending', 编号: 发布方编号 } });
    void 操作.读取公开企业(发布方编号).then(
      () => {
        设公司轮((旧) => (旧?.键 === 键 && 旧.企业.态 === 'pending' && 旧.企业.编号 === 发布方编号
          ? { ...旧, 企业: { 态: 'ok', 编号: 发布方编号 } }
          : 旧));
      },
      () => {
        设公司轮((旧) => (旧?.键 === 键 && 旧.企业.态 === 'pending' && 旧.企业.编号 === 发布方编号
          ? { ...旧, 企业: { 态: '失败', 编号: 发布方编号 } }
          : 旧));
      },
    );
  }, [公司轮, 角色, jobRef, 发布方编号, 操作]);

  // 消费：本轮就绪 + 快照成功无错且不在刷新中 + detail 在场才出身份（失败/未落地/
  // 在途刷新都不出 —— review-r2 F1：读锁让路的提前结算不得放行旧快照）。
  const 本轮就绪 = 本轮 !== null && 本轮.键 === 范围 && 本轮.态 === 'ok';
  const 明细 = 本轮就绪 && 快照 !== undefined && 快照.阶段 === '成功' && 快照.error === null
    && !快照.刷新中 && 快照.detail !== null
    ? 快照.detail
    : null;
  // 公司链消费：本轮岗位成功 + 本轮企业成功 + 表项在场；否则一律「公司暂未提供」
  const 公司键 = 角色 === 'candidate' && jobRef !== null ? `${角色}:${jobRef}` : '';
  const 公司链就绪 = 公司轮 !== null && 公司轮.键 === 公司键 && 公司轮.岗位 === 'ok'
    && 公司轮.企业.态 === 'ok' && 公司轮.企业.编号 === 发布方编号;
  const 资料状态 = !授权在场
    ? 'unavailable'
    : 明细 !== null
      ? 'available'
      : 本轮就绪 && 快照 !== undefined && 快照.阶段 === '失败'
        ? 'unavailable'
        : 'loading';

  // 页头回落值（本轮未落地/失败时沿用 P7 自己的授权标签，不是 Case 身份）
  const 回落标题 = 授权在场 && 详情?.context !== null
    ? (角色 === 'candidate' ? 详情!.context!.primaryLabel : 详情!.context!.secondaryLabel)
    : '真人会话';
  const 回落副标题 = !授权在场
    ? ''
    : 角色 === 'candidate'
      ? `${详情!.context!.secondaryLabel} · 真人会话`
      : 详情!.context!.primaryLabel;

  let 标题 = 回落标题;
  let 副标题 = 回落副标题;
  let 对方头像URL: string | null = null;
  // 契约A：首字只从真实姓名取（trim 后首个 Unicode 码点），缺名为「·」—— 不从
  // alias、公司、岗位或占位文案推导（回落窗口同样不给假首字）。
  let 对方首字 = '·';
  let 职位资料: 职位资料信息 | null = null;
  let 在线简历分析: 匹配分析模型 | null = null;

  if (明细 !== null) {
    const 发布方公司 = 公司链就绪 && 发布方编号 !== null && 状态.公开企业表[发布方编号] !== undefined
      ? 非空(状态.公开企业表[发布方编号].display_name)
      : null;
    // 与列表同一纯映射（契约A）：招聘端忽略发布企业名参数（用人企业来自 jobDetail），
    // 候选端企业走可信 publisher 链 —— 用人企业和发布企业不可混用。
    const 资料 = 从P5详情取对方资料(明细, 角色, 发布方公司);
    if (明细.role === 'recruiter') {
      if (资料.姓名 !== null) {
        标题 = 资料.姓名;
      } else if (明细.candidateIdentity.state === 'anonymous') {
        标题 = 非空(明细.context.candidateAlias) ?? '候选人';
      } else {
        标题 = '候选人姓名暂未提供';
      }
      // 投递企业 · 投递岗位：缺企业只显示岗位，两缺给既有占位（不显孤立分隔符）
      副标题 = [资料.企业, 资料.职位].filter((段): 段 is string => 段 !== null).join(' · ')
        || (资料.职位 ?? '职位信息未知');
    } else {
      标题 = 资料.姓名 ?? '招聘者姓名暂未提供';
      副标题 = `${资料.企业 ?? '公司暂未提供'} · ${资料.职位 ?? '角色暂未提供'}`;
    }
    对方头像URL = 资料.头像URL;
    对方首字 = 取姓名首字(资料.姓名);
    // 职位资料只来自 Case 冻结 jobDetail：缺席给 null（弹层出不可用 + 局部重读），
    // 不拿当前岗位替代历史资料（Spec §11.3）
    const 视图 = 映射P5详情(明细);
    职位资料 = 视图.kind === '正常' && 明细.jobDetail !== null ? 从P5到职位资料(视图) : null;
    // Task 6（Spec §3.5）：同一 gated 明细的解释 → 纸身下方独立分析区（仅招聘层消费）
    if (明细.role === 'recruiter' && 视图.kind === '正常') {
      在线简历分析 = {
        分数: 明细.matchScore,
        解释: 明细.匹配解释 ?? null,
        有限依据: [],
        上下文: '有来源',
      };
    }
  }

  const 重读资料 = useCallback(() => {
    if (caseId === '') return;
    // 手动重读同样按本轮结果判定：重读期间退回占位，本次落地后才恢复身份；
    // 候选端公司链一并复位（岗位/企业重读期间同样「公司暂未提供」）。
    设本轮({ 键: 范围, 态: 'pending' });
    void 操作.读取详情(角色, caseId, true)
      .catch(() => undefined)
      .then(() => {
        设本轮((旧) => (旧?.键 === 范围 && 旧.态 === 'pending' ? { 键: 范围, 态: 'ok' } : 旧));
      });
    if (角色 === 'candidate' && jobRef !== null) {
      const 键 = `${角色}:${jobRef}`;
      设公司轮((旧) => (旧?.键 === 键 ? { 键, 岗位: 'pending', 企业: { 态: 'pending', 编号: 发布方编号 } } : 旧));
      void 操作.读取候选岗位详情(jobRef, true).then(
        () => 设公司轮((旧) => (旧?.键 === 键 && 旧.岗位 === 'pending' ? { ...旧, 岗位: 'ok' } : 旧)),
        () => 设公司轮((旧) => (旧?.键 === 键 && 旧.岗位 === 'pending' ? { ...旧, 岗位: '失败' } : 旧)),
      );
      if (发布方编号 !== null) {
        void 操作.读取公开企业(发布方编号).then(
          () => 设公司轮((旧) => (旧?.键 === 键 && 旧.企业.态 === 'pending' && 旧.企业.编号 === 发布方编号
            ? { ...旧, 企业: { 态: 'ok', 编号: 发布方编号 } } : 旧)),
          () => 设公司轮((旧) => (旧?.键 === 键 && 旧.企业.态 === 'pending' && 旧.企业.编号 === 发布方编号
            ? { ...旧, 企业: { 态: '失败', 编号: 发布方编号 } } : 旧)),
        );
      }
    }
  }, [角色, caseId, 范围, jobRef, 发布方编号, 操作]);

  return { 标题, 副标题, 对方头像URL, 对方首字, 职位资料, 在线简历分析, 资料状态, 重读资料 };
}
