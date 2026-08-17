// A6b 未通过说明 · AI代理为什么放弃这个岗
//
// 这一屏回答用户唯一在意的问题：代理凭什么替我终止？所以硬性核对逐条摊开（4/5 通过），
// 代理小结说明「为什么不来问你就直接终止」，最后给一条可执行的放宽建议。
//
// 结构：返回栏（右侧灰色适配分）→ 灰色卡点条 → 两个 Tab → 硬性核对卡
//       → 代理小结托盘 → 绿色「要不要松一档？」卡 → 底部代理输入条。

import { useState } from 'react';
import 样式 from './未通过说明.module.css';
import { 次级页外壳, 返回栏, 滚动区, 代理输入条, 小结托盘 } from '../组件/通用';
import { use应用状态 } from '../状态/应用状态';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { 未通过说明 as 数据 } from '../数据/模拟数据';

type 页签 = '谈判进度' | '职位详情';

export default function 未通过说明() {
  const { 派发 } = use应用状态();
  const { 返回, 跳转 } = use导航();

  const [当前页签, 设当前页签] = useState<页签>('谈判进度');
  // 「维持红线」不改任何规则，只把这条建议标记为已处理，避免点了没反应
  const [已维持红线, 设已维持红线] = useState(false);

  const 通过数 = 数据.核对项.filter((条) => 条.通过).length;

  // 「改成可谈」= 把这条红线放宽写成一条真规则，再跳规则库让用户当场看到结果
  const 改成可谈 = () => {
    派发({
      型: '新增规则',
      内容: '大小周可谈，但需额外补偿',
      来源: '来自「未通过说明」的放宽 · 刚刚',
    });
    跳转(路径.规则库);
  };

  return (
    <次级页外壳>
      <返回栏
        返回={返回}
        标题="未通过说明"
        副标题={数据.职位}
        右侧={
          <span className={样式.适配组}>
            <span className={样式.适配标}>适配</span>
            <span className={`${样式.适配分} 等宽数字`}>{数据.适配分}</span>
          </span>
        }
      />

      {/* 灰色卡点条：卡在哪个阶段、什么时候停的 */}
      <div className={样式.卡点条}>
        <span className={样式.灰点} />
        <span className={`${样式.卡点文字} 单行`}>{数据.卡点行}</span>
        <span className={样式.卡点时间}>{数据.时间}</span>
      </div>

      {/* 两个 Tab：与在谈详情页同一套版式，这里默认停在「谈判进度」 */}
      <div className={样式.Tab行}>
        {(['谈判进度', '职位详情'] as 页签[]).map((名) => (
          <button
            key={名}
            className={`${名 === 当前页签 ? 样式.Tab选中 : 样式.Tab未选} 可点`}
            onClick={() => 设当前页签(名)}
          >
            {名}
          </button>
        ))}
      </div>

      <滚动区>
        <div className={样式.内容区}>
          {当前页签 === '谈判进度' ? (
            <>
              <div className={样式.分组标}>
                硬 性 核 对 · {通过数} / {数据.核对项.length} 通 过
              </div>

              <div className={样式.核对卡}>
                {数据.核对项.map((条, 序) => (
                  <div
                    key={条.内容}
                    className={`${样式.核对行} ${
                      序 === 数据.核对项.length - 1 ? 样式.末行 : ''
                    }`}
                  >
                    <span className={`${样式.核对圈} ${条.通过 ? '' : 样式.未过圈}`}>
                      <span className={`${样式.核对符} ${条.通过 ? '' : 样式.未过符}`}>
                        {条.通过 ? '✓' : '✕'}
                      </span>
                    </span>
                    <span className={样式.核对文字}>{条.内容}</span>
                  </div>
                ))}
              </div>

              <小结托盘
                样式覆盖={{
                  marginTop: 14,
                  borderRadius: 'var(--圆角-内托盘)',
                  padding: '11px 13px',
                }}
              >
                <div className={样式.小结正文}>{数据.小结}</div>
              </小结托盘>

              {/* 绿色建议卡：把「这条红线卡掉了多少岗」量化出来，再给两个动作 */}
              <div className={样式.松一档卡}>
                <div className={样式.松一档标题}>{数据.松一档.标题}</div>
                <div className={样式.松一档正文}>
                  {数据.松一档.正文前}
                  <b className={样式.松一档强调}>{数据.松一档.数值1}</b>
                  {数据.松一档.正文中}
                  <b className={样式.松一档强调}>{数据.松一档.数值2}</b>
                  {数据.松一档.正文后}
                </div>

                {已维持红线 ? (
                  <div className={样式.已维持}>已维持红线 · 规则不变，我会继续替你挡掉这类岗位。</div>
                ) : (
                  <div className={样式.按钮行}>
                    <button className={`${样式.次按钮} 可点`} onClick={() => 设已维持红线(true)}>
                      维持红线
                    </button>
                    <button className={`${样式.主按钮} 可点`} onClick={改成可谈}>
                      改成可谈
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* 这一单卡在匿名初筛，完整 JD 从没互递过，所以职位详情天然是空的 */
            <div className={样式.空态}>
              这个岗卡在匿名初筛，没进入递交简历。
              <br />
              完整 JD 与公司全称尚未互递，所以没有职位详情可看。
            </div>
          )}
        </div>
      </滚动区>

      <代理输入条 占位="想让AI代理换个口径再看看？…" 按下={() => 跳转(路径.问AI代理)} />
    </次级页外壳>
  );
}
