// 装饰性二维码（原型不接真实生成库）：定位角 + 确定性点阵。
// 代理详情与注册尾的「接入飞书」页共用一份，避免两处各画一个。

export default function 接入二维码({ 边长 = 150 }: { 边长?: number }) {
  // 固定种子的伪随机点阵：每次渲染一致，避免闪烁
  const 点 = [];
  for (let 行 = 0; 行 < 21; 行 += 1) {
    for (let 列 = 0; 列 < 21; 列 += 1) {
      const 是定位角 =
        (行 < 7 && 列 < 7) || (行 < 7 && 列 > 13) || (行 > 13 && 列 < 7);
      if (是定位角) continue;
      // 用行列做确定性哈希，看起来像码又不需要真算法
      if (((行 * 7 + 列 * 13 + ((行 * 列) % 5)) % 3) === 0) {
        点.push(<rect key={`${行}-${列}`} x={列 * 5} y={行 * 5} width="5" height="5" fill="var(--墨)" />);
      }
    }
  }
  const 定位角 = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width="35" height="35" fill="var(--墨)" />
      <rect x={x + 5} y={y + 5} width="25" height="25" fill="#fff" />
      <rect x={x + 10} y={y + 10} width="15" height="15" fill="var(--墨)" />
    </g>
  );
  return (
    <svg width={边长} height={边长} viewBox="0 0 105 105" aria-label="接入二维码" role="img">
      <rect width="105" height="105" fill="#fff" />
      {点}
      {定位角(0, 0)}
      {定位角(70, 0)}
      {定位角(0, 70)}
    </svg>
  );
}
