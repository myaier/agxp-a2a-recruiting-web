// 路由表。URL 用 ASCII slug（URL 是对外的地址，不走中文命名），
// 但常量名保持中文，屏幕代码里读起来仍然是业务语义。

export const 路径 = {
  登录: '/',
  选身份: '/identity',
  /** 老用户切换身份：带 switch=1 与来源端，选完直接进对应主壳，不重走注册引导。
   *  来源用于默认选中「对面」身份 —— 从求职端进来默认挑招聘方，反之亦然 */
  切换身份自求职端: '/identity?switch=1&from=app',
  切换身份自企业端: '/identity?switch=1&from=hr',
  /** 学生分流：选完「求职者」先问在不在读，答案落 基本信息.身份，后续屏按它分支 */
  学生分流: '/student',
  引导说明: '/intro',
  基本信息: '/basic',
  工作经历: '/experience',
  引导问答: '/wizard',
  披露说明: '/disclosure',

  // ── 注册引导补屏（2026-08-20 按 BOSS 截图顺序重排）：/onboard 前缀 ──
  /** 完善资料里的城市行点进来：全屏多选（上限 10），替代旧底部弹层 */
  选工作城市: '/onboard/city',
  /** 完善资料里的职位行点进来：全屏多选（上限 10），替代旧底部弹层 */
  选期望职位: '/onboard/job',
  /** 求职状态 2×2 方块单选（原引导问答的到岗题挪来这里）*/
  求职状态: '/onboard/status',
  最高学历: '/onboard/degree',
  /** 你毕业于：搜索 + 常见高校候选 */
  毕业院校: '/onboard/school',
  /** 你的专业是 */
  选专业: '/onboard/major',
  /** 就读时间段：入学年 / 毕业年双滚轮 */
  就读时间段: '/onboard/eduyears',
  /** 添加头像：注册流最后一屏，选完进主壳 */
  添加头像: '/onboard/avatar',

  主壳: '/app',

  // 路由参数名必须 ASCII：react-router 的参数正则是 :[\w-]+，中文参数名会被
  // 当成字面量路径段，整条路由匹配不上。常量名保持中文，参数 slug 用 id。
  在谈详情: (编号: string) => `/deal/${编号}`,
  在谈详情模板: '/deal/:id',
  往来记录: (编号: string) => `/thread/${编号}`,
  往来记录模板: '/thread/:id',
  问AI代理: '/agent',
  代理详情: '/agent/me',
  职位详情: (编号: string) => `/job/${编号}`,
  职位详情模板: '/job/:id',
  直聊会话: '/chat/direct',
  真人会话: '/chat/human',
  求职意向管理: '/intentions',
  添加意向: '/intentions/new',
  /** 编辑已有意向：同一个「添加意向」屏的编辑态 */
  编辑意向: (编号: string) => `/intentions/${编号}`,
  编辑意向模板: '/intentions/:id',
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
  /** 公司主页资料的单个分区编辑页。段用 ASCII slug（basic / welfare / intro /
   *  business / album / product / team），中文分区名在 数据/公司主页资料.ts 的分区表里 */
  公司档案分区: (段: string) => `/hr/company-profile/${段}`,
  公司档案分区模板: '/hr/company-profile/:area',
  企业主壳: '/hr',
  候选详情: (编号: string) => `/hr/candidate/${编号}`,
  候选详情模板: '/hr/candidate/:id',
  企业往来记录: (编号: string) => `/hr/thread/${编号}`,
  企业往来记录模板: '/hr/thread/:id',
  候选未通过: '/hr/rejected',
  企业问AI代理: '/hr/agent',
  企业真人会话: '/hr/chat',
  岗位管理: '/hr/jobs',
  /** 岗位详情：从岗位管理点一行进来，看这个岗位的全貌（数据 / JD / 公司 / 地址）*/
  岗位详情: (编号: string) => `/hr/job/${编号}`,
  岗位详情模板: '/hr/job/:id',
  企业代理设置: '/hr/agent-settings',
  匿名在线简历: (编号: string) => `/hr/resume/${编号}`,
  匿名在线简历模板: '/hr/resume/:id',
  企业通知中心: '/hr/notifications',
  企业设置: '/hr/settings',
  企业披露策略: '/hr/disclosure',
  已筛候选: '/hr/screened-out',
} as const;
