// 授权原始 PDF 弹层（P7 Task 4 从 P5/MatchCase详情 抽出，DOM 契约逐字保留）：
// 壳与顶栏逐类复用 简历预览层.module.css（抽屉 + PDF 徽标 + 文件名 + 关闭，
// 无任何解释文字）；正文用 <iframe src=租约地址> 呈现真实字节（选 iframe 而非
// <object>：无插件回退怪癖、字节留在嵌套浏览上下文、title 即无障碍名）。
// 经 URL 渲染不是解析 —— 代码绝不读 blob 文本/字节；租约生命周期归调用方
// （关闭/卸载即 revoke，不缓存不持久化）。弹层里不存在姓名/联系方式渲染路径。

import 弹层框架 from './弹层框架';
import 预览样式 from './简历预览层.module.css';

export default function 原始PDF层({ 文件名, 地址, 关闭 }: { 文件名: string; 地址: string; 关闭: () => void }) {
  return (
    <弹层框架 标签="简历原件" 遮罩类名={预览样式.遮罩} 面板类名={预览样式.层} 关闭={关闭}>
      <div className={预览样式.顶栏}>
        <span className={预览样式.抓手} />
        <div className={预览样式.顶栏行}>
          <span className={预览样式.PDF徽标}>
            <span className={预览样式.PDF徽标字}>PDF</span>
          </span>
          <span className={`${预览样式.文件名} 单行`}>{文件名}</span>
          <button className={`${预览样式.关闭键} 可点`} onClick={关闭} aria-label="关闭">
            ✕
          </button>
        </div>
      </div>
      <div className={`${预览样式.纸底} 滚动区`}>
        <iframe
          title="简历 PDF"
          src={地址}
          style={{
            display: 'block', width: '100%', height: '100%', border: 0,
            borderRadius: 10, background: 'var(--白)',
          }}
        />
      </div>
    </弹层框架>
  );
}