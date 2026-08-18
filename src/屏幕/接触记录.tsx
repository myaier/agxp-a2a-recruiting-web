// 谁接触过我 —— 求职端「设置 › 隐私与可见性 › 谁接触过我」（/visitors）。
//
// 这一屏是双盲机制的透明面：你看不见对方的人，但你有权知道「哪家公司、在什么时候、
// 做了什么动作」。所以列的是企业 + 动作 + 时间，绝不出现 HR 姓名、职务、头像 ——
// 招聘方实名指的是「公司与对接人对候选人可见」这一层，不等于把每一次浏览都挂上人名，
// 那会把浏览这个动作变成社交压力。同理也不显示对方看了多久、看了哪几段。

import 样式 from './我的功能页.module.css';
import 本屏样式 from './接触记录.module.css';
import { 次级页外壳, 返回栏, 滚动区 } from '../组件/通用';
import { use导航 } from '../路由/导航钩子';
import { 接触记录列表 } from '../数据/模拟数据';
import type { 接触记录 as 接触记录条 } from '../数据/类型';

/** 动作 → 小标配色。三档：只是看画像 / 真的发起接触 / 递简历后回看 */
function 取动作类名(动作: 接触记录条['动作']): string {
  if (动作 === '发起接触') return 本屏样式.动作发起接触;
  if (动作 === '递交简历后查看') return 本屏样式.动作看简历;
  return 本屏样式.动作看画像;
}

export default function 接触记录() {
  const { 返回 } = use导航();

  return (
    <次级页外壳>
      <返回栏 返回={返回} 标题="谁接触过我" 副标题="只显示企业与动作" />

      <滚动区 样式覆盖={{ padding: '14px 18px 24px' }}>
        <div className={样式.说明条}>
          这里
          <span className={样式.说明强调}>不显示任何真人身份</span>
          ——不出现 HR 姓名、职务或头像，也不显示对方看了多久、看了哪几段。
          你只需要知道是哪家公司、在什么时候做了什么。
        </div>

        {接触记录列表.length === 0 ? (
          <div className={样式.空态}>
            <div className={样式.空态图}>◎</div>
            <div className={样式.空态标题}>最近还没有企业接触过你</div>
            <div className={样式.空态说明}>
              代理会持续替你寻访；有人来看时，这里会记下企业与动作。
            </div>
          </div>
        ) : (
          <div className={样式.卡}>
            {接触记录列表.map((条) => (
              <div className={样式.行} key={条.编号}>
                <span className={样式.字标}>{条.公司首字}</span>
                <span className={样式.行文字组}>
                  <span className={本屏样式.头行}>
                    <span className={`${本屏样式.公司} 单行`}>{条.公司}</span>
                    <span className={`${本屏样式.动作标} ${取动作类名(条.动作)}`}>
                      {条.动作}
                    </span>
                  </span>
                  <span className={本屏样式.时间}>{条.时间}</span>
                </span>
              </div>
            ))}
          </div>
        )}

        <div className={样式.版本}>
          屏蔽名单里的公司不会出现在这里，它们也看不到你。
          <br />
          记录保留 90 天。
        </div>
      </滚动区>
    </次级页外壳>
  );
}
