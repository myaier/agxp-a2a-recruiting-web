// A18 职位详情 —— 从「看市场」点职位卡进来，是用户做选择之前看到的岗位全貌页。
//
// 这一屏的产品重点全在底部那两个按钮上，它们通向两条完全不同的路径：
//   · 直接聊      —— 双方互相看到身份，AI代理退成旁听，继续替你筛别的岗；
//   · 让AI代理去谈 —— 走匿名初筛，身份先不披露，委托完就回列表。
// 所以按钮下面那行小字说明是功能性文案，不是装饰，不能删。
//
// 内容顺序（照 storyboard A18）：职位名 + 薪资 → 标签 → 发布人 → JD → 公司 → 代理预估。

import { useState } from 'react';
import { useParams } from 'react-router-dom';
import 样式 from './职位详情.module.css';
import { 次级页外壳, 返回栏, 滚动区, 公司字标 } from '../组件/通用';
import { 谈判图标, 小人像图标 } from '../组件/图标';
import { 市场列表, 市场职位详情 } from '../数据/模拟数据';
import { use应用状态 } from '../状态/应用状态';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';

export default function 职位详情() {
  const { id: 编号 } = useParams<{ id: string }>();
  const { 状态, 派发 } = use应用状态();
  const { 跳转, 返回, 替换跳转 } = use导航();

  // 收藏（☆ / ★）只是这一屏的视觉开关，不影响任何业务判断，所以放本地态、不进全局 store
  const [已收藏, 设已收藏] = useState(false);
  // 「⋯」拉起的更多操作抽屉是否展开
  const [抽屉展开, 设抽屉展开] = useState(false);

  // 按路由参数取岗位；直接输 URL 或参数丢失时退回第一条，
  // 保证这一屏永远有内容可渲染，不会白屏。
  const 岗 = 市场列表.find((条) => 条.编号 === 编号) ?? 市场列表[0];
  const 详 = 市场职位详情;
  // 已经委托过的岗位，主按钮换成「AI代理已接手」，和「看市场」卡片上的状态标口径一致
  const 已委托 = 状态.已委托.includes(岗.编号);

  return (
    <次级页外壳>
      <返回栏
        返回={返回}
        右侧={
          <div className={样式.工具组}>
            <button
              className={`${样式.工具符} ${已收藏 ? 样式.已收藏 : ''} 可点`}
              onClick={() => 设已收藏((旧) => !旧)}
              aria-label={已收藏 ? '取消收藏' : '收藏'}
            >
              {已收藏 ? '★' : '☆'}
            </button>
            <button
              className={`${样式.工具符} 可点`}
              onClick={() => 设抽屉展开(true)}
              aria-label="更多操作"
            >
              ⋯
            </button>
          </div>
        }
      />

      <滚动区>
        <div className={样式.内容}>
          {/* 职位名 + 薪资 + 标签：baseline 对齐，让 21px 的职位名和 16px 的薪资底线齐平 */}
          <div>
            <div className={样式.标题行}>
              <div className={样式.职位名}>{岗.职位}</div>
              <div className={`${样式.薪资} 等宽数字`}>{岗.薪资}</div>
            </div>
            <div className={样式.标签行}>
              {详.标签.map((标签) => (
                <span key={标签} className={样式.标签}>
                  {标签}
                </span>
              ))}
            </div>
          </div>

          {/* 发布人：是企业招聘负责人还是猎头，决定了用户愿不愿意直接聊，所以排在 JD 之前 */}
          <div className={`${样式.卡} ${样式.发布人卡}`}>
            <span className={样式.发布人头像}>{详.发布人.首字}</span>
            <div className={样式.发布人文字区}>
              <div className={样式.发布人名}>
                {详.发布人.姓名} · {详.发布人.公司}{' '}
                <span className={样式.发布人职务}>{详.发布人.职务}</span>
              </div>
              <div className={样式.发布人备注}>{详.发布人.备注}</div>
            </div>
          </div>

          {/* JD：职位详情 + 职位要求两段合在一张卡里，中间用小标题分隔 */}
          <div className={样式.卡}>
            <div className={样式.卡标题}>职位详情</div>
            {详.职位详情.map((行) => (
              <div key={行} className={样式.卡正文}>
                {行}
              </div>
            ))}
            <div className={样式.卡小标题}>职位要求</div>
            {详.职位要求.map((行) => (
              <div key={行} className={样式.卡正文}>
                {行}
              </div>
            ))}
          </div>

          {/* 公司：黑底橄榄字的字标是品牌向的定稿样式，不走 公司字标 的白底默认值 */}
          <div className={`${样式.卡} ${样式.公司卡}`}>
            <公司字标
              首字={详.公司.首字}
              尺寸={40}
              圆角={14}
              底色="var(--墨)"
              字色="var(--橄榄)"
              描边={false}
              字号={17}
            />
            <div className={样式.公司文字区}>
              <div className={样式.公司名}>{详.公司.名称}</div>
              <div className={样式.公司简介}>{详.公司.简介}</div>
            </div>
            <span className={样式.尖括号}>›</span>
          </div>

          {/* 代理预估：淡绿描边把它和上面几张中性卡区分开，表示这是「你的代理说的」而不是岗位自带信息 */}
          <div className={`${样式.卡} ${样式.预估卡}`}>
            <div className={样式.预估头}>
              <div className={样式.预估标题}>你的AI代理预估</div>
              <div className={`${样式.预估分} 等宽数字`}>{详.代理预估.分数}</div>
            </div>
            <div className={样式.预估说明}>{详.代理预估.说明}</div>

            <div className={样式.档位条}>
              {详.代理预估.档位.map((档, 序) => (
                <span key={档} className={取档位块类名(序, 详.代理预估.当前档)} />
              ))}
            </div>
            <div className={样式.档位名行}>
              {详.代理预估.档位.map((档, 序) => (
                <span
                  key={档}
                  className={`${样式.档位名} ${序 === 详.代理预估.当前档 ? 样式.档位名当前 : ''}`}
                >
                  {档}
                </span>
              ))}
            </div>
          </div>
        </div>
      </滚动区>

      {/* 底部决策区：固定不滚，双按钮宽度 1 : 1.3 —— 主路径（让代理去谈）刻意做得更宽 */}
      <div className={样式.按钮区}>
        <div className={样式.按钮行}>
          <button
            className={`${样式.次按钮} 可点`}
            onClick={() => 跳转(路径.直聊会话)}
          >
            <小人像图标 />
            <span className={样式.次按钮文字}>直接聊</span>
          </button>
          <button
            className={`${样式.主按钮} ${已委托 ? 样式.已委托态 : ''} 可点`}
            onClick={() => {
              // 标注意见 #8：点了不是回列表，而是这个岗位当场变成一个在谈单 ——
              // 代理立刻主动打招呼，页面原地切到在谈详情（replace，后退不回本页），
              // 首页在谈列表里同时多出这张卡
              派发({ 型: '委托入谈', 岗 });
              替换跳转(路径.在谈详情(岗.编号));
            }}
          >
            <谈判图标 尺寸={15} 色={已委托 ? 'var(--深绿)' : undefined} />
            <span className={样式.主按钮文字}>{已委托 ? 'AI代理已接手' : '让AI代理去谈'}</span>
          </button>
        </div>
        <div className={样式.底部说明}>{详.底部说明}</div>
      </div>

      {/* 「⋯」更多操作抽屉：点遮罩或「取消」关闭；点「不感兴趣」直接退出这一屏 */}
      {抽屉展开 ? (
        <div className={样式.遮罩} onClick={() => 设抽屉展开(false)}>
          <div className={样式.抽屉} onClick={(事件) => 事件.stopPropagation()}>
            <button
              className={`${样式.抽屉项} 可点`}
              onClick={() => {
                设抽屉展开(false);
                返回();
              }}
            >
              不感兴趣，别再推给我
            </button>
            <button
              className={`${样式.抽屉项} ${样式.抽屉取消} 可点`}
              onClick={() => 设抽屉展开(false)}
            >
              取消
            </button>
          </div>
        </div>
      ) : null}
    </次级页外壳>
  );
}

/** 四档条里每一块的配色。
 *  当前档用深绿实心；序号 1 那一块固定用中灰（RN 源里就是硬编码 序===1，
 *  不是「当前档减一」，这里保持一致以免像素对不上）；其余用更浅的灰。 */
function 取档位块类名(序: number, 当前档: number): string {
  if (序 === 当前档) return `${样式.档位块} ${样式.档位块当前}`;
  if (序 === 1) return `${样式.档位块} ${样式.档位块中灰}`;
  return `${样式.档位块} ${样式.档位块浅灰}`;
}
