// A26 直聊会话 · AI代理旁听 —— 求职者选择自己上场聊，AI代理退到旁听位。
//
// 结构：返回栏（居中标题 + ⋯）→ 顶部交换排（换电话 / 换微信 / 发简历）→
// 旁听提示条 → 消息流 → 真输入条（灰边）。
//
// 顶部交换排（2026-08-24，产品负责人：「和招聘端一样，聊天上面有联系方式的互换」）：
// 视觉复用 真人会话操作栏 的同一套 CSS 与联系卡，但语义是「换」不是「看」——
// 这里在意向确认之前，联系方式要先点一下完成交换（消息流里落系统消息，
// 与原底部功能键行为一致）才展开给看。原底部功能键行整排上移后删除。
// 为什么不直接挂 真人会话操作栏：那一排是「看」（实值直陈，双盲已解除才允许），
// 语义边界见该文件头部注释与 真人会话操作栏.test.tsx 的源码级守卫。
//
// 本文件同时是「两屏共用件」的所在地：消息条 / 联系卡 / 自动滚到底 三个共用件
// 从这里 export，真人会话.tsx 直接 import，避免同一套气泡样式写两遍。

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import 样式 from './直聊会话.module.css';
import { 轻提示 } from '../组件/轻提示';
import 排样式 from './真人会话操作栏.module.css';
import { 次级页外壳, 返回栏, 滚动区, 真输入条 } from '../组件/通用';
import { 电话图标, 微信图标, 简历图标, 细对勾图标 } from '../组件/图标';
import 代理标 from '../组件/代理标';
import 举报层 from '../组件/举报层';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { 取直聊对象, 我的信息 } from '../数据/模拟数据';
import type { 会话条 } from '../数据/类型';

export default function 直聊会话() {
  const { 返回, 跳转 } = use导航();
  // 对方是谁由岗位编号决定 —— 从职位详情「直接聊」进来带 :id，
  // 消息 Tab 那条直聊行没有 id，取数函数会回落到看市场第一个岗（就是那条会话的对象）
  const { id: 岗位编号 } = useParams<{ id: string }>();
  const 对方 = 取直聊对象(岗位编号);
  const [消息, 设消息] = useState<会话条[]>(对方.消息);
  const [草稿, 设草稿] = useState('');
  // 换微信 / 换电话 点过就算交换完成；发简历 点过落「已发」态，不可再点
  const [已完成, 设已完成] = useState<string[]>([]);
  // 交换排当前展开的联系卡（'换电话' | '换微信' | null）。只有换过的才可展开
  const [展开项, 设展开项] = useState<string | null>(null);
  // 右上「⋯」拉起的举报层：直聊是双方已互相看到身份的场景，举报与屏蔽都指向具体那家公司
  const [举报层开, 设举报层开] = useState(false);
  const 底部锚 = use自动滚到底(消息);

  // 交换排的点击：换电话/换微信 首次点 = 完成交换（消息流落系统消息）并展开联系卡，
  // 之后点 = 开关联系卡；发简历 一次性，点过即「已发」。反馈文案与原底部功能键一致。
  const 交换反馈: Record<string, string> = {
    换微信: '你们已交换微信 · 对方微信号已发到你的消息',
    换电话: '你们已交换电话 · 138****2046',
    发简历: '已发送简历（隐去联系方式）· 沈亦舟_简历_2026.pdf',
  };
  const 点交换项 = (名: string) => {
    if (!已完成.includes(名)) {
      设已完成((旧) => [...旧, 名]);
      设消息((旧) => [...旧, { 编号: Date.now(), 类型: '系统', 内容: 交换反馈[名] }]);
      if (名 !== '发简历') 设展开项(名);
      return;
    }
    if (名 !== '发简历') 设展开项((旧) => (旧 === 名 ? null : 名));
  };


  // 同一条路由上换参数（换个岗再点直接聊）不会重挂载组件，不重置就会看到上一个岗的
  // 聊天记录。首帧不进这个分支，避免白白多渲染一次
  const 上次岗位编号 = useRef(岗位编号);
  useEffect(() => {
    if (上次岗位编号.current === 岗位编号) return;
    上次岗位编号.current = 岗位编号;
    设消息(对方.消息);
    设已完成([]);
  }, [岗位编号, 对方.消息]);

  // 发送：草稿去空后追加到本地消息流，随即清空输入框
  const 发送 = () => {
    const 内容 = 草稿.trim();
    if (!内容) return;
    const 新条: 会话条 = { 编号: Date.now(), 角色: '我', 时间: '刚刚', 内容 };
    设消息((旧) => [...旧, 新条]);
    设草稿('');
  };

  return (
    <次级页外壳 对话底>
      <返回栏
        返回={返回}
        标题={对方.姓名}
        副标题={[对方.机构, 对方.职务].filter(Boolean).join(' · ')}
        居中标题
        右侧={
          <button
            className={`${样式.更多} 可点`}
            onClick={() => 设举报层开(true)}
            aria-label="举报"
          >
            ⋯
          </button>
        }
      />

      {/* 顶部交换排：三格与 真人会话操作栏 同一套 CSS（视觉两端同构），
          但都是「换」——首次点完成交换并落系统消息，换过的电话/微信可展开联系卡 */}
      <div className={排样式.操作栏}>
        {(
          [
            { 名: '换电话', 短名: '电话', 画: (色: string) => <电话图标 尺寸={18} 色={色} /> },
            { 名: '换微信', 短名: '微信', 画: (色: string) => <微信图标 尺寸={18} 色={色} /> },
          ] as const
        ).map((项) => {
          const 已换 = 已完成.includes(项.名);
          const 已展开 = 展开项 === 项.名;
          return (
            <button
              key={项.名}
              className={`${排样式.项} ${已展开 ? 排样式.项展开 : ''} 可点`}
              onClick={() => 点交换项(项.名)}
              aria-expanded={已展开}
            >
              <span className={排样式.项图}>{项.画(已展开 ? '#2f5c17' : '#6f7268')}</span>
              {/* 换过之后名字落回「电话 / 微信」——动作已完成，剩下的只是看 */}
              <span className={排样式.项名}>{已换 ? 项.短名 : 项.名}</span>
            </button>
          );
        })}
        {已完成.includes('发简历') ? (
          <div className={`${排样式.项} ${样式.排项已完成}`}>
            <span className={排样式.项图}>
              <细对勾图标 />
            </span>
            <span className={排样式.项名}>已发简历</span>
          </div>
        ) : (
          <button className={`${排样式.项} 可点`} onClick={() => 点交换项('发简历')}>
            <span className={排样式.项图}>
              <简历图标 尺寸={18} 色="#6f7268" />
            </span>
            <span className={排样式.项名}>发简历</span>
          </button>
        )}
      </div>

      {展开项 ? (
        <div className={排样式.展开区}>
          <div className={样式.联系条}>
            <联系卡
              名={展开项 === '换电话' ? '电话' : '微信'}
              对方={展开项 === '换电话' ? 对方.联系方式.电话 : 对方.联系方式.微信}
            />
          </div>
        </div>
      ) : null}

      {/* 旁听提示条：交回按钮把话头还给 AI 代理，因此跳到「问AI代理」对话页 */}
      <div className={样式.旁听条}>
        <span className={样式.小盾牌}>
          <代理标 尺寸={13} 带点={false} />
        </span>
        <span className={样式.旁听文字}>你选择了自己聊，AI代理在旁听：只提醒、不插话</span>
        <button className={`${样式.交回} 可点`} onClick={() => 跳转(路径.问AI代理)}>
          交回AI代理
        </button>
      </div>

      <滚动区>
        <div className={样式.消息流}>
          {消息.map((条) => (
            <消息条 key={条.编号} 条={条} 对方首字={对方.首字} />
          ))}
          <div ref={底部锚} />
        </div>
      </滚动区>


      <真输入条 占位="发消息…" 值={草稿} 改变={设草稿} 发送={发送} 灰边 />

      {举报层开 ? (
        <举报层
          对象名={`${对方.姓名} · ${对方.机构}`}
          屏蔽名称={对方.岗位公司}
          关闭={() => 设举报层开(false)}
        />
      ) : null}
    </次级页外壳>
  );
}

// ── 共用件 1：新消息进来时把滚动区拉到底 ────────────────────────
// RN 里靠 ScrollView 的 onContentSizeChange + scrollToEnd；DOM 里用末尾锚点
// scrollIntoView，最近的可滚动祖先（滚动区）会被最小化滚动到底部。
export function use自动滚到底(依赖: unknown) {
  const 底部锚 = useRef<HTMLDivElement>(null);
  useEffect(() => {
    底部锚.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [依赖]);
  return 底部锚;
}

// ── 共用件 2：一条消息 ─────────────────────────────────────────
// 会话条是联合类型：带「类型」字段的是系统 / 日期 / 代理提醒三种居中条，
// 其余按「角色」分我方（右、绿气泡）和对方（左、头像 + 白气泡）。
export function 消息条({ 条, 对方首字 }: { 条: 会话条; 对方首字: string }) {
  if ('类型' in 条) {
    if (条.类型 === '系统') {
      return (
        <div className={样式.居中行}>
          <span className={样式.系统胶囊}>{条.内容}</span>
        </div>
      );
    }
    if (条.类型 === '日期') {
      return (
        <div className={样式.居中行}>
          <span className={样式.日期}>{条.内容}</span>
        </div>
      );
    }
    // 代理提醒：旁听中的 AI 代理插的一条灰色提示，不属于任何一方
    return (
      <div className={样式.居中行}>
        <div className={样式.提醒条}>
          <span className={样式.提醒文字}>
            <b className={样式.提醒标}>◈ AI代理提醒</b> · {条.内容}
          </span>
        </div>
      </div>
    );
  }

  if (条.角色 === '我') {
    return (
      <div className={样式.我方行}>
        {/* 我方头像（标注 23:59）：与对方头像对称，挂在气泡右侧 */}
        <div className={样式.我气泡组}>
          <div className={样式.我气泡}>
            <div className={样式.气泡文字}>{条.内容}</div>
          </div>
          <span className={样式.我头像}>{我的信息.首字}</span>
        </div>
        {条.时间 ? <span className={`${样式.时间戳} ${样式.时间戳带头像}`}>{条.时间}</span> : null}
      </div>
    );
  }

  return (
    <div className={样式.对方行}>
      <span className={样式.对方头像}>{对方首字}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className={样式.对方气泡}>
          <div className={样式.气泡文字}>{条.内容}</div>
        </div>
        {条.时间 ? <span className={样式.时间戳}>{条.时间}</span> : null}
      </div>
    </div>
  );
}

// ── 共用件：联系卡（点一下复制）。原「共用件 3 功能键行」2026-08-24 随交换排上移删除 ──
export function 联系卡({ 名, 对方 }: { 名: string; 对方: string }) {
  const 类 = 名.replace('换', '').replace('发', '');
  const 复制 = async (值: string) => {
    const 纯值 = 值.replace(/\s/g, '');
    try {
      await navigator.clipboard.writeText(纯值);
      轻提示(`已复制${类}：${值}`);
    } catch {
      try {
        const 框 = document.createElement('textarea');
        框.value = 纯值;
        框.style.position = 'fixed';
        框.style.opacity = '0';
        document.body.appendChild(框);
        框.select();
        document.execCommand('copy');
        框.remove();
        轻提示(`已复制${类}：${值}`);
      } catch {
        轻提示('复制失败，长按手动复制');
      }
    }
  };
  return (
    <button className={`${样式.联系行} 可点`} onClick={() => 复制(对方)}>
      <span className={样式.联系谁}>{类}</span>
      <span className={`${样式.联系值} 等宽数字`}>{对方}</span>
      <span className={样式.复制符} aria-hidden>⧉</span>
    </button>
  );
}

