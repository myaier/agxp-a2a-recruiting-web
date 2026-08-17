// A6·L 在谈·档案卡版 —— 求职端定稿首页。
//
// 卡片结构：公司头行（字标 + 公司名 + 简介 + 薪资）→ 职位名 17px/800 → 标签行
// → 分隔线 → 阶段标签 + 轮次 → 下一步文案 + › → 辅助文案 或 分歧对比轴。
//
// 两条交互硬规矩（来自设计稿）：
//   · 等你行动的卡红描边并置顶
//   · 卡上不放决策按钮，决策一律进详情页做

import 样式 from './在谈首页.module.css';
import 顶部意向栏 from './顶部意向栏';
import { 主页外壳, 代理横幅, 阶段标签, 分歧轴, 滚动区, 白卡, 公司字标 } from '../组件/通用';
import { use应用状态 } from '../状态/应用状态';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import type { 在谈单 } from '../数据/类型';

export default function 在谈首页() {
  const { 状态 } = use应用状态();
  const { 跳转 } = use导航();

  // 等你行动的卡置顶（红描边），其余保持原顺序
  const 排序后 = [...状态.在谈列表].sort((甲, 乙) => Number(乙.需要你) - Number(甲.需要你));
  const 待协调数 = 状态.在谈列表.filter((单) => 单.需要你).length;

  return (
    <主页外壳>
      <顶部意向栏 />

      <代理横幅
        前文="初筛与前几轮我已谈完，"
        强调={待协调数 > 0 ? `${待协调数} 个职位需要你协调` : '暂时没有需要你介入的'}
        按下={() => 跳转(路径.问AI代理)}
      />

      <div style={{ height: 10, flex: 'none' }} />

      <滚动区>
        <div className={样式.列表}>
          {排序后.length === 0 ? (
            <div className={样式.空态}>
              这个意向下暂时没有在谈职位。
              <br />
              去「看市场」挑几个，让AI代理替你去谈。
            </div>
          ) : (
            排序后.map((单) => (
              <在谈卡 key={单.编号} 单={单} 按下={() => 跳转(路径.在谈详情(单.编号))} />
            ))
          )}
        </div>
      </滚动区>
    </主页外壳>
  );
}

function 在谈卡({ 单, 按下 }: { 单: 在谈单; 按下: () => void }) {
  return (
    <白卡 按下={按下} 红描边={单.需要你} 类名={样式.卡}>
      {/* 公司头行 */}
      <div className={样式.公司头行}>
        <公司字标 首字={单.公司首字} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className={`${样式.公司名} 单行`}>{单.公司}</div>
          <div className={`${样式.公司简介} 单行`}>{单.公司简介}</div>
        </div>
        <span className={`${样式.薪资} 等宽数字`}>{单.薪资}</span>
      </div>

      {/* 职位名 */}
      <div className={`${样式.职位名} 单行`}>{单.职位}</div>

      {/* 标签行 */}
      <div className={样式.标签行}>
        {单.标签.map((标签) => (
          <span key={标签} className={样式.标签}>
            {标签}
          </span>
        ))}
      </div>

      {/* 阶段区 */}
      <div className={样式.阶段区}>
        <div className={样式.阶段头}>
          <阶段标签 阶段={单.阶段} />
          {单.需要你 ? <span className={样式.需要你胶囊}>需要你</span> : null}
          <span className={样式.轮次}>{单.轮次}</span>
        </div>

        <div className={样式.下一步行}>
          <div className={`${样式.下一步} 单行`}>{单.下一步}</div>
          <span style={{ color: 'var(--最弱)', fontSize: 16, fontWeight: 300 }}>›</span>
        </div>

        {单.分歧 ? (
          <分歧轴 我方={单.分歧.我方} 差值={单.分歧.差值} 对方={单.分歧.对方} />
        ) : 单.辅助文案 ? (
          <div className={`${样式.辅助文案} 单行`}>{单.辅助文案}</div>
        ) : null}
      </div>
    </白卡>
  );
}
