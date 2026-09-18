// 求职推荐卡：市场卡的最小提取（Plan 合同 D）—— 原 src/屏幕/看市场.tsx 内 市场卡 JSX
// 一比一移入，样式直接复用同一 看市场.module.css（不复制 CSS、不做设计调整）。
// 布局 = 原市场卡（2026-08-18 Jobright 骨架重排）：公司头行[公司字标 + 公司名/简介 +
// 右列(匹配分 + 薪资)] → 职位名 → 标签行 → 底行[发布人头像 + 发布人 + › + 去谈键/已委托]。
// 纯展示：只吃 props，不 import Context / fixture / HTTP / 路由，不派发、不请求、不算分 ——
// 真实/Mock 分值由 看市场 的薄连接包装经 use适配分 算好后传入 匹配分；委托与打开回调原样透传。
// 占位按合同 D 用显式 null 控制（合法 null ≠ 空串 ≠ 0）：匹配分 null → 卡片分数 的未知
// 占位（非空分含 0 照常画原适配环）；公司首字 null → 求职在谈卡同款中性空位（不渲染字标，
// 也就不按公司名命中静态公司标）；公司/简介/发布人 null → 「…未知」文字。空串不是 null，
// 市场页既有空段渲染逐字不变。头像加载失败回中性色块是展示本地状态，换 URL 清除。
import { useEffect, useState } from 'react';
import { 白卡, 公司字标 } from '../通用';
import { 谈判图标, 细对勾图标 } from '../图标';
import 样式 from '../../屏幕/看市场.module.css';
import 卡片分数 from './卡片分数';
import type { 求职推荐卡属性 } from './类型';

export default function 求职推荐卡({
  公司,
  公司简介,
  公司首字,
  公司图片URL,
  职位,
  薪资,
  标签,
  匹配分,
  发布人,
  发布人首字,
  发布人图片URL,
  发布人底色,
  发布人字色,
  已委托,
  已委托文字 = 'AI代理已接手',
  委托禁用,
  委托,
  打开,
  查看匹配分析,
  匹配理由,
}: 求职推荐卡属性) {
  // release/0.2.5 真实媒体：发布人头像接 avatar_url（Mock 档不设 → 原首字位不变）；
  // 加载失败回既有首字位，换 URL 清除失败状态。公司 Logo 经 公司字标 的显式图片分支。
  const [头像失败, 设头像失败] = useState(false);
  useEffect(() => {
    设头像失败(false);
  }, [发布人图片URL]);
  const 发布人图 = 发布人图片URL !== undefined && 发布人图片URL !== null && !头像失败;
  // 发布人以「公司 · 」开头只留身份段（如「企业直招」），不重复 —— 公司未知时没有
  // 前缀可剥，发布人原文照旧；发布人未知给占位文字。
  const 发布人文 = 发布人 === null
    ? '发布人未知'
    : 公司 !== null && 发布人.startsWith(`${公司} · `)
      ? 发布人.slice(公司.length + 3)
      : 发布人;
  // 右列（分数 + 薪资横排）：C3/Spec §3.1 给了 查看匹配分析 回调时分数环变独立
  // .分数入口、整列移出卡主体 button（不嵌套原生按钮），绝对定位落点与薪资像素不动；
  // 不传回调则在原位（卡主体内），市场卡面逐字不变。
  const 右列 = (
    <div className={样式.右列}>
      {查看匹配分析 ? (
        <button
          type="button"
          className={`${样式.分数入口} 可点`}
          aria-label="查看匹配分析"
          onClick={查看匹配分析}
        >
          {/* 未知分复用 卡片分数 的中性占位；非空分（含 0）内部就是原 适配环，
              与原市场卡同一份已知分视觉 */}
          <卡片分数 分={匹配分} />
        </button>
      ) : (
        <卡片分数 分={匹配分} />
      )}
      <span className={`${样式.薪资} 薪资体`}>{薪资.replace('-', '–')}</span>
    </div>
  );
  return (
    <div data-testid="求职推荐卡">
      <白卡 类名={样式.卡}>
        {/* 卡主体整块点进职位详情 */}
        <button className={`${样式.卡主体} 可点`} onClick={打开}>
          {/* 公司头行：字标 + 公司名/简介 + 右列[适配环 + 薪资]，与在谈卡一比一。
              Mock 岗不带 公司图片URL → 字标走原公司名静态分支；Backend 显式传（含 null）。
              图位尺寸/圆角原样，不给图片接线改样式。公司首字未知（合同 D null）时不渲染
              字标元素，改用与 求职在谈卡 相同的中性空位。 */}
          <div className={样式.公司头行}>
            {公司首字 !== null ? (
              <公司字标
                首字={公司首字}
                公司名={公司 ?? undefined}
                公司图片URL={公司图片URL}
                尺寸={34}
                圆角={10}
                字号={14}
              />
            ) : (
              <span className={样式.字标空位} role="img" aria-label="公司图片未知" />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className={`${样式.公司名} 单行`}>{公司 ?? '公司信息未知'}</div>
              <div className={`${样式.公司简介} 单行`}>{公司简介 ?? '公司简介未知'}</div>
            </div>
            {查看匹配分析 ? null : 右列}
          </div>

          {/* 职位名 */}
          <div className={`${样式.职位名} 单行`}>{职位}</div>

          {/* 标签行：岗位属性，与在谈卡同一口径（城市 · 区 / N 薪 / 办公方式 / 到岗） */}
          <div className={样式.标签行}>
            {标签.map((标签) => (
              <span key={标签} className={样式.标签}>
                {标签}
              </span>
            ))}
          </div>

          {/* 匹配理由区（Spec §10.3）：仅助手结果显式传入才渲染，市场页不传零变化。
              勾选标记是已返回理由的展示，不是可选复选框；区域插在标签下方、
              底部发布人/操作区分割线上方，只增本区高度不动原内容。 */}
          {匹配理由 !== undefined ? (
            匹配理由.length === 0 ? (
              <div className={样式.理由区}>
                <span className={样式.理由说明}>暂无推荐理由</span>
              </div>
            ) : (
              <div className={样式.理由区}>
                {匹配理由.map((理由, 序) =>
                  理由.已匹配 ? (
                    <span key={`${序}-${理由.文案}`} className={样式.理由项}>
                      <细对勾图标 />
                      {理由.文案}
                    </span>
                  ) : (
                    <span key={`${序}-${理由.文案}`} className={样式.理由说明}>
                      {理由.文案}
                    </span>
                  ),
                )}
              </div>
            )
          ) : null}
        </button>

        {/* 底行 —— 在谈卡在这个位置是「阶段 + 下一步」，市场卡是「发布人 + 去谈」。
            公司名头行已交代过，发布人若以公司名开头就只留身份段（如「企业直招」），不重复 */}
        <div className={样式.底行}>
          <span
            className={样式.发布人头像}
            style={{ background: 发布人底色, color: 发布人字色 }}
          >
            {发布人图 ? (
              <img
                src={发布人图片URL ?? undefined}
                alt=""
                onError={() => 设头像失败(true)}
                style={{
                  width: '100%', height: '100%', objectFit: 'cover',
                  display: 'block', borderRadius: 'inherit',
                }}
              />
            ) : (
              发布人首字 ?? ''
            )}
          </span>
          <span className={`${样式.发布人} 单行`}>{发布人文}</span>

          <button className={`${样式.尖括号} 可点`} onClick={打开} aria-label="查看职位详情">
            ›
          </button>

          {已委托 ? (
            // 一切委托态（含开案成功）都是不可点的状态标 —— 成功槽不再是「查看进展」，
            // 也不绑定任何 Case 导航；看职位详情仍走卡上原来的 › 入口（Spec §7.1）
            <span className={样式.已委托}>
              <span className={样式.已委托文字}>{已委托文字}</span>
            </span>
          ) : (
            <button
              className={`${样式.去谈键} 可点`}
              disabled={委托禁用}
              onClick={委托}
            >
              <谈判图标 />
              <span className={样式.去谈文字}>让AI代理去谈</span>
            </button>
          )}
        </div>

        {/* 查看匹配分析独立入口模式下，右列（分数入口 + 薪资）挂白卡 div（.卡 是绝对
            定位锚点），视觉与原位完全一致，只是不再嵌在卡主体 button 里 */}
        {查看匹配分析 ? 右列 : null}
      </白卡>
    </div>
  );
}
