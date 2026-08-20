// A3a–A3g 七题引导 —— 移植 RN 版 应用/屏幕/引导问答.js，像素值一比一。
//
// 一页一题，顶部分段进度条随题推进，题目顺序：
// 期望职位 → 工作城市 → 期望薪资 → 硬性排除 → 个人优势（五题）。
// 到岗节奏题已挪去 /onboard/status 求职状态屏（2026-08-20 按 BOSS 截图顺序重排）。
// 返回键：第一题退出本屏（回上一屏），其余题回上一题。
// 最后一题「保存并继续」进 A4 披露说明。
//
// 答案只存在内存里（原型层不落盘），所以全部用 useState，不进全局应用状态。
//
// 薪资那一题 RN 里靠 snapToInterval 做原生吸附，Web 上改用
// scroll-snap-type: y mandatory + scroll-snap-align: center —— 吸附交给浏览器，
// 只需在滚动停下后算一次落点，比 RN 版更省代码且手感一致。

import { useEffect, useMemo, useRef, useState } from 'react';
import 样式 from './引导问答.module.css';
import { 主按钮, 单选点, 开关, 次级页外壳, 滚动区, 页面大标题, 返回栏 } from '../组件/通用';
import { GitHub图标, 放大镜图标 } from '../组件/图标';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { use应用状态 } from '../状态/应用状态';
import { 个人优势文本 } from '../数据/模拟数据';
import { 城市字典, 热门城市, 行业字典 } from '../数据/城市与行业';

// 「状态分流」题已删（2026-08-17 标注意见 #1）；「到岗节奏」题已挪去
// 求职状态屏 /onboard/status（2026-08-20 按 BOSS 截图顺序重排）
const 题目顺序 = [
  '期望职位',
  '工作城市',
  '期望薪资',
  '硬性排除',
  '个人优势',
] as const;

type 题名 = (typeof 题目顺序)[number];

export default function 引导问答() {
  const { 跳转, 返回 } = use导航();
  const { 状态: 全局, 派发 } = use应用状态();
  const [第几题, 设第几题] = useState(0);
  // 学生分流页已选过 城市 + 期望职位（引导预填非空）→ 这两题跳过，不重复问；
  // 薪资答过（标注 10:51 流程：薪资 → 基本信息 → 工作经历 → 回向导）→ 薪资题也跳过
  const 题序: readonly 题名[] = 题目顺序.filter((题) => {
    if (全局.引导预填 && (题 === '期望职位' || 题 === '工作城市')) return false;
    if (全局.引导预填?.薪资 && 题 === '期望薪资') return false;
    return true;
  });
  const 当前题: 题名 = 题序[第几题];

  // ── 各题的答案（前两题被跳过时，初值直接取引导预填；城市已是多选数组）──
  const [已选职位, 设已选职位] = useState(
    全局.引导预填?.职位 ?? ['后端开发', '交易 / 支付系统', '金融科技（行业）']
  );
  const [已选城市, 设已选城市] = useState(全局.引导预填?.城市们 ?? ['上海']);
  const [薪资下限, 设薪资下限] = useState(全局.引导预填?.薪资?.下限 ?? 50);
  const [薪资上限, 设薪资上限] = useState(全局.引导预填?.薪资?.上限 ?? 60);
  const [排除项, 设排除项] = useState(['大小周', '纯外包 / 乙方']);
  const [自我介绍, 设自我介绍] = useState(个人优势文本);

  /** 多选题共用的「有则去掉、无则加上」 */
  const 造切换 = (设值: (更新: (旧: string[]) => string[]) => void) => (项: string) =>
    设值((旧) => (旧.includes(项) ? 旧.filter((条) => 条 !== 项) : [...旧, 项]));

  const 下一题 = () => {
    // 标注 10:51：期望薪资答完先去 基本信息 → 工作经历，再回向导续答（薪资题届时已跳过）
    if (当前题 === '期望薪资' && !全局.引导预填?.薪资) {
      派发({ 型: '存薪资预填', 下限: 薪资下限, 上限: 薪资上限 });
      跳转(路径.基本信息);
      return;
    }
    if (第几题 < 题序.length - 1) 设第几题(第几题 + 1);
    else 跳转(路径.披露说明);
  };
  const 上一题 = () => {
    if (第几题 === 0) 返回();
    else 设第几题(第几题 - 1);
  };

  // 按钮文案：两道多选题回显已选数量，最后一题是「保存并继续」
  const 按钮文字 =
    当前题 === '工作城市'
      ? `保存（已选 ${已选城市.length}）`
      : 当前题 === '期望职位'
        ? `保存（已选 ${已选职位.length}）`
        : 当前题 === '个人优势'
          ? '保存并继续'
          : '下一步';

  return (
    <次级页外壳>
      <div className={样式.引导壳}>
        <返回栏 返回={上一题} />

        {/* 进度条：已走过的段（含当前题）填荧光绿 */}
        <div className={样式.进度轨}>
          {题序.map((题, 序) => (
            <span
              key={题}
              className={`${样式.进度段} ${序 <= 第几题 ? 样式.进度段已过 : ''}`}
            />
          ))}
        </div>
        {当前题 === '期望职位' ? (
          <期望职位题 已选={已选职位} 切换={造切换(设已选职位)} 设已选={设已选职位} />
        ) : null}
        {当前题 === '工作城市' ? (
          <城市题 已选={已选城市} 切换={造切换(设已选城市)} />
        ) : null}
        {当前题 === '期望薪资' ? (
          <薪资题
            下限={薪资下限}
            设下限={设薪资下限}
            上限={薪资上限}
            设上限={设薪资上限}
          />
        ) : null}
        {当前题 === '硬性排除' ? <排除题 已选={排除项} 切换={造切换(设排除项)} /> : null}
        {当前题 === '个人优势' ? <优势题 文本={自我介绍} 设文本={设自我介绍} /> : null}

        <主按钮
          文字={按钮文字}
          按下={下一题}
          禁用={当前题 === '工作城市' && 已选城市.length === 0}
        />
      </div>
    </次级页外壳>
  );
}

// ── A3b2 期望职位：左侧分类栏 + 右侧行业卡 + 底部已选条 ─────────
const 职位分类 = [
  '行业分类',
  '后端开发',
  '架构',
  '基础平台',
  '算法',
  '数据',
  '前端',
  '测试 / 运维',
  '安全',
];

function 期望职位题({
  已选,
  切换,
  设已选,
}: {
  已选: string[];
  切换: (项: string) => void;
  设已选: (更新: (旧: string[]) => string[]) => void;
}) {
  const [分类, 设分类] = useState('行业分类');
  const [行业, 设行业] = useState('金融科技');
  const [关键词, 设关键词] = useState('');
  // 二级细选页：点行业卡后进来选具体方向（标注意见 2026-08-17 21:45）
  const [细选行业, 设细选行业] = useState<string | null>(null);

  // 行业是单选语义：换行业时要把旧的「xx（行业）」标签替换掉，而不是 toggle 追加，
  // 否则圆点亮的和底部已选标签会脱节（亮的没标签、有标签的没亮）
  const 选行业 = (名称: string) => {
    设行业(名称);
    设已选((旧) => [...旧.filter((条) => !条.endsWith('（行业）')), `${名称}（行业）`]);
  };

  // 点整张卡 = 选中该行业 + 进入二级细选页挑具体方向
  const 进细选 = (名称: string) => {
    选行业(名称);
    设细选行业(名称);
  };

  // 搜索词同时匹配一级行业名和二级方向名，保证搜索框是真能用的
  const 词 = 关键词.trim();
  const 过滤后行业 =
    词 === ''
      ? 行业字典
      : 行业字典.filter(
          (组) => 组.行业.includes(词) || 组.细分.some((项) => 项.includes(词))
        );

  const 当前组 = 行业字典.find((组) => 组.行业 === 细选行业) ?? null;

  return (
    <div className={样式.题体}>
      <div className={样式.标题上移4}>
        <页面大标题 标题="期望职位是" />
      </div>

      <搜索条 占位="搜索行业 / 方向" 值={关键词} 改变={设关键词} />

      <div className={样式.两栏}>
        <div className={`${样式.左栏} 滚动区`}>
          {职位分类.map((项) => (
            <button
              key={项}
              className={`${样式.左栏项} ${分类 === 项 ? 样式.左栏项选中 : ''} 可点`}
              onClick={() => 设分类(项)}
            >
              {项}
            </button>
          ))}
        </div>

        <div className={`${样式.右栏} 滚动区`}>
          {过滤后行业.map((组) => {
            const 选中 = 行业 === 组.行业;
            // 该行业下已选了几个方向，回显在卡上，用户退出细选页后知道自己选过
            const 已选方向数 = 组.细分.filter((项) => 已选.includes(`${项}（方向）`)).length;
            return (
              <button
                key={组.行业}
                className={`${样式.行业卡} ${选中 ? 样式.行业卡选中 : ''} 可点`}
                onClick={() => 进细选(组.行业)}
              >
                <单选点 选中={选中} 尺寸={19} />
                <span className={样式.行业文字组}>
                  <span className={样式.行业名}>
                    {组.行业}
                    {已选方向数 > 0 ? (
                      <span className={样式.方向计数}>{已选方向数} 个方向</span>
                    ) : null}
                  </span>
                  <span className={样式.行业说明}>{组.说明}</span>
                </span>
                <span className={样式.尖括号}>›</span>
              </button>
            );
          })}
          {过滤后行业.length === 0 ? (
            <div className={样式.搜索无结果}>没有匹配的方向，换个词试试。</div>
          ) : null}
        </div>
      </div>

      <已选条 已选={已选} 移除={切换} />

      {当前组 ? (
        <方向细选页
          组={当前组}
          已选={已选}
          切换={切换}
          返回={() => 设细选行业(null)}
        />
      ) : null}
    </div>
  );
}

/** 行业二级细选页：盖住整个引导壳（含进度条和主按钮），自带顶栏和已选条 */
function 方向细选页({
  组,
  已选,
  切换,
  返回,
}: {
  组: (typeof 行业字典)[number];
  已选: string[];
  切换: (项: string) => void;
  返回: () => void;
}) {
  const 本行业已选 = 组.细分.filter((项) => 已选.includes(`${项}（方向）`));

  return (
    <div className={样式.细选层}>
      <div className={样式.细选顶栏}>
        <button className={`${样式.细选返回} 可点`} onClick={返回} aria-label="返回行业列表">
          ‹
        </button>
        <span className={样式.细选标题}>{组.行业}</span>
        <button className={`${样式.细选完成} 可点`} onClick={返回}>
          完成
        </button>
      </div>

      <div className={样式.细选说明}>{组.说明}</div>
      <div className={样式.细选提示}>
        选具体方向，可多选{本行业已选.length > 0 ? ` · 已选 ${本行业已选.length} 个` : ''}
      </div>

      <div className={`${样式.细选列表} 滚动区`}>
        <div className={样式.细选卡}>
            {组.细分.map((项) => {
            const 标签 = `${项}（方向）`;
            const 选中 = 已选.includes(标签);
            return (
              <button
                key={项}
                className={`${样式.细选项} ${选中 ? 样式.细选项选中 : ''} 可点`}
                onClick={() => 切换(标签)}
              >
                <span>{项}</span>
                <span className={样式.细选勾}>{选中 ? '✓' : ''}</span>
              </button>
            );
          })}
        </div>
      </div>

      <已选条 已选={已选} 移除={切换} />
    </div>
  );
}

// ── A3b 工作城市：当前定位 + 热门 + 按省份铺开（标注意见 21:45）────
function 城市题({ 已选, 切换 }: { 已选: string[]; 切换: (项: string) => void }) {
  const [关键词, 设关键词] = useState('');
  const 词 = 关键词.trim();

  // 搜索跨全国匹配，省名也算命中（输「浙」出浙江全省），比只搜热门 15 城实用
  const 搜索结果 =
    词 === ''
      ? []
      : 城市字典.flatMap((组) =>
          组.省.includes(词) ? 组.城市 : 组.城市.filter((城) => 城.includes(词))
        );

  return (
    <div className={样式.题体}>
      <div className={样式.标题上移2}>
        <页面大标题 标题="你理想的工作城市是" />
      </div>

      <搜索条 占位="搜索城市 / 省份" 值={关键词} 改变={设关键词} />

      <滚动区 样式覆盖={{ padding: '12px 18px 10px' }}>
        {词 === '' ? (
          <>
            <div className={样式.分组标}>当 前 定 位</div>
            <div className={样式.城市网格}>
              <城市键 城="上海" 选中={已选.includes('上海')} 按下={() => 切换('上海')} />
            </div>

            <div className={`${样式.分组标} ${样式.分组标间距}`}>热 门 城 市</div>
            <div className={样式.城市网格}>
              {热门城市.map((城) => (
                <城市键 key={城} 城={城} 选中={已选.includes(城)} 按下={() => 切换(城)} />
              ))}
            </div>

            {/* 按省份铺开：一省一组，省名当分组标 */}
            {城市字典.map((组) => (
              <div key={组.省}>
                <div className={`${样式.分组标} ${样式.分组标间距}`}>{组.省}</div>
                <div className={样式.城市网格}>
                  {组.城市.map((城) => (
                    <城市键
                      key={`${组.省}-${城}`}
                      城={城}
                      选中={已选.includes(城)}
                      按下={() => 切换(城)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </>
        ) : (
          <>
            <div className={样式.分组标}>搜 索 结 果</div>
            <div className={样式.城市网格}>
              {搜索结果.map((城) => (
                <城市键 key={城} 城={城} 选中={已选.includes(城)} 按下={() => 切换(城)} />
              ))}
            </div>
            {搜索结果.length === 0 ? (
              <div className={样式.搜索无结果}>没有匹配的城市，换个词试试。</div>
            ) : null}
          </>
        )}
      </滚动区>

      <已选条 已选={已选} 移除={切换} />
    </div>
  );
}

function 城市键({ 城, 选中, 按下 }: { 城: string; 选中: boolean; 按下: () => void }) {
  return (
    <button
      className={`${样式.城市键} ${选中 ? 样式.城市键选中 : ''} 可点`}
      onClick={按下}
    >
      {选中 ? `${城} ✓` : 城}
    </button>
  );
}

// ── A3c 期望薪资：双滚轮 + 手填（标注意见 21:47）─────────────
const 行高 = 46;
/**
 * 薪资档位（标注意见 2026-08-18：从 1K 开始、最高 250K；手填行同日按标注删除）。
 * 变步长，低段密、高段疏 —— 应届与实习集中在 1–10K，每 1K 一档才够用；
 * 高段再密排要滚上百下。
 *   1–10K → 1K 一档；10–30K → 2K；30–80K → 5K；80–250K → 10K。
 * 右轮（上限）单独多一档 260K：上限必须能大于最高的下限，否则下限选 250K 时上限没得选。
 */
const 薪资档 = [
  ...Array.from({ length: 10 }, (_, 序) => 序 + 1), // 1–10
  ...Array.from({ length: 10 }, (_, 序) => 12 + 序 * 2), // 12–30
  ...Array.from({ length: 10 }, (_, 序) => 35 + 序 * 5), // 35–80
  ...Array.from({ length: 17 }, (_, 序) => 90 + 序 * 10), // 90–250
];
const 上限薪资档 = [...薪资档, 260];

function 薪资题({
  下限,
  设下限,
  上限,
  设上限,
}: {
  下限: number;
  设下限: (档: number) => void;
  上限: number;
  设上限: (档: number) => void;
}) {
  return (
    <滚动区 样式覆盖={{ paddingBottom: 12 }}>
      <页面大标题 标题="期望现金月薪是？" />

      <div className={样式.薪资卡}>
        <div className={样式.薪资头}>
          <span className={样式.薪资头文字}>最低</span>
          <span className={样式.薪资头文字}>最高</span>
        </div>
        <div className={样式.轮容器}>
          {/* 中间档高亮底 + 两轮之间的连字符，都不接收点击 */}
          <div className={样式.轮高亮} />
          <span className={样式.轮连字}>—</span>
          <薪资轮 值={下限} 设值={设下限} 名称="最低月薪" />
          <薪资轮 值={上限} 设值={设上限} 名称="最高月薪" 档表={上限薪资档} />
        </div>
      </div>
    </滚动区>
  );
}

function 薪资轮({
  值,
  设值,
  名称,
  档表 = 薪资档,
}: {
  值: number;
  设值: (档: number) => void;
  名称: string;
  /** 左轮用 薪资档，右轮用 上限薪资档（多一档 260K）*/
  档表?: number[];
}) {
  const 轮引用 = useRef<HTMLDivElement>(null);
  const 防抖计时 = useRef(0);
  // 记住「本轮自己滚出来的值」，用来区分外部改值和自身滚动，避免回滚打架
  const 自报值 = useRef(值);

  const 当前序 = 档表.indexOf(值);

  useEffect(() => {
    // scroll-snap 只管吸附、不管初始位置，挂载时手动把初值那一档滚到正中间
    if (轮引用.current) 轮引用.current.scrollTop = 当前序 * 行高;
    return () => window.clearTimeout(防抖计时.current);
    // 只在挂载时定位一次，之后由用户滑动主导
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (值 === 自报值.current) return; // 自己滚出来的，不要再滚一次
    自报值.current = 值;
    if (当前序 >= 0 && 轮引用.current) 轮引用.current.scrollTop = 当前序 * 行高;
  }, [值, 当前序]);

  /** 滚动过程中会连续触发，防抖到停下（90ms 无新事件）再算落点，避免每帧 setState */
  const 处理滚动 = () => {
    const 位置 = 轮引用.current?.scrollTop ?? 0;
    window.clearTimeout(防抖计时.current);
    防抖计时.current = window.setTimeout(() => {
      const 落点 = Math.min(Math.max(Math.round(位置 / 行高), 0), 档表.length - 1);
      自报值.current = 档表[落点];
      设值(档表[落点]);
    }, 90);
  };

  return (
    <div
      ref={轮引用}
      className={`${样式.薪资轮} 滚动区`}
      onScroll={处理滚动}
      role="listbox"
      aria-label={名称}
    >
      {档表.map((档) => (
        <div key={档} className={样式.薪资档} role="option" aria-selected={档 === 值}>
          <span className={`${档 === 值 ? 样式.档选中 : 样式.档未选} 等宽数字`}>
            {档}K
          </span>
        </div>
      ))}
    </div>
  );
}

// ── A3e 硬性排除 ─────────────────────────────────────────────
const 排除候选 = ['大小周', '纯外包 / 乙方', '全现场办公', '频繁出差'];

function 排除题({ 已选, 切换 }: { 已选: string[]; 切换: (项: string) => void }) {
  const { 状态: 全局 } = use应用状态();
  // 学生分流：实习公司通常不必屏蔽，一键开关默认关；社会人现雇主本来就该挡，默认开
  const 在校生 = 全局.基本信息.身份 === '在校';
  const [自定义中, 设自定义中] = useState(false);
  const [自定义草稿, 设自定义草稿] = useState('');
  // 简历里出现过的公司（含现雇主）：一键屏蔽的来源
  const 简历里的公司 = useMemo(
    () => [...new Set(全局.简历经历.map((条) => 条.公司).filter(Boolean))],
    [全局.简历经历]
  );
  // 一键屏蔽简历里出现过的公司（标注 11:58）：开关状态决定初始列表是否并入简历公司
  const [一键屏蔽简历公司, 设一键屏蔽简历公司] = useState(!在校生);
  const [屏蔽公司, 设屏蔽公司] = useState<string[]>(在校生 ? [] : 简历里的公司);
  const [公司录入中, 设公司录入中] = useState(false);
  const [公司草稿, 设公司草稿] = useState('');

  // 用户自己写的排除条件也进同一个网格，写完即视为已选
  const 全部候选 = [...排除候选, ...已选.filter((项) => !排除候选.includes(项))];

  const 提交自定义 = () => {
    const 词 = 自定义草稿.trim();
    if (词 !== '' && !已选.includes(词)) 切换(词);
    设自定义草稿('');
    设自定义中(false);
  };

  const 提交公司 = () => {
    const 名 = 公司草稿.trim();
    if (名 !== '' && !屏蔽公司.includes(名)) 设屏蔽公司((旧) => [...旧, 名]);
    设公司草稿('');
    设公司录入中(false);
  };

  return (
    <滚动区 样式覆盖={{ paddingBottom: 12 }}>
      <页面大标题 标题="哪些情况直接排除？" />

      <div className={样式.排除区}>
        <div className={样式.排除网格}>
          {全部候选.map((项) => {
            const 选中 = 已选.includes(项);
            return (
              <button
                key={项}
                className={`${样式.排除键} ${选中 ? 样式.排除键选中 : ''} 可点`}
                onClick={() => 切换(项)}
              >
                {选中 ? `${项} ✓` : 项}
              </button>
            );
          })}
        </div>

        {自定义中 ? (
          <行内输入
            占位="例如：不接受长期夜班"
            值={自定义草稿}
            改变={设自定义草稿}
            提交={提交自定义}
          />
        ) : (
          <button className={`${样式.自定义排除} 可点`} onClick={() => 设自定义中(true)}>
            <span className={样式.自定义加号}>＋</span>
            <span className={样式.自定义文字}>
              还有什么不想要的？用你自己的话写 —— 大小周、频繁出差、汇报线太长…
              代理站在你这边替你挡掉和协商
            </span>
          </button>
        )}

        <div className={样式.屏蔽公司卡}>
          <div className={样式.屏蔽公司头}>
            <div>
              <div className={样式.屏蔽公司标题}>屏蔽公司</div>
              <div className={样式.屏蔽公司说明}>简历里出现过的公司</div>
            </div>
            {/* 标注 11:58：改成一键开关 —— 简历里的公司一次性全屏蔽，
                不必逐个手输（打开时把简历公司并进列表，关掉时撤走） */}
            <开关
              开={一键屏蔽简历公司}
              切换={() => {
                const 新值 = !一键屏蔽简历公司;
                设一键屏蔽简历公司(新值);
                设屏蔽公司((旧) =>
                  新值
                    ? [...new Set([...旧, ...简历里的公司])]
                    : 旧.filter((名) => !简历里的公司.includes(名))
                );
              }}
            />
          </div>

          <button
            className={`${样式.屏蔽公司添加} 可点`}
            onClick={() => 设公司录入中(true)}
          >
            ＋ 再加一家
          </button>

          {公司录入中 ? (
            <行内输入
              占位="公司名，可只写关键词"
              值={公司草稿}
              改变={设公司草稿}
              提交={提交公司}
            />
          ) : null}

          {屏蔽公司.length > 0 ? (
            <div className={样式.屏蔽公司标签组}>
              {屏蔽公司.map((名) => (
                <button
                  key={名}
                  className={`${样式.已选标签} 可点`}
                  onClick={() => 设屏蔽公司((旧) => 旧.filter((条) => 条 !== 名))}
                >
                  {名} ✕
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </滚动区>
  );
}

// ──「到岗节奏」题（原 A3f）已整体挪去 求职状态 屏 /onboard/status ──

// ── A3g 个人优势（备忘录式编辑 + GitHub）──────────────────────

function 优势题({ 文本, 设文本 }: { 文本: string; 设文本: (值: string) => void }) {
  // GitHub 链接默认未填：模拟真实新用户状态（标注意见 #3）
  const [GitHub链接, 设GitHub链接] = useState('');
  const [GitHub编辑中, 设GitHub编辑中] = useState(false);

  return (
    <滚动区 样式覆盖={{ paddingBottom: 12 }}>
      <页面大标题
        标题="怎么介绍你自己？"
        说明="已根据你上传的简历预先提取，直接删改即可。"
      />

      <div className={样式.优势卡}>
        <textarea
          className={样式.优势输入}
          value={文本}
          onChange={(事件) => 设文本(事件.target.value)}
          maxLength={500}
          aria-label="个人优势"
        />
        <div className={样式.优势底}>
          <span className={样式.优势提示}>✕ 删除一行：长按段落</span>
          <span className={`${样式.优势计数} 等宽数字`}>{文本.length} / 500</span>
        </div>
      </div>

      {/* 指向「工作经历」页的专业技能区块。这里只指路、不再复制一套标签编辑器：
          一是技能只该有一个写入口，二是本屏答案存在内存里，中途跳走会全丢。
          技能必须是标签而不是这段自由文本 —— 匿名初筛要逐条比对岗位技术要求，
          自由文本没法逐条核对。 */}
      <div className={样式.技能指路}>
        技能标签在「工作经历」页填 · 代理按标签逐条核对岗位的技术要求
      </div>

      {/* GitHub 链接：默认未填（标注意见 #3），点击行内输入，填了显示绿色 ✓ */}
      <div className={样式.GitHub卡}>
        <span className={样式.GitHub底}>
          <GitHub图标 />
        </span>
        <span className={样式.GitHub文字组}>
          <span className={样式.GitHub标题}>
            GitHub 链接<span className={样式.选填}>选填</span>
          </span>
          {GitHub编辑中 ? (
            <input
              className={样式.GitHub输入}
              value={GitHub链接}
              placeholder="github.com/你的用户名"
              autoFocus
              onChange={(事件) => 设GitHub链接(事件.target.value.trim())}
              onBlur={() => 设GitHub编辑中(false)}
              onKeyDown={(事件) => {
                if (事件.key === 'Enter' && !事件.nativeEvent.isComposing) 设GitHub编辑中(false);
              }}
            />
          ) : GitHub链接 ? (
            <button className={`${样式.GitHub值} 可点`} onClick={() => 设GitHub编辑中(true)}>
              {GitHub链接} ✓
            </button>
          ) : (
            <button className={`${样式.GitHub占位} 可点`} onClick={() => 设GitHub编辑中(true)}>
              粘贴你的 GitHub 主页链接
            </button>
          )}
        </span>
        <span className={样式.尖括号}>›</span>
      </div>

      <div className={样式.优势工具行}>
        {/* 重新提取 = 把编辑框恢复成简历里抽出来的原文 */}
        <button className={`${样式.优势工具主} 可点`} onClick={() => 设文本(个人优势文本)}>
          ◈ 重新从简历提取
        </button>
      </div>

    </滚动区>
  );
}

// ── 搜索条（期望职位 / 工作城市 共用，可真实输入并过滤）─────────
function 搜索条({
  占位,
  值,
  改变,
}: {
  占位: string;
  值: string;
  改变: (文本: string) => void;
}) {
  return (
    <div className={样式.搜索条}>
      <放大镜图标 尺寸={15} 色="var(--最弱)" 线宽={2.2} />
      <input
        className={样式.搜索输入}
        placeholder={占位}
        value={值}
        onChange={(事件) => 改变(事件.target.value)}
      />
    </div>
  );
}

// ── 底部已选条（点标签 ✕ 移除）───────────────────────────────
function 已选条({ 已选, 移除 }: { 已选: string[]; 移除: (项: string) => void }) {
  return (
    <div className={样式.已选条}>
      <span className={样式.已选标}>已选</span>
      <div className={样式.已选标签组}>
        {已选.map((项) => (
          <button
            key={项}
            className={`${样式.已选标签} 可点`}
            onClick={() => 移除(项)}
          >
            {项} ✕
          </button>
        ))}
      </div>
    </div>
  );
}

// ── 行内录入行（自定义排除条件 / 屏蔽公司 共用）────────────────
function 行内输入({
  占位,
  值,
  改变,
  提交,
}: {
  占位: string;
  值: string;
  改变: (文本: string) => void;
  提交: () => void;
}) {
  return (
    <div className={样式.行内输入行}>
      <input
        className={样式.行内输入}
        placeholder={占位}
        value={值}
        onChange={(事件) => 改变(事件.target.value)}
        onKeyDown={(事件) => {
          if (事件.key === 'Enter') 提交();
        }}
        enterKeyHint="done"
        autoFocus
      />
      <button className={`${样式.行内确认} 可点`} onClick={提交}>
        添加
      </button>
    </div>
  );
}
