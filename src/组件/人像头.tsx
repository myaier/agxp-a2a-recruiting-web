// 候选人头像（2026-08-19 标注 13:43：改用真人 mock 照片）。
// 照片来自 randomuser.me 免费人像库，构建期打包进产物；
// 按候选编号散列稳定取图 —— 同一个人每次都是同一张脸。

import 男1 from '../资源/人像/男1.jpg';
import 男2 from '../资源/人像/男2.jpg';
import 男3 from '../资源/人像/男3.jpg';
import 男4 from '../资源/人像/男4.jpg';
import 男5 from '../资源/人像/男5.jpg';
import 女1 from '../资源/人像/女1.jpg';
import 女2 from '../资源/人像/女2.jpg';
import 女3 from '../资源/人像/女3.jpg';
import 女4 from '../资源/人像/女4.jpg';
import 女5 from '../资源/人像/女5.jpg';

const 照片池 = [男1, 女1, 男2, 女2, 男3, 女3, 男4, 女4, 男5, 女5];

/** 把编号打散成稳定正整数：同一个键永远同一张脸 */
function 散列(键: string): number {
  let 值 = 0;
  for (let i = 0; i < 键.length; i += 1) 值 = (值 * 31 + 键.charCodeAt(i)) >>> 0;
  return 值;
}

export default function 人像头({
  键,
  尺寸 = 34,
}: {
  /** 稳定标识（用候选编号） */
  键: string;
  /** 兼容旧调用；照片模式下不再使用 */
  首字?: string;
  尺寸?: number;
}) {
  const 图 = 照片池[散列(键) % 照片池.length];
  return (
    <img
      src={图}
      alt=""
      width={尺寸}
      height={尺寸}
      style={{ flex: 'none', borderRadius: '50%', objectFit: 'cover', display: 'block' }}
    />
  );
}
