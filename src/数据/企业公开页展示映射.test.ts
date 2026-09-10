// 企业公开页展示映射 表测：两条合法来源（BFF 公开视图 / Mock 档+自述覆盖）→ 同一份 企业公开页资料。
// 只喂现有合法 fixture：空字符串/空列表/真实 0 都是合法状态而非读取失败；
// 必需身份字段（legal/display/verified_at）原样保留，不用占位掩盖契约错误。

import { describe, expect, it } from 'vitest';
import { 从BFF公开企业 } from './组织映射';
import { 取公司档案 } from './公司档案';
import { BFF公开企业样本, BFF企业档案样本 } from '../测试/BFF样本';
import type { BFF公开企业 } from './BFF契约';
import { 从公开企业到展示, 从模拟企业到展示 } from './企业公开页展示映射';

describe('从公开企业到展示 · BFF 公开视图', () => {
  it('完整视图：身份/规模行/各分区/页脚逐字段投影', () => {
    const d = 从公开企业到展示(从BFF公开企业(BFF公开企业样本));
    expect(d.名称).toBe('云衢科技');
    expect(d.图片).toBe('https://cdn.example.com/org_1/media_1.png');
    expect(d.规模行).toBe('C 轮 · 500-1000 人 · 金融科技');
    expect(d.简介).toEqual(['做可靠的技术产品']);
    expect(d.业务).toEqual(['智能招聘平台']);
    expect(d.相册).toEqual(['https://cdn.example.com/org_1/media_1.png']);
    expect(d.产品).toBe('AI 简历助手');
    expect(d.团队).toEqual([{ 姓名: '林澈', 职务: '招聘负责人', 简介: '负责招聘' }]);
    expect(d.作息).toBe('双休');
    expect(d.地址).toBe('上海市张江路 1 号');
    expect(d.页脚).toBe('公开信息由企业主页提供 · 企业身份经平台核验');
  });

  it('公开契约没有的分区一律 null，福利标签不带已核标记', () => {
    const d = 从公开企业到展示(从BFF公开企业(BFF公开企业样本));
    expect(d.文化).toBeNull();
    expect(d.历程).toBeNull();
    expect(d.地址补充).toBeNull();
    expect(d.反馈).toBeNull();
    expect(d.工商).toBeNull();
    expect(d.工商来源说明).toBeNull();
    expect(d.代理核对已知).toBe(false);
    expect(d.条款).toEqual([
      { 名称: '五险一金', 说明: null, 已核: false },
      { 名称: '股票期权', 说明: null, 已核: false },
    ]);
    expect(d.身份).toEqual({
      法定名称: '上海云衢科技有限公司',
      展示名称: '云衢科技',
      核验时间: '2026-08-24',
      已核验: true,
      岗位数: 2,
      岗位数已核验: true,
    });
  });

  it('空简介与真实 0：简介转未知，岗位数保留 0，福利仍是无核验的自述标签', () => {
    const 完整公开视图 = 从BFF公开企业(BFF公开企业样本);
    const d = 从公开企业到展示({ ...完整公开视图, companyIntro: '', activeVerifiedJobCount: 0 });
    expect(d.简介).toBeNull();
    expect(d.身份.岗位数).toBe(0);
    expect(d.代理核对已知).toBe(false);
    expect(d.条款?.every((x) => !x.已核 && x.说明 === null)).toBe(true);
  });

  it('合法空档案：空值逐字段转未知，但不产生失败态，0 与身份事实保留', () => {
    // 全空 profile 是合法 DTO（closed 枚举含 ''，列表允许空），不是请求失败
    const 空DTO: BFF公开企业 = {
      ...BFF公开企业样本,
      active_verified_job_count: 0,
      profile: {
        ...BFF企业档案样本,
        industry: null,
        company_size: '',
        funding_stage: '',
        office_address: '  ',
        benefit_codes: [],
        work_schedule: '',
        company_intro: '',
        business_items: [],
        product_intro: ' ',
        team_members: [{ name: '  ', title: '', summary: '' }],
        logo: null,
        office_media: [],
        company_media: [],
      },
    };
    const d = 从公开企业到展示(从BFF公开企业(空DTO));
    expect(d.图片).toBeNull();
    expect(d.规模行).toBe('融资阶段未知 · 公司规模未知 · 行业未知');
    expect(d.简介).toBeNull();
    expect(d.业务).toBeNull();
    expect(d.相册).toBeNull();
    expect(d.产品).toBeNull();
    expect(d.团队).toEqual([{ 姓名: null, 职务: null, 简介: null }]);
    expect(d.作息).toBeNull();
    expect(d.条款).toBeNull();
    expect(d.地址).toBeNull();
    expect(d.身份.岗位数).toBe(0);
    expect(d.身份.法定名称).toBe('上海云衢科技有限公司');
    expect(d.身份.核验时间).toBe('2026-08-24');
  });
});

describe('从模拟企业到展示 · Mock 档（外层已叠加自述覆盖）', () => {
  it('静态档：保留原整行规模行、已核标记与工商条目，身份不猜法定名', () => {
    const d = 从模拟企业到展示(取公司档案('yunqu'));
    expect(d.名称).toBe('云衢科技');
    expect(d.图片).toBeNull();
    expect(d.规模行).toBe('C 轮 · 500-1000 人 · 金融科技');
    expect(d.简介?.length).toBe(3);
    expect(d.文化).toContain('把复杂留给系统');
    expect(d.历程?.[0]).toEqual({ 年份: '2018', 事件: '成立，首个客户是一家中型券商的柜台改造' });
    expect(d.业务).toEqual(['交易中台', '清结算系统', '风控引擎']);
    expect(d.作息).toContain('双休');
    expect(d.代理核对已知).toBe(true);
    expect(d.条款?.some((x) => x.已核)).toBe(true);
    expect(d.条款?.every((x) => x.说明 !== null)).toBe(true);
    expect(d.反馈?.map((x) => x.标签)).toEqual(['技术氛围好', '流程规范', '晋升看产出', '金融客户节奏紧']);
    expect(d.工商?.[0]).toEqual({ 项: '公司全称', 值: '上海云衢信息科技有限公司' });
    expect(d.工商来源说明).toBe('已核验');
    expect(d.身份).toEqual({
      法定名称: null,
      展示名称: '云衢科技',
      核验时间: null,
      已核验: false,
      岗位数: 46,
      岗位数已核验: false,
    });
    expect(d.页脚).toBe('公司自述由企业提供 · 工商信息经第三方核验 · 如有不实可举报');
  });

  it('静态档没有的分区是 null：相册/产品/团队留给自述覆盖', () => {
    const d = 从模拟企业到展示(取公司档案('yunqu'));
    expect(d.相册).toBeNull();
    expect(d.产品).toBeNull();
    expect(d.团队).toBeNull();
  });

  it('覆盖叠加：两组照片合并，产品/团队读覆盖，成员空白子字段转 null', () => {
    const d = 从模拟企业到展示({
      ...取公司档案('yunqu'),
      公司相册: { 实景照片: ['data:实景1'], 公司照片: ['data:公司1', 'data:公司2'] },
      产品介绍: '  交易网关多活  ',
      团队介绍: [
        { 姓名: '林一', 职务: '', 简介: '负责网关' },
        { 姓名: '  ', 职务: '架构师', 简介: ' ' },
      ],
    });
    expect(d.相册).toEqual(['data:实景1', 'data:公司1', 'data:公司2']);
    expect(d.产品).toBe('交易网关多活');
    expect(d.团队).toEqual([
      { 姓名: '林一', 职务: null, 简介: '负责网关' },
      { 姓名: null, 职务: '架构师', 简介: null },
    ]);
  });

  it('全空 Mock 档：各分区 null，真实 0 岗位数保留，代理核对仍视为已知', () => {
    const d = 从模拟企业到展示({
      ...取公司档案('yunqu'),
      简介: [],
      企业文化: ' ',
      发展历程: [],
      主营业务: [],
      福利: [],
      在职感受: [],
      工商信息: [],
      作息: '  ',
      地址: '',
      地址补充: '',
      在招岗位数: 0,
    });
    expect(d.简介).toBeNull();
    expect(d.文化).toBeNull();
    expect(d.历程).toBeNull();
    expect(d.业务).toBeNull();
    expect(d.相册).toBeNull();
    expect(d.产品).toBeNull();
    expect(d.团队).toBeNull();
    expect(d.作息).toBeNull();
    expect(d.条款).toBeNull();
    expect(d.反馈).toBeNull();
    expect(d.工商).toBeNull();
    expect(d.地址).toBeNull();
    expect(d.地址补充).toBeNull();
    expect(d.身份.岗位数).toBe(0);
    expect(d.代理核对已知).toBe(true);
  });
});
