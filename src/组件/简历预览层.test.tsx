// 简历预览层 · 候选原件投影契约（P0）：招聘方打开 S1 附件看到的是该候选人自己的原件
// （身份 / 联系方式 / 履历），不能读取求职端全局状态把所有候选都渲染成沈亦舟；
// 没有 S1 原件投影的候选仍显示代号与打码联系方式。
// Task 4（Spec §4）：招聘聊天「看在线简历」改用提取出的 真人在线简历正文 纯展示纸身；
// 本文件保留的 PDF 附件原件层（在谈详情 / 候选详情 的附件预览）不受影响。

import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import 简历原件层, { 简历纸身 } from './简历预览层';
import { 候选简历原件表 } from '../数据/企业端模拟数据';

/** Task 4 源码合同：聊天入口已换纸身，附件原件层的其他消费者保持不动。 */
const 企业真人会话tsx源码 = readFileSync(join(process.cwd(), 'src', '屏幕', '企业真人会话.tsx'), 'utf8');
const 候选详情tsx源码 = readFileSync(join(process.cwd(), 'src', '屏幕', '候选详情.tsx'), 'utf8');
const 在谈详情tsx源码 = readFileSync(join(process.cwd(), 'src', '屏幕', '在谈详情.tsx'), 'utf8');

// 简历纸身 仍调用 use应用状态（求职者自己的原件分支才消费全局；候选原件分支不消费），
// 桩一份最小状态保证 hook 不报错，且候选原件分支不会读出全局沈亦舟。
vi.mock('../状态/应用状态', () => ({
  use应用状态: () => ({
    状态: {
      个人优势: '全局优势不应出现在候选原件分支',
      简历经历: [
        { 编号: 'G-1', 公司: '全局公司不应出现', 职位: '研发专家 2-2 · 交易中台', 开始: '2019-06', 结束: null, 内容: '全局经历不应出现' },
      ],
      简历教育: [{ 编号: 'E-1', 学校: '全局学校', 学历: '硕士', 专业: '计算机', 开始: '2014', 结束: '2017' }],
      基本信息: { 真名: '沈亦舟' },
      // 2026-08-26 联系方式升级为全局切片(个人信息页可编辑),桩里补上
      联系方式: { 手机: '138 0217 6021', 微信: 'shenyizhou_88', 邮箱: 'shenyizhou@qq.com' },
    },
  }),
}));

describe('简历预览层 · 候选原件投影', () => {
  it('招聘方原件使用当前候选自己的身份、联系方式和履历', () => {
    render(
      <简历原件层
        文件名="顾晚舟_简历.pdf"
        候选原件={候选简历原件表['A-02']}
        关闭={vi.fn()}
      />,
    );
    expect(screen.getByText('林若衡')).toBeTruthy();
    expect(screen.getByText(/139 0000 0002/)).toBeTruthy();
    expect(screen.getByText(/11 年经验/)).toBeTruthy();
    expect(screen.getByText('九坤投资')).toBeTruthy();
    expect(screen.queryByText('沈亦舟')).toBeNull();
  });

  it('没有 S1 原件投影的候选仍显示代号和打码联系方式', () => {
    render(<简历原件层 文件名="苏含章_简历.pdf" 匿名代号="苏含章" 关闭={vi.fn()} />);
    expect(screen.getByText('苏含章')).toBeTruthy();
    expect(screen.getByText(/138\*\*\*\*6021/)).toBeTruthy();
    expect(screen.queryByText('沈亦舟')).toBeNull();
  });

  it('简历纸身 候选原件分支不读求职端全局经历', () => {
    render(<简历纸身 候选原件={候选简历原件表['A-02']} 原件 代号="顾晚舟" />);
    expect(screen.getByText('林若衡')).toBeTruthy();
    expect(screen.queryByText('研发专家 2-2 · 交易中台')).toBeNull();
    expect(screen.queryByText('全局公司不应出现')).toBeNull();
  });
});

describe('简历预览层 · Task 4 聊天入口换纸身（其他附件入口保持）', () => {
  it('企业真人会话 不再使用本文件的简历纸身，改用 真人在线简历正文', () => {
    expect(企业真人会话tsx源码).not.toContain('简历预览层');
    expect(企业真人会话tsx源码).toContain('真人在线简历正文');
  });

  it('附件原件预览的其他页面仍消费本文件（在谈详情 / 候选详情）', () => {
    expect(在谈详情tsx源码).toContain("from '../组件/简历预览层'");
    expect(候选详情tsx源码).toContain("from '../组件/简历预览层'");
  });
});