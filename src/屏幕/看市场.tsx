// A14 职位Tab·看市场 —— 自己刷市场上的职位，每张卡上带「让AI代理去谈」。
//
// 与「在谈」共用顶栏（意向左右平铺切换 + 在谈/看市场子视图）和代理横幅，
// 所以这两屏切换时顶部不动，只有列表在换 —— 这是设计稿里的硬要求。
//
// 卡片结构：职位名 + 公司行 + 右侧薪资/适配分 → 标签行 → 分隔线
//          → 发布人头像行 + 「让AI代理去谈」按钮。

import 样式 from './看市场.module.css';
import 顶部意向栏 from './顶部意向栏';
import { 主页外壳, 代理横幅, 滚动区, 白卡 } from '../组件/通用';
import { 谈判图标 } from '../组件/图标';
import { use应用状态 } from '../状态/应用状态';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { 市场列表 } from '../数据/模拟数据';
import type { 市场职位 } from '../数据/类型';

export default function 看市场() {
  const { 状态, 派发 } = use应用状态();
  // 标注意见 #9：切意向后市场职位流跟着变
  const 本意向市场 = 市场列表.filter((岗) => 岗.意向 === 状态.当前意向);
  const { 跳转 } = use导航();

  // 需要你协调的条数从在谈列表实时算，横幅文案与「在谈」子视图保持一致，
  // 免得同一句话在两个子视图里给出不同数字。
  const 待协调数 = 状态.在谈列表.filter((单) => 单.需要你).length;

  return (
    <主页外壳>
      <顶部意向栏 />

      <代理横幅
        前文="初筛与前几轮我已谈完，"
        强调={待协调数 > 0 ? `${待协调数} 个职位需要你协调` : '暂时没有需要你介入的'}
        按下={() => 跳转(路径.问AI代理)}
      />

      {/* 横幅与列表之间的固定留白（RN 里是一个 height:10 的占位 View） */}
      <div style={{ height: 10, flex: 'none' }} />

      <滚动区>
        <div className={样式.列表}>
          {本意向市场.map((岗) => (
            <市场卡
              key={岗.编号}
              岗={岗}
              已委托={状态.已委托.includes(岗.编号)}
              委托={() => 派发({ 型: '委托入谈', 岗 })}
              按下={() => 跳转(路径.职位详情(岗.编号))}
            />
          ))}
        </div>
      </滚动区>
    </主页外壳>
  );
}

/** 单张市场职位卡。
 *  这里刻意不用「白卡 按下=…」整卡可点：卡内还有两个自己的按钮（› 和 去谈键），
 *  HTML 里 button 不能嵌套 button，所以外层用不可点的白卡，卡主体单独做一个按钮。 */
function 市场卡({
  岗,
  已委托,
  委托,
  按下,
}: {
  岗: 市场职位;
  已委托: boolean;
  委托: () => void;
  按下: () => void;
}) {
  return (
    <白卡 类名={样式.卡}>
      {/* 卡主体（职位名 / 公司行 / 薪资 / 适配分 / 标签）整块点进职位详情 */}
      <button className={`${样式.卡主体} 可点`} onClick={按下}>
        <div className={样式.头行}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className={`${样式.职位名} 单行`}>{岗.职位}</div>
            <div className={`${样式.公司行} 单行`}>{岗.公司行}</div>
          </div>
          <div className={样式.右侧列}>
            <div className={`${样式.薪资} 薪资体`}>{岗.薪资}</div>
            <div className={样式.适配}>
              适配 <b className={`${样式.适配分} 等宽数字`}>{岗.适配分}</b>
            </div>
          </div>
        </div>

        <div className={样式.标签行}>
          {岗.标签.map((标签) => (
            <span key={标签} className={样式.标签}>
              {标签}
            </span>
          ))}
        </div>
      </button>

      {/* 底行：发布人（企业直招 or 猎头）+ 委托按钮 */}
      <div className={样式.底行}>
        <span
          className={样式.发布人头像}
          style={{ background: 岗.发布人底色, color: 岗.发布人字色 }}
        >
          {岗.发布人首字}
        </span>
        <span className={`${样式.发布人} 单行`}>{岗.发布人}</span>

        <button className={`${样式.尖括号} 可点`} onClick={按下} aria-label="查看职位详情">
          ›
        </button>

        {已委托 ? (
          // 委托后按钮换成不可点的状态标（代理已接手，不需要再点第二次）
          <span className={样式.已委托}>
            <span className={样式.已委托文字}>AI代理已接手</span>
          </span>
        ) : (
          <button className={`${样式.去谈键} 可点`} onClick={委托}>
            <谈判图标 />
            <span className={样式.去谈文字}>让AI代理去谈</span>
          </button>
        )}
      </div>
    </白卡>
  );
}
