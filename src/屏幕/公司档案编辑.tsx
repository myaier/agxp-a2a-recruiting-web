// 公司主页资料 · 企业端维护入口（/hr/company-profile）
//
// 标注 2026-08-20 15:10：整屏从「单页长表单」改成「分区清单」——
// 一屏只是目录（每个分区一行：分区名 + 计数 / 摘要 / 去添加），点行升起该分区的
// 底部编辑层，改完在层里保存、层收起、清单上的计数与顶部完善度立刻跟着变。
// 规格见 docs/design/公司主页资料编辑规格.md（用户截图的信息架构，一比一照搬分区与计数）。
//
// 九个分区（顺序即候选人看这家公司的顺序）：
//   基本信息 N/6 · 公司福利 N/2 · 公司介绍 · 主营业务 · 公司相册 N/3 ·
//   人才发展 · 在职感受 · 产品介绍 · 高管介绍
//
// 刻意不放进来的东西（与不对称双盲及「代理档案而非宣传册」的立场直接相关）：
//   · 工商信息 —— 第三方核验的结果，企业自己改了就没有可信度可言；
//   · 代理核对结果与在职者反馈 —— 那是平台与候选人侧产生的，企业不该有编辑权。
//
// 数据链路保持不变：LOGO 走独立切片（存公司LOGO / AGXP公司LOGOv1），其余走
// 存公司自述（AGXP公司自述v1）。候选端 企业详情 读的是 名称 / 首字 / 规模行 / 作息
// 这几个**合成字段**，所以每次保存都要把拆开编辑的 行业·规模·融资阶段、作息档
// 重新拼回去；本屏不再编辑的 企业文化 / 发展历程 / 地址补充 也要原样带过去，
// 否则它们会在覆盖里丢键、候选端那几段塌成空。

import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import 样式 from './公司档案编辑.module.css';
import { 次级页外壳, 返回栏, 滚动区, 页面大标题 } from '../组件/通用';
import { 轻提示 } from '../组件/轻提示';
import { 相机图标 } from '../组件/图标';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { 取公司档案 } from '../数据/公司档案';
import type { 高管项 } from '../数据/类型';
import { use应用状态 } from '../状态/应用状态';

/** 原型阶段固定编辑云衢科技这一家（= 当前登录的招聘方）*/
const 本公司键 = 'yunqu';

// ── 档位池：单选片里的可选值，全部是数据本身，不带解释 ──
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

const 作息池 = ['双休', '大小周', '弹性'];

const 福利标签池 = [
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

/** 一组图片最多留几张（localStorage 只有 5MB，相册是唯一有量级的字段）*/
const 相册每组上限 = 3;

// ── 分区定义 ──────────────────────────────────────────────────
type 分区键 =
  | '基本信息'
  | '公司福利'
  | '公司介绍'
  | '主营业务'
  | '公司相册'
  | '人才发展'
  | '在职感受'
  | '产品介绍'
  | '高管介绍';

const 分区顺序: 分区键[] = [
  '基本信息',
  '公司福利',
  '公司介绍',
  '主营业务',
  '公司相册',
  '人才发展',
  '在职感受',
  '产品介绍',
  '高管介绍',
];

/** 本屏所有可填项在一个扁平结构里，计数与完善度都从它算 */
interface 资料形 {
  公司全称: string;
  行业: string;
  规模: string;
  融资阶段: string;
  办公地址: string;
  福利标签: string[];
  作息档: string;
  公司介绍: string;
  主营业务: string;
  实景照片: string[];
  公司照片: string[];
  人才发展: string;
  在职感受: string;
  产品介绍: string;
  高管介绍: 高管项[];
}

/** 把用户选的图片压成 128×128 居中裁切的 JPEG dataURL —— 实现镜像 招聘名片 的
 *  压成头像，只是边长换成 LOGO 用的 128（约 6-12KB，localStorage 装得下） */
function 压成LOGO(文件: File): Promise<string> {
  return 压图(文件, (图, 画布) => {
    const 边 = 128;
    画布.width = 边;
    画布.height = 边;
    const 笔 = 画布.getContext('2d')!;
    const 源边 = Math.min(图.width, 图.height);
    笔.drawImage(图, (图.width - 源边) / 2, (图.height - 源边) / 2, 源边, 源边, 0, 0, 边, 边);
  });
}

/** 相册图压到长边 480（约 30-60KB/张）—— 两组各最多 3 张，写得进 localStorage */
function 压成相册图(文件: File): Promise<string> {
  return 压图(文件, (图, 画布) => {
    const 长边 = 480;
    const 比 = Math.min(1, 长边 / Math.max(图.width, 图.height));
    画布.width = Math.round(图.width * 比);
    画布.height = Math.round(图.height * 比);
    画布.getContext('2d')!.drawImage(图, 0, 0, 画布.width, 画布.height);
  });
}

/** 读文件 → 解码 → 交给调用方往画布上画 → 导出 JPEG dataURL */
function 压图(文件: File, 画: (图: HTMLImageElement, 画布: HTMLCanvasElement) => void): Promise<string> {
  return new Promise((成, 败) => {
    const 读 = new FileReader();
    读.onerror = () => 败(new Error('读取失败'));
    读.onload = () => {
      const 图 = new Image();
      图.onerror = () => 败(new Error('不是可用的图片'));
      图.onload = () => {
        const 画布 = document.createElement('canvas');
        画(图, 画布);
        成(画布.toDataURL('image/jpeg', 0.82));
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
 *  把两个钟点抠出来换成 24 小时制，本屏不再编辑它们，但保存时要原样合成回去 */
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

/** 分区行右侧的摘要：一行放不下就截断，不改写用户原话 */
function 截断(文: string, 上限 = 12): string {
  const 单行 = 文.replace(/\s+/g, ' ').trim();
  return 单行.length > 上限 ? `${单行.slice(0, 上限)}…` : 单行;
}

export default function 公司档案编辑() {
  const { 返回, 跳转 } = use导航();
  const { 状态, 派发 } = use应用状态();
  const 静态档 = 取公司档案(本公司键);
  // 改过就用改过的，没改过用静态档
  const 覆盖 = 状态.公司自述;
  const 档 = 覆盖 ? { ...静态档, ...覆盖 } : 静态档;
  const 静态规模 = 拆规模行(静态档.规模行);
  // 本屏不再编辑的字段：原样带进每次保存，否则候选端那几段会丢
  const 时间段 = 拆时间段(覆盖?.作息 ?? 静态档.作息);
  const 上班时间 = 覆盖?.上班时间 ?? 时间段.上班;
  const 下班时间 = 覆盖?.下班时间 ?? 时间段.下班;

  const [资料, 设资料] = useState<资料形>(() => ({
    公司全称: 档.名称,
    行业: 覆盖?.行业 ?? 静态规模.行业,
    规模: 覆盖?.规模 ?? 静态规模.规模,
    融资阶段: 覆盖?.融资阶段 ?? 静态规模.融资阶段,
    办公地址: 档.地址,
    福利标签:
      覆盖?.公司标签 ??
      静态档.福利.map((项) => 项.名称).filter((名) => 福利标签池.includes(名)),
    作息档: 覆盖?.作息档 ?? 拆作息档(静态档.作息),
    公司介绍: 档.简介.join('\n'),
    主营业务: (覆盖?.主营业务 ?? 静态档.主营业务).join('\n'),
    实景照片: 覆盖?.公司相册?.实景照片 ?? [],
    公司照片: 覆盖?.公司相册?.公司照片 ?? [],
    人才发展: 覆盖?.人才发展 ?? '',
    在职感受: 覆盖?.在职感受自述 ?? '',
    产品介绍: 覆盖?.产品介绍 ?? '',
    高管介绍: 覆盖?.高管介绍 ?? [],
  }));

  // 当前打开的是哪个分区的编辑层（null = 都关着）
  const [编辑中, 设编辑中] = useState<分区键 | null>(null);
  // 「去完善」要滚到第一个未填分区，所以每一行都留一个 ref
  const 行引用 = useRef<Partial<Record<分区键, HTMLButtonElement | null>>>({});

  // ── 每个分区的填写状态：有计数的给 已填/总数，没计数的只看填没填 ──
  const 分区状态: Record<分区键, { 已填: number; 总数: number; 摘要: string }> = {
    基本信息: {
      已填: [资料.公司全称, 状态.公司LOGO ?? '', 资料.行业, 资料.规模, 资料.融资阶段, 资料.办公地址]
        .filter((值) => 值.trim() !== '').length,
      总数: 6,
      摘要: '',
    },
    公司福利: {
      已填: (资料.福利标签.length > 0 ? 1 : 0) + (资料.作息档 ? 1 : 0),
      总数: 2,
      摘要: '',
    },
    公司介绍: { 已填: 资料.公司介绍.trim() ? 1 : 0, 总数: 1, 摘要: 截断(资料.公司介绍) },
    主营业务: {
      已填: 资料.主营业务.trim() ? 1 : 0,
      总数: 1,
      摘要: 截断(资料.主营业务.split('\n').filter(Boolean).join(' · ')),
    },
    // 公司视频原型阶段只有占位行（没有可上传的实现），所以它永远算未填
    公司相册: {
      已填: (资料.实景照片.length > 0 ? 1 : 0) + (资料.公司照片.length > 0 ? 1 : 0),
      总数: 3,
      摘要: '',
    },
    人才发展: { 已填: 资料.人才发展.trim() ? 1 : 0, 总数: 1, 摘要: 截断(资料.人才发展) },
    在职感受: { 已填: 资料.在职感受.trim() ? 1 : 0, 总数: 1, 摘要: 截断(资料.在职感受) },
    产品介绍: { 已填: 资料.产品介绍.trim() ? 1 : 0, 总数: 1, 摘要: 截断(资料.产品介绍) },
    高管介绍: {
      已填: 资料.高管介绍.length > 0 ? 1 : 0,
      总数: 1,
      摘要: 截断(资料.高管介绍.map((位) => 位.姓名 || 位.职务).filter(Boolean).join('、')),
    },
  };

  /** 有计数的分区在行右侧显示 N/总数，其余显示摘要或「去添加」*/
  const 带计数: 分区键[] = ['基本信息', '公司福利', '公司相册'];

  const 全部已填 = 分区顺序.reduce((和, 名) => 和 + 分区状态[名].已填, 0);
  const 全部项数 = 分区顺序.reduce((和, 名) => 和 + 分区状态[名].总数, 0);
  const 完善度 = Math.round((全部已填 / 全部项数) * 100);
  const 未填项数 = 全部项数 - 全部已填;
  const 档位词 = 完善度 >= 85 ? '优秀' : 完善度 >= 60 ? '良好' : '一般';

  /** 把整份资料合成回 公司自述覆盖 落全局 + localStorage。
   *  合成字段（名称 / 首字 / 规模行 / 作息）与本屏不再编辑的字段都在这里补齐 */
  function 落库(新资料: 资料形) {
    // 全称留空就退回原值：候选端 企业详情 拿 名称 当页面标题、拿 首字 画字标，
    // 存进一个空串会让那一屏顶部整块塌掉（空标题 + 空字标）
    const 落库全称 = 新资料.公司全称.trim() || 档.名称;
    派发({
      型: '存公司自述',
      值: {
        简介: 新资料.公司介绍.split('\n').map((行) => 行.trim()).filter(Boolean),
        // 企业文化 / 发展历程 / 地址补充 本屏没有分区，原样带过去
        企业文化: 档.企业文化,
        发展历程: 档.发展历程,
        地址补充: 档.地址补充,
        // 候选端读的合成字段：作息 = 上班时间段 + 作息档，规模行 = 融资 · 规模 · 行业
        作息: `${上班时间} – ${下班时间} · ${新资料.作息档}`,
        // 地址清空就是真清空（清单上那一项也随之变回未填）；只有 名称 有退回原值的兜底，
        // 因为候选端拿它当页面标题与字标，空串会让那一屏顶部整块塌掉
        地址: 新资料.办公地址.trim(),
        名称: 落库全称,
        首字: 落库全称.charAt(0),
        一句话简介: 覆盖?.一句话简介,
        行业: 新资料.行业,
        规模: 新资料.规模,
        融资阶段: 新资料.融资阶段,
        规模行: [新资料.融资阶段, 新资料.规模, 新资料.行业].filter(Boolean).join(' · '),
        上班时间,
        下班时间,
        作息档: 新资料.作息档,
        公司标签: 新资料.福利标签,
        主营业务: 新资料.主营业务.split('\n').map((行) => 行.trim()).filter(Boolean),
        公司相册: { 实景照片: 新资料.实景照片, 公司照片: 新资料.公司照片 },
        人才发展: 新资料.人才发展.trim(),
        在职感受自述: 新资料.在职感受.trim(),
        产品介绍: 新资料.产品介绍.trim(),
        // 三格全空的行是用户加了没写的空壳，不落库
        高管介绍: 新资料.高管介绍.filter((位) => 位.姓名 || 位.职务 || 位.简介),
      },
    });
  }

  /** 编辑层点保存：先并回整份资料，再落库、收层 */
  function 提交(补丁: Partial<资料形>) {
    const 新资料 = { ...资料, ...补丁 };
    设资料(新资料);
    落库(新资料);
    设编辑中(null);
    轻提示('已保存');
  }

  /** 去完善：滚到第一个还没填满的分区 */
  function 去完善() {
    const 目标 = 分区顺序.find((名) => 分区状态[名].已填 < 分区状态[名].总数);
    if (!目标) return;
    行引用.current[目标]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <次级页外壳>
      <返回栏
        返回={返回}
        右侧={
          <button
            className={`${样式.预览键} 可点`}
            onClick={() => 跳转(路径.企业详情(本公司键))}
          >
            预览
          </button>
        }
      />

      <页面大标题 标题="编辑品牌信息" />

      <滚动区 样式覆盖={{ padding: '16px 18px calc(24px + var(--安全区下))' }}>
        {/* ── 完善度卡：环形百分比 + 档位词 + 还差几项 + 去完善 ── */}
        <div className={样式.完善卡}>
          <完善环 百分比={完善度} />
          <div className={样式.完善文字}>
            <div className={样式.完善档位}>{档位词}</div>
            <div className={样式.完善说明}>完善 {未填项数} 项信息，提升公司主页曝光率</div>
          </div>
          <button className={`${样式.完善键} 可点`} onClick={去完善}>
            去完善
          </button>
        </div>

        {/* ── 分区清单：一行一个分区，点行升起该分区的编辑层 ── */}
        <div className={样式.清单}>
          {分区顺序.map((名, 序) => {
            const 状 = 分区状态[名];
            const 用计数 = 带计数.includes(名);
            return (
              <button
                key={名}
                ref={(节点) => {
                  行引用.current[名] = 节点;
                }}
                className={`${样式.分区行} ${序 === 分区顺序.length - 1 ? 样式.末条 : ''} 可点`}
                onClick={() => 设编辑中(名)}
              >
                <span className={样式.分区名}>{名}</span>
                <span className={样式.分区右}>
                  {用计数 ? (
                    <span className={`${样式.分区计数} 等宽数字`}>
                      {状.已填}/{状.总数}
                    </span>
                  ) : 状.已填 > 0 ? (
                    <span className={`${样式.分区摘要} 单行`}>{状.摘要}</span>
                  ) : (
                    <span className={样式.去添加}>去添加</span>
                  )}
                  <span className={样式.尖括号}>›</span>
                </span>
              </button>
            );
          })}
        </div>
      </滚动区>

      {/* ── 分区编辑层：底部升起，改完在层里保存 ── */}
      {编辑中 === '基本信息' ? (
        <基本信息层
          资料={资料}
          LOGO={状态.公司LOGO}
          存LOGO={(图) => 派发({ 型: '存公司LOGO', 图 })}
          提交={提交}
          关闭={() => 设编辑中(null)}
        />
      ) : null}

      {编辑中 === '公司福利' ? (
        <公司福利层 资料={资料} 提交={提交} 关闭={() => 设编辑中(null)} />
      ) : null}

      {编辑中 === '公司介绍' ? (
        <文本层
          标题="公司介绍"
          初值={资料.公司介绍}
          上限={500}
          高度={168}
          提交={(值) => 提交({ 公司介绍: 值 })}
          关闭={() => 设编辑中(null)}
        />
      ) : null}

      {编辑中 === '主营业务' ? (
        <文本层
          标题="主营业务"
          初值={资料.主营业务}
          上限={200}
          高度={132}
          提交={(值) => 提交({ 主营业务: 值 })}
          关闭={() => 设编辑中(null)}
        />
      ) : null}

      {编辑中 === '公司相册' ? (
        <公司相册层 资料={资料} 提交={提交} 关闭={() => 设编辑中(null)} />
      ) : null}

      {编辑中 === '人才发展' ? (
        <文本层
          标题="人才发展"
          初值={资料.人才发展}
          上限={300}
          高度={150}
          提交={(值) => 提交({ 人才发展: 值 })}
          关闭={() => 设编辑中(null)}
        />
      ) : null}

      {编辑中 === '在职感受' ? (
        <文本层
          标题="在职感受"
          初值={资料.在职感受}
          上限={300}
          高度={150}
          提交={(值) => 提交({ 在职感受: 值 })}
          关闭={() => 设编辑中(null)}
        />
      ) : null}

      {编辑中 === '产品介绍' ? (
        <文本层
          标题="产品介绍"
          初值={资料.产品介绍}
          上限={300}
          高度={150}
          提交={(值) => 提交({ 产品介绍: 值 })}
          关闭={() => 设编辑中(null)}
        />
      ) : null}

      {编辑中 === '高管介绍' ? (
        <高管介绍层 资料={资料} 提交={提交} 关闭={() => 设编辑中(null)} />
      ) : null}
    </次级页外壳>
  );
}

/** 完善度环：轨 + 进度弧 + 中间百分数。形复用 适配环，但颜色固定走品牌绿，
 *  因为这里的语义只有「填了多少」，没有 适配环 那套好/要掂量/弱的分档色 */
function 完善环({ 百分比 }: { 百分比: number }) {
  const 尺寸 = 62;
  const 半径 = 25;
  const 中心 = 尺寸 / 2;
  const 周长 = 2 * Math.PI * 半径;
  return (
    <svg
      className={样式.完善环}
      width={尺寸}
      height={尺寸}
      viewBox={`0 0 ${尺寸} ${尺寸}`}
      role="img"
      aria-label={`完善度 ${百分比}%`}
    >
      <circle cx={中心} cy={中心} r={半径} fill="none" stroke="var(--浅灰底2)" strokeWidth={4} />
      <circle
        cx={中心}
        cy={中心}
        r={半径}
        fill="none"
        stroke="var(--橄榄)"
        strokeWidth={5}
        strokeLinecap="round"
        strokeDasharray={`${(周长 * 百分比) / 100} ${周长}`}
        transform={`rotate(-90 ${中心} ${中心})`}
      />
      <text
        x={中心}
        y={中心}
        textAnchor="middle"
        dominantBaseline="central"
        className="等宽数字"
        style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.03em' }}
        fill="var(--墨)"
      >
        {百分比}%
      </text>
    </svg>
  );
}

/** 所有分区编辑层共用的壳：遮罩 + 底部升起 + 顶行（标题 / ✕）+ 可滚正文 + 保存 */
function 编辑层壳({
  标题,
  关闭,
  保存,
  children,
}: {
  标题: string;
  关闭: () => void;
  保存: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <div className={样式.遮罩} onClick={关闭} />
      <div className={样式.层}>
        <div className={样式.层顶}>
          <span className={样式.层标题}>{标题}</span>
          <button className={`${样式.层关闭} 可点`} onClick={关闭} aria-label="关闭">
            ✕
          </button>
        </div>
        <div className={`${样式.层体} 滚动区`}>{children}</div>
        <button className={`${样式.层保存} 可点`} onClick={保存}>
          保存
        </button>
      </div>
    </>
  );
}

/** 基本信息层：公司全称 · 公司 LOGO · 行业 · 规模 · 融资阶段 · 办公地址（截图里的 6 项）*/
function 基本信息层({
  资料,
  LOGO,
  存LOGO,
  提交,
  关闭,
}: {
  资料: 资料形;
  LOGO: string | null;
  存LOGO: (图: string) => void;
  提交: (补丁: Partial<资料形>) => void;
  关闭: () => void;
}) {
  const [公司全称, 设公司全称] = useState(资料.公司全称);
  const [行业, 设行业] = useState(资料.行业);
  const [规模, 设规模] = useState(资料.规模);
  const [融资阶段, 设融资阶段] = useState(资料.融资阶段);
  const [办公地址, 设办公地址] = useState(资料.办公地址);
  const LOGO框 = useRef<HTMLInputElement>(null);

  async function 选了LOGO(事件: React.ChangeEvent<HTMLInputElement>) {
    const 文件 = 事件.target.files?.[0];
    事件.target.value = ''; // 允许再次选同一张
    if (!文件) return;
    try {
      存LOGO(await 压成LOGO(文件));
      轻提示('LOGO 已更新');
    } catch {
      轻提示('这张图片读不出来，换一张试试');
    }
  }

  return (
    <编辑层壳
      标题="基本信息"
      关闭={关闭}
      保存={() => 提交({ 公司全称, 行业, 规模, 融资阶段, 办公地址 })}
    >
      <div className={样式.字段}>
        <div className={样式.字段标签}>公司全称</div>
        <input
          className={样式.单行输入}
          value={公司全称}
          maxLength={40}
          aria-label="公司全称"
          onChange={(事件) => 设公司全称(事件.target.value)}
        />
      </div>

      <div className={样式.字段}>
        <div className={样式.字段标签}>公司 LOGO</div>
        <button
          className={`${样式.LOGO键} 可点`}
          onClick={() => LOGO框.current?.click()}
          aria-label="上传公司 LOGO"
        >
          {LOGO ? (
            <img className={样式.LOGO图} src={LOGO} alt="" />
          ) : (
            <span className={样式.LOGO空} />
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
      </div>

      <单选片组 标签="行业" 选项={行业池} 当前={行业} 选中={设行业} />
      <单选片组 标签="规模" 选项={规模池} 当前={规模} 选中={设规模} />
      <单选片组 标签="融资阶段" 选项={融资阶段池} 当前={融资阶段} 选中={设融资阶段} />

      <div className={`${样式.字段} ${样式.末条}`}>
        <div className={样式.字段标签}>办公地址</div>
        <textarea
          className={样式.多行输入}
          style={{ height: 66 }}
          value={办公地址}
          maxLength={80}
          aria-label="办公地址"
          onChange={(事件) => 设办公地址(事件.target.value)}
        />
      </div>
    </编辑层壳>
  );
}

/** 公司福利层：福利标签（多选）+ 作息（单选），即截图里的 N/2 */
function 公司福利层({
  资料,
  提交,
  关闭,
}: {
  资料: 资料形;
  提交: (补丁: Partial<资料形>) => void;
  关闭: () => void;
}) {
  const [福利标签, 设福利标签] = useState<string[]>(资料.福利标签);
  const [作息档, 设作息档] = useState(资料.作息档);

  return (
    <编辑层壳 标题="公司福利" 关闭={关闭} 保存={() => 提交({ 福利标签, 作息档 })}>
      <div className={样式.字段}>
        <div className={样式.字段标签}>福利标签</div>
        <div className={样式.片行}>
          {福利标签池.map((名) => {
            const 选中 = 福利标签.includes(名);
            return (
              <button
                key={名}
                className={`${样式.片} ${选中 ? 样式.片选中 : ''} 可点`}
                aria-pressed={选中}
                onClick={() =>
                  设福利标签((旧) =>
                    旧.includes(名) ? 旧.filter((条) => 条 !== 名) : [...旧, 名]
                  )
                }
              >
                {名}
              </button>
            );
          })}
        </div>
      </div>

      <单选片组 标签="作息" 选项={作息池} 当前={作息档} 选中={设作息档} 末条 />
    </编辑层壳>
  );
}

/** 公司介绍 / 主营业务 / 人才发展 / 在职感受 / 产品介绍 共用的多行文本层 */
function 文本层({
  标题,
  初值,
  上限,
  高度,
  提交,
  关闭,
}: {
  标题: string;
  初值: string;
  上限: number;
  高度: number;
  提交: (值: string) => void;
  关闭: () => void;
}) {
  const [值, 设值] = useState(初值);
  return (
    <编辑层壳 标题={标题} 关闭={关闭} 保存={() => 提交(值)}>
      <div className={`${样式.字段} ${样式.末条}`}>
        <textarea
          className={样式.多行输入}
          style={{ height: 高度 }}
          value={值}
          maxLength={上限}
          aria-label={标题}
          autoFocus
          onChange={(事件) => 设值(事件.target.value)}
        />
        <div className={`${样式.字数} 等宽数字`}>
          {值.length} / {上限}
        </div>
      </div>
    </编辑层壳>
  );
}

/** 公司相册层：实景照片 / 公司照片 两组九宫格，公司视频原型阶段只留一行占位 */
function 公司相册层({
  资料,
  提交,
  关闭,
}: {
  资料: 资料形;
  提交: (补丁: Partial<资料形>) => void;
  关闭: () => void;
}) {
  const [实景照片, 设实景照片] = useState<string[]>(资料.实景照片);
  const [公司照片, 设公司照片] = useState<string[]>(资料.公司照片);

  return (
    <编辑层壳 标题="公司相册" 关闭={关闭} 保存={() => 提交({ 实景照片, 公司照片 })}>
      <图片组 标签="实景照片" 图们={实景照片} 设图们={设实景照片} />
      <图片组 标签="公司照片" 图们={公司照片} 设图们={设公司照片} />

      {/* 公司视频：原型没有视频上传与转码，做成能点的行就是假成功，所以只留占位 */}
      <div className={`${样式.字段} ${样式.末条}`}>
        <div className={样式.字段标签}>公司视频</div>
        <div className={样式.视频占位} aria-disabled="true" />
      </div>
    </编辑层壳>
  );
}

/** 一组图片：已选的缩略图（右上角 ✕ 删）+ 未满时的「＋」格 */
function 图片组({
  标签,
  图们,
  设图们,
}: {
  标签: string;
  图们: string[];
  设图们: (更新: (旧: string[]) => string[]) => void;
}) {
  const 选框 = useRef<HTMLInputElement>(null);

  async function 选了图(事件: React.ChangeEvent<HTMLInputElement>) {
    const 文件 = 事件.target.files?.[0];
    事件.target.value = '';
    if (!文件) return;
    try {
      const 图 = await 压成相册图(文件);
      设图们((旧) => [...旧, 图].slice(0, 相册每组上限));
    } catch {
      轻提示('这张图片读不出来，换一张试试');
    }
  }

  return (
    <div className={样式.字段}>
      <div className={样式.字段标签}>
        {标签} {图们.length}/{相册每组上限}
      </div>
      <div className={样式.图格行}>
        {图们.map((图, 序) => (
          <span key={`${序}-${图.slice(-24)}`} className={样式.图格}>
            <img className={样式.图格图} src={图} alt="" />
            <button
              className={`${样式.图格删} 可点`}
              aria-label={`删除${标签}第 ${序 + 1} 张`}
              onClick={() => 设图们((旧) => 旧.filter((_, i) => i !== 序))}
            >
              ✕
            </button>
          </span>
        ))}
        {图们.length < 相册每组上限 ? (
          <button
            className={`${样式.图格加} 可点`}
            aria-label={`添加${标签}`}
            onClick={() => 选框.current?.click()}
          >
            ＋
          </button>
        ) : null}
      </div>
      <input
        ref={选框}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={选了图}
      />
    </div>
  );
}

/** 高管介绍层：姓名 + 职务 + 一句话简介，可增可删 */
function 高管介绍层({
  资料,
  提交,
  关闭,
}: {
  资料: 资料形;
  提交: (补丁: Partial<资料形>) => void;
  关闭: () => void;
}) {
  const [列表, 设列表] = useState<高管项[]>(
    资料.高管介绍.length > 0 ? 资料.高管介绍 : [{ 姓名: '', 职务: '', 简介: '' }]
  );

  function 改一条(序: number, 补丁: Partial<高管项>) {
    设列表((旧) => 旧.map((位, i) => (i === 序 ? { ...位, ...补丁 } : 位)));
  }

  return (
    <编辑层壳
      标题="高管介绍"
      关闭={关闭}
      保存={() =>
        提交({ 高管介绍: 列表.filter((位) => 位.姓名.trim() || 位.职务.trim() || 位.简介.trim()) })
      }
    >
      {列表.map((位, 序) => (
        <div key={序} className={样式.高管块}>
          <div className={样式.高管头}>
            <span className={`${样式.字段标签} 等宽数字`}>高管 {序 + 1}</span>
            <button
              className={`${样式.高管删} 可点`}
              aria-label={`删除高管 ${序 + 1}`}
              onClick={() => 设列表((旧) => 旧.filter((_, i) => i !== 序))}
            >
              ✕
            </button>
          </div>
          <input
            className={样式.单行输入}
            value={位.姓名}
            maxLength={16}
            placeholder="姓名"
            aria-label={`高管 ${序 + 1} 姓名`}
            onChange={(事件) => 改一条(序, { 姓名: 事件.target.value })}
          />
          <input
            className={样式.单行输入}
            value={位.职务}
            maxLength={20}
            placeholder="职务"
            aria-label={`高管 ${序 + 1} 职务`}
            onChange={(事件) => 改一条(序, { 职务: 事件.target.value })}
          />
          <textarea
            className={样式.多行输入}
            style={{ height: 60 }}
            value={位.简介}
            maxLength={60}
            placeholder="一句话简介"
            aria-label={`高管 ${序 + 1} 简介`}
            onChange={(事件) => 改一条(序, { 简介: 事件.target.value })}
          />
        </div>
      ))}

      <button
        className={`${样式.加一条} 可点`}
        onClick={() => 设列表((旧) => [...旧, { 姓名: '', 职务: '', 简介: '' }])}
      >
        ＋ 添加高管
      </button>
    </编辑层壳>
  );
}

/** 一组单选片：标签 + 平铺档位，点一片即选中（层内直接选，不再套第二层弹层）*/
function 单选片组({
  标签,
  选项,
  当前,
  选中,
  末条 = false,
}: {
  标签: string;
  选项: string[];
  当前: string;
  选中: (值: string) => void;
  末条?: boolean;
}) {
  return (
    <div className={`${样式.字段} ${末条 ? 样式.末条 : ''}`}>
      <div className={样式.字段标签}>{标签}</div>
      <div className={样式.片行}>
        {选项.map((项) => (
          <button
            key={项}
            className={`${样式.片} ${项 === 当前 ? 样式.片选中 : ''} 可点`}
            aria-pressed={项 === 当前}
            onClick={() => 选中(项)}
          >
            {项}
          </button>
        ))}
      </div>
    </div>
  );
}
