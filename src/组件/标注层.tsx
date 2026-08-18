// 标注模式：让提修改意见的人「点一下」代替「打字描述位置」。
//
// 用法（写给用页面的人）：
//   1. 点右下角半透明小铅笔进入标注模式（再点一次退出）；
//   2. 点页面上任何看不顺眼的元素 → 弹出输入条，写一句意见（手机可用语音听写）；
//   3. 攒够一批后点铅笔上的数字角标 → 「复制全部」→ 整段贴给 Claude。
//
// 每条标注自动记录：当前路由 + 被点元素的 CSS Modules 类链 + 元素文本。
// 类名形如「在谈首页-module__薪资__ab3d」（vite.config 里配的 generateScopedName），
// 从中能直接反查到 src/屏幕/在谈首页.module.css 的 .薪资 —— 所以收到标注的人
// 不需要提意见的人解释「在哪个页面哪个位置」。
//
// 意见存 localStorage，刷新不丢；本组件全部用内联样式，避免自己的类名混进捕获结果。

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { 轻提示 } from './轻提示';

interface 标注 {
  编号: number;
  路由: string;
  位置: string; // CSS 类链，如 在谈首页-module__薪资
  文本: string; // 被点元素的可见文本（截断）
  意见: string;
  时间: string;
  /** 已直接送达 Claude 的收集服务（无需再复制） */
  已送达?: boolean;
}

const 存储键 = 'AGXP标注意见';
/** 改名前的键。用户设备上可能还压着没发出去的意见，首次读取时搬过来，别弄丢 */
const 旧存储键 = '对席标注意见';

/**
 * 端点发现：优先读部署目录里的 annotate-endpoint.json（内容是收集服务的
 * Cloudflare 隧道 https 地址，由 脚本/标注直达上线.sh 维护）。有它，
 * **线上 GitHub Pages（https）也能直达** —— 这是解决混合内容拦截的关键：
 * https 页面不能调本机 http 服务，但可以调隧道给的 https 地址。
 * 拿不到配置时退回旧逻辑：http 页面（localhost / 局域网）直连同 host:8090。
 */
let 端点缓存: string | null | undefined;
async function 取收集端点(): Promise<string | null> {
  if (端点缓存 !== undefined) return 端点缓存;
  try {
    const 响应 = await fetch(`${import.meta.env.BASE_URL}annotate-endpoint.json?t=${Date.now()}`, {
      cache: 'no-store',
    });
    if (响应.ok) {
      const { url } = (await 响应.json()) as { url?: string };
      端点缓存 = url && url.startsWith('https://') ? url : null;
    } else {
      端点缓存 = null;
    }
  } catch {
    端点缓存 = null;
  }
  return 端点缓存;
}

/** 向指定地址 POST 一条标注，1.5 秒超时 */
async function 推送(地址: string, 条: 标注): Promise<boolean> {
  const 控制器 = new AbortController();
  const 定时 = setTimeout(() => 控制器.abort(), 1500);
  try {
    const 响应 = await fetch(地址, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(条),
      signal: 控制器.signal,
    });
    return 响应.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(定时);
  }
}

/** 把一条标注直接推给收集服务：先走隧道端点（https，线上也通），再走本机直连 */
async function 尝试送达(条: 标注): Promise<boolean> {
  const 隧道 = await 取收集端点();
  if (隧道 && (await 推送(`${隧道}/标注`, 条))) return true;
  if (location.protocol === 'http:') {
    return 推送(`http://${location.hostname}:8090/标注`, 条);
  }
  return false;
}

/** 从被点元素向上走，收集 CSS Modules 类（含 __ 的），拼成「文件__类」链 */
function 取元素位置(目标: Element): string {
  const 链: string[] = [];
  let 节点: Element | null = 目标;
  let 层数 = 0;
  while (节点 && 层数 < 6 && 链.length < 3) {
    const 类们 = Array.from(节点.classList ?? []).filter((类) => 类.includes('__'));
    if (类们.length > 0) {
      // 去掉末尾 hash：在谈首页-module__薪资__ab3d → 在谈首页-module__薪资
      const 干净 = 类们[0].split('__').slice(0, 2).join('__');
      if (!链.includes(干净)) 链.push(干净);
    }
    节点 = 节点.parentElement;
    层数 += 1;
  }
  return 链.join(' ← ') || '（未命中具名元素）';
}

export default function 标注层() {
  const 位置信息 = useLocation();
  const [开启, 设开启] = useState(false);
  const [草稿目标, 设草稿目标] = useState<Omit<标注, '编号' | '意见' | '时间'> | null>(null);
  const [草稿文字, 设草稿文字] = useState('');
  const [清单, 设清单] = useState<标注[]>(() => {
    try {
      // 新键为空时把旧键的内容搬过来：改名那一刻用户设备上可能正压着没发出去的意见
      const 原文 = localStorage.getItem(存储键) ?? localStorage.getItem(旧存储键) ?? '[]';
      return JSON.parse(原文);
    } catch {
      return [];
    }
  });
  const [导出面板, 设导出面板] = useState(false);
  const [已复制, 设已复制] = useState(false);
  const 输入引用 = useRef<HTMLTextAreaElement>(null);

  const 存清单 = useCallback((新清单: 标注[]) => {
    设清单(新清单);
    localStorage.setItem(存储键, JSON.stringify(新清单));
  }, []);

  // 标注模式下用捕获阶段拦截所有点击：既阻止原交互，又抓到目标元素
  useEffect(() => {
    if (!开启) return;
    const 拦截 = (事件: MouseEvent) => {
      const 目标 = 事件.target as Element;
      // 自己的 UI 不拦（铅笔、输入条、导出面板都带 data-标注）
      if (目标.closest('[data-标注]')) return;
      事件.preventDefault();
      事件.stopPropagation();
      设草稿目标({
        路由: window.location.hash || '#/',
        位置: 取元素位置(目标),
        文本: (目标.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 24),
      });
      设草稿文字('');
    };
    document.addEventListener('click', 拦截, true);
    return () => document.removeEventListener('click', 拦截, true);
  }, [开启]);

  // 输入条一出来就聚焦（手机上直接唤起键盘/听写）
  useEffect(() => {
    if (草稿目标) setTimeout(() => 输入引用.current?.focus(), 60);
  }, [草稿目标]);

  const 保存草稿 = () => {
    if (!草稿目标 || !草稿文字.trim()) {
      设草稿目标(null);
      return;
    }
    const 新条: 标注 = {
      ...草稿目标,
      编号: Date.now(),
      意见: 草稿文字.trim(),
      时间: new Date().toLocaleString('zh-CN', { hour12: false }),
    };
    设草稿目标(null);

    // 保存即尝试直接送达：成功则这条不用再复制；失败（如在 Pages 上）留在
    // 本地清单里走复制兜底。异步进行，不挡用户继续标注下一条。
    void (async () => {
      const 送达成功 = await 尝试送达(新条);
      新条.已送达 = 送达成功;
      // 用函数式更新拿最新清单，避免连续快速标注时互相覆盖
      设清单((旧) => {
        const 新清单 = [...旧, 新条];
        localStorage.setItem(存储键, JSON.stringify(新清单));
        return 新清单;
      });
      轻提示(送达成功 ? '已送达 Claude，开始处理 ✓' : '已记下（未连上 Claude，可稍后复制）');
    })();
  };

  // 只导出「未送达」的条目：已直接推给 Claude 的不需要再复制
  const 待复制 = 清单.filter((条) => !条.已送达);
  const 导出文本 = () =>
    [
      `【AGXP 修改意见】共 ${待复制.length} 条 · ${new Date().toLocaleString('zh-CN', { hour12: false })}`,
      ...待复制.map(
        (条, 序) =>
          `${序 + 1}) 页面 ${条.路由} ｜位置 ${条.位置}${条.文本 ? ` ｜文本「${条.文本}」` : ''}\n   意见：${条.意见}`
      ),
    ].join('\n');

  const 复制全部 = async () => {
    try {
      await navigator.clipboard.writeText(导出文本());
      设已复制(true);
      setTimeout(() => 设已复制(false), 1600);
    } catch {
      // 剪贴板被拒（个别浏览器策略）时，面板里的文本框仍可手动全选复制
    }
  };

  return (
    <div data-标注 style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 90 }}>
      {/* 标注模式提示条 */}
      {开启 && !草稿目标 ? (
        <div
          style={{
            position: 'absolute',
            top: 'calc(var(--安全区上) + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(26,26,26,0.82)',
            color: '#fff',
            fontSize: 11.5,
            padding: '6px 12px',
            borderRadius: 999,
            whiteSpace: 'nowrap',
          }}
        >
          标注模式：点任意元素记一条意见
        </div>
      ) : null}

      {/* 右下角铅笔（低调常驻）+ 计数角标（点开导出面板） */}
      <div
        style={{
          position: 'absolute',
          right: 14,
          bottom: 'calc(var(--安全区下) + 96px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          pointerEvents: 'auto',
        }}
      >
        {清单.length > 0 ? (
          <button
            onClick={() => 设导出面板(true)}
            style={{
              minWidth: 22,
              height: 22,
              borderRadius: 11,
              background: 'var(--意向)',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              padding: '0 6px',
              cursor: 'pointer',
            }}
          >
            {清单.length}
          </button>
        ) : null}
        <button
          onClick={() => 设开启((旧) => !旧)}
          aria-label="标注模式"
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            border: '1px solid rgba(0,0,0,0.08)',
            background: 开启 ? 'var(--荧光绿)' : 'rgba(255,255,255,0.55)',
            opacity: 开启 ? 1 : 0.55,
            fontSize: 15,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          }}
        >
          {开启 ? '✕' : '✎'}
        </button>
      </div>

      {/* 点中元素后的意见输入条 */}
      {草稿目标 ? (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            background: '#fff',
            borderRadius: '16px 16px 0 0',
            boxShadow: '0 -6px 24px rgba(0,0,0,0.16)',
            padding: '12px 16px calc(var(--安全区下) + 12px)',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ fontSize: 10.5, color: 'var(--灰白)', marginBottom: 6 }}>
            {草稿目标.位置}
            {草稿目标.文本 ? ` ·「${草稿目标.文本}」` : ''}
          </div>
          <textarea
            ref={输入引用}
            value={草稿文字}
            onChange={(事件) => 设草稿文字(事件.target.value)}
            placeholder="想怎么改？一句话（手机可点键盘上的麦克风语音听写）"
            rows={2}
            style={{
              width: '100%',
              border: '1.5px solid var(--深绿)',
              borderRadius: 12,
              padding: '9px 12px',
              fontSize: 14,
              lineHeight: 1.6,
              resize: 'none',
              outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={() => 设草稿目标(null)}
              style={{
                flex: 1,
                padding: '10px 0',
                borderRadius: 12,
                border: '1px solid var(--描边中)',
                background: '#fff',
                color: 'var(--次要)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              取消
            </button>
            <button
              onClick={保存草稿}
              style={{
                flex: 2,
                padding: '10px 0',
                borderRadius: 12,
                background: 'var(--荧光绿)',
                color: 'var(--墨)',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              记下这条
            </button>
          </div>
        </div>
      ) : null}

      {/* 导出面板 */}
      {导出面板 ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--遮罩)',
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'flex-end',
          }}
          onClick={() => 设导出面板(false)}
        >
          <div
            onClick={(事件) => 事件.stopPropagation()}
            style={{
              width: '100%',
              background: '#fff',
              borderRadius: '16px 16px 0 0',
              padding: '14px 16px calc(var(--安全区下) + 14px)',
              maxHeight: '70%',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 800 }}>
              修改意见（{清单.length} 条{清单.length - 待复制.length > 0 ? ` · ${清单.length - 待复制.length} 条已送达 Claude ✓` : ''}）
            </div>
            <textarea
              readOnly
              value={导出文本()}
              onFocus={(事件) => 事件.target.select()}
              rows={8}
              style={{
                width: '100%',
                border: '1px solid var(--描边深)',
                borderRadius: 12,
                padding: 10,
                fontSize: 12,
                lineHeight: 1.7,
                color: 'var(--正文)',
                resize: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  存清单([]);
                  设导出面板(false);
                }}
                style={{
                  flex: 1,
                  padding: '11px 0',
                  borderRadius: 12,
                  border: '1px solid var(--描边中)',
                  background: '#fff',
                  color: 'var(--次要)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                清空
              </button>
              <button
                onClick={复制全部}
                style={{
                  flex: 2,
                  padding: '11px 0',
                  borderRadius: 12,
                  background: 已复制 ? 'var(--淡绿底)' : 'var(--荧光绿)',
                  color: 已复制 ? 'var(--深绿)' : 'var(--墨)',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {已复制 ? '已复制 ✓ 贴给 Claude 即可' : '复制全部'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 消费 useLocation 仅为了路由变化时组件跟着刷新（hash 直接从 window 读） */}
      <span style={{ display: 'none' }}>{位置信息.pathname}</span>
    </div>
  );
}
