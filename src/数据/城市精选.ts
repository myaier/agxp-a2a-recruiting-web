// 精选城市配置（Task 4 / Task 6）：产品展示用的 12 个大陆 + 10 个海外精选，顺序即产品顺序。
//
// 22 个 ID 全部经真实接口核验（GET /api/v1/catalog/locations，逐项命中，
// catalog_version cities500-2026-08-22-59d087eca781，backend agxp-monorepo@bf1ae2fd，
// 核验于 2026-09-14；证据见 dogfood-output/2026-09-14-city-ids/）。
//
// Task 6（2026-09-15）：display_name 从硬编码中文别名对齐为接口同款规范显示名
// （大陆加「市」、海外用目录权威英文名，不猜译名、不普遍加「市」），消除
// 「同 ID 两套名字」——旧中文名只作为有限别名在搜索与选中比较里兼容（见两个 helper）。
//
// 只复用既有 目录选择值（id + display_name），不造完整 BFF 条目：
// 精选区展示 display_name，提交始终用 canonical ID，
// HTTP 层仍只发 ID。不含 TW/HK/MO —— 港澳台只出现在默认目录分组里（组内用 API 原名），
// 不做精选。运行产品禁止按这份配置首载 22 次搜索：它只是展示与提交引用的静态配置。

import type { 目录选择值 } from './招聘数据源类型';

export type 精选城市项 = 目录选择值 & { countryCode: string };

/** 大陆精选（Spec §6.2 的 12 项与顺序；显示名为目录规范名） */
export const 国内精选城市: readonly 精选城市项[] = [
  { id: 'loc_7gn74qrcymqcwwuqwotm47dbba', display_name: '北京市', countryCode: 'CN' },
  { id: 'loc_ugt5s3vsvxs3fvd2llx7zc6fqe', display_name: '上海市', countryCode: 'CN' },
  { id: 'loc_vy3ebpr35fdpnf47vxjbdkeofu', display_name: '深圳市', countryCode: 'CN' },
  { id: 'loc_52x36rfspi2ujlvgf6armiypva', display_name: '广州市', countryCode: 'CN' },
  { id: 'loc_rtahepw6oeduie7r2y6uuvuone', display_name: '杭州市', countryCode: 'CN' },
  { id: 'loc_rnwcahrqvqml63ghf4nppnsb6m', display_name: '成都市', countryCode: 'CN' },
  { id: 'loc_qo4w5gb36ynsb52vyfjqc5sriq', display_name: '南京市', countryCode: 'CN' },
  { id: 'loc_rhxwvluw34qlzjlvhbxkllbumi', display_name: '武汉市', countryCode: 'CN' },
  { id: 'loc_xxbtotpzlokmiqu4hu3i2y7vou', display_name: '苏州市', countryCode: 'CN' },
  { id: 'loc_gpmoc4foa4ebtfoofdjysig5ai', display_name: '西安市', countryCode: 'CN' },
  { id: 'loc_su65jpfrwv5ntghlvt2exhxvzq', display_name: '长沙市', countryCode: 'CN' },
  { id: 'loc_rxsr3lujbdmye7l4jlhzzjkg4e', display_name: '合肥市', countryCode: 'CN' },
];

/** 海外精选（Spec §6.2 的 10 项与顺序；显示名为目录权威英文名） */
export const 海外精选城市: readonly 精选城市项[] = [
  { id: 'loc_qdyx7r6fcyjrcokobaxsorhhrm', display_name: 'Singapore', countryCode: 'SG' },
  { id: 'loc_gindn4bs4n7mvpn3faaijxbffu', display_name: 'Tokyo', countryCode: 'JP' },
  { id: 'loc_pswxk2zhx7ojs77li77rrnamdu', display_name: 'Seoul', countryCode: 'KR' },
  { id: 'loc_yznqm7rztcj3n3g44o32kpafr4', display_name: 'New York City', countryCode: 'US' },
  { id: 'loc_l5z6vokf4ygtue6np52acqgfim', display_name: 'San Francisco', countryCode: 'US' },
  { id: 'loc_p23lys7rl6cfu5nv34z3qxdgdq', display_name: 'Los Angeles', countryCode: 'US' },
  { id: 'loc_pioooosgfiwtihwvqmpfktcsxi', display_name: 'London', countryCode: 'GB' },
  { id: 'loc_j2huzmsvhzfnpeoww52qe6nkam', display_name: 'Sydney', countryCode: 'AU' },
  { id: 'loc_savwtbprerwrbtcbxuvu2trvdy', display_name: 'Vancouver', countryCode: 'CA' },
  { id: 'loc_lfgywjg4b2fvfw2asycwtc3mwu', display_name: 'Toronto', countryCode: 'CA' },
];

// ── Task 6 有限别名兼容（只在这份表内，不普遍加「市」、不猜海外译名）────────
/** 旧静态名/旧中文海外名 → 目录规范显示名。键集固定为上表 22 项的旧名。 */
const 规范名映射: Readonly<Record<string, string>> = {
  北京: '北京市',
  上海: '上海市',
  深圳: '深圳市',
  广州: '广州市',
  杭州: '杭州市',
  成都: '成都市',
  南京: '南京市',
  武汉: '武汉市',
  苏州: '苏州市',
  西安: '西安市',
  长沙: '长沙市',
  合肥: '合肥市',
  新加坡: 'Singapore',
  东京: 'Tokyo',
  首尔: 'Seoul',
  纽约: 'New York City',
  旧金山: 'San Francisco',
  洛杉矶: 'Los Angeles',
  伦敦: 'London',
  悉尼: 'Sydney',
  温哥华: 'Vancouver',
  多伦多: 'Toronto',
};

/** 有限别名归一：仅上表旧名映射为目录规范名，其余（未知名/已是规范名）原样返回。 */
export function 规范精选城市名称(名称: string): string {
  return 规范名映射[名称] ?? 名称;
}

/** 精选 ID → 目录规范显示名（ID 是唯一身份） */
const 规范名按ID = new Map<string, string>(
  [...国内精选城市, ...海外精选城市].map((项) => [项.id, 项.display_name]),
);

/** 按显示：ID 命中精选表时用目录规范名（旧静态 ref 的显示规范化），否则原名返回。
 *  绝不重建 ID、不改写存储 —— 提交仍用调用方原来的 ID。 */
export function 精选城市显示名(id: string, 原名: string): string {
  return 规范名按ID.get(id) ?? 原名;
}