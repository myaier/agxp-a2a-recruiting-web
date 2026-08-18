// 路由表。URL 用 ASCII slug（URL 是对外的地址，不走中文命名），
// 但常量名保持中文，屏幕代码里读起来仍然是业务语义。

export const 路径 = {
  登录: '/',
  选身份: '/identity',
  /** 老用户切换身份：带 switch=1 与来源端，选完直接进对应主壳，不重走注册引导。
   *  来源用于默认选中「对面」身份 —— 从求职端进来默认挑招聘方，反之亦然 */
  切换身份自求职端: '/identity?switch=1&from=app',
  切换身份自企业端: '/identity?switch=1&from=hr',
  引导说明: '/intro',
  基本信息: '/basic',
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
  企业详情: (键: string) => `/company/${键}`,
  企业详情模板: '/company/:id',

  // ── 「我的」下属功能页 ──
  通知中心: '/notifications',
  设置: '/settings',
  屏蔽名单: '/blocklist',
  披露偏好: '/disclosure-prefs',
  归档谈判: '/archived',
  帮助与客服: '/help',
  // ── 两端共用的外围页（求职端与企业端设置里都能进）──
  账号安全: '/account',
  反馈: '/feedback',
  用户协议: '/terms',
  接触记录: '/visitors',

  // ── 企业端（招人方）。前缀 /hr，参数名同样必须 ASCII ──
  企业实名认证: '/hr/verify',
  招聘名片: '/hr/card',
  发布岗位: '/hr/post-job',
  /** 编辑已发布的岗位：同一个「发布岗位」屏的编辑态，带岗位编号 */
  编辑岗位: (编号: string) => `/hr/post-job/${编号}`,
  编辑岗位模板: '/hr/post-job/:id',
  公司档案编辑: '/hr/company-profile',
  企业主壳: '/hr',
  候选详情: (编号: string) => `/hr/candidate/${编号}`,
  候选详情模板: '/hr/candidate/:id',
  企业往来记录: (编号: string) => `/hr/thread/${编号}`,
  企业往来记录模板: '/hr/thread/:id',
  候选未通过: '/hr/rejected',
  企业问AI代理: '/hr/agent',
  企业真人会话: '/hr/chat',
  岗位管理: '/hr/jobs',
  企业代理设置: '/hr/agent-settings',
  匿名在线简历: (编号: string) => `/hr/resume/${编号}`,
  匿名在线简历模板: '/hr/resume/:id',
  企业通知中心: '/hr/notifications',
  企业设置: '/hr/settings',
  企业披露策略: '/hr/disclosure',
  已筛候选: '/hr/screened-out',
} as const;
