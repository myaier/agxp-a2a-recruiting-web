// 组织域数据源测试：冻结每个 browser call 的 method/path/If-Match/幂等/body 形状，
// 并锁定 strict decode（exact key set、闭合 enum、wrapper 解包、缺键归一、multipart 形状）。

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type BFF请求选项, type BFF响应 } from '../HTTP客户端';
import type { BFF企业管理员申请元数据, BFF企业档案替换 } from '../BFF契约';
import {
  BFF企业关系样本,
  BFF企业媒体样本,
  BFF企业档案样本,
  BFF企业管理员申请样本,
  BFF公开企业样本,
  BFF招聘方档案样本,
} from '../../测试/BFF样本';
import { 创建组织数据源 } from './组织';

type 请求函数 = <T>(options: BFF请求选项) => Promise<BFF响应<T>>;

describe('组织数据源', () => {
  const 请求Mock = vi.fn();
  const 请求 = 请求Mock as unknown as 请求函数;
  const 数据源 = 创建组织数据源(请求);
  beforeEach(() => {
    请求Mock.mockReset();
  });

  it('读取招聘方档案 GET /recruiter/profile 并 strict decode', async () => {
    请求Mock.mockResolvedValueOnce({ result: BFF招聘方档案样本, etag: '"1"', requestId: 'r1' });
    await expect(数据源.读取招聘方档案()).resolves.toEqual(BFF招聘方档案样本);
    expect(请求Mock.mock.calls[0][0]).toMatchObject({ path: '/api/v1/recruiter/profile' });
  });

  it('保存招聘方档案 PATCH 带 If-Match 与 sparse JSON patch', async () => {
    请求Mock.mockResolvedValueOnce({
      result: { ...BFF招聘方档案样本, title: 'HR 负责人', revision: 2 },
      etag: '"2"', requestId: 'r2',
    });
    await expect(数据源.保存招聘方档案({ title: 'HR 负责人' }, 1)).resolves.toMatchObject({
      title: 'HR 负责人', revision: 2,
    });
    expect(请求Mock.mock.calls[0][0]).toEqual({
      path: '/api/v1/recruiter/profile', method: 'PATCH', body: { title: 'HR 负责人' }, ifMatch: '"1"',
    });
  });

  // P0 修复 Task 2：全新招聘方还没有档案时的首写 —— revision 0 是合法值，
  // 不能被真值判断吞掉：仍走同一条 PATCH + If-Match 路径，不另开 POST。
  it('显式 revision 0 仍使用 PATCH 和 If-Match 0', async () => {
    请求Mock.mockResolvedValueOnce({
      result: {
        public_name: '林澈', title: '招聘负责人', personal_verification_status: 'unverified',
        organization_ref: null, revision: 1,
      },
      etag: '"1"', requestId: 'r0',
    });
    await expect(数据源.保存招聘方档案({ public_name: '林澈', title: '招聘负责人' }, 0))
      .resolves.toMatchObject({ public_name: '林澈', revision: 1 });
    expect(请求Mock.mock.calls[0][0]).toEqual({
      path: '/api/v1/recruiter/profile',
      method: 'PATCH',
      body: { public_name: '林澈', title: '招聘负责人' },
      ifMatch: '"0"',
    });
  });

  it('读取我的企业关系 解包 {affiliations:[...]} 返回数组', async () => {
    请求Mock.mockResolvedValueOnce({ result: { affiliations: [BFF企业关系样本] } });
    await expect(数据源.读取我的企业关系()).resolves.toEqual([BFF企业关系样本]);
    expect(请求Mock.mock.calls[0][0]).toMatchObject({ path: '/api/v1/recruiter/affiliations' });
  });

  it('读取企业管理员申请 解包 {requests:[...]} 返回数组', async () => {
    请求Mock.mockResolvedValueOnce({ result: { requests: [BFF企业管理员申请样本] } });
    await expect(数据源.读取企业管理员申请()).resolves.toEqual([BFF企业管理员申请样本]);
    expect(请求Mock.mock.calls[0][0]).toMatchObject({ path: '/api/v1/recruiter/organization-admin-requests' });
  });

  it('创建企业管理员申请 metadata Blob + 重复 evidence part，带幂等', async () => {
    请求Mock.mockResolvedValueOnce({ result: BFF企业管理员申请样本, etag: null, requestId: 'r1' });
    const 元数据: BFF企业管理员申请元数据 = {
      organization_id: 'org_1',
      legal_name: '上海云衢科技有限公司',
      registry_key: '',
      explanation: '我是这家公司的管理员',
      domains: ['yunqu.example'],
    };
    const 证据 = [
      new File(['a'], 'a.png', { type: 'image/png' }),
      new File(['b'], 'b.jpg', { type: 'image/jpeg' }),
    ];
    await expect(数据源.创建企业管理员申请(元数据, 证据)).resolves.toEqual(BFF企业管理员申请样本);
    const options = 请求Mock.mock.calls[0][0] as BFF请求选项;
    expect(options).toMatchObject({
      path: '/api/v1/recruiter/organization-admin-requests', method: 'POST', 幂等: true,
    });
    expect(options.formData).toBeInstanceOf(FormData);
    expect([...options.formData!.keys()]).toEqual(['metadata', 'evidence', 'evidence']);
    const metadata = options.formData!.get('metadata') as Blob;
    expect(metadata.type).toBe('application/json');
    await expect(metadata.text()).resolves.toBe(JSON.stringify(元数据));
    expect(options.formData!.getAll('evidence')).toEqual(证据);
  });

  it('取消企业管理员申请 POST cancel 带 If-Match 空 body，返回申请结果', async () => {
    请求Mock.mockResolvedValueOnce({
      result: { ...BFF企业管理员申请样本, status: 'cancelled', revision: 2 },
      etag: '"2"', requestId: 'r2',
    });
    await expect(数据源.取消企业管理员申请('req_1', 1)).resolves.toMatchObject({
      status: 'cancelled', revision: 2,
    });
    expect(请求Mock.mock.calls[0][0]).toEqual({
      path: '/api/v1/recruiter/organization-admin-requests/req_1/cancel', method: 'POST', ifMatch: '"1"',
    });
  });

  it('接受企业邀请 body 只有 {token}', async () => {
    请求Mock.mockResolvedValueOnce({ result: BFF企业关系样本, etag: null, requestId: 'r1' });
    await expect(数据源.接受企业邀请('tok_1')).resolves.toEqual(BFF企业关系样本);
    expect(请求Mock.mock.calls[0][0]).toEqual({
      path: '/api/v1/recruiter/organization-invitations/accept', method: 'POST', body: { token: 'tok_1' },
    });
  });

  it('替换招聘方头像 单 media part 同时带 If-Match 与幂等', async () => {
    请求Mock.mockResolvedValueOnce({
      result: { ...BFF招聘方档案样本, avatar_url: 'https://cdn.example/a.png', revision: 2 },
      etag: '"2"', requestId: 'r2',
    });
    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
    await expect(数据源.替换招聘方头像(file, 1)).resolves.toMatchObject({
      avatar_url: 'https://cdn.example/a.png', revision: 2,
    });
    const options = 请求Mock.mock.calls[0][0] as BFF请求选项;
    expect(options.path).toBe('/api/v1/recruiter/avatar');
    expect(options.method).toBe('POST');
    expect(options.ifMatch).toBe('"1"');
    expect(options.幂等).toBe(true);
    expect([...options.formData!.keys()]).toEqual(['media']);
    expect(options.formData!.get('media')).toBe(file);
  });

  it('读取企业档案 GET /organizations/:id/profile', async () => {
    请求Mock.mockResolvedValueOnce({ result: BFF企业档案样本, etag: '"3"', requestId: 'r1' });
    await expect(数据源.读取企业档案('org_1')).resolves.toEqual(BFF企业档案样本);
    expect(请求Mock.mock.calls[0][0]).toMatchObject({ path: '/api/v1/organizations/org_1/profile' });
  });

  it('替换企业档案 PATCH full JSON replacement 带 If-Match（不是 PUT）', async () => {
    const body: BFF企业档案替换 = {
      display_name: '云衢科技',
      brand_name: '云衢科技',
      industry_id: 'tax_fintech',
      company_size: '500_1000',
      funding_stage: 'series_c',
      office_address: '上海市张江路 1 号',
      benefit_codes: ['stock_options'],
      work_schedule: 'two_day_weekend',
      company_intro: '做可靠的技术产品',
      business_items: ['智能招聘平台'],
      office_media_ids: ['media_1'],
      company_media_ids: [],
      product_intro: 'AI 简历助手',
      team_members: [{ name: '林澈', title: '招聘负责人', summary: '负责招聘' }],
      logo_media_id: 'media_1',
    };
    请求Mock.mockResolvedValueOnce({ result: BFF企业档案样本, etag: '"4"', requestId: 'r2' });
    await expect(数据源.替换企业档案('org_1', body, 3)).resolves.toEqual(BFF企业档案样本);
    expect(请求Mock.mock.calls[0][0]).toEqual({
      path: '/api/v1/organizations/org_1/profile', method: 'PATCH', body, ifMatch: '"3"',
    });
  });

  // ── Spec §2（2026-09-14）：profile.display_name 是企业常用名（目录/公开企业同源）──
  // 读侧合同必返；缺键即契约漂移 fail closed，不缺省成品牌名或空串。

  it('企业档案闭合对象接受 display_name（新合法闭合 profile）', async () => {
    请求Mock.mockResolvedValueOnce({
      result: { ...BFF企业档案样本, display_name: '云衢常用名' },
      etag: '"3"', requestId: 'r3',
    });
    await expect(数据源.读取企业档案('org_1')).resolves.toMatchObject({ display_name: '云衢常用名' });
  });

  it('企业档案缺 display_name 抛 invalid_response，不回落旧闭合键集', async () => {
    const { display_name: _缺常用名, ...缺键档案 } = { ...BFF企业档案样本, display_name: '云衢科技' };
    请求Mock.mockResolvedValueOnce({ result: 缺键档案 });
    await expect(数据源.读取企业档案('org_1')).rejects.toMatchObject({
      status: 200, code: 'invalid_response',
    });
  });

  it('上传企业媒体 multipart 恰好 metadata(application/json) + media，带幂等', async () => {
    请求Mock.mockResolvedValueOnce({ result: BFF企业媒体样本, etag: null, requestId: 'r1' });
    const file = new File(['photo'], 'office.png', { type: 'image/png' });
    await expect(数据源.上传企业媒体('org_1', 'office_photo', file)).resolves.toEqual(BFF企业媒体样本);
    const options = 请求Mock.mock.calls.at(-1)![0] as BFF请求选项;
    expect(options).toMatchObject({
      path: '/api/v1/organizations/org_1/media', method: 'POST', 幂等: true,
    });
    expect([...options.formData!.keys()]).toEqual(['metadata', 'media']);
    const metadata = options.formData!.get('metadata') as Blob;
    expect(metadata.type).toBe('application/json');
    await expect(metadata.text()).resolves.toBe('{"purpose":"office_photo"}');
    expect(options.formData!.get('media')).toBe(file);
  });

  it('删除企业媒体 DELETE 接受 void 结果', async () => {
    请求Mock.mockResolvedValueOnce({ result: undefined, etag: null, requestId: 'r9' });
    await expect(数据源.删除企业媒体('org_1', 'media_1')).resolves.toBeUndefined();
    expect(请求Mock.mock.calls[0][0]).toEqual({
      path: '/api/v1/organizations/org_1/media/media_1', method: 'DELETE',
    });
  });

  it('读取公开企业 GET /organizations/:id', async () => {
    请求Mock.mockResolvedValueOnce({ result: BFF公开企业样本, etag: null, requestId: 'r1' });
    await expect(数据源.读取公开企业('org_1')).resolves.toEqual(BFF公开企业样本);
    expect(请求Mock.mock.calls[0][0]).toMatchObject({ path: '/api/v1/organizations/org_1' });
  });

  it('招聘方档案缺 verified_name/avatar_url 时归一为 null', async () => {
    请求Mock.mockResolvedValueOnce({ result: {
      public_name: '林澈', title: '', personal_verification_status: 'unverified',
      organization_ref: null, revision: 1,
    } });
    await expect(数据源.读取招聘方档案()).resolves.toMatchObject({
      verified_name: null, avatar_url: null,
    });
  });

  it('DTO 多出 subject_id/registry_key/object_key/未知字段时抛 invalid_response', async () => {
    请求Mock.mockResolvedValueOnce({ result: { ...BFF招聘方档案样本, subject_id: 'sub_1' } });
    await expect(数据源.读取招聘方档案()).rejects.toMatchObject({ code: 'invalid_response' });

    请求Mock.mockResolvedValueOnce({ result: { affiliations: [{ ...BFF企业关系样本, registry_key: 'k' }] } });
    await expect(数据源.读取我的企业关系()).rejects.toMatchObject({ code: 'invalid_response' });

    请求Mock.mockResolvedValueOnce({ result: { requests: [{ ...BFF企业管理员申请样本, object_key: 'k' }] } });
    await expect(数据源.读取企业管理员申请()).rejects.toMatchObject({ code: 'invalid_response' });

    请求Mock.mockResolvedValueOnce({ result: { ...BFF企业档案样本, unknown_field: 1 } });
    await expect(数据源.读取企业档案('org_1')).rejects.toMatchObject({ code: 'invalid_response' });

    请求Mock.mockResolvedValueOnce({ result: { ...BFF公开企业样本, generation: 9 } });
    await expect(数据源.读取公开企业('org_1')).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('缺必需键或闭合 enum 外的值抛 invalid_response', async () => {
    const { title: _title, ...缺键档案 } = BFF招聘方档案样本;
    请求Mock.mockResolvedValueOnce({ result: 缺键档案 });
    await expect(数据源.读取招聘方档案()).rejects.toMatchObject({ code: 'invalid_response' });

    请求Mock.mockResolvedValueOnce({ result: { affiliations: [{ ...BFF企业关系样本, status: 'banned' }] } });
    await expect(数据源.读取我的企业关系()).rejects.toMatchObject({ code: 'invalid_response' });

    请求Mock.mockResolvedValueOnce({
      result: { ...BFF企业档案样本, benefit_codes: ['social_insurance_housing_fund', 'unknown_benefit'] },
    });
    await expect(数据源.读取企业档案('org_1')).rejects.toMatchObject({
      status: 200, code: 'invalid_response',
    });
  });

  // P3：候选人组织搜索 —— q/limit/cursor 按序编码；合同 A 起条目是四公开登记字段。
  it('candidate organization search encodes q/cursor and strictly decodes the four public fields', async () => {
    请求Mock.mockResolvedValueOnce({
      result: {
        items: [{ organization_id: 'org_1', display_name: 'Acme', legal_name: 'Acme Ltd', verification_status: 'verified' }],
        next_cursor: null,
      },
      etag: null, requestId: 'r-search',
    });
    await expect(数据源.搜索组织({ q: 'Acme & Co', limit: 20, cursor: 'abc_DEF-12' })).resolves.toMatchObject({
      items: [{ organization_id: 'org_1', verification_status: 'verified' }], next_cursor: null,
    });
    expect(请求Mock.mock.calls[0][0]).toEqual({
      path: '/api/v1/organizations?q=Acme%20%26%20Co&limit=20&cursor=abc_DEF-12',
    });
  });

  it('搜索词、limit、cursor 越界直接拒绝且不发请求', async () => {
    const 坏查询们 = [
      { q: '   ' },                                  // trim 后空串
      { q: '企'.repeat(201) },                       // 超过 200 个码点
      { q: 'acme', limit: 0 },                       // limit 下限
      { q: 'acme', limit: 51 },                      // limit 上限
      { q: 'acme', limit: 2.5 },                     // 非整数 limit
      { q: 'acme', cursor: 'a'.repeat(4097) },       // cursor 超 4096 字节
    ];
    for (const query of 坏查询们) {
      await expect(数据源.搜索组织(query)).rejects.toMatchObject({ code: 'invalid_request' });
    }
    expect(请求Mock).not.toHaveBeenCalled();
  });

  it('组织搜索结果多字段 / items:null / 缺 next_cursor / 坏 verification_status 都抛 invalid_response', async () => {
    const 干净项 = { organization_id: 'org_1', display_name: 'Acme', legal_name: 'Acme Ltd', verification_status: 'verified' as const };
    请求Mock.mockResolvedValueOnce({ result: { items: [{ ...干净项, status: 'active' }], next_cursor: null } });
    await expect(数据源.搜索组织({ q: 'acme' })).rejects.toMatchObject({ code: 'invalid_response' });

    请求Mock.mockResolvedValueOnce({ result: { items: null, next_cursor: null } });
    await expect(数据源.搜索组织({ q: 'acme' })).rejects.toMatchObject({ code: 'invalid_response' });

    请求Mock.mockResolvedValueOnce({ result: { items: [] } });
    await expect(数据源.搜索组织({ q: 'acme' })).rejects.toMatchObject({ code: 'invalid_response' });

    请求Mock.mockResolvedValueOnce({ result: { items: [{ ...干净项, verification_status: 'banned' }], next_cursor: null } });
    await expect(数据源.搜索组织({ q: 'acme' })).rejects.toMatchObject({ code: 'invalid_response' });
  });

  // ── 合同 A：目录搜索项是四字段，未认证条目 legal_name 为 null，绝不归一成空串 ──

  it('null legal_name ＋ unverified 的四字段页可读且不改写 null', async () => {
    const 未认证项 = { organization_id: 'org_9', display_name: 'Acme Unverified', legal_name: null, verification_status: 'unverified' as const };
    请求Mock.mockResolvedValueOnce({ result: { items: [未认证项], next_cursor: null } });
    await expect(数据源.搜索组织({ q: 'Acme' })).resolves.toEqual({
      items: [未认证项],
      next_cursor: null,
    });
  });

  // ── 合同 A：目录创建 —— body 只有 display_name，幂等键逐字保留；201/200 两种回执都可解析 ──

  it('创建组织 POST /organizations 只有 display_name 且保留调用方幂等键', async () => {
    请求Mock.mockResolvedValueOnce({
      result: {
        organization: { organization_id: 'org_new', display_name: '启明科技', legal_name: null, verification_status: 'unverified' },
        created: true,
      },
    });
    await expect(数据源.创建组织('启明科技', 'company-create-key-0001')).resolves.toEqual({
      organization: { organization_id: 'org_new', display_name: '启明科技', legal_name: null, verification_status: 'unverified' },
      created: true,
    });
    expect(请求Mock.mock.calls[0][0]).toEqual({
      path: '/api/v1/organizations',
      method: 'POST',
      body: { display_name: '启明科技' },
      幂等: true,
      幂等键: 'company-create-key-0001',
    });
  });

  it('创建组织 201 新建与 200 同名收敛两种回执都可解析', async () => {
    请求Mock.mockResolvedValueOnce({
      result: {
        organization: { organization_id: 'org_new', display_name: '启明科技', legal_name: null, verification_status: 'unverified' },
        created: true,
      },
    });
    await expect(数据源.创建组织('启明科技', 'company-create-key-0001'))
      .resolves.toMatchObject({ created: true, organization: { legal_name: null } });

    请求Mock.mockResolvedValueOnce({
      result: {
        organization: {
          organization_id: 'org_old', display_name: '启明科技（杭州）',
          legal_name: '启明科技（杭州）有限公司', verification_status: 'verified',
        },
        created: false,
      },
    });
    await expect(数据源.创建组织('启明科技', 'company-create-key-0001'))
      .resolves.toMatchObject({ created: false, organization: { verification_status: 'verified' } });
  });

  it('创建结果 created 非布尔 / 组织项坏 enum / 多余字段抛 invalid_response', async () => {
    const 干净项 = { organization_id: 'org_new', display_name: '启明科技', legal_name: null, verification_status: 'unverified' as const };
    请求Mock.mockResolvedValueOnce({ result: { organization: 干净项, created: 'yes' } });
    await expect(数据源.创建组织('启明科技', 'company-create-key-0001')).rejects.toMatchObject({ code: 'invalid_response' });

    请求Mock.mockResolvedValueOnce({ result: { organization: { ...干净项, verification_status: 'banned' }, created: true } });
    await expect(数据源.创建组织('启明科技', 'company-create-key-0001')).rejects.toMatchObject({ code: 'invalid_response' });

    请求Mock.mockResolvedValueOnce({ result: { organization: { ...干净项, domain: 'x.example' }, created: true } });
    await expect(数据源.创建组织('启明科技', 'company-create-key-0001')).rejects.toMatchObject({ code: 'invalid_response' });
  });

  // ── 合同 A：PublicOrganization 未认证条目两认证事实为 null，原样可读 ──

  it('公开企业两项认证事实 null 时原样可读（不归一为空串）', async () => {
    请求Mock.mockResolvedValueOnce({ result: { ...BFF公开企业样本, legal_name: null, verified_at: null } });
    await expect(数据源.读取公开企业('org_1')).resolves.toMatchObject({ legal_name: null, verified_at: null });
  });

  // ── 合同 A：招聘方档案 organization_ref 必需且三态；补丁透传三态 ──

  it('招聘方档案 organization_ref 字符串 / null 可读，缺键拒绝', async () => {
    请求Mock.mockResolvedValueOnce({ result: { ...BFF招聘方档案样本, organization_ref: 'org_1' } });
    await expect(数据源.读取招聘方档案()).resolves.toMatchObject({ organization_ref: 'org_1' });

    请求Mock.mockResolvedValueOnce({ result: { ...BFF招聘方档案样本, organization_ref: null } });
    await expect(数据源.读取招聘方档案()).resolves.toMatchObject({ organization_ref: null });

    const 带ref样本 = { ...BFF招聘方档案样本, organization_ref: 'org_1' };
    const { organization_ref: _缺ref, ...缺ref档案 } = 带ref样本;
    请求Mock.mockResolvedValueOnce({ result: 缺ref档案 });
    await expect(数据源.读取招聘方档案()).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('保存招聘方档案补丁透传 organization_ref 三态且响应可读', async () => {
    请求Mock.mockResolvedValueOnce({ result: { ...BFF招聘方档案样本, organization_ref: 'org_9' } });
    await expect(数据源.保存招聘方档案({ organization_ref: 'org_9' }, 1)).resolves.toMatchObject({ organization_ref: 'org_9' });
    expect(请求Mock.mock.calls[0][0]).toEqual({
      path: '/api/v1/recruiter/profile', method: 'PATCH', body: { organization_ref: 'org_9' }, ifMatch: '"1"',
    });

    请求Mock.mockResolvedValueOnce({ result: { ...BFF招聘方档案样本, organization_ref: null } });
    await expect(数据源.保存招聘方档案({ organization_ref: null }, 1)).resolves.toMatchObject({ organization_ref: null });
    expect(请求Mock.mock.calls[1][0]).toEqual({
      path: '/api/v1/recruiter/profile', method: 'PATCH', body: { organization_ref: null }, ifMatch: '"1"',
    });
  });

  // ── 合同 A：企业管理员申请绑定目录组织，organization_id 必需 ──

  it('企业管理员申请回执含 organization_id 且缺键拒绝', async () => {
    请求Mock.mockResolvedValueOnce({ result: { requests: [{ ...BFF企业管理员申请样本, organization_id: 'org_1' }] } });
    await expect(数据源.读取企业管理员申请()).resolves.toMatchObject({
      0: { request_id: 'req_1', organization_id: 'org_1' },
    });

    const { organization_id: _缺组织, ...缺键申请 } = { ...BFF企业管理员申请样本, organization_id: 'org_1' };
    请求Mock.mockResolvedValueOnce({ result: { requests: [缺键申请] } });
    await expect(数据源.读取企业管理员申请()).rejects.toMatchObject({ code: 'invalid_response' });
  });
});
