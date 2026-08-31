// 公司主页资料 · 企业端维护入口（/hr/company-profile）
//
// 标注 2026-08-20 15:40：本屏只剩一份**分区清单**——一行一个分区，点行跳到该分区的
// 独立编辑页（/hr/company-profile/:area）。之前的底部升起层已删：公司介绍这种长文
// 挤在半屏抽屉里写不开，跳整页才写得下，也才能返回、能深链。
//
// 分区（顺序即候选人看这家公司的顺序）：
//   基本信息 N/6 · 公司福利 N/2 · 公司介绍 · 主营业务 · 公司相册 N/2 · 产品介绍 · 团队介绍
//
// 刻意不放进来的东西（与不对称双盲及「代理档案而非宣传册」的立场直接相关）：
//   · 工商信息 —— 第三方核验的结果，企业自己改了就没有可信度可言；
//   · 代理核对结果与在职者反馈 —— 那是平台与候选人侧产生的，企业不该有编辑权。
//
// P1C 起分双分支：
//   Mock    —— 计数读 取公司档案(本公司键) + 状态.公司自述 的原型原样保留。
//   Backend —— 计数从 企业档案快照 构造的完整 资料形 算出（绝不读静态档）；
//              admin+verified+active 才可编辑，member/pending/revoked/suspended
//              一律只读（行仍可进只读分区页）。分区表、算分区状态 与编辑页共用。

import 样式 from './公司档案编辑.module.css';
import { 次级页外壳, 返回栏, 滚动区, 页面大标题 } from '../组件/通用';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { 取公司档案 } from '../数据/公司档案';
import { 本公司键, 分区表, 算分区状态, 读资料 } from '../数据/公司主页资料';
import { 从BFF企业档案 } from '../数据/组织映射';
import { use应用状态 } from '../状态/应用状态';

export default function 公司档案编辑() {
  const { 数据源模式 } = use应用状态();
  return 数据源模式 === 'backend' ? <后端清单 /> : <Mock清单 />;
}

// ── Backend：权威快照清单 ───────────────────────────────────────────

function 后端清单() {
  const { 返回, 跳转 } = use导航();
  const { 状态 } = use应用状态();
  const 快照 = 状态.企业档案快照;
  // 可编辑写成一个局部布尔表达式，不引入权限框架（与分区编辑页同一口径）
  const 当前关系 = 状态.企业关系列表.find((条) => 条.affiliation_id === 状态.当前企业关系编号);
  const 可编辑 = 当前关系?.status === 'verified' &&
    当前关系?.role === 'admin' &&
    当前关系?.organization_status === 'active';

  return (
    <次级页外壳>
      <返回栏 返回={返回} />

      <页面大标题 标题="编辑品牌信息" />

      <滚动区 样式覆盖={{ padding: '16px 18px calc(24px + var(--安全区下))' }}>
        {!快照 ? (
          <div className={样式.分区名}>正在加载企业资料</div>
        ) : (
          <>
            {!可编辑 ? (
              <div
                className={样式.分区摘要}
                style={{ display: 'block', padding: '0 0 10px', color: 'var(--次要浅)' }}
              >
                仅企业管理员可修改
              </div>
            ) : null}
            {/* ── 分区清单：一行一个分区，点行进该分区的编辑页 ── */}
            <div className={样式.清单}>
              {分区表.map((分区, 序) => {
                // 计数从最新 BFF企业档案 构造的完整 资料形 算出；LOGO 用快照里的媒体 URL
                const 状 = 算分区状态(从BFF企业档案(快照), 快照.logo?.url ?? null)[分区.键];
                // 多项分区（基本信息 / 公司福利 / 公司相册）右侧给 N/总数，
                // 单项分区给摘要，没填过就给「去添加」
                const 用计数 = 分区.总数 > 1;
                return (
                  <button
                    key={分区.键}
                    className={`${样式.分区行} ${序 === 分区表.length - 1 ? 样式.末条 : ''} 可点`}
                    onClick={() => 跳转(路径.公司档案分区(分区.段))}
                  >
                    <span className={样式.分区名}>{分区.键}</span>
                    <span className={样式.分区右}>
                      {用计数 ? (
                        <span className={`${样式.分区计数} 等宽数字`}>
                          {状.已填}/{状.总数}
                        </span>
                      ) : 状.已填 > 0 ? (
                        <span className={`${样式.分区摘要} 单行`}>{状.摘要}</span>
                      ) : (
                        <span className={样式.去添加}>去添加</span>
                      )}
                      <span className={样式.尖括号}>›</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </滚动区>
    </次级页外壳>
  );
}

// ── Mock：静态档原型（原实现逐字保留）───────────────────────────────

function Mock清单() {
  const { 返回, 跳转 } = use导航();
  const { 状态 } = use应用状态();
  const 静态档 = 取公司档案(本公司键);
  const 资料 = 读资料(静态档, 状态.公司自述);
  const 分区状态 = 算分区状态(资料, 状态.公司LOGO);

  return (
    <次级页外壳>
      <返回栏 返回={返回} />

      <页面大标题 标题="编辑品牌信息" />

      <滚动区 样式覆盖={{ padding: '16px 18px calc(24px + var(--安全区下))' }}>
        {/* ── 分区清单：一行一个分区，点行进该分区的编辑页 ── */}
        <div className={样式.清单}>
          {分区表.map((分区, 序) => {
            const 状 = 分区状态[分区.键];
            // 多项分区（基本信息 / 公司福利 / 公司相册）右侧给 N/总数，
            // 单项分区给摘要，没填过就给「去添加」
            const 用计数 = 分区.总数 > 1;
            return (
              <button
                key={分区.键}
                className={`${样式.分区行} ${序 === 分区表.length - 1 ? 样式.末条 : ''} 可点`}
                onClick={() => 跳转(路径.公司档案分区(分区.段))}
              >
                <span className={样式.分区名}>{分区.键}</span>
                <span className={样式.分区右}>
                  {用计数 ? (
                    <span className={`${样式.分区计数} 等宽数字`}>
                      {状.已填}/{状.总数}
                    </span>
                  ) : 状.已填 > 0 ? (
                    <span className={`${样式.分区摘要} 单行`}>{状.摘要}</span>
                  ) : (
                    <span className={样式.去添加}>去添加</span>
                  )}
                  <span className={样式.尖括号}>›</span>
                </span>
              </button>
            );
          })}
        </div>
      </滚动区>
    </次级页外壳>
  );
}
