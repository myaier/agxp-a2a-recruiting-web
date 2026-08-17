// 统一的导航入口。所有屏幕只用这个钩子跳转和返回，不各自调 useNavigate，
// 这样「进主壳要清栈」之类的规则只需在一处维护。

import { useNavigate } from 'react-router-dom';
import { 路径 } from './路径表';

export function use导航() {
  const 前往 = useNavigate();

  return {
    /** 普通前进 */
    跳转: (目标: string) => 前往(目标),
    /** 返回上一屏 */
    返回: () => 前往(-1),
    /** 进主壳：replace 掉引导流程，避免后退键退回注册页 */
    进主壳: () => 前往(路径.主壳, { replace: true }),
  };
}
