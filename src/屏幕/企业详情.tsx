// 企业详情（公司档案）—— 从职位详情 / 在谈详情的职位详情 Tab 点公司卡进来。
//
// 设计立场：这一页不是公司的宣传册，而是「你的代理对这家公司的档案」。
// 所以顺序是 代理核对结果 → 谁在替它谈 → 公司自述（简介/文化/历程）→ 作息与条款 →
// 地址 → 在职者反馈 → 工商信息，最后底部主按钮回到「让代理去谈这家的其他岗位」。
//
// 两条与常规招聘 App 的刻意差异，由不对称双盲推导而来（口径见 数据/类型.ts 顶部）：
//   1. 不做「竞争者人数 / 你超过百分之多少」—— 那是可反推他人的数字；
//   2. 核对结论一律定性（覆盖 / 一致 / 偏窄），不出现任何薪资数字。
// 招聘方实名可见，所以「谁在替这家谈」卡讲的是对方代理的谈判画风，
// 而不是「这里不给看真人」。
//
// 视觉沿用本项目语言：米色页底 + 白卡细描边 + 淡绿渐变头 + 荧光绿只给主操作，
// 状态色复用四阶段配色（通过=递简历绿 / 待核=初筛灰绿 / 有分歧=协调橙）。

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import 样式 from './企业详情.module.css';
import { 次级页外壳, 返回栏, 滚动区, 公司字标 } from '../组件/通用';
import 代理标 from '../组件/代理标';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { 取公司档案, type 公司档案, type 核对项 } from '../数据/公司档案';
import type { 公司自述覆盖 } from '../数据/类型';
import { 市场列表 } from '../数据/模拟数据';
import { use应用状态 } from '../状态/应用状态';

type 介绍Tab = '公司简介' | '企业文化' | '发展历程';
const 介绍Tab列表: 介绍Tab[] = ['公司简介', '企业文化', '发展历程'];

/** 核对状态 → 标记符与配色类名（复用四阶段色系，不新造颜色） */
const 状态样式: Record<核对项['状态'], { 记: string; 类: string }> = {
  通过: { 记: '✓', 类: 样式.记通过 },
  待核: { 记: '·', 类: 样式.记待核 },
  有分歧: { 记: '!', 类: 样式.记分歧 },
};

export default function 企业详情() {
  const { id: 键 = '' } = useParams<{ id: string }>();
  const { 返回, 跳转 } = use导航();
  const { 状态 } = use应用状态();
  const 静态档 = 取公司档案(键);
  // 企业端在「公司主页资料」里改过自述，这里要立刻是新的（同一份数据源）。
  // 只有本公司（yunqu，即当前登录企业）适用覆盖，别家公司仍读静态档。
  // 类型写成交集：覆盖里 2026-08-20 新增的分区（公司相册 / 产品介绍 / 团队介绍）
  // 静态档没有，写成三目的联合类型会让下面读这些键的地方全部编译不过。
  const 档: 公司档案 & Partial<公司自述覆盖> =
    状态.公司自述 && (键 === 'yunqu' || 键 === '云衢科技')
      ? { ...静态档, ...状态.公司自述 }
      : 静态档;
  // 企业端新填的几段自述：有内容才渲染，空的不占版面
  const 相册图们 = [...(档.公司相册?.实景照片 ?? []), ...(档.公司相册?.公司照片 ?? [])];
  const 产品介绍 = 档.产品介绍?.trim() ?? '';
  const 团队们 = 档.团队介绍 ?? [];

  const [介绍层, 设介绍层] = useState(false);
  const [条款层, 设条款层] = useState(false);
  const [岗位层, 设岗位层] = useState(false);
  const [当前介绍Tab, 设当前介绍Tab] = useState<介绍Tab>('公司简介');
  const [提示, 设提示] = useState<string | null>(null);

  useEffect(() => {
    if (!提示) return;
    const 定时 = window.setTimeout(() => 设提示(null), 1700);
    return () => window.clearTimeout(定时);
  }, [提示]);

  // 该公司在本地数据里能点开的岗位：在谈单在前，市场岗在后
  const 在谈的 = 状态.在谈列表.filter((条) => 条.公司 === 档.名称);
  const 市场的 = 市场列表.filter((条) => 条.公司 === 档.名称);
  const 可点岗位 = [
    ...在谈的.map((条) => ({ 编号: 条.编号, 职位: 条.职位, 薪资: 条.薪资, 在谈: true })),
    ...市场的.map((条) => ({ 编号: 条.编号, 职位: 条.职位, 薪资: 条.薪资, 在谈: false })),
  ];

  const 分歧数 = 档.核对.filter((条) => 条.状态 === '有分歧').length;
  const 通过数 = 档.核对.filter((条) => 条.状态 === '通过').length;
  const 已核福利 = 档.福利.filter((项) => 项.核对 === '已核').length;

  return (
    <次级页外壳>
      <返回栏 返回={返回} 标题={档.名称} />

      <滚动区 样式覆盖={{ paddingBottom: 12 }}>
        {/* ── 淡绿渐变头：公司字标 + 名称 + 一行代理判断 ── */}
        <div className={样式.头区}>
          <div className={样式.头行}>
            <公司字标
              首字={档.首字}
              尺寸={50}
              圆角={16}
              底色="var(--墨)"
              字色="var(--荧光绿)"
              描边={false}
              字号={21}
            />
            <div className={样式.头文字}>
              <h1 className={样式.公司名}>{档.名称}</h1>
              <div className={样式.规模行}>{档.规模行}</div>
            </div>
          </div>
        </div>

        <div className={样式.正文区}>
          {/* ── 代理核对结果：本页第一位。这是我们和普通招聘 App 的根本差别 ── */}
          <div className={`${样式.卡} ${样式.核对卡}`}>
            <div className={样式.核对头}>
              <span className={样式.盾底}>
                <代理标 尺寸={18} 脸色="#ffffff" 眼色="var(--荧光绿)" 带点={false} />
              </span>
              <span className={样式.核对头文}>
                <span className={样式.核对标题}>你的代理核过这些</span>
                <span className={样式.核对摘要}>
                  {通过数} 项对上
                  {分歧数 > 0 ? ` · ${分歧数} 项有分歧` : ' · 暂无分歧'}
                </span>
              </span>
            </div>

            {档.核对.map((条) => {
              const 图 = 状态样式[条.状态];
              return (
                <div key={条.项} className={样式.核对行}>
                  <span className={`${样式.记} ${图.类}`}>{图.记}</span>
                  <span className={样式.核对文字}>
                    <span className={样式.核对项名}>{条.项}</span>
                    <span className={样式.核对结论}>{条.结论}</span>
                  </span>
                </div>
              );
            })}

            <div className={样式.核对脚}>
              薪资只核「是否覆盖你的期望」，双方的数字都不会出现在这里。
            </div>
          </div>

          {/* ── 谁在替它谈（替代真人 HR 头像墙）── */}
          <div className={样式.卡}>
            <div className={样式.卡头}>
              <span className={样式.卡标题}>谁在替这家谈</span>
            </div>
            <div className={样式.对手行}>
              <span className={样式.对手标}>对方代理</span>
              <span className={样式.对手文}>{档.代理风格}</span>
            </div>
            <div className={样式.卡正文}>
              接触与谈判由双方代理进行。匿名是单向的：这家公司和它的对接人对你实名可见，
              而你在意向确认前只是一个代号 —— 对方看得到你的画像，看不到你是谁。
            </div>
          </div>

          {/* ── 公司自述：三 Tab + 三行截断 + 全文层 ── */}
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

            <div className={`${样式.卡正文} ${样式.截断3}`}>
              {当前介绍Tab === '公司简介' ? 档.简介.join('') : null}
              {当前介绍Tab === '企业文化' ? 档.企业文化 : null}
              {当前介绍Tab === '发展历程'
                ? 档.发展历程.length > 0
                  ? 档.发展历程.map((节) => `${节.年份} ${节.事件}`).join('；')
                  : '暂未提供发展历程。'
                : null}
            </div>

            <button className={`${样式.文字键} 可点`} onClick={() => 设介绍层(true)}>
              读全文 ›
            </button>

            {档.主营业务.length > 0 ? (
              <div className={样式.业务行}>
                {档.主营业务.map((项) => (
                  <span key={项} className={样式.业务片}>
                    {项}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {/* ── 公司相册：企业端上传了才出现，一行横滑，不改动其余卡的版式 ── */}
          {相册图们.length > 0 ? (
            <div className={样式.卡}>
              <div className={样式.卡头}>
                <span className={样式.卡标题}>公司相册</span>
                <span className={样式.卡头注}>未经核实</span>
              </div>
              <div className={`${样式.相册行} 滚动区`}>
                {相册图们.map((图, 序) => (
                  <img key={`${序}-${图.slice(-24)}`} className={样式.相册图} src={图} alt="" />
                ))}
              </div>
            </div>
          ) : null}

          {/* ── 作息与条款：福利在我们这里是「待核条款」，不是宣传语 ── */}
          <button className={`${样式.卡} ${样式.条款卡} 可点`} onClick={() => 设条款层(true)}>
            <span className={样式.卡头}>
              <span className={样式.卡标题}>作息与条款</span>
              <span className={样式.尖括号}>›</span>
            </span>
            <span className={样式.作息文}>{档.作息}</span>
            <span className={样式.条款计}>
              共 {档.福利.length} 条条款 · 其中
              <span className={样式.条款已核}>{已核福利} 条已由代理核对</span>
            </span>
          </button>

          {/* ── 办公地 ── */}
          <div className={样式.卡}>
            <div className={样式.卡头}>
              <span className={样式.卡标题}>办公地</span>
              <button
                className={`${样式.文字键} 可点`}
                onClick={() => 设提示('原型未接入地图，正式版会唤起系统导航')}
              >
                导航 ›
              </button>
            </div>
            <div className={样式.地址}>{档.地址}</div>
            <div className={样式.地址补充}>{档.地址补充}</div>
          </div>

          {/* ── 在职者反馈 ── */}
          {档.在职感受.length > 0 ? (
            <div className={样式.卡}>
              <div className={样式.卡头}>
                <span className={样式.卡标题}>在职者反馈</span>
                <span className={样式.卡头注}>来自平台内匿名评价</span>
              </div>
              <div className={样式.感受列}>
                {档.在职感受.map((项) => (
                  <div key={项.标签} className={样式.感受行}>
                    <span className={样式.感受标}>{项.标签}</span>
                    <span className={样式.感受条轨}>
                      <span
                        className={样式.感受条}
                        style={{
                          width: `${Math.min(100, (项.条数 / 档.在职感受[0].条数) * 100)}%`,
                        }}
                      />
                    </span>
                    <span className={`${样式.感受数} 等宽数字`}>{项.条数}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* ── 工商信息 ── */}
          <div className={样式.卡}>
            <div className={样式.卡头}>
              <span className={样式.卡标题}>工商信息</span>
              <span className={样式.卡头注}>已核验</span>
            </div>
            {档.工商信息.map((项) => (
              <div key={项.项} className={样式.工商行}>
                <span className={样式.工商项}>{项.项}</span>
                <span className={样式.工商值}>{项.值}</span>
              </div>
            ))}
          </div>

          <div className={样式.页脚}>公司自述由企业提供 · 工商信息经第三方核验 · 如有不实可举报</div>
        </div>
      </滚动区>

      {/* ── 底部固定主操作：看这家还在招什么 ── */}
      <div className={样式.底栏}>
        <button className={`${样式.底主键} 可点`} onClick={() => 设岗位层(true)}>
          看这家在招的 {档.在招岗位数} 个岗位
        </button>
      </div>

      {/* ── 层 1：公司自述全文 ── */}
      {介绍层 ? (
        <层壳 标题="公司自述" 关闭={() => 设介绍层(false)}>
          <div className={样式.层免责}>以下内容由企业自行提供，平台未逐条核实。</div>

          <div className={样式.层节标}>公司简介</div>
          {档.简介.map((段) => (
            <p key={段} className={样式.层正文}>
              {段}
            </p>
          ))}

          <div className={`${样式.层节标} ${样式.层节标间距}`}>企业文化</div>
          <p className={样式.层正文}>{档.企业文化}</p>

          <div className={`${样式.层节标} ${样式.层节标间距}`}>发展历程</div>
          {档.发展历程.length > 0 ? (
            <div className={样式.历程列}>
              {档.发展历程.map((节) => (
                <div key={节.年份} className={样式.历程行}>
                  <span className={`${样式.历程年} 等宽数字`}>{节.年份}</span>
                  <span className={样式.历程轴} />
                  <span className={样式.历程事}>{节.事件}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className={样式.层正文}>暂未提供。</p>
          )}

          {/* 企业端在公司主页资料里新填的两段：产品介绍 / 团队介绍 */}
          {产品介绍 ? (
            <>
              <div className={`${样式.层节标} ${样式.层节标间距}`}>产品介绍</div>
              <p className={样式.层正文}>{产品介绍}</p>
            </>
          ) : null}

          {团队们.length > 0 ? (
            <>
              <div className={`${样式.层节标} ${样式.层节标间距}`}>团队介绍</div>
              {团队们.map((位, 序) => (
                <div key={`${序}-${位.姓名}`} className={样式.成员行}>
                  <span className={样式.成员头衔}>
                    <span className={样式.成员名}>{位.姓名}</span>
                    {位.职务 ? <span className={样式.成员职}>{位.职务}</span> : null}
                  </span>
                  {位.简介 ? <span className={样式.成员简介}>{位.简介}</span> : null}
                </div>
              ))}
            </>
          ) : null}
        </层壳>
      ) : null}

      {/* ── 层 2：作息与条款全表（已核 / 自述 两组）── */}
      {条款层 ? (
        <层壳 标题="作息与条款" 关闭={() => 设条款层(false)}>
          <div className={样式.层节标}>作息</div>
          <p className={样式.层正文}>{档.作息}</p>

          <div className={`${样式.层节标} ${样式.层节标间距}`}>代理已核对</div>
          {档.福利.filter((项) => 项.核对 === '已核').map((项) => (
            <条款条 key={项.名称} 名={项.名称} 说明={项.说明} 已核 />
          ))}

          <div className={`${样式.层节标} ${样式.层节标间距}`}>公司自述，尚未核对</div>
          {档.福利.filter((项) => 项.核对 === '自述').map((项) => (
            <条款条 key={项.名称} 名={项.名称} 说明={项.说明} />
          ))}

          <div className={样式.层脚}>
            想让代理去核某一条？在这一单的详情页底部对代理说一句，它会带进下一轮。
          </div>
        </层壳>
      ) : null}

      {/* ── 层 3：这家的在招岗位 ── */}
      {岗位层 ? (
        <层壳 标题={`在招 ${档.在招岗位数} 个岗位`} 关闭={() => 设岗位层(false)}>
          {可点岗位.map((岗) => (
            <button
              key={岗.编号}
              className={`${样式.岗位条} 可点`}
              onClick={() =>
                岗.在谈 ? 跳转(路径.在谈详情(岗.编号)) : 跳转(路径.职位详情(岗.编号))
              }
            >
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

          <div className={样式.层脚}>
            其余 {Math.max(0, 档.在招岗位数 - 可点岗位.length)} 个岗位不匹配你当前的求职意向，
            已被「只接受与意向匹配的接触」过滤掉，没有展开。
          </div>
        </层壳>
      ) : null}

      {提示 ? <div className={样式.浮层提示}>{提示}</div> : null}
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
    <div className={样式.遮罩} onClick={关闭}>
      <div className={样式.层} onClick={(事件) => 事件.stopPropagation()}>
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
      </div>
    </div>
  );
}

/** 条款层里的一条：已核的给淡绿勾，自述的给灰点 */
function 条款条({ 名, 说明, 已核 = false }: { 名: string; 说明: string; 已核?: boolean }) {
  return (
    <div className={样式.条款条}>
      <span className={`${样式.条款记} ${已核 ? 样式.条款记已核 : ''}`}>{已核 ? '✓' : '·'}</span>
      <span className={样式.条款文}>
        <span className={样式.条款名}>{名}</span>
        <span className={样式.条款说明}>{说明}</span>
      </span>
    </div>
  );
}
