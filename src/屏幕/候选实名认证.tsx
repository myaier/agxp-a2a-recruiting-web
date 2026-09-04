// 候选实名认证 —— 设置 › 实名认证（/settings/identity-verification）。
//
// FE-IV-01：Backend 模式的候选 owner 流程 —— 读取权威 summary，按
// unverified | pending | verified | rejected 切换内容；提交 legal name、证件类型与
// 一组合法材料，pending 可刷新/取消，rejected 给闭合安全文案与全新空表单，
// verified 只读展示服务端 verified_name。
//
// 铁律：页面不直接 fetch —— HTTP 在 data source，fence/单飞/幂等恢复在 operation；
// 姓名草稿、document type 草稿与 File[] 只在本组件 state（绝不进全局状态、浏览器
// 存储、toast、日志或 analytics），页面卸载调用 重置候选实名提交意图，DOM 卸载即
// 释放 File 引用。cancelled 历史不展示；submitted 姓名/证件类型/文件名以外的材料
// 信息、reviewer note 与未知服务端字段一律不渲染。
// Mock：全局守卫刻意跳过，页面自身 replace 回候选设置页，零实名请求。

import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import 样式 from './我的功能页.module.css';
import 本屏样式 from './候选实名认证.module.css';
import { 次级页外壳, 返回栏, 滚动区, 主按钮 } from '../组件/通用';
import 确认层 from '../组件/确认层';
import { 路径 } from '../路由/路径表';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 取候选实名快照 } from '../状态/后端/候选实名操作';
import { BFF错误 } from '../数据/HTTP客户端';
import type { 候选实名证件类型, 候选实名拒绝原因 } from '../数据/招聘数据源/候选实名';

// ── 冻结的闭合词表（Plan Part B；未知 reason 在 decoder 边界已拒绝）──

export const 候选实名拒绝文案: Record<候选实名拒绝原因, string> = {
  document_unreadable: '证件内容无法清晰识别，请重新上传清楚的材料',
  identity_mismatch: '填写的信息与证件不一致，请核对后重新提交',
  document_expired: '证件已过有效期，请更换有效证件',
  unsupported_document: '暂不支持这类证件，请更换支持的政府签发证件',
  other: '本次认证未通过，请重新提交材料',
};

const 证件类型选项: Record<候选实名证件类型, string> = {
  national_id: '居民身份证',
  passport: '护照',
  other_government_id: '其他政府签发证件',
};

/** 姓名 / verified_name 的长度上限按 Unicode code point 计（Array.from，不用 UTF-16 length）。 */
export function 候选实名码点数(value: string): number {
  return Array.from(value).length;
}

const 姓名码点上限 = 200;
const 允许扩展名 = new Set(['pdf', 'png', 'jpg', 'jpeg']);
const 扩展名到MIME: Record<string, string[]> = {
  pdf: ['application/pdf'],
  png: ['image/png'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
};

function 取扩展名(名: string): string {
  const 小写 = 名.toLowerCase();
  const 点 = 小写.lastIndexOf('.');
  return 点 === -1 ? '' : 小写.slice(点 + 1);
}

/**
 * 文件组合校验（固定优先级：数量 → 扩展名 → 非空声明 MIME → 扩展名/MIME 一致性 →
 * PDF 组合），返回第一条错误或 null。部分平台给合法文件空 MIME：按扩展名继续，
 * 不因空 MIME 拒绝；不检查 file.size —— 大小由服务端裁决，前端不硬编码上限。
 */
export function 校验候选实名文件(files: File[]): string | null {
  if (files.length === 0) return '请上传证件材料';
  if (files.length > 2) return '最多上传两张图片，或一份 PDF';
  for (const 件 of files) {
    if (!允许扩展名.has(取扩展名(件.name))) return '仅支持 PDF、PNG、JPG 或 JPEG';
  }
  for (const 件 of files) {
    if (件.type !== '' && 件.type !== 'application/pdf' && 件.type !== 'image/png' && 件.type !== 'image/jpeg') {
      return '文件类型无法识别，请选择 PDF、PNG 或 JPEG';
    }
  }
  for (const 件 of files) {
    if (件.type !== '' && !扩展名到MIME[取扩展名(件.name)]?.includes(件.type)) {
      return '文件扩展名与类型不一致，请重新选择';
    }
  }
  const pdf数 = files.filter((件) => 取扩展名(件.name) === 'pdf').length;
  if (pdf数 > 0 && files.length > 1) return 'PDF 只能单独上传一份';
  return null;
}

/** 页面错误映射（Plan 冻结）：只消费闭合安全分类，绝不透传内部字段名/field path/请求体。 */
function 实名错误文案(错误: unknown, 来源: 'create' | 'cancel'): string {
  if (错误 instanceof BFF错误) {
    switch (错误.code) {
      case 'invalid_request_body':
      case 'validation_failed':
        return '提交内容不完整，请检查后重试';
      case 'media_invalid':
        return '材料格式或内容无法识别，请更换文件';
      case 'request_too_large':
        return '材料超过服务端允许的大小';
      case 'identity_verification_unavailable':
        return '实名认证暂时不可用，请稍后再试';
      case 'operation_outcome_unknown':
        return '提交结果暂未确认，请保留原材料后重试或刷新状态';
      case 'network_error':
        // 只有 create 的传输失败属于「结果未确认」（幂等键保留可重试）；cancel 的
        // 普通网络失败按通用安全文案呈现
        return 来源 === 'create'
          ? '提交结果暂未确认，请保留原材料后重试或刷新状态'
          : '请求失败，请稍后再试';
      case 'idempotency_conflict':
        return '本次提交状态冲突，请重新选择材料后重试';
      default:
        return '请求失败，请稍后再试';
    }
  }
  return '请求失败，请稍后再试';
}

/** 本地化绝对日期时间：不引入相对时间计时器与推断。 */
export function 格式化实名提交时间(submittedAt: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(submittedAt));
}

export default function 候选实名认证() {
  const { 返回 } = use导航();
  const { 数据源模式, 后端状态, 操作 } = use应用状态();

  // 草稿与 busy 只在页面 state：姓名、证件类型、File、页面错误与在飞标记
  const [证件姓名, 设证件姓名] = useState('');
  const [证件类型, 设证件类型] = useState<候选实名证件类型 | ''>('');
  const [文件, 设文件] = useState<File[]>([]);
  const [页面错误, 设页面错误] = useState<string | null>(null);
  const [提交中, 设提交中] = useState(false);
  const [取消中, 设取消中] = useState(false);
  const [刷新在飞, 设刷新在飞] = useState(false);
  const [待取消, 设待取消] = useState(false);

  const 可访问 = 数据源模式 === 'backend' && 后端状态.已登录 &&
    后端状态.主体?.last_used_role === 'candidate';

  useEffect(() => {
    if (!可访问) return;
    void 操作.加载候选实名().catch(() => undefined);
    return () => 操作.重置候选实名提交意图();
  }, [可访问, 操作]);

  const 快照 = 取候选实名快照(后端状态);
  const 摘要 = 快照.阶段 === '成功' ? 快照.摘要 : null;

  // 三个 guard 分支放在全部 hooks 之后（hooks 数量不随状态变化）：
  // Mock 由页面自身 replace 回候选设置页；recruiter 与未登录不另造第二套路由规则，
  // 交给应用现有角色/会话守卫（页面未挂载前已被拦截），这里只保证零实名请求。
  if (数据源模式 === 'mock') {
    return <Navigate to={路径.设置} replace />;
  }
  if (!可访问) return null;

  // ── 字段与文件 handler：先更新本地 state，再重置待定意图（任何变化都换新键）──

  function 改姓名(值: string) {
    设证件姓名(值);
    操作.重置候选实名提交意图();
  }

  function 改类型(值: 候选实名证件类型 | '') {
    设证件类型(值);
    操作.重置候选实名提交意图();
  }

  function 加文件(事件: React.ChangeEvent<HTMLInputElement>) {
    const 选中 = Array.from(事件.currentTarget.files ?? []);
    // 读取后立即清空 input value：重新选择同一文件依然有效
    事件.currentTarget.value = '';
    if (选中.length === 0) return;
    const 合并 = [...文件, ...选中];
    设文件(合并);
    操作.重置候选实名提交意图();
    设页面错误(校验候选实名文件(合并));
  }

  function 移除文件(序: number) {
    设文件((旧) => 旧.filter((_, 索) => 索 !== 序));
    操作.重置候选实名提交意图();
  }

  const 重试读取 = () => {
    void 操作.加载候选实名(true).catch(() => undefined);
  };

  async function 刷新状态() {
    if (刷新在飞 || 取消中) return;
    设刷新在飞(true);
    try {
      await 操作.加载候选实名(true);
    } catch {
      // operation 已把安全错误写进快照；页面不额外派生文案
    } finally {
      设刷新在飞(false);
    }
  }

  async function 确认取消() {
    设待取消(false);
    设取消中(true);
    设页面错误(null);
    try {
      await 操作.取消候选实名();
      // '已取消' | '状态已更新'：operation 已提交新摘要，页面按新快照渲染；
      // '已换代'：静默（会话已换代，状态由会话边界清理）
    } catch (错误) {
      设页面错误(实名错误文案(错误, 'cancel'));
    } finally {
      设取消中(false);
    }
  }

  async function 提交材料() {
    if (提交中) return;
    if (证件姓名.trim() === '') {
      设页面错误('请填写证件姓名');
      return;
    }
    if (候选实名码点数(证件姓名.trim()) > 姓名码点上限) {
      设页面错误(`证件姓名不超过 ${姓名码点上限} 字`);
      return;
    }
    if (证件类型 === '') {
      设页面错误('请选择证件类型');
      return;
    }
    const 文件错 = 校验候选实名文件(文件);
    if (文件错 !== null) {
      设页面错误(文件错);
      return;
    }
    设页面错误(null);
    设提交中(true);
    try {
      const 结果 = await 操作.提交候选实名({
        legalName: 证件姓名.trim(),
        documentType: 证件类型,
        evidence: 文件,
      });
      if (结果 === '已提交' || 结果 === '状态已更新') {
        设证件姓名('');
        设证件类型('');
        设文件([]);
        设页面错误(null);
      }
      // '已换代'：静默 —— 不弹「已提交」假成功，也不把错误留给新会话
    } catch (错误) {
      // 失败保留全部草稿与 File 引用，允许原材料同键重试
      设页面错误(实名错误文案(错误, 'create'));
    } finally {
      设提交中(false);
    }
  }

  const 表单 = (
    <>
      <div className={本屏样式.编辑条目}>
        <div className={本屏样式.条目标签}>证件姓名</div>
        <input
          className={本屏样式.条目输入}
          aria-label="证件姓名"
          value={证件姓名}
          placeholder="与证件一致的姓名"
          disabled={提交中}
          onChange={(事件) => 改姓名(事件.target.value)}
        />
      </div>
      <div className={本屏样式.编辑条目}>
        <div className={本屏样式.条目标签}>证件类型</div>
        <select
          className={本屏样式.条目选择}
          aria-label="证件类型"
          value={证件类型}
          disabled={提交中}
          onChange={(事件) => 改类型(事件.target.value as 候选实名证件类型 | '')}
        >
          <option value="">请选择证件类型</option>
          {Object.entries(证件类型选项).map(([值, 名]) => (
            <option key={值} value={值}>{名}</option>
          ))}
        </select>
      </div>
      <div className={本屏样式.编辑条目}>
        <div className={本屏样式.条目标签}>证件材料</div>
        <input
          type="file"
          multiple
          className={本屏样式.文件输入}
          aria-label="证件材料"
          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
          disabled={提交中}
          onChange={加文件}
        />
        {文件.map((件, 序) => (
          <div className={本屏样式.文件行} key={`${件.name}-${序}`}>
            <span className={本屏样式.文件名}>{件.name}</span>
            <button
              type="button"
              className={`${本屏样式.移除键} 可点`}
              aria-label={`移除 ${件.name}`}
              disabled={提交中}
              onClick={() => 移除文件(序)}
            >
              移除
            </button>
          </div>
        ))}
      </div>
      {页面错误 ? (
        <div className={本屏样式.错误块} role="alert">{页面错误}</div>
      ) : null}
    </>
  );

  const 权威刷新失败 = 快照.错误 !== null;

  let 内容: React.ReactNode;
  if (摘要 === null) {
    内容 = 快照.阶段 === '失败' ? (
      <div className={样式.空态} role="alert">
        <div className={样式.空态图}>◎</div>
        <div className={样式.空态标题}>实名状态暂时加载不了</div>
        <div className={样式.空态说明}>{快照.错误}</div>
        <button
          type="button"
          className={`${样式.次要键} 可点`}
          onClick={重试读取}
        >
          重试
        </button>
      </div>
    ) : (
      <div className={样式.空态} role="status">
        <div className={样式.空态图}>◎</div>
        <div className={样式.空态标题}>正在读取实名状态</div>
      </div>
    );
  } else if (摘要.status === 'verified') {
    内容 = (
      <>
        <div className={本屏样式.状态块}>
          <div className={本屏样式.状态标题}>已认证</div>
          <div className={本屏样式.状态事实}>认证姓名：<span>{摘要.verifiedName}</span></div>
          <div className={本屏样式.状态说明}>
            认证结果由平台审核发布；在线简历不受影响，也无需重复认证。
          </div>
        </div>
      </>
    );
  } else if (摘要.status === 'pending') {
    // 确认层开着时也禁用两键：层内执行键与触发键可见文字同为「取消申请」，
    // 防止非模态 dialog 下同名键重入（disabled 的触发键不再被读屏/定位命中）
    const 忙 = 刷新在飞 || 取消中 || 快照.刷新中 || 待取消;
    内容 = (
      <>
        <div className={本屏样式.状态块}>
          <div className={本屏样式.状态标题}>审核中</div>
          <div className={本屏样式.状态事实}>
            提交时间：<span>{摘要.currentRequest !== null
              ? 格式化实名提交时间(摘要.currentRequest.submittedAt)
              : null}</span>
          </div>
          <div className={本屏样式.状态说明}>
            审核结果出来后这里会更新；你可以随时刷新状态，或在审核完成前取消本次申请。
          </div>
          {忙 ? <div role="status" className={本屏样式.状态说明}>刷新中…</div> : null}
          <div className={本屏样式.按钮行}>
            <button
              type="button"
              className={`${本屏样式.次级键} 可点`}
              disabled={忙}
              onClick={() => { void 刷新状态(); }}
            >
              刷新状态
            </button>
            <button
              type="button"
              className={`${本屏样式.警示键} 可点`}
              disabled={忙}
              onClick={() => 设待取消(true)}
            >
              取消申请
            </button>
          </div>
        </div>
        {页面错误 ? (
          <div className={本屏样式.错误块} role="alert">{页面错误}</div>
        ) : null}
        {快照.错误 !== null && 页面错误 === null ? (
          <div className={本屏样式.错误块} role="alert">{快照.错误}</div>
        ) : null}
      </>
    );
  } else {
    // unverified（含取消后的 cancelled 投影 —— 不作为历史展示）与 rejected 共用表单；
    // rejected 多一条 owner-safe 拒绝原因，且不回填上次提交（owner summary 没有这些字段）
    内容 = (
      <>
        {摘要.status === 'rejected' && 摘要.currentRequest?.rejectionReason ? (
          <div className={本屏样式.状态块}>
            <div className={本屏样式.状态标题}>未通过审核</div>
            <div className={本屏样式.状态说明}>
              {候选实名拒绝文案[摘要.currentRequest.rejectionReason]}
            </div>
          </div>
        ) : (
          <div className={样式.说明条}>
            实名认证用于核验你的身份，认证结果只展示状态与认证姓名；
            证件材料仅用于本次审核，不会出现在你的在线简历里。
          </div>
        )}
        {(快照.刷新中 || 刷新在飞) ? (
          <div role="status" className={本屏样式.状态说明}>刷新中…</div>
        ) : null}
        {权威刷新失败 ? (
          <div className={本屏样式.错误块} role="alert">{快照.错误}</div>
        ) : null}
        {表单}
      </>
    );
  }

  return (
    <次级页外壳>
      <返回栏 返回={返回} 标题="实名认证" />

      <滚动区 样式覆盖={{ padding: '14px 18px 24px' }}>
        {内容}
      </滚动区>

      {摘要 !== null && 摘要.status !== 'verified' && 摘要.status !== 'pending' ? (
        <主按钮 文字="提交材料" 禁用={提交中} 按下={() => { void 提交材料(); }} />
      ) : null}

      {待取消 ? (
        <确认层
          标题="取消实名认证申请？"
          正文="取消后本次审核会终止，如需认证必须重新提交材料。"
          执行文="取消申请"
          取消={() => 设待取消(false)}
          执行={() => { void 确认取消(); }}
        />
      ) : null}
    </次级页外壳>
  );
}
