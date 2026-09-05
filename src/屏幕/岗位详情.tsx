// 企业端「岗位详情」· 次级页
//
// 从 岗位管理 点任意一行进来（在招 / 已归档都能进）。
// 版式与求职端 职位详情 同构（2026-08-31 用户定稿效果图）：
//   标题 + 薪资 → 胶囊行（招聘状态/学历/经验）→ 地址灰行 → 职位详情/职位要求 → 所属公司 → 工作地址，
//   全程无框卡，分区靠发丝线；区别只在底部是「编辑 / 关闭职位」。
// 同轮删除：右上「当前岗位/设为当前岗位」、状态卡（发布时间 + AI代理寻访行）、
// 岗位数据四格、必须具备/加分项词片 —— 招聘方看自己的岗位，要的就是候选看到的那一页。

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import 样式 from './岗位详情.module.css';
import { 次级页外壳, 滚动区, 返回栏, 主按钮 } from '../组件/通用';
import { 公司区块 } from '../组件/公司区块';
import { 轻提示 } from '../组件/轻提示';
import 弹层框架 from '../组件/弹层框架';
import { use应用状态 } from '../状态/应用状态';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { 取公司档案 } from '../数据/公司档案';
import { 从BFF岗位发布方, 从BFF招聘身份 } from '../数据/组织映射';
import type { 岗位发布方视图, 招聘身份视图 } from '../数据/组织映射';
import { 取后端错误文案 } from '../数据/HTTP客户端';
import type { 在招岗位 } from '../数据/类型';

/** 本企业在公司档案表里的键。企业端全站都是这一家（云衢科技），同 企业我的 的公司主页入口 */
const 本公司键 = 'yunqu';

/** 折叠态下 JD 正文的最大高度：8 行 × 22.5px 行高，与 .正文 的 line-height 对齐 */
const 折叠高度 = 180;

export default function 岗位详情() {
  const { id: 路由岗位编号 } = useParams<{ id: string }>();
  const { 状态, 操作, 数据源模式, 后端状态 } = use应用状态();
  const { 返回, 跳转 } = use导航();
  const 是后端 = 数据源模式 === 'backend';

  // JD 正文的折叠态：先按折叠渲染，挂载后量一次真实高度决定要不要出「查看全部」
  const [正文展开, 设正文展开] = useState(false);
  const [正文超长, 设正文超长] = useState(false);
  const 正文引用 = useRef<HTMLDivElement>(null);
  // 关闭职位的二次确认
  const [待关闭, 设待关闭] = useState(false);
  // 关闭/重开 并发锁：await 操作.* 期间拒绝重复点击，不改变按钮样式
  const 操作锁 = useRef(false);

  // Backend：路由 ID 是唯一权威坐标，未命中即 fail closed（不回退首项、零 mutation）。
  // Mock：找不到（如直接手输 URL）仍退回第一个岗位，保证原型这屏永远点得开、不白屏
  const 精确岗位 = 状态.岗位列表.find((条) => 条.编号 === 路由岗位编号);
  const 岗: 在招岗位 | undefined = 是后端 ? 精确岗位 : (精确岗位 ?? 状态.岗位列表[0]);

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
    // Backend 无效深链（手输/过期 URL、岗位已删）的终局不可用页：
    // 不显示别的岗位、不挂编辑/关闭/重开控件、零 mutation，只能回岗位管理
    return (
      <次级页外壳>
        <返回栏 返回={返回} 标题="岗位详情" />
        <div className={样式.内容}>
          <div className={样式.卡}>
            <div className={样式.节标}>岗位不存在或已不可用</div>
          </div>
        </div>
        <主按钮 文字="返回岗位管理" 按下={() => 跳转(路径.岗位管理)} />
      </次级页外壳>
    );
  }

  const 在招中 = 岗.状态 === '在招';

  // 在谈人数只喂给「关闭职位」确认文案,页面上不再摆数据格
  const 在谈中数 = 状态.企业候选列表.filter((候) => 候.岗位编号 === 岗.编号).length;

  // ── 胶囊行：岗位自己没有的字段就整项不出现，不造数据；地点单独成灰行 ──
  const 信息项: string[] = [];
  const 地点文 = [岗.城市, 岗.办公地].filter(Boolean).join(' · ');
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

  // ── 所属公司 ──
  // Mock：企业端改过「公司资料」就以覆盖为准，与候选端公司主页读同一份静态档。
  // Backend（P1C Task 5）：不读 本公司键 静态档。公司卡与发布人身份都来自 owner
  // server snapshot 的投影（从BFF岗位发布方）与当前招聘身份视图（从BFF招聘身份）；
  // canonical ref 与 不可用公开企业编号 共同决定公司卡能否点到 /company/{opaque-id}。
  const 静态档 = 是后端 ? null : 取公司档案(本公司键);
  const 公司档 = 静态档 ? (状态.公司自述 ? { ...静态档, ...状态.公司自述 } : 静态档) : null;
  const 快照 = 是后端 ? 后端状态.岗位快照[岗.编号] : undefined;
  const 发布方 = 快照 ? 从BFF岗位发布方(快照) : null;
  const 身份 = 从BFF招聘身份(
    状态.招聘方档案 ?? null,
    状态.企业关系列表 ?? [],
    状态.当前企业关系编号 ?? null,
    状态.企业管理员申请列表 ?? [],
  );
  const 用人编号 = 发布方?.用人企业编号 ?? null;
  const 用人可用 =
    用人编号 !== null && !(状态.不可用公开企业编号 ?? []).includes(用人编号);

  // 工作地址：岗位自己的办公地优先（Backend 只有这一来源），Mock 再退公司地址
  const 地址文 = 岗.办公地 ?? 公司档?.地址 ?? '';

  return (
    <次级页外壳>
      <返回栏 返回={返回} />

      <滚动区>
        <div className={样式.内容}>
          {/* ── 标题区：岗位名 + 薪资带 → 胶囊行（招聘状态/学历/经验）→ 地点灰行 ── */}
          <div>
            <div className={样式.标题行}>
              <h1 className={样式.岗位名}>{岗.名称}</h1>
              <span className={`${样式.薪资带} 薪资体 等宽数字`}>{岗.薪资带}</span>
            </div>
            <div className={样式.顶胶行}>
              <span className={`${样式.状态徽} ${在招中 ? '' : 样式.归档徽}`}>
                {在招中 ? '招聘中' : '已归档'}
              </span>
              {信息项.map((项) => (
                <span key={项} className={样式.关键词}>
                  {项}
                </span>
              ))}
            </div>
            {地点文 ? <div className={样式.地点灰行}>{地点文}</div> : null}
          </div>

          {/* ── 职位详情：描述 / 要求正文（超过 8 行折叠），与求职端同构、无词片 ── */}
          {描述文本 || 要求文本 ? (
            <div className={样式.卡}>
              <div className={样式.节标}>职位详情</div>
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
            </div>
          ) : null}

          {/* ── 所属公司(2026-08-26「所有页面都要改」):共用 公司区块 组件,
                点进候选人看到的那张公司主页;已上传 LOGO 时用 LOGO 替字标。
                Backend(P1C Task 5):claim/ref 全来自 owner snapshot 投影,快照缺失时
                整节不渲染——不拿静态档顶替服务端事实 ── */}
          {是后端 ? (
            发布方 ? (
              <>
                <div className={样式.卡}>
                  <div className={样式.节标}>所属公司</div>
                  <公司区块
                    名称={发布方.用人企业声明.display_name}
                    首字={发布方.用人企业声明.display_name.slice(0, 1) || '?'}
                    一行简介=""
                    资料={{
                      介绍段: null,
                      元行组: [
                        {
                          标签: '企业核验',
                          值: 发布方.用人企业验证 === 'verified' ? '已认证' : '未认证声明',
                        },
                      ],
                    }}
                    按下={
                      用人可用 && 用人编号 !== null
                        ? () => 跳转(路径.企业详情(用人编号))
                        : undefined
                    }
                  />
                  <岗位发布方区 view={发布方} 身份={身份} />
                </div>
              </>
            ) : null
          ) : (
            <>
              <div className={样式.卡}>
                <div className={样式.节标}>所属公司</div>
                <公司区块
                  名称={公司档!.名称}
                  首字={公司档!.首字}
                  一行简介={公司档!.规模行}
                  按下={() => 跳转(路径.企业详情(本公司键))}
                  标志={
                    状态.公司LOGO ? (
                      <img className={样式.公司LOGO} src={状态.公司LOGO} alt="" />
                    ) : undefined
                  }
                />
              </div>
            </>
          )}

          {/* ── 工作地址：只放文字（标注 2026-08-20 15:36：地图部分删掉）── */}
          {地址文 ? (
            <div className={样式.卡}>
              <div className={样式.节标}>工作地址</div>
              <div className={样式.地址行}>
                <定位图标 尺寸={16} 色="var(--深绿)" />
                <span className={样式.地址文}>{地址文}</span>
              </div>
            </div>
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
          onClick={async () => {
            if (在招中) {
              设待关闭(true);
              return;
            }
            if (操作锁.current) return;
            操作锁.current = true;
            try {
              await 操作.重开岗位(岗.编号);
              轻提示(`「${岗.名称}」已重新开放`);
            } catch (错误) {
              轻提示(取后端错误文案(错误));
            } finally {
              操作锁.current = false;
            }
          }}
        >
          {在招中 ? '关闭职位' : '重新开放'}
        </button>
      </div>

      {/* 关闭职位二次确认：对我方可逆（随时重开），但对在谈的人是一次真实的终止通知 */}
      {待关闭 ? (
        <弹层框架 标签={`关闭职位${岗.名称}`} 遮罩类名={样式.遮罩} 面板类名={样式.确认框} 位置="居中" 关闭={() => 设待关闭(false)}>
            <div className={样式.确认标题}>关闭职位？</div>
            <div className={样式.确认正文}>
              {在谈中数 > 0
                ? `在谈的 ${在谈中数} 位候选会收到终止通知，随时可重新开放。`
                : 'AI代理停止寻访这个岗位，随时可重新开放。'}
            </div>
            <div className={样式.确认键行}>
              <button className={`${样式.确认取消} 可点`} onClick={() => 设待关闭(false)}>
                取消
              </button>
              <button
                className={`${样式.确认执行} 可点`}
                onClick={async () => {
                  if (操作锁.current) return;
                  操作锁.current = true;
                  try {
                    await 操作.归档岗位(岗.编号);
                    设待关闭(false);
                    轻提示(`「${岗.名称}」已关闭`);
                  } catch (错误) {
                    轻提示(取后端错误文案(错误));
                  } finally {
                    操作锁.current = false;
                  }
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

/**
 * P1C Task 5：发布方/用人企业投影区。只渲染两个冻结 view（岗位发布方视图 + 招聘身份视图），
 * 不读 DTO、不读 Context——owner runtime 的 BFFOwnerJob 没有 publisher_profile，
 * 发布人姓名/职务/头像/个人核验全部来自当前 从BFF招聘身份() view。
 * publisher 与 hiring 两行不折叠：直招两个 ref 可以相同，但仍各自来自两个明确字段。
 * 状态文案带 wire code（verified/unverified），页面展示与 DTO 事实可对账。
 */
export function 岗位发布方区({ view, 身份 }: { view: 岗位发布方视图; 身份: 招聘身份视图 }) {
  const 模式文 = view.发布方模式 === 'agency' ? '代理' : '直招';
  const 发布方文 = view.发布方验证 === 'verified' ? '已认证' : '未认证';
  const 用人文 = view.用人企业验证 === 'verified' ? '已认证' : '未认证';
  return (
    <div className={样式.寻访行}>
      {身份.avatarUrl ? (
        <img className={样式.公司LOGO} src={身份.avatarUrl} alt={身份.publicName || '发布人'} />
      ) : null}
      <div className={样式.公司文字区}>
        <div className={样式.公司名}>
          {身份.publicName || '未署名'}
          {身份.title ? <span className={样式.公司规模行}>{身份.title}</span> : null}
        </div>
        <div className={样式.发布组}>
          <span className={样式.发布标}>个人核验</span>
          <span className={样式.发布值}>{身份.personalVerification.label}</span>
        </div>
        <div className={样式.发布组} data-testid="publisher-status">
          <span className={样式.发布标}>发布方企业</span>
          <span className={样式.发布值}>
            {模式文} · {发布方文}（{view.发布方验证}）
          </span>
        </div>
        <div className={样式.发布组} data-testid="hiring-status">
          <span className={样式.发布标}>用人企业</span>
          <span className={样式.发布值}>
            {view.用人企业声明.display_name} · {用人文}（{view.用人企业验证}）
          </span>
        </div>
      </div>
    </div>
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
