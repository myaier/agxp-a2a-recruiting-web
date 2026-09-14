// 精选城市配置（Task 4）：产品展示用的 12 个大陆 + 10 个海外精选，顺序即产品顺序。
//
// 22 个 ID 全部经真实接口核验（GET /api/v1/catalog/locations，逐项命中，
// catalog_version cities500-2026-08-22-59d087eca781，backend agxp-monorepo@bf1ae2fd，
// 核验于 2026-09-14；证据见 dogfood-output/2026-09-14-city-ids/）。
//
// 只复用既有 目录选择值（id + display_name），不造完整 BFF 条目：
// 精选区展示 display_name（Spec §6.2 的中文别名），提交始终用 canonical ID，
// HTTP 层仍只发 ID。不含 TW/HK/MO —— 港澳台只出现在默认目录分组里（组内用 API 原名），
// 不做精选。运行产品禁止按这份配置首载 22 次搜索：它只是展示与提交引用的静态配置。

import type { 目录选择值 } from './招聘数据源类型';

export type 精选城市项 = 目录选择值 & { countryCode: string };

/** 大陆精选（Spec §6.2 的 12 项与顺序） */
export const 国内精选城市: readonly 精选城市项[] = [
  { id: 'loc_7gn74qrcymqcwwuqwotm47dbba', display_name: '北京', countryCode: 'CN' },
  { id: 'loc_ugt5s3vsvxs3fvd2llx7zc6fqe', display_name: '上海', countryCode: 'CN' },
  { id: 'loc_vy3ebpr35fdpnf47vxjbdkeofu', display_name: '深圳', countryCode: 'CN' },
  { id: 'loc_52x36rfspi2ujlvgf6armiypva', display_name: '广州', countryCode: 'CN' },
  { id: 'loc_rtahepw6oeduie7r2y6uuvuone', display_name: '杭州', countryCode: 'CN' },
  { id: 'loc_rnwcahrqvqml63ghf4nppnsb6m', display_name: '成都', countryCode: 'CN' },
  { id: 'loc_qo4w5gb36ynsb52vyfjqc5sriq', display_name: '南京', countryCode: 'CN' },
  { id: 'loc_rhxwvluw34qlzjlvhbxkllbumi', display_name: '武汉', countryCode: 'CN' },
  { id: 'loc_xxbtotpzlokmiqu4hu3i2y7vou', display_name: '苏州', countryCode: 'CN' },
  { id: 'loc_gpmoc4foa4ebtfoofdjysig5ai', display_name: '西安', countryCode: 'CN' },
  { id: 'loc_su65jpfrwv5ntghlvt2exhxvzq', display_name: '长沙', countryCode: 'CN' },
  { id: 'loc_rxsr3lujbdmye7l4jlhzzjkg4e', display_name: '合肥', countryCode: 'CN' },
];

/** 海外精选（Spec §6.2 的 10 项与顺序） */
export const 海外精选城市: readonly 精选城市项[] = [
  { id: 'loc_qdyx7r6fcyjrcokobaxsorhhrm', display_name: '新加坡', countryCode: 'SG' },
  { id: 'loc_gindn4bs4n7mvpn3faaijxbffu', display_name: '东京', countryCode: 'JP' },
  { id: 'loc_pswxk2zhx7ojs77li77rrnamdu', display_name: '首尔', countryCode: 'KR' },
  { id: 'loc_yznqm7rztcj3n3g44o32kpafr4', display_name: '纽约', countryCode: 'US' },
  { id: 'loc_l5z6vokf4ygtue6np52acqgfim', display_name: '旧金山', countryCode: 'US' },
  { id: 'loc_p23lys7rl6cfu5nv34z3qxdgdq', display_name: '洛杉矶', countryCode: 'US' },
  { id: 'loc_pioooosgfiwtihwvqmpfktcsxi', display_name: '伦敦', countryCode: 'GB' },
  { id: 'loc_j2huzmsvhzfnpeoww52qe6nkam', display_name: '悉尼', countryCode: 'AU' },
  { id: 'loc_savwtbprerwrbtcbxuvu2trvdy', display_name: '温哥华', countryCode: 'CA' },
  { id: 'loc_lfgywjg4b2fvfw2asycwtc3mwu', display_name: '多伦多', countryCode: 'CA' },
];
