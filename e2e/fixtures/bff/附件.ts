// e2e/fixtures/bff/附件.ts
// P2 附件简历域 fixture（C2）：0–3 行 PDF 库的 wire 形、限制与状态机 fixture，
// 从 e2e/数据源模式.spec.ts 原样迁出。可变状态归每次 安装BFF路由 所有。
import { 信封, type 路由上下文形 } from './协议';

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


// ── 路由 handler（C2 阶段二迁入）──

export async function 处理附件域(
  P2域: P2附件fixture形,
  上下文: 路由上下文形,
): Promise<boolean> {
  const { route, 请求, path, method, body, 部件们 } = 上下文;

  // ── P2 附件简历域（Task 7）：multipart / If-Match / Idempotency-Key 契约 fail closed。
  //    清单 GET 驱动 pending →(第 2 读)→ processing →(第 3+ 读)→ 下次终态；
  //    create / replace / parse 把 列表读取次数 归零，重放状态机 ──
  if (P2域 && path === '/api/v1/me/resume-files' && method === 'GET') {
    P2域.列表读取次数 += 1;
    for (const item of P2域.items) {
      if (P2域.列表读取次数 === 2 && item.current_version.parse.status === 'pending') {
        item.current_version.parse = { status: 'processing', updated_at: P2时间 };
      } else if (P2域.列表读取次数 >= 3) {
        if (item.current_version.parse.status === 'pending' || item.current_version.parse.status === 'processing') {
          item.current_version.parse = P2域.下次终态 === 'succeeded'
            ? { status: 'succeeded', parse_id: `parse_${item.file_id}`, updated_at: P2时间 }
            : { status: 'failed', failure_code: P2域.下次终态, updated_at: P2时间 };
        }
      }
    }
    await route.fulfill({ status: 200, json: 信封({ items: P2域.items, limits: P2限制 }) });
    return true;
  }
  if (P2域 && path === '/api/v1/me/resume-files' && method === 'POST') {
    P2要求((请求.headers()['idempotency-key'] ?? '') !== '');
    P2要求(部件们?.map((part) => part.name).join(',') === 'display_name,file,processing_consent_confirmed');
    const display = 部件们[0].bytes.toString('utf8');
    const filePart = 部件们[1];
    P2要求(filePart.contentType === 'application/pdf');
    P2要求(部件们[2].bytes.toString('utf8') === 'true');
    P2要求(P2域.items.length < P2限制.max_files);
    const item = P2新附件(P2域.下一个编号++, display, filePart.bytes);
    P2域.items.unshift(item);
    P2域.列表读取次数 = 0;
    P2域.写入次数 += 1;
    await route.fulfill({ status: 201, json: 信封(item) });
    return true;
  }
  const P2content = /^\/api\/v1\/me\/resume-files\/([^/]+)\/content$/.exec(path);
  if (P2域 && P2content && method === 'PUT') {
    const item = P2域.items.find((candidate) => candidate.file_id === P2content[1]);
    P2要求(item);
    P2要求(请求.headers()['if-match'] === `"${item.revision}"`);
    P2要求((请求.headers()['idempotency-key'] ?? '') !== '');
    P2要求(部件们?.map((part) => part.name).join(',') === 'file,processing_consent_confirmed');
    P2要求(部件们[0].contentType === 'application/pdf');
    P2要求(部件们[1].bytes.toString('utf8') === 'true');
    item.revision += 1;
    item.current_version = {
      version_id: `rfv_${item.file_id}_${item.revision}`, version: item.current_version.version + 1,
      size_bytes: 部件们[0].bytes.length, media_type: 'application/pdf', sha256: 'b'.repeat(64),
      created_at: P2时间, parse: { status: 'pending', updated_at: P2时间 },
    };
    item.updated_at = P2时间;
    P2域.items.splice(P2域.items.indexOf(item), 1);
    P2域.items.unshift(item);
    P2域.列表读取次数 = 0;
    P2域.写入次数 += 1;
    await route.fulfill({ status: 200, json: 信封(item), headers: { ETag: `"${item.revision}"` } });
    return true;
  }
  if (P2域 && P2content && method === 'GET') {
    P2要求(P2域.items.some((item) => item.file_id === P2content[1]));
    P2域.下载次数 += 1;
    await route.fulfill({
      status: 200, body: Buffer.from('%PDF-1.7\nfixture\n'),
      contentType: 'application/pdf',
      headers: { 'Content-Disposition': 'attachment; filename="resume.pdf"', 'X-Request-Id': 'fixture-pdf' },
    });
    return true;
  }
  const P2parse = /^\/api\/v1\/me\/resume-files\/([^/]+)\/parse$/.exec(path);
  if (P2域 && P2parse && method === 'POST') {
    const item = P2域.items.find((candidate) => candidate.file_id === P2parse[1]);
    P2要求(item);
    P2要求((请求.headers()['idempotency-key'] ?? '') !== '');
    P2要求(JSON.stringify(body) === JSON.stringify({
      version_id: item.current_version.version_id, processing_consent_confirmed: true,
    }));
    item.current_version.parse = { status: 'pending', updated_at: P2时间 };
    P2域.列表读取次数 = 0;
    P2域.写入次数 += 1;
    await route.fulfill({ status: 202, json: 信封(item.current_version.parse) });
    return true;
  }
  const P2file = /^\/api\/v1\/me\/resume-files\/([^/]+)$/.exec(path);
  if (P2域 && P2file && method === 'DELETE') {
    const index = P2域.items.findIndex((candidate) => candidate.file_id === P2file[1]);
    P2要求(index >= 0);
    P2要求(请求.headers()['if-match'] === `"${P2域.items[index].revision}"`);
    P2域.items.splice(index, 1);
    P2域.写入次数 += 1;
    await route.fulfill({ status: 200, json: 信封({ deleted: true }) });
    return true;
  }
  return false;
}
