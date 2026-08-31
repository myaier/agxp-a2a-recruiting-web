import type { BFF二进制响应 } from './HTTP客户端';

/**
 * PDF 附件的对象 URL 租约：只校验类型并托管一个可释放的 URL，
 * 不负责字节或文本解析，也不重复回收。
 */
export interface PDF对象租约 {
  url: string;
  revoke(): void;
}

const PDF类型 = 'application/pdf';

/** 创建 PDF 对象租约 */
export function 创建PDF对象租约(
  response: Pick<BFF二进制响应, 'blob' | 'contentType'>,
  urls: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'> = URL,
): PDF对象租约 {
  if (response.contentType !== PDF类型) {
    throw new Error(
      `PDF对象租约要求响应 contentType 为 ${PDF类型}，实际为「${response.contentType}」`,
    );
  }
  if (response.blob.type !== PDF类型) {
    throw new Error(
      `PDF对象租约要求 blob.type 为 ${PDF类型}，实际为「${response.blob.type}」`,
    );
  }
  const url = urls.createObjectURL(response.blob);
  let 已回收 = false;
  return {
    url,
    revoke(): void {
      if (已回收) {
        return;
      }
      已回收 = true;
      urls.revokeObjectURL(url);
    },
  };
}
