// 简历预览层 —— 简历内容的两种呈现（标注意见 2026-08-18 23:51）：
//
//   · 简历纸身（具名导出，可复用）：简历正文本体，两个变体 ——
//       脱敏（默认）：在谈详情顶部「在线简历」折叠卡用。代号替真名、联系方式打码、
//                    公司隐去实名 —— 匿名初筛起对方核对的就是这一版；
//       原件（原件 prop）：真名、真实联系方式、公司实名 —— 用户自己的简历。
//   · 简历原件层（默认导出）：点阶段节点里的 PDF 附件行打开的弹层，
//       观感是一份 PDF 文档：顶部文件名 + PDF 徽标，正文一张白纸。
//       自己看自己的文件，所以内容是原件，不打码。
//
// 硬规则（用户 2026-08-18 反复强调）：界面上不加任何解释性小文案 ——
// 弹层只有文件名和简历数据本身，折叠卡只有「在线简历」四个字。

import 样式 from './简历预览层.module.css';
import { 个人优势文本, 简历联系方式 } from '../数据/模拟数据';
import { use应用状态 } from '../状态/应用状态';

/**
 * 简历纸身 —— 简历正文本体，不带滚动容器：
 * 弹层把它包进 PDF 白纸，在谈详情把它内联铺进「在线简历」折叠卡。
 */
export function 简历纸身({
  原件 = false,
  代号 = '',
}: {
  /** true = 简历原件：真名、真实联系方式、公司实名 */
  原件?: boolean;
  /** 脱敏视图下的对外化名，如 陈屿 */
  代号?: string;
}) {
  const 优势条目 = 个人优势文本.split('\n').filter((行) => 行.trim() !== '');
  // 经历/教育读全局简历切片：用户在工作经历页改完，这里立刻跟着变；真名读基本信息
  const { 状态: 全局 } = use应用状态();
  const 经历列表 = 全局.简历经历;
  const 教育列表 = 全局.简历教育;
  const 显示年月 = (值: string | null) => (值 ? 值.replace('-', '.') : '至今');

  return (
    <>
      {/* 抬头：原件给真名与真实联系方式；脱敏版代号替真名、联系方式只露首尾 */}
      <div className={样式.抬头}>
        <div className={样式.姓名}>{原件 ? 全局.基本信息.真名 : 代号}</div>
        <div className={样式.抬头职位}>
          {(经历列表[0]?.职位 ?? '').split(' · ')[0]} · 9 年经验
        </div>
        <div className={样式.联系行}>
          {原件 ? (
            <>
              <span className={样式.联系项}>手机：{简历联系方式.手机}</span>
              <span className={样式.联系项}>邮箱：{简历联系方式.邮箱}</span>
            </>
          ) : (
            <>
              <span className={样式.联系项}>姓名：{代号}</span>
              <span className={样式.联系项}>手机：138****6021</span>
              <span className={样式.联系项}>邮箱：s***@***.com</span>
            </>
          )}
        </div>
      </div>

      {/* 工作经历：脱敏版隐去公司实名 */}
      <div className={样式.节标}>工作经历</div>
      {经历列表.map((条) => (
        <div key={条.编号} className={样式.经历段}>
          <div className={样式.经历头}>
            <span className={样式.经历公司}>{原件 ? 条.公司 : '同赛道公司'}</span>
            <span className={样式.经历时间}>
              {显示年月(条.开始)} — {显示年月(条.结束)}
            </span>
          </div>
          <div className={样式.经历职位}>{条.职位}</div>
          {条.行业 ? <div className={样式.经历行业}>{条.行业}</div> : null}
          {条.内容 ? <div className={样式.经历内容}>{条.内容}</div> : null}
        </div>
      ))}

      {/* 教育经历：学校两版都实名（用户定：学校不脱敏）*/}
      <div className={样式.节标}>教育经历</div>
      {教育列表.map((条) => (
        <div key={条.编号} className={样式.经历段}>
          <div className={样式.经历头}>
            <span className={样式.经历公司}>{条.学校}</span>
            <span className={样式.经历时间}>
              {显示年月(条.开始)} — {显示年月(条.结束)}
            </span>
          </div>
          <div className={样式.经历职位}>
            {条.学历} · {条.专业}
          </div>
        </div>
      ))}

      {/* 个人优势 */}
      <div className={样式.节标}>个人优势</div>
      <ul className={样式.优势列}>
        {优势条目.map((行) => (
          <li key={行} className={样式.优势项}>
            {行.replace(/；$/, '')}
          </li>
        ))}
      </ul>

      {/* 薪资位置：双盲机制的产物，只存在于脱敏版；原件是用户自己的文档，没有这一节 */}
      {原件 ? null : (
        <>
          <div className={样式.节标}>薪资与到岗</div>
          <div className={样式.薪资框}>
            <div className={样式.薪资行}>
              <span className={样式.薪资标}>现金期望</span>
              <span className={样式.薪资值}>落在贵方区间内 ✓</span>
            </div>
            <div className={样式.薪资行}>
              <span className={样式.薪资标}>到岗时间</span>
              <span className={样式.薪资值}>45 天内</span>
            </div>
          </div>
        </>
      )}
    </>
  );
}

/** 简历原件弹层：PDF 文档观感 —— 顶栏文件名 + PDF 徽标，正文一张白纸 */
export default function 简历原件层({
  文件名,
  匿名代号,
  关闭,
}: {
  文件名: string;
  /** 传了 = 对方视角（企业端收到的版本）：化名 + 打码，不是原件 */
  匿名代号?: string;
  关闭: () => void;
}) {
  return (
    <div className={样式.遮罩} onClick={关闭}>
      <div className={样式.层} onClick={(事件) => 事件.stopPropagation()}>
        {/* 顶栏：只有 PDF 徽标 + 文件名 + 关闭，没有任何说明文字（用户硬规则）*/}
        <div className={样式.顶栏}>
          <span className={样式.抓手} />
          <div className={样式.顶栏行}>
            <span className={样式.PDF徽标}>
              <span className={样式.PDF徽标字}>PDF</span>
            </span>
            <span className={`${样式.文件名} 单行`}>{文件名}</span>
            <button className={`${样式.关闭键} 可点`} onClick={关闭} aria-label="关闭">
              ✕
            </button>
          </div>
        </div>

        {/* 灰底上浮一张白纸，模拟 PDF 阅读器里的一页 */}
        <div className={`${样式.纸底} 滚动区`}>
          <div className={样式.白纸}>
            {匿名代号 ? <简历纸身 代号={匿名代号} /> : <简历纸身 原件 />}
          </div>
        </div>
      </div>
    </div>
  );
}
