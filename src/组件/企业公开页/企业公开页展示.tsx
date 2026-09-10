// 企业公开页共用展示：Mock 与 Backend 两条来源只渲染这一份 JSX（接口 A）。
//
// 只吃 企业公开页资料 + 业务属性/回调：不读数据源模式、不读全局业务状态、
// 不 import Mock 表、不发请求、不按 ID 拼路由 —— 返回/导航/岗位打开都由外层传入。
// 三个子层（公司自述全文 / 作息与条款 / 在招岗位）的开关与当前 Tab 是纯展示状态，留在本组件。
//
// 资料里的 null 是「合法缺失」：按 Spec §3/§6 保留区块与位置，用字段含义明确的
// 未知占位（次要文字色 + 中性背景）；真实 0 与合法否定值照常显示，绝不转成占位。
//
// 本页刻意没有「你的代理核过这些」和「谁在替这家谈」两块（2026-08-23 产品负责人看过
// A 永远删 / D 有内容才显示的实拍对比后选 A，代价已当面确认：双盲口径在本页不再有
// 文字承载）。别处不要顺手加回来。

import { useState } from 'react';
import 弹层框架 from '../弹层框架';
import { 次级页外壳, 返回栏, 滚动区 } from '../通用';
import 样式 from './企业公开页展示.module.css';
import type { 企业公开页展示属性 } from './类型';

type 介绍Tab = '公司简介' | '企业文化' | '发展历程';
const 介绍Tab列表: 介绍Tab[] = ['公司简介', '企业文化', '发展历程'];

/** 未知占位：只用于展示文案，不进入输入、缓存或提交 */
function 未知(文案: string) {
  return <span className={样式.未知}>{文案}</span>;
}

export default function 企业公开页展示({
  资料,
  返回,
  导航,
  岗位,
  岗位层说明,
  条款层说明,
}: 企业公开页展示属性) {
  const [介绍层, 设介绍层] = useState(false);
  const [条款层, 设条款层] = useState(false);
  const [岗位层, 设岗位层] = useState(false);
  const [当前介绍Tab, 设当前介绍Tab] = useState<介绍Tab>('公司简介');

  const { 身份 } = 资料;
  const 条款们 = 资料.条款 ?? [];
  const 已核条款 = 条款们.filter((项) => 项.已核);
  // 已知福利显示「已提供 N 条」；已核计数只在接口真的提供核对结果时出现（真实 0 也是 0）
  const 条款摘要 =
    资料.条款 === null
      ? '福利信息未知'
      : 资料.代理核对已知
        ? `已提供 ${资料.条款.length} 条条款 · 其中`
        : `已提供 ${资料.条款.length} 条条款`;
  // 反馈条宽以第一条为分母；分母为真实 0 时条宽就是 0，不产生 NaN
  const 反馈分母 = 资料.反馈?.[0].条数 ?? 0;
  const 岗位数文本 =
    身份.岗位数 === null
      ? 未知('在招岗位数未知')
      : 身份.岗位数已核验
        ? `${身份.岗位数} 个已核验在招岗位`
        : `${身份.岗位数} 个在招岗位`;

  const Tab正文: Record<介绍Tab, React.ReactNode> = {
    公司简介: 资料.简介 ? 资料.简介.join('') : 未知('公司简介未知'),
    企业文化: 资料.文化 ?? 未知('企业文化未知'),
    发展历程: 资料.历程
      ? 资料.历程.map((节) => `${节.年份} ${节.事件}`).join('；')
      : 未知('发展历程未知'),
  };

  return (
    <次级页外壳>
      <返回栏 返回={返回} 标题={资料.名称 ?? '企业名称未知'} />

      <滚动区 样式覆盖={{ paddingBottom: 12 }}>
        {/* ── 淡绿渐变头：固定尺寸 LOGO/空白图位 + 名称 + 融资/规模/行业行 ── */}
        <div className={样式.头区}>
          <div className={样式.头行}>
            {资料.图片 ? (
              <img className={样式.企业头图} src={资料.图片} alt="" />
            ) : (
              <span className={样式.头图占位} role="img" aria-label="企业 LOGO 未知" />
            )}
            <div className={样式.头文字}>
              <h1 className={样式.公司名}>{资料.名称 ?? '企业名称未知'}</h1>
              <div className={样式.规模行}>{资料.规模行}</div>
            </div>
          </div>
        </div>

        <div className={样式.正文区}>
          {/* ── 公司自述：三 Tab + 三行截断 + 读全文；主营业务同卡下方 ── */}
          <div className={样式.卡}>
            <div className={样式.卡头}>
              <span className={样式.卡标题}>公司自述</span>
              <span className={样式.卡头注}>未经核实</span>
            </div>
            <div className={样式.段Tab行}>
              {介绍Tab列表.map((名) => (
                <button
                  key={名}
                  className={`${样式.段Tab} ${当前介绍Tab === 名 ? 样式.段Tab选中 : ''} 可点`}
                  onClick={() => 设当前介绍Tab(名)}
                >
                  {名}
                </button>
              ))}
            </div>

            <div className={`${样式.卡正文} ${样式.截断3}`}>{Tab正文[当前介绍Tab]}</div>

            {/* 选中项未知也照常可打开全部内容（切换 Tab 不改变事实来源） */}
            <button className={`${样式.文字键} 可点`} onClick={() => 设介绍层(true)}>
              读全文 ›
            </button>

            <div className={样式.业务标}>主营业务</div>
            {资料.业务 ? (
              <div className={样式.业务行}>
                {资料.业务.map((项) => (
                  <span key={项} className={样式.业务片}>
                    {项}
                  </span>
                ))}
              </div>
            ) : (
              <div className={样式.业务行}>{未知('主营业务未知')}</div>
            )}
          </div>

          {/* ── 公司相册：有图横滑，无图保留一格等尺寸空白图位 ── */}
          <div className={样式.卡}>
            <div className={样式.卡头}>
              <span className={样式.卡标题}>公司相册</span>
              {资料.相册 ? <span className={样式.卡头注}>未经核实</span> : null}
            </div>
            {资料.相册 ? (
              <div className={`${样式.相册行} 滚动区`}>
                {资料.相册.map((图, 序) => (
                  <img key={`${序}-${图.slice(-24)}`} className={样式.相册图} src={图} alt="" />
                ))}
              </div>
            ) : (
              <div className={样式.相册行}>
                <span className={样式.相册占位} role="img" aria-label="公司相册未知" />
                {未知('公司相册未知')}
              </div>
            )}
          </div>

          {/* ── 作息与条款：摘要 + 可打开的全文层 ── */}
          <button className={`${样式.卡} ${样式.条款卡} 可点`} onClick={() => 设条款层(true)}>
            <span className={样式.卡头}>
              <span className={样式.卡标题}>作息与条款</span>
              <span className={样式.尖括号}>›</span>
            </span>
            <span className={样式.作息文}>{资料.作息 ?? 未知('作息信息未知')}</span>
            <span className={样式.条款计}>
              {条款摘要}
              {资料.条款 !== null && 资料.代理核对已知 ? (
                <span className={样式.条款已核}>{已核条款.length} 条已由代理核对</span>
              ) : null}
            </span>
          </button>

          {/* ── 办公地：地址、地址补充与导航能力位置 ── */}
          <div className={样式.卡}>
            <div className={样式.卡头}>
              <span className={样式.卡标题}>办公地</span>
              {导航 ? (
                <button className={`${样式.文字键} 可点`} onClick={导航}>
                  导航 ›
                </button>
              ) : (
                未知('导航暂不可用')
              )}
            </div>
            <div className={样式.地址}>{资料.地址 ?? 未知('办公地址未知')}</div>
            <div className={样式.地址补充}>
              {资料.地址补充 ?? 未知('地址补充未知')}
            </div>
          </div>

          {/* ── 在职者反馈：有真实/fixture 数据才画统计条，未知只给文案 ── */}
          {资料.反馈 ? (
            <div className={样式.卡}>
              <div className={样式.卡头}>
                <span className={样式.卡标题}>在职者反馈</span>
                <span className={样式.卡头注}>来自平台内匿名评价</span>
              </div>
              <div className={样式.感受列}>
                {资料.反馈.map((项) => (
                  <div key={项.标签} className={样式.感受行}>
                    <span className={样式.感受标}>{项.标签}</span>
                    <span className={样式.感受条轨}>
                      <span
                        className={样式.感受条}
                        style={{
                          width: `${
                            反馈分母 > 0 ? Math.min(100, (项.条数 / 反馈分母) * 100) : 0
                          }%`,
                        }}
                      />
                    </span>
                    <span className={`${样式.感受数} 等宽数字`}>{项.条数}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className={样式.卡}>
              <div className={样式.卡头}>
                <span className={样式.卡标题}>在职者反馈</span>
              </div>
              {未知('在职者反馈未知')}
            </div>
          )}

          {/* ── 工商与企业身份：两组事实同区，行容器共用，来源说明各管各的 ── */}
          <div className={样式.卡}>
            <div className={样式.卡头}>
              <span className={样式.卡标题}>工商与企业身份</span>
            </div>
            <div className={样式.组头}>
              <span className={样式.组标}>工商资料</span>
              {资料.工商来源说明 ? (
                <span className={样式.卡头注}>{资料.工商来源说明}</span>
              ) : null}
            </div>
            {资料.工商 ? (
              资料.工商.map((项) => (
                <div key={项.项} className={样式.工商行}>
                  <span className={样式.工商项}>{项.项}</span>
                  <span className={样式.工商值}>{项.值}</span>
                </div>
              ))
            ) : (
              <div className={样式.工商行}>{未知('工商资料未知')}</div>
            )}
            <div className={`${样式.组头} ${样式.组头间隔}`}>
              <span className={样式.组标}>企业身份</span>
              <span className={样式.卡头注}>{身份.已核验 ? '已核验' : '未核验'}</span>
            </div>
            <div className={样式.工商行}>
              <span className={样式.工商项}>法定名称</span>
              <span className={样式.工商值}>{身份.法定名称 ?? 未知('法定名称未知')}</span>
            </div>
            <div className={样式.工商行}>
              <span className={样式.工商项}>展示名称</span>
              <span className={样式.工商值}>{身份.展示名称 ?? 未知('展示名称未知')}</span>
            </div>
            <div className={样式.工商行}>
              <span className={样式.工商项}>核验时间</span>
              <span className={样式.工商值}>{身份.核验时间 ?? 未知('核验时间未知')}</span>
            </div>
            <div className={样式.工商行}>
              <span className={样式.工商项}>在招岗位</span>
              <span className={样式.工商值}>{岗位数文本}</span>
            </div>
          </div>

          <div className={样式.页脚}>{资料.页脚}</div>
        </div>
      </滚动区>

      {/* ── 底部固定区：岗位数量与岗位列表能力分开表达 ── */}
      <div className={样式.底栏}>
        {岗位 !== null ? (
          <button className={`${样式.底主键} 可点`} onClick={() => 设岗位层(true)}>
            看这家在招的 {身份.岗位数 ?? 0} 个岗位
          </button>
        ) : (
          <div className={样式.底栏说明}>
            <span>{岗位数文本}</span>
            {未知('岗位列表暂不可用')}
          </div>
        )}
      </div>

      {/* ── 层 1：公司自述全文（简介/文化/历程/产品/团队 五部分固定）── */}
      {介绍层 ? (
        <层壳 标题="公司自述" 关闭={() => 设介绍层(false)}>
          <div className={样式.层免责}>以下内容由企业自行提供，平台未逐条核实。</div>

          <div className={样式.层节标}>公司简介</div>
          {资料.简介 ? (
            资料.简介.map((段) => (
              <p key={段} className={样式.层正文}>
                {段}
              </p>
            ))
          ) : (
            <p className={样式.层正文}>{未知('公司简介未知')}</p>
          )}

          <div className={`${样式.层节标} ${样式.层节标间距}`}>企业文化</div>
          {资料.文化 ? (
            <p className={样式.层正文}>{资料.文化}</p>
          ) : (
            <p className={样式.层正文}>{未知('企业文化未知')}</p>
          )}

          <div className={`${样式.层节标} ${样式.层节标间距}`}>发展历程</div>
          {资料.历程 ? (
            <div className={样式.历程列}>
              {资料.历程.map((节) => (
                <div key={节.年份} className={样式.历程行}>
                  <span className={`${样式.历程年} 等宽数字`}>{节.年份}</span>
                  <span className={样式.历程轴} />
                  <span className={样式.历程事}>{节.事件}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={样式.层正文}>{未知('发展历程未知')}</p>
          )}

          <div className={`${样式.层节标} ${样式.层节标间距}`}>产品介绍</div>
          {资料.产品 ? (
            <p className={样式.层正文}>{资料.产品}</p>
          ) : (
            <p className={样式.层正文}>{未知('产品介绍未知')}</p>
          )}

          <div className={`${样式.层节标} ${样式.层节标间距}`}>团队介绍</div>
          {资料.团队 ? (
            资料.团队.map((位, 序) => (
              <div key={`${序}-${位.姓名 ?? '成员姓名未知'}`} className={样式.成员行}>
                <span className={样式.成员头衔}>
                  <span className={样式.成员名}>{位.姓名 ?? 未知('成员姓名未知')}</span>
                  {位.职务 ? (
                    <span className={样式.成员职}>{位.职务}</span>
                  ) : (
                    <span className={样式.成员职}>{未知('成员职务未知')}</span>
                  )}
                </span>
                {位.简介 ? (
                  <span className={样式.成员简介}>{位.简介}</span>
                ) : (
                  <span className={样式.成员简介}>{未知('成员简介未知')}</span>
                )}
              </div>
            ))
          ) : (
            <p className={样式.层正文}>{未知('团队介绍未知')}</p>
          )}
        </层壳>
      ) : null}

      {/* ── 层 2：作息与条款全表（已核 / 自述 两组）── */}
      {条款层 ? (
        <层壳 标题="作息与条款" 关闭={() => 设条款层(false)}>
          <div className={样式.层节标}>作息</div>
          {资料.作息 ? (
            <p className={样式.层正文}>{资料.作息}</p>
          ) : (
            <p className={样式.层正文}>{未知('作息信息未知')}</p>
          )}

          <div className={`${样式.层节标} ${样式.层节标间距}`}>代理已核对</div>
          {资料.代理核对已知 ? (
            已核条款.length > 0 ? (
              已核条款.map((项) => <条款条 key={项.名称} 名={项.名称} 说明={项.说明} 已核 />)
            ) : (
              <p className={样式.层正文}>已核对 0 条条款。</p>
            )
          ) : (
            <p className={样式.层正文}>{未知('代理核对信息未知')}</p>
          )}

          <div className={`${样式.层节标} ${样式.层节标间距}`}>公司自述，尚未核对</div>
          {条款们.filter((项) => !项.已核).length > 0 ? (
            条款们
              .filter((项) => !项.已核)
              .map((项) => <条款条 key={项.名称} 名={项.名称} 说明={项.说明} />)
          ) : (
            <p className={样式.层正文}>{未知('条款说明未知')}</p>
          )}

          {条款层说明 ? <div className={样式.层脚}>{条款层说明}</div> : null}
        </层壳>
      ) : null}

      {/* ── 层 3：在招岗位（能力不可用时整层不可达）── */}
      {岗位 !== null && 岗位层 ? (
        <层壳 标题={`在招 ${身份.岗位数 ?? 0} 个岗位`} 关闭={() => 设岗位层(false)}>
          {岗位.map((岗) => (
            <button key={岗.编号} className={`${样式.岗位条} 可点`} onClick={岗.打开}>
              <span className={样式.岗位文}>
                <span className={`${样式.岗位名} 单行`}>{岗.职位}</span>
                <span className={样式.岗位注}>
                  {岗.在谈 ? '你已在谈这一岗' : '可让代理去谈'}
                </span>
              </span>
              <span className={样式.岗位薪}>{岗.薪资}</span>
              <span className={样式.尖括号}>›</span>
            </button>
          ))}

          {岗位层说明 ? <div className={样式.层脚}>{岗位层说明}</div> : null}
        </层壳>
      ) : null}
    </次级页外壳>
  );
}

/** 三个子层共用的壳：遮罩 + 底部升起的抽屉 + 顶栏 */
function 层壳({
  标题,
  关闭,
  children,
}: {
  标题: string;
  关闭: () => void;
  children: React.ReactNode;
}) {
  return (
    <弹层框架 标签={标题} 遮罩类名={样式.遮罩} 面板类名={样式.层} 关闭={关闭}>
      <div className={样式.层顶}>
        <span className={样式.层抓手} />
        <div className={样式.层顶行}>
          <span className={样式.层标题}>{标题}</span>
          <button className={`${样式.层关闭} 可点`} onClick={关闭} aria-label="关闭">
            ✕
          </button>
        </div>
      </div>
      <div className={`${样式.层体} 滚动区`}>{children}</div>
    </弹层框架>
  );
}

/** 条款层里的一条：已核的给淡绿勾，自述的给灰点；说明缺失标未知，不套静态福利池 */
function 条款条({ 名, 说明, 已核 = false }: { 名: string; 说明: string | null; 已核?: boolean }) {
  return (
    <div className={样式.条款条}>
      <span className={`${样式.条款记} ${已核 ? 样式.条款记已核 : ''}`}>{已核 ? '✓' : '·'}</span>
      <span className={样式.条款文}>
        <span className={样式.条款名}>{名}</span>
        <span className={样式.条款说明}>{说明 ?? 未知('条款说明未知')}</span>
      </span>
    </div>
  );
}
