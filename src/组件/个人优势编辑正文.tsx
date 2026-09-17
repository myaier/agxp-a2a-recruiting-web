// 个人优势受控正文（合同 B，Spec §5.1 / §5.3）：日常 /wizard?from=resume 编辑与
// onboarding 资料页共用的唯一绘制 —— textarea（aria-label 个人优势、maxLength=500）、
// 实时字数、真实恢复按钮。
//
// 无业务副作用：保存 / 路由 / 提示全由调用页承担；恢复动作与文案由调用方给，
// 恢复 = null（没有可恢复来源）时整行不出现，不虚构「可恢复」的假动作。
// 不含已失效的「删除一行：长按段落」提示（Spec §5.3 删除），也不含技能指路等页面文案。
//
// 版式复用 引导问答.module.css 的既有优势卡（与状态正文复用 入职引导.module.css 同一做法）：
// 两个调用方同一份 DOM / 视觉，不新增样式文件。

import 样式 from '../屏幕/引导问答.module.css';

type 个人优势编辑正文Props = {
  文本: string;
  修改: (值: string) => void;
  /** 可选说明（资料页按实际预填来源给）；不给则整行不渲染 */
  说明?: string;
  /** null = 无可恢复来源，整行不渲染 */
  恢复: (() => void) | null;
  恢复文案: string;
};

export default function 个人优势编辑正文({
  文本,
  修改,
  说明,
  恢复,
  恢复文案,
}: 个人优势编辑正文Props) {
  return (
    <>
      <div className={样式.优势卡}>
        <textarea
          className={样式.优势输入}
          value={文本}
          onChange={(事件) => 修改(事件.target.value)}
          maxLength={500}
          aria-label="个人优势"
        />
        <div className={样式.优势底}>
          {说明 !== undefined ? <span className={样式.优势说明}>{说明}</span> : null}
          <span className={`${样式.优势计数} 等宽数字`}>{文本.length} / 500</span>
        </div>
      </div>

      {恢复 !== null ? (
        <div className={样式.优势工具行}>
          <button className={`${样式.优势工具主} 可点`} onClick={恢复}>
            ◈ {恢复文案}
          </button>
        </div>
      ) : null}
    </>
  );
}
