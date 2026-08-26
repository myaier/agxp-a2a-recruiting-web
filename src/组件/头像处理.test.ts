import { afterEach, describe, expect, it, vi } from 'vitest';
import { 压成头像 } from './头像处理';

describe('头像处理', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('居中裁成 256 正方形并输出 JPEG', async () => {
    const 画笔 = { drawImage: vi.fn() };
    const 画布 = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => 画笔),
      toDataURL: vi.fn(() => 'data:image/jpeg;base64,压缩后'),
    };
    const 原创建元素 = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((标签: string) =>
      标签 === 'canvas' ? 画布 as unknown as HTMLCanvasElement : 原创建元素(标签),
    );

    class 假文件读取器 {
      result: string | null = 'data:image/png;base64,原图';
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      readAsDataURL() { this.onload?.(); }
    }
    class 假图片 {
      width = 400;
      height = 200;
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      set src(_值: string) { this.onload?.(); }
    }
    vi.stubGlobal('FileReader', 假文件读取器);
    vi.stubGlobal('Image', 假图片);

    const 结果 = await 压成头像(new File(['x'], '头像.png', { type: 'image/png' }));

    expect(画布.width).toBe(256);
    expect(画布.height).toBe(256);
    expect(画笔.drawImage).toHaveBeenCalledWith(expect.any(假图片), 100, 0, 200, 200, 0, 0, 256, 256);
    expect(画布.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.85);
    expect(结果).toBe('data:image/jpeg;base64,压缩后');
  });
});
