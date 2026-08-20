// 公司主页资料 · 企业端维护入口（/hr/company-profile）
//
// 标注 2026-08-20 14:35：整屏按 BOSS直聘「公司主页编辑」的信息架构重做，
// 视觉走我们自己的一套（荧光绿 / 墨 / 极简），不照抄它的蓝色与卡片阴影。
//
// 结构（自上而下就是候选人看这家公司的顺序）：
//   1. 名片式预览 —— LOGO + 公司全称 + 一句话简介，上面改哪一个字，这里立刻跟着变；
//   2. 公司资料 —— 全称 / 一句话简介 / 公司介绍 / 企业文化 / 发展历程；
//   3. 行业与规模 —— 行业 / 规模 / 融资阶段，各自点开底部选择层，档位单选；
//   4. 办公 —— 办公地址 / 地址补充 / 上班时间段 / 作息；
//   5. 公司标签 —— 多选片。
//
// 刻意不放进来的东西（与不对称双盲及「代理档案而非宣传册」的立场直接相关）：
//   · 工商信息 —— 第三方核验的结果，企业自己改了就没有可信度可言；
//   · 代理核对结果与在职者反馈 —— 那是平台与候选人侧产生的，企业不该有编辑权。
//
// 数据落全局 + localStorage：LOGO 走独立切片（存公司LOGO / AGXP公司LOGOv1），
// 其余走 存公司自述。候选端 企业详情 读的是 名称 / 首字 / 规模行 / 作息 这几个
// **合成字段**，所以保存时要把拆开编辑的 行业·规模·融资阶段、上班时间·作息档
// 重新拼回去 —— 候选端一行代码都不用改，也就不会因为本屏改版而报错。

import { useRef, useState } from 'react';
import 公用 from './我的功能页.module.css';
import 样式 from './公司档案编辑.module.css';
import { 次级页外壳, 返回栏, 滚动区, 主按钮, 公司字标 } from '../组件/通用';
import { 轻提示 } from '../组件/轻提示';
import { 相机图标 } from '../组件/图标';
import { use导航 } from '../路由/导航钩子';
import { 取公司档案 } from '../数据/公司档案';
import { use应用状态 } from '../状态/应用状态';

/** 原型阶段固定编辑云衢科技这一家（= 当前登录的招聘方）*/
const 本公司键 = 'yunqu';

// ── 档位池：单选层里的可选值，全部是数据本身，不带解释 ──
const 行业池 = [
  '金融科技',
  '企业服务',
  '人工智能',
  '电子商务',
  '医疗健康',
  '智能硬件',
  '汽车出行',
  '物流供应链',
  '新能源',
  '文化传媒',
  '游戏',
  '教育培训',
];

const 规模池 = ['20 人以下', '20-99 人', '100-499 人', '500-1000 人', '1000-9999 人', '10000 人以上'];

const 融资阶段池 = [
  '未融资',
  '天使轮',
  'A 轮',
  'B 轮',
  'C 轮',
  'D 轮及以上',
  '已上市',
  '不需要融资',
];

const 作息池 = ['双休', '大小周', '单休'];

const 公司标签池 = [
  '五险一金',
  '补充医疗',
  '股票期权',
  '弹性工作',
  '年度体检',
  '定期体检',
  '带薪年假',
  '餐补',
  '交通补助',
  '住房补贴',
  '节日福利',
  '团建聚餐',
  '零食下午茶',
  '加班补助',
  '年终奖',
  '免费班车',
  '定期培训',
];

/** 把用户选的图片压成 128×128 居中裁切的 JPEG dataURL —— 实现镜像 招聘名片 的
 *  压成头像，只是边长换成 LOGO 用的 128（约 6-12KB，localStorage 装得下） */
function 压成LOGO(文件: File): Promise<string> {
  return new Promise((成, 败) => {
    const 读 = new FileReader();
    读.onerror = () => 败(new Error('读取失败'));
    读.onload = () => {
      const 图 = new Image();
      图.onerror = () => 败(new Error('不是可用的图片'));
      图.onload = () => {
        const 边 = 128;
        const 画布 = document.createElement('canvas');
        画布.width = 边;
        画布.height = 边;
        const 笔 = 画布.getContext('2d')!;
        const 源边 = Math.min(图.width, 图.height);
        笔.drawImage(图, (图.width - 源边) / 2, (图.height - 源边) / 2, 源边, 源边, 0, 0, 边, 边);
        成(画布.toDataURL('image/jpeg', 0.85));
      };
      图.src = String(读.result);
    };
    读.readAsDataURL(文件);
  });
}

/** 静态档的 规模行 是「C 轮 · 500-1000 人 · 金融科技」这一串，
 *  本屏拆成三个可单选的档位，所以进来时要按 ' · ' 拆开 */
function 拆规模行(规模行: string): { 融资阶段: string; 规模: string; 行业: string } {
  const 段 = 规模行.split('·').map((条) => 条.trim());
  return { 融资阶段: 段[0] ?? '', 规模: 段[1] ?? '', 行业: 段[2] ?? '' };
}

/** 静态档的 作息 是「上午 09:30 – 下午 07:00 · 双休 · 大小周已取消」，
 *  把两个钟点抠出来换成 24 小时制（time 输入框只认 HH:MM） */
function 拆时间段(作息文: string): { 上班: string; 下班: string } {
  const 命中 = [...作息文.matchAll(/(上午|下午|晚上)?\s*(\d{1,2}):(\d{2})/g)];
  const 换算 = (段: RegExpMatchArray) => {
    let 时 = Number(段[2]);
    if ((段[1] === '下午' || 段[1] === '晚上') && 时 < 12) 时 += 12;
    return `${String(时).padStart(2, '0')}:${段[3]}`;
  };
  return {
    上班: 命中[0] ? 换算(命中[0]) : '09:30',
    下班: 命中[1] ? 换算(命中[1]) : '19:00',
  };
}

/** 作息档：'双休 · 大小周已取消' 里 双休 在前，按池子顺序取第一个命中的即可 */
function 拆作息档(作息文: string): string {
  return 作息池.find((档) => 作息文.includes(档)) ?? 作息池[0];
}

/** 一句话简介没存过时，取公司简介的第一句当默认值 —— 用公司自己的原话，不另写文案 */
function 取首句(段落: string): string {
  const 句 = 段落.split('。')[0];
  return 句 ? `${句}。` : '';
}

export default function 公司档案编辑() {
  const { 返回 } = use导航();
  const { 状态, 派发 } = use应用状态();
  const 静态档 = 取公司档案(本公司键);
  // 改过就用改过的，没改过用静态档
  const 覆盖 = 状态.公司自述;
  const 档 = 覆盖 ? { ...静态档, ...覆盖 } : 静态档;
  const 静态规模 = 拆规模行(静态档.规模行);
  const 静态时间 = 拆时间段(静态档.作息);

  const LOGO框 = useRef<HTMLInputElement>(null);

  // ── 公司资料 ──
  const [公司全称, 设公司全称] = useState(档.名称);
  const [一句话简介, 设一句话简介] = useState(
    覆盖?.一句话简介 ?? 取首句(静态档.简介[0] ?? '')
  );
  // 三段自述在数据层是数组 / 结构化节点，编辑时摊成多行文本，一行一条，够用且好改
  const [公司介绍, 设公司介绍] = useState(档.简介.join('\n'));
  const [企业文化, 设企业文化] = useState(档.企业文化);
  const [发展历程, 设发展历程] = useState(
    档.发展历程.map((节) => `${节.年份} ${节.事件}`).join('\n')
  );

  // ── 行业与规模 ──
  const [行业, 设行业] = useState(覆盖?.行业 ?? 静态规模.行业);
  const [规模, 设规模] = useState(覆盖?.规模 ?? 静态规模.规模);
  const [融资阶段, 设融资阶段] = useState(覆盖?.融资阶段 ?? 静态规模.融资阶段);

  // ── 办公 ──
  const [办公地址, 设办公地址] = useState(档.地址);
  const [地址补充, 设地址补充] = useState(档.地址补充);
  const [上班时间, 设上班时间] = useState(覆盖?.上班时间 ?? 静态时间.上班);
  const [下班时间, 设下班时间] = useState(覆盖?.下班时间 ?? 静态时间.下班);
  const [作息档, 设作息档] = useState(覆盖?.作息档 ?? 拆作息档(静态档.作息));

  // ── 公司标签：没存过时，把静态福利里能对上池子的挑出来当默认 ──
  const [公司标签, 设公司标签] = useState<string[]>(
    () => 覆盖?.公司标签 ?? 静态档.福利.map((项) => 项.名称).filter((名) => 公司标签池.includes(名))
  );

  // 当前打开的是哪个单选层（null = 都关着）
  const [选择层, 设选择层] = useState<'行业' | '规模' | '融资阶段' | '作息' | null>(null);

  async function 选了LOGO(事件: React.ChangeEvent<HTMLInputElement>) {
    const 文件 = 事件.target.files?.[0];
    事件.target.value = ''; // 允许再次选同一张
    if (!文件) return;
    try {
      派发({ 型: '存公司LOGO', 图: await 压成LOGO(文件) });
      轻提示('LOGO 已更新');
    } catch {
      轻提示('这张图片读不出来，换一张试试');
    }
  }

  function 切标签(名: string) {
    设公司标签((旧) => (旧.includes(名) ? 旧.filter((条) => 条 !== 名) : [...旧, 名]));
  }

  const 保存 = () => {
    // 全称留空就退回原值：候选端 企业详情 拿 名称 当页面标题、拿 首字 画字标，
    // 存进一个空串会让那一屏顶部整块塌掉（空标题 + 空字标）
    const 落库全称 = 公司全称.trim() || 档.名称;
    派发({
      型: '存公司自述',
      值: {
        简介: 公司介绍.split('\n').map((行) => 行.trim()).filter(Boolean),
        企业文化,
        // 「2023 成立…」逐行拆回结构化节点；没有年份前缀的整行当事件
        发展历程: 发展历程
          .split('\n')
          .map((行) => 行.trim())
          .filter(Boolean)
          .map((行) => {
            const 命中 = /^(\d{4})\s+(.*)$/.exec(行);
            return 命中 ? { 年份: 命中[1], 事件: 命中[2] } : { 年份: '', 事件: 行 };
          }),
        // 候选端读的合成字段：作息 = 上班时间段 + 作息档，规模行 = 融资 · 规模 · 行业
        作息: `${上班时间} – ${下班时间} · ${作息档}`,
        地址: 办公地址,
        地址补充,
        名称: 落库全称,
        首字: 落库全称.charAt(0),
        一句话简介,
        行业,
        规模,
        融资阶段,
        规模行: [融资阶段, 规模, 行业].filter(Boolean).join(' · '),
        上班时间,
        下班时间,
        作息档,
        公司标签,
      },
    });
    轻提示('已保存');
    返回();
  };

  return (
    <次级页外壳>
      <返回栏 返回={返回} 标题="公司主页资料" />

      <滚动区 样式覆盖={{ padding: '12px 18px 20px' }}>
        {/* ── 名片式预览：候选人在公司主页顶部看到的那一块，改完即时回显 ── */}
        <div className={样式.预览卡}>
          <button
            className={`${样式.LOGO键} 可点`}
            onClick={() => LOGO框.current?.click()}
            aria-label="上传公司 LOGO"
          >
            {状态.公司LOGO ? (
              <img className={样式.LOGO图} src={状态.公司LOGO} alt="" />
            ) : (
              <公司字标
                首字={公司全称.charAt(0)}
                尺寸={56}
                圆角={16}
                底色="var(--墨)"
                字色="var(--荧光绿)"
                描边={false}
                字号={23}
              />
            )}
            <span className={样式.相机角标}>
              <相机图标 尺寸={11} 色="var(--正文)" />
            </span>
          </button>
          <input
            ref={LOGO框}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={选了LOGO}
          />
          <div className={样式.预览文字}>
            <div className={`${样式.预览公司名} 单行`}>{公司全称}</div>
            <div className={样式.预览简介}>{一句话简介}</div>
            <div className={`${样式.预览规模行} 单行`}>
              {[融资阶段, 规模, 行业].filter(Boolean).join(' · ')}
            </div>
          </div>
        </div>

        <div className={公用.组标}>公司资料</div>
        <div className={样式.卡}>
          <单行字段 标签="公司全称" 值={公司全称} 改变={设公司全称} 上限={40} />
          <单行字段 标签="一句话简介" 值={一句话简介} 改变={设一句话简介} 上限={40} />
          <多行字段 标签="公司介绍" 值={公司介绍} 改变={设公司介绍} 高度={132} 上限={500} />
          <多行字段 标签="企业文化" 值={企业文化} 改变={设企业文化} 高度={84} 上限={200} />
          <多行字段 标签="发展历程" 值={发展历程} 改变={设发展历程} 高度={110} 上限={400} 末条 />
        </div>

        <div className={`${公用.组标} ${公用.组标间距}`}>行业与规模</div>
        <div className={样式.卡}>
          <选择行 标签="行业" 值={行业} 按下={() => 设选择层('行业')} />
          <选择行 标签="规模" 值={规模} 按下={() => 设选择层('规模')} />
          <选择行 标签="融资阶段" 值={融资阶段} 按下={() => 设选择层('融资阶段')} 末条 />
        </div>

        <div className={`${公用.组标} ${公用.组标间距}`}>办公</div>
        <div className={样式.卡}>
          {/* 地址与补充都可能写得很长，用会换行的多行框；单行 input 在窄屏上会把后半截截掉 */}
          <多行字段 标签="办公地址" 值={办公地址} 改变={设办公地址} 高度={62} 上限={80} 无计数 />
          <多行字段 标签="地址补充" 值={地址补充} 改变={设地址补充} 高度={62} 上限={60} 无计数 />
          <div className={样式.字段}>
            <div className={样式.字段标签}>上班时间段</div>
            <div className={样式.时间行}>
              <input
                className={样式.时间输入}
                type="time"
                value={上班时间}
                aria-label="上班时间"
                onChange={(事件) => 设上班时间(事件.target.value)}
              />
              <span className={样式.时间连字}>–</span>
              <input
                className={样式.时间输入}
                type="time"
                value={下班时间}
                aria-label="下班时间"
                onChange={(事件) => 设下班时间(事件.target.value)}
              />
            </div>
          </div>
          <选择行 标签="作息" 值={作息档} 按下={() => 设选择层('作息')} 末条 />
        </div>

        <div className={`${公用.组标} ${公用.组标间距}`}>公司标签</div>
        <div className={样式.卡}>
          <div className={`${样式.字段} ${样式.末条}`}>
            <div className={样式.片行}>
              {公司标签池.map((名) => {
                const 选中 = 公司标签.includes(名);
                return (
                  <button
                    key={名}
                    className={`${样式.片} ${选中 ? 样式.片选中 : ''} 可点`}
                    aria-pressed={选中}
                    onClick={() => 切标签(名)}
                  >
                    {名}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </滚动区>

      <主按钮 文字="保存" 按下={保存} />

      {/* ── 底部单选层：行业 / 规模 / 融资阶段 / 作息 共用一套 ── */}
      {选择层 === '行业' ? (
        <单选层 标题="行业" 选项={行业池} 当前={行业} 选中={设行业} 关闭={() => 设选择层(null)} />
      ) : null}
      {选择层 === '规模' ? (
        <单选层 标题="规模" 选项={规模池} 当前={规模} 选中={设规模} 关闭={() => 设选择层(null)} />
      ) : null}
      {选择层 === '融资阶段' ? (
        <单选层
          标题="融资阶段"
          选项={融资阶段池}
          当前={融资阶段}
          选中={设融资阶段}
          关闭={() => 设选择层(null)}
        />
      ) : null}
      {选择层 === '作息' ? (
        <单选层
          标题="作息"
          选项={作息池}
          当前={作息档}
          选中={设作息档}
          关闭={() => 设选择层(null)}
        />
      ) : null}
    </次级页外壳>
  );
}

/** 一条单行字段：小标签 + 单行输入（公司全称、一句话简介这种一行就写得下的） */
function 单行字段({
  标签,
  值,
  改变,
  上限,
  末条 = false,
}: {
  标签: string;
  值: string;
  改变: (值: string) => void;
  上限: number;
  末条?: boolean;
}) {
  return (
    <div className={`${样式.字段} ${末条 ? 样式.末条 : ''}`}>
      <div className={样式.字段标签}>{标签}</div>
      <input
        className={样式.单行输入}
        value={值}
        maxLength={上限}
        onChange={(事件) => 改变(事件.target.value)}
        aria-label={标签}
      />
    </div>
  );
}

/** 一条多行字段：小标签 + 会换行的多行输入 + 字数（短字段用 无计数 关掉计数，少一行小字）*/
function 多行字段({
  标签,
  值,
  改变,
  高度,
  上限,
  无计数 = false,
  末条 = false,
}: {
  标签: string;
  值: string;
  改变: (值: string) => void;
  高度: number;
  上限: number;
  无计数?: boolean;
  末条?: boolean;
}) {
  return (
    <div className={`${样式.字段} ${末条 ? 样式.末条 : ''}`}>
      <div className={样式.字段标签}>{标签}</div>
      <textarea
        className={样式.多行输入}
        style={{ height: 高度 }}
        value={值}
        maxLength={上限}
        onChange={(事件) => 改变(事件.target.value)}
        aria-label={标签}
      />
      {无计数 ? null : (
        <div className={`${样式.字数} 等宽数字`}>
          {值.length} / {上限}
        </div>
      )}
    </div>
  );
}

/** 一条选择行：小标签 + 当前档位 + 尖括号，点开底部单选层 */
function 选择行({
  标签,
  值,
  按下,
  末条 = false,
}: {
  标签: string;
  值: string;
  按下: () => void;
  末条?: boolean;
}) {
  return (
    <button className={`${样式.字段} ${末条 ? 样式.末条 : ''} ${样式.选择行} 可点`} onClick={按下}>
      <span className={样式.字段标签}>{标签}</span>
      <span className={样式.选择值行}>
        <span className={`${样式.选择值} 单行`}>{值}</span>
        <span className={样式.尖括号}>›</span>
      </span>
    </button>
  );
}

/** 底部升起的单选层：档位平铺成片，点一片即选中并收起（少一次「确定」）*/
function 单选层({
  标题,
  选项,
  当前,
  选中,
  关闭,
}: {
  标题: string;
  选项: string[];
  当前: string;
  选中: (值: string) => void;
  关闭: () => void;
}) {
  return (
    <>
      <div className={样式.遮罩} onClick={关闭} />
      <div className={样式.层}>
        <div className={样式.层标题}>{标题}</div>
        <div className={样式.层片行}>
          {选项.map((项) => (
            <button
              key={项}
              className={`${样式.片} ${项 === 当前 ? 样式.片选中 : ''} 可点`}
              aria-pressed={项 === 当前}
              onClick={() => {
                选中(项);
                关闭();
              }}
            >
              {项}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
