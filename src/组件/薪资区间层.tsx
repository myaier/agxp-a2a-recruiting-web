// 薪资要求双滚轮弹层（2026-08-21 按「添加求职期望」截图 4 新增）。
//
// 从底部升起的弹层：左列选下限、右列选上限，档位 3–100 千元、步长 1。
// 壳复用 弹层框架（遮罩 + Escape 关闭 + 焦点恢复），滚动手感复用 内嵌双滚轮
// （scroll-snap 吸附 + 停下 90ms 取落点 + 中间档高亮底），不另起炉灶。
//
// 与 数字滚轮层 的区别：那是单列，这里要同时定下限和上限两个数。
//
// Task 3（2026-09-14）：岗位月薪共用本层，业务用途显式传 用途='岗位'（不是数据源
// 模式）。岗位档位改 0–100 常用档 + 当前有效整数补档，并提供「输入金额」次级入口
// （沿用原岗位数字框 digits-only、至多 4 位规则）；倒置在确定时报错不关闭。
// 求职用途一切照旧：旧档位、旧默认值、小数/大额往返、确定时上限取 max。

import { useMemo, useState } from 'react';
import 样式 from './薪资区间层.module.css';
import 弹层框架 from './弹层框架';
import 内嵌双滚轮 from './内嵌双滚轮';

/** 求职用途档位：3–100 千元，步长 1。上下限两列共用同一份档表。 */
const 求职档位表 = Array.from({ length: 98 }, (_, 序) => 3 + 序);

/** 岗位用途常用档：0–100 千元，步长 1。宽金额（如服务端已有 10000）靠当前值补档，不生成上万 DOM。 */
const 岗位常用档 = Array.from({ length: 101 }, (_, 序) => 序);

/** 下限/上限未填时的落点（截图里首开就停在 10 / 11） */
const 默认下限 = 10;
const 默认上限 = 11;

interface 属性 {
  /** 已选下限，千元；null = 还没选过 */
  周期?: 'month' | 'day' | 'hour';
  /** 业务用途：'求职'（默认）沿用旧档位与「确定时上限取 max」策略；只岗位月薪传 '岗位' */
  用途?: '求职' | '岗位';
  下限: number | null;
  /** 已选上限，千元；null = 还没选过 */
  上限: number | null;
  确认: (下: number, 上: number) => void;
  取消: () => void;
}

/** 岗位月薪协议是非负整数（原数字框同域）：小数不进岗位档，超范围服务端已有值可整入档。 */
const 是有效岗位整数 = (值: number | null): 值 is number =>
  值 !== null && Number.isFinite(值) && Number.isInteger(值) && 值 >= 0;

export default function 薪资区间层({ 下限, 上限, 确认, 取消, 周期 = 'month', 用途 = '求职' }: 属性) {
  const 日薪 = 周期 === 'day';
  const 是岗位 = 用途 === '岗位';
  const 单位 = 日薪 ? '元/天' : 周期 === 'hour' ? '元/时' : 'K';
  const 标题文案 = 日薪 ? '薪资要求(日薪，单位:元)' : 周期 === 'hour' ? '薪资要求(时薪，单位:元)' : '薪资要求(月薪，单位:千元)';
  const [下限值, 设下限值] = useState(下限 ?? (日薪 ? 150 : 默认下限));
  const [上限值, 设上限值] = useState(上限 ?? (日薪 ? 200 : 默认上限));
  // 岗位用途：确定被拦（空/倒置）时的字段错误；求职用途恒为 null（沿用取 max 策略）
  const [错误, 设错误] = useState<string | null>(null);
  // 岗位用途「输入金额」次级入口：文本与「用户改过」标记（改空即非法，未改过的已有值原样保留）
  const [精确开, 设精确开] = useState(false);
  const [下限文本, 设下限文本] = useState('');
  const [上限文本, 设上限文本] = useState('');
  const [改过下限, 设改过下限] = useState(false);
  const [改过上限, 设改过上限] = useState(false);

  const 当前档位 = useMemo(() => {
    if (是岗位) {
      // 常用档 0..100 + 传入有效整数 + 滚轮当前值（精确输入可能落在常用档外），排序去重；
      // 数量有界（常用档 + 至多当前值），不为宽金额生成上万档位 DOM
      return [...new Set([
        ...岗位常用档,
        ...[下限, 上限].filter(是有效岗位整数),
        ...(Number.isInteger(下限值) && 下限值 >= 0 ? [下限值] : []),
        ...(Number.isInteger(上限值) && 上限值 >= 0 ? [上限值] : []),
      ])].sort((甲, 乙) => 甲 - 乙);
    }
    return [...new Set([
      ...(日薪 ? Array.from({ length: 44 }, (_, 序) => (序 + 1) * 50) : 求职档位表),
      ...[下限, 上限].filter((值): 值 is number => 值 !== null && Number.isFinite(值)),
    ])].sort((甲, 乙) => 甲 - 乙);
  }, [是岗位, 日薪, 下限, 上限, 下限值, 上限值]);

  /** 原岗位数字框规则复用（发布岗位 薪资数字框）：只收数字、至多 4 位（0–9999）。
   *  改空不静默改临时值，但记「改过」让确定拦截；未编辑的已有超范围值原样显示。 */
  const 改精确 = (列: '下限' | '上限', 原文: string) => {
    const 文本 = 原文.replace(/\D/g, '').slice(0, 4);
    if (列 === '下限') {
      设下限文本(文本);
      设改过下限(true);
    } else {
      设上限文本(文本);
      设改过上限(true);
    }
    if (文本 !== '') {
      if (列 === '下限') 设下限值(Number(文本));
      else 设上限值(Number(文本));
    }
    设错误(null);
  };

  const 开精确输入 = () => {
    设下限文本(String(下限值));
    设上限文本(String(上限值));
    设改过下限(false);
    设改过上限(false);
    设错误(null);
    设精确开(true);
  };

  // 两列各滚各的，中途允许出现上限 < 下限的中间态（否则一列会把另一列顶着跑，手感很差）。
  // 落数策略分用途：求职在点「确定」这一刻把上限抬到下限（不报错也不丢选择）；
  // 岗位倒置显示字段错误并保持弹层，数值合法才回填（延续岗位原提交校验）。
  const 点确定 = () => {
    if (是岗位) {
      if (精确开 && ((改过下限 && 下限文本 === '') || (改过上限 && 上限文本 === ''))) {
        设错误('请输入 0–9999 的整数金额');
        return;
      }
      if (上限值 < 下限值) {
        设错误('薪资下限不能高于上限');
        return;
      }
      确认(下限值, 上限值);
      return;
    }
    const 最终上限 = Math.max(上限值, 下限值);
    确认(下限值, 最终上限);
  };

  // 滚动/点档都视为修正动作：清掉上一次确定被拦下的错误
  const 设下限并清错 = (值: number) => {
    设下限值(值);
    设错误(null);
  };
  const 设上限并清错 = (值: number) => {
    设上限值(值);
    设错误(null);
  };

  return (
    <弹层框架 标签={标题文案} 遮罩类名={样式.遮罩} 面板类名={样式.层} 关闭={取消} 层级={71}>
      <div className={样式.顶栏}>
        <button type="button" className={`${样式.取消键} 可点`} onClick={取消}>
          取消
        </button>
        <span className={样式.标题}>{标题文案}</span>
        <button type="button" className={`${样式.确认键} 可点`} onClick={点确定}>
          确定
        </button>
      </div>

      <div className={样式.轮区}>
        {是岗位 && 精确开 ? (
          <div className={样式.精确区}>
            <span className={样式.精确框}>
              <input
                className={`${样式.精确输入} 等宽数字`}
                value={下限文本}
                placeholder="0–9999"
                inputMode="numeric"
                aria-label="薪资下限"
                onChange={(事件) => 改精确('下限', 事件.target.value)}
              />
              <span className={样式.精确单位}>{单位}</span>
            </span>
            <span className={样式.精确连字}>—</span>
            <span className={样式.精确框}>
              <input
                className={`${样式.精确输入} 等宽数字`}
                value={上限文本}
                placeholder="0–9999"
                inputMode="numeric"
                aria-label="薪资上限"
                onChange={(事件) => 改精确('上限', 事件.target.value)}
              />
              <span className={样式.精确单位}>{单位}</span>
            </span>
          </div>
        ) : (
          <内嵌双滚轮
            左档={当前档位}
            右档={当前档位}
            左值={下限值}
            右值={上限值}
            设左值={设下限并清错}
            设右值={设上限并清错}
            左名="薪资下限"
            右名="薪资上限"
            左单位={单位}
            右单位={单位}
          />
        )}
        {错误 ? <div className={样式.错误行} role="alert">{错误}</div> : null}
        {是岗位 ? (
          <button type="button" className={`${样式.精确切换} 可点`} onClick={() => (精确开 ? 设精确开(false) : 开精确输入())}>
            {精确开 ? '返回滚轮' : '输入金额'}
          </button>
        ) : null}
      </div>
    </弹层框架>
  );
}
