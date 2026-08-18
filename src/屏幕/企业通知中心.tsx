// 企业通知中心 —— 企业「我的」右上铃铛进来。与求职端通知中心同款版式
// （样式直接复用 我的功能页.module.css），数据走企业切片。
// 只放系统类通知（用户定 2026-08-19）：候选进展与卡点在人才 Tab 与消息里看。

import 样式 from './我的功能页.module.css';
import { 次级页外壳, 返回栏, 滚动区 } from '../组件/通用';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import type { 通知条 } from '../数据/类型';

const 类型样式: Record<通知条['类型'], { 字: string; 类: string }> = {
  需要你: { 字: '!', 类: 样式.图标需要你 },
  进展: { 字: '↑', 类: 样式.图标进展 },
  新机会: { 字: '✦', 类: 样式.图标新机会 },
  系统: { 字: 'i', 类: 样式.图标系统 },
};

const 分组顺序: 通知条['分组'][] = ['今天', '本周', '更早'];

export default function 企业通知中心() {
  const { 返回, 跳转 } = use导航();
  const { 状态, 派发 } = use应用状态();
  const 未读数 = 状态.企业通知列表.filter((条) => !条.已读).length;

  const 打开 = (条: 通知条) => {
    if (!条.已读) 派发({ 型: '企业读通知', 编号: 条.编号 });
    if (条.目标) 跳转(条.目标);
  };

  return (
    <次级页外壳>
      <返回栏
        返回={返回}
        标题="通知"
        副标题={未读数 > 0 ? `${未读数} 条未读` : '全部已读'}
        右侧={
          <button
            className={`${样式.全读键} ${未读数 === 0 ? 样式.全读键灰 : ''} ${未读数 > 0 ? '可点' : ''}`}
            onClick={() => 未读数 > 0 && 派发({ 型: '企业通知全读' })}
            disabled={未读数 === 0}
          >
            全部已读
          </button>
        }
      />

      <滚动区 样式覆盖={{ padding: '14px 18px 24px' }}>
        {分组顺序.map((分组) => {
          const 本组 = 状态.企业通知列表.filter((条) => 条.分组 === 分组);
          if (本组.length === 0) return null;
          return (
            <div key={分组}>
              <div className={`${样式.组标} ${分组 === '今天' ? '' : 样式.组标间距}`}>
                {分组}
              </div>
              {本组.map((条) => {
                const 图 = 类型样式[条.类型];
                return (
                  <button
                    key={条.编号}
                    className={`${样式.通知卡} ${条.已读 ? '' : 样式.通知未读} 可点`}
                    onClick={() => 打开(条)}
                  >
                    <span className={`${样式.通知图标} ${图.类}`}>{图.字}</span>
                    <span className={样式.通知主体}>
                      <span className={样式.通知头行}>
                        <span className={`${样式.通知标题} 单行`}>{条.标题}</span>
                        <span className={样式.通知时间}>{条.时间}</span>
                      </span>
                      <span className={样式.通知正文}>{条.正文}</span>
                      {条.目标 ? <span className={样式.通知去处}>点开处理 ›</span> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </滚动区>
    </次级页外壳>
  );
}
