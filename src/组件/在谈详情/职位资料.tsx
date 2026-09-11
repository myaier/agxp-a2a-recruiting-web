// 职位资料 —— 在谈详情第二 Tab（资料）的共用正文：岗位摘要 → 匹配分析 → 职位详情 →
// 职位要求 → 公司 → 对接人（spec §3.3 阅读顺序），Mock / Backend 同一版式同一份 JSX。
//
// 纯展示：不读 Context/fixture/localStorage/环境变量/raw DTO，不请求数据、不推导动作
// 权限、不拼路由 —— 公司导航坐标由调用方以 公司详情（详情按钮）传入，本组件只按契约
// A 的按钮栅栏决定可否触发（执行 与 禁用说明 同时合法才可点，否则真实 disabled）。
//
// 缺失口径（契约 B）：null = 数据源未提供 → 原位显示缺失（「—」+ 可访问缺失说明，或
// 「XX缺失」一行）；空数组 = 提供了但一条没有 → 「暂无…」；分析分 0 是合法数值，照常
// 渲染。有分有对齐证据才复用既有 匹配分析块（它自带标题与分数环），缺任一就在同一
// 分析区给缺失说明，绝不把伪造的 0 分/空行喂给它。无合法公司导航坐标时公司区与导航
// 入口位置照旧保留，入口禁用并就地解释 —— 本组件绝不从公司名文本推 opaque ID。

import { 匹配分析块 } from '../匹配分析块';
import 样式 from './职位资料.module.css';
import type { 详情按钮, 职位资料信息 } from './类型';

/** 缺值占位：有值原样，缺失显示「—」并带可访问的缺失说明（数值 0 不经这里）。 */
function 值位({ 值, 说明, 类名 }: { 值: string | null; 说明: string; 类名?: string }) {
  return 值 !== null ? (
    <span className={类名}>{值}</span>
  ) : (
    <span className={`${样式.缺失值} ${类名 ?? ''}`} title={说明}>
      —
    </span>
  );
}

export function 职位资料({ 信息, 公司详情 }: { 信息: 职位资料信息; 公司详情: 详情按钮 }) {
  const { 摘要, 分析, 职位详情, 职位要求, 公司, 对接人, 接口缺口说明 } = 信息;
  // 契约 A 的按钮栅栏：只有 执行 与 禁用说明 同时合法才可触发
  const 公司导航 =
    公司详情.执行 !== null && 公司详情.禁用说明 === null ? { 执行: 公司详情.执行 } : null;
  // NaN 不是合法分数（与 详情顶栏 同一验收规则）：按缺失处理，绝不把 NaN 印到屏上；
  // 0 是合法分数，照常渲染
  const 分析分 = 分析.分 !== null && !Number.isNaN(分析.分) ? 分析.分 : null;

  return (
    <div className={样式.资料列}>
      {接口缺口说明 !== null ? <p className={样式.缺口说明}>{接口缺口说明}</p> : null}

      {/* 1 匹配分析：有分有证据走共用分析块；缺分或缺证据在同区给缺失说明 */}
      <section className={样式.区块}>
        {分析分 !== null && 分析.行们 !== null && 分析.行们.length > 0 ? (
          <匹配分析块 分={分析分} 行们={[...分析.行们]} 分析={分析.文案} />
        ) : (
          <>
            <div className={样式.区块标题}>匹配度分析</div>
            <p className={样式.区块缺失}>匹配分析缺失</p>
          </>
        )}
      </section>

      {/* 2 职位详情：岗位摘要（冻结四事实）+ JD 正文；缺失也保留标题与正文位置 */}
      <section className={样式.区块}>
        <div className={样式.区块标题}>职位详情</div>
        {摘要 === null ? (
          <p className={样式.区块缺失}>岗位摘要缺失</p>
        ) : (
          <div className={样式.元表}>
            <span className={样式.元行}>
              <span className={样式.元标}>职位</span>
              <值位 值={摘要.职位} 说明="职位名缺失" 类名={样式.元值} />
            </span>
            <span className={样式.元行}>
              <span className={样式.元标}>城市</span>
              <值位 值={摘要.城市} 说明="城市缺失" 类名={样式.元值} />
            </span>
            <span className={样式.元行}>
              <span className={样式.元标}>薪资</span>
              <值位 值={摘要.薪资} 说明="薪资缺失" 类名={样式.元值} />
            </span>
            <span className={样式.元行}>
              <span className={样式.元标}>技能</span>
              <span className={样式.元值}>
                {摘要.技能.length > 0 ? (
                  <span className={样式.标签行}>
                    {摘要.技能.map((技) => (
                      <span key={技} className={样式.标签}>
                        {技}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className={样式.暂无}>暂无技能</span>
                )}
              </span>
            </span>
          </div>
        )}
        {职位详情 === null ? (
          <p className={样式.区块缺失}>职位详情缺失</p>
        ) : 职位详情.length === 0 ? (
          <p className={样式.暂无}>暂无职位详情</p>
        ) : (
          职位详情.map((行) => (
            <p key={行} className={样式.正文}>
              {行}
            </p>
          ))
        )}
      </section>

      {/* 3 职位要求：独立标题与正文位置（与 职位详情 并列，都是 JD 的组成部分） */}
      <section className={样式.区块}>
        <div className={样式.区块标题}>职位要求</div>
        {职位要求 === null ? (
          <p className={样式.区块缺失}>职位要求缺失</p>
        ) : 职位要求.length === 0 ? (
          <p className={样式.暂无}>暂无职位要求</p>
        ) : (
          职位要求.map((行) => (
            <p key={行} className={样式.正文}>
              {行}
            </p>
          ))
        )}
      </section>

      {/* 4 公司：图片/名称/介绍/五元行/标签区全部原位；导航入口缺坐标时禁用并解释 */}
      <section className={样式.区块}>
        <div className={样式.区块标题}>公司信息</div>
        <button
          type="button"
          className={`${样式.公司头行} ${公司导航 !== null ? '可点' : ''}`}
          disabled={公司导航 === null}
          onClick={公司导航 === null ? undefined : 公司导航.执行}
        >
          {公司.字标 !== null ? (
            <span className={样式.标志}>{公司.字标}</span>
          ) : (
            <span className={`${样式.标志} ${样式.标志空}`} role="img" aria-label="公司标志缺失" />
          )}
          <span
            className={`${样式.公司名} ${公司.名称 === null ? 样式.缺失值 : ''} 单行`}
            title={公司.名称 === null ? '公司名称缺失' : undefined}
          >
            {公司.名称 ?? '—'}
          </span>
          {公司导航 !== null ? <span className={样式.尖括号}>›</span> : null}
        </button>
        {公司详情.禁用说明 !== null ? (
          <p className={样式.入口说明}>{公司详情.禁用说明}</p>
        ) : null}
        {公司.简介 === null ? (
          <p className={样式.区块缺失}>公司介绍缺失</p>
        ) : 公司.简介 === '' ? (
          <p className={样式.暂无}>暂无公司介绍</p>
        ) : (
          <p className={样式.介绍段}>{公司.简介}</p>
        )}
        <div className={样式.元表}>
          {公司.元行.map((行) => (
            <span key={行.标签} className={样式.元行}>
              <span className={样式.元标}>{行.标签}</span>
              <值位 值={行.值} 说明={`${行.标签}缺失`} 类名={`${样式.元值} 单行`} />
            </span>
          ))}
        </div>
        {公司.标签 === null ? (
          <p className={样式.区块缺失}>公司标签缺失</p>
        ) : 公司.标签.length === 0 ? (
          <p className={样式.暂无}>暂无公司标签</p>
        ) : (
          <div className={样式.标签行}>
            {公司.标签.map((标签) => (
              <span key={标签} className={样式.标签}>
                {标签}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* 5 对接人：头像/姓名/职务位置保留；缺失不生成姓名/首字，不冒充已披露 */}
      <section className={样式.区块}>
        <div className={样式.区块标题}>对接人</div>
        <div className={样式.对接人行}>
          {对接人.字标 !== null ? (
            <span className={样式.头像}>
              <span className={样式.头像字}>{对接人.字标}</span>
            </span>
          ) : (
            <span className={`${样式.头像} ${样式.头像空}`} role="img" aria-label="对接人头像缺失" />
          )}
          <div className={样式.对接人文本}>
            <div className={样式.对接人名}>
              <值位 值={对接人.姓名} 说明="对接人姓名缺失" />
              {对接人.姓名 !== null && 公司.名称 !== null ? ` · ${公司.名称}` : null}
              {' '}
              <值位 值={对接人.职务} 说明="对接人职务缺失" 类名={样式.对接人职务} />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
