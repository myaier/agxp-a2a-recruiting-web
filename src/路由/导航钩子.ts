// 统一的导航入口。所有屏幕只用这个钩子跳转和返回，不各自调 useNavigate，
// 这样「进主壳要清栈」之类的规则只需在一处维护。

import { useNavigate } from 'react-router-dom';
import { 路径 } from './路径表';

export function use导航() {
  const 前往 = useNavigate();

  /**
   * 注册流走完进主壳：把注册期间压进 history 的格子全部弹掉，落点换成主壳。
   *
   * 原来这里只是 前往(目标, { replace: true })，注释写的是「replace 掉引导流程」，
   * 但 replace 只换掉**当前这一格**（添加头像 / 发布岗位那一格），前面的
   * 登录 / 选身份 / 完善资料 / 向导 / 披露说明 整条栈都还在 —— 实测在主壳按后退键
   * 会落回 #/disclosure。注释描述的意图和实现根本不是一回事。
   *
   * 做法：先退回本次会话的第一格，等 popstate 落定再把那一格 replace 成主壳。
   * 格号取自 react-router 自己写在 history.state 上的 idx（v6 / v7 一致）。
   */
  const 清栈进 = (目标: string) => {
    const 当前格 = (window.history.state as { idx?: number } | null)?.idx;
    // 已经在第一格（直接深链进来的用户）就没有可弹的历史，replace 即可；
    // 拿不到格号（history.state 被外部改写过）时也只能退化成 replace ——
    // 这时后退键仍可能退回注册页，属于已知降级，不是被吞掉的错误
    if (typeof 当前格 !== 'number' || 当前格 <= 0) {
      前往(目标, { replace: true });
      return;
    }
    // history.go 是异步的：必须等 popstate 落定后再 replace，
    // 否则 replace 写完会被随后到达的 popstate 覆盖掉
    window.addEventListener('popstate', () => 前往(目标, { replace: true }), { once: true });
    window.history.go(-当前格);
  };

  return {
    /** 普通前进 */
    跳转: (目标: string) => 前往(目标),
    /** 返回上一屏 */
    返回: () => 前往(-1),
    /** 进主壳：清掉整条注册流历史，后退键退不回注册页 */
    进主壳: () => 清栈进(路径.主壳),
    /** 原地替换：当前屏「变成」目标屏（如 委托入谈 后职位详情变在谈详情），
        后退不会回到被替换的旧屏。只换一格，这里就是想只换一格 */
    替换跳转: (目标: string) => 前往(目标, { replace: true }),
    /** 企业端对称版：发岗完成后进企业主壳，同样清掉注册流程历史 */
    进企业主壳: () => 清栈进(路径.企业主壳),
  };
}
