// 简历标签录入（candidate-profile-edit-boundaries Task 3）：在线简历 专业技能 与
// 证书与语言 共用的 标签墙 + 行内录入行 受控正文。两种旅程（onboarding 注册与
// 我的简历 日常编辑）同组件；两个当前消费者就是技能与证书，不扩展为任意字段表单框架。
//
// 输入/输出冻结为轻量受控契约：无内部持久化 —— 标签列表与输入草稿全由调用方持有，
// 本组件不查询后端、不创建任何条目 ID（技能键 = 技能字符串本身；证书键 = 原编号，
// 补充 = 既有年份展示）。技能去重、证书空白提示、证书草稿恢复/清理等数据义务
// 全部留在调用方，组件只负责展示与回传。布局 CSS 自 屏幕工作经历.module.css 的
// 技能卡/录入行迁移而来，全仓库只保留这一份。
//
// 输入交互：Enter 且非输入法组合（isComposing）才回调 添加 —— 挡住中文输入法
// 「回车上屏候选词」那一下；点「添加」按钮同样回调 添加。

import 样式 from './简历标签录入.module.css';

/** 一枚标签：键是调用方数据的稳定键（同名条目不互相覆盖），补充是弱化的副文（如年份） */
export type 简历标签项 = { 键: string; 名称: string; 补充?: string };

/** 正文 props（页面局部契约，不是公共领域模型） */
export type 简历标签录入Props = {
  项们: 简历标签项[];
  草稿: string;
  占位: string;
  /** 删除钮的可访问名（用户可见中文，如「删除证书 CPA」） */
  删除名称: (项: 简历标签项) => string;
  改草稿: (值: string) => void;
  添加: () => void;
  /** 按稳定键删除（证书按编号、技能按字符串） */
  删除: (键: string) => void;
};

export function 简历标签录入({
  项们,
  草稿,
  占位,
  删除名称,
  改草稿,
  添加,
  删除,
}: 简历标签录入Props): React.JSX.Element {
  return (
    <div className={样式.卡}>
      {项们.length > 0 ? (
        <div className={样式.标签组}>
          {项们.map((项) => (
            <button
              key={项.键}
              className={`${样式.标签} 可点`}
              onClick={() => 删除(项.键)}
              aria-label={删除名称(项)}
            >
              {项.名称}
              {项.补充 ? <span className={样式.标签补充}>{项.补充}</span> : null}
              <span className={样式.标签删}>✕</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className={样式.录入行}>
        <input
          className={样式.录入框}
          value={草稿}
          placeholder={占位}
          onChange={(事件) => 改草稿(事件.target.value)}
          onKeyDown={(事件) => {
            // isComposing：挡住中文输入法「回车上屏候选词」那一下
            if (事件.key === 'Enter' && !事件.nativeEvent.isComposing) 添加();
          }}
          enterKeyHint="done"
        />
        <button className={`${样式.录入键} 可点`} onClick={添加}>
          添加
        </button>
      </div>
    </div>
  );
}
