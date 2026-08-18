// D0/D0b/D0c 发布岗位 —— 三步合一：基础信息 → 职位描述 → 职位要求 + 硬性条件。
//
// 同构镜像：分步 + 顶部分段进度条来自求职端 引导问答（A3），
// 表单条目版式（小标签 + 大值输入 + 分隔线）来自求职端 工作经历 编辑页，
// 大 textarea 卡来自 引导问答 的个人优势题，像素值一比一保留。
//
// 双盲语义：薪资只有岗位自己的带（区间），没有任何报价 / 出价 UI；
// 硬性条件交给 AI 代理在匿名初筛执行，数值互不披露。
//
// 答案只存在内存里（原型层不落盘），全部 useState，不进全局应用状态。
// 发布是注册流程最后一步：跳 企业主壳（主壳内不放返回，不会退回注册页）。

import { useState } from 'react';
import 样式 from './发布岗位.module.css';
import 数字滚轮层 from '../组件/数字滚轮层';
import { 主按钮, 次级页外壳, 滚动区, 页面大标题, 返回栏 } from '../组件/通用';
import { 轻提示 } from '../组件/轻提示';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';

const 步骤顺序 = ['基础信息', '职位描述', '要求与硬性条件'] as const;

/** 办公方式快捷片。标注意见 2026-08-18：「混合 3+2」写成「混合」就行 ——
 *  具体几天几天由代理在谈判中核对，不该在发布时钉死 */
const 办公方式选项 = ['现场', '混合', '全远程'];

/** 硬性条件多选片：AI 代理在匿名初筛严格执行的过滤条件 */
const 硬性条件选项 = ['Go 主栈', '5 年以上', '常驻上海', '可混合办公'];

/** 职位描述预填：交易网关职责，风格对齐求职端职位详情的 JD 三行式 */
const 职位描述预填 = [
  '1、负责交易网关的架构演进与高可用治理，支撑大促峰值流量；',
  '2、主导订单与清结算链路的性能优化，压降端到端延迟与故障率；',
  '3、与风控、清算团队协作，建设全链路监控与灰度发布体系。',
].join('\n');

/** 职位要求预填：与下方硬性条件多选片一一呼应 */
const 职位要求预填 = [
  '1、5 年以上后端经验，Go 主栈，熟悉高并发与分布式事务；',
  '2、有支付 / 交易 / 清结算系统实战，重稳定性与可观测性；',
  '3、常驻上海，可混合办公 3+2。',
].join('\n');

export default function 发布岗位() {
  const { 返回, 进企业主壳 } = use导航();
  const { 派发 } = use应用状态();
  const [第几步, 设第几步] = useState(0);

  // ── 第一步：基础信息 ──
  const [岗位名称, 设岗位名称] = useState('资深后端工程师 · 交易网关');
  const [工作城市, 设工作城市] = useState('上海');
  const [薪资下限, 设薪资下限] = useState('50');
  const [薪资上限, 设薪资上限] = useState('65');
  const [年薪月数, 设年薪月数] = useState(15);
  const [月数轮, 设月数轮] = useState(false);
  const [办公方式, 设办公方式] = useState('混合 3+2');

  // ── 第二步 / 第三步：描述与要求 ──
  const [职位描述, 设职位描述] = useState(职位描述预填);
  const [职位要求, 设职位要求] = useState(职位要求预填);
  const [已选硬性条件, 设已选硬性条件] = useState<string[]>(硬性条件选项);

  const 切换硬性条件 = (项: string) =>
    设已选硬性条件((旧) => (旧.includes(项) ? 旧.filter((条) => 条 !== 项) : [...旧, 项]));

  /** 必填校验：岗位名称与薪资带；返回提示文案，齐了返回 null */
  const 必填缺失 = (): string | null => {
    if (岗位名称.trim() === '') return '请填写岗位名称';
    if (薪资下限.trim() === '' || 薪资上限.trim() === '') return '请填写薪资带';
    return null;
  };

  const 下一步 = () => {
    // 必填字段都在第一步，第一步的「下一步」就是校验关卡
    if (第几步 === 0) {
      const 错 = 必填缺失();
      if (错) {
        轻提示(错);
        return;
      }
    }
    if (第几步 < 步骤顺序.length - 1) {
      设第几步(第几步 + 1);
      return;
    }
    // 发布前兜底再验一次：用户可能回到第一步清空后又直接翻到第三步
    const 错 = 必填缺失();
    if (错) {
      轻提示(错);
      设第几步(0);
      return;
    }
    // 真的落进岗位列表：发布完回到人才页，顶栏第一个就是它（标注意见 2026-08-18）
    派发({
      型: '发布岗位',
      名称: 岗位名称.trim(),
      薪资带: `${薪资下限.trim()}-${薪资上限.trim()}K`,
    });
    轻提示('岗位已发布');
    进企业主壳();
  };

  const 上一步 = () => {
    if (第几步 === 0) 返回();
    else 设第几步(第几步 - 1);
  };

  return (
    <次级页外壳>
      <div className={样式.发布壳}>
        <返回栏 返回={上一步} />

        {/* 进度条：已走过的段（含当前步）填荧光绿，同 引导问答 */}
        <div className={样式.进度轨}>
          {步骤顺序.map((步, 序) => (
            <span
              key={步}
              className={`${样式.进度段} ${序 <= 第几步 ? 样式.进度段已过 : ''}`}
            />
          ))}
        </div>

        {第几步 === 0 ? (
          <基础信息步
            岗位名称={岗位名称}
            设岗位名称={设岗位名称}
            工作城市={工作城市}
            设工作城市={设工作城市}
            薪资下限={薪资下限}
            设薪资下限={设薪资下限}
            薪资上限={薪资上限}
            设薪资上限={设薪资上限}
            年薪月数={年薪月数}
            设年薪月数={设年薪月数}
            月数轮={月数轮}
            设月数轮={设月数轮}
            办公方式={办公方式}
            设办公方式={设办公方式}
          />
        ) : null}
        {第几步 === 1 ? <职位描述步 文本={职位描述} 设文本={设职位描述} /> : null}
        {第几步 === 2 ? (
          <职位要求步
            文本={职位要求}
            设文本={设职位要求}
            已选={已选硬性条件}
            切换={切换硬性条件}
          />
        ) : null}

        <主按钮
          文字={第几步 === 步骤顺序.length - 1 ? '发布 · AI代理开始寻访' : '下一步'}
          按下={下一步}
        />
      </div>
    </次级页外壳>
  );
}

// ── D0 第一步：基础信息（名称 / 城市 / 薪资带 / 年薪月数 / 办公方式）──
function 基础信息步({
  岗位名称,
  设岗位名称,
  工作城市,
  设工作城市,
  薪资下限,
  设薪资下限,
  薪资上限,
  设薪资上限,
  年薪月数,
  设年薪月数,
  月数轮,
  设月数轮,
  办公方式,
  设办公方式,
}: {
  岗位名称: string;
  设岗位名称: (值: string) => void;
  工作城市: string;
  设工作城市: (值: string) => void;
  薪资下限: string;
  设薪资下限: (值: string) => void;
  薪资上限: string;
  设薪资上限: (值: string) => void;
  年薪月数: number;
  设年薪月数: (值: number) => void;
  月数轮: boolean;
  设月数轮: (开: boolean) => void;
  办公方式: string;
  设办公方式: (值: string) => void;
}) {
  return (
    <滚动区 样式覆盖={{ paddingBottom: 12 }}>
      <页面大标题
        标题="岗位基础信息"
        说明="名称、城市与薪资带会展示在职位详情里，薪资只作区间披露。"
      />

      <div className={样式.表单区}>
        <div className={样式.编辑条目}>
          <div className={样式.条目标签}>岗位名称</div>
          <input
            className={样式.条目输入}
            value={岗位名称}
            placeholder="必填，如：资深后端工程师 · 交易网关"
            onChange={(事件) => 设岗位名称(事件.target.value)}
          />
        </div>

        <div className={样式.编辑条目}>
          <div className={样式.条目标签}>工作城市</div>
          <input
            className={样式.条目输入}
            value={工作城市}
            placeholder="如：上海"
            onChange={(事件) => 设工作城市(事件.target.value)}
          />
        </div>

        <div className={样式.编辑条目}>
          <div className={样式.条目标签}>薪资带（月薪 · K）</div>
          <div className={样式.薪资行}>
            <薪资数字框 值={薪资下限} 改变={设薪资下限} 名称="月薪下限" />
            <span className={样式.薪资连字}>—</span>
            <薪资数字框 值={薪资上限} 改变={设薪资上限} 名称="月薪上限" />
          </div>
        </div>

        {/* 年薪月数：点开滚轮（12 起）或手填。原来四个快捷片把范围钉死在
            13-16 薪，12 薪和 18/24 薪的岗位根本填不了（标注意见 2026-08-18）*/}
        <button className={`${样式.选择条目} 可点`} onClick={() => 设月数轮(true)}>
          <span className={样式.条目标签}>年薪月数</span>
          <span className={样式.选择条目值行}>
            <span className={`${样式.条目值} 等宽数字`}>{年薪月数} 薪</span>
            <span className={样式.尖括号}>›</span>
          </span>
        </button>

        <div className={样式.编辑条目}>
          <div className={样式.条目标签}>办公方式</div>
          <div className={样式.快捷片行}>
            {办公方式选项.map((项) => (
              <button
                key={项}
                className={`${样式.快捷片} ${办公方式 === 项 ? 样式.快捷片选中 : ''} 可点`}
                onClick={() => 设办公方式(项)}
              >
                {项}
              </button>
            ))}
          </div>
        </div>
      </div>

      {月数轮 ? (
        <数字滚轮层
          标题="年薪月数"
          初值={年薪月数}
          最小={12}
          最大={30}
          单位="薪"
          手填上界={36}
          确认={(值) => {
            设年薪月数(值);
            设月数轮(false);
          }}
          取消={() => 设月数轮(false)}
        />
      ) : null}
    </滚动区>
  );
}

/** 薪资数字输入：只收数字，K 单位挂在框内右侧 */
function 薪资数字框({
  值,
  改变,
  名称,
}: {
  值: string;
  改变: (值: string) => void;
  名称: string;
}) {
  return (
    <span className={样式.薪资框}>
      <input
        className={`${样式.薪资数字输入} 等宽数字`}
        value={值}
        placeholder="必填"
        inputMode="numeric"
        aria-label={名称}
        onChange={(事件) => 改变(事件.target.value.replace(/\D/g, '').slice(0, 3))}
      />
      <span className={样式.薪资单位}>K</span>
    </span>
  );
}

// ── D0b 第二步：职位描述（大 textarea）──
function 职位描述步({ 文本, 设文本 }: { 文本: string; 设文本: (值: string) => void }) {
  return (
    <滚动区 样式覆盖={{ paddingBottom: 12 }}>
      <页面大标题
        标题="职位描述"
        说明="写清楚这个岗位做什么，AI代理会照此向候选人介绍。"
      />

      <div className={样式.描述卡}>
        <textarea
          className={样式.描述输入}
          value={文本}
          onChange={(事件) => 设文本(事件.target.value)}
          maxLength={500}
          aria-label="职位描述"
        />
        <div className={样式.描述底}>
          <span className={`${样式.描述计数} 等宽数字`}>{文本.length} / 500</span>
        </div>
      </div>
    </滚动区>
  );
}

// ── D0c 第三步：职位要求 + 硬性条件多选 ──
function 职位要求步({
  文本,
  设文本,
  已选,
  切换,
}: {
  文本: string;
  设文本: (值: string) => void;
  已选: string[];
  切换: (项: string) => void;
}) {
  return (
    <滚动区 样式覆盖={{ paddingBottom: 12 }}>
      <页面大标题
        标题="职位要求"
        说明="要求写给人看，硬性条件交给 AI 代理执行。"
      />

      <div className={样式.描述卡}>
        <textarea
          className={样式.描述输入}
          value={文本}
          onChange={(事件) => 设文本(事件.target.value)}
          maxLength={500}
          aria-label="职位要求"
        />
        <div className={样式.描述底}>
          <span className={`${样式.描述计数} 等宽数字`}>{文本.length} / 500</span>
        </div>
      </div>

      <div className={样式.硬性区}>
        <div className={样式.条目标签}>硬性条件（多选）</div>
        <div className={样式.快捷片行}>
          {硬性条件选项.map((项) => {
            const 选中 = 已选.includes(项);
            return (
              <button
                key={项}
                className={`${样式.快捷片} ${选中 ? 样式.快捷片选中 : ''} 可点`}
                onClick={() => 切换(项)}
              >
                {选中 ? `${项} ✓` : 项}
              </button>
            );
          })}
        </div>
        <div className={样式.硬性说明}>
          硬性条件由 AI 代理在匿名初筛严格执行，数值互不披露。
        </div>
      </div>
    </滚动区>
  );
}
