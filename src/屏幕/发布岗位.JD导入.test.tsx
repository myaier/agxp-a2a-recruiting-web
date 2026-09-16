// 发布岗位 · JD 导入（生命周期与建议合并）
// 由 src/屏幕/发布岗位.test.tsx 按冻结归属拆出：按文件后缀职责，JD 导入生命周期与 JD 建议合并→JD导入。

import {
  mock返回,
  mock进企业主壳,
  mock替换跳转,
  mock跳转,
  mock创建JD导入,
  mock读取JD导入,
  mock应用状态,
  清空轻提示,
  deferred,
  置Mock应用状态,
  置Backend应用状态,
} from './发布岗位.测试辅助';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BFF错误 } from '../数据/HTTP客户端';
import { type BFFJD导入, type BFFJD导入失败码, type BFFJD建议 } from '../数据/BFF契约';
import 发布岗位 from './发布岗位';

vi.mock('../路由/导航钩子', () => ({
  use导航: () => ({
    返回: mock返回,
    进企业主壳: mock进企业主壳,
    替换跳转: mock替换跳转,
    跳转: mock跳转,
  }),
}));
vi.mock('../状态/应用状态', () => ({ use应用状态: () => mock应用状态 }));

// ── JD PDF 建议稿导入：consent、串行轮询、状态横幅与重试（Task 3）──
// 假时钟驱动 3 秒节拍与 visibilitychange；所有迟到结果必须过页面 generation/import ID
// 栅栏。错误文案闭合：Spec §9.2 全表 + 非 BFF错误 + 未知 code，原始 message/request ID/
// provider/模型输出绝不上屏。
describe('发布岗位页 JD 导入生命周期', () => {
  const JD合法ID = 'jdi_0123456789abcdef0123456789abcdef';
  const JD新ID = 'jdi_fedcba9876543210fedcba9876543210';
  const 不可用文案 = 'JD 服务暂时不可用，请稍后重试或手动填写';

  const JD建议全量 = {
    title: 'Senior Backend Engineer',
    recruitment_type: 'social_full_time',
    workplace_mode: 'hybrid',
    office_location: '上海市浦东新区世纪大道 1568 号',
    description: '负责核心招聘服务。',
    requirements: '五年以上后端经验。',
    education_requirement: 'bachelor',
    experience_requirement: 'five_plus_years',
    category_source_name: '后端开发',
    location_source_name: '上海',
    keywords: ['Go', 'PostgreSQL'],
  } as const;

  const JDpending: BFFJD导入 = { import_id: JD合法ID, status: 'pending', created_at: '2026-09-03T01:02:03Z', updated_at: '2026-09-03T01:02:03Z' };
  const JDprocessing: BFFJD导入 = { ...JDpending, status: 'processing' };
  const JDsucceeded: BFFJD导入 = {
    import_id: JD合法ID, status: 'succeeded',
    created_at: '2026-09-03T01:02:03Z', updated_at: '2026-09-03T01:02:06Z',
    suggestion: { ...JD建议全量, keywords: [...JD建议全量.keywords] },
  };
  const JD失败 = (failure_code: BFFJD导入失败码): BFFJD导入 => ({
    import_id: JD合法ID, status: 'failed',
    created_at: '2026-09-03T01:02:03Z', updated_at: '2026-09-03T01:02:05Z', failure_code,
  });
  const JDpending新轮: BFFJD导入 = { ...JDpending, import_id: JD新ID };

  const JDPDF = () => new File(['%PDF-1.7'], 'role.pdf', { type: 'application/pdf' });
  const 第二份PDF = () => new File(['%PDF-1.7'], 'another.pdf', { type: 'application/pdf' });

  /** 横幅文字/动作都取自 JD 上传区内现有 代理横幅 的 DOM（class 名含中文 local 名），不改组件；
   *  必须限定范围 —— 页面外壳还有第二处代理横幅（默认动作「问AI代理 ›」）。 */
  const JD横幅节点 = () => document.querySelector('[class*="上传JD区"] [class*="代理横幅"]');
  const 横幅文字 = () => JD横幅节点()?.querySelector('[class*="横幅文字"]')?.textContent ?? '';
  const 动作文字 = () => JD横幅节点()?.querySelector('[class*="横幅动作"]')?.textContent ?? '';

  function 轻提示文案们(): string[] {
    for (const 节点 of Array.from(document.body.children)) {
      const 元素 = 节点 as HTMLElement;
      if (元素.style.position === 'fixed' && 元素.style.zIndex === '999') {
        return Array.from(元素.children).map((条) => 条.textContent ?? '');
      }
    }
    return [];
  }

  /** 推进假时钟（触发内部状态更新的都裹 act）。 */
  async function 走(毫秒: number): Promise<void> {
    await act(async () => { await vi.advanceTimersByTimeAsync(毫秒); });
  }

  /** 结算已 resolve/reject 的 deferred 链（微任务空转）。 */
  async function 微任务结算(): Promise<void> {
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  }

  function 设可见(可见: boolean): void {
    Object.defineProperty(document, 'hidden', { value: !可见, configurable: true });
  }

  function render发布岗位(路由 = '/hr/post-job') {
    return render(
      <MemoryRouter initialEntries={[路由]}>
        <Routes>
          <Route path="/hr/post-job" element={<发布岗位 />} />
          <Route path="/hr/post-job/:id" element={<发布岗位 />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  /** 假时钟下不用 userEvent.upload（其内部 wait 会挂起）：直接派发带 files 的 change。 */
  function 选择JD(文件: File) {
    fireEvent.change(screen.getByLabelText('上传 JD 文件'), { target: { files: [文件] } });
  }

  function 确认JD() {
    fireEvent.click(screen.getByRole('button', { name: '同意并继续' }));
  }

  function 选择并确认JD(文件: File) {
    选择JD(文件);
    确认JD();
  }

  /** 同步双击：先吃 busy guard、再吃确认层卸载，两条路都只许一次 POST。 */
  function dblClick(元素: Element) {
    fireEvent.click(元素);
    fireEvent.click(元素);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    mock创建JD导入.mockReset();
    mock读取JD导入.mockReset();
    置Backend应用状态(
      vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' })),
      vi.fn(async () => ({ items: [], nextCursor: null, catalogVersion: 'v2' })),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(document, 'hidden');
  });

  it('候选人角色打开发岗页：合法 PDF 只提示可手填，零确认零请求', async () => {
    mock应用状态.后端状态.主体.last_used_role = 'candidate';
    render发布岗位();
    选择JD(JDPDF());
    expect(轻提示文案们()).toContain('已选择，可继续手动填写');
    expect(screen.queryByText('允许 AI 识别这份职位描述？')).toBeNull();
    expect(mock创建JD导入).not.toHaveBeenCalled();
  });

  it('操作层栅栏换代（已换代）时当前轮收口回 idle，不卡 uploading', async () => {
    mock创建JD导入.mockResolvedValue('已换代');
    render发布岗位();
    选择并确认JD(JDPDF());
    await 微任务结算();
    expect(横幅文字()).toBe('把 JD 给我，这张表我来填');
    expect(动作文字()).toBe('上传 JD ›');
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('合法 PDF 先确认，consent 前零 POST，取消仍零 POST', async () => {
    render发布岗位();
    选择JD(JDPDF());
    expect(mock创建JD导入).not.toHaveBeenCalled();
    expect(screen.getByText('允许 AI 识别这份职位描述？')).toBeTruthy();
    expect(screen.getByText('这份 PDF 将发送给受控模型服务进行职位信息识别。确认后才会上传并开始处理。')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(mock创建JD导入).not.toHaveBeenCalled();
    expect(screen.queryByText('允许 AI 识别这份职位描述？')).toBeNull();
    expect(横幅文字()).toBe('把 JD 给我，这张表我来填');
  });

  it('确认后 POST；pending 串行轮询，hidden 暂停，visible 立即恢复', async () => {
    const POST门 = deferred<BFFJD导入>();
    const GET1门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValueOnce(POST门.promise);
    mock读取JD导入.mockReturnValueOnce(GET1门.promise).mockResolvedValueOnce(JDsucceeded);
    render发布岗位();
    选择并确认JD(JDPDF());
    // POST 已起飞且在飞：恰一次 POST，页面容器带 aria-busy
    expect(mock创建JD导入).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
    POST门.resolve(JDpending);
    await 微任务结算();
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
    expect(横幅文字()).toBe('正在识别 JD');
    // 3 秒节拍：2999ms 零 GET，再 1ms 恰一次 GET（用返回的 import ID）
    await 走(2999);
    expect(mock读取JD导入).not.toHaveBeenCalled();
    await 走(1);
    expect(mock读取JD导入).toHaveBeenCalledTimes(1);
    expect(mock读取JD导入).toHaveBeenLastCalledWith(JD合法ID);
    // 第一个 GET 未决期间再走 9 秒仍只有一次 GET（串行，setTimeout 链不重叠）
    await 走(9000);
    expect(mock读取JD导入).toHaveBeenCalledTimes(1);
    // 页面隐藏：清定时器；GET 结算后也不排新拍
    设可见(false);
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    GET1门.resolve(JDprocessing);
    await 微任务结算();
    await 走(9000);
    expect(mock读取JD导入).toHaveBeenCalledTimes(1);
    // 恢复可见：立即读取一次
    设可见(true);
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await 微任务结算();
    expect(mock读取JD导入).toHaveBeenCalledTimes(2);
    expect(横幅文字()).toBe('已识别，请检查建议');
    expect(动作文字()).toBe('重新上传 ›');
  });

  it('input 收紧为 PDF 且选后立即清空 value，同一文件可再次选择', async () => {
    render发布岗位();
    const input = screen.getByLabelText('上传 JD 文件') as HTMLInputElement;
    expect(input.accept).toBe('.pdf,application/pdf');
    选择JD(JDPDF());
    expect(input.value).toBe('');
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    选择JD(JDPDF());
    expect(screen.getByText('允许 AI 识别这份职位描述？')).toBeTruthy();
  });

  it.each([
    ['扩展名不合法', () => new File(['x'], 'role.docx', { type: 'application/msword' })],
    ['MIME 不合法', () => new File(['x'], 'role.pdf', { type: 'text/plain' })],
  ])('%s 只弹「请选择 PDF 文件」，不开确认层且不打扰在途导入', async (_名, 造文件) => {
    mock创建JD导入.mockResolvedValue(JDpending);
    mock读取JD导入.mockResolvedValue(JDpending);
    render发布岗位();
    选择并确认JD(JDPDF());
    await 走(3000);
    expect(mock读取JD导入).toHaveBeenCalledTimes(1);
    选择JD(造文件());
    expect(轻提示文案们()).toContain('请选择 PDF 文件');
    expect(screen.queryByText('允许 AI 识别这份职位描述？')).toBeNull();
    // 旧轮不受影响：轮询照旧按同一 import ID 排队
    await 走(3000);
    expect(mock读取JD导入).toHaveBeenCalledTimes(2);
    expect(mock读取JD导入).toHaveBeenLastCalledWith(JD合法ID);
    expect(横幅文字()).toBe('正在识别 JD');
  });

  it('Mock 模式合法 PDF 只提示「已选择，可继续手动填写」，零确认零请求', async () => {
    置Mock应用状态();
    render发布岗位();
    选择JD(JDPDF());
    expect(轻提示文案们()).toContain('已选择，可继续手动填写');
    expect(screen.queryByText('允许 AI 识别这份职位描述？')).toBeNull();
    expect(横幅文字()).toBe('把 JD 给我，这张表我来填');
  });

  it('POST 未决时双击「同意并继续」只发一次 POST', async () => {
    const POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValue(POST门.promise);
    render发布岗位();
    选择JD(JDPDF());
    dblClick(screen.getByRole('button', { name: '同意并继续' }));
    expect(mock创建JD导入).toHaveBeenCalledTimes(1);
    POST门.resolve(JDpending);
    await 微任务结算();
  });

  it.each([
    ['直接 succeeded', JDsucceeded, '已识别，请检查建议', '重新上传 ›'],
    ['直接 failed', JD失败('invalid_pdf'), '仅支持有效、未加密且不含主动内容的 PDF', '重新上传 ›'],
  ] as const)('POST %s 时不安排任何 GET 且进入终局', async (_名, 结果, 文案, 动作) => {
    mock创建JD导入.mockResolvedValue(结果);
    render发布岗位();
    选择并确认JD(JDPDF());
    await 走(10000);
    expect(mock读取JD导入).not.toHaveBeenCalled();
    expect(横幅文字()).toBe(文案);
    expect(动作文字()).toBe(动作);
  });

  it('卸载清除轮询定时器，卸载后再派发 visibilitychange 也零 GET', async () => {
    mock创建JD导入.mockResolvedValue(JDpending);
    mock读取JD导入.mockResolvedValue(JDpending);
    const { unmount } = render发布岗位();
    选择并确认JD(JDPDF());
    await 走(2999);
    unmount();
    设可见(false);
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    设可见(true);
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await 走(30000);
    expect(mock读取JD导入).not.toHaveBeenCalled();
  });

  it.each([
    ['旧 POST 迟到成功', true],
    ['旧 POST 迟到失败', false],
  ])('新合法 PDF 使 %s 整包失效', async (_名, 成功) => {
    const 旧POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValueOnce(旧POST门.promise);
    render发布岗位();
    选择并确认JD(JDPDF());
    expect(mock创建JD导入).toHaveBeenCalledTimes(1);
    // 选新合法 PDF：新一轮复位 idle 并开确认层
    选择JD(第二份PDF());
    expect(screen.getByText('允许 AI 识别这份职位描述？')).toBeTruthy();
    if (成功) 旧POST门.resolve(JDsucceeded);
    else 旧POST门.reject(new BFF错误(0, 'network_error', 'offline'));
    await 微任务结算();
    // 旧轮结果没有落进新轮：横幅仍是新轮 idle 文案
    expect(横幅文字()).toBe('把 JD 给我，这张表我来填');
    expect(动作文字()).toBe('上传 JD ›');
  });

  it.each([
    ['旧 GET 迟到成功', true],
    ['旧 GET 迟到失败', false],
  ])('新合法 PDF 使 %s 整包失效', async (_名, 成功) => {
    const GET门 = deferred<BFFJD导入>();
    mock创建JD导入.mockResolvedValueOnce(JDpending);
    mock读取JD导入.mockReturnValueOnce(GET门.promise);
    render发布岗位();
    选择并确认JD(JDPDF());
    await 走(3000);
    expect(mock读取JD导入).toHaveBeenCalledTimes(1);
    选择JD(第二份PDF());
    if (成功) GET门.resolve(JDsucceeded);
    else GET门.reject(new BFF错误(503, 'operation_outcome_unknown', 'down'));
    await 微任务结算();
    expect(横幅文字()).toBe('把 JD 给我，这张表我来填');
    await 走(10000);
    // 旧轮定时器已被清掉：不排新 GET
    expect(mock读取JD导入).toHaveBeenCalledTimes(1);
  });

  it('旧 import ID 的迟到结果不能改变新轮（同页多轮）', async () => {
    mock创建JD导入.mockResolvedValueOnce(JDpending).mockResolvedValueOnce(JDpending新轮);
    const GET_A门 = deferred<BFFJD导入>();
    mock读取JD导入.mockReturnValueOnce(GET_A门.promise).mockResolvedValue(JDpending新轮);
    render发布岗位();
    // 轮 1：pending(合法ID)，GET(A) 在飞
    选择并确认JD(JDPDF());
    await 走(3000);
    expect(mock读取JD导入).toHaveBeenNthCalledWith(1, JD合法ID);
    // 轮 2：新文件 → pending(新ID)；选择即作废旧轮
    选择并确认JD(第二份PDF());
    // 旧 import ID 的 GET 此时才带回 succeeded —— generation/import ID 双失配，整包丢弃
    GET_A门.resolve(JDsucceeded);
    await 微任务结算();
    expect(横幅文字()).toBe('正在识别 JD');
    expect(动作文字()).toBe('上传 JD ›');
    // 新轮照常轮询自己的任务（单飞解除后按节拍读 新ID），不被旧结果改成终局
    await 走(3000);
    expect(mock读取JD导入).toHaveBeenNthCalledWith(2, JD新ID);
    expect(横幅文字()).toBe('正在识别 JD');
  });

  it('POST 重试复用同一 File 与幂等键；GET 重试只再读同一 import ID 且不重新 POST', async () => {
    const 开文件 = vi.spyOn(HTMLInputElement.prototype, 'click');
    // POST network_error → failed + 重试 ›；重试再用同一 File/key 恰发第二次 POST
    mock创建JD导入.mockRejectedValueOnce(new BFF错误(0, 'network_error', '网络连接失败'));
    render发布岗位();
    选择并确认JD(JDPDF());
    await 微任务结算();
    expect(横幅文字()).toBe(不可用文案);
    expect(动作文字()).toBe('重试 ›');
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
    fireEvent.click(screen.getByText('重试 ›'));
    expect(mock创建JD导入).toHaveBeenCalledTimes(2);
    const [文件1, 键1] = mock创建JD导入.mock.calls[0];
    const [文件2, 键2] = mock创建JD导入.mock.calls[1];
    expect(文件2).toBe(文件1);
    expect(键2).toBe(键1);
    expect(键1).toMatch(/^jd-import-/);
    // 开文件框一次都没被拉起（重试动作不重新选文件）
    expect(开文件).not.toHaveBeenCalled();
    开文件.mockRestore();
  });

  it('GET 失败的重试只调 读取JD导入 且使用同一 import ID', async () => {
    mock创建JD导入.mockResolvedValue(JDpending);
    mock读取JD导入.mockRejectedValueOnce(new BFF错误(0, 'network_error', 'offline'));
    render发布岗位();
    选择并确认JD(JDPDF());
    await 走(3000);
    await 微任务结算();
    expect(横幅文字()).toBe(不可用文案);
    expect(动作文字()).toBe('重试 ›');
    fireEvent.click(screen.getByText('重试 ›'));
    expect(mock读取JD导入).toHaveBeenCalledTimes(2);
    expect(mock读取JD导入).toHaveBeenLastCalledWith(JD合法ID);
    expect(mock创建JD导入).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['invalid_pdf', '仅支持有效、未加密且不含主动内容的 PDF'],
    ['document_too_complex', '内容过多或过于复杂，请换一份 PDF'],
    ['parser_invalid_output', '未能识别这份 JD，可重新上传或手动填写'],
    ['parser_temporarily_unavailable', '识别服务繁忙，请稍后重试或手动填写'],
  ] as const)('terminal failed（%s）显示精确文案、只提供重新上传且不再重试', async (code, 文案) => {
    mock创建JD导入.mockResolvedValue(JD失败(code));
    const 开文件 = vi.spyOn(HTMLInputElement.prototype, 'click');
    render发布岗位();
    选择并确认JD(JDPDF());
    await 微任务结算();
    expect(横幅文字()).toBe(文案);
    expect(动作文字()).toBe('重新上传 ›');
    await 走(30000);
    expect(mock读取JD导入).not.toHaveBeenCalled();
    expect(mock创建JD导入).toHaveBeenCalledTimes(1);
    // 「重新上传」拉起现有文件框
    fireEvent.click(screen.getByText('重新上传 ›'));
    expect(开文件).toHaveBeenCalledTimes(1);
    开文件.mockRestore();
  });

  it('uploading 时横幅动作 no-op；pending 时允许重新上传开始新轮', async () => {
    const POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValueOnce(POST门.promise).mockResolvedValueOnce(JDpending新轮);
    const 开文件 = vi.spyOn(HTMLInputElement.prototype, 'click');
    render发布岗位();
    选择并确认JD(JDPDF());
    expect(横幅文字()).toBe('正在上传 JD');
    // uploading 中点横幅不拉起文件框
    fireEvent.click(screen.getByText('上传 JD ›').closest('button')!);
    expect(开文件).not.toHaveBeenCalled();
    POST门.resolve(JDpending);
    await 微任务结算();
    // pending 中点横幅可重新上传
    fireEvent.click(screen.getByText('上传 JD ›').closest('button')!);
    expect(开文件).toHaveBeenCalledTimes(1);
    选择JD(第二份PDF());
    expect(screen.getByText('允许 AI 识别这份职位描述？')).toBeTruthy();
    开文件.mockRestore();
  });

  it('编辑岗位无导入横幅行为且零 JD 调用', async () => {
    render发布岗位('/hr/post-job/job_1');
    expect(screen.queryByText('把 JD 给我，这张表我来填')).toBeNull();
    选择JD(JDPDF());
    expect(mock创建JD导入).not.toHaveBeenCalled();
    expect(mock读取JD导入).not.toHaveBeenCalled();
    expect(screen.queryByText('允许 AI 识别这份职位描述？')).toBeNull();
  });

  // ── Spec §9.2 闭合错误文案：POST 异常全表（含非 BFF错误与未知 code）──
  it.each([
    ['invalid_pdf', new BFF错误(422, 'invalid_pdf', 'provider=openai request_id=req_1'), '仅支持有效、未加密且不含主动内容的 PDF', '重新上传 ›'],
    ['job_draft_import_too_large', new BFF错误(422, 'job_draft_import_too_large', 'too large'), '文件过大，请选择较小的 PDF', '重新上传 ›'],
    ['document_too_complex', new BFF错误(422, 'document_too_complex', 'complex'), '内容过多或过于复杂，请换一份 PDF', '重新上传 ›'],
    ['processing_consent_required', new BFF错误(422, 'processing_consent_required', 'consent'), '请重新确认后再继续', '重新上传 ›'],
    ['upload_in_progress', new BFF错误(409, 'upload_in_progress', 'in flight'), 'JD 正在上传，请稍后重试', '重试 ›'],
    ['idempotency_in_progress', new BFF错误(409, 'idempotency_in_progress', 'in flight'), 'JD 正在上传，请稍后重试', '重试 ›'],
    ['idempotency_conflict', new BFF错误(409, 'idempotency_conflict', 'conflict'), '上传意图已变化，请重新选择文件', '重新上传 ›'],
    ['parser_invalid_output', new BFF错误(422, 'parser_invalid_output', 'bad parse'), '未能识别这份 JD，可重新上传或手动填写', '重新上传 ›'],
    ['parser_temporarily_unavailable', new BFF错误(422, 'parser_temporarily_unavailable', 'busy'), '识别服务繁忙，请稍后重试或手动填写', '重新上传 ›'],
    ['job_draft_import_not_found', new BFF错误(404, 'job_draft_import_not_found', 'gone'), '这次识别已失效，请重新上传', '重新上传 ›'],
    ['storage_unavailable', new BFF错误(503, 'storage_unavailable', 'storage'), 不可用文案, '重试 ›'],
    ['network_error', new BFF错误(0, 'network_error', 'provider=openai request_id=req_2'), 不可用文案, '重试 ›'],
    ['HTTP 503 operation_outcome_unknown', new BFF错误(503, 'operation_outcome_unknown', 'unknown'), 不可用文案, '重试 ›'],
    ['invalid_response', new BFF错误(200, 'invalid_response', 'drift'), '服务返回异常，请稍后重试', '重新上传 ›'],
    ['未知 code', new BFF错误(500, 'mystery_error', 'provider=openai'), 不可用文案, '重新上传 ›'],
    ['原型链键 code', new BFF错误(422, 'constructor', 'proto'), 不可用文案, '重新上传 ›'],
    ['非 BFF错误', new Error('provider=openai request_id=req_9 model_output=SENSITIVE'), 不可用文案, '重新上传 ›'],
  ])('POST 失败 %s → 精确安全文案与动作，机器细节不上屏', async (_名, 错误, 文案, 动作) => {
    mock创建JD导入.mockRejectedValueOnce(错误).mockResolvedValueOnce(JDpending);
    render发布岗位();
    选择并确认JD(JDPDF());
    await 微任务结算();
    expect(横幅文字()).toBe(文案);
    expect(动作文字()).toBe(动作);
    expect(document.body.textContent).not.toContain('provider=openai');
    expect(document.body.textContent).not.toContain('request_id=req_');
    expect(document.body.textContent).not.toContain('model_output=');
  });

  // ── GET 异常：只有 network_error / HTTP 503 / storage_unavailable 保留 read 重试 ──
  it.each([
    ['network_error', new BFF错误(0, 'network_error', 'offline'), 不可用文案, '重试 ›'],
    ['HTTP 503', new BFF错误(503, 'downstream_unavailable', 'down'), 不可用文案, '重试 ›'],
    ['storage_unavailable', new BFF错误(503, 'storage_unavailable', 'storage'), 不可用文案, '重试 ›'],
    ['job_draft_import_not_found', new BFF错误(404, 'job_draft_import_not_found', 'gone'), '这次识别已失效，请重新上传', '重新上传 ›'],
    ['invalid_response', new BFF错误(200, 'invalid_response', 'drift'), '服务返回异常，请稍后重试', '重新上传 ›'],
    ['未知 code', new BFF错误(500, 'mystery_error', 'boom'), 不可用文案, '重新上传 ›'],
  ])('GET 失败 %s → 精确安全文案与动作', async (_名, 错误, 文案, 动作) => {
    mock创建JD导入.mockResolvedValue(JDpending);
    mock读取JD导入.mockRejectedValueOnce(错误).mockResolvedValueOnce(JDpending);
    render发布岗位();
    选择并确认JD(JDPDF());
    await 走(3000);
    await 微任务结算();
    expect(横幅文字()).toBe(文案);
    expect(动作文字()).toBe(动作);
    await 走(30000);
    // failed 后不再自动轮询
    expect(mock读取JD导入).toHaveBeenCalledTimes(1);
  });
});

// ── JD PDF 建议稿导入：快照安全合并、耦合组与 Catalog 规则（Task 4）──
// POST 起飞前捕获表单快照；succeeded 只写仍等于快照的字段；三个耦合组（招聘类型 /
// 办公方式 / 工作城市+地点引用）整组比较；类别只走轻提示；keywords 忽略。
describe('发布岗位页 JD 建议合并', () => {
  const 分类查询 = vi.fn(async (_kind: 'job-categories', query: { parentId?: string }) => {
    if (!query.parentId) {
      return {
        items: [{ id: 'cat_tech', display_name: '互联网/AI', parent_id: null, selectable: false }],
        nextCursor: null,
        catalogVersion: 'v2',
      };
    }
    if (query.parentId === 'cat_tech') {
      return {
        items: [{ id: 'job_be', display_name: '后端开发', parent_id: 'cat_tech', selectable: true }],
        nextCursor: null,
        catalogVersion: 'v2',
      };
    }
    return { items: [], nextCursor: null, catalogVersion: 'v2' };
  });
  const 地点查询 = vi.fn(async (query: { q?: string }) => {
    const 名 = (query.q ?? '').includes('北京') ? '北京' : '上海';
    return {
      items: [{
        id: `loc_${名}`, display_name: 名, country_code: 'CN', country_name: '中国',
        admin1_code: 'SH', admin1_name: 名, timezone: 'Asia/Shanghai', population: 24000000,
      }],
      nextCursor: null,
      catalogVersion: 'v2',
    };
  });

  const JD建议 = (覆盖: Partial<BFFJD建议>): BFFJD建议 => ({
    title: null, recruitment_type: null, workplace_mode: null, office_location: null,
    description: null, requirements: null, education_requirement: null,
    experience_requirement: null, category_source_name: null, location_source_name: null,
    keywords: [], ...覆盖,
  });
  const 成功 = (建议: BFFJD建议): BFFJD导入 => ({
    import_id: 'jdi_0123456789abcdef0123456789abcdef', status: 'succeeded',
    created_at: '2026-09-03T01:02:03Z', updated_at: '2026-09-03T01:02:06Z', suggestion: 建议,
  });

  const JDPDF = () => new File(['%PDF-1.7'], 'role.pdf', { type: 'application/pdf' });
  const 第二份PDF = () => new File(['%PDF-1.7'], 'another.pdf', { type: 'application/pdf' });

  const 标题框 = () => screen.getByPlaceholderText('必填，如：资深后端工程师 · 交易网关') as HTMLInputElement;
  const 描述框 = () => screen.getByLabelText('职位描述') as HTMLTextAreaElement;
  /** Task 2：城市为全页正文选择 —— 行 = 第三步选择条目；子视图搜索框 = 共用正文的输入 */
  const 城市行 = () => screen.getByRole('button', { name: /工作城市/ });
  const 办公地框 = () => screen.getByPlaceholderText('如：浦东新区世纪大道 1568 号中建大厦 28 层') as HTMLInputElement;
  /** 招聘类型块的 accessible name 含副标文案，统一按前缀匹配取按钮。 */
  const 按钮前缀 = (名: string) => screen.getByRole('button', { name: new RegExp(`^${名}`) });
  const 按下 = (名: string) => 按钮前缀(名).getAttribute('aria-pressed');
  /** 学历/经验两行都有「不限」档：按行标签定位该行的快捷片。 */
  const 按下片 = (区: RegExp, 名: string) => {
    const 行 = screen.getByText(区).closest('div[class*="编辑条目"]');
    const 键 = Array.from(行?.querySelectorAll('button') ?? []).find((b) => b.textContent === 名);
    return 键?.getAttribute('aria-pressed');
  };
  const 类别提示数 = () => 轻提示文案们().filter((条) => 条.startsWith('AI 识别的职位类别')).length;

  function 轻提示文案们(): string[] {
    for (const 节点 of Array.from(document.body.children)) {
      const 元素 = 节点 as HTMLElement;
      if (元素.style.position === 'fixed' && 元素.style.zIndex === '999') {
        return Array.from(元素.children).map((条) => 条.textContent ?? '');
      }
    }
    return [];
  }

  async function 走(毫秒: number): Promise<void> {
    await act(async () => { await vi.advanceTimersByTimeAsync(毫秒); });
  }
  async function 微任务结算(): Promise<void> {
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  }

  function render发布岗位(路由 = '/hr/post-job') {
    return render(
      <MemoryRouter initialEntries={[路由]}>
        <Routes>
          <Route path="/hr/post-job" element={<发布岗位 />} />
          <Route path="/hr/post-job/:id" element={<发布岗位 />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  function 选择JD(文件: File) {
    fireEvent.change(screen.getByLabelText('上传 JD 文件'), { target: { files: [文件] } });
  }
  function 确认JD() {
    fireEvent.click(screen.getByRole('button', { name: '同意并继续' }));
  }
  function 选择并确认JD(文件: File) {
    选择JD(文件);
    确认JD();
  }

  /** 第一步就绪：标题 + 现场 + Backend 类别叶子（先写标题，避免类别预填覆盖标题断言）。 */
  async function 第一步就绪(标题 = '上传前标题') {
    fireEvent.change(标题框(), { target: { value: 标题 } });
    fireEvent.click(screen.getByRole('button', { name: '现场' }));
    fireEvent.click(screen.getByRole('button', { name: /职位类别/ }));
    await 微任务结算();
    fireEvent.click(screen.getByText('后端开发'));
  }
  function 下一步() {
    fireEvent.click(screen.getByRole('button', { name: '下一步' }));
  }
  function 返回() {
    fireEvent.click(screen.getByRole('button', { name: '返回' }));
  }

  beforeEach(() => {
    vi.useFakeTimers();
    mock创建JD导入.mockReset();
    mock读取JD导入.mockReset();
    分类查询.mockClear();
    地点查询.mockClear();
    清空轻提示();
    置Backend应用状态(分类查询, 地点查询);
  });
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(document, 'hidden');
  });

  it('只自动填入上传后仍等于快照的字段（代表性用例）', async () => {
    const POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValue(POST门.promise);
    render发布岗位();
    await 第一步就绪('上传前标题');
    选择并确认JD(JDPDF());
    下一步();
    fireEvent.change(描述框(), { target: { value: '用户等待时写的描述' } });
    POST门.resolve(成功(JD建议({ title: 'AI 标题', description: 'AI 描述' })));
    await 微任务结算();
    // 等待期间改过的描述保留
    expect(描述框().value).toBe('用户等待时写的描述');
    // 上传后未改的标题被建议替换
    返回();
    expect(标题框().value).toBe('AI 标题');
    // 类别建议只走现有轻提示
    expect(类别提示数()).toBe(0); // 本建议 category 为 null
  });

  it('独立字段替换空白与未改的既有值；学历经验枚举映射精确；keywords 不进 DOM', async () => {
    const POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValue(POST门.promise);
    render发布岗位();
    await 第一步就绪('上传前标题');
    选择并确认JD(JDPDF());
    下一步();
    下一步();
    POST门.resolve(成功(JD建议({
      title: 'Senior Backend Engineer',
      description: '负责核心招聘服务。',
      requirements: '五年以上后端经验。',
      education_requirement: 'bachelor',
      experience_requirement: 'five_plus_years',
      keywords: ['Go', 'PostgreSQL'],
    })));
    await 微任务结算();
    expect(screen.queryByRole('textbox', { name: /给候选人看的职位要求/ })).toBeNull();
    expect(按下片(/最低学历/, '本科')).toBe('true');
    expect(按下片(/经验要求/, '5 年以上')).toBe('true');
    expect(screen.queryByText('Go')).toBeNull();
    expect(screen.queryByText('PostgreSQL')).toBeNull();
    返回();
    expect(描述框().value).toBe('负责核心招聘服务。');
    返回();
    // 上传前已非空但未修改的标题同样允许被替换（本轮已确认的自动填表语义）
    expect(标题框().value).toBe('Senior Backend Engineer');
  });

  it('解析期间改过的字段被保护；改回快照值后仍可被填（纯值比较）', async () => {
    const POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValue(POST门.promise);
    render发布岗位();
    await 第一步就绪('上传前标题');
    选择并确认JD(JDPDF());
    fireEvent.change(标题框(), { target: { value: '等待时改的标题' } });
    fireEvent.change(标题框(), { target: { value: '上传前标题' } });
    POST门.resolve(成功(JD建议({ title: 'AI 标题' })));
    await 微任务结算();
    expect(标题框().value).toBe('AI 标题');
  });

  it('null 建议保持当前值且不弹类别提示', async () => {
    const POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValue(POST门.promise);
    render发布岗位();
    await 第一步就绪('上传前标题');
    选择并确认JD(JDPDF());
    下一步();
    fireEvent.change(描述框(), { target: { value: '描述正文' } });
    下一步();
    POST门.resolve(成功(JD建议({})));
    await 微任务结算();
    expect(screen.queryByRole('textbox', { name: /给候选人看的职位要求/ })).toBeNull();
    expect(按下片(/最低学历/, '不限')).toBe('true');
    expect(城市行().textContent).toContain('请选择');
    返回();
    expect(描述框().value).toBe('描述正文');
    返回();
    expect(标题框().value).toBe('上传前标题');
    expect(按下('现场')).toBe('true');
    expect(类别提示数()).toBe(0);
  });

  it.each([
    ['none', '不限'], ['associate', '大专'], ['bachelor', '本科'], ['master', '硕士'], ['doctorate', '博士'],
  ] as const)('学历枚举 %s → %s', async (wire, label) => {
    mock创建JD导入.mockImplementationOnce(() => Promise.resolve(成功(JD建议({ education_requirement: wire }))));
    render发布岗位();
    await 第一步就绪();
    选择并确认JD(JDPDF());
    下一步();
    下一步();
    await 微任务结算();
    expect(按下片(/最低学历/, label)).toBe('true');
  });

  it.each([
    ['none', '不限'], ['one_to_three_years', '1-3 年'], ['three_to_five_years', '3-5 年'],
    ['five_plus_years', '5 年以上'], ['ten_plus_years', '10 年以上'],
  ] as const)('经验枚举 %s → %s（类型未变时独立应用）', async (wire, label) => {
    mock创建JD导入.mockImplementationOnce(() => Promise.resolve(成功(JD建议({ experience_requirement: wire }))));
    render发布岗位();
    await 第一步就绪();
    选择并确认JD(JDPDF());
    下一步();
    下一步();
    await 微任务结算();
    expect(按下片(/经验要求/, label)).toBe('true');
  });

  it('招聘类型组：整组等于快照才切换；切换清空薪资与年薪月数；校园招聘隐藏经验档', async () => {
    const POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValue(POST门.promise);
    render发布岗位();
    await 第一步就绪();
    下一步();
    下一步();
    fireEvent.click(screen.getByRole('button', { name: '薪资下限' }));
    fireEvent.click(within(screen.getByRole('listbox', { name: '薪资下限' })).getByRole('option', { name: '50' }));
    fireEvent.click(within(screen.getByRole('listbox', { name: '薪资上限' })).getByRole('option', { name: '65' }));
    fireEvent.click(screen.getByRole('button', { name: '确定' }));
    fireEvent.click(screen.getByRole('button', { name: /年薪月数/ }));
    fireEvent.click(screen.getByRole('button', { name: '确定' }));
    返回();
    返回();
    选择并确认JD(JDPDF());
    下一步();
    下一步();
    POST门.resolve(成功(JD建议({ recruitment_type: 'campus', experience_requirement: 'five_plus_years' })));
    await 微任务结算();
    // 切到校园招聘：薪资清理、经验档整块收起（隐藏经验不被写成模型事实）
    expect(screen.getByRole('button', { name: '薪资下限' }).textContent).toContain('—');
    expect(screen.getByRole('button', { name: /年薪月数/ }).textContent).toContain('请选择');
    expect(screen.queryByText('经验要求（自动匹配读取）')).toBeNull();
    返回();
    返回();
    expect(按下('校园招聘')).toBe('true');
  });

  it('招聘类型组：解析期间改过任一成员则整组保留', async () => {
    const POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValue(POST门.promise);
    render发布岗位();
    await 第一步就绪();
    选择并确认JD(JDPDF());
    下一步();
    下一步();
    fireEvent.click(screen.getByRole('button', { name: '薪资下限' }));
    fireEvent.click(within(screen.getByRole('listbox', { name: '薪资下限' })).getByRole('option', { name: '40' }));
    fireEvent.click(within(screen.getByRole('listbox', { name: '薪资上限' })).getByRole('option', { name: '65' }));
    fireEvent.click(screen.getByRole('button', { name: '确定' }));
    POST门.resolve(成功(JD建议({ recruitment_type: 'campus' })));
    await 微任务结算();
    返回();
    返回();
    expect(按下('社招全职')).toBe('true');
  });

  it('建议切到兼职时经验随组一起应用', async () => {
    const POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValue(POST门.promise);
    render发布岗位();
    await 第一步就绪();
    选择并确认JD(JDPDF());
    下一步();
    下一步();
    POST门.resolve(成功(JD建议({ recruitment_type: 'part_time', experience_requirement: 'ten_plus_years' })));
    await 微任务结算();
    expect(按下片(/经验要求/, '10 年以上')).toBe('true');
    返回();
    返回();
    expect(按下('兼职')).toBe('true');
  });

  it('建议切到实习生时重置转正确认', async () => {
    const POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValue(POST门.promise);
    render发布岗位();
    // 先在实习生下设转正=true，再切回社招全职（转正保留隐藏值）
    fireEvent.click(按钮前缀('实习生'));
    fireEvent.click(screen.getByRole('button', { name: '提供转正机会' }));
    fireEvent.click(按钮前缀('社招全职'));
    await 第一步就绪();
    选择并确认JD(JDPDF());
    POST门.resolve(成功(JD建议({ recruitment_type: 'internship' })));
    await 微任务结算();
    expect(按下('实习生')).toBe('true');
    expect(按下('提供转正机会')).toBe('false');
    expect(按下('暂不提供')).toBe('false');
  });

  it('办公方式组：导入全远程仍清旧址，但允许手填选填地址', async () => {
    const POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValue(POST门.promise);
    render发布岗位();
    await 第一步就绪();
    下一步();
    下一步();
    fireEvent.change(办公地框(), { target: { value: '张江路 1 号' } });
    返回();
    返回();
    选择并确认JD(JDPDF());
    下一步();
    下一步();
    POST门.resolve(成功(JD建议({ workplace_mode: 'remote', office_location: '不该出现的地址' })));
    await 微任务结算();
    expect(办公地框().value).toBe('');
    expect(办公地框().disabled).toBe(false);
    返回();
    返回();
    expect(按下('全远程')).toBe('true');
  });

  it('办公方式组：解析期间改过地址则整组保留', async () => {
    const POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValue(POST门.promise);
    render发布岗位();
    await 第一步就绪();
    选择并确认JD(JDPDF());
    下一步();
    下一步();
    fireEvent.change(办公地框(), { target: { value: '等待时改的地址' } });
    POST门.resolve(成功(JD建议({ workplace_mode: 'remote', office_location: 'AI 地址' })));
    await 微任务结算();
    expect(办公地框().value).toBe('等待时改的地址');
    expect(办公地框().disabled).toBe(false);
    返回();
    返回();
    expect(按下('现场')).toBe('true');
  });

  it('办公方式组：解析期间改过方式则地址建议不应用', async () => {
    const POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValue(POST门.promise);
    render发布岗位();
    await 第一步就绪();
    选择并确认JD(JDPDF());
    fireEvent.click(screen.getByRole('button', { name: '混合' }));
    POST门.resolve(成功(JD建议({ office_location: 'AI 地址' })));
    await 微任务结算();
    expect(按下('混合')).toBe('true');
    下一步();
    下一步();
    expect(办公地框().value).toBe('');
  });

  it('地点组：无引用且未改时，JD 源城市只作打开时的搜索初词', async () => {
    const POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValue(POST门.promise);
    render发布岗位();
    await 第一步就绪();
    选择并确认JD(JDPDF());
    下一步();
    下一步();
    POST门.resolve(成功(JD建议({ location_source_name: '上海' })));
    await 微任务结算();
    // Task 2：JD 源城市只作打开时的搜索初词 —— 行不回填、不产生引用
    expect(城市行().textContent).toContain('请选择');
    fireEvent.click(城市行());
    await 微任务结算();
    const 搜索框 = screen.getByPlaceholderText('搜索城市 / 省份') as HTMLInputElement;
    expect(搜索框.value).toBe('上海');
    await 走(260);
    expect(地点查询).toHaveBeenCalledWith(expect.objectContaining({ q: '上海' }));
    fireEvent.click(screen.getByRole('button', { name: '返回' }));
  });

  it('地点组：用户保存的引用优先于同轮迟到的 JD 源文本', async () => {
    const POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValue(POST门.promise);
    render发布岗位();
    await 第一步就绪();
    选择并确认JD(JDPDF());
    下一步();
    下一步();
    // 用户先经全页正文选定 北京（保存引用）
    fireEvent.click(城市行());
    fireEvent.change(screen.getByPlaceholderText('搜索城市 / 省份'), { target: { value: '北京' } });
    await 走(260);
    fireEvent.click(screen.getByRole('button', { name: '北京' }));
    fireEvent.click(screen.getByRole('button', { name: '保存' }));
    expect(城市行().textContent).toContain('北京');
    // 同轮迟到的 JD 源文本不覆盖用户保存的引用
    POST门.resolve(成功(JD建议({ location_source_name: '上海' })));
    await 微任务结算();
    expect(城市行().textContent).toContain('北京');
    // 重开子视图：初词不再注入 JD 源文本，初始已选是用户保存的引用
    fireEvent.click(城市行());
    expect((screen.getByPlaceholderText('搜索城市 / 省份') as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('button', { name: '北京 ✕' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '返回' }));
  });

  it('地点组：打开期间迟到的 JD 源文本不覆盖搜索词与临时选择', async () => {
    const POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValue(POST门.promise);
    render发布岗位();
    await 第一步就绪();
    选择并确认JD(JDPDF());
    下一步();
    下一步();
    // 先打开子视图并输入自己的搜索词（尚未保存引用）
    fireEvent.click(城市行());
    fireEvent.change(screen.getByPlaceholderText('搜索城市 / 省份'), { target: { value: '北京' } });
    POST门.resolve(成功(JD建议({ location_source_name: '上海' })));
    await 微任务结算();
    // 迟到 JD 不重置打开中的搜索词，也不写行值/引用
    expect((screen.getByPlaceholderText('搜索城市 / 省份') as HTMLInputElement).value).toBe('北京');
    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    expect(城市行().textContent).toContain('请选择');
  });

  it('create 重试沿用原快照：失败后用户编辑在重放成功时仍受保护', async () => {
    mock创建JD导入.mockRejectedValueOnce(new BFF错误(0, 'network_error', 'offline'));
    render发布岗位();
    await 第一步就绪('上传前标题');
    选择并确认JD(JDPDF());
    await 微任务结算();
    fireEvent.change(标题框(), { target: { value: '失败后改的标题' } });
    mock创建JD导入.mockResolvedValueOnce(成功(JD建议({ title: 'AI 标题' })));
    fireEvent.click(screen.getByText('重试 ›'));
    await 微任务结算();
    expect(标题框().value).toBe('失败后改的标题');
  });

  it('迟到代际的 succeeded 零应用且无类别提示', async () => {
    const 旧POST门 = deferred<BFFJD导入>();
    mock创建JD导入.mockReturnValueOnce(旧POST门.promise);
    render发布岗位();
    await 第一步就绪('上传前标题');
    选择并确认JD(JDPDF());
    选择JD(第二份PDF());
    旧POST门.resolve(成功(JD建议({
      title: 'AI 标题', recruitment_type: 'campus', workplace_mode: 'remote',
      office_location: 'AI 地址', description: 'AI 描述', location_source_name: '上海',
      category_source_name: '后端开发',
    })));
    await 微任务结算();
    expect(标题框().value).toBe('上传前标题');
    expect(按下('社招全职')).toBe('true');
    expect(按下('现场')).toBe('true');
    expect(类别提示数()).toBe(0);
  });
});
