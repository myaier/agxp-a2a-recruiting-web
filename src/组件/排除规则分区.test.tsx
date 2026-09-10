import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { 应用状态提供者 } from '../状态/应用状态';
import 排除规则分区 from './排除规则分区';
import { 读资料缓存, 资料缓存键 } from '../数据/资料缓存';

const 范围 = { 模式: 'mock', 环境: 'stg', 账号: 'demo' } as const;
let 存储: Storage;
beforeEach(() => {
  const 数据 = new Map<string, string>();
  存储 = { get length() { return 数据.size; }, key: 序 => [...数据.keys()][序] ?? null,
    getItem: 键 => 数据.get(键) ?? null, setItem: (键, 值) => { 数据.set(键, 值); },
    removeItem: 键 => { 数据.delete(键); }, clear: () => 数据.clear() };
  vi.stubGlobal('localStorage', 存储);
});
function 装载() { return render(<应用状态提供者><排除规则分区 /></应用状态提供者>); }
it('旧缓存可选字段缺省，新规则编辑启停删除在原账号键恢复；删除空表不重新生成默认', async () => {
  const user = userEvent.setup(); let 视图 = 装载();
  expect(screen.getAllByRole('switch')).toHaveLength(4);
  await user.click(screen.getByText('大小周'));
  await user.clear(screen.getByRole('textbox')); await user.type(screen.getByRole('textbox'), '隔周六也排除{Enter}');
  await user.click(screen.getByRole('switch', { name: '规则：隔周六也排除' }));
  const 快照 = JSON.parse(存储.getItem(资料缓存键(范围))!);
  expect(快照.排除规则[0]).toMatchObject({ 内容: '隔周六也排除', 生效: false });
  视图.unmount(); 视图 = 装载();
  expect(screen.getByRole('switch', { name: '规则：隔周六也排除' }).getAttribute('aria-checked')).toBe('false');
  for (const 内容 of ['隔周六也排除', '纯外包 / 乙方', '全现场办公', '频繁出差']) {
    await user.click(screen.getByRole('button', { name: `显示删除：${内容}` }));
    await user.click(screen.getByRole('button', { name: `删除规则：${内容}` }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: '删除' }));
  }
  视图.unmount(); 装载(); expect(screen.queryAllByRole('switch')).toHaveLength(0);
});
it('添加取消弃稿，中文组合输入不提前提交，添加与确认规则是不同操作', async () => {
  const user = userEvent.setup(); 装载();
  await user.click(screen.getByRole('button', { name: /添加规则/ }));
  const 输入 = screen.getByRole('textbox');
  fireEvent.compositionStart(输入); fireEvent.change(输入, { target: { value: '固定夜班' } }); fireEvent.keyDown(输入, { key: 'Enter' });
  expect(screen.getAllByRole('switch')).toHaveLength(4);
  fireEvent.compositionEnd(输入); await user.click(screen.getByRole('button', { name: '取消' }));
  await user.click(screen.getByRole('button', { name: /添加规则/ }));
  expect((screen.getByRole('textbox') as HTMLInputElement).value).toBe('');
  await user.type(screen.getByRole('textbox'), '固定夜班{Enter}');
  expect(screen.getByRole('switch', { name: '规则：固定夜班' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: '确认规则' })).toBeNull();
});
it('Backend 不从浏览器恢复模拟排除规则，坏字段不破坏其他合法历史数据', () => {
  const 后端范围 = { ...范围, 模式: 'backend' } as const;
  存储.setItem(资料缓存键(后端范围), JSON.stringify({ 排除规则: [{ 编号: '排除', 内容: '夜班', 来源: '测试', 生效: true }] }));
  expect(读资料缓存(存储, 后端范围).排除规则).toBeUndefined();
  存储.setItem(资料缓存键(范围), JSON.stringify({ 排除规则: '损坏', 求职先问偏好: { 递交材料: '先问我', 超授权让步: '直接回绝' } }));
  expect(读资料缓存(存储, 范围)).toEqual({ 求职先问偏好: { 递交材料: '先问我', 超授权让步: '直接回绝' } });
});
