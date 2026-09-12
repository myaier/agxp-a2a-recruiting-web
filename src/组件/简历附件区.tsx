// 简历附件区（Task 8，core editors §5.3）：我的简历 附件简历卡的两模式共用展示区。
// 版式照原页 JSX 自上而下：标题行「附件简历」＋ 右侧「＋」（同一节点，复用 .卡标题 的
// margin，标题外壳不增高）→ 0–3 行 PDF 行（经原 滑动行：左滑露 解析/重新解析/替换/删除）
// → 空态。卡外壳（.卡）与 Mock 原型预览提示留页面；本组件只承载标题/＋、PDF 行、空态。
// 样式直接沿用原页面 CSS（我的简历.module.css），不另建样式、不改基础控件（滑动行原样复用）。
//
// 纯展示：不依赖数据源模式、BFF DTO、Context、API、路由或存储 —— props 只有展示值、
// 稳定键、状态与回调。行键由页面给（Backend 真实 file ID，Mock 局部模拟键），组件不按
// 显示名反查真实 ID。文件 input、待授权文件/动作、确认层、preview、错误与锁全部留在
// 页面外层；确认层由页面用待处理动作派生同一套 props，这里不感知。

import 样式 from '../屏幕/我的简历.module.css';
import 滑动行, { type 滑动操作 } from './滑动行';

/** 一条附件行的展示值：键 = Backend file ID / Mock 模拟键，与显示名分离；
 *  名称 = 文件名，说明 = 状态文案 —— 行面可访问名把两者拼全，读屏同时听到
 *  「哪一份」和「现在什么状态」。打开 = 点行本身（Backend 开真实 PDF 预览，
 *  Mock 走既有原型提示）。 */
export type 附件展示行 = {
  键: string;
  名称: string;
  说明: string;
  操作们: 滑动操作[];
  打开: () => void;
};

/** 正文 props（页面局部契约，不是公共领域模型） */
export type 简历附件区Props = {
  行们: 附件展示行[];
  可添加: boolean;
  /** 页面有在飞附件动作时置真：滑动操作键整排禁用（防重复提交的页面锁） */
  忙: boolean;
  添加: () => void;
  /** 同一时刻至多一行处于打开态（受控）；null = 全关 */
  展开键: string | null;
  请求展开: (键: string | null) => void;
};

export function 简历附件区({ 行们, 可添加, 忙, 添加, 展开键, 请求展开 }: 简历附件区Props): React.JSX.Element {
  return (
    <>
      {/* 标题与 ＋ 挂同一节点：复用 .卡标题 的 margin，标题外壳不增高 */}
      <div className={`${样式.卡标题} ${样式.附件标题行}`} data-testid="附件简历标题">
        <span>附件简历</span>
        {可添加 ? (
          <button type="button" className={样式.附件添加键} aria-label="添加附件简历" onClick={添加}>
            ＋
          </button>
        ) : null}
      </div>
      {行们.length > 0 ? (
        行们.map((行) => (
          <滑动行
            key={行.键}
            操作={忙 ? 行.操作们.map((项) => ({ ...项, 禁用: true })) : 行.操作们}
            打开={展开键 === 行.键}
            请求打开={(开) => 请求展开(开 ? 行.键 : null)}
            按下={行.打开}
            // 行面 aria-label 会覆盖内容拼出来的名字，所以这里要把
            // 「哪一份」和「现在什么状态」一起给全，读屏听到的信息量不减
            名称={`${行.名称} ${行.说明}`}
          >
            <div className={样式.附件行} data-testid="附件简历行">
              <span className={样式.PDF块}>
                <span className={样式.PDF字}>PDF</span>
              </span>
              <span className={样式.附件主体}>
                <span className={样式.附件名}>{行.名称}</span>
                <span className={样式.附件说明}>{行.说明}</span>
              </span>
              <span className={样式.尖括号}>›</span>
            </div>
          </滑动行>
        ))
      ) : (
        <div className={样式.附件空态}>还未上传附件简历</div>
      )}
    </>
  );
}
