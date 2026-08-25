// 目录选择 helper 测试（Task 4 Step 1）：分页合并去重、可提交判定、学校副标题。

import { describe, expect, it } from 'vitest';
import { 合并目录页, 可提交Taxonomy, 学校副标题 } from './目录选择';
import type { BFFTaxonomyItem, BFFInstitutionItem, BFFLocationItem } from './BFF契约';

describe('合并目录页', () => {
  it('合并分页时按 id 去重且保留导航节点', () => {
    expect(
      合并目录页(
        [{ id: 'root', display_name: '技术', parent_id: null, selectable: false }],
        [
          { id: 'root', display_name: '技术', parent_id: null, selectable: false },
          { id: 'leaf', display_name: '后端开发', parent_id: 'root', selectable: true },
        ],
      ).map((item) => item.id),
    ).toEqual(['root', 'leaf']);
  });

  it('空旧表直接保留新页全部', () => {
    const 新 = [
      { id: 'a', display_name: 'A', parent_id: null, selectable: false },
      { id: 'b', display_name: 'B', parent_id: null, selectable: true },
    ] satisfies BFFTaxonomyItem[];
    expect(合并目录页([], 新).map((item) => item.id)).toEqual(['a', 'b']);
  });
});

describe('可提交Taxonomy', () => {
  it('selectable=true 才可提交', () => {
    const 导航: BFFTaxonomyItem = { id: 'root', display_name: '技术', parent_id: null, selectable: false };
    const 叶: BFFTaxonomyItem = { id: 'leaf', display_name: '后端', parent_id: 'root', selectable: true };
    expect(可提交Taxonomy(导航)).toBe(false);
    expect(可提交Taxonomy(叶)).toBe(true);
  });
});

describe('学校副标题', () => {
  it('拼出「城市 · 国家」', () => {
    const 地点: BFFLocationItem = {
      id: 'loc_sh',
      display_name: '上海市',
      country_code: 'CN',
      country_name: '中国',
      admin1_code: '31',
      admin1_name: '上海市',
      timezone: 'Asia/Shanghai',
      population: 0,
    };
    const 学校: BFFInstitutionItem = {
      id: 'ins_fudan',
      display_name: '复旦大学',
      location: 地点,
    };
    expect(学校副标题(学校)).toBe('上海市 · 中国');
  });
});