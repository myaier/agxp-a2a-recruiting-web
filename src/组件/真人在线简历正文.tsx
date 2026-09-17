// 真人在线简历正文 —— 招聘聊天「看在线简历」的纯展示纸身（Spec §4，Task 4）。
// 从既有简历纸身（组件/简历预览层 的 简历纸身）提取本轮两个聊天消费者需要的纯展示部分：
// Backend 消费者（P7/Backend真人会话）映射同 Case candidate_identity + candidate_resume，
// Mock 消费者（企业真人会话）映射独立演示数据；本组件只吃展示字段，不读取应用状态、
// 不请求数据、不派生动作权限，也不重构其他简历页面（PDF 附件原件层等保持原样）。
//
// 布局即 Spec §4 截图：姓名 → 最近职位 · 年限 → 手机/邮箱 → 工作经历 → 教育经历 →
// 个人优势。底部「继续沟通」由 真人会话操作栏 的层壳负责（关层即回聊天），纸身是
// 纯展示、不含关闭控件 —— 层壳的关闭路径（继续沟通/Escape/遮罩）不经过这里。
//
// 联系方式恒「—」（Spec §4）：组件根本没有联系方式输入，登录手机号、PDF 解析或
// Mock 联系方式在结构上都进不了真人聊天纸身。
//
// 缺失口径（Spec §4）：区段 null = 源资料未提供 → 「暂未提供」；合法 [] = 读了但空 →
// 「暂无」，二者不互换。经历按源顺序渲染；公司槽缺省只省公司名，绝不从描述反推；
// 日期由映射层格式化成展示串，这里只负责右对齐（.经历头 弹性公司槽 + 时间右贴）。

import 样式 from './简历预览层.module.css';

/** 一段工作经历的展示行；字段已展示-ready（日期由映射层格式化）。 */
export interface 真人工作经历段 {
  公司: string | null;
  职位: string | null;
  起止: string | null;
  描述: string | null;
}

/** 一条教育经历的展示行。 */
export interface 真人教育条目 {
  学校: string | null;
  学历专业: string | null;
  起止: string | null;
}

/** 非空白正文才展开成行（拖尾空白不算内容）。 */
const 有内容 = (值: string | null): 值 is string => 值 != null && 值.trim() !== '';

export function 真人在线简历正文({
  姓名,
  最近职位,
  经验年限,
  工作经历,
  教育经历,
  个人优势,
}: {
  /** 抬头姓名：映射层给已授权的展示名（disclosed 真名 / Case 代号），本组件不派生 */
  姓名: string;
  /** 最近一段职位的展示文本；null = 源资料未提供 */
  最近职位: string | null;
  /** 年限展示文本（如 9 年经验）；null = 源资料未提供 */
  经验年限: string | null;
  /** null = 未提供（暂未提供）；[] = 读了但空（暂无） */
  工作经历: 真人工作经历段[] | null;
  /** 同上 */
  教育经历: 真人教育条目[] | null;
  /** null = 未提供（暂未提供）；空白串 = 合法空（暂无） */
  个人优势: string | null;
}) {
  // 抬头行 = 职位 · 年限，只知道哪段显示哪段，两缺整行不出（不编造）
  const 抬头行 = [最近职位, 经验年限]
    .filter((段) => 有内容(段))
    .join(' · ');
  const 优势行们 = (个人优势 ?? '')
    .split('\n')
    .map((行) => 行.trim())
    .filter((行) => 行 !== '');

  return (
    <>
      <div className={样式.抬头}>
        <div className={样式.姓名}>{姓名}</div>
        {抬头行 !== '' ? <div className={样式.抬头职位}>{抬头行}</div> : null}
        <div className={样式.联系行}>
          <span className={样式.联系项}>手机：—</span>
          <span className={样式.联系项}>邮箱：—</span>
        </div>
      </div>

      {/* 工作经历：日期右对齐、职位/描述在公司下方、顺序沿源资料；公司缺省不反推 */}
      <div className={样式.节标}>工作经历</div>
      {工作经历 === null ? (
        <p className={样式.区段空}>暂未提供</p>
      ) : 工作经历.length === 0 ? (
        <p className={样式.区段空}>暂无</p>
      ) : (
        工作经历.map((段, 序) => (
          <div key={序} className={样式.经历段}>
            <div className={样式.经历头}>
              {有内容(段.公司) ? <span className={样式.经历公司}>{段.公司}</span> : null}
              {段.起止 !== null ? <span className={样式.经历时间}>{段.起止}</span> : null}
            </div>
            {有内容(段.职位) ? <div className={样式.经历职位}>{段.职位}</div> : null}
            {有内容(段.描述) ? (
              <div className={样式.经历内容}>
                {段.描述.split('\n').map((行, 行序) => (
                  <div key={行序} className={样式.内容行}>
                    {行}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ))
      )}

      {/* 教育经历：同口径，学校槽缺省只省学校名 */}
      <div className={样式.节标}>教育经历</div>
      {教育经历 === null ? (
        <p className={样式.区段空}>暂未提供</p>
      ) : 教育经历.length === 0 ? (
        <p className={样式.区段空}>暂无</p>
      ) : (
        教育经历.map((条, 序) => (
          <div key={序} className={样式.经历段}>
            <div className={样式.经历头}>
              {有内容(条.学校) ? <span className={样式.经历公司}>{条.学校}</span> : null}
              {条.起止 !== null ? <span className={样式.经历时间}>{条.起止}</span> : null}
            </div>
            {有内容(条.学历专业) ? <div className={样式.经历职位}>{条.学历专业}</div> : null}
          </div>
        ))
      )}

      {/* 个人优势：null 与合法空按缺失口径区分 */}
      <div className={样式.节标}>个人优势</div>
      {优势行们.length > 0 ? (
        <ul className={样式.优势列}>
          {优势行们.map((行, 序) => (
            <li key={序} className={样式.优势项}>
              {行.replace(/；$/, '')}
            </li>
          ))}
        </ul>
      ) : (
        <p className={样式.区段空}>{个人优势 === null ? '暂未提供' : '暂无'}</p>
      )}
    </>
  );
}
