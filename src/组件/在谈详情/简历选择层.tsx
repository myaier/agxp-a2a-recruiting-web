// 简历选择层 —— S1 递交的显式单选层（契约 C 的 简历选择属性，纯展示）。
//
// 只吃控制层（use后端详情动作 的 简历选择 返回）给定的键/文件名/状态文/禁用说明：
// 本层不持任何 BFF 文件对象、不读 Context、不推导解析状态或权限、不 import 控制模块。
// 身份只认控制层发的 键 —— 文件名（含同名不同版本）只作纯文本展示，选择回调只回键。
// 确认键是 详情按钮：执行!==null 且 禁用说明===null 才可触发（契约 A 铁律），
// 禁用说明可见并经 aria-describedby 关联；取消键 / Escape / 遮罩都只走 取消（零提交）。
// 面板类复用 附件简历选择层.module.css（单选清单同一版式，默认规则不改）；文案是
// S1 递交口径（原 屏幕/P5 S1简历选择层：选择递交简历 / 暂不递交 / 选定这份），
// 不混 Plan 1 委托层的话术。单选草稿归控制层（选中键 受控），层一关即随控制层清空。

import { useId, type CSSProperties } from 'react';
import 弹层框架 from '../弹层框架';
import 选择样式 from '../附件简历选择层.module.css';
import type { 简历选择属性 } from './类型';

/** 行内状态文/禁用说明的小字（次要弱色；清单行本身的版式归共用 CSS） */
const 说明字样式: CSSProperties = { flex: 'none', fontSize: 11, color: 'var(--最弱)' };

export function 简历选择层(props: 简历选择属性) {
  const { 职位名, 文件们, 选中键, 选择, 取消, 确认 } = props;
  const 前缀 = useId();
  const 可确认 = 确认.执行 !== null && 确认.禁用说明 === null;
  const 说明id = 确认.禁用说明 !== null ? `${前缀}-${确认.键}` : undefined;
  return (
    <弹层框架 标签="选择递交简历" 遮罩类名={选择样式.遮罩} 面板类名={选择样式.面板} 关闭={取消}>
      <div className={选择样式.标题}>选择这次递交的简历</div>
      <div className={选择样式.说明}>
        本次 Case 是「{职位名}」；所选 PDF 与披露授权仅对这一次递交生效，不会记住为默认。
      </div>
      <div className={`${选择样式.清单} 滚动区`} role="radiogroup" aria-label="选择简历">
        {文件们.map((条) => (
          <label key={条.键} className={选择样式.行}>
            <input
              type="radio"
              name="递交简历"
              className={选择样式.单选钮}
              checked={选中键 === 条.键}
              onChange={() => 选择(条.键)}
              disabled={条.禁用说明 !== null}
            />
            <span className={`${选择样式.文件名} 单行`}>{条.文件名}</span>
            <span style={说明字样式}>{条.状态文}</span>
            {条.禁用说明 !== null ? <span style={说明字样式}>{条.禁用说明}</span> : null}
          </label>
        ))}
      </div>
      <div className={选择样式.键行}>
        <button type="button" className={`${选择样式.取消键} 可点`} onClick={取消}>
          暂不递交
        </button>
        <button
          type="button"
          className={可确认 ? `${选择样式.确认键} 可点` : 选择样式.确认键}
          disabled={!可确认}
          aria-describedby={说明id}
          onClick={确认.执行 ?? undefined}
        >
          {确认.文案}
        </button>
      </div>
      {说明id !== undefined ? (
        <div id={说明id} style={{ ...说明字样式, marginTop: 8 }}>
          {确认.禁用说明}
        </div>
      ) : null}
    </弹层框架>
  );
}
