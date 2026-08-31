// 附件简历选择层 —— 委托前的显式简历选择（P5 Task 3，消费 P2 附件库）。
//
// 多于一份附件时，委托必须由用户当场单选一份 PDF：确认值只由所选行的
// file_id / display_name / current_version.version_id 构成 —— 版本坐标只认
// 用户可见行上的 current_version，绝不代选「最新」，也绝不读解析产物。
// 文件名（别名）只作纯文本展示；选择不落任何持久化、不记默认值：
// 取消 / Escape / 遮罩 / 确认 / 卸载即消失，下一次委托重新来过。
// 骨架复用 弹层框架（遮罩 / Escape / 焦点圈），样式与 确认层 同一口径。

import { useState } from 'react';
import type { BFF附件简历 } from '../数据/BFF契约';
import 弹层框架 from './弹层框架';
import 样式 from './附件简历选择层.module.css';

/** 用户显式选中的简历坐标：只含所选行的 file_id / display_name / 当前版本 id。 */
export interface 附件简历选择值 {
  fileId: string;
  fileVersionId: string;
  displayName: string;
}

/** 从用户可见的附件行取选择值：版本坐标只取行上的 current_version，别处一概不取。 */
export function 从附件行取选择值(文件: BFF附件简历): 附件简历选择值 {
  return {
    fileId: 文件.file_id,
    fileVersionId: 文件.current_version.version_id,
    displayName: 文件.display_name,
  };
}

export function 附件简历选择层({
  文件们,
  取消,
  确认,
}: {
  文件们: readonly BFF附件简历[];
  取消: () => void;
  确认: (value: 附件简历选择值) => void;
}) {
  // 本层的单选草稿：只在层开着时存在，取消 / 确认 / 卸载即消失，不落任何持久化
  const [选中编号, 设选中编号] = useState<string | null>(null);
  const 选中文件 = 文件们.find((条) => 条.file_id === 选中编号) ?? null;

  return (
    <弹层框架 标签="选择委托简历" 遮罩类名={样式.遮罩} 面板类名={样式.面板} 关闭={取消}>
      <div className={样式.标题}>选择这次提交的简历</div>
      <div className={样式.说明}>
        所选 PDF 与披露授权仅对这一次委托生效，不会记住为默认。
      </div>

      <div className={`${样式.清单} 滚动区`} role="radiogroup" aria-label="选择简历">
        {文件们.map((条) => (
          <label key={条.file_id} className={样式.行}>
            <input
              type="radio"
              name="委托简历"
              className={样式.单选钮}
              checked={选中编号 === 条.file_id}
              onChange={() => 设选中编号(条.file_id)}
            />
            <span className={`${样式.文件名} 单行`}>{条.display_name}</span>
          </label>
        ))}
      </div>

      <div className={样式.键行}>
        <button type="button" className={`${样式.取消键} 可点`} onClick={取消}>
          暂不委托
        </button>
        <button
          type="button"
          className={`${样式.确认键} 可点`}
          disabled={选中文件 === null}
          onClick={() => {
            // 值只由所选行构成；层关闭（取消/确认）后草稿即随卸载消失
            if (选中文件 !== null) 确认(从附件行取选择值(选中文件));
          }}
        >
          确认并委托
        </button>
      </div>
    </弹层框架>
  );
}

export default 附件简历选择层;
