import { 客户端校验错误 } from './HTTP客户端';

export function 规范化登录区号(raw: string): string {
  const trimmed = raw.trim();
  const digits = trimmed.startsWith('+') ? trimmed.slice(1) : trimmed;
  if (!/^[1-9][0-9]{0,2}$/.test(digits)) {
    throw new 客户端校验错误('dialCode', '区号必须是 1 到 3 位数字且首位不能为 0');
  }
  return `+${digits}`;
}

export function 构造登录手机号(phone: string, dialCode = '+86'): string {
  const normalizedDialCode = 规范化登录区号(dialCode);
  const digits = phone.replace(/[ ()-]/g, '');
  if (!digits || !/^\d+$/.test(digits)) {
    throw new 客户端校验错误('phone', '请输入有效的手机号');
  }
  if (normalizedDialCode === '+86') {
    if (digits.length !== 11) {
      throw new 客户端校验错误('phone', '请输入 11 位手机号');
    }
  } else if (normalizedDialCode.length - 1 + digits.length < 8 || normalizedDialCode.length - 1 + digits.length > 15) {
    throw new 客户端校验错误('phone', '区号与手机号拼接后必须为 8 到 15 位数字');
  }
  return `${normalizedDialCode}${digits}`;
}
