// 城市按拼音首字母分组的派生表（2026-08-21「添加求职期望」次级页 A 新增）。
//
// 为什么要这张表：`城市与行业.ts` 的 `城市字典` 是按**省份**分的，
// 「选择城市」多选页要的是 A-Z 分节 + 右侧字母索引条 + 拼音搜索，
// 两种分法都要保留，所以这里只做**派生**，不新增、不删减任何城市 ——
// 城市全集永远以 `城市字典` 为唯一来源，两边不可能对不上。
//
// 拼音表按常识手写（不引第三方库：原型不值得为 121 个固定城市背一个拼音库）。
// 多音 / 易错的几个已按地名读音校对：
//   厦门 xiamen（不是 shamen）、重庆 chongqing（不是 zhongqing）、
//   长沙 changsha / 长春 changchun（不是 zhang）、蚌埠 bengbu、六安不在集内。

import { 城市字典 } from './城市与行业';

/** 城市名 → 全拼小写。搜索框输「hangzhou」「hang」都要能命中杭州，用它做前缀/子串匹配。 */
export const 城市拼音: Record<string, string> = {
  // 直辖市
  北京: 'beijing',
  上海: 'shanghai',
  天津: 'tianjin',
  重庆: 'chongqing',
  // 广东
  深圳: 'shenzhen',
  广州: 'guangzhou',
  东莞: 'dongguan',
  佛山: 'foshan',
  珠海: 'zhuhai',
  中山: 'zhongshan',
  惠州: 'huizhou',
  汕头: 'shantou',
  // 浙江
  杭州: 'hangzhou',
  宁波: 'ningbo',
  温州: 'wenzhou',
  嘉兴: 'jiaxing',
  绍兴: 'shaoxing',
  金华: 'jinhua',
  台州: 'taizhou',
  湖州: 'huzhou',
  // 江苏
  南京: 'nanjing',
  苏州: 'suzhou',
  无锡: 'wuxi',
  常州: 'changzhou',
  南通: 'nantong',
  徐州: 'xuzhou',
  扬州: 'yangzhou',
  盐城: 'yancheng',
  // 山东
  青岛: 'qingdao',
  济南: 'jinan',
  烟台: 'yantai',
  潍坊: 'weifang',
  临沂: 'linyi',
  淄博: 'zibo',
  威海: 'weihai',
  // 四川
  成都: 'chengdu',
  绵阳: 'mianyang',
  德阳: 'deyang',
  宜宾: 'yibin',
  泸州: 'luzhou',
  // 湖北
  武汉: 'wuhan',
  宜昌: 'yichang',
  襄阳: 'xiangyang',
  荆州: 'jingzhou',
  // 湖南
  长沙: 'changsha',
  株洲: 'zhuzhou',
  湘潭: 'xiangtan',
  衡阳: 'hengyang',
  岳阳: 'yueyang',
  // 陕西
  西安: 'xian',
  咸阳: 'xianyang',
  宝鸡: 'baoji',
  榆林: 'yulin',
  // 福建
  厦门: 'xiamen',
  福州: 'fuzhou',
  泉州: 'quanzhou',
  漳州: 'zhangzhou',
  // 河南
  郑州: 'zhengzhou',
  洛阳: 'luoyang',
  南阳: 'nanyang',
  新乡: 'xinxiang',
  // 安徽
  合肥: 'hefei',
  芜湖: 'wuhu',
  蚌埠: 'bengbu',
  安庆: 'anqing',
  // 河北
  石家庄: 'shijiazhuang',
  唐山: 'tangshan',
  保定: 'baoding',
  廊坊: 'langfang',
  雄安: 'xiongan',
  // 辽宁
  大连: 'dalian',
  沈阳: 'shenyang',
  鞍山: 'anshan',
  锦州: 'jinzhou',
  // 江西
  南昌: 'nanchang',
  赣州: 'ganzhou',
  九江: 'jiujiang',
  上饶: 'shangrao',
  // 广西
  南宁: 'nanning',
  柳州: 'liuzhou',
  桂林: 'guilin',
  北海: 'beihai',
  // 云南
  昆明: 'kunming',
  大理: 'dali',
  丽江: 'lijiang',
  曲靖: 'qujing',
  // 贵州
  贵阳: 'guiyang',
  遵义: 'zunyi',
  毕节: 'bijie',
  // 山西
  太原: 'taiyuan',
  大同: 'datong',
  临汾: 'linfen',
  // 黑龙江
  哈尔滨: 'haerbin',
  大庆: 'daqing',
  齐齐哈尔: 'qiqihaer',
  // 吉林
  长春: 'changchun',
  吉林: 'jilin',
  延边: 'yanbian',
  // 内蒙古
  呼和浩特: 'huhehaote',
  包头: 'baotou',
  鄂尔多斯: 'eerduosi',
  // 甘肃
  兰州: 'lanzhou',
  天水: 'tianshui',
  // 新疆
  乌鲁木齐: 'wulumuqi',
  克拉玛依: 'kelamayi',
  伊犁: 'yili',
  // 宁夏 / 青海 / 西藏
  银川: 'yinchuan',
  西宁: 'xining',
  拉萨: 'lasa',
  // 海南
  海口: 'haikou',
  三亚: 'sanya',
  // 港澳台
  香港: 'xianggang',
  澳门: 'aomen',
  台北: 'taibei',
  // 海外
  新加坡: 'xinjiapo',
  东京: 'dongjing',
  首尔: 'shouer',
  旧金山: 'jiujinshan',
  纽约: 'niuyue',
  伦敦: 'lundun',
  迪拜: 'dibai',
};

/** 城市全集（去重后，顺序即 `城市字典` 里出现的顺序）。搜索时直接遍历它。 */
export const 全部城市: string[] = Array.from(
  new Set(城市字典.flatMap((省组) => 省组.城市))
);

export interface 首字母分组 {
  首字母: string;
  城市: string[];
}

/** 把城市全集按拼音首字母重排。
 *  字母表 A-Z 升序；同一字母内部按全拼升序，这样「北海」排在「北京」前、「宝鸡」在最前，
 *  和通讯录/城市选择器的常规顺序一致。
 *  只保留**真的有城市**的字母 —— 右侧索引条直接读这张表，
 *  空字母若也画出来，点了滚不动，是个死按钮。 */
export const 城市按首字母: 首字母分组[] = (() => {
  const 按字母归堆 = new Map<string, string[]>();

  for (const 城 of 全部城市) {
    const 拼音 = 城市拼音[城];
    // 拼音表漏字必须当场炸出来：这是静态数据不一致，
    // 悄悄跳过会让这座城市在 A-Z 分区里凭空消失，比报错难查得多。
    if (!拼音) {
      throw new Error(`城市首字母：「${城}」缺拼音，请在 城市拼音 里补上`);
    }
    const 首字母 = 拼音[0].toUpperCase();
    const 同字母 = 按字母归堆.get(首字母);
    if (同字母) 同字母.push(城);
    else 按字母归堆.set(首字母, [城]);
  }

  return Array.from(按字母归堆.entries())
    .sort(([左], [右]) => 左.localeCompare(右))
    .map(([首字母, 城市]) => ({
      首字母,
      城市: 城市.sort((甲, 乙) => 城市拼音[甲].localeCompare(城市拼音[乙])),
    }));
})();
