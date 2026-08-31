import { describe, expect, it, vi } from 'vitest';
import * as PDF对象租约模块 from './PDF对象租约';
import { 创建PDF对象租约 } from './PDF对象租约';

describe('创建PDF对象租约', () => {
  it('接受 PDF 响应并只创建一个 URL，revoke 多次也只回收一次', () => {
    const urls = {
      createObjectURL: vi.fn(() => 'blob:p5'),
      revokeObjectURL: vi.fn(),
    };
    const lease = 创建PDF对象租约(
      {
        blob: new Blob(['%PDF-1.4'], { type: 'application/pdf' }),
        contentType: 'application/pdf',
      },
      urls,
    );
    expect(lease.url).toBe('blob:p5');
    expect(urls.createObjectURL).toHaveBeenCalledTimes(1);
    lease.revoke();
    lease.revoke();
    expect(urls.revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(urls.revokeObjectURL).toHaveBeenCalledWith('blob:p5');
  });

  it('contentType 不是 application/pdf 时直接报错，不创建对象 URL', () => {
    const urls = {
      createObjectURL: vi.fn(() => 'blob:p5'),
      revokeObjectURL: vi.fn(),
    };
    expect(() =>
      创建PDF对象租约(
        {
          blob: new Blob(['%PDF-1.4'], { type: 'application/pdf' }),
          contentType: 'application/octet-stream',
        },
        urls,
      ),
    ).toThrow();
    expect(urls.createObjectURL).not.toHaveBeenCalled();
    expect(urls.revokeObjectURL).not.toHaveBeenCalled();
  });

  it('blob.type 不是 application/pdf 时直接报错，不创建对象 URL', () => {
    const urls = {
      createObjectURL: vi.fn(() => 'blob:p5'),
      revokeObjectURL: vi.fn(),
    };
    expect(() =>
      创建PDF对象租约(
        {
          blob: new Blob(['<html></html>'], { type: 'text/html' }),
          contentType: 'application/pdf',
        },
        urls,
      ),
    ).toThrow();
    expect(urls.createObjectURL).not.toHaveBeenCalled();
    expect(urls.revokeObjectURL).not.toHaveBeenCalled();
  });

  it('contentType 为空字符串时直接报错，不创建对象 URL', () => {
    const urls = {
      createObjectURL: vi.fn(() => 'blob:p5'),
      revokeObjectURL: vi.fn(),
    };
    expect(() =>
      创建PDF对象租约(
        {
          blob: new Blob(['%PDF-1.4'], { type: 'application/pdf' }),
          contentType: '',
        },
        urls,
      ),
    ).toThrow();
    expect(urls.createObjectURL).not.toHaveBeenCalled();
  });

  it('模块只暴露租约工厂，不暴露任何字节或文本解析器', () => {
    expect(Object.keys(PDF对象租约模块).sort()).toEqual(['创建PDF对象租约']);
  });
});
