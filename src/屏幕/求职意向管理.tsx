// A20 求职意向管理（想找什么工作？）
//
// 结构：返回栏 → 大标题 → 意向卡（绿竖条 + 标题 + N/5 配额 + 意向行列表 + 添加按钮）
// → 设置卡（求职状态 / 底线与条件）。
//
// 关键口径：底线只有 AI 代理知道，永不披露 —— 「底线与条件」行的「AI代理可见」
// 徽标要一直挂着，提醒用户这条信息的可见边界。

import { useState } from 'react';
import 样式 from './求职意向管理.module.css';
import { 次级页外壳, 返回栏, 页面大标题, 滚动区, 设置行 } from '../组件/通用';
import { use应用状态 } from '../状态/应用状态';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';

/** 求职意向配额上限：产品规则限定一个账号最多 5 个意向 */
const 意向配额上限 = 5;

/** 可循环切换的求职状态。点「求职状态」行就在这几档里轮转，不另开选择页。 */
const 求职状态档位 = ['在职 · 看好机会', '在职 · 随便看看', '离职 · 尽快到岗'];

export default function 求职意向管理() {
  const { 状态 } = use应用状态();
  const { 跳转, 返回 } = use导航();

  // 求职状态只是本屏的展示态，没有跨屏联动需求，用本地 state 即可
  const [求职状态下标, 设求职状态下标] = useState(0);
  return (
    <次级页外壳>
      <返回栏 返回={返回} />

      <页面大标题 标题="想找什么工作？" />

      <滚动区>
        <div className={样式.内容}>
          {/* ── 意向卡 ── */}
          <div className={样式.卡}>
            <div className={样式.卡头}>
              <span className={样式.绿竖条} />
              <span className={样式.卡标题}>求职意向</span>
              <span className={`${样式.配额} 等宽数字`}>
                <span className={样式.配额已用}>{状态.求职意向表.length}</span>/{意向配额上限}
              </span>
            </div>

            {状态.求职意向表.map((意向) => (
              <button
                key={意向.编号}
                className={`${样式.意向行} 可点`}
                onClick={() => 跳转(路径.编辑意向(意向.编号))}
              >
                <span className={样式.意向文字组}>
                  <span className={`${样式.意向标题} 单行`}>{意向.标题}</span>
                  <span className={`${样式.意向说明} 单行`}>{意向.说明}</span>
                </span>
                <span className={样式.意向改}>✎</span>
              </button>
            ))}

            {/* 配额用满就不再放添加入口，避免点进表单才被拒 */}
            {状态.求职意向表.length < 意向配额上限 ? (
              <button
                className={`${样式.添加意向} 可点`}
                onClick={() => 跳转(路径.添加意向)}
              >
                <span className={样式.添加圆}>
                  <span className={样式.添加符}>＋</span>
                </span>
                <span className={样式.添加文字}>添加求职意向</span>
              </button>
            ) : (
              <div className={样式.配额已满}>意向已达 {意向配额上限} 个上限，先删一个再加。</div>
            )}
          </div>

          {/* ── 设置卡：求职状态 + 底线与条件 ── */}
          <div className={`${样式.卡} ${样式.设置卡}`}>
            <设置行
              标题="求职状态"
              值={求职状态档位[求职状态下标]}
              按下={() => 设求职状态下标((旧) => (旧 + 1) % 求职状态档位.length)}
            />
            <设置行
              标题="底线与条件"
              徽标="AI代理可见"
              值="按意向分设"
              按下={() => 跳转(路径.规则库)}
              无分隔线
            />
          </div>
        </div>
      </滚动区>
    </次级页外壳>
  );
}
