// 公司真实 logo（favicon 抓取，2026-08-18 标注 23:55）。
// 卡片头像优先用这里的图；查不到的公司回退到首字字标。
// 小红书用 Wikimedia 官方图；华泰只抓到占位图标，不入映射（宁可字标也不放假 logo）。
import 抖音 from './公司标/抖音.png';
import 小红书 from './公司标/小红书.png';
import 腾讯 from './公司标/腾讯.png';
import 硅基流动 from './公司标/硅基流动.png';
import PingPong图 from './公司标/PingPong.png';
import 阿里云 from './公司标/阿里云.png';
import MiniMax图 from './公司标/MiniMax.png';
import 阶跃星辰 from './公司标/阶跃星辰.png';
import 老虎国际 from './公司标/老虎国际.png';
import PingCAP图 from './公司标/PingCAP.png';

export const 公司标映射: Record<string, string> = {
  抖音,
  小红书,
  腾讯,
  硅基流动,
  PingPong: PingPong图,
  阿里云,
  MiniMax: MiniMax图,
  阶跃星辰,
  老虎国际,
  PingCAP: PingCAP图,
};
