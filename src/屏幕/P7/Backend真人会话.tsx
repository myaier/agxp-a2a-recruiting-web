// P7 Backend 真人会话（双角色共用）：只读 后端状态 的 P7 详情/消息快照与真人会话
// 操作，绝不 import Mock 联系人、Mock 消息 fixture 或写死会话剧情。
// 铁律（spec §5.3/§8.3 与已准入 P7 冻结契约）：
//   · 直达刷新：参数路由进屏先注册可见会话再并行读详情 + 最新消息页
//    （读取真人会话），卸载注销；绝不读收件箱记忆填上下文。
//   · 消息只按服务端时间序渲染：user_text 以 senderRole === 当前角色 定左右气泡；
//     conversation_started 是固定中性系统行，不计未读、不做 read target。
//   · read-through：只有真实渲染到的最新 decimal user_text ID 可提交
//    （提交真人已读 内部按 string 去重，绝不转 number）。
//   · 发送不乐观追加：POST 成功或对账确认后清草稿；unknown 分支显示
//     「重新确认发送结果 /（可放弃时）放弃本次发送」—— 放弃只清不可变待定正文
//     对应的意图键，保留当前编辑中的草稿；in_progress 只允许稍后同键重试。
//   · 上下文动作遵守后端事实边界：候选端「看职位」只在 context available 且
//     job_ref 在场时进入既有权威岗位详情路由（不猜岗位）；招聘端「看简历」只在
//     context available 且 resume_ref 在场时按 case_id 调 读取简历PDF('recruiter',
//     caseId)（绝不把 resume_ref 拼成 URL），租约只活在弹层生命周期；
//     context 不可用只降级展示并保留「重新加载会话信息」，消息仍可读写。
//     Backend 不渲染电话/微信 —— P7 context 不提供这些字段，绝不显示 Mock 值。

import { useEffect, useMemo, useRef, useState } from 'react';
import 共用样式 from '../直聊会话.module.css';
import 真人会话样式 from '../真人会话.module.css';
import 真人会话操作栏 from '../真人会话操作栏';
import 原始PDF层 from '../../组件/原始PDF层';
import { 次级页外壳, 返回栏, 滚动区, 真输入条 } from '../../组件/通用';
import { 公文包图标, 简历图标 } from '../../组件/图标';
import { 轻提示 } from '../../组件/轻提示';
import { use导航 } from '../../路由/导航钩子';
import { 路径 } from '../../路由/路径表';
import { use应用状态 } from '../../状态/应用状态';
import { P7范围键, 取P7错误文案 } from '../../状态/后端/真人会话操作';
import type { P7角色, P7消息 } from '../../数据/招聘数据源/真人会话';
import type { P7发送结果, P7分页快照, P7详情快照 } from '../../状态/后端/类型';
import type { PDF对象租约 } from '../../数据/PDF对象租约';

/** conversation_started 的固定中性系统行文案（spec §5.3，不伪造用户或未读）。 */
const 系统行文案 = '双方已确认意向，现在可以直接沟通';
/** 快照缺席时的稳定空列表引用（useMemo 依赖 items 引用稳定，绝不原地修改快照）。 */
const 空消息列表: P7消息[] = [];
const 读入中文案 = '正在读入会话…';
const 超长提示 = '消息太长，请缩短后再发送';
/** 发送正文 trim 后的 Unicode code point 上限（与操作/数据源同一规则）。 */
const 正文码点上限 = 2000;

/** RFC3339 → 「HH:mm」（UTC 定长截取，纯展示格式化）。 */
function 取短时间(iso: string): string {
  return iso.slice(11, 16);
}

/** Backend 访问无参 Mock 路由时的 fail-closed 视图：不读默认 J-01/A-01。 */
export function 会话不可用() {
  const { 返回 } = use导航();
  return (
    <次级页外壳 白底>
      <返回栏 返回={返回} 标题="会话不可用" 居中标题 />
      <滚动区>
        <div style={{ padding: 24, color: 'var(--弱化)', fontSize: 13 }}>
          这段会话不存在或已不可访问。
        </div>
      </滚动区>
    </次级页外壳>
  );
}

export default function Backend真人会话({ role, conversationId }: { role: P7角色; conversationId: string }) {
  const { 返回, 跳转 } = use导航();
  const { 后端状态, 操作 } = use应用状态();
  const 详情键 = P7范围键.详情(role, conversationId);
  const 消息键 = P7范围键.消息(role, conversationId);
  const 详情快照: P7详情快照 | undefined = 后端状态.P7会话详情[详情键];
  const 消息快照: P7分页快照<P7消息> | undefined = 后端状态.P7消息页[消息键];
  const 详情 = 详情快照?.detail ?? null;
  const messages = 消息快照?.items ?? 空消息列表;

  // 进屏 / 换会话：先注册可见会话再并行读详情 + 最新消息页；离开本屏注销。
  useEffect(() => {
    操作.设置P7会话范围(role, conversationId);
    void 操作.读取真人会话(role, conversationId).catch(() => undefined);
    return () => 操作.设置P7会话范围(role, null);
  }, [role, conversationId, 操作]);

  // read-through：只认当前实际渲染的最后一个 user_text ID（system 行永不提交；
  // 操作层按上次成功 / 在飞 / 终局拒绝去重，重复渲染零请求）。
  const 最新文本ID = useMemo(() => {
    for (let 下标 = messages.length - 1; 下标 >= 0; 下标 -= 1) {
      const 行 = messages[下标];
      if (行.kind === 'user_text') return 行.messageId;
    }
    return null;
  }, [messages]);
  useEffect(() => {
    if (最新文本ID === null) return;
    void 操作.提交真人已读(role, conversationId, 最新文本ID).catch(() => undefined);
  }, [role, conversationId, 最新文本ID, 操作]);

  // 草稿与发送：发送前 trim；超长按 code point 拦截。POST 成功或对账确认后清草稿；
  // 结果未知保留不可变待定正文进提示区（草稿已清空，可继续编辑新内容）。
  const [草稿, 设草稿] = useState('');
  const [未知结果, 设未知结果] = useState<P7发送结果 | null>(null);
  // review-r2 R2-2：发送 scope 代际 —— 换会话/卸载作废在飞结算与在飞锁（-1 = 空闲，
  // ≥0 = 该代际有在飞发送）；旧会话的迟到结果、草稿回填、错误提示绝不进新会话。
  const 发送代际 = useRef(0);
  const 发送在飞 = useRef(-1);
  useEffect(() => {
    设未知结果(null); // 换会话：旧会话的结果未知提示不进新会话
    设草稿(''); // 草稿按会话隔离：旧会话的在编草稿不带入新会话
    return () => {
      发送代际.current += 1;
    };
  }, [conversationId, role]);

  const 发送 = (内容参数?: string) => {
    const 原文 = 内容参数 ?? 草稿;
    const 内容 = 原文.trim();
    if (内容 === '' || 发送在飞.current === 发送代际.current) return;
    if (Array.from(内容).length > 正文码点上限) {
      轻提示(超长提示);
      return;
    }
    const 起始代际 = 发送代际.current;
    发送在飞.current = 起始代际;
    // review-r2 R2-3：只有发送草稿本身才清草稿；重试不可变待定正文不动在编草稿。
    if (内容参数 === undefined) 设草稿('');
    操作.发送真人消息(role, conversationId, 内容)
      .then((结果) => {
        if (发送代际.current !== 起始代际) return; // 迟到：会话已换/已卸载
        if (结果.status === 'confirmed') {
          设未知结果(null);
        } else {
          设未知结果(结果);
        }
      })
      .catch((错误) => {
        if (发送代际.current !== 起始代际) return; // 迟到：不提示、不回填
        轻提示(取P7错误文案(错误));
        // review-r1 F6：明确拒绝的消息没发出去 —— 恢复失败正文，不让草稿凭空丢失；
        // 用户若已在途中编辑新草稿则原样保留，绝不覆盖。confirmed/unknown 不走这里
        //（unknown 的不可变正文由提示区携带）。
        设草稿((现) => (现 === '' ? 内容 : 现));
      })
      .finally(() => {
        if (发送代际.current === 起始代际) 发送在飞.current = -1; // 只有属主代际释放锁
      });
  };

  /** 结果未知的同键重试：按不可变待定正文重发（不是当前编辑中的草稿）。 */
  const 重新确认 = () => {
    if (未知结果 === null || 未知结果.status !== 'unknown') return;
    const 待定正文 = 未知结果.pendingContent;
    设未知结果(null);
    发送(待定正文);
  };

  /** 显式放弃：只清该待定正文的意图键；当前编辑中的草稿原样保留。 */
  const 放弃 = () => {
    if (未知结果 === null || 未知结果.status !== 'unknown') return;
    操作.放弃真人消息意图(role, conversationId, 未知结果.pendingContent);
    设未知结果(null);
  };

  // 招聘端「看简历」的 PDF 租约：点击才取件，租约只活在弹层生命周期。
  const [PDF预览, 设PDF预览] = useState<{ 文件名: string; 地址: string } | null>(null);
  const PDF租约引用 = useRef<PDF对象租约 | null>(null);
  // review-r2 R2-4：在飞锁按代际归属（-1 = 空闲，≥0 = 该代际在飞）—— 旧会话的
  // 在飞取件不挡新会话取件；只有属主代际的结算才释放自己的锁。
  const PDF在飞 = useRef(-1);
  // review-r1 F7：取件代际 —— 卸载/换会话都作废在飞取件；迟到的租约当场回收，
  // 绝不悬挂到会话边界才回收。
  const PDF代际 = useRef(0);
  const 回收租约 = () => {
    PDF租约引用.current?.revoke();
    PDF租约引用.current = null;
  };
  useEffect(() => {
    设PDF预览(null); // 换会话：旧会话的取件层立即关闭
    return () => {
      PDF代际.current += 1;
      回收租约();
    };
  }, [conversationId]);
  const 开PDF = async (caseId: string) => {
    if (caseId === '' || PDF预览 !== null || PDF在飞.current === PDF代际.current) return;
    PDF在飞.current = PDF代际.current;
    const 起始代际 = PDF代际.current;
    try {
      const 租约 = await 操作.读取简历PDF('recruiter', caseId);
      if (PDF代际.current !== 起始代际) {
        // 迟到：会话已换/组件已卸载 —— 租约即刻回收，不挂不渲染
        租约.revoke();
        return;
      }
      回收租约(); // 防御：上一张（理论上不存在）先回收再挂新的
      PDF租约引用.current = 租约;
      设PDF预览({ 文件名: '简历原件.pdf', 地址: 租约.url });
    } catch (错误) {
      // review-r2 R2-4：迟到的失败对新会话是无关错误 —— 不提示
      if (PDF代际.current !== 起始代际) return;
      轻提示(取P7错误文案(错误));
    } finally {
      if (PDF代际.current === 起始代际) PDF在飞.current = -1; // 只有属主代际释放锁
    }
  };

  // 上下文动作（§8.3）：只在 context available 且对应 ref 在场时出现；
  // context 不可用保留「重新加载会话信息」。
  const 上下文在场 = 详情 !== null && 详情.contextStatus === 'available' && 详情.context !== null;
  const 候选可看职位 = role === 'candidate' && 上下文在场 && 详情!.context!.jobRef !== null;
  const 招聘可看简历 = role === 'recruiter' && 上下文在场 && 详情!.context!.resumeRef !== null
    && 详情!.caseId !== '';

  // 页头（§8.3）：可用时候选 = 职位名 / 地点 · 真人会话，招聘 = 候选代号 / 职位名；
  // 不可用统一「真人会话」。
  const 标题 = !上下文在场
    ? '真人会话'
    : role === 'candidate'
      ? 详情!.context!.primaryLabel
      : 详情!.context!.secondaryLabel;
  const 副标题 = !上下文在场
    ? ''
    : role === 'candidate'
      ? `${详情!.context!.secondaryLabel} · 真人会话`
      : 详情!.context!.primaryLabel;

  const 详情失败 = 详情快照 !== undefined && 详情快照.阶段 === '失败' && 详情快照.detail === null;

  return (
    <次级页外壳 对话底 白底>
      <返回栏
        返回={返回}
        标题={标题}
        副标题={副标题}
        居中标题
        右侧={<span className={共用样式.更多}>⋯</span>}
      />

      {/* 上下文动作排：只在有权威坐标时渲染；Backend 永不渲染电话/微信（§8.3）。
          候选端按 job_ref 导航既有权威岗位详情；招聘端按 case_id 取 Case 授权 PDF。 */}
      {候选可看职位 ? (
        <真人会话操作栏
          主项名="看职位"
          主项图标={<公文包图标 尺寸={18} 色="#3f7a1f" />}
          主项按下={() => 跳转(路径.职位详情(详情!.context!.jobRef!))}
        />
      ) : null}
      {招聘可看简历 ? (
        <真人会话操作栏
          主项名="看简历"
          主项图标={<简历图标 尺寸={18} 色="#3f7a1f" />}
          主项按下={() => void 开PDF(详情!.caseId)}
        />
      ) : null}
      {详情 !== null && !上下文在场 ? (
        <div style={{ padding: '10px 16px 0' }}>
          <button
            className="可点"
            style={{ padding: '7px 15px', borderRadius: 999, border: '1px solid var(--描边)', background: 'var(--浅灰底)', color: 'var(--正文)', fontSize: 12.5 }}
            onClick={() => void 操作.读取真人会话(role, conversationId, true).catch(() => undefined)}
          >
            重新加载会话信息
          </button>
        </div>
      ) : null}

      <滚动区>
        <div className={`${共用样式.消息流} ${共用样式.消息流上留白}`}>
          {/* 详情整页失败（404 等）：不显示上一次会话残留，只给重试 */}
          {详情失败 ? (
            <div className={共用样式.居中行}>
              <div style={{ padding: 16, color: 'var(--弱化)', fontSize: 13, textAlign: 'center' }}>
                {详情快照?.error}
                <br />
                <button
                  className="可点"
                  style={{ marginTop: 8, padding: '6px 14px', borderRadius: 999, border: '1px solid var(--描边)', background: 'var(--浅灰底)' }}
                  onClick={() => void 操作.读取真人会话(role, conversationId, true).catch(() => undefined)}
                >
                  重试
                </button>
              </div>
            </div>
          ) : null}

          {/* 消息刷新失败但保留旧成功内容：错误行交代 + 重试 */}
          {消息快照?.error && !消息快照.刷新中 ? (
            <div className={共用样式.居中行}>
              <div style={{ padding: '8px 16px', color: 'var(--弱化)', fontSize: 12 }}>
                {消息快照.error}
                <button
                  className="可点"
                  style={{ marginLeft: 8, padding: '4px 10px', borderRadius: 999, border: '1px solid var(--描边)' }}
                  onClick={() => void 操作.读取真人会话(role, conversationId, true).catch(() => undefined)}
                >
                  重试
                </button>
              </div>
            </div>
          ) : null}

          {/* 更早消息分页入口：更早页 prepend 后视口保持由下方锚定 effect 兜底 */}
          {消息快照?.nextCursor != null ? (
            <div className={共用样式.居中行}>
              <button
                className="可点"
                style={{ padding: '5px 14px', borderRadius: 999, border: '1px solid var(--描边)', background: 'var(--浅灰底)', color: 'var(--正文)', fontSize: 12 }}
                onClick={() => void 操作.追加更早消息(role, conversationId).catch(() => undefined)}
              >
                加载更早
              </button>
            </div>
          ) : null}

          {消息快照 === undefined || (消息快照.阶段 !== '成功' && messages.length === 0 && 消息快照.error === null) ? (
            <div className={共用样式.居中行}>
              <span style={{ padding: 16, color: 'var(--弱化)', fontSize: 13 }}>{读入中文案}</span>
            </div>
          ) : null}

          {messages.map((行) => (
            <消息行 key={行.messageId} 行={行} role={role} />
          ))}

          {/* 结果未知提示区：重新确认按不可变待定正文同键重试；可放弃时才有放弃 */}
          {未知结果 !== null && 未知结果.status === 'unknown' ? (
            <div
              data-testid="unknown-result"
              style={{
                margin: '10px 16px', padding: '10px 12px', borderRadius: 12,
                background: 'var(--浅灰底)', display: 'flex', flexWrap: 'wrap',
                alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--正文)',
              }}
            >
              <span>
                {未知结果.reason === 'in_progress'
                  ? '消息仍在处理中，请稍后重试'
                  : '暂时无法确认是否发送成功'}
              </span>
              <button
                className="可点"
                style={{ padding: '5px 12px', borderRadius: 999, border: '1px solid var(--描边深)', background: '#fff' }}
                onClick={重新确认}
              >
                重新确认发送结果
              </button>
              {未知结果.canAbandon ? (
                <button
                  className="可点"
                  style={{ padding: '5px 12px', borderRadius: 999, border: '1px solid var(--描边)', background: 'transparent', color: 'var(--弱化)' }}
                  onClick={放弃}
                >
                  放弃本次发送
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </滚动区>

      <真输入条
        占位="输入消息"
        值={草稿}
        改变={设草稿}
        发送={() => 发送()}
        右侧图标={<span className={真人会话样式.代理符}>◈</span>}
      />

      {/* 招聘端原始 PDF 弹层：租约地址呈现真实字节，关闭即回收 */}
      {PDF预览 !== null ? (
        <原始PDF层
          文件名={PDF预览.文件名}
          地址={PDF预览.地址}
          关闭={() => {
            回收租约();
            设PDF预览(null);
          }}
        />
      ) : null}
    </次级页外壳>
  );
}

/** 单条消息行：user_text 按 senderRole 对齐（本端右 / 对端左，data-侧 供回归断言）；
 *  conversation_started 渲染固定中性系统胶囊。头像一律中性占位，绝不从 Mock 姓名取首字。 */
function 消息行({ 行, role }: { 行: P7消息; role: P7角色 }) {
  if (行.kind === 'conversation_started') {
    return (
      <div className={共用样式.居中行}>
        <span className={共用样式.系统胶囊}>{系统行文案}</span>
      </div>
    );
  }
  const 我方 = 行.senderRole === role;
  if (我方) {
    return (
      <div className={共用样式.我方行} data-侧="右">
        <div className={共用样式.我气泡组}>
          <div className={共用样式.我气泡}>
            <div className={共用样式.气泡文字}>{行.content}</div>
          </div>
          <span className={共用样式.我头像}>会</span>
        </div>
        <span className={`${共用样式.时间戳} ${共用样式.时间戳带头像}`}>{取短时间(行.createdAt)}</span>
      </div>
    );
  }
  return (
    <div className={共用样式.对方行} data-侧="左">
      <span className={共用样式.对方头像}>会</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className={共用样式.对方气泡}>
          <div className={共用样式.气泡文字}>{行.content}</div>
        </div>
        <span className={共用样式.时间戳}>{取短时间(行.createdAt)}</span>
      </div>
    </div>
  );
}