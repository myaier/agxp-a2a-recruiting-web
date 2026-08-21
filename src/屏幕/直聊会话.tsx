// A26 直聊会话 · AI代理旁听 —— 求职者选择自己上场聊，AI代理退到旁听位。
//
// 结构：返回栏（居中标题 + ⋯）→ 旁听提示条 → 消息流 → 功能键行 → 真输入条（灰边）。
//
// 本文件同时是「两屏共用件」的所在地：消息条 / 功能键行 / 自动滚到底 三个共用件
// 从这里 export，真人会话.tsx 直接 import，避免同一套气泡样式写两遍。

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import 样式 from './直聊会话.module.css';
import { 轻提示 } from '../组件/轻提示';
import { 次级页外壳, 返回栏, 滚动区, 真输入条 } from '../组件/通用';
import { 细对勾图标 } from '../组件/图标';
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
  // 换微信 / 换电话 / 发简历 点过就落到「已完成」态（灰底 + 细对勾），不可再点
  const [已完成, 设已完成] = useState<string[]>([]);
  // 右上「⋯」拉起的举报层：直聊是双方已互相看到身份的场景，举报与屏蔽都指向具体那家公司
  const [举报层开, 设举报层开] = useState(false);
  const 底部锚 = use自动滚到底(消息);

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

      <功能键行
        名单={['换微信', '换电话', '发简历']}
        已完成={已完成}
        标记完成={(名) => {
          设已完成((旧) => [...旧, 名]);
          // 标注意见 #5：点了不能只是按钮变灰，动作要在消息流里画出来
          const 反馈: Record<string, string> = {
            换微信: '你们已交换微信 · 对方微信号已发到你的消息',
            换电话: '你们已交换电话 · 138****2046',
            发简历: '已发送简历（隐去联系方式）· 沈亦舟_简历_2026.pdf',
          };
          设消息((旧) => [...旧, { 编号: Date.now(), 类型: '系统', 内容: 反馈[名] }]);
        }}
      />

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

// ── 共用件 3：底部功能键行 ─────────────────────────────────────
// 名单给顺序，已完成给状态：在已完成里的渲染成「已+名」的灰底对勾键（div，不可点），
// 其余渲染成可点白键，点一下即标记完成。两屏只是初始已完成集合不同。
/** 对方联系方式行（标注 2026-08-21 10:14 重做）：钉在聊天流顶部，只显示对方的，
    自己的号码没必要占位置；点一下复制 */
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

export function 功能键行({
  名单,
  已完成,
  标记完成,
}: {
  名单: string[];
  已完成: string[];
  标记完成: (名: string) => void;
}) {
  return (
    <div className={样式.功能行}>
      {名单.map((名) =>
        已完成.includes(名) ? (
          <div key={名} className={样式.功能键已完成}>
            已{名}
            <细对勾图标 />
          </div>
        ) : (
          <button key={名} className={`${样式.功能键} 可点`} onClick={() => 标记完成(名)}>
            {名}
          </button>
        ),
      )}
    </div>
  );
}
