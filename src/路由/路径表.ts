// 路由表。URL 用 ASCII slug（URL 是对外的地址，不走中文命名），
// 但常量名保持中文，屏幕代码里读起来仍然是业务语义。

export const 路径 = {
  登录: '/',
  选身份: '/identity',
  引导说明: '/intro',
  工作经历: '/experience',
  引导问答: '/wizard',
  披露说明: '/disclosure',

  主壳: '/app',

  // 路由参数名必须 ASCII：react-router 的参数正则是 :[\w-]+，中文参数名会被
  // 当成字面量路径段，整条路由匹配不上。常量名保持中文，参数 slug 用 id。
  在谈详情: (编号: string) => `/deal/${编号}`,
  在谈详情模板: '/deal/:id',
  往来记录: (编号: string) => `/thread/${编号}`,
  往来记录模板: '/thread/:id',
  问AI代理: '/agent',
  职位详情: (编号: string) => `/job/${编号}`,
  职位详情模板: '/job/:id',
  直聊会话: '/chat/direct',
  真人会话: '/chat/human',
  求职意向管理: '/intentions',
  添加意向: '/intentions/new',
  规则库: '/rules',
  我的简历: '/resume',
  未通过说明: '/rejected',
} as const;
