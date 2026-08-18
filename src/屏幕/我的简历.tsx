// A17 我的简历 · 编辑页（从「我的」头像 / 宫格进入）
//
// 结构：返回栏（居中标题）→ 代理诊断绿条 → 基本信息 → 工作经历 → 个人优势 → 附件简历。
// 简历字段本身在原型阶段不落库，所以这一屏只做「读 + 跳到对应编辑屏」，不做就地表单。

import { useState } from 'react';
import 样式 from './我的简历.module.css';
import { 次级页外壳, 返回栏, 滚动区, 表单条目 } from '../组件/通用';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { 个人优势文本, 我的信息 } from '../数据/模拟数据';
import { use应用状态 } from '../状态/应用状态';

// 模拟数据里第二段工作经历只有一行摘要串，而设计稿要求「公司 / 职位 / 时间·行业」三行，
// 所以这里按设计稿的三行文本写死在本屏，等接后端时整段换成接口字段。
/** 基本信息四条的键：也直接用作屏幕上的标签 */
type 基本字段 = '姓名' | '工作年限' | '最高学历' | '当前状态';

/** 'yyyy-MM' → 'yyyy.MM'；null → '至今' */
function 显示年月(值: string | null): string {
  return 值 ? 值.replace('-', '.') : '至今';
}

export default function 我的简历() {
  const { 返回, 跳转 } = use导航();
  // 工作经历/教育读全局简历切片：在工作经历页改完，这里立刻是新的
  const { 状态: 全局 } = use应用状态();
  const 经历列表 = 全局.简历经历;
  const 教育 = 全局.简历教育;

  // 诊断条「去查看」展开代理挑出的待优化项；附件行点一下给一条说明，避免点了没反应
  const [展开诊断, 设展开诊断] = useState(false);
  const [显示附件说明, 设显示附件说明] = useState(false);

  // 基本信息行内可编辑（标注意见 #6）：点一行就地变输入框，原型存内存
  const [基本信息, 设基本信息] = useState<Record<基本字段, string>>({
    姓名: 我的信息.姓名,
    工作年限: '9 年',
    最高学历: `${全局.简历教育.学历} · ${全局.简历教育.专业}`,
    当前状态: 我的信息.状态,
  });
  const [编辑中字段, 设编辑中字段] = useState<基本字段 | null>(null);

  return (
    <次级页外壳>
      <返回栏 返回={返回} 标题="我的简历" 居中标题 />

      {/* 代理诊断绿条：代理把简历里「谈判时会吃亏」的地方挑出来 */}
      <div className={样式.诊断区}>
        <div className={样式.诊断条}>
          <span className={样式.诊断标}>◈ AI代理诊断 · 2 项待优化</span>
          <span className={`${样式.诊断说明} 单行`}>量化战绩可再补一条 · 期权偏好未填</span>
          <button
            className={`${样式.诊断键} 可点`}
            onClick={() => 设展开诊断((旧) => !旧)}
          >
            {展开诊断 ? '收起' : '去查看'}
          </button>
        </div>

        {展开诊断 ? (
          <div className={样式.诊断详情}>
            <div className={样式.诊断项}>① 「稳定性」只写了 QPS，建议补一条成本或故障率的量化战绩。</div>
            <div className={样式.诊断项}>② 期权偏好未填 —— 现金带谈不动时，我没有第二个可让的筹码。</div>
          </div>
        ) : null}
      </div>

      <滚动区>
        <div className={样式.列表}>
          {/* 基本信息：姓名在意向确认前对企业不可见。
              标注意见 #6：四条全部行内可编辑 —— 点一行就地变输入框 */}
          <div className={样式.卡}>
            <div className={样式.卡标题}>基本信息</div>
            <div className={样式.条目区}>
              {(Object.keys(基本信息) as 基本字段[]).map((字段) => (
                <可改条目
                  key={字段}
                  标签={字段 === '姓名' ? '姓名（仅意向确认后披露）' : 字段}
                  值={基本信息[字段]}
                  编辑中={编辑中字段 === 字段}
                  开始编辑={() => 设编辑中字段(字段)}
                  结束编辑={() => 设编辑中字段(null)}
                  改变={(新值) => 设基本信息((旧) => ({ ...旧, [字段]: 新值 }))}
                />
              ))}
            </div>
          </div>

          {/* 工作经历：全部段落来自全局简历切片，点任意一段进编辑屏 */}
          <div className={样式.卡}>
            <div className={样式.卡标题}>工作经历</div>
            {经历列表.map((条, 序) => (
              <button
                key={条.编号}
                className={`${样式.经历行} ${序 === 经历列表.length - 1 ? 样式.末行 : ''} 可点`}
                onClick={() => 跳转(路径.工作经历)}
              >
                <span className={样式.经历主体}>
                  <span className={样式.经历公司}>{条.公司}</span>
                  <span className={样式.经历职位}>{条.职位}</span>
                  <span className={样式.经历时间}>
                    {显示年月(条.开始)} — {显示年月(条.结束)}
                    {条.行业 ? ` · ${条.行业}` : ''}
                  </span>
                </span>
                <span className={样式.尖括号}>›</span>
              </button>
            ))}
          </div>

          {/* 教育经历：与工作经历同源，点进同一个编辑屏 */}
          <div className={样式.卡}>
            <div className={样式.卡标题}>教育经历</div>
            <button
              className={`${样式.经历行} ${样式.末行} 可点`}
              onClick={() => 跳转(路径.工作经历)}
            >
              <span className={样式.经历主体}>
                <span className={样式.经历公司}>{教育.学校}</span>
                <span className={样式.经历职位}>
                  {教育.学历} · {教育.专业}
                </span>
                <span className={样式.经历时间}>
                  {显示年月(教育.开始)} — {显示年月(教育.结束)}
                </span>
              </span>
              <span className={样式.尖括号}>›</span>
            </button>
          </div>

          {/* 个人优势：数据里是带 \n 的多行串，靠 white-space: pre-line 还原换行 */}
          <div className={样式.卡}>
            <div className={样式.卡标题}>个人优势</div>
            <div className={样式.优势正文}>{个人优势文本}</div>
          </div>

          {/* 附件简历：递交简历阶段由代理隐去联系方式后发出 */}
          <div className={样式.卡}>
            <div className={样式.卡标题}>附件简历</div>
            <button
              className={`${样式.附件行} 可点`}
              onClick={() => 设显示附件说明((旧) => !旧)}
            >
              <span className={样式.PDF块}>
                <span className={样式.PDF字}>PDF</span>
              </span>
              <span className={样式.附件主体}>
                <span className={样式.附件名}>沈亦舟_简历_2026.pdf</span>
                <span className={样式.附件说明}>递交简历阶段自动隐去联系方式后发送</span>
              </span>
              <span className={样式.尖括号}>›</span>
            </button>
            {显示附件说明 ? (
              <div className={样式.附件提示}>原型演示：真机上在这里打开系统 PDF 预览。</div>
            ) : null}
          </div>
        </div>
      </滚动区>
    </次级页外壳>
  );
}

/** 一行可行内编辑的条目（同 工作经历 屏当年的模式）：
 *  只读态复用地基 <表单条目>，点一下换成同版式输入框，切换不跳动 */
function 可改条目({
  标签,
  值,
  编辑中,
  开始编辑,
  结束编辑,
  改变,
}: {
  标签: string;
  值: string;
  编辑中: boolean;
  开始编辑: () => void;
  结束编辑: () => void;
  改变: (新值: string) => void;
}) {
  if (!编辑中) {
    return <表单条目 标签={标签} 值={值} 按下={开始编辑} />;
  }
  return (
    <div className={样式.编辑条目}>
      <div className={样式.编辑条目标签}>{标签}</div>
      <input
        className={样式.编辑条目输入}
        value={值}
        aria-label={标签}
        autoFocus
        onChange={(事件) => 改变(事件.target.value)}
        onBlur={结束编辑}
        onKeyDown={(事件) => {
          if (事件.key === 'Enter' && !事件.nativeEvent.isComposing) 结束编辑();
        }}
      />
    </div>
  );
}
