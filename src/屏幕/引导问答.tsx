// A3a–A3g 七题引导 —— 移植 RN 版 应用/屏幕/引导问答.js，像素值一比一。
//
// 一页一题，顶部七段进度条随题推进，七题顺序：
// 状态分流 → 期望职位 → 工作城市 → 期望薪资 → 硬性排除 → 到岗节奏 → 个人优势。
// 返回键：第一题退出本屏（回上一屏），其余题回上一题。
// 最后一题「保存并继续」进 A4 披露说明。
//
// 答案只存在内存里（原型层不落盘），所以全部用 useState，不进全局应用状态。
//
// 薪资那一题 RN 里靠 snapToInterval 做原生吸附，Web 上改用
// scroll-snap-type: y mandatory + scroll-snap-align: center —— 吸附交给浏览器，
// 只需在滚动停下后算一次落点，比 RN 版更省代码且手感一致。

import { useEffect, useRef, useState } from 'react';
import 样式 from './引导问答.module.css';
import { 主按钮, 单选点, 次级页外壳, 滚动区, 页面大标题, 返回栏 } from '../组件/通用';
import { GitHub图标, 放大镜图标 } from '../组件/图标';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { 个人优势文本 } from '../数据/模拟数据';

const 题目顺序 = [
  '状态分流',
  '期望职位',
  '工作城市',
  '期望薪资',
  '硬性排除',
  '到岗节奏',
  '个人优势',
] as const;

type 题名 = (typeof 题目顺序)[number];

export default function 引导问答() {
  const { 跳转, 返回 } = use导航();
  const [第几题, 设第几题] = useState(0);
  const 当前题: 题名 = 题目顺序[第几题];

  // ── 七题的答案 ──
  const [状态, 设状态] = useState('在职 · 保密找机会');
  const [已选职位, 设已选职位] = useState(['后端开发', '交易 / 支付系统', '金融科技（行业）']);
  const [已选城市, 设已选城市] = useState(['上海']);
  const [薪资下限, 设薪资下限] = useState(50);
  const [薪资上限, 设薪资上限] = useState(60);
  const [排除项, 设排除项] = useState(['大小周', '纯外包 / 乙方']);
  const [到岗, 设到岗] = useState('在职 · 考虑机会');
  const [自我介绍, 设自我介绍] = useState(个人优势文本);

  /** 多选题共用的「有则去掉、无则加上」 */
  const 造切换 = (设值: (更新: (旧: string[]) => string[]) => void) => (项: string) =>
    设值((旧) => (旧.includes(项) ? 旧.filter((条) => 条 !== 项) : [...旧, 项]));

  const 下一题 = () => {
    if (第几题 < 题目顺序.length - 1) 设第几题(第几题 + 1);
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
          {题目顺序.map((题, 序) => (
            <span
              key={题}
              className={`${样式.进度段} ${序 <= 第几题 ? 样式.进度段已过 : ''}`}
            />
          ))}
        </div>

        {当前题 === '状态分流' ? <状态分流题 当前={状态} 设置={设状态} /> : null}
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
        {当前题 === '到岗节奏' ? <到岗题 当前={到岗} 设置={设到岗} /> : null}
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

// ── A3a 状态分流：两张单选卡 ──────────────────────────────────
interface 单选项 {
  键: string;
  说明: string;
}

const 状态选项: 单选项[] = [
  { 键: '在职 · 保密找机会', 说明: '自动屏蔽现雇主及关联公司，披露默认更保守' },
  { 键: '已离职 · 公开找', 说明: '无需屏蔽，AI代理节奏更快、披露更主动' },
];

function 状态分流题({ 当前, 设置 }: { 当前: string; 设置: (键: string) => void }) {
  return (
    <滚动区 样式覆盖={{ paddingBottom: 10 }}>
      <页面大标题 标题="你现在的状态是？" />
      <div className={样式.选项列}>
        {状态选项.map((项) => {
          const 选中 = 当前 === 项.键;
          return (
            <button
              key={项.键}
              className={`${样式.选项卡} ${选中 ? 样式.选项卡选中 : ''} 可点`}
              onClick={() => 设置(项.键)}
            >
              <span className={样式.选项文字组}>
                <span className={样式.选项标题}>{项.键}</span>
                <span className={样式.选项说明}>{项.说明}</span>
              </span>
              <单选点 选中={选中} />
            </button>
          );
        })}
      </div>
    </滚动区>
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

interface 行业卡片项 {
  名称: string;
  说明: string;
}

const 行业卡片: 行业卡片项[] = [
  {
    名称: '金融科技',
    说明: '支付、清结算、交易系统与风控，对高并发与合规要求高，现金薪酬普遍领先',
  },
  {
    名称: '互联网平台',
    说明: '电商、本地生活、内容社区等大流量业务，迭代节奏快、晋升通道清晰',
  },
  { 名称: '企业服务 / SaaS', 说明: '面向企业客户的软件与基础设施，重工程质量与长期交付' },
  {
    名称: '云计算 / 基础软件',
    说明: '存储、数据库、中间件与开发者工具，技术纵深最好的方向之一',
  },
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

  // 行业是单选语义：换行业时要把旧的「xx（行业）」标签替换掉，而不是 toggle 追加，
  // 否则圆点亮的和底部已选标签会脱节（亮的没标签、有标签的没亮）
  const 选行业 = (名称: string) => {
    设行业(名称);
    设已选((旧) => [...旧.filter((条) => !条.endsWith('（行业）')), `${名称}（行业）`]);
  };

  // 原型阶段右栏只有行业卡这一层数据，左栏切分类只改高亮；
  // 搜索词按名称过滤，保证搜索框是真能用的，不是摆设
  const 词 = 关键词.trim();
  const 过滤后行业 = 词 === '' ? 行业卡片 : 行业卡片.filter((卡) => 卡.名称.includes(词));

  return (
    <div className={样式.题体}>
      <div className={样式.标题上移4}>
        <页面大标题 标题="期望职位是" />
      </div>

      <搜索条 占位="搜索职位名称" 值={关键词} 改变={设关键词} />

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
          {过滤后行业.map((卡) => {
            const 选中 = 行业 === 卡.名称;
            return (
              <button
                key={卡.名称}
                className={`${样式.行业卡} ${选中 ? 样式.行业卡选中 : ''} 可点`}
                onClick={() => 选行业(卡.名称)}
              >
                <单选点 选中={选中} 尺寸={19} />
                <span className={样式.行业文字组}>
                  <span className={样式.行业名}>{卡.名称}</span>
                  <span className={样式.行业说明}>{卡.说明}</span>
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
    </div>
  );
}

// ── A3b 工作城市：三列网格多选 ────────────────────────────────
const 热门城市 = [
  '北京',
  '上海',
  '广州',
  '深圳',
  '杭州',
  '天津',
  '西安',
  '苏州',
  '武汉',
  '厦门',
  '长沙',
  '成都',
  '郑州',
  '重庆',
  '南京',
];

function 城市题({ 已选, 切换 }: { 已选: string[]; 切换: (项: string) => void }) {
  const [关键词, 设关键词] = useState('');
  const 词 = 关键词.trim();
  // 搜索时收起「当前定位」，只在热门城市里过滤
  const 过滤后城市 = 词 === '' ? 热门城市 : 热门城市.filter((城) => 城.includes(词));

  return (
    <div className={样式.题体}>
      <div className={样式.标题上移2}>
        <页面大标题 标题="你理想的工作城市是" />
      </div>

      <搜索条 占位="搜索城市名 / 拼音" 值={关键词} 改变={设关键词} />

      <滚动区 样式覆盖={{ padding: '12px 18px 10px' }}>
        {词 === '' ? (
          <>
            <div className={样式.分组标}>当 前 定 位</div>
            <div className={样式.城市网格}>
              <城市键 城="上海" 选中={已选.includes('上海')} 按下={() => 切换('上海')} />
            </div>
          </>
        ) : null}

        <div className={`${样式.分组标} ${词 === '' ? 样式.分组标间距 : ''}`}>
          热 门 城 市
        </div>
        <div className={样式.城市网格}>
          {过滤后城市.map((城) => (
            <城市键 key={城} 城={城} 选中={已选.includes(城)} 按下={() => 切换(城)} />
          ))}
        </div>
        {过滤后城市.length === 0 ? (
          <div className={样式.搜索无结果}>没有匹配的城市，换个词试试。</div>
        ) : null}
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

// ── A3c 期望薪资双滚轮 ───────────────────────────────────────
const 行高 = 46;
/** 15K–145K，每 5K 一档，共 27 档 */
const 薪资档 = [...Array(27).keys()].map((序) => 15 + 序 * 5);

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
      <页面大标题
        标题="期望现金月薪是？"
        说明="底线只有你的 AI 代理知道，永不披露给对方；对外只回答「有无交集」。"
      />

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
          <薪资轮 值={上限} 设值={设上限} 名称="最高月薪" />
        </div>
      </div>
    </滚动区>
  );
}

function 薪资轮({
  值,
  设值,
  名称,
}: {
  值: number;
  设值: (档: number) => void;
  名称: string;
}) {
  const 轮引用 = useRef<HTMLDivElement>(null);
  const 防抖计时 = useRef(0);
  // 只取首次渲染时的初值序号：挂载定位一次，之后由用户滑动主导
  const 初值序 = useRef(Math.max(0, 薪资档.indexOf(值)));

  useEffect(() => {
    const 元素 = 轮引用.current;
    // scroll-snap 只管吸附、不管初始位置，必须手动把初值那一档滚到正中间
    if (元素) 元素.scrollTop = 初值序.current * 行高;
    return () => window.clearTimeout(防抖计时.current);
  }, []);

  /** 滚动过程中会连续触发，防抖到停下（90ms 无新事件）再算落点，避免每帧 setState */
  const 处理滚动 = () => {
    const 位置 = 轮引用.current?.scrollTop ?? 0;
    window.clearTimeout(防抖计时.current);
    防抖计时.current = window.setTimeout(() => {
      const 落点 = Math.min(Math.max(Math.round(位置 / 行高), 0), 薪资档.length - 1);
      设值(薪资档[落点]);
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
      {薪资档.map((档) => (
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
  const [自定义中, 设自定义中] = useState(false);
  const [自定义草稿, 设自定义草稿] = useState('');
  const [屏蔽公司, 设屏蔽公司] = useState<string[]>([]);
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
              其他排除条件，用你的话写，AI代理会照着执行
            </span>
          </button>
        )}

        <div className={样式.屏蔽公司卡}>
          <div className={样式.屏蔽公司头}>
            <div>
              <div className={样式.屏蔽公司标题}>屏蔽公司</div>
              <div className={样式.屏蔽公司说明}>现雇主及关联 · 已自动屏蔽 ✓</div>
            </div>
            <button
              className={`${样式.屏蔽公司添加} 可点`}
              onClick={() => 设公司录入中(true)}
            >
              ＋ 添加
            </button>
          </div>

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

// ── A3f 到岗节奏 ─────────────────────────────────────────────
interface 到岗项 {
  键: string;
  徽标?: string;
  尾注?: string;
}

const 到岗选项: 到岗项[] = [
  { 键: '离职 · 随时到岗', 徽标: '优先推荐' },
  { 键: '在职 · 月内到岗', 徽标: '优先推荐' },
  { 键: '在职 · 考虑机会' },
  { 键: '在职 · 暂不考虑', 尾注: '仅高分匹配才提醒' },
];

function 到岗题({ 当前, 设置 }: { 当前: string; 设置: (键: string) => void }) {
  return (
    <滚动区 样式覆盖={{ paddingBottom: 12 }}>
      <页面大标题
        标题="现在是什么状态？"
        说明="状态影响你被推荐的频率，以及AI代理的催问节奏。"
      />

      <div className={样式.到岗列}>
        {到岗选项.map((项) => {
          const 选中 = 当前 === 项.键;
          return (
            <button
              key={项.键}
              className={`${样式.到岗卡} ${选中 ? 样式.到岗卡选中 : ''} 可点`}
              onClick={() => 设置(项.键)}
            >
              <span className={样式.到岗文字组}>
                <span className={样式.到岗标题}>{项.键}</span>
                {项.徽标 ? <span className={样式.优先徽标}>{项.徽标}</span> : null}
                {项.尾注 ? <span className={样式.到岗尾注}>{项.尾注}</span> : null}
              </span>
              {选中 ? <span className={样式.绿勾}>✓</span> : null}
            </button>
          );
        })}
      </div>
    </滚动区>
  );
}

// ── A3g 个人优势（备忘录式编辑 + GitHub）──────────────────────
const 优势示例文本 =
  '写法参考：一句话讲清最硬的战绩（带数字），再补一句你看重什么。例如「主导支付网关重构，峰值 32 万 QPS；看重技术纵深」。';

function 优势题({ 文本, 设文本 }: { 文本: string; 设文本: (值: string) => void }) {
  const [看示例, 设看示例] = useState(false);

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

      <div className={样式.GitHub卡}>
        <span className={样式.GitHub底}>
          <GitHub图标 />
        </span>
        <span className={样式.GitHub文字组}>
          <span className={样式.GitHub标题}>
            GitHub 链接<span className={样式.选填}>选填</span>
          </span>
          <span className={样式.GitHub值}>github.com/shenyz-arch ✓</span>
        </span>
        <span className={样式.尖括号}>›</span>
      </div>

      <div className={样式.优势工具行}>
        {/* 重新提取 = 把编辑框恢复成简历里抽出来的原文 */}
        <button className={`${样式.优势工具主} 可点`} onClick={() => 设文本(个人优势文本)}>
          ◈ 重新从简历提取
        </button>
        <button className={`${样式.优势工具次} 可点`} onClick={() => 设看示例(!看示例)}>
          看看别人怎么写 {看示例 ? '⌃' : '›'}
        </button>
      </div>

      {看示例 ? <div className={样式.优势示例}>{优势示例文本}</div> : null}
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
