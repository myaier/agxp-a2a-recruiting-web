// 附件简历选择层 · 多文件显式选择契约（P5 Task 3）：
//   · 必须先单选一份才可确认；确认值只由所选行的 file_id / display_name /
//     current_version.version_id 构成 —— 版本坐标只认用户可见行，绝不代选「最新」；
//   · 取消键 / Escape / 遮罩都只走 取消，零确认；
//   · 文件名（别名）只作纯文本展示，绝不渲染 version_id / 解析状态 / 任何解析产物；
//   · 选择不落持久化、不记默认值：层一关，选择即消失。
// 注：仓库未装 @testing-library/jest-dom，用 .disabled / toBeTruthy / queryBy* 断言。

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import 附件简历选择层 from './附件简历选择层';
import type { BFF附件简历 } from '../数据/BFF契约';

/** 便捷版本行：parse 缺省 not_started；已解析版本由用例覆盖 parse 造解析产物陷阱 */
function 附件版本(id: string): BFF附件简历['current_version'] {
  return {
    version_id: id,
    version: 1,
    size_bytes: 1024,
    media_type: 'application/pdf',
    sha256: 'a'.repeat(64),
    created_at: '2026-08-28T00:00:00Z',
    parse: { status: 'not_started' },
  };
}

const 文件A: BFF附件简历 = {
  file_id: 'rf_1',
  display_name: '沈亦舟_简历_2026.pdf',
  revision: 2,
  current_version: 附件版本('rfv_1'),
  created_at: '2026-08-28T00:00:00Z',
  updated_at: '2026-08-28T00:00:00Z',
};

const 文件B: BFF附件简历 = {
  ...文件A,
  file_id: 'rf_2',
  display_name: '产品简历_2026.pdf',
  current_version: 附件版本('rfv_2'),
};

describe('附件简历选择层 · 多文件单选契约', () => {
  it('requires one radio selection and returns the visible current version', async () => {
    const 用户 = userEvent.setup();
    const 确认 = vi.fn();
    render(<附件简历选择层 文件们={[文件A, 文件B]} 取消={vi.fn()} 确认={确认} />);
    expect((screen.getByRole('button', { name: '确认并委托' }) as HTMLButtonElement).disabled).toBe(true);
    await 用户.click(screen.getByRole('radio', { name: /产品简历/ }));
    await 用户.click(screen.getByRole('button', { name: '确认并委托' }));
    expect(确认).toHaveBeenCalledWith({
      fileId: 文件B.file_id,
      fileVersionId: 文件B.current_version.version_id,
      displayName: 文件B.display_name,
    });
  });

  it('换选另一行只发最后选中行的坐标', async () => {
    const 用户 = userEvent.setup();
    const 确认 = vi.fn();
    render(<附件简历选择层 文件们={[文件A, 文件B]} 取消={vi.fn()} 确认={确认} />);
    await 用户.click(screen.getByRole('radio', { name: /沈亦舟_简历/ }));
    await 用户.click(screen.getByRole('radio', { name: /产品简历/ }));
    await 用户.click(screen.getByRole('button', { name: '确认并委托' }));
    expect(确认).toHaveBeenCalledTimes(1);
    expect(确认).toHaveBeenCalledWith({
      fileId: 文件B.file_id,
      fileVersionId: 文件B.current_version.version_id,
      displayName: 文件B.display_name,
    });
  });

  it('未选中时确认键始终禁用，点了也不确认', async () => {
    const 用户 = userEvent.setup();
    const 确认 = vi.fn();
    render(<附件简历选择层 文件们={[文件A, 文件B]} 取消={vi.fn()} 确认={确认} />);
    const 确认键 = screen.getByRole('button', { name: '确认并委托' }) as HTMLButtonElement;
    await 用户.click(确认键);
    expect(确认).not.toHaveBeenCalled();
    expect(确认键.disabled).toBe(true);
  });

  it('取消键零确认；层卸载后重开是新的一次选择，不记得上次的选中', async () => {
    const 用户 = userEvent.setup();
    const 取消 = vi.fn();
    const 确认 = vi.fn();
    const 首次 = render(<附件简历选择层 文件们={[文件A, 文件B]} 取消={取消} 确认={确认} />);
    await 用户.click(screen.getByRole('radio', { name: /产品简历/ }));
    await 用户.click(screen.getByRole('button', { name: '暂不委托' }));
    expect(取消).toHaveBeenCalledTimes(1);
    expect(确认).not.toHaveBeenCalled();
    首次.unmount();

    // 生产语义：屏只在要委托时挂载这一层，重开 = 全新实例，上次的选择不带走
    render(<附件简历选择层 文件们={[文件A, 文件B]} 取消={取消} 确认={确认} />);
    expect((screen.getByRole('button', { name: '确认并委托' }) as HTMLButtonElement).disabled).toBe(true);
    expect(确认).not.toHaveBeenCalled();
  });

  it('Escape 与遮罩同样零确认', async () => {
    const 用户 = userEvent.setup();
    const 取消 = vi.fn();
    const 确认 = vi.fn();
    const 首次 = render(<附件简历选择层 文件们={[文件A, 文件B]} 取消={取消} 确认={确认} />);
    await 用户.click(screen.getByRole('radio', { name: /产品简历/ }));
    await 用户.keyboard('{Escape}');
    expect(取消).toHaveBeenCalledTimes(1);
    expect(确认).not.toHaveBeenCalled();
    首次.unmount();

    const 第二 = render(<附件简历选择层 文件们={[文件A, 文件B]} 取消={取消} 确认={确认} />);
    await 用户.click(screen.getByRole('button', { name: '关闭选择委托简历' }));
    expect(取消).toHaveBeenCalledTimes(2);
    expect(确认).not.toHaveBeenCalled();
    第二.unmount();
  });

  it('文件名只作纯文本展示：不渲染 version_id、解析状态或任何解析产物', () => {
    const 已解析: BFF附件简历 = {
      ...文件A,
      current_version: {
        ...附件版本('rfv_9'),
        parse: { status: 'succeeded', parse_id: 'ps_1', updated_at: '2026-08-28T00:02:00Z' },
      },
    };
    render(<附件简历选择层 文件们={[已解析]} 取消={vi.fn()} 确认={vi.fn()} />);
    expect(screen.getByText('沈亦舟_简历_2026.pdf')).toBeTruthy();
    expect(screen.queryByText('rfv_9')).toBeNull();
    expect(screen.queryByText('ps_1')).toBeNull();
    expect(screen.queryByText(/解析/)).toBeNull();
  });

  it('确认文案声明所选 PDF 与披露授权仅对这一次委托生效', () => {
    render(<附件简历选择层 文件们={[文件A, 文件B]} 取消={vi.fn()} 确认={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: '选择委托简历' }).textContent).toContain(
      '所选 PDF 与披露授权仅对这一次委托生效');
  });
});