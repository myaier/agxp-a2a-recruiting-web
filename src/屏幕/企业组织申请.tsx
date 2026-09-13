// 企业组织申请 · 管理员申请次级页（P1C Task 3）。
// 填写组织事实（legal / registry / explanation / domains）+ 1–5 份证明材料，
// multipart 提交 创建企业管理员申请(metadata, files)。File 只留组件本地 state，
// 不转 data URL、不落全局。长度/数量边界按 P1B 冻结值（与本表单同一套，
// BFF {path,reason} 校验错误也映射回同一表单槽，不自造第二套限制）。
// 合同 C（2026-09-13）：
//   · metadata 精确为 {organization_id, legal_name, registry_key, explanation, domains}，
//     display_name 从请求删除；展示名读选中企业（经 读取目录企业 验证）。
//   · 目标企业 = URL query 参数优先（公开 ID，不是邀请 token），其次档案
//     organization_ref，无值则空；读取校验成功前不允许申请；刷新保留 URL 目标，
//     旧响应经代际栅栏丢弃不覆盖新目标；更换选择用 replace 写参数并清空上一企业的
//     表单与证据，取消选择不动原表单。
//   · domains 允许空数组；名称长度按 Unicode 码点计。
//   · 申请列表按所选 organization_id 过滤；取消始终用实际 request_id/revision；
//     未提交的其他企业选择不影响已有请求。
// 恢复路径：verification_request_conflict → 重读既有申请不重复 POST；pending 取消按
// 服务端 revision（operation 内部取快照），409 保留现有状态并重读；POST 成功而列表
// 刷新失败时保留返回申请并给重试读取。
// 只读边界：本屏只展示申请的服务端状态，不存在审核员 / 内部备注 / 私有材料入口。

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import 样式 from './企业组织申请.module.css';
import { 次级页外壳, 返回栏, 页面大标题, 滚动区, 主按钮 } from '../组件/通用';
import 公司选择抽屉接线 from '../组件/公司选择抽屉接线';
import { 轻提示 } from '../组件/轻提示';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { use组织查询 } from './组织查询钩子';
import { 管理员申请状态文案 } from '../数据/组织映射';
import { BFF错误, 取后端错误文案, type BFF字段错误 } from '../数据/HTTP客户端';
import type { BFF企业管理员申请元数据, BFF组织搜索项 } from '../数据/BFF契约';

// ── P1B 冻结边界（与本表单校验共用，不另立一套）──

const 公司全称上限 = 200;
const 注册号上限 = 200;
const 说明上限 = 4000;
const 域名数上限 = 20;
const 单域名上限 = 253;
const 证据份数上限 = 5;
const 证据字节上限 = 10 * 1024 * 1024;
const 允许证据类型 = ['image/png', 'image/jpeg', 'application/pdf'];

/** 槽位键：表单槽 ↔ BFF path 映射的公共词表（合同 C：display_name 不再是可写字段） */
type 槽位 = 'legal_name' | 'registry_key' | 'explanation' | 'domains' | 'evidence';

/** 冻结边界的客户端校验：超限/缺失都在这里拦下，不触发 operation。
 *  名称长度按 Unicode 码点计（Array.from），与 BFF 侧口径一致。 */
function 校验申请(草稿: BFF企业管理员申请元数据, evidence: File[]): Partial<Record<槽位, string>> {
  const 错: Partial<Record<槽位, string>> = {};
  if (草稿.legal_name.trim() === '') 错.legal_name = '请填写公司全称';
  else if (Array.from(草稿.legal_name.trim()).length > 公司全称上限) 错.legal_name = `公司全称不超过 ${公司全称上限} 字`;
  if (草稿.registry_key.trim() === '') 错.registry_key = '请填写工商注册号';
  else if (Array.from(草稿.registry_key.trim()).length > 注册号上限) 错.registry_key = `工商注册号不超过 ${注册号上限} 字`;
  if (草稿.explanation.trim() === '') 错.explanation = '请填写申请说明';
  else if (Array.from(草稿.explanation.trim()).length > 说明上限) 错.explanation = `申请说明不超过 ${说明上限} 字`;
  // 合同 C：域名允许空数组，遵循后端而非旧前端强制至少一个的校验
  if (草稿.domains.length > 域名数上限) 错.domains = `企业域名最多 ${域名数上限} 个`;
  else if (草稿.domains.some((域) => Array.from(域).length > 单域名上限)) 错.domains = `单个域名不超过 ${单域名上限} 字`;
  if (evidence.length < 1) 错.evidence = '请至少上传 1 份证明材料';
  else if (evidence.length > 证据份数上限) 错.evidence = `证明材料最多 ${证据份数上限} 份`;
  else if (evidence.some((件) => !允许证据类型.includes(件.type))) 错.evidence = '证明材料只能是 PNG/JPEG/PDF';
  else if (evidence.some((件) => 件.size > 证据字节上限)) 错.evidence = `单份证明材料不超过 ${证据字节上限 / (1024 * 1024)} MiB`;
  return 错;
}

/** BFF {path,reason} → 同一表单槽；domains[i]/evidence[i] 这类数组路径归到父槽位 */
function 映射字段错误(fieldErrors: BFF字段错误[]): Partial<Record<槽位, string>> {
  const 错: Partial<Record<槽位, string>> = {};
  for (const 条 of fieldErrors) {
    if (条.path === 'legal_name' || 条.path === 'registry_key' ||
        条.path === 'explanation' || 条.path === 'domains' || 条.path === 'evidence') {
      错[条.path as 槽位] = 条.reason;
    } else if (条.path.startsWith('domains[')) 错.domains = 条.reason;
    else if (条.path.startsWith('evidence[')) 错.evidence = 条.reason;
  }
  return 错;
}

/** 企业域名输入：逗号 / 顿号 / 空白分隔，逐项去空 */
function 解析域名(输入: string): string[] {
  return 输入.split(/[,，、\s]+/).map((项) => 项.trim()).filter(Boolean);
}

/** 证明材料选择时的即时校验（不合规的选择不进 state） */
function 校验证据(files: File[]): string | null {
  if (files.length > 证据份数上限) return `证明材料最多 ${证据份数上限} 份`;
  if (files.some((件) => !允许证据类型.includes(件.type))) return '证明材料只能是 PNG/JPEG/PDF';
  if (files.some((件) => 件.size > 证据字节上限)) return `单份证明材料不超过 ${证据字节上限 / (1024 * 1024)} MiB`;
  return null;
}

export default function 企业组织申请() {
  const { 返回 } = use导航();
  const { 状态, 操作, 数据源模式 } = use应用状态();
  // 合同 C：目标企业 = URL query 参数优先（公开 ID），其次档案自报企业，无值则空
  const [查询参数, 设查询参数] = useSearchParams();
  const 参数目标 = 查询参数.get('organization_id');
  const 档案坐标 = 状态.招聘方档案?.organization_ref ?? null;
  const 请求目标 = 参数目标 !== null && 参数目标 !== '' ? 参数目标 : 档案坐标;

  // ── 目标企业的读取校验：成功前不允许申请；旧响应经代际栅栏丢弃，不覆盖新目标 ──
  const [目标, 设目标] = useState<{ id: string; 名称: string } | null>(null);
  const [目标态, 设目标态] = useState<'空' | '加载中' | '错误' | '不存在' | '就绪'>('空');
  const [读取重试, 设读取重试] = useState(0);
  const 读取代际 = useRef(0);
  useEffect(() => {
    const 本次 = ++读取代际.current;
    if (请求目标 === null) {
      设目标(null);
      设目标态('空');
      return;
    }
    设目标(null);
    设目标态('加载中');
    操作.读取目录企业(请求目标)
      .then((项) => {
        if (读取代际.current !== 本次) return; // 旧目标迟到：不覆盖已确认的新目标
        设目标({ id: 项.organization_id, 名称: 项.display_name });
        设目标态('就绪');
      })
      .catch((错误) => {
        if (读取代际.current !== 本次) return;
        设目标(null);
        设目标态(错误 instanceof BFF错误 && 错误.status === 404 ? '不存在' : '错误');
      });
  }, [请求目标, 读取重试, 操作]);

  const [公司全称, 设公司全称] = useState('');
  const [注册号, 设注册号] = useState('');
  const [说明, 设说明] = useState('');
  const [域名输入, 设域名输入] = useState('');
  // File 只存在于这个组件本地 state；提交成功即清引用
  const [证据, 设证据] = useState<File[]>([]);
  const [槽位错误, 设槽位错误] = useState<Partial<Record<槽位, string>>>({});
  const [提示, 设提示] = useState<string | null>(null);
  const [提交中, 设提交中] = useState(false);
  // POST 成功而后续列表刷新失败：返回申请已由 operation 保留在列表里，这里给重试读取
  const [刷新失败, 设刷新失败] = useState(false);

  /** 合同 C：确认更换目标企业 → 清空上一企业的表单与证据；取消选择不动原表单 */
  function 清空企业材料() {
    设公司全称('');
    设注册号('');
    设说明('');
    设域名输入('');
    设证据([]);
    设槽位错误({});
    设提示(null);
    设刷新失败(false);
  }

  // ── 目标选择抽屉（合同 B）：搜索/创建走操作层目录三操作 ──
  const [抽屉开, 设抽屉开] = useState(false);
  const 查询 = use组织查询({
    搜索: 操作.搜索组织,
    创建: 操作.创建组织,
    作用域键: JSON.stringify(['企业组织申请', 数据源模式]),
  });
  /** 换企业：URL replace 写公开 ID + 清空上一企业的材料（取消选择不走这里） */
  function 确认目标(项: BFF组织搜索项) {
    查询.作废();
    设抽屉开(false);
    设查询参数({ organization_id: 项.organization_id }, { replace: true });
    清空企业材料();
  }
  function 选定目标(键: string) {
    // 选中 ID 只来自父页面：在本实例结果里定位完整项再回填
    const 项 = 查询.结果.find((候选) => 候选.organization_id === 键);
    if (项) 确认目标(项);
  }
  async function 添加目标(名称: string) {
    const 项 = await 查询.添加(名称);
    if (项) 确认目标(项);
  }
  function 关闭抽屉() {
    // 取消/Escape/遮罩：原表单与证据不动，作废在飞请求后隐藏
    查询.作废();
    设抽屉开(false);
  }

  // 申请列表按所选 organization_id 过滤；未提交的其他企业选择不影响已有请求
  const 本企业申请 = (状态.企业管理员申请列表 ?? [])
    .filter((申请) => 申请.organization_id === (目标?.id ?? null));
  const 最新申请 = 本企业申请[0] ?? null;

  function 选了证据(事件: React.ChangeEvent<HTMLInputElement>) {
    const 文件 = Array.from(事件.target.files ?? []);
    if (文件.length === 0) return;
    const 错 = 校验证据(文件);
    if (错 !== null) {
      设槽位错误((旧) => ({ ...旧, evidence: 错 }));
      return;
    }
    设槽位错误((旧) => ({ ...旧, evidence: undefined }));
    设证据(文件);
  }

  const 提交申请 = async () => {
    // 读取校验成功前不允许申请：目标未就绪一律不发 multipart
    if (!目标) {
      轻提示('请先选择企业');
      return;
    }
    const 草稿: BFF企业管理员申请元数据 = {
      organization_id: 目标.id,
      legal_name: 公司全称.trim(),
      registry_key: 注册号.trim(),
      explanation: 说明.trim(),
      domains: 解析域名(域名输入),
    };
    const 错 = 校验申请(草稿, 证据);
    if (Object.keys(错).length > 0) {
      设槽位错误(错);
      return;
    }
    设槽位错误({});
    设提示(null);
    设提交中(true);
    try {
      const { 列表刷新失败 } = await 操作.创建企业管理员申请(草稿, 证据);
      设证据([]);
      设刷新失败(列表刷新失败);
    } catch (error) {
      if (error instanceof BFF错误 && error.code === 'verification_request_conflict') {
        await 操作.读取企业管理员申请();
        设提示('已存在进行中的申请，已载入最新状态');
        return;
      }
      throw error;
    } finally {
      设提交中(false);
    }
  };

  async function 按下提交() {
    try {
      await 提交申请();
    } catch (error) {
      if (error instanceof BFF错误 && error.fieldErrors.length > 0) {
        设槽位错误(映射字段错误(error.fieldErrors));
        return;
      }
      轻提示(取后端错误文案(error));
    }
  }

  async function 重试读取() {
    try {
      await 操作.读取企业管理员申请();
      设刷新失败(false);
    } catch (error) {
      轻提示(取后端错误文案(error));
    }
  }

  const 取消申请 = async () => {
    if (!最新申请) return;
    try {
      await 操作.取消企业管理员申请(最新申请.request_id);
    } catch (error) {
      if (error instanceof BFF错误 && error.status === 409) {
        // 快照 revision 过期：保留现有状态，按服务端重读
        await 操作.读取企业管理员申请();
        return;
      }
      throw error;
    }
  };

  async function 按下取消() {
    try {
      await 取消申请();
    } catch (error) {
      轻提示(取后端错误文案(error));
    }
  }

  return (
    <次级页外壳>
      <返回栏 返回={返回} />

      <页面大标题 标题="申请企业管理员" 说明="组织信息与证明材料将交由人工审核" />

      <滚动区 样式覆盖={{ padding: '0 22px 8px' }}>
        <div className={样式.表单区}>
          {/* ── 认证企业：申请绑定这个目录组织；经读取验证前提交不可用 ── */}
          <div className={样式.编辑条目}>
            <div className={样式.条目标签}>认证企业</div>
            {目标态 === '加载中' ? (
              <div className={样式.条目输入}>企业信息读取中…</div>
            ) : 目标态 === '错误' ? (
              <div className={样式.条目输入} style={{ color: 'var(--次要浅)' }}>企业信息读取失败</div>
            ) : 目标态 === '不存在' ? (
              <div className={样式.条目输入} style={{ color: 'var(--次要浅)' }}>目标企业不存在</div>
            ) : (
              <div className={样式.条目输入}>{目标?.名称 ?? '未选择企业'}</div>
            )}
            <div className={样式.条目输入行}>
              <button
                type="button"
                className={`${样式.取消键} 可点`}
                disabled={提交中}
                onClick={() => 设抽屉开(true)}
              >
                {目标 ? '更换企业' : '选择企业'}
              </button>
              {目标态 === '错误' ? (
                <button type="button" className={`${样式.取消键} 可点`} onClick={() => 设读取重试((旧) => 旧 + 1)}>
                  重试
                </button>
              ) : null}
            </div>
          </div>

          <div className={样式.编辑条目}>
            <div className={样式.条目标签}>公司全称（营业执照）</div>
            <input
              className={样式.条目输入}
              aria-label="公司全称"
              value={公司全称}
              placeholder="如：上海云衢科技有限公司"
              onChange={(事件) => 设公司全称(事件.target.value)}
            />
            {槽位错误.legal_name ? <div className={样式.错误行}>{槽位错误.legal_name}</div> : null}
          </div>

          <div className={样式.编辑条目}>
            <div className={样式.条目标签}>工商注册号</div>
            <input
              className={样式.条目输入}
              aria-label="工商注册号"
              value={注册号}
              placeholder="统一社会信用代码"
              onChange={(事件) => 设注册号(事件.target.value)}
            />
            {槽位错误.registry_key ? <div className={样式.错误行}>{槽位错误.registry_key}</div> : null}
          </div>

          <div className={样式.编辑条目}>
            <div className={样式.条目标签}>企业域名</div>
            <input
              className={样式.条目输入}
              aria-label="企业域名"
              value={域名输入}
              placeholder="多个用逗号分隔，允许留空，如 yunqu.example"
              onChange={(事件) => 设域名输入(事件.target.value)}
            />
            {槽位错误.domains ? <div className={样式.错误行}>{槽位错误.domains}</div> : null}
          </div>

          <div className={样式.编辑条目}>
            <div className={样式.条目标签}>申请说明</div>
            <textarea
              className={样式.多行输入}
              aria-label="申请说明"
              value={说明}
              placeholder="说明你的职务与申请理由（不超过 4000 字）"
              onChange={(事件) => 设说明(事件.target.value)}
            />
            {槽位错误.explanation ? <div className={样式.错误行}>{槽位错误.explanation}</div> : null}
          </div>

          <div className={样式.编辑条目}>
            <div className={样式.条目标签}>证明材料（1–5 份，PNG / JPEG / PDF，每份 ≤ 10 MiB）</div>
            <input
              type="file"
              multiple
              aria-label="证明材料"
              // 不加 accept：类型/大小由 校验证据 统一裁决（accept 会让浏览器隐藏不合规文件，
              // 但用户仍可选「所有文件」，而且 accept 语义与冻结清单不完全等价）
              // 点击时清 value：真实浏览器里允许重选同一份文件；不在 onChange 里清 ——
              // 那会在读到 files 之前破坏 input.files（也踩 user-event 的 files 模拟）
              onClick={(事件) => {
                事件.currentTarget.value = '';
              }}
              onChange={选了证据}
            />
            {证据.map((件) => (
              <div key={件.name} className={样式.文件行}>
                {件.name}
              </div>
            ))}
            {槽位错误.evidence ? <div className={样式.错误行}>{槽位错误.evidence}</div> : null}
          </div>

          {/* ── 最新申请：只按服务端事实展示状态；pending 才给取消。
              已提交申请绑定所选企业，新的待申请选择不改写它 ── */}
          {最新申请 ? (
            <div className={样式.状态行}>
              <span className={样式.状态文字}>当前申请：{管理员申请状态文案[最新申请.status]}</span>
              {最新申请.status === 'pending' ? (
                <button className={`${样式.取消键} 可点`} onClick={按下取消}>
                  取消申请
                </button>
              ) : null}
            </div>
          ) : null}

          {刷新失败 ? (
            <div className={样式.状态行}>
              <span className={样式.状态文字}>申请状态刷新失败</span>
              <button className={`${样式.取消键} 可点`} onClick={() => void 重试读取()}>
                重试读取
              </button>
            </div>
          ) : null}

          {提示 ? <div className={样式.提示行}>{提示}</div> : null}
        </div>
      </滚动区>

      <主按钮
        文字="提交申请"
        禁用={提交中 || 目标 === null}
        按下={按下提交}
      />

      {抽屉开 ? (
        <公司选择抽屉接线
          查询={查询}
          选中键={目标?.id ?? null}
          选定={选定目标}
          关闭={关闭抽屉}
          添加={(名称) => void 添加目标(名称)}
        />
      ) : null}
    </次级页外壳>
  );
}