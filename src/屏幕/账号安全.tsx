// 账号与安全 —— 两端设置页的「账号」组共用这一屏（/account）。
//
// 三件事：换绑手机号（验证码两步流，位数与登录页统一）、导出我的数据（P8 Task 5 新增
// 的唯一一行入口）与注销账号（二次确认）。
//
// 注销的文案不能含糊：这个平台上「谈判档案」是双方共同的记录，一方注销不能让对方
// 手里的记录凭空消失，所以口径是「匿名化保留 30 天」——身份要素立刻抹掉，
// 记录本身按最短周期留存后清除。这一段必须在按下按钮之前就让用户读到。
//
// P8 Task 4：按 数据源模式 分支，现有 JSX/类名序就是视觉壳，只分叉值/禁用位/处理器。
// Mock：固定手机号、固定设备行、任意四位本地换绑、本地退出提示、本地注销跳转照旧，
// 零 P8 调用。Backend：凭证/会话快照驱动展示（服务端 display 原样、无 phone_otp →
// 「未绑定」、未成功快照 → 中性占位且动作禁用）；换绑两步走真实操作（11 位裸号进
// 操作层、完成成功等权威重读落地后才关抽屉、绝不乐观写手机号）；冲突/未知保留抽屉
// 与输入；401 由操作层统一清账号后由应用级路由回收，本屏只保证无本地成功。
//
// P8 Task 5：Backend 在注销按钮之前加一组同款「数据」卡（唯一一行「导出我的数据」）。
// 导出抽屉复用既有弹层样式，按恢复句柄三分支：无句柄先创建、有 ID 只查状态、
// null ID 同键续接（归操作层）；queued/running 轮询（关闭抽屉只停前端节拍）；
// ready 下载先权威预检再同源锚点，ZIP 绝不进内存/对象 URL。注销最终确认走真实操作：
// export_in_progress 留在弹层等待导出；ready 未下载给警示与先下载入口但可继续；
// 成功后由本屏跳登录页。Mock 不渲染导出行、保留本地注销演示。

import { useEffect, useState } from 'react';
import 样式 from './我的功能页.module.css';
import 本屏样式 from './账号安全.module.css';
import { 次级页外壳, 返回栏, 滚动区 } from '../组件/通用';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import 弹层框架 from '../组件/弹层框架';
import { 短信验证码位数 } from '../数据/验证码规则';
import { 打码手机号 } from '../数据/隐私展示';
import { use应用状态 } from '../状态/应用状态';
import { 取P8错误文案 } from '../状态/后端/P8控制面操作';
import { useP8导出轮询 } from '../状态/后端/useP8导出轮询';

type 换绑步骤 = null | '填手机号' | '填验证码';

/** RFC3339 → 「YYYY-MM-DD HH:mm」（UTC 定长截取，纯展示格式化；不引入时区换算）。 */
function 取展示时间(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)}`;
}

/** 快照未成功时的中性占位（与设置页账号行同款）。 */
const 中性占位 = '—';
const 退出其他基础说明 = '不影响本机，也不影响代理在后台继续谈';

/** P0 修复 Task 6：导出/注销文案的角色中性名词短语 —— 招聘方账号也没有「简历」。 */
const 账号业务记录文案 = '账号资料与业务记录';

export default function 账号安全() {
  const { 返回, 替换跳转 } = use导航();
  const { 操作, 数据源模式, 后端状态 } = use应用状态();
  const 是后端 = 数据源模式 === 'backend';
  // 账号信息目前没有全局切片（共享层只管谈判与简历），先本地存，接后端时整体上移到状态层
  const [当前手机号, 设当前手机号] = useState('138 **** 6021');
  const [步骤, 设步骤] = useState<换绑步骤>(null);
  const [新号, 设新号] = useState('');
  const [验证码, 设验证码] = useState('');
  const [提示, 设提示] = useState<string | null>(null);
  // Backend 换绑：begin 回执的 attempt id，完成步原样透传（Mock 不用）
  const [换绑尝试号, 设换绑尝试号] = useState<string | null>(null);
  // Backend 数据导出：抽屉开关（轮询只在抽屉开着时节拍，关闭不中断服务端任务）
  const [导出层开, 设导出层开] = useState(false);
  // Backend 注销：最终确认提交中（重复点击禁用；单飞由操作层保证）
  const [注销提交中, 设注销提交中] = useState(false);
  // 注销分两步：先读完后果（说明层），再做最终确认（确认框）
  const [注销说明开, 设注销说明开] = useState(false);
  const [注销确认开, 设注销确认开] = useState(false);

  // Backend 进屏：登记账号 UI 可见范围 + 凭证/会话并行按需读取 + 被动导出恢复
  // （无句柄零请求，恢复语义归操作层）；卸载注销可见范围。
  // Mock 零 P8 调用（Mock 下这些操作拒绝 backend_unavailable，绝不能触达）。
  useEffect(() => {
    if (!是后端) return;
    操作.设置P8账号范围(true);
    void 操作.加载P8凭证().catch(() => undefined);
    void 操作.加载P8会话().catch(() => undefined);
    void 操作.恢复P8数据导出().catch(() => undefined);
    return () => 操作.设置P8账号范围(false);
  }, [是后端, 操作]);

  useEffect(() => {
    if (!提示) return;
    const 定时 = window.setTimeout(() => 设提示(null), 1800);
    return () => window.clearTimeout(定时);
  }, [提示]);

  // ── Backend 快照投影：唯一 phone_otp 行的 display 原样上屏（绝不做客户端重掩码），
  //    会话只认恰好一条 current；未成功快照一律中性占位且相关动作禁用。──
  const 凭证已权威 = !是后端 || 后端状态.credentials.phase === 'success';
  const 会话已权威 = !是后端 || 后端状态.sessions.phase === 'success';
  const 手机凭证 = 是后端
    ? 后端状态.credentials.data?.find((行) => 行.provider === 'phone_otp') ?? null
    : null;
  const 当前会话 = 是后端
    ? 后端状态.sessions.data?.find((行) => 行.current) ?? null
    : null;
  const 其他会话数 = 是后端 && 会话已权威
    ? 后端状态.sessions.data?.filter((行) => !行.current).length ?? 0
    : null;

  const 手机号显示 = 是后端 ? (凭证已权威 ? 手机凭证?.display ?? '未绑定' : 中性占位) : 当前手机号;
  const 当前设备说明 = 是后端
    ? 当前会话 !== null
      ? `创建 ${取展示时间(当前会话.createdAt)} · 失效 ${取展示时间(当前会话.expiresAt)}`
      : 中性占位
    : 'iPhone · 上海 · 今天 09:12';
  const 退出其他说明 = 是后端 && 其他会话数 !== null
    ? `其他设备 ${其他会话数} 台 · ${退出其他基础说明}`
    : 退出其他基础说明;

  // ── Backend 数据导出投影（Task 5）：行提示与抽屉内容全部来自 dataExport 快照，
  //    只展示服务端 status，不用本地计时把 ready 改写成 expired（spec §6.2）。──
  const 导出快照 = 是后端 ? 后端状态.dataExport : null;
  const 导出数据 = 导出快照?.data ?? null;
  const 导出状态 = 导出数据?.status ?? null;
  const 导出查询中 = 导出快照 !== null && (导出快照.phase === 'loading' || 导出快照.refreshing);
  const 导出可下载 = 导出数据 !== null && 导出数据.status === 'ready' && 导出数据.downloadReady;

  function 取导出行说明(): string {
    if (导出快照 === null) return `打包下载${账号业务记录文案}`;
    if (导出状态 === null) {
      return 导出快照.phase === 'error'
        ? '导出状态获取失败，可重试'
        : `打包下载${账号业务记录文案}`;
    }
    if (导出状态 === 'queued' || 导出状态 === 'running') return '正在生成，回到本页可继续查看';
    if (导出状态 === 'ready') return 导出数据 !== null && 导出数据.downloadReady ? '已生成，可下载' : '已生成，下载准备中';
    if (导出状态 === 'failed') return '上次生成失败，可重新生成';
    return '已过期，可重新生成'; // expired
  }

  type 导出动作 = null | '创建' | '重新生成' | '下载';
  let 导出抽屉说明 = '';
  let 导出主键文案: string | null = null;
  let 导出主键动作: 导出动作 = null;
  if (导出数据 === null) {
    if (导出快照 !== null && 导出快照.phase === 'error') {
      导出抽屉说明 = 导出快照.error ?? '';
      导出主键文案 = '重试';
      导出主键动作 = '创建';
    } else if (导出查询中) {
      导出抽屉说明 = '正在查询导出状态，稍候…';
    } else {
      导出抽屉说明 = `把${账号业务记录文案}打包成 ZIP 文件。生成需要一点时间，关闭本页不会中断，回到这里可以继续查看。`;
      导出主键文案 = '生成导出文件';
      导出主键动作 = '创建';
    }
  } else if (导出数据.status === 'queued' || 导出数据.status === 'running') {
    导出抽屉说明 = '正在生成导出文件，完成后可以在这里下载。你可以先去忙别的，生成不会中断。';
  } else if (导出数据.status === 'ready') {
    导出抽屉说明 = 导出数据.downloadReady
      ? `导出已生成${导出数据.expiresAt ? `，${取展示时间(导出数据.expiresAt)} 前可下载` : ''}。点击下载前会再确认一次状态。`
      : '导出已生成，下载正在准备中，稍后再试。';
    导出主键文案 = '下载数据导出';
    导出主键动作 = '下载';
  } else if (导出数据.status === 'failed') {
    导出抽屉说明 = '上次导出没有生成成功。你可以重新生成一份。';
    导出主键文案 = '重新生成';
    导出主键动作 = '重新生成';
  } else {
    导出抽屉说明 = '这份导出已过期。如仍需要，请重新生成。';
    导出主键文案 = '重新生成';
    导出主键动作 = '重新生成';
  }

  /** Backend：下载先权威预检（下载与过期的竞态由同源 endpoint 诚实呈现），再同源
   *  锚点导航让响应流式落盘 —— ZIP 绝不进 React 状态、存储或对象 URL。 */
  const 下载数据导出 = () => {
    void (async () => {
      try {
        await 操作.刷新P8数据导出();
      } catch (错误) {
        设提示(取P8错误文案(错误));
        return;
      }
      const href = 操作.取P8数据导出下载地址();
      if (href !== null) {
        const link = document.createElement('a');
        link.href = href;
        link.download = '';
        link.click();
        return;
      }
      设提示('导出尚未就绪或已过期，请稍后重试');
    })();
  };

  const 开导出层 = () => {
    设导出层开(true);
    // 打开即恢复：无句柄零请求；null ID 同键续接；有 ID 权威 GET（spec §7.4）
    void 操作.恢复P8数据导出().catch((错误) => 设提示(取P8错误文案(错误)));
  };

  const 点导出主键 = () => {
    if (导出主键动作 === null) return;
    if (导出主键动作 === '下载') {
      下载数据导出();
      return;
    }
    void (async () => {
      // failed/expired 的「重新生成」先废弃清旧句柄，操作层才铸新键
      if (导出主键动作 === '重新生成') 操作.废弃P8数据导出();
      try {
        await 操作.创建P8数据导出();
      } catch (错误) {
        // 冲突/未知/401：无本地成功，抽屉保留可重试
        设提示(取P8错误文案(错误));
      }
    })();
  };

  // 导出轮询：只在 Backend 抽屉开着且有已知导出 ID 时节拍 —— 关闭/卸载/隐藏/终态
  // 停表，服务端任务继续；依赖显式注入，钩子内部绝不读 Context。
  useP8导出轮询({
    enabled: 是后端 && 导出层开,
    exportId: 导出数据 !== null ? 导出数据.exportId : null,
    status: 导出状态,
    refresh: () => 操作.刷新P8数据导出(),
  });

  const 关换绑 = () => {
    设步骤(null);
    设新号('');
    设验证码('');
    设换绑尝试号(null);
  };

  /** Backend begin：成功记 attempt、失败提示固定文案并保留当前输入（返回是否成功）。 */
  const 发起换绑 = async (手机号: string): Promise<boolean> => {
    try {
      const 尝试 = await 操作.开始P8手机号换绑(手机号);
      设换绑尝试号(尝试.attemptId);
      return true;
    } catch (错误) {
      设提示(取P8错误文案(错误));
      return false;
    }
  };

  return (
    <次级页外壳>
      <返回栏 返回={返回} 标题="账号与安全" />

      <滚动区 样式覆盖={{ padding: '14px 18px 24px' }}>
        <div className={样式.组标}>登录方式</div>
        <div className={样式.卡}>
          <button
            className={`${样式.行} 可点`}
            disabled={是后端 && !凭证已权威}
            onClick={() => 设步骤('填手机号')}
          >
            <span className={样式.行文字组}>
              <span className={样式.行标题}>手机号</span>
              <span className={样式.行说明}>登录与接收验证码用，对方永远看不到</span>
            </span>
            <span className={样式.行值}>{手机号显示}</span>
            <span className={样式.尖括号}>›</span>
          </button>
          <div className={样式.行}>
            <span className={样式.行文字组}>
              <span className={样式.行标题}>登录密码</span>
              <span className={样式.行说明}>本平台只用验证码登录，不设密码</span>
            </span>
            <span className={样式.行值}>未设置</span>
          </div>
        </div>

        <div className={`${样式.组标} ${样式.组标间距}`}>登录记录</div>
        <div className={样式.卡}>
          <div className={样式.行}>
            <span className={样式.行文字组}>
              <span className={样式.行标题}>当前设备</span>
              <span className={样式.行说明}>{当前设备说明}</span>
            </span>
            <span className={样式.行值}>本机</span>
          </div>
          <button
            className={`${样式.行} 可点`}
            disabled={是后端 && (其他会话数 === null || 其他会话数 === 0)}
            onClick={() => {
              if (!是后端) {
                设提示('其余设备已全部退出登录');
                return;
              }
              void (async () => {
                try {
                  // 成功后操作层自己权威重读会话；这里只消费回执计数
                  const 台数 = await 操作.退出P8其他设备();
                  设提示(`已退出 ${台数} 台其他设备`);
                } catch (错误) {
                  设提示(取P8错误文案(错误));
                }
              })();
            }}
          >
            <span className={样式.行文字组}>
              <span className={样式.行标题}>退出其他设备</span>
              <span className={样式.行说明}>{退出其他说明}</span>
            </span>
            <span className={样式.尖括号}>›</span>
          </button>
        </div>

        {/* P8 Task 5：Backend 专属「数据」组 —— 恰一组同款卡/行，位于注销按钮之前 */}
        {是后端 ? (
          <>
            <div className={`${样式.组标} ${样式.组标间距}`}>数据</div>
            <div className={样式.卡}>
              <button className={`${样式.行} 可点`} onClick={开导出层}>
                <span className={样式.行文字组}>
                  <span className={样式.行标题}>导出我的数据</span>
                  <span className={样式.行说明}>{取导出行说明()}</span>
                </span>
                <span className={样式.尖括号}>›</span>
              </button>
            </div>
          </>
        ) : null}

        <button className={`${样式.危险键} 可点`} onClick={() => 设注销说明开(true)}>
          注销账号
        </button>

        <div className={样式.版本}>
          注销是不可逆的。注销前建议先在「归档」里导出你需要留存的记录。
        </div>
      </滚动区>

      {/* ── 换绑手机号：两步抽屉 ── */}
      {步骤 !== null ? (
        <弹层框架 标签="换绑手机号" 遮罩类名={本屏样式.遮罩} 面板类名={本屏样式.抽屉} 关闭={关换绑}>
            <div className={本屏样式.抓手} />

            {步骤 === '填手机号' ? (
              <>
                <div className={本屏样式.抽屉标题}>换绑手机号</div>
                <div className={本屏样式.抽屉说明}>
                  换绑后旧号码立即失效。手机号只用于登录，任何阶段都不会出现在对方那一侧。
                </div>
                <input
                  className={本屏样式.输入框}
                  inputMode="numeric"
                  maxLength={11}
                  placeholder="输入新手机号"
                  value={新号}
                  onChange={(事件) => 设新号(事件.target.value.replace(/\D/g, ''))}
                />
                <button
                  className={`${本屏样式.主键} ${新号.length === 11 ? '可点' : 本屏样式.主键禁用}`}
                  disabled={新号.length !== 11}
                  onClick={() => {
                    if (!是后端) {
                      设步骤('填验证码');
                      设提示(`验证码已发送（原型：任意 ${短信验证码位数} 位数字均可通过）`);
                      return;
                    }
                    void (async () => {
                      // begin 失败：留在填手机号步且输入保留（未知/进行中同键可重试）
                      if (!(await 发起换绑(新号))) return;
                      设步骤('填验证码');
                      设提示('验证码已发送');
                    })();
                  }}
                >
                  获取验证码
                </button>
              </>
            ) : (
              <>
                <div className={本屏样式.抽屉标题}>输入验证码</div>
                <div className={本屏样式.抽屉说明}>
                  已发送至 {打码手机号(新号)}。{是后端
                    ? null
                    : <>原型环境不真发短信，任意 {短信验证码位数} 位数字即可通过。</>}
                </div>
                <input
                  className={`${本屏样式.输入框} ${本屏样式.验证码框}`}
                  inputMode="numeric"
                  maxLength={短信验证码位数}
                  placeholder={`${短信验证码位数} 位验证码`}
                  value={验证码}
                  onChange={(事件) => 设验证码(事件.target.value.replace(/\D/g, ''))}
                />
                <button
                  className={`${本屏样式.主键} ${验证码.length === 短信验证码位数 ? '可点' : 本屏样式.主键禁用}`}
                  disabled={验证码.length !== 短信验证码位数}
                  onClick={() => {
                    if (!是后端) {
                      设当前手机号(打码手机号(新号));
                      关换绑();
                      设提示('手机号已换绑');
                      return;
                    }
                    if (换绑尝试号 === null) return;
                    void (async () => {
                      try {
                        // 操作层完成成功会先强制重读凭证+会话再 resolve：
                        // 抽屉只在权威刷新落地后关闭，回执掩码绝不直接上屏
                        await 操作.完成P8手机号换绑(换绑尝试号, 验证码);
                        关换绑();
                        设提示('手机号已换绑');
                      } catch (错误) {
                        // 冲突/未知/401：无本地成功，抽屉与输入保留
                        设提示(取P8错误文案(错误));
                      }
                    })();
                  }}
                >
                  确认换绑
                </button>
                <button
                  className={`${本屏样式.次键} 可点`}
                  onClick={() => {
                    if (!是后端) {
                      设提示('验证码已重新发送');
                      return;
                    }
                    void (async () => {
                      // 重新发送 = 同手机号再走一次 begin（新 attempt 接管完成步）
                      if (!(await 发起换绑(新号))) return;
                      设提示('验证码已重新发送');
                    })();
                  }}
                >
                  没收到？重新发送
                </button>
              </>
            )}
        </弹层框架>
      ) : null}

      {/* ── 数据导出（Backend 专属）：恢复/创建/轮询/下载 复用既有抽屉 ── */}
      {导出层开 ? (
        <弹层框架 标签="导出我的数据" 遮罩类名={本屏样式.遮罩} 面板类名={本屏样式.抽屉} 关闭={() => 设导出层开(false)}>
            <div className={本屏样式.抓手} />
            <div className={本屏样式.抽屉标题}>导出我的数据</div>
            <div className={本屏样式.抽屉说明}>{导出抽屉说明}</div>
            {导出主键文案 !== null ? (
              <button className={`${本屏样式.主键} 可点`} onClick={点导出主键}>
                {导出主键文案}
              </button>
            ) : null}
            <button className={`${本屏样式.次键} 可点`} onClick={() => 设导出层开(false)}>
              先不导出
            </button>
        </弹层框架>
      ) : null}

      {/* ── 注销第一步：把后果讲清楚 ── */}
      {注销说明开 ? (
        <弹层框架 标签="注销账号说明" 遮罩类名={本屏样式.遮罩} 面板类名={本屏样式.抽屉} 关闭={() => 设注销说明开(false)}>
            <div className={本屏样式.抓手} />
            <div className={本屏样式.抽屉标题}>注销账号会发生什么</div>
            <div className={样式.说明条} style={{ marginTop: 14 }}>
              你的账号资料与业务记录会
              <span className={样式.说明强调}>立即删除</span>
              且无法恢复；正在进行的代谈会全部终止，对方只会收到「对方已退出」，不会知道原因。
            </div>
            <div className={本屏样式.抽屉说明}>
              代谈记录是双方共同的记录，不能因一方注销就凭空消失，因此它会被
              <b>匿名化保留 30 天</b>
              （抹掉全部身份要素，只留经过与结论），到期自动彻底清除。
              这 30 天内你无法用同一手机号重新注册。
            </div>
            {/* Backend：ready 未下载的导出在注销后无法再取回 —— 警示 + 同款先下载入口，
                但不拦截继续（spec §7.5） */}
            {是后端 && 导出可下载 ? (
              <>
                <div className={样式.说明条} style={{ marginTop: 14 }}>
                  你有一份已生成的数据导出，<span className={样式.说明强调}>注销后将无法下载</span>。建议先下载留存。
                </div>
                <button className={`${本屏样式.主键} 可点`} onClick={下载数据导出}>
                  先下载数据导出
                </button>
              </>
            ) : null}
            <button
              className={`${本屏样式.主键} 可点`}
              style={{ background: 'var(--意向)', color: '#fff', boxShadow: 'none' }}
              onClick={() => {
                设注销说明开(false);
                设注销确认开(true);
              }}
            >
              我已了解，继续注销
            </button>
            <button className={`${本屏样式.次键} 可点`} onClick={() => 设注销说明开(false)}>
              再想想
            </button>
        </弹层框架>
      ) : null}

      {/* ── 注销第二步：最终确认 ── */}
      {注销确认开 ? (
        <弹层框架 标签="确认注销账号" 遮罩类名={样式.遮罩} 面板类名={样式.确认框} 位置="居中" 关闭={() => 设注销确认开(false)}>
            <div className={样式.确认标题}>确认注销账号？</div>
            <div className={样式.确认正文}>
              这一步不可撤销。确认后你会被登出，账号立即停用。
            </div>
            <div className={样式.确认键行}>
              <button className={`${样式.确认取消} 可点`} onClick={() => 设注销确认开(false)}>
                取消
              </button>
              <button
                className={`${样式.确认执行} 可点`}
                disabled={是后端 && 注销提交中}
                onClick={() => {
                  if (!是后端) {
                    替换跳转(路径.登录);
                    return;
                  }
                  void (async () => {
                    设注销提交中(true);
                    try {
                      await 操作.请求P8账号注销();
                      // 成功（202）：操作层已统一清 P4–P8 与本地账号状态；导航归本屏
                      设注销确认开(false);
                      设注销说明开(false);
                      替换跳转(路径.登录);
                    } catch (错误) {
                      // export_in_progress / 未知结果 / 401：无本地成功，两层弹层流程保留
                      设提示(取P8错误文案(错误));
                    } finally {
                      设注销提交中(false);
                    }
                  })();
                }}
              >
                确认注销
              </button>
            </div>
        </弹层框架>
      ) : null}

      {提示 ? <div className={样式.浮层提示}>{提示}</div> : null}
    </次级页外壳>
  );
}
