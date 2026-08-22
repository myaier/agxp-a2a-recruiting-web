// 企业端「岗位详情」· 次级页
//
// 从 岗位管理 点任意一行进来（在招 / 已归档都能进）。信息架构对齐 BOSS 的岗位详情：
//   标题 + 薪资 → 信息行 → 状态卡 → 岗位数据四格 → 职位详情 → 所属公司 → 工作地址 → 底部双键。
//
// 两处口径换成我们自己的语义，不照抄对方：
//   · 状态卡不做「今日剩余 N 次沟通」那类额度 —— 我们没有额度概念，这里放 AI 代理的寻访状态；
//   · 岗位数据四格的口径是 A2A 的漏斗（已寻访 / 初筛通过 / 在谈中 / 待你拍板），
//     前三格能从 企业候选列表 + 推荐列表 现算，只有「已寻访」没有前端数据源，走静态兜底。
//
// 「设为当前岗位」原来挂在 岗位管理 的行点击上，现在挪到这一屏顶栏 ——
// 点开一个岗位想看的是它长什么样，不该顺手把人才页的当前岗位切走。

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import 样式 from './岗位详情.module.css';
import { 次级页外壳, 公司字标, 滚动区, 返回栏 } from '../组件/通用';
import { 轻提示 } from '../组件/轻提示';
import 弹层框架 from '../组件/弹层框架';
import { use应用状态 } from '../状态/应用状态';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { 取公司档案 } from '../数据/公司档案';
import { 岗位已寻访兜底, 岗位已寻访数 } from '../数据/企业端模拟数据';
import type { 在招岗位 } from '../数据/类型';

/** 本企业在公司档案表里的键。企业端全站都是这一家（云衢科技），同 企业我的 的公司主页入口 */
const 本公司键 = 'yunqu';

/** 折叠态下 JD 正文的最大高度：8 行 × 22.5px 行高，与 .正文 的 line-height 对齐 */
const 折叠高度 = 180;

export default function 岗位详情() {
  const { id: 路由岗位编号 } = useParams<{ id: string }>();
  const { 状态, 派发 } = use应用状态();
  const { 返回, 跳转 } = use导航();

  // JD 正文的折叠态：先按折叠渲染，挂载后量一次真实高度决定要不要出「查看全部」
  const [正文展开, 设正文展开] = useState(false);
  const [正文超长, 设正文超长] = useState(false);
  const 正文引用 = useRef<HTMLDivElement>(null);
  // 关闭职位的二次确认
  const [待关闭, 设待关闭] = useState(false);

  // 找不到（如刚被删掉、或直接手输 URL）就退回第一个岗位，保证这屏永远点得开、不白屏
  const 岗: 在招岗位 | undefined =
    状态.岗位列表.find((条) => 条.编号 === 路由岗位编号) ?? 状态.岗位列表[0];

  const 描述文本 = 岗?.职位描述?.trim() ?? '';
  const 要求文本 = 岗?.职位要求?.trim() ?? '';

  useEffect(() => {
    const 元素 = 正文引用.current;
    if (!元素) {
      设正文超长(false);
      return;
    }
    // 折叠态下 clientHeight 被 max-height 卡住，scrollHeight 才是正文的真实高度。
    // 差值留 4px 容差，避免行高取整误差导致空展开
    设正文超长(元素.scrollHeight > 元素.clientHeight + 4);
  }, [描述文本, 要求文本]);

  if (!岗) {
    // 岗位被删光的极端情况：给一个能返回的空屏，不给死页
    return (
      <次级页外壳>
        <返回栏 返回={返回} 标题="岗位详情" />
      </次级页外壳>
    );
  }

  const 在招中 = 岗.状态 === '在招';
  const 是当前岗 = 岗.编号 === 状态.当前岗位编号;

  // ── 岗位数据四格 ──
  const 本岗在谈 = 状态.企业候选列表.filter((候) => 候.岗位编号 === 岗.编号);
  const 本岗推荐 = 状态.推荐列表.filter((人) => 人.岗位编号 === 岗.编号);
  const 在谈中数 = 本岗在谈.length;
  const 待拍板数 = 本岗在谈.filter((候) => 候.需要你).length;
  // 初筛通过 = 过了硬性核对进推荐池的 + 已经推进到在谈的，两段都是「初筛之后」的人
  const 初筛通过数 = 本岗推荐.length + 在谈中数;
  // 代理累计触达过多少人前端没有数据源，走 企业端模拟数据 里的静态兜底
  const 已寻访数 = 岗位已寻访数[岗.编号] ?? 岗位已寻访兜底;

  const 四格: { 名: string; 值: number }[] = [
    { 名: '已寻访', 值: 已寻访数 },
    { 名: '初筛通过', 值: 初筛通过数 },
    { 名: '在谈中', 值: 在谈中数 },
    { 名: '待你拍板', 值: 待拍板数 },
  ];

  // ── 信息行：岗位自己没有的字段就整项不出现，不造数据 ──
  const 信息项: string[] = [];
  const 地点文 = [岗.城市, 岗.办公地].filter(Boolean).join(' · ');
  if (地点文) 信息项.push(地点文);
  if (岗.最低学历 && 岗.最低学历 !== '不限') 信息项.push(岗.最低学历);
  // 实习/兼职看的是实习要求而不是工龄，两者互斥出现
  const 实习文 = [
    岗.实习月数 ? `实习 ${岗.实习月数} 个月` : null,
    岗.每周天数 ? `每周 ${岗.每周天数} 天` : null,
  ]
    .filter(Boolean)
    .join(' · ');
  if (实习文) 信息项.push(实习文);
  else if (岗.经验要求 && 岗.经验要求 !== '不限') 信息项.push(岗.经验要求);
  // 转正机会保留（产品负责人 2026-08-22：「实习生转正可以加，其他的都不要加」）；
  // 原来跟在它后面的「最晚 X 开始」「预计 N 轮面试」「招聘紧急度」三条随字段一起删
  if (岗.招聘类型 === '实习生' && 岗.实习转正 !== undefined) 信息项.push(岗.实习转正 ? '提供转正机会' : '暂不提供转正');

  // ── 职位关键词：有录入的关键词用它，老岗位回落到已有的 职位类别 + 硬性条件 ──
  const 关键词们 = 岗.职位关键词?.length
    ? 岗.职位关键词
    : [岗.职位类别, ...(岗.硬性条件 ?? [])].filter((条): 条 is string => Boolean(条));

  // ── 所属公司：企业端改过「公司资料」就以覆盖为准，与候选端公司主页读同一份 ──
  const 静态档 = 取公司档案(本公司键);
  const 公司档 = 状态.公司自述 ? { ...静态档, ...状态.公司自述 } : 静态档;

  // 工作地址：岗位自己的办公地优先，没有就用公司地址；两者都没有整节不出
  const 地址文 = 岗.办公地 ?? 公司档.地址 ?? '';

  const 设为当前 = () => {
    派发({ 型: '切当前岗位', 编号: 岗.编号 });
    轻提示(`已切到「${岗.名称}」`);
  };

  return (
    <次级页外壳>
      <返回栏
        返回={返回}
        右侧={
          在招中 ? (
            是当前岗 ? (
              <span className={样式.当前岗位灰}>当前岗位</span>
            ) : (
              <button className={`${样式.设当前键} 可点`} onClick={设为当前}>
                设为当前岗位
              </button>
            )
          ) : null
        }
      />

      <滚动区>
        <div className={样式.内容}>
          {/* ── 标题区：岗位名 + 薪资带，baseline 对齐 ── */}
          <div>
            <div className={样式.标题行}>
              <h1 className={样式.岗位名}>{岗.名称}</h1>
              <span className={`${样式.薪资带} 薪资体 等宽数字`}>{岗.薪资带}</span>
            </div>
            {信息项.length ? (
              <div className={样式.信息行}>
                {信息项.map((项, 序) => (
                  <span key={项} className={样式.信息项组}>
                    {序 > 0 ? <span className={样式.信息竖线} /> : null}
                    <span className={样式.信息项}>{项}</span>
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {/* ── 状态卡：招聘状态 + 发布时间，下半是 AI 代理的寻访状态（我们没有额度概念）── */}
          <div className={样式.卡}>
            <div className={样式.状态行}>
              <span className={`${样式.状态徽} ${在招中 ? '' : 样式.归档徽}`}>
                {在招中 ? '招聘中' : '已归档'}
              </span>
              {岗.发布于 ? (
                <span className={样式.发布组}>
                  <span className={样式.发布标}>发布时间</span>
                  <span className={`${样式.发布值} 等宽数字`}>{岗.发布于}</span>
                </span>
              ) : null}
            </div>
            <div className={样式.寻访行}>
              <span className={`${样式.寻访点} ${在招中 ? 样式.寻访点呼吸 : 样式.寻访点停}`} />
              <span className={样式.寻访文}>
                {在招中 ? 'AI代理寻访中' : 'AI代理已停止寻访'} · 本岗在谈{' '}
                <b className="等宽数字">{在谈中数}</b> 人
              </span>
            </div>
          </div>

          {/* ── 岗位数据四格 ── */}
          <div className={样式.节标}>岗位数据</div>
          <div className={`${样式.卡} ${样式.四格卡}`}>
            {四格.map((格) => (
              <div key={格.名} className={样式.格}>
                <span className={`${样式.格数} 等宽数字`}>{格.值}</span>
                <span className={样式.格名}>{格.名}</span>
              </div>
            ))}
          </div>

          {/* ── 职位详情：关键词 chips + 描述 / 要求正文（超过 8 行折叠）── */}
          {关键词们.length || 岗.加分关键词?.length || 描述文本 || 要求文本 ? (
            <>
              <div className={样式.节标}>职位详情</div>
              <div className={样式.卡}>
                {关键词们.length ? (
                  <>
                    <div className={样式.小节标}>必须具备（用于自动初筛）</div>
                    <div className={样式.关键词行}>
                      {关键词们.map((词) => (
                        <span key={词} className={样式.关键词}>
                          {词}
                        </span>
                      ))}
                    </div>
                  </>
                ) : null}

                {岗.加分关键词?.length ? (
                  <>
                    <div className={样式.小节标}>加分项（不作为淘汰条件）</div>
                    <div className={样式.关键词行}>
                      {岗.加分关键词.map((词) => <span key={词} className={样式.关键词}>{词}</span>)}
                    </div>
                  </>
                ) : null}

                {描述文本 || 要求文本 ? (
                  <>
                    <div
                      ref={正文引用}
                      className={`${样式.正文区} ${正文展开 ? '' : 样式.正文折叠} ${
                        正文超长 && !正文展开 ? 样式.正文渐隐 : ''
                      }`}
                      style={正文展开 ? undefined : { maxHeight: 折叠高度 }}
                    >
                      {描述文本
                        ? 描述文本.split('\n').map((行, 序) => (
                            <p key={`描述-${序}`} className={样式.正文}>
                              {行}
                            </p>
                          ))
                        : null}
                      {要求文本 ? (
                        <>
                          <div className={样式.小节标}>职位要求</div>
                          {要求文本.split('\n').map((行, 序) => (
                            <p key={`要求-${序}`} className={样式.正文}>
                              {行}
                            </p>
                          ))}
                        </>
                      ) : null}
                    </div>
                    {正文超长 && !正文展开 ? (
                      <button
                        className={`${样式.查看全部} 可点`}
                        onClick={() => 设正文展开(true)}
                      >
                        查看全部
                      </button>
                    ) : null}
                  </>
                ) : null}
              </div>
            </>
          ) : null}

          {/* ── 所属公司：点进候选人看到的那张公司主页 ── */}
          <div className={样式.节标}>所属公司</div>
          <button
            className={`${样式.卡} ${样式.公司卡} 可点`}
            onClick={() => 跳转(路径.企业详情(本公司键))}
          >
            {状态.公司LOGO ? (
              <img className={样式.公司LOGO} src={状态.公司LOGO} alt="" />
            ) : (
              <公司字标
                首字={公司档.首字}
                尺寸={42}
                圆角={14}
                底色="var(--墨)"
                字色="var(--荧光绿)"
                描边={false}
                字号={18}
              />
            )}
            <span className={样式.公司文字区}>
              <span className={`${样式.公司名} 单行`}>{公司档.名称}</span>
              <span className={`${样式.公司规模行} 单行`}>{公司档.规模行}</span>
            </span>
            <span className={样式.尖括号}>›</span>
          </button>

          {/* ── 工作地址：只放文字（标注 2026-08-20 15:36：地图部分删掉）── */}
          {地址文 ? (
            <>
              <div className={样式.节标}>工作地址</div>
              <div className={样式.卡}>
                <div className={样式.地址行}>
                  <定位图标 尺寸={16} 色="var(--深绿)" />
                  <span className={样式.地址文}>{地址文}</span>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </滚动区>

      {/* ── 底部悬浮胶囊条（标注 15:36：与看市场职位详情同款）：编辑 + 关闭职位/重新开放 ── */}
      <div className={样式.底键区}>
        <button
          className={`${样式.次键} 可点`}
          onClick={() => 跳转(路径.编辑岗位(岗.编号))}
        >
          编辑
        </button>
        <button
          className={`${样式.主键} 可点`}
          onClick={() => {
            if (在招中) {
              设待关闭(true);
              return;
            }
            派发({ 型: '重开岗位', 编号: 岗.编号 });
            轻提示(`「${岗.名称}」已重新开放`);
          }}
        >
          {在招中 ? '关闭职位' : '重新开放'}
        </button>
      </div>

      {/* 关闭职位二次确认：对我方可逆（随时重开），但对在谈的人是一次真实的终止通知 */}
      {待关闭 ? (
        <弹层框架 标签={`关闭职位${岗.名称}`} 遮罩类名={样式.遮罩} 面板类名={样式.确认框} 关闭={() => 设待关闭(false)}>
            <div className={样式.确认标题}>关闭「{岗.名称}」？</div>
            <div className={样式.确认正文}>
              {在谈中数 > 0
                ? `这个岗位还有 ${在谈中数} 位在谈候选，他们会收到代理的礼貌终止通知，不会被晾在半路。接洽记录全部保留，随时可以重新开放。`
                : '关闭后 AI代理停止寻访这个岗位，岗位与全部记录保留，随时可以重新开放。'}
            </div>
            <div className={样式.确认键行}>
              <button className={`${样式.确认取消} 可点`} onClick={() => 设待关闭(false)}>
                取消
              </button>
              <button
                className={`${样式.确认执行} 可点`}
                onClick={() => {
                  派发({ 型: '停止招聘', 编号: 岗.编号 });
                  设待关闭(false);
                  轻提示(`「${岗.名称}」已关闭`);
                }}
              >
                关闭职位
              </button>
            </div>
        </弹层框架>
      ) : null}
    </次级页外壳>
  );
}

/** 定位图标：地址行前的针。图标.tsx 里没有针形，这一处专用，就近定义 */
function 定位图标({ 尺寸 = 20, 色 = 'var(--深绿)' }: { 尺寸?: number; 色?: string }) {
  return (
    <svg width={尺寸} height={尺寸} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 21s7-6.03 7-11a7 7 0 1 0-14 0c0 4.97 7 11 7 11Z"
        stroke={色}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.6" stroke={色} strokeWidth={1.8} />
    </svg>
  );
}
