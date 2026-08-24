// A17 我的简历 · 编辑页（从「我的」头像 / 宫格进入）
//
// 结构：返回栏（居中标题）→ 代理诊断绿条 → 基本信息 → 工作经历（含关键项目）
// → 教育经历 → 专业技能 → 资格证书 → 个人优势 → 附件简历 → 再加一个求职意向。
// 每一块都读全局简历切片，写入口只有一个（工作经历页 / 基本信息页），这一屏负责
// 「看全 + 跳到对应编辑屏」，不做第二套编辑器 —— 两套编辑器必然写出两份不一致的数据。
//
// 这是本人视角，所以真名可以直接显示；对方视角是 组件/简历预览层.tsx，那里永远只有代号。

import { useState } from 'react';
import 样式 from './我的简历.module.css';
import { 次级页外壳, 返回栏, 滚动区, 表单条目 } from '../组件/通用';
import { 轻提示 } from '../组件/轻提示';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { use应用状态 } from '../状态/应用状态';
import { 取后端错误文案 } from '../数据/HTTP客户端';
import type { 基本信息 as 基本信息类型 } from '../数据/类型';

/** 'yyyy-MM' → 'yyyy.MM'；null → '至今' */
function 显示年月(值: string | null): string {
  return 值 ? 值.replace('-', '.') : '至今';
}

/** 身份 → 简历上的状态说法。「在职」默认保密求职，这是本产品的常态 */
const 状态文案: Record<基本信息类型['身份'], string> = {
  在校: '在校 · 看机会',
  在职: '在职 · 保密求职中',
  离职: '离职 · 随时到岗',
};

export default function 我的简历() {
  const { 返回, 跳转 } = use导航();
  // 全部简历数据读全局切片：在工作经历页 / 基本信息页改完，这里立刻是新的
  const { 状态: 全局, 操作 } = use应用状态();
  const 经历列表 = 全局.简历经历;

  /**
   * 代理诊断（标注 2026-08-18 21:22 重做）：这块的定位是「告诉用户哪里还缺信息」，
   * 所以按真实数据逐项算缺口，每条点一下直接跳去补 —— 不做写作辅导，
   * 也不提任何薪资筹码（代理不谈薪资，那是意向确认后你和 HR 自己谈的）。
   */
  const 诊断项 = (() => {
    const 项: { 文案: string; 去处: string }[] = [];
    if (!全局.基本信息.真名.trim() || !全局.基本信息.开始工作年) {
      项.push({ 文案: '基本信息没填全 —— 匿名初筛靠它核对年限要求', 去处: 路径.基本信息 });
    }
    const 缺内容 = 经历列表.filter((条) => !条.内容.trim());
    if (缺内容.length > 0) {
      项.push({
        文案: `${缺内容.length} 段工作经历还没写工作内容 —— 递交简历阶段对方只能看到职位名`,
        去处: 路径.工作经历,
      });
    }
    const 无项目 = 经历列表.filter((条) => !条.项目 || 条.项目.length === 0);
    if (无项目.length === 经历列表.length && 经历列表.length > 0) {
      项.push({ 文案: '还没填关键项目 —— 这是代理判断方向对口最直接的依据', 去处: 路径.工作经历 });
    }
    if (全局.简历技能.length < 5) {
      项.push({
        文案: `专业技能只有 ${全局.简历技能.length} 个 —— 初筛核对技术域时能用的证据偏少`,
        去处: 路径.工作经历,
      });
    }
    if (全局.简历教育.length === 0) {
      项.push({ 文案: '教育经历还没填 —— 很多岗位把学历写进硬性条件', 去处: 路径.工作经历 });
    }
    if (全局.简历证书.length === 0) {
      项.push({ 文案: '还没填资格证书（选填）—— 有的话是硬性核对的加分项', 去处: 路径.工作经历 });
    }
    return 项;
  })();
  const 教育列表 = 全局.简历教育;
  const 技能列表 = 全局.简历技能;
  const 证书列表 = 全局.简历证书;
  const 基本 = 全局.基本信息;

  // 诊断条「去查看」展开代理挑出的待优化项；附件行点一下给一条说明，避免点了没反应
  const [展开诊断, 设展开诊断] = useState(false);
  const [显示附件说明, 设显示附件说明] = useState(false);
  // 姓名支持行内改（标注意见 #6）；其余三项是派生值或别处的写入口，点了跳过去改
  // 姓名草稿：逐字输入只改本地态，blur/Enter 才调一次 操作.保存简历，避免每个按键产生 HTTP PATCH
  const [改名中, 设改名中] = useState(false);
  const [姓名草稿, 设姓名草稿] = useState(基本.真名);

  const 保存姓名 = async () => {
    设改名中(false);
    if (姓名草稿.trim() === 基本.真名.trim()) return;
    try {
      await 操作.保存简历({
        基本信息: { ...基本, 真名: 姓名草稿 },
        个人优势: 全局.个人优势,
        技能: 技能列表,
        经历: 经历列表,
        教育: 教育列表,
        证书: 证书列表,
      });
    } catch (错误) {
      轻提示(取后端错误文案(错误));
    }
  };

  const 当前年 = new Date().getFullYear();
  const 折算年限 = Math.max(0, 当前年 - (Number(基本.开始工作年) || 当前年));

  return (
    <次级页外壳>
      <返回栏 返回={返回} 标题="我的简历" 居中标题 />

      {/* 代理诊断绿条：代理把简历里「谈判时会吃亏」的地方挑出来 */}
      <div className={样式.诊断区}>
        <div className={样式.诊断条}>
          <span className={样式.诊断标}>
            {诊断项.length > 0
              ? `◈ AI代理诊断 · ${诊断项.length} 处待补全`
              : '◈ AI代理诊断 · 资料已补全'}
          </span>
          <span className={`${样式.诊断说明} 单行`}>
            {诊断项.length > 0 ? 诊断项[0].文案 : '硬性条件核对需要的信息都齐了'}
          </span>
          {诊断项.length > 0 ? (
            <button
              className={`${样式.诊断键} 可点`}
              onClick={() => 设展开诊断((旧) => !旧)}
            >
              {展开诊断 ? '收起' : '去补全'}
            </button>
          ) : null}
        </div>

        {展开诊断 && 诊断项.length > 0 ? (
          <div className={样式.诊断详情}>
            {诊断项.map((条) => (
              <button
                key={条.文案}
                className={`${样式.诊断项} 可点`}
                onClick={() => 跳转(条.去处)}
              >
                <span className={样式.诊断项文}>{条.文案}</span>
                <span className={样式.诊断项去}>去补 ›</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <滚动区>
        <div className={样式.列表}>
          {/* 基本信息：姓名在意向确认前对企业不可见，这里是本人视角所以照实显示。
              工作年限是 开始工作年 折算出来的派生值，不给单独编辑 —— 否则会出现
              「年限写 10 年、起始年份算出来 7 年」这种代理无从核对的自相矛盾数据 */}
          <div className={样式.卡}>
            <div className={样式.卡标题}>基本信息</div>
            <div className={样式.条目区}>
              <可改条目
                标签="姓名（仅意向确认后披露）"
                值={改名中 ? 姓名草稿 : 基本.真名}
                编辑中={改名中}
                开始编辑={() => { 设姓名草稿(基本.真名); 设改名中(true); }}
                结束编辑={保存姓名}
                改变={设姓名草稿}
              />
              <表单条目
                标签="工作年限"
                值={
                  基本.身份 === '在校'
                    ? '应届 · 在校'
                    : `${折算年限} 年 · 自 ${基本.开始工作年 || 当前年} 年起`
                }
                按下={() => 跳转(路径.基本信息)}
              />
              <表单条目
                标签="最高学历"
                值={教育列表[0] ? `${教育列表[0].学历} · ${教育列表[0].专业}` : '未填'}
                按下={() => 跳转(路径.工作经历)}
              />
              <表单条目
                标签="当前状态"
                值={状态文案[基本.身份]}
                按下={() => 跳转(路径.基本信息)}
              />
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
                  {/* 关键项目挂在所属经历下面（全是 span：外层已经是 button，不能再套 button）*/}
                  {(条.项目 ?? []).length > 0 ? (
                    <span className={样式.项目组}>
                      {(条.项目 ?? []).map((项) => (
                        <span key={项.编号} className={样式.项目行}>
                          <span className={样式.项目名}>{项.名称 || '未命名项目'}</span>
                          {项.角色 ? <span className={样式.项目附}>{项.角色}</span> : null}
                          {项.结果 ? <span className={样式.项目结果}>{项.结果}</span> : null}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </span>
                <span className={样式.尖括号}>›</span>
              </button>
            ))}
          </div>

          {/* 教育经历：与工作经历同源，点进同一个编辑屏 */}
          <div className={样式.卡}>
            <div className={样式.卡标题}>教育经历</div>
            {教育列表.map((条, 序) => (
              <button
                key={条.编号}
                className={`${样式.经历行} ${序 === 教育列表.length - 1 ? 样式.末行 : ''} 可点`}
                onClick={() => 跳转(路径.工作经历)}
              >
                <span className={样式.经历主体}>
                  <span className={样式.经历公司}>{条.学校}</span>
                  <span className={样式.经历职位}>
                    {条.学历} · {条.专业}
                  </span>
                  <span className={样式.经历时间}>
                    {显示年月(条.开始)} — {显示年月(条.结束)}
                  </span>
                </span>
                <span className={样式.尖括号}>›</span>
              </button>
            ))}
          </div>

          {/* 专业技能：与工作经历页同源。匿名初筛按标签逐条比对岗位技术要求 */}
          <div className={样式.卡}>
            <div className={样式.卡标题}>专业技能</div>
            <button
              className={`${样式.标签行} 可点`}
              onClick={() => 跳转(路径.工作经历)}
            >
              {技能列表.length > 0 ? (
                <span className={样式.标签组}>
                  {技能列表.map((项) => (
                    <span key={项} className={样式.标签}>
                      {项}
                    </span>
                  ))}
                </span>
              ) : (
                <span className={样式.空态}>还没填技能标签，去添加</span>
              )}
              <span className={样式.尖括号}>›</span>
            </button>
          </div>

          {/* 资格证书：部分岗位把它写进硬性条件，缺了会在初筛就被刷掉 */}
          <div className={样式.卡}>
            <div className={样式.卡标题}>资格证书</div>
            {证书列表.length > 0 ? (
              证书列表.map((条, 序) => (
                <button
                  key={条.编号}
                  className={`${样式.经历行} ${序 === 证书列表.length - 1 ? 样式.末行 : ''} 可点`}
                  onClick={() => 跳转(路径.工作经历)}
                >
                  <span className={样式.经历主体}>
                    <span className={样式.证书名}>{条.名称}</span>
                    {条.年份 ? (
                      <span className={样式.经历时间}>{条.年份} 年取得</span>
                    ) : null}
                  </span>
                  <span className={样式.尖括号}>›</span>
                </button>
              ))
            ) : (
              <button
                className={`${样式.标签行} 可点`}
                onClick={() => 跳转(路径.工作经历)}
              >
                <span className={样式.空态}>还没填证书，去添加</span>
                <span className={样式.尖括号}>›</span>
              </button>
            )}
          </div>

          {/* 个人优势：数据里是带 \n 的多行串，靠 white-space: pre-line 还原换行 */}
          <div className={样式.卡}>
            <div className={样式.卡标题}>个人优势</div>
            <div className={样式.优势正文}>{全局.个人优势}</div>
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

          {/* 多意向引导：一份简历可以挂多个求职意向，各自独立谈。
              不改注册流程，只在这里留一行轻提示，用户想起来的时候找得到入口 */}
          <button className={`${样式.加意向行} 可点`} onClick={() => 跳转(路径.添加意向)}>
            <span className={样式.加意向文}>还可以再加一个求职意向</span>
            <span className={样式.尖括号}>›</span>
          </button>
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
