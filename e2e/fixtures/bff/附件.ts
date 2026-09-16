// e2e/fixtures/bff/附件.ts
// P2 附件简历域 fixture（C2）：0–3 行 PDF 库的 wire 形、限制与状态机 fixture，
// 从 e2e/数据源模式.spec.ts 原样迁出。可变状态归每次 安装BFF路由 所有。

// ── P2 附件简历域 fixture 与工厂 ──

// ─────────────────────────────────────────────────────────────────────────────
// P2 附件简历域 fixture（Task 7）。wire 形就地声明，不反向依赖 src；PDF bytes 统一
// Buffer.from('%PDF-1.7\nfixture\n')，不把二进制字面量写进 spec。可变接口冻结为
// P2附件fixture形：清单 GET 驱动 pending →(第 2 读)→ processing →(第 3+ 读)→ 终态
// 状态机，写入（create/replace/parse）把 列表读取次数 归零重放状态机；删除不重置读取。
// handler 对未知 multipart part、缺 consent、错 If-Match、缺幂等键直接 throw（fail closed）。
// ─────────────────────────────────────────────────────────────────────────────

export type P2失败码 = 'document_unreadable' | 'document_too_complex' | 'parser_invalid_output' | 'parser_temporarily_unavailable';
export type P2解析形 =
  | { status: 'not_started' }
  | { status: 'pending' | 'processing'; updated_at: string }
  | { status: 'succeeded'; parse_id: string; updated_at: string }
  | { status: 'failed'; failure_code: P2失败码; updated_at: string };

export interface P2附件形 {
  file_id: string;
  display_name: string;
  revision: number;
  current_version: {
    version_id: string; version: number; size_bytes: number; media_type: 'application/pdf';
    sha256: string; created_at: string; parse: P2解析形;
  };
  created_at: string;
  updated_at: string;
}

export const P2限制 = { max_files: 3, max_file_bytes: 10_485_760, accepted_media_types: ['application/pdf'] } as const;
export const P2时间 = '2026-08-28T00:00:00Z';

export function P2要求(condition: unknown): asserts condition {
  if (!condition) throw new Error('P2 fixture received an invalid wire request');
}

export function P2新附件(id: number, displayName: string, bytes: Buffer): P2附件形 {
  return {
    file_id: `rf_${id}`, display_name: displayName, revision: 1,
    current_version: {
      version_id: `rfv_${id}_1`, version: 1, size_bytes: bytes.length,
      media_type: 'application/pdf', sha256: 'a'.repeat(64), created_at: P2时间,
      parse: { status: 'pending', updated_at: P2时间 },
    },
    created_at: P2时间, updated_at: P2时间,
  };
}

export interface P2附件fixture形 {
  items: P2附件形[];
  列表读取次数: number;
  写入次数: number;
  下载次数: number;
  下一个编号: number;
  下次终态: 'succeeded' | P2失败码;
}

export function 创建P2附件fixture(下次终态: 'succeeded' | P2失败码 = 'succeeded'): P2附件fixture形 {
  return { items: [], 列表读取次数: 0, 写入次数: 0, 下载次数: 0, 下一个编号: 1, 下次终态 };
}
