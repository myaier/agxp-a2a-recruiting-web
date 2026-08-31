// 公司主页资料 · 单个分区的编辑页（/hr/company-profile/:area）
//
// 标注 2026-08-20 15:40：用户要求「点击编辑的时候不要把输入框做到下面……可以跳到一个
// 新的页面让用户去输入」。所以每个分区都是一整屏：返回栏（左 ‹ + 右上「保存」）+
// 大标题（分区名）+ 全屏编辑区。公司介绍这类长文用整屏 textarea，字数计在右下角。
//
// P1C 起分双分支：
//   Mock    —— 上述原型原样保留：读资料(取公司档案(本公司键), 状态.公司自述) 起草稿，
//              保存派发 存公司自述（LOGO 走 存公司LOGO + canvas 压缩）。
//   Backend —— 草稿 = 从BFF企业档案(企业档案快照) 构造的**完整 资料形**；保存只调
//              保存企业档案(draft)（operation 生成完整 replacement + If-Match），
//              不派发 存公司自述/存公司LOGO。可编辑 = admin+verified+active 的局部
//              布尔表达式，member/pending/revoked/suspended 一律只读。
//              基本信息槽位「公司全称」改叫「品牌名称」（写 brand_name），同区新增只读
//              「工商全称（已核验）」（取 当前企业身份.legal_name，第三方核验事实不给编辑）。
//              行业走 industries taxonomy（roots / parentId 展开 / q 搜索，selectable
//              叶子原子写 显示名+行业引用）；媒体走两步协议 operation
//              （上传并发布企业媒体 / 移除企业媒体），页面只做校验、object URL 内存预览
//              与 purpose/mediaId 传参，服务端 URL 一律来自 DTO。
// 直接返回（不点保存）就是丢弃改动 —— 文本草稿只活在本页的 useState 里。

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import 样式 from './公司档案分区编辑.module.css';
import { 次级页外壳, 返回栏, 滚动区, 页面大标题 } from '../组件/通用';
import { 轻提示 } from '../组件/轻提示';
import { 相机图标 } from '../组件/图标';
import { use导航 } from '../路由/导航钩子';
import { 取公司档案 } from '../数据/公司档案';
import type { 团队成员项 } from '../数据/类型';
import {
  按段取分区,
  本公司键,
  合成覆盖,
  作息池,
  规模池,
  融资阶段池,
  行业池,
  相册每组上限,
  福利标签池,
  读资料,
  type 分区定义,
  type 资料形,
} from '../数据/公司主页资料';
import type {
  BFF公开企业,
  BFFTaxonomyItem,
  BFF企业媒体,
  BFF企业媒体用途,
} from '../数据/BFF契约';
import type { 目录页, Taxonomy查询 } from '../数据/招聘数据源类型';
import { 合并目录页 } from '../数据/目录选择';
import { 从BFF企业档案 } from '../数据/组织映射';
import { 取后端错误文案 } from '../数据/HTTP客户端';
import type { 企业媒体脱离错误 } from '../状态/后端/组织操作';
import { use应用状态 } from '../状态/应用状态';

/** 媒体上传的冻结边界（P1B runtime）：只收 PNG/JPEG，单文件 ≤ 10 MiB */
const 图片字节上限 = 10 * 1024 * 1024;

/** 主营业务上限（P1B runtime）：最多 20 条、每条 200 字 → textarea 总长 20×200+19 个换行 */
const 业务字上限 = 20 * 200 + 19;

/** 团队成员上限（P1B runtime） */
const 成员数上限 = 20;

/** Backend 行业选择只用得到 industries 一个 kind（目录查询 seam 的窄化形态） */
type 行业查询方法 = (kind: 'industries', query: Taxonomy查询) => Promise<目录页<BFFTaxonomyItem>>;
type 目录查询形 = { 查询Taxonomy: 行业查询方法 } | null;
type 企业身份形 = Omit<BFF公开企业, 'profile'> | null;

export default function 公司档案分区编辑() {
  const { area: 段 } = useParams<{ area: string }>();
  const { 返回 } = use导航();
  const { 数据源模式 } = use应用状态();
  const 分区 = 按段取分区(段);

  // 地址栏被手改成不存在的分区时不白屏，退回清单
  if (!分区) {
    return (
      // 2026-08-24 全站选择风格统一（C1 定稿）：页底改白
      <次级页外壳 白底>
        <返回栏 返回={返回} />
        <页面大标题 标题="公司主页资料" />
      </次级页外壳>
    );
  }

  return 数据源模式 === 'backend' ? (
    <后端分区编辑 分区={分区} 返回={返回} />
  ) : (
    <Mock分区编辑 分区={分区} 返回={返回} />
  );
}

// ── Backend：完整 replacement 草稿 + 权限门 + 两步媒体 ────────────────

/** 快照未水合时的空草稿（只有形态意义，水合一到就被整体替换） */
function 空资料(): 资料形 {
  return {
    公司全称: '', 行业: '', 规模: '', 融资阶段: '', 办公地址: '',
    福利标签: [], 作息档: '', 公司介绍: '', 主营业务: '',
    实景照片: [], 公司照片: [], 产品介绍: '', 团队介绍: [],
  };
}

function 后端分区编辑({ 分区, 返回 }: { 分区: 分区定义; 返回: () => void }) {
  const { 状态, 操作, 目录查询 } = use应用状态();
  const 快照 = 状态.企业档案快照;
  const 身份 = 状态.当前企业身份;
  // 可编辑写成一个局部布尔表达式，不引入权限框架：
  // admin + 本人关系 verified + 企业 active，三者缺一即只读
  const 当前关系 = 状态.企业关系列表.find((条) => 条.affiliation_id === 状态.当前企业关系编号);
  const 可编辑 = 当前关系?.status === 'verified' &&
    当前关系?.role === 'admin' &&
    当前关系?.organization_status === 'active';

  // 草稿从最新 企业档案快照 构造完整 资料形；水合晚于进屏时由 effect 整体初始化
  const [资料, 设资料] = useState<资料形>(() => (快照 ? 从BFF企业档案(快照) : 空资料()));
  const 已初始化 = useRef(快照 !== null);
  useEffect(() => {
    if (!快照) return;
    if (!已初始化.current) {
      已初始化.current = true;
      设资料(从BFF企业档案(快照));
      return;
    }
    // 权威快照前进（409/503 重读、另一端刚发布成功的媒体）：只同步媒体事实，
    // 文本草稿留在用户手里 —— 409 后必须由用户检查再按原保存键重试
    设资料((旧) => ({
      ...旧,
      LOGO媒体: 快照.logo,
      实景媒体: 快照.office_media,
      公司媒体: 快照.company_media,
      实景照片: 快照.office_media.map((媒) => 媒.url),
      公司照片: 快照.company_media.map((媒) => 媒.url),
    }));
  }, [快照]);

  function 改(补丁: Partial<资料形>) {
    设资料((旧) => ({ ...旧, ...补丁 }));
  }

  // ── 媒体：两步协议由 operation 编排；页面只管文件校验、object URL 内存预览、purpose ──
  const 预览集 = useRef<Set<string>>(new Set());
  // 卸载只回收 object URL，绝不把页面卸载当成服务端删除
  useEffect(() => () => {
    预览集.current.forEach((地址) => URL.revokeObjectURL(地址));
  }, []);
  /** 校验 PNG/JPEG 与 10 MiB；通过则生成 object URL 预览并登记待回收 */
  function 校验图片(文件: File): string | null {
    if (文件.type !== 'image/png' && 文件.type !== 'image/jpeg') {
      轻提示('仅支持 PNG / JPEG 图片');
      return null;
    }
    if (文件.size > 图片字节上限) {
      轻提示('图片不超过 10 MiB');
      return null;
    }
    const 地址 = URL.createObjectURL(文件);
    预览集.current.add(地址);
    return 地址;
  }
  function 收预览(地址: string | null) {
    if (!地址) return;
    预览集.current.delete(地址);
    URL.revokeObjectURL(地址);
  }
  const [LOGO预览, 设LOGO预览] = useState<string | null>(null);
  const [组预览表, 设组预览表] = useState<Partial<Record<BFF企业媒体用途, string>>>({});
  // 发布失败（上传已成功、PATCH 未完成）时 operation 抛回的脱离媒体收据：
  // 页面只给用户「放弃（best-effort DELETE）」一个出口，不自动清理
  const [脱离单, 设脱离单] = useState<{ purpose: BFF企业媒体用途; media_id: string } | null>(null);

  async function 发布媒体(purpose: BFF企业媒体用途, 文件: File, 上传中预览: string) {
    try {
      await 操作.上传并发布企业媒体(purpose, 文件);
      // 成功后权威 snapshot 被 operation 用响应替换，预览随之收口
    } catch (错误) {
      const 收据 = (错误 as 企业媒体脱离错误).脱离媒体;
      if (收据) 设脱离单(收据);
      轻提示(取后端错误文案(错误));
    } finally {
      收预览(上传中预览);
      if (purpose === 'organization_logo') 设LOGO预览(null);
      else 设组预览表((旧) => ({ ...旧, [purpose]: undefined }));
    }
  }

  async function 放弃脱离媒体() {
    if (!脱离单) return;
    const 收据 = 脱离单;
    设脱离单(null);
    // best-effort：失败也静默收口（孤儿媒体交由服务端策略），不打扰用户
    await 操作.移除企业媒体(收据.purpose, 收据.media_id).catch(() => {});
  }

  function 选了LOGO(事件: React.ChangeEvent<HTMLInputElement>) {
    const 文件 = 事件.target.files?.[0];
    事件.target.value = ''; // 允许再次选同一张
    if (!文件 || !可编辑) return;
    const 预览 = 校验图片(文件);
    if (!预览) return;
    设LOGO预览(预览);
    void 发布媒体('organization_logo', 文件, 预览);
  }

  async function 移除一张(purpose: 'office_photo' | 'company_photo', 序: number) {
    const 媒体们 = purpose === 'office_photo' ? (资料.实景媒体 ?? []) : (资料.公司媒体 ?? []);
    const 媒体 = 媒体们[序];
    if (!媒体) return;
    // 明确移除：先 PATCH 去引用再 DELETE 已脱离媒体，顺序由 operation 保证
    try {
      await 操作.移除企业媒体(purpose, 媒体.media_id);
    } catch (错误) {
      轻提示(取后端错误文案(错误));
    }
  }

  // ── 保存：完整 replacement（14 字段由 operation 的 转BFF企业档案替换 生成）──
  const 业务行们 = 资料.主营业务.split('\n').map((行) => 行.trim()).filter(Boolean);
  const 缺行业引用 = 资料.行业.trim() !== '' && 资料.行业引用 === undefined;
  async function 保存() {
    if (!可编辑) return;
    if (业务行们.length > 20) {
      轻提示('主营业务最多 20 条');
      return;
    }
    if (业务行们.some((行) => 行.length > 200)) {
      轻提示('每条主营业务不超过 200 字');
      return;
    }
    try {
      await 操作.保存企业档案(资料);
      轻提示('已保存');
      返回();
    } catch (错误) {
      // 409/503：operation 已重读权威 snapshot；草稿保留在本页，用户检查后按原键重试
      轻提示(取后端错误文案(错误));
    }
  }

  if (!快照) {
    return (
      <次级页外壳 白底>
        <返回栏 返回={返回} />
        <页面大标题 标题={分区.键} />
        <滚动区 样式覆盖={{ padding: '16px 18px 0' }}>
          <div className={样式.字段}>正在加载企业资料</div>
        </滚动区>
      </次级页外壳>
    );
  }

  return (
    // 2026-08-24 全站选择风格统一（C1 定稿）：页底改白
    <次级页外壳 白底>
      <返回栏
        返回={返回}
        右侧={
          可编辑 ? (
            <button
              className={`${样式.保存键} 可点`}
              disabled={缺行业引用}
              onClick={保存}
            >
              保存
            </button>
          ) : null
        }
      />

      <页面大标题 标题={分区.键} />

      {!可编辑 ? (
        <滚动区 样式覆盖={{ padding: '0 18px' }}>
          <div className={样式.字段标签} style={{ color: 'var(--次要浅)' }}>
            仅企业管理员可修改
          </div>
        </滚动区>
      ) : null}

      {可编辑 && 脱离单 ? (
        <滚动区 样式覆盖={{ padding: '0 18px 8px' }}>
          <button className={`${样式.加一条} 可点`} onClick={() => void 放弃脱离媒体()}>
            放弃未发布的照片
          </button>
        </滚动区>
      ) : null}

      {/* 长文分区：整屏 textarea（字数在右下角）；其余分区：可滚的字段区 */}
      {分区.键 === '公司介绍' ? (
        <整屏文本
          值={资料.公司介绍}
          上限={500}
          标题="公司介绍"
          禁用={!可编辑}
          改变={(值) => 改({ 公司介绍: 值 })}
        />
      ) : null}

      {分区.键 === '主营业务' ? (
        // Backend 主营业务即 business_items：一行一条，最多 20 条、每条 200 字
        //（保存时校验条数与单条长度；textarea 总长只是这三者的物理并集）
        <整屏文本
          值={资料.主营业务}
          上限={业务字上限}
          标题="主营业务"
          禁用={!可编辑}
          改变={(值) => 改({ 主营业务: 值 })}
        />
      ) : null}

      {分区.键 === '产品介绍' ? (
        <整屏文本
          值={资料.产品介绍}
          上限={300}
          标题="产品介绍"
          禁用={!可编辑}
          改变={(值) => 改({ 产品介绍: 值 })}
        />
      ) : null}

      {分区.键 === '基本信息' ? (
        <后端基本信息区
          资料={资料}
          改={改}
          可编辑={可编辑}
          身份={身份}
          LOGO预览={LOGO预览}
          选了LOGO={选了LOGO}
          目录查询={目录查询}
        />
      ) : null}

      {分区.键 === '公司福利' ? <公司福利区 资料={资料} 改={改} 禁用={!可编辑} /> : null}

      {分区.键 === '公司相册' ? (
        <字段区>
          <后端媒体组
            标签="实景照片"
            媒体们={资料.实景媒体 ?? []}
            预览={组预览表.office_photo}
            可编辑={可编辑}
            选了图={(文件) => {
              const 预览 = 校验图片(文件);
              if (!预览) return;
              设组预览表((旧) => ({ ...旧, office_photo: 预览 }));
              void 发布媒体('office_photo', 文件, 预览);
            }}
            移除一张={(序) => void 移除一张('office_photo', 序)}
          />
          <后端媒体组
            标签="公司照片"
            媒体们={资料.公司媒体 ?? []}
            预览={组预览表.company_photo}
            可编辑={可编辑}
            选了图={(文件) => {
              const 预览 = 校验图片(文件);
              if (!预览) return;
              设组预览表((旧) => ({ ...旧, company_photo: 预览 }));
              void 发布媒体('company_photo', 文件, 预览);
            }}
            移除一张={(序) => void 移除一张('company_photo', 序)}
            末条
          />
        </字段区>
      ) : null}

      {分区.键 === '团队介绍' ? (
        <团队介绍区 资料={资料} 改={改} 禁用={!可编辑} 人数上限={成员数上限} />
      ) : null}
    </次级页外壳>
  );
}

/** Backend 基本信息：品牌名称 · 公司 LOGO · 行业（taxonomy）· 规模 · 融资阶段 · 办公地址，
 *  外加只读的「工商全称（已核验）」—— 第三方核验事实，企业侧不可编辑 */
function 后端基本信息区({
  资料,
  改,
  可编辑,
  身份,
  LOGO预览,
  选了LOGO,
  目录查询,
}: {
  资料: 资料形;
  改: (补丁: Partial<资料形>) => void;
  可编辑: boolean;
  身份: 企业身份形;
  LOGO预览: string | null;
  选了LOGO: (事件: React.ChangeEvent<HTMLInputElement>) => void;
  目录查询: 目录查询形;
}) {
  const LOGO框 = useRef<HTMLInputElement>(null);
  const LOGO地址 = LOGO预览 ?? 资料.LOGO媒体?.url ?? null;

  return (
    <字段区>
      <div className={样式.字段}>
        <div className={样式.字段标签}>品牌名称</div>
        <input
          className={样式.单行输入}
          value={资料.公司全称}
          maxLength={40}
          aria-label="品牌名称"
          disabled={!可编辑}
          onChange={(事件) => 改({ 公司全称: 事件.target.value })}
        />
      </div>

      {/* 工商全称是第三方核验的结果，企业自己改了就没有可信度可言 —— 只读展示，不给输入框 */}
      <div className={样式.字段}>
        <div className={样式.字段标签}>工商全称（已核验）</div>
        <div className={样式.单行输入} style={{ color: 'var(--次要浅)' }}>
          {身份?.legal_name ?? '—'}
        </div>
      </div>

      <div className={样式.字段}>
        <div className={样式.字段标签}>公司 LOGO</div>
        {可编辑 ? (
          <button
            className={`${样式.LOGO键} 可点`}
            onClick={() => LOGO框.current?.click()}
            aria-label="上传公司 LOGO"
          >
            {LOGO地址 ? (
              <img className={样式.LOGO图} src={LOGO地址} alt="" />
            ) : (
              <span className={样式.LOGO空} />
            )}
            <span className={样式.相机角标}>
              <相机图标 尺寸={11} 色="var(--正文)" />
            </span>
          </button>
        ) : LOGO地址 ? (
          <img className={样式.LOGO图} src={LOGO地址} alt="" />
        ) : (
          <span className={样式.LOGO空} />
        )}
        <input
          ref={LOGO框}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          aria-label="更换公司 LOGO"
          onChange={选了LOGO}
        />
      </div>

      <后端行业区 资料={资料} 改={改} 可编辑={可编辑} 目录查询={目录查询} />
      <单选片组 标签="规模" 选项={规模池} 当前={资料.规模} 禁用={!可编辑} 选中={(值) => 改({ 规模: 值 })} />
      <单选片组
        标签="融资阶段"
        选项={融资阶段池}
        当前={资料.融资阶段}
        禁用={!可编辑}
        选中={(值) => 改({ 融资阶段: 值 })}
      />

      <div className={`${样式.字段} ${样式.末条}`}>
        <div className={样式.字段标签}>办公地址</div>
        <textarea
          className={样式.多行输入}
          style={{ height: 66 }}
          value={资料.办公地址}
          maxLength={80}
          aria-label="办公地址"
          disabled={!可编辑}
          onChange={(事件) => 改({ 办公地址: 事件.target.value })}
        />
      </div>
    </字段区>
  );
}

/** Backend 行业选择：打开读 industries 根项（limit 50），非 selectable 项按 parentId 展开，
 *  搜索按 q 查询；只有 selectable=true 的叶子能选中 —— 选中原子写 显示名+行业引用，
 *  从不按显示名反查 id。这里刻意接受一份仅限公司基本信息的局部实现，不抽取 工作经历。 */
function 后端行业区({
  资料,
  改,
  可编辑,
  目录查询,
}: {
  资料: 资料形;
  改: (补丁: Partial<资料形>) => void;
  可编辑: boolean;
  目录查询: 目录查询形;
}) {
  const [开着, 设开着] = useState(false);
  const [根项, 设根项] = useState<BFFTaxonomyItem[]>([]);
  const [根游标, 设根游标] = useState<string | null>(null);
  // 已展开父项的子项与游标（键 = 父项 id；根用 ''，任意层级都用这一个表）
  const [子项表, 设子项表] = useState<Record<string, BFFTaxonomyItem[]>>({});
  const [子游标表, 设子游标表] = useState<Record<string, string | null>>({});
  const [搜索词, 设搜索词] = useState('');
  // null = 浏览根项模式；有值 = 显示搜索结果
  const [搜索结果, 设搜索结果] = useState<BFFTaxonomyItem[] | null>(null);
  const 方法引用 = useRef(目录查询?.查询Taxonomy);
  方法引用.current = 目录查询?.查询Taxonomy;

  // 弹开时按需读根项（与 工作经历 已验证的 industries 模式一致）
  useEffect(() => {
    if (!开着) return;
    const 方法 = 方法引用.current;
    if (!方法) return;
    void (async () => {
      try {
        const 页 = await 方法('industries', { limit: 50 });
        设根项(页.items);
        设根游标(页.nextCursor);
      } catch {
        设根项([]);
        设根游标(null);
      }
    })();
  }, [开着]);

  // 搜索：250ms debounce 后按 q 查询（空串回浏览模式）
  useEffect(() => {
    const 词 = 搜索词.trim();
    if (词 === '') {
      设搜索结果(null);
      return;
    }
    const 方法 = 方法引用.current;
    if (!方法) return;
    const 计时器 = setTimeout(() => {
      void 方法('industries', { q: 词, limit: 50 })
        .then((页) => 设搜索结果(页.items))
        .catch(() => 设搜索结果([]));
    }, 250);
    return () => clearTimeout(计时器);
  }, [搜索词]);

  async function 展开(项: BFFTaxonomyItem) {
    if (子项表[项.id]) return;
    const 方法 = 方法引用.current;
    if (!方法) return;
    try {
      const 页 = await 方法('industries', { parentId: 项.id, limit: 50 });
      设子项表((旧) => ({ ...旧, [项.id]: 页.items }));
      设子游标表((旧) => ({ ...旧, [项.id]: 页.nextCursor }));
    } catch {
      设子项表((旧) => ({ ...旧, [项.id]: [] }));
      设子游标表((旧) => ({ ...旧, [项.id]: null }));
    }
  }

  async function 加载更多(父id: string) {
    const 游标 = 父id === '' ? 根游标 : 子游标表[父id];
    if (游标 === null || 游标 === undefined) return;
    const 方法 = 方法引用.current;
    if (!方法) return;
    try {
      const 页 = await 方法('industries', { parentId: 父id === '' ? undefined : 父id, cursor: 游标, limit: 50 });
      if (父id === '') 设根项((旧) => 合并目录页(旧, 页.items));
      else 设子项表((旧) => ({ ...旧, [父id]: 合并目录页(旧[父id] ?? [], 页.items) }));
      设子游标表((旧) => ({ ...旧, [父id]: 页.nextCursor }));
      if (父id === '') 设根游标(页.nextCursor);
    } catch {
      // 失败不动，用户可再点
    }
  }

  function 选中(项: BFFTaxonomyItem) {
    改({ 行业: 项.display_name, 行业引用: { id: 项.id, display_name: 项.display_name } });
    设开着(false);
    设搜索词('');
    设搜索结果(null);
  }

  const 候选 = 搜索结果 ?? 根项;

  return (
    <div className={样式.字段}>
      <div className={样式.字段标签}>行业</div>
      <div className={样式.片行}>
        <span className={`${资料.行业 ? 样式.片选中 : ''} ${样式.片}`}>
          {资料.行业 || '未设置'}
        </span>
        {可编辑 ? (
          <button
            className={`${样式.片} 可点`}
            aria-label="更换行业"
            onClick={() => 设开着(!开着)}
          >
            {开着 ? '收起' : '更换行业'}
          </button>
        ) : null}
      </div>

      {开着 ? (
        <div className={样式.片行} style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
          <input
            className={样式.单行输入}
            aria-label="搜索行业"
            placeholder="搜索行业"
            value={搜索词}
            onChange={(事件) => 设搜索词(事件.target.value)}
          />
          <div className={样式.片行}>
            {候选.map((项) => (
              <button
                key={项.id}
                className={`${样式.片} ${资料.行业引用?.id === 项.id ? 样式.片选中 : ''} 可点`}
                onClick={() => (项.selectable ? 选中(项) : void 展开(项))}
              >
                {项.selectable ? 项.display_name : `${项.display_name} ›`}
              </button>
            ))}
            {搜索结果 === null && 根游标 !== null ? (
              <button className={`${样式.片} 可点`} onClick={() => void 加载更多('')}>
                加载更多
              </button>
            ) : null}
          </div>
          {/* 已展开父项的子项行（支持多级：展开过的都摊在这里，按展开顺序） */}
          {Object.entries(子项表).map(([父id, 子们]) =>
            子们.length > 0 ? (
              <div key={父id} className={样式.片行} style={{ paddingLeft: 12 }}>
                {子们.map((项) => (
                  <button
                    key={项.id}
                    className={`${样式.片} ${资料.行业引用?.id === 项.id ? 样式.片选中 : ''} 可点`}
                    onClick={() => (项.selectable ? 选中(项) : void 展开(项))}
                  >
                    {项.selectable ? 项.display_name : `${项.display_name} ›`}
                  </button>
                ))}
                {子游标表[父id] ? (
                  <button className={`${样式.片} 可点`} onClick={() => void 加载更多(父id)}>
                    加载更多
                  </button>
                ) : null}
              </div>
            ) : null,
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Backend 相册组：一组权威媒体对象（URL 一律来自 DTO），上传即走两步协议，
 *  删除先去引用再 DELETE（顺序由 operation 保证），每组最多 相册每组上限 张 */
function 后端媒体组({
  标签,
  媒体们,
  预览,
  可编辑,
  选了图,
  移除一张,
  末条 = false,
}: {
  标签: string;
  媒体们: BFF企业媒体[];
  /** 上传进行中的 object URL 预览（无则未在上传） */
  预览?: string;
  可编辑: boolean;
  选了图: (文件: File) => void;
  移除一张: (序: number) => void;
  末条?: boolean;
}) {
  const 选框 = useRef<HTMLInputElement>(null);

  function 收图(事件: React.ChangeEvent<HTMLInputElement>) {
    const 文件 = 事件.target.files?.[0];
    事件.target.value = '';
    if (!文件) return;
    选了图(文件);
  }

  return (
    <div className={`${样式.字段} ${末条 ? 样式.末条 : ''}`}>
      <div className={样式.字段标签}>
        {标签} {媒体们.length}/{相册每组上限}
      </div>
      <div className={样式.图格行}>
        {媒体们.map((媒, 序) => (
          <span key={媒.media_id} className={样式.图格}>
            <img className={样式.图格图} src={媒.url} alt="" />
            {可编辑 ? (
              <button
                className={`${样式.图格删} 可点`}
                aria-label={`删除${标签}第 ${序 + 1} 张`}
                onClick={() => 移除一张(序)}
              >
                ✕
              </button>
            ) : null}
          </span>
        ))}
        {预览 ? (
          <span className={样式.图格}>
            <img className={样式.图格图} src={预览} alt="上传预览" />
          </span>
        ) : null}
        {可编辑 && 媒体们.length < 相册每组上限 && !预览 ? (
          <button
            className={`${样式.图格加} 可点`}
            aria-label={`添加${标签}`}
            onClick={() => 选框.current?.click()}
          >
            ＋
          </button>
        ) : null}
      </div>
      <input
        ref={选框}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        aria-label={`上传${标签}`}
        onChange={收图}
      />
    </div>
  );
}

// ── Mock：静态档原型（原实现逐字保留）───────────────────────────────

/** 把用户选的图片压成 128×128 居中裁切的 JPEG dataURL —— 实现镜像 招聘名片 的
 *  压成头像，只是边长换成 LOGO 用的 128（约 6-12KB） */
function 压成LOGO(文件: File): Promise<string> {
  return 压图(文件, (图, 画布) => {
    const 边 = 128;
    画布.width = 边;
    画布.height = 边;
    const 笔 = 画布.getContext('2d')!;
    const 源边 = Math.min(图.width, 图.height);
    笔.drawImage(图, (图.width - 源边) / 2, (图.height - 源边) / 2, 源边, 源边, 0, 0, 边, 边);
  });
}

/** 相册图压到长边 480（约 30-60KB/张）—— 两组各最多 3 张，避免撑爆浏览器缓存 */
function 压成相册图(文件: File): Promise<string> {
  return 压图(文件, (图, 画布) => {
    const 长边 = 480;
    const 比 = Math.min(1, 长边 / Math.max(图.width, 图.height));
    画布.width = Math.round(图.width * 比);
    画布.height = Math.round(图.height * 比);
    画布.getContext('2d')!.drawImage(图, 0, 0, 画布.width, 画布.height);
  });
}

/** 读文件 → 解码 → 交给调用方往画布上画 → 导出 JPEG dataURL */
function 压图(
  文件: File,
  画: (图: HTMLImageElement, 画布: HTMLCanvasElement) => void
): Promise<string> {
  return new Promise((成, 败) => {
    const 读 = new FileReader();
    读.onerror = () => 败(new Error('读取失败'));
    读.onload = () => {
      const 图 = new Image();
      图.onerror = () => 败(new Error('不是可用的图片'));
      图.onload = () => {
        const 画布 = document.createElement('canvas');
        画(图, 画布);
        成(画布.toDataURL('image/jpeg', 0.82));
      };
      图.src = String(读.result);
    };
    读.readAsDataURL(文件);
  });
}

function Mock分区编辑({ 分区, 返回 }: { 分区: 分区定义; 返回: () => void }) {
  const { 状态, 派发 } = use应用状态();
  const 静态档 = 取公司档案(本公司键);
  const 覆盖 = 状态.公司自述;
  const 分区键 = 分区.键;

  // 草稿：进页时从全局读一份，改完点保存才写回去
  const [资料, 设资料] = useState<资料形>(() => 读资料(静态档, 覆盖));

  function 改(补丁: Partial<资料形>) {
    设资料((旧) => ({ ...旧, ...补丁 }));
  }

  function 保存() {
    派发({ 型: '存公司自述', 值: 合成覆盖(资料, 静态档, 覆盖) });
    轻提示('已保存');
    返回();
  }

  return (
    // 2026-08-24 全站选择风格统一（C1 定稿）：页底改白
    <次级页外壳 白底>
      <返回栏
        返回={返回}
        右侧={
          <button className={`${样式.保存键} 可点`} onClick={保存}>
            保存
          </button>
        }
      />

      <页面大标题 标题={分区键} />

      {/* 长文分区：整屏 textarea（字数在右下角）；其余分区：可滚的字段区 */}
      {分区键 === '公司介绍' ? (
        <整屏文本 值={资料.公司介绍} 上限={500} 标题="公司介绍" 改变={(值) => 改({ 公司介绍: 值 })} />
      ) : null}

      {分区键 === '主营业务' ? (
        <整屏文本 值={资料.主营业务} 上限={200} 标题="主营业务" 改变={(值) => 改({ 主营业务: 值 })} />
      ) : null}

      {分区键 === '产品介绍' ? (
        <整屏文本 值={资料.产品介绍} 上限={300} 标题="产品介绍" 改变={(值) => 改({ 产品介绍: 值 })} />
      ) : null}

      {分区键 === '基本信息' ? (
        <Mock基本信息区
          资料={资料}
          改={改}
          LOGO={状态.公司LOGO}
          存LOGO={(图) => 派发({ 型: '存公司LOGO', 图 })}
        />
      ) : null}

      {分区键 === '公司福利' ? <公司福利区 资料={资料} 改={改} /> : null}

      {分区键 === '公司相册' ? <Mock公司相册区 资料={资料} 改={改} /> : null}

      {分区键 === '团队介绍' ? <团队介绍区 资料={资料} 改={改} /> : null}
    </次级页外壳>
  );
}

/** 整屏文本：输入框占满剩余高度，字数压在右下角 —— 长文写得开，不再挤在半屏抽屉里 */
function 整屏文本({
  值,
  上限,
  标题,
  改变,
  禁用 = false,
}: {
  值: string;
  上限: number;
  标题: string;
  改变: (值: string) => void;
  禁用?: boolean;
}) {
  return (
    <div className={样式.整屏区}>
      <div className={样式.整屏框}>
        <textarea
          className={样式.整屏输入}
          value={值}
          maxLength={上限}
          aria-label={标题}
          autoFocus
          disabled={禁用}
          onChange={(事件) => 改变(事件.target.value)}
        />
        <div className={`${样式.整屏字数} 等宽数字`}>
          {值.length} / {上限}
        </div>
      </div>
    </div>
  );
}

/** Mock 基本信息：公司全称 · 公司 LOGO · 行业 · 规模 · 融资阶段 · 办公地址（原样保留） */
function Mock基本信息区({
  资料,
  改,
  LOGO,
  存LOGO,
}: {
  资料: 资料形;
  改: (补丁: Partial<资料形>) => void;
  LOGO: string | null;
  存LOGO: (图: string) => void;
}) {
  const LOGO框 = useRef<HTMLInputElement>(null);

  async function 选了LOGO(事件: React.ChangeEvent<HTMLInputElement>) {
    const 文件 = 事件.target.files?.[0];
    事件.target.value = ''; // 允许再次选同一张
    if (!文件) return;
    try {
      存LOGO(await 压成LOGO(文件));
      轻提示('LOGO 已更新');
    } catch {
      轻提示('这张图片读不出来，换一张试试');
    }
  }

  return (
    <字段区>
      <div className={样式.字段}>
        <div className={样式.字段标签}>公司全称</div>
        <input
          className={样式.单行输入}
          value={资料.公司全称}
          maxLength={40}
          aria-label="公司全称"
          onChange={(事件) => 改({ 公司全称: 事件.target.value })}
        />
      </div>

      <div className={样式.字段}>
        <div className={样式.字段标签}>公司 LOGO</div>
        <button
          className={`${样式.LOGO键} 可点`}
          onClick={() => LOGO框.current?.click()}
          aria-label="上传公司 LOGO"
        >
          {LOGO ? (
            <img className={样式.LOGO图} src={LOGO} alt="" />
          ) : (
            <span className={样式.LOGO空} />
          )}
          <span className={样式.相机角标}>
            <相机图标 尺寸={11} 色="var(--正文)" />
          </span>
        </button>
        <input
          ref={LOGO框}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={选了LOGO}
        />
      </div>

      <单选片组 标签="行业" 选项={行业池} 当前={资料.行业} 选中={(值) => 改({ 行业: 值 })} />
      <单选片组 标签="规模" 选项={规模池} 当前={资料.规模} 选中={(值) => 改({ 规模: 值 })} />
      <单选片组
        标签="融资阶段"
        选项={融资阶段池}
        当前={资料.融资阶段}
        选中={(值) => 改({ 融资阶段: 值 })}
      />

      <div className={`${样式.字段} ${样式.末条}`}>
        <div className={样式.字段标签}>办公地址</div>
        <textarea
          className={样式.多行输入}
          style={{ height: 66 }}
          value={资料.办公地址}
          maxLength={80}
          aria-label="办公地址"
          onChange={(事件) => 改({ 办公地址: 事件.target.value })}
        />
      </div>
    </字段区>
  );
}

/** 公司福利：福利标签（多选）+ 作息（单选），即清单上的 N/2 */
function 公司福利区({
  资料,
  改,
  禁用 = false,
}: {
  资料: 资料形;
  改: (补丁: Partial<资料形>) => void;
  禁用?: boolean;
}) {
  return (
    <字段区>
      <div className={样式.字段}>
        <div className={样式.字段标签}>福利标签</div>
        <div className={样式.片行}>
          {福利标签池.map((名) => {
            const 选中 = 资料.福利标签.includes(名);
            return (
              <button
                key={名}
                className={`${样式.片} ${选中 ? 样式.片选中 : ''} 可点`}
                aria-pressed={选中}
                disabled={禁用}
                onClick={() =>
                  改({
                    福利标签: 选中
                      ? 资料.福利标签.filter((条) => 条 !== 名)
                      : [...资料.福利标签, 名],
                  })
                }
              >
                {名}
              </button>
            );
          })}
        </div>
      </div>

      <单选片组
        标签="作息"
        选项={作息池}
        当前={资料.作息档}
        禁用={禁用}
        选中={(值) => 改({ 作息档: 值 })}
        末条
      />
    </字段区>
  );
}

/** Mock 公司相册：data URL 压缩原型（原样保留） */
function Mock公司相册区({
  资料,
  改,
}: {
  资料: 资料形;
  改: (补丁: Partial<资料形>) => void;
}) {
  return (
    <字段区>
      <图片组
        标签="实景照片"
        图们={资料.实景照片}
        设图们={(新图们) => 改({ 实景照片: 新图们 })}
      />
      <图片组
        标签="公司照片"
        图们={资料.公司照片}
        设图们={(新图们) => 改({ 公司照片: 新图们 })}
        末条
      />

    </字段区>
  );
}

/** 一组图片：已选的缩略图（右上角 ✕ 删）+ 未满时的「＋」格 */
function 图片组({
  标签,
  图们,
  设图们,
  末条 = false,
}: {
  标签: string;
  图们: string[];
  设图们: (新图们: string[]) => void;
  /** 分区最后一行：不画底部分隔线 */
  末条?: boolean;
}) {
  const 选框 = useRef<HTMLInputElement>(null);

  async function 选了图(事件: React.ChangeEvent<HTMLInputElement>) {
    const 文件 = 事件.target.files?.[0];
    事件.target.value = '';
    if (!文件) return;
    try {
      const 图 = await 压成相册图(文件);
      设图们([...图们, 图].slice(0, 相册每组上限));
    } catch {
      轻提示('这张图片读不出来，换一张试试');
    }
  }

  return (
    <div className={`${样式.字段} ${末条 ? 样式.末条 : ''}`}>
      <div className={样式.字段标签}>
        {标签} {图们.length}/{相册每组上限}
      </div>
      <div className={样式.图格行}>
        {图们.map((图, 序) => (
          <span key={`${序}-${图.slice(-24)}`} className={样式.图格}>
            <img className={样式.图格图} src={图} alt="" />
            <button
              className={`${样式.图格删} 可点`}
              aria-label={`删除${标签}第 ${序 + 1} 张`}
              onClick={() => 设图们(图们.filter((_, i) => i !== 序))}
            >
              ✕
            </button>
          </span>
        ))}
        {图们.length < 相册每组上限 ? (
          <button
            className={`${样式.图格加} 可点`}
            aria-label={`添加${标签}`}
            onClick={() => 选框.current?.click()}
          >
            ＋
          </button>
        ) : null}
      </div>
      <input
        ref={选框}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={选了图}
      />
    </div>
  );
}

/** 团队介绍：姓名 + 职务 + 一句话简介，可增可删 */
function 团队介绍区({
  资料,
  改,
  禁用 = false,
  人数上限,
}: {
  资料: 资料形;
  改: (补丁: Partial<资料形>) => void;
  禁用?: boolean;
  /** Backend 冻结上限（P1B runtime：team_members ≤ 20）；Mock 不传即不设限 */
  人数上限?: number;
}) {
  // 一条都没有时先摆一张空卡，进来就能直接写，不用先点「添加」
  const 列表: 团队成员项[] =
    资料.团队介绍.length > 0 ? 资料.团队介绍 : [{ 姓名: '', 职务: '', 简介: '' }];

  function 改一条(序: number, 补丁: Partial<团队成员项>) {
    改({ 团队介绍: 列表.map((位, i) => (i === 序 ? { ...位, ...补丁 } : 位)) });
  }

  const 已满 = 人数上限 !== undefined && 列表.length >= 人数上限;

  return (
    <字段区>
      {列表.map((位, 序) => (
        <div key={序} className={样式.成员块}>
          <div className={样式.成员头}>
            <span className={`${样式.字段标签} 等宽数字`}>成员 {序 + 1}</span>
            {禁用 ? null : (
              <button
                className={`${样式.成员删} 可点`}
                aria-label={`删除成员 ${序 + 1}`}
                onClick={() => 改({ 团队介绍: 列表.filter((_, i) => i !== 序) })}
              >
                ✕
              </button>
            )}
          </div>
          <input
            className={样式.单行输入}
            value={位.姓名}
            maxLength={16}
            placeholder="姓名"
            aria-label={`成员 ${序 + 1} 姓名`}
            disabled={禁用}
            onChange={(事件) => 改一条(序, { 姓名: 事件.target.value })}
          />
          <input
            className={样式.单行输入}
            value={位.职务}
            maxLength={20}
            placeholder="职务"
            aria-label={`成员 ${序 + 1} 职务`}
            disabled={禁用}
            onChange={(事件) => 改一条(序, { 职务: 事件.target.value })}
          />
          <textarea
            className={样式.多行输入}
            style={{ height: 60 }}
            value={位.简介}
            maxLength={60}
            placeholder="一句话简介"
            aria-label={`成员 ${序 + 1} 简介`}
            disabled={禁用}
            onChange={(事件) => 改一条(序, { 简介: 事件.target.value })}
          />
        </div>
      ))}

      {禁用 || 已满 ? null : (
        <button
          className={`${样式.加一条} 可点`}
          onClick={() => 改({ 团队介绍: [...列表, { 姓名: '', 职务: '', 简介: '' }] })}
        >
          ＋ 添加成员
        </button>
      )}
    </字段区>
  );
}

/** 字段型分区共用的滚动容器：一张白卡装所有字段 */
function 字段区({ children }: { children: ReactNode }) {
  return (
    <滚动区 样式覆盖={{ padding: '14px 18px calc(24px + var(--安全区下))' }}>
      <div className={样式.卡}>{children}</div>
    </滚动区>
  );
}

/** 一组单选片：标签 + 平铺档位，点一片即选中 */
function 单选片组({
  标签,
  选项,
  当前,
  选中,
  末条 = false,
  禁用 = false,
}: {
  标签: string;
  选项: string[];
  当前: string;
  选中: (值: string) => void;
  /** 分区最后一行：不画底部分隔线 */
  末条?: boolean;
  禁用?: boolean;
}) {
  return (
    <div className={`${样式.字段} ${末条 ? 样式.末条 : ''}`}>
      <div className={样式.字段标签}>{标签}</div>
      <div className={样式.片行}>
        {选项.map((项) => (
          <button
            key={项}
            className={`${样式.片} ${项 === 当前 ? 样式.片选中 : ''} 可点`}
            aria-pressed={项 === 当前}
            disabled={禁用}
            onClick={() => 选中(项)}
          >
            {项}
          </button>
        ))}
      </div>
    </div>
  );
}
