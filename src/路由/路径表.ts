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
  基本信息: '/basic',
  工作经历: '/experience',
  /** 引导问答（向导）偏好段：硬性排除 + 个人优势，答完进披露说明。
   *  学生只进这一次，社招是补完档案后的第二次 */
  引导问答: '/wizard',
  /** 引导问答薪资段：社招第一次进向导，只问期望薪资，答完去 基本信息 补档案。
   *  段必须写在地址上 —— 同一个屏在社招合同里出现两次，地址一样它就分不清自己是第几次，
   *  只能靠「薪资答没答」反推，而那个推断在用户答完薪资的瞬间就翻面（见 onboarding配置.向导题序）*/
  引导问答薪资段: '/wizard?stage=salary',
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
  /** 添加头像：注册流最后一屏，选完进初始化页 */
  添加头像: '/onboard/avatar',
  /** 初始化页：注册流收尾后的一次性加载页（建档/记红线/扫市场/备匹配），播完替换进主壳 */
  初始化: '/init',

  主壳: '/app',

  // 路由参数名必须 ASCII：react-router 的参数正则是 :[\w-]+，中文参数名会被
  // 当成字面量路径段，整条路由匹配不上。常量名保持中文，参数 slug 用 id。
  在谈详情: (编号: string) => `/deal/${编号}`,
  在谈详情模板: '/deal/:id',
  /** 真人会话顶部「看职位」的落点：同一个在谈详情，直接开在「职位详情」Tab。
   *  Tab 名走 ASCII slug（job），与本文件「URL 对外用 ASCII」的既有约定一致 */
  在谈详情看职位: (编号: string) => `/deal/${编号}?tab=job`,
  往来记录: (编号: string) => `/thread/${编号}`,
  往来记录模板: '/thread/:id',
  问AI代理: '/agent',
  代理详情: '/agent/me',
  职位详情: (编号: string) => `/job/${编号}`,
  职位详情模板: '/job/:id',
  /** 无参直聊：消息 Tab 的直聊会话行走这条，落到看市场第一个岗的对接人 */
  直聊会话: '/chat/direct',
  /** 带岗位编号的直聊：职位详情的「直接聊」走这条，对方 = 这个岗的发布人 */
  直聊会话岗位: (编号: string) => `/chat/direct/${编号}`,
  直聊会话岗位模板: '/chat/direct/:id',
  真人会话: '/chat/human',
  求职意向管理: '/intentions',
  添加意向: '/intentions/new',
  /** 「添加求职期望」次级页 A：其他感兴趣城市多选（0/9），写 意向草稿.感兴趣城市们 */
  选择城市: '/intentions/cities',
  /** 「添加求职期望」次级页 B：期望行业多选（0/3），写 意向草稿.期望行业们 */
  选期望行业: '/intentions/industries',
  /** 编辑已有意向：同一个「添加意向」屏的编辑态 */
  编辑意向: (编号: string) => `/intentions/${编号}`,
  编辑意向模板: '/intentions/:id',
  规则库: '/rules',
  我的简历: '/resume',
  /** 个人信息(账号身份:头像/姓名/联系方式)——「我」页头像行的落点,招聘端镜像是 招聘名片 */
  个人信息: '/profile',
  // 2026-08-22：/rejected（未通过说明）与 /hr/rejected（候选未通过）两屏已删除。
  // 它们全项目零入口、返回即退出 app；招聘端那屏还与 初筛记录 → 初筛对话 讲同一件事。
  // 唯一有价值的「松一档 / 放宽薪资带」洞察已搬进两端代理简报（问AI代理 / 企业问AI代理）。
  // 不要再给这两屏接入口 —— 那是当时明确否掉的方案 B，理由见 docs/design/代理拒绝理由归宿.md。
  企业详情: (键: string) => `/company/${键}`,
  企业详情模板: '/company/:id',

  // ── 「我的」下属功能页 ──
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
  /** 企业组织管理员申请：填写组织事实 + 证明材料提交审核（实名认证摘要页的入口，
   *  不是注册步骤 —— 注册流仍直接进招聘名片，见 onboarding配置 的合同测试） */
  企业组织申请: '/hr/organization-application',
  /** 邀请加入：输入管理员分享的邀请口令加入企业；raw token 只进 POST body，不进 URL/状态 */
  企业邀请加入: '/hr/organization-invitation',
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
  /** 企业初始化页：注册流首次发岗后的一次性加载页；应用内再发岗不走这里 */
  企业初始化: '/hr-init',
  候选详情: (编号: string) => `/hr/candidate/${编号}`,
  候选详情模板: '/hr/candidate/:id',
  /** 企业真人会话顶部「看简历」的落点：同一个候选详情，直接开在「在线简历」Tab。
   *  这一屏的简历正文按 候.真名 是否已揭晓自动切实名/匿名版 —— S1 原件递交后即实名版，
   *  所以不能改跳 /hr/resume/:id（那屏是 S0 匿名发现页，见 匿名在线简历.tsx）*/
  候选详情看简历: (编号: string) => `/hr/candidate/${编号}?tab=resume`,
  企业往来记录: (编号: string) => `/hr/thread/${编号}`,
  企业往来记录模板: '/hr/thread/:id',
  企业问AI代理: '/hr/agent',
  企业真人会话: '/hr/chat',
  岗位管理: '/hr/jobs',
  /** 岗位详情：从岗位管理点一行进来，看这个岗位的全貌（数据 / JD / 公司 / 地址）*/
  岗位详情: (编号: string) => `/hr/job/${编号}`,
  岗位详情模板: '/hr/job/:id',
  企业代理详情: '/hr/agent/me',
  企业代理设置: '/hr/agent-settings',
  匿名在线简历: (编号: string) => `/hr/resume/${编号}`,
  匿名在线简历模板: '/hr/resume/:id',
  企业设置: '/hr/settings',
  企业披露策略: '/hr/disclosure',
  /** 企业历史代谈：被终止的候选归档在这里，镜像求职端的 /archived */
  企业归档: '/hr/archived',
  已筛候选: '/hr/screened-out',
  /** 本周初筛记录：日报卡人才漏斗的「硬性匹配」那一行点进来，看代理这一周怎么筛的 */
  初筛记录: '/hr/screening-log',
  /** 单条初筛对话：结论卡 + 那一场初筛的完整对话。
   *  参数 slug 用 id 而非「编号」，同本文件上方的既有约定 —— react-router 的参数正则
   *  是 :[\w-]+，中文参数名会被当成字面量路径段，整条路由匹配不上 */
  初筛对话: (编号: string) => `/hr/screening-log/${编号}`,
  初筛对话模板: '/hr/screening-log/:id',
} as const;
