// 账号与安全 —— 两端设置页的「账号」组共用这一屏（/account）。
//
// 两件事：换绑手机号（验证码两步流，原型里任意 6 位数字通过）与注销账号（二次确认）。
//
// 注销的文案不能含糊：这个平台上「谈判档案」是双方共同的记录，一方注销不能让对方
// 手里的记录凭空消失，所以口径是「匿名化保留 30 天」——身份要素立刻抹掉，
// 记录本身按最短周期留存后清除。这一段必须在按下按钮之前就让用户读到。

import { useEffect, useState } from 'react';
import 样式 from './我的功能页.module.css';
import 本屏样式 from './账号安全.module.css';
import { 次级页外壳, 返回栏, 滚动区 } from '../组件/通用';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';

/** 11 位手机号 → 138 **** 6021 的展示形式。中间四位永远不回显 */
function 打码手机号(号码: string): string {
  if (号码.length !== 11) return 号码;
  return `${号码.slice(0, 3)} **** ${号码.slice(7)}`;
}

type 换绑步骤 = null | '填手机号' | '填验证码';

export default function 账号安全() {
  const { 返回, 替换跳转 } = use导航();
  // 账号信息目前没有全局切片（共享层只管谈判与简历），先本地存，接后端时整体上移到状态层
  const [当前手机号, 设当前手机号] = useState('138 **** 6021');
  const [步骤, 设步骤] = useState<换绑步骤>(null);
  const [新号, 设新号] = useState('');
  const [验证码, 设验证码] = useState('');
  const [提示, 设提示] = useState<string | null>(null);
  // 注销分两步：先读完后果（说明层），再做最终确认（确认框）
  const [注销说明开, 设注销说明开] = useState(false);
  const [注销确认开, 设注销确认开] = useState(false);

  useEffect(() => {
    if (!提示) return;
    const 定时 = window.setTimeout(() => 设提示(null), 1800);
    return () => window.clearTimeout(定时);
  }, [提示]);

  const 关换绑 = () => {
    设步骤(null);
    设新号('');
    设验证码('');
  };

  return (
    <次级页外壳>
      <返回栏 返回={返回} 标题="账号与安全" />

      <滚动区 样式覆盖={{ padding: '14px 18px 24px' }}>
        <div className={样式.组标}>登录方式</div>
        <div className={样式.卡}>
          <button className={`${样式.行} 可点`} onClick={() => 设步骤('填手机号')}>
            <span className={样式.行文字组}>
              <span className={样式.行标题}>手机号</span>
              <span className={样式.行说明}>登录与接收验证码用，对方永远看不到</span>
            </span>
            <span className={样式.行值}>{当前手机号}</span>
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
              <span className={样式.行说明}>iPhone · 上海 · 今天 09:12</span>
            </span>
            <span className={样式.行值}>本机</span>
          </div>
          <button
            className={`${样式.行} 可点`}
            onClick={() => 设提示('其余设备已全部退出登录')}
          >
            <span className={样式.行文字组}>
              <span className={样式.行标题}>退出其他设备</span>
              <span className={样式.行说明}>不影响本机，也不影响代理在后台继续谈</span>
            </span>
            <span className={样式.尖括号}>›</span>
          </button>
        </div>

        <button className={`${样式.危险键} 可点`} onClick={() => 设注销说明开(true)}>
          注销账号
        </button>

        <div className={样式.版本}>
          注销是不可逆的。注销前建议先在「归档」里导出你需要留存的记录。
        </div>
      </滚动区>

      {/* ── 换绑手机号：两步抽屉 ── */}
      {步骤 !== null ? (
        <>
          <div className={本屏样式.遮罩} onClick={关换绑} />
          <div className={本屏样式.抽屉} role="dialog" aria-label="换绑手机号">
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
                    设步骤('填验证码');
                    设提示('验证码已发送（原型：任意 6 位数字均可通过）');
                  }}
                >
                  获取验证码
                </button>
              </>
            ) : (
              <>
                <div className={本屏样式.抽屉标题}>输入验证码</div>
                <div className={本屏样式.抽屉说明}>
                  已发送至 {打码手机号(新号)}。原型环境不真发短信，任意 6 位数字即可通过。
                </div>
                <input
                  className={`${本屏样式.输入框} ${本屏样式.验证码框}`}
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="6 位验证码"
                  value={验证码}
                  onChange={(事件) => 设验证码(事件.target.value.replace(/\D/g, ''))}
                />
                <button
                  className={`${本屏样式.主键} ${验证码.length === 6 ? '可点' : 本屏样式.主键禁用}`}
                  disabled={验证码.length !== 6}
                  onClick={() => {
                    设当前手机号(打码手机号(新号));
                    关换绑();
                    设提示('手机号已换绑');
                  }}
                >
                  确认换绑
                </button>
                <button
                  className={`${本屏样式.次键} 可点`}
                  onClick={() => 设提示('验证码已重新发送')}
                >
                  没收到？重新发送
                </button>
              </>
            )}
          </div>
        </>
      ) : null}

      {/* ── 注销第一步：把后果讲清楚 ── */}
      {注销说明开 ? (
        <>
          <div className={本屏样式.遮罩} onClick={() => 设注销说明开(false)} />
          <div className={本屏样式.抽屉} role="dialog" aria-label="注销账号说明">
            <div className={本屏样式.抓手} />
            <div className={本屏样式.抽屉标题}>注销账号会发生什么</div>
            <div className={样式.说明条} style={{ marginTop: 14 }}>
              你的简历、意向、规则与收藏会
              <span className={样式.说明强调}>立即删除</span>
              ；正在进行的谈判会全部终止，对方只会收到「对方已退出」，不会知道原因。
            </div>
            <div className={本屏样式.抽屉说明}>
              谈判档案是双方共同的记录，不能因一方注销就凭空消失，因此它会被
              <b>匿名化保留 30 天</b>
              （抹掉全部身份要素，只留经过与结论），到期自动彻底清除。
              这 30 天内你无法用同一手机号重新注册。
            </div>
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
          </div>
        </>
      ) : null}

      {/* ── 注销第二步：最终确认 ── */}
      {注销确认开 ? (
        <div className={样式.遮罩} onClick={() => 设注销确认开(false)}>
          <div className={样式.确认框} onClick={(事件) => 事件.stopPropagation()}>
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
                onClick={() => 替换跳转(路径.登录)}
              >
                确认注销
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {提示 ? <div className={样式.浮层提示}>{提示}</div> : null}
    </次级页外壳>
  );
}
