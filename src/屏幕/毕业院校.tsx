// 你毕业于（/onboard/school）—— 2026-08-20 按 BOSS 截图顺序重排：
// 搜索输入，输入后才出高校候选（数据/高校名录 30 所 mock），
// 点选或直接手输均可。答案落 简历教育[0].学校。
//
// Task 4：Backend 分支按需 查询Institution（250ms debounce），候选行复用现有
// 候选行 副行元素显示「城市 · 国家」，点候选才存 学校引用；继续输入清除旧引用，
// 没点候选时复用 轻提示 阻止保存。Mock 分支保持本地 高校名录 不变。
// Task 5：下一步按钮绑定引用有效性（Backend 没点候选即禁用，提交守卫保留），
// 搜索态如实展示 加载中/没有匹配结果/加载失败，请求序守 stale response。
//
// 候选 onboarding 简历预填（Spec §8 /onboard/school）：首挂载同步用 取学校预填
// 初始化文本与引用 —— exact Catalog 命中带 canonical 引用（下一步直接可继续），
// unresolved 只落 source_name 文本（既有选择器守卫保持关闭），当前文本非空原样保留；
// 确认 institution 分区只在既有保存成功后、跳转之前。

import { useEffect, useRef, useState } from 'react';
import 样式 from './入职引导.module.css';
import { 次级页外壳, 返回栏, 页面大标题, 主按钮, 滚动区 } from '../组件/通用';
import { 放大镜图标 } from '../组件/图标';
import { 轻提示 } from '../组件/轻提示';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 取后端错误文案 } from '../数据/HTTP客户端';
import { 取学校预填 } from '../流程/候选Onboarding简历预填';
import { 创建空候选预填状态 } from '../状态/后端/类型';
import { 路径 } from '../路由/路径表';
import { 高校名录 } from '../数据/高校名录';
import { 学校副标题, 合并目录页 } from '../数据/目录选择';
import type { BFFInstitutionItem } from '../数据/BFF契约';
import type { 目录选择值 } from '../数据/招聘数据源类型';

const 搜索防抖毫秒 = 250;

// Task 5：搜索状态机——加载中 / 成功（空结果给「没有匹配结果」）/ 失败
type 搜索阶段 = 'idle' | 'loading' | 'success' | 'error';

export default function 毕业院校() {
  const { 跳转, 返回 } = use导航();
  const { 状态: 全局, 操作, 数据源模式, 目录查询, 后端状态 } = use应用状态();
  const 是后端 = 数据源模式 === 'backend';
  const 首段 = 全局.简历教育[0];

  // 候选 onboarding 预填：首挂载同步初始化文本与引用（当前文本非空原样保留）
  const 学校初始 = 取学校预填(后端状态.候选预填状态 ?? 创建空候选预填状态(), 首段?.学校 ?? '', 首段?.学校引用);
  // 输入框即答案：点候选 = 把校名灌进输入框，也可以直接手输名录外的学校
  const [学校, 设学校] = useState(学校初始.text);
  // Backend：点候选后才落的引用；继续输入立即清空
  const [学校引用, 设学校引用] = useState<目录选择值 | undefined>(学校初始.ref);
  const [候选项, 设候选项] = useState<BFFInstitutionItem[]>([]);
  // review-r1 P2-1：保留搜索的 nextCursor，滚到底加载第二页
  const [下一页游标, 设下一页游标] = useState<string | null>(null);
  const [加载中, 设加载中] = useState(false);
  const [搜索阶段, 设搜索阶段] = useState<搜索阶段>('idle');
  const 计时 = useRef(0);
  // review-r1 P2-2 / Task 5：请求序 ref 守 stale response——慢的旧搜索结果（含状态）
  // 不覆盖新词的；load-more 也捕获请求序，query 变了不追加
  const 请求序 = useRef(0);
  const 方法引用 = useRef(目录查询?.查询Institution);
  方法引用.current = 目录查询?.查询Institution;

  const 词 = 学校.trim();
  // Task 5：Backend 没点候选（无引用）就不许继续；Mock 只看词非空
  const 不可继续 = 词 === '' || (是后端 && 学校引用 === undefined);

  // Backend 搜索：250ms debounce 后 查询Institution({ q, limit: 20 })
  useEffect(() => {
    if (!是后端) return;
    const 方法 = 方法引用.current;
    const trimmed = 词;
    // review-r3 R3-I-7：每次查询词变化都重置分页状态（候选/游标/加载），避免新词带着旧游标请求
    请求序.current += 1;
    设候选项([]);
    设下一页游标(null);
    设加载中(false);
    if (!方法 || trimmed === '') {
      // 空词 / 没有查询方法：回到 idle，不挂「加载中」
      设搜索阶段('idle');
      return;
    }
    // Task 5：非空词进入 loading（debounce 期间也算在途）
    设搜索阶段('loading');
    window.clearTimeout(计时.current);
    const 本次 = 请求序.current;
    计时.current = window.setTimeout(async () => {
      try {
        const 页 = await 方法({ q: trimmed, limit: 20 });
        if (本次 !== 请求序.current) return;
        设候选项(页.items);
        设下一页游标(页.nextCursor);
        设搜索阶段('success');
      } catch {
        if (本次 !== 请求序.current) return;
        设候选项([]);
        设下一页游标(null);
        设搜索阶段('error');
      }
    }, 搜索防抖毫秒);
    return () => window.clearTimeout(计时.current);
  }, [学校, 是后端, 词]);

  // review-r1 P2-1 / review-r2 R2-M-2：加载更多——用当前游标请求下一页，合并去重；
  // 请求序检查防 stale 追加（query 已变时不把旧 query 的下一页 append 进来）
  const 加载更多 = async () => {
    if (下一页游标 === null || 加载中) return;
    const 方法 = 方法引用.current;
    if (!方法) return;
    const 本次 = 请求序.current;
    设加载中(true);
    try {
      const 页 = await 方法({ q: 词, cursor: 下一页游标, limit: 20 });
      if (本次 !== 请求序.current) return;
      设候选项((旧) => 合并目录页(旧, 页.items));
      设下一页游标(页.nextCursor);
    } catch {
      if (本次 !== 请求序.current) return;
      // 失败不动，用户可再点一次
    } finally {
      if (本次 === 请求序.current) 设加载中(false);
    }
  };

  // Mock 候选：本地名录过滤
  const mock候选 = 词 === '' ? [] : 高校名录.filter((名) => 名.includes(词));

  const 选候选 = (项: BFFInstitutionItem) => {
    设学校(项.display_name);
    设学校引用({ id: 项.id, display_name: 项.display_name });
    设候选项([]);
  };

  const 选Mock候选 = (名: string) => {
    设学校(名);
  };

  const 输入改变 = (值: string) => {
    设学校(值);
    // 继续输入立即清除旧引用（只有点候选才落引用）
    if (学校引用 !== undefined) 设学校引用(undefined);
  };

  const 下一步 = async () => {
    if (词 === '') {
      轻提示('先填学校名称');
      return;
    }
    // Backend：没点过候选 → 阻止保存
    if (是后端 && 学校引用 === undefined) {
      轻提示('请从候选学校中选择');
      return;
    }
    try {
      await 操作.保存简历({
        基本信息: 全局.基本信息,
        个人优势: 全局.个人优势,
        技能: 全局.简历技能,
        经历: 全局.简历经历,
        教育: 全局.简历教育.map((条, 序) =>
          序 === 0 ? { ...条, 学校: 词, 学校引用 } : 条,
        ),
        证书: 全局.简历证书,
      });
      // 预填确认只在既有保存成功后（拒绝时分区不确认），且先于跳转
      操作.确认候选Onboarding预填分区('institution');
      跳转(路径.选专业);
    } catch (错误) {
      轻提示(取后端错误文案(错误));
    }
  };

  return (
    <次级页外壳 白底>
      <返回栏 返回={返回} />

      <页面大标题 标题="你毕业于" />

      <滚动区 样式覆盖={{ padding: '14px 22px 12px' }}>
        <div className={样式.输入行}>
          <放大镜图标 尺寸={15} 色="var(--最弱)" 线宽={2.2} />
          <input
            className={样式.输入}
            placeholder="学校名称"
            value={学校}
            onChange={(事件) => 输入改变(事件.target.value)}
          />
        </div>

        {/* 候选列表：Backend 显示学校名 + 「城市 · 国家」副行；Mock 保持本地名录 */}
        <div className={样式.候选列表}>
          {是后端
            ? 候选项.map((项) => (
                <button
                  key={项.id}
                  className={`${样式.候选行} ${项.display_name === 词 ? 样式.候选行选中 : ''} 可点`}
                  onClick={() => 选候选(项)}
                >
                  <span>
                    <span>{项.display_name}</span>
                    {/* 复用现有候选行的副行：只放副标题文本，不加新 CSS 类 */}
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--最弱)', fontWeight: 400 }}>
                      {学校副标题(项)}
                    </span>
                  </span>
                  {项.display_name === 词 ? <span className={样式.候选勾}>✓</span> : null}
                </button>
              ))
            : mock候选.map((名) => (
                <button
                  key={名}
                  className={`${样式.候选行} ${名 === 词 ? 样式.候选行选中 : ''} 可点`}
                  onClick={() => 选Mock候选(名)}
                >
                  <span>{名}</span>
                  {名 === 词 ? <span className={样式.候选勾}>✓</span> : null}
                </button>
              ))}
          {/* review-r1 P2-1：搜索返回 nextCursor 时显示「加载更多」按钮，点击追加下一页 */}
          {是后端 && 下一页游标 !== null ? (
            <button className={`${样式.候选行} 可点`} onClick={加载更多} disabled={加载中} aria-label="加载更多">
              {加载中 ? '加载中…' : '加载更多'}
            </button>
          ) : null}
        </div>

        {/* Task 5：如实的搜索状态——在途 / 空结果 / 失败（Mock 分支永远 idle 不显示） */}
        {搜索阶段 === 'loading' ? <div role="status">加载中…</div> : null}
        {搜索阶段 === 'success' && 候选项.length === 0 ? (
          <div role="status">没有匹配结果，试试缩短关键词</div>
        ) : null}
        {搜索阶段 === 'error' ? <div role="alert">加载失败，请重试</div> : null}
      </滚动区>

      <主按钮 文字="下一步" 按下={下一步} 禁用={不可继续} />
    </次级页外壳>
  );
}