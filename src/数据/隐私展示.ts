/** 本人账号页的手机号展示：前三后四，中间四位永不回显。 */
export function 打码手机号(号码: string): string {
  const 纯数字 = 号码.replace(/\s/g, '');
  if (!/^\d{11}$/.test(纯数字)) return 号码;
  return `${纯数字.slice(0, 3)} **** ${纯数字.slice(7)}`;
}

/** 微信号展示：长度足够时仅保留前三后二。 */
export function 打码微信号(号码: string): string {
  if (号码.length < 6) return 号码;
  return `${号码.slice(0, 3)}***${号码.slice(-2)}`;
}
