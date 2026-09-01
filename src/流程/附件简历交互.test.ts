// P2 Task 4：附件简历纯交互助手的闭合测试。
// 状态文案表与错误分派表是产品冻结的闭合表：逐条对齐，且绝不透出 SHA / request id /
// provider status / 对象坐标 / 服务端内部 message 的隐私内容。

import { describe, expect, it } from 'vitest';
import { BFF错误 } from '../数据/HTTP客户端';
import type { BFF附件简历, BFF附件简历库 } from '../数据/BFF契约';
import { 附件错误文案, 附件状态文案, 校验附件PDF } from './附件简历交互';

const 文件A: BFF附件简历 = {
  file_id: 'rf_1',
  display_name: '简历A.pdf',
  revision: 1,
  current_version: {
    version_id: 'v1',
    version: 1,
    size_bytes: 1,
    media_type: 'application/pdf',
    sha256: 'a'.repeat(64),
    created_at: 't',
    parse: { status: 'not_started' },
  },
  created_at: 't',
  updated_at: 't',
};

describe('校验附件PDF', () => {
  it.each([
    [new File(['x'], 'resume.txt', { type: 'text/plain' }), '请选择 PDF 文件'],
    [new File(['x'], 'resume.PDF', { type: '' }), null],
    [new File(['xx'], 'resume.pdf', { type: 'application/pdf' }), '文件不能超过 1 B'],
  ])('validates PDF before consent', (file, expected) => {
    expect(校验附件PDF(file, { max_files: 3, max_file_bytes: 1, accepted_media_types: ['application/pdf'] }))
      .toBe(expected);
  });
});

describe('附件状态文案', () => {
  it.each([
    [{ status: 'not_started' }, '尚未识别'],
    [{ status: 'pending', updated_at: 't' }, '等待识别'],
    [{ status: 'processing', updated_at: 't' }, '正在识别'],
    [{ status: 'succeeded', parse_id: 'p', updated_at: 't' }, '识别完成'],
    [{ status: 'failed', failure_code: 'document_unreadable', updated_at: 't' }, '未能读取 · 可重试'],
    [{ status: 'failed', failure_code: 'document_too_complex', updated_at: 't' }, '内容过多 · 请替换'],
    [{ status: 'failed', failure_code: 'parser_invalid_output', updated_at: 't' }, '识别失败 · 可重试'],
    [{ status: 'failed', failure_code: 'parser_temporarily_unavailable', updated_at: 't' }, '服务繁忙 · 稍后重试'],
  ])('maps closed parse status %o', (parse, expected) => {
    expect(附件状态文案({ ...文件A, current_version: { ...文件A.current_version, parse } } as BFF附件简历))
      .toBe(expected);
  });
});

describe('附件错误文案', () => {
  // limits.max_file_bytes = 3 MiB：格式化字节 走 MB 档
  const limits: BFF附件简历库['limits'] = {
    max_files: 3,
    max_file_bytes: 3 * 1024 * 1024,
    accepted_media_types: ['application/pdf'],
  };

  it.each([
    ['invalid_pdf', '仅支持有效、未加密且不含主动内容的 PDF'],
    ['upload_in_progress', '附件正在上传，请稍后再试'],
    ['idempotency_in_progress', '操作仍在处理中，请稍后确认附件状态'],
    ['resume_file_version_conflict', '附件状态已更新，请重新选择操作'],
    ['resume_file_selection_stale', '附件状态已更新，请重新选择操作'],
    ['resume_file_not_found', '附件状态已更新，请重新选择操作'],
    ['parse_already_in_progress', '简历正在识别'],
    ['parse_not_allowed', '当前附件状态不可识别'],
    ['storage_unavailable', '附件服务暂时不可用，请稍后重试'],
    ['parser_temporarily_unavailable', '识别服务繁忙，请稍后重试'],
    ['processing_consent_required', '请重新确认后再继续'],
    ['attachment_state_changed', '附件状态已更新，请确认'],
    ['invalid_response', '服务返回异常，请稍后重试'],
  ])('maps closed code %s', (code, expected) => {
    expect(附件错误文案(new BFF错误(400, code, `内部细节 ${code}`), limits)).toBe(expected);
  });

  it.each([
    // 整除 MiB 显示 MB；否则原样 B
    [3 * 1024 * 1024, '文件不能超过 3 MB'],
    [1, '文件不能超过 1 B'],
    [1.5 * 1024 * 1024, '文件不能超过 1572864 B'],
  ])('formats byte limits via 格式化字节 (%i)', (maxBytes, expected) => {
    expect(
      附件错误文案(
        new BFF错误(413, 'resume_file_too_large', '服务端细节不进 UI'),
        { max_files: 3, max_file_bytes: maxBytes, accepted_media_types: ['application/pdf'] },
      ),
    ).toBe(expected);
  });

  it('resume_file_too_large 无 limits 时回退服务端 message，空 message 再回退固定文案', () => {
    expect(附件错误文案(new BFF错误(413, 'resume_file_too_large', '服务端给出的超大说明'), null))
      .toBe('服务端给出的超大说明');
    expect(附件错误文案(new BFF错误(413, 'resume_file_too_large', ''), null))
      .toBe('文件过大，请选择较小的 PDF');
  });

  it('resume_file_limit_reached 按 limits 提示份数上限，无 limits 用固定文案', () => {
    expect(附件错误文案(new BFF错误(409, 'resume_file_limit_reached', 'limit'), limits))
      .toBe('最多可上传 3 份附件简历');
    expect(附件错误文案(new BFF错误(409, 'resume_file_limit_reached', 'limit'), null))
      .toBe('附件简历已达上限');
  });

  it('有 limits 时 too_large 只显示大小上限，服务端 message 里的 SHA / request id 不进 UI', () => {
    const 内部 = 'sha256:deadbeef request_id:req_123 provider_status=5xx gcs://bucket/object?coords';
    expect(附件错误文案(new BFF错误(413, 'resume_file_too_large', 内部), limits))
      .toBe('文件不能超过 3 MB');
    expect(附件错误文案(new BFF错误(400, 'invalid_pdf', 内部), limits))
      .toBe('仅支持有效、未加密且不含主动内容的 PDF');
  });

  it('非 BFF错误 与闭合表外的 BFF错误 交给现有 取后端错误文案', () => {
    // P0 修复 Task 6：普通本地 Error 不再冒充网络故障，也不泄露内部 message。
    expect(附件错误文案(new Error('任意失败'), limits)).toBe('请求失败，请稍后再试');
    expect(附件错误文案(new BFF错误(0, 'network_error', 'fetch failed'), limits))
      .toBe('无法连接后端服务，请检查网络或稍后重试');
    expect(附件错误文案(new BFF错误(400, '未登记的新错误码', '神秘失败'), limits)).toBe('神秘失败');
  });
});
