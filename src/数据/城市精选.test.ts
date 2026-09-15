// 城市精选 配置测试（Task 4 / Task 6）：断言 12/10 长度、顺序、ID 唯一、国家范围，
// 以及 Task 6 的规范显示名（与分省/搜索目录的接口 display_name 一致）与有限别名 helper。
// 注意：这里守住的是「配置与已核验 ID 表一致」的静态合同，
// 不是「这些 ID 可真实提交」的证明 —— 真实核验见 dogfood-output/2026-09-14-city-ids/
// （GET /api/v1/catalog/locations 22/22 命中，catalog_version
// cities500-2026-08-22-59d087eca781，backend agxp-monorepo@bf1ae2fd）。

import { describe, expect, it } from 'vitest';
import {
  国内精选城市,
  海外精选城市,
  精选城市显示名,
  规范精选城市名称,
} from './城市精选';

/** Task 6 已核验的 22 城市表（旧名 → 目录规范名 + 固定 ID）：逐项断言，防止只测北京/上海 */
const 核验表 = [
  { 旧名: '北京', 规范名: '北京市', id: 'loc_7gn74qrcymqcwwuqwotm47dbba', 国家: 'CN' },
  { 旧名: '上海', 规范名: '上海市', id: 'loc_ugt5s3vsvxs3fvd2llx7zc6fqe', 国家: 'CN' },
  { 旧名: '深圳', 规范名: '深圳市', id: 'loc_vy3ebpr35fdpnf47vxjbdkeofu', 国家: 'CN' },
  { 旧名: '广州', 规范名: '广州市', id: 'loc_52x36rfspi2ujlvgf6armiypva', 国家: 'CN' },
  { 旧名: '杭州', 规范名: '杭州市', id: 'loc_rtahepw6oeduie7r2y6uuvuone', 国家: 'CN' },
  { 旧名: '成都', 规范名: '成都市', id: 'loc_rnwcahrqvqml63ghf4nppnsb6m', 国家: 'CN' },
  { 旧名: '南京', 规范名: '南京市', id: 'loc_qo4w5gb36ynsb52vyfjqc5sriq', 国家: 'CN' },
  { 旧名: '武汉', 规范名: '武汉市', id: 'loc_rhxwvluw34qlzjlvhbxkllbumi', 国家: 'CN' },
  { 旧名: '苏州', 规范名: '苏州市', id: 'loc_xxbtotpzlokmiqu4hu3i2y7vou', 国家: 'CN' },
  { 旧名: '西安', 规范名: '西安市', id: 'loc_gpmoc4foa4ebtfoofdjysig5ai', 国家: 'CN' },
  { 旧名: '长沙', 规范名: '长沙市', id: 'loc_su65jpfrwv5ntghlvt2exhxvzq', 国家: 'CN' },
  { 旧名: '合肥', 规范名: '合肥市', id: 'loc_rxsr3lujbdmye7l4jlhzzjkg4e', 国家: 'CN' },
  { 旧名: '新加坡', 规范名: 'Singapore', id: 'loc_qdyx7r6fcyjrcokobaxsorhhrm', 国家: 'SG' },
  { 旧名: '东京', 规范名: 'Tokyo', id: 'loc_gindn4bs4n7mvpn3faaijxbffu', 国家: 'JP' },
  { 旧名: '首尔', 规范名: 'Seoul', id: 'loc_pswxk2zhx7ojs77li77rrnamdu', 国家: 'KR' },
  { 旧名: '纽约', 规范名: 'New York City', id: 'loc_yznqm7rztcj3n3g44o32kpafr4', 国家: 'US' },
  { 旧名: '旧金山', 规范名: 'San Francisco', id: 'loc_l5z6vokf4ygtue6np52acqgfim', 国家: 'US' },
  { 旧名: '洛杉矶', 规范名: 'Los Angeles', id: 'loc_p23lys7rl6cfu5nv34z3qxdgdq', 国家: 'US' },
  { 旧名: '伦敦', 规范名: 'London', id: 'loc_pioooosgfiwtihwvqmpfktcsxi', 国家: 'GB' },
  { 旧名: '悉尼', 规范名: 'Sydney', id: 'loc_j2huzmsvhzfnpeoww52qe6nkam', 国家: 'AU' },
  { 旧名: '温哥华', 规范名: 'Vancouver', id: 'loc_savwtbprerwrbtcbxuvu2trvdy', 国家: 'CA' },
  { 旧名: '多伦多', 规范名: 'Toronto', id: 'loc_lfgywjg4b2fvfw2asycwtc3mwu', 国家: 'CA' },
] as const;

describe('城市精选 配置', () => {
  it('国内精选 12 项，顺序即产品顺序，ID 为真实核验的 canonical ID', () => {
    expect(国内精选城市).toHaveLength(12);
    expect(国内精选城市.map((项) => 项.id)).toEqual(核验表.slice(0, 12).map((项) => 项.id));
    expect(国内精选城市.map((项) => 项.display_name)).toEqual(核验表.slice(0, 12).map((项) => 项.规范名));
    expect(国内精选城市.map((项) => 项.countryCode)).toEqual(核验表.slice(0, 12).map((项) => 项.国家));
  });

  it('海外精选 10 项，顺序即产品顺序，ID 为真实核验的 canonical ID', () => {
    expect(海外精选城市).toHaveLength(10);
    expect(海外精选城市.map((项) => 项.id)).toEqual(核验表.slice(12).map((项) => 项.id));
    expect(海外精选城市.map((项) => 项.display_name)).toEqual(核验表.slice(12).map((项) => 项.规范名));
    expect(海外精选城市.map((项) => 项.countryCode)).toEqual(核验表.slice(12).map((项) => 项.国家));
  });

  it('Task 6：22 项逐条对齐规范显示名（防只测北京/上海）', () => {
    const 全部 = [...国内精选城市, ...海外精选城市];
    expect(全部).toHaveLength(22);
    核验表.forEach((行, 序) => {
      expect(全部[序].id).toBe(行.id);
      expect(全部[序].display_name).toBe(行.规范名);
      expect(全部[序].countryCode).toBe(行.国家);
    });
    // 海外按权威目录英文名，绝不按字符串补「市」
    for (const 项 of 海外精选城市) expect(项.display_name.endsWith('市')).toBe(false);
  });

  it('22 个 ID 全局唯一，且每项都是 id + display_name + countryCode', () => {
    const 全部 = [...国内精选城市, ...海外精选城市];
    const ids = 全部.map((项) => 项.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const 项 of 全部) {
      expect(项.id).toMatch(/^loc_[a-z0-9]+$/);
      expect(项.display_name.length).toBeGreaterThan(0);
      expect(项.countryCode.length).toBe(2);
    }
  });

  it('国家范围：国内全部 CN；海外为核验表列国家；港澳台不进精选', () => {
    expect(国内精选城市.every((项) => 项.countryCode === 'CN')).toBe(true);
    expect(new Set(海外精选城市.map((项) => 项.countryCode))).toEqual(
      new Set(['SG', 'JP', 'KR', 'US', 'GB', 'AU', 'CA']),
    );
    const 港澳台 = [...国内精选城市, ...海外精选城市].filter((项) =>
      ['TW', 'HK', 'MO'].includes(项.countryCode),
    );
    expect(港澳台).toEqual([]);
  });
});

describe('Task 6 有限别名 helper', () => {
  it('规范精选城市名称：22 个旧名逐一映射到规范名，其余原样', () => {
    for (const 行 of 核验表) {
      expect(规范精选城市名称(行.旧名)).toBe(行.规范名);
    }
    // 未知名字保持：不做普遍加「市」
    expect(规范精选城市名称('迪拜')).toBe('迪拜');
    expect(规范精选城市名称('杭州')).toBe('杭州市');
    expect(规范精选城市名称('东莞')).toBe('东莞');
    expect(规范精选城市名称('香港')).toBe('香港');
    expect(规范精选城市名称('')).toBe('');
    // 已是规范名的不二次改写
    expect(规范精选城市名称('北京市')).toBe('北京市');
    expect(规范精选城市名称('广州市')).toBe('广州市');
    expect(规范精选城市名称('Singapore')).toBe('Singapore');
    // 失败反例：绝不出现「广州市市」
    expect(规范精选城市名称(规范精选城市名称('广州'))).toBe('广州市');
  });

  it('精选城市显示名：ID 命中用目录规范名，未知 ID 原样', () => {
    for (const 行 of 核验表) {
      // 旧静态名也按 ID 规范化（静态旧 ref 显示可规范化）
      expect(精选城市显示名(行.id, 行.旧名)).toBe(行.规范名);
      // 目录已带规范名时保持一致
      expect(精选城市显示名(行.id, 行.规范名)).toBe(行.规范名);
    }
    // 未知 ID：原名返回（不猜、不加后缀）
    expect(精选城市显示名('loc_unknown', '朝阳')).toBe('朝阳');
    expect(精选城市显示名('loc_unknown', '广州市')).toBe('广州市');
    expect(精选城市显示名('loc_unknown', '')).toBe('');
  });
});