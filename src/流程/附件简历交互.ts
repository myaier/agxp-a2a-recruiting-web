// P2 Task 4：附件简历的纯交互助手 —— 本地预检、状态文案与错误文案分派。
// 只做纯函数：不发请求、不碰 React、不持快照；文件输入与显式动作错误统一走 附件错误文案。
// 文案是产品冻结的闭合表：绝不透出 SHA、request id、provider status、对象坐标，
// 服务端 message 只在 分派表明确指名的回退位（too_large 无 limits）原样上屏。

import { BFF错误, 取后端错误文案 } from '../数据/HTTP客户端';
import type { BFF附件简历, BFF附件简历库 } from '../数据/BFF契约';

/** 字节数只用于错误文案：整除 MiB 显示 `${n} MB`，否则原样显示 `${bytes} B`。 */
function 格式化字节(bytes: number): string {
  const MiB = 1024 * 1024;
  return bytes % MiB === 0 ? `${bytes / MiB} MB` : `${bytes} B`;
}

/** consent 弹层前的本地预检：扩展名 / media type / 大小上限。返回 null = 可以继续。 */
export function 校验附件PDF(file: File, limits: BFF附件简历库['limits'] | null): string | null {
  if (!file.name.toLowerCase().endsWith('.pdf')) return '请选择 PDF 文件';
  if (file.type !== '' && file.type.toLowerCase() !== 'application/pdf') return '请选择 PDF 文件';
  if (limits && file.size > limits.max_file_bytes) return `文件不能超过 ${格式化字节(limits.max_file_bytes)}`;
  return null;
}

/** 行上的解析状态文案（闭合表）：not_started/pending/processing/succeeded + 四个失败码。 */
export function 附件状态文案(file: BFF附件简历): string {
  const parse = file.current_version.parse;
  if (parse.status === 'not_started') return '尚未识别';
  if (parse.status === 'pending') return '等待识别';
  if (parse.status === 'processing') return '正在识别';
  if (parse.status === 'succeeded') return '识别完成';
  if (parse.status === 'failed') {
    return {
      document_unreadable: '未能读取 · 可重试',
      document_too_complex: '内容过多 · 请替换',
      parser_invalid_output: '识别失败 · 可重试',
      parser_temporarily_unavailable: '服务繁忙 · 稍后重试',
    }[parse.failure_code];
  }
  throw new Error(`未登记的解析状态: ${JSON.stringify(parse)}`);
}

/** 显式动作的闭合错误分派：登记过的 code 用固定文案，未登记的交给现有 取后端错误文案。 */
export function 附件错误文案(error: unknown, limits: BFF附件简历库['limits'] | null): string {
  if (!(error instanceof BFF错误)) return 取后端错误文案(error);
  if (error.code === 'invalid_pdf') return '仅支持有效、未加密且不含主动内容的 PDF';
  if (error.code === 'resume_file_too_large') {
    return limits ? `文件不能超过 ${格式化字节(limits.max_file_bytes)}` : (error.message || '文件过大，请选择较小的 PDF');
  }
  if (error.code === 'resume_file_limit_reached') {
    return limits ? `最多可上传 ${limits.max_files} 份附件简历` : '附件简历已达上限';
  }
  if (error.code === 'upload_in_progress') return '附件正在上传，请稍后再试';
  if (error.code === 'idempotency_in_progress') return '操作仍在处理中，请稍后确认附件状态';
  if (error.code === 'resume_file_version_conflict' || error.code === 'resume_file_selection_stale' || error.code === 'resume_file_not_found') {
    return '附件状态已更新，请重新选择操作';
  }
  if (error.code === 'parse_already_in_progress') return '简历正在识别';
  if (error.code === 'parse_not_allowed') return '当前附件状态不可识别';
  if (error.code === 'storage_unavailable') return '附件服务暂时不可用，请稍后重试';
  if (error.code === 'parser_temporarily_unavailable') return '识别服务繁忙，请稍后重试';
  if (error.code === 'processing_consent_required') return '请重新确认后再继续';
  if (error.code === 'attachment_state_changed') return '附件状态已更新，请确认';
  if (error.code === 'invalid_response') return '服务返回异常，请稍后重试';
  return 取后端错误文案(error);
}
