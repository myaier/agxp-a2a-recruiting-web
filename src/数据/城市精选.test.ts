// 城市精选 配置测试（Task 4）：断言 12/10 长度、顺序、ID 唯一与国家范围。
// 注意：这里守住的是「配置与已核验 ID 表一致」的静态合同，
// 不是「这些 ID 可真实提交」的证明 —— 真实核验见 dogfood-output/2026-09-14-city-ids/
// （GET /api/v1/catalog/locations 22/22 命中，catalog_version
// cities500-2026-08-22-59d087eca781，backend agxp-monorepo@bf1ae2fd）。

import { describe, expect, it } from 'vitest';
import { 国内精选城市, 海外精选城市 } from './城市精选';

describe('城市精选 配置', () => {
  it('国内精选 12 项，顺序即产品顺序，ID 为真实核验的 canonical ID', () => {
    expect(国内精选城市).toHaveLength(12);
    expect(国内精选城市.map((项) => 项.id)).toEqual([
      'loc_7gn74qrcymqcwwuqwotm47dbba', // 北京
      'loc_ugt5s3vsvxs3fvd2llx7zc6fqe', // 上海
      'loc_vy3ebpr35fdpnf47vxjbdkeofu', // 深圳
      'loc_52x36rfspi2ujlvgf6armiypva', // 广州
      'loc_rtahepw6oeduie7r2y6uuvuone', // 杭州
      'loc_rnwcahrqvqml63ghf4nppnsb6m', // 成都
      'loc_qo4w5gb36ynsb52vyfjqc5sriq', // 南京
      'loc_rhxwvluw34qlzjlvhbxkllbumi', // 武汉
      'loc_xxbtotpzlokmiqu4hu3i2y7vou', // 苏州
      'loc_gpmoc4foa4ebtfoofdjysig5ai', // 西安
      'loc_su65jpfrwv5ntghlvt2exhxvzq', // 长沙
      'loc_rxsr3lujbdmye7l4jlhzzjkg4e', // 合肥
    ]);
    expect(国内精选城市.map((项) => 项.display_name)).toEqual([
      '北京', '上海', '深圳', '广州', '杭州', '成都', '南京', '武汉', '苏州', '西安', '长沙', '合肥',
    ]);
  });

  it('海外精选 10 项，顺序即产品顺序，ID 为真实核验的 canonical ID', () => {
    expect(海外精选城市).toHaveLength(10);
    expect(海外精选城市.map((项) => 项.id)).toEqual([
      'loc_qdyx7r6fcyjrcokobaxsorhhrm', // 新加坡
      'loc_gindn4bs4n7mvpn3faaijxbffu', // 东京
      'loc_pswxk2zhx7ojs77li77rrnamdu', // 首尔
      'loc_yznqm7rztcj3n3g44o32kpafr4', // 纽约
      'loc_l5z6vokf4ygtue6np52acqgfim', // 旧金山
      'loc_p23lys7rl6cfu5nv34z3qxdgdq', // 洛杉矶
      'loc_pioooosgfiwtihwvqmpfktcsxi', // 伦敦
      'loc_j2huzmsvhzfnpeoww52qe6nkam', // 悉尼
      'loc_savwtbprerwrbtcbxuvu2trvdy', // 温哥华
      'loc_lfgywjg4b2fvfw2asycwtc3mwu', // 多伦多
    ]);
    expect(海外精选城市.map((项) => 项.display_name)).toEqual([
      '新加坡', '东京', '首尔', '纽约', '旧金山', '洛杉矶', '伦敦', '悉尼', '温哥华', '多伦多',
    ]);
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
