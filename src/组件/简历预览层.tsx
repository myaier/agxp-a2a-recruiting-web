// 简历预览层 —— 点在谈详情里的 PDF 附件直接看到简历本体（标注意见 2026-08-17 22:04）。
//
// 关键点：这里给用户看的不是他自己那份简历，而是「对方实际收到的那一份」。
// 双盲机制下递出去的画像会做三处处理，预览里必须原样体现出来，用户才知道自己披露了什么：
//   · 姓名 → 代号（如「候选人 A-01」）
//   · 手机 / 邮箱 → 打码，且标明「已隐去」
//   · 当前公司按披露偏好，可能写成「同赛道头部公司」而不是实名
// 顶部一条对照说明点出「这是对方看到的版本」，避免用户以为联系方式泄露了。

import 样式 from './简历预览层.module.css';
import { 工作经历, 个人优势文本 } from '../数据/模拟数据';

interface 属性 {
  文件名: string;
  /** 对外代号，如 A-01。用于替换真实姓名 */
  代号: string;
  /** 递交时间，如 D1 11:02 */
  时间: string;
  /** 当前公司是否按偏好脱敏 */
  公司脱敏?: boolean;
  关闭: () => void;
}

export default function 简历预览层({
  文件名,
  代号,
  时间,
  公司脱敏 = true,
  关闭,
}: 属性) {
  const 优势条目 = 个人优势文本.split('\n').filter((行) => 行.trim() !== '');

  return (
    <div className={样式.遮罩} onClick={关闭}>
      <div className={样式.层} onClick={(事件) => 事件.stopPropagation()}>
        {/* 顶栏：文件名 + 关闭 */}
        <div className={样式.顶栏}>
          <span className={样式.抓手} />
          <div className={样式.顶栏行}>
            <span className={`${样式.文件名} 单行`}>{文件名}</span>
            <button className={`${样式.关闭键} 可点`} onClick={关闭} aria-label="关闭">
              ✕
            </button>
          </div>
          <div className={样式.对照条}>
            这是<span className={样式.对照强调}>对方实际收到的版本</span> · 递交于 {时间}
          </div>
        </div>

        <div className={`${样式.纸} 滚动区`}>
          {/* 抬头：代号替代真名 */}
          <div className={样式.抬头}>
            <div className={样式.代号}>候选人 {代号}</div>
            <div className={样式.抬头职位}>
              {工作经历.第一段.职位名称.split(' · ')[0]} · 9 年经验
            </div>
            <div className={样式.打码行}>
              <span className={样式.打码项}>姓名：候选人 {代号}</span>
              <span className={样式.打码项}>手机：138****6021</span>
              <span className={样式.打码项}>邮箱：s***@***.com</span>
            </div>
            <div className={样式.隐去注}>
              姓名与联系方式已隐去，双方确认意向后才互换
            </div>
          </div>

          {/* 工作经历 */}
          <div className={样式.节标}>工作经历</div>
          <div className={样式.经历段}>
            <div className={样式.经历头}>
              <span className={样式.经历公司}>
                {公司脱敏 ? '同赛道头部公司（按你的披露偏好隐去实名）' : 工作经历.第一段.公司名称}
              </span>
              <span className={样式.经历时间}>
                {工作经历.第一段.在职时间.起} — {工作经历.第一段.在职时间.止}
              </span>
            </div>
            <div className={样式.经历职位}>{工作经历.第一段.职位名称}</div>
            <div className={样式.经历行业}>{工作经历.第一段.所在行业}</div>
            <div className={样式.经历内容}>{工作经历.第一段.工作内容}</div>
          </div>
          <div className={样式.经历段}>
            <div className={样式.经历头}>
              <span className={样式.经历公司}>
                {公司脱敏 ? '同赛道上市公司' : '美团'}
              </span>
              <span className={样式.经历时间}>2017.07 — 2019.05</span>
            </div>
            <div className={样式.经历职位}>后端开发工程师</div>
          </div>

          {/* 个人优势 */}
          <div className={样式.节标}>个人优势</div>
          <ul className={样式.优势列}>
            {优势条目.map((行) => (
              <li key={行} className={样式.优势项}>
                {行.replace(/；$/, '')}
              </li>
            ))}
          </ul>

          {/* 薪资位置：双盲的核心，这里只能是定性表述 */}
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
            <div className={样式.薪资注}>
              双盲机制：候选人的薪资数字不会披露，代理只回答「是否落在你给出的区间内」。
            </div>
          </div>

          <div className={样式.纸脚}>
            由 AGXP 代理按候选人的披露偏好生成 · 内容不可二次转发
          </div>
        </div>
      </div>
    </div>
  );
}
