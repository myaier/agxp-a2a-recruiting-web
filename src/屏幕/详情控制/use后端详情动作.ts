// use后端详情动作 —— Backend 详情动作控制 hook（契约 C，Task 5 交付 S0 分支）。
// respond_fact / end_screening 的业务控制自 屏幕/P5/MatchCase详情 的 阶段动作区 原样
// 搬入，命令参数与旧实现逐项一致；S1–S3 动作仍由原屏控制暂留（Task 6/8 迁入），
// 简历选择/披露确认 本阶段恒 null，返回合同不再变。
//
// 生命周期（plan 固定）：回答在飞表归父读取控制（当前为路由实例 MatchCase详情 持有，
// Task 9 迁入 use后端详情控制）并经 回答在飞表 传入 —— 动作卡随段折叠/换单整体卸载也
// 不丢锁；本 hook 自持回答草稿与局部代际（卸载/换 case 递增），旧单迟到的成败回调对
// 不上代际即整包作废，绝不改动新单草稿。未知动作/非法状态继续由原 decoder/映射层拒绝，
// 本 hook 不画任何未提供的动作。

import { useEffect, useRef, useState, type RefObject } from 'react';
import { 轻提示 } from '../../组件/轻提示';
import { 取后端错误文案 } from '../../数据/HTTP客户端';
import type { 详情动作卡信息, 事实问题属性, 简历选择属性, 确认属性 } from '../../组件/在谈详情/类型';
import type { P5详情正常视图, P5角色 } from '../../数据/MatchCase展示映射';
import type { P5详情 } from '../../数据/招聘数据源/MatchCase';
import type { 应用操作 } from '../../状态/后端/类型';

/** 契约 C 的输入（动作操作面与 屏幕/P5 阶段动作区 的 动作操作 同形）。 */
export interface 后端详情动作输入 {
  role: P5角色;
  caseId: string;
  视图: P5详情正常视图;
  详情: P5详情;
  操作: Pick<
    应用操作,
    '回答事实' | '决定S0' | '决定S1' | '决定S2' | '决定S3' | '提交简历' | '准备候选委托简历'
  >;
  回答在飞表: RefObject<Map<string, Promise<void>>>;
}

export interface 后端详情动作结果 {
  卡片们: readonly 详情动作卡信息[];
  事实问题: 事实问题属性 | null;
  简历选择: 简历选择属性 | null;
  披露确认: 确认属性 | null;
  终结确认: 确认属性 | null;
}

export function use后端详情动作({
  role,
  caseId,
  视图,
  操作,
  回答在飞表,
}: 后端详情动作输入): 后端详情动作结果 {
  const [回答草稿, 设回答草稿] = useState('');
  // 回答提交的可见 in-flight（spec §10.3）：只锁回答区，不牵连其它动作卡；
  // 锁账按 caseId 记在父级持有的表里（操作层同 (role,case,action,prompt) 单飞会复用
  // 在飞 POST —— 回原单时若已放锁，新草稿会绑上旧承诺被静默吞掉），表里存的是已收口
  // 的承诺链（catch 已吞错，恒 resolve），回原单的续锁观察者靠它收口解锁。
  const [回答提交中, 设回答提交中] = useState(false);
  // 决定S0(end) 的写中锁（与旧 阶段动作区 的 写中 同语义：POST 期间禁再点）
  const [写中, 设写中] = useState(false);
  // 结束初筛的二次确认（不可逆）：确认前零请求
  const [待结束确认, 设待结束确认] = useState(false);

  // 局部代际（原 准备代际 的 S0 部分）：卸载与换 case 都递增；迟到的成败对不上代际
  // 即整包静默作废（换 case 后旧回调不得改动新单草稿/新单 pending）。
  const 代际 = useRef(0);
  useEffect(() => () => {
    代际.current += 1;
  }, []);
  useEffect(() => {
    代际.current += 1;
    const 本轮 = 代际.current;
    设回答草稿('');
    设待结束确认(false);
    // 离开又回到同一单且回答仍在飞：续锁到旧请求收口（同键单飞复用旧 POST，不能放锁）；
    // 他单在飞或无在飞：本单回答区干净起步。
    const 在飞 = 回答在飞表.current.get(caseId);
    设回答提交中(在飞 !== undefined);
    if (在飞 !== undefined) {
      void 在飞.finally(() => {
        if (代际.current === 本轮) 设回答提交中(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 回答在飞表是父级持有的稳定 ref，身份恒定
  }, [caseId]);

  const 报错 = (错误: unknown) => 轻提示(取后端错误文案(错误));

  /** 命令包装：服务端先行，失败原地提示；权威重读归操作层（本 hook 绝不本地重建）。 */
  const 发命令 = async (运行: () => Promise<void>) => {
    if (写中 || caseId === '') return;
    设写中(true);
    try {
      await 运行();
    } catch (错误) {
      报错(错误);
    } finally {
      设写中(false);
    }
  };

  // respond_fact：typed promptId 来自映射层的唯一匹配（零/多条整页契约错误，到不了这里）
  const 发回答 = () => {
    const 内容 = 回答草稿.trim();
    const 问题 = 视图.补充问题;
    if (内容 === '' || 问题 === null || caseId === '' || 回答在飞表.current.has(caseId)) return;
    const 本轮 = 代际.current; // 换单/卸载后迟到的成败对不上代际即整包作废
    const promise = 操作.回答事实(role, caseId, 问题.promptId, 内容)
      .then(() => {
        if (代际.current === 本轮) 设回答草稿(''); // 仅成功清空；卡随操作层重读消失
      })
      .catch((错误: unknown) => {
        if (代际.current === 本轮) 报错(错误);
      })
      .finally(() => {
        回答在飞表.current.delete(caseId);
        if (代际.current === 本轮) 设回答提交中(false);
      });
    回答在飞表.current.set(caseId, promise);
    设回答提交中(true);
  };

  // S0 两卡：只从 视图.actions 的映射交集出卡，标题/说明原样保留。招聘端结束卡零控件
  // 零请求（wire 缺 recruiter decisions 臂，fail closed）；候选端结束键只保留 end 一条
  // 准许路线（继续不是前端授权动作）。respond_fact 的提交控件归 事实问题，不双挂载。
  const 卡片们: 详情动作卡信息[] = [];
  for (const 卡 of 视图.actions) {
    if (卡.action === 'respond_fact') {
      卡片们.push({ 键: 'respond_fact', 标题: 卡.标题, 说明: 卡.说明, 按钮们: [] });
    } else if (卡.action === 'end_screening') {
      卡片们.push({
        键: 'end_screening',
        标题: 卡.标题,
        说明: 卡.说明,
        按钮们: role === 'candidate'
          ? [
              {
                键: 'end_screening',
                文案: '结束初筛',
                外观: '次要',
                禁用说明: null,
                执行: 写中 ? null : () => 设待结束确认(true),
              },
            ]
          : [],
      });
    }
  }

  // respond_fact 的回答区：缺 typed 问题即无提交控件（映射层已挡，防御性收口）
  const 有回答卡 = 视图.actions.some((卡) => 卡.action === 'respond_fact');
  const 问题视图 = 视图.补充问题;
  const 事实问题: 事实问题属性 | null = !有回答卡 || 问题视图 === null
    ? null
    : {
        问题: 问题视图.text,
        草稿: 回答草稿,
        改草稿: 设回答草稿,
        提交: {
          键: '提交回答',
          文案: 回答提交中 ? '提交中…' : '提交回答',
          外观: '主要',
          禁用说明: null,
          执行: 回答提交中 ? null : 发回答,
        },
      };

  // 结束初筛的二次确认（原确认语义原样保留）：确认才发 决定S0(caseId, 'end')
  const 终结确认: 确认属性 | null = !待结束确认
    ? null
    : {
        标题: '结束本次匿名初筛？',
        正文: '结束后这一单立即终止，无法恢复。',
        执行文: '结束初筛',
        取消文: '暂不结束',
        取消: () => 设待结束确认(false),
        执行: () => {
          设待结束确认(false);
          void 发命令(() => 操作.决定S0(caseId, 'end'));
        },
      };

  return {
    卡片们,
    事实问题,
    简历选择: null, // S1 单选（Task 6 交付）：本 Task 只声明合同
    披露确认: null, // S1 Case 专属披露确认（Task 6 交付）
    终结确认,
  };
}
