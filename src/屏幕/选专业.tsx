// 你的专业是（/onboard/major）—— 2026-08-20 按 BOSS 截图顺序重排：
// 输入框 + 联想候选（标注 13:04：输「经济」出所有带经济字样的专业），
// 副行回显上一屏选好的学校名。答案落 简历教育[0].专业。
//
// Task 4：Backend 分支按需 查询Taxonomy('majors', { q, limit })（专业无层级，
// 只发 q + cursor）；点候选才存 专业引用，继续输入清除旧引用，
// 没点候选时阻止保存。Mock 分支保持本地 专业名录 不变。

import { useEffect, useRef, useState } from 'react';
import 样式 from './入职引导.module.css';
import { 次级页外壳, 返回栏, 页面大标题, 主按钮, 滚动区 } from '../组件/通用';
import { 轻提示 } from '../组件/轻提示';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 取后端错误文案 } from '../数据/HTTP客户端';
import { 路径 } from '../路由/路径表';
import { 专业名录 } from '../数据/专业名录';
import type { BFFTaxonomyItem } from '../数据/BFF契约';
import type { 目录选择值 } from '../数据/招聘数据源类型';

const 搜索防抖毫秒 = 250;

export default function 选专业() {
  const { 跳转, 返回 } = use导航();
  const { 状态: 全局, 操作, 数据源模式, 目录查询 } = use应用状态();
  const 是后端 = 数据源模式 === 'backend';
  const 首段 = 全局.简历教育[0];

  const [专业, 设专业] = useState(首段?.专业 ?? '');
  // 点过候选后收起联想，避免选完还挂着列表
  const [已点选, 设已点选] = useState(false);
  // Backend：点候选后才落的引用；继续输入立即清空
  const [专业引用, 设专业引用] = useState<目录选择值 | undefined>(首段?.专业引用);
  const [候选项, 设候选项] = useState<BFFTaxonomyItem[]>([]);
  const 计时 = useRef(0);
  const 方法引用 = useRef(目录查询?.查询Taxonomy);
  方法引用.current = 目录查询?.查询Taxonomy;

  const 词 = 专业.trim();

  // Backend 搜索：250ms debounce 后 查询Taxonomy('majors', { q, limit })
  useEffect(() => {
    if (!是后端) return;
    const 方法 = 方法引用.current;
    const trimmed = 词;
    if (!方法 || trimmed === '') {
      设候选项([]);
      return;
    }
    window.clearTimeout(计时.current);
    计时.current = window.setTimeout(async () => {
      try {
        const 页 = await 方法('majors', { q: trimmed, limit: 20 });
        设候选项(页.items);
      } catch {
        设候选项([]);
      }
    }, 搜索防抖毫秒);
    return () => window.clearTimeout(计时.current);
  }, [专业, 是后端, 词]);

  // Mock 候选：本地名录过滤
  const mock候选 = 已点选 || 词 === '' ? [] : 专业名录.filter((名) => 名.includes(词) && 名 !== 词);

  const 选候选 = (项: BFFTaxonomyItem) => {
    设专业(项.display_name);
    设专业引用({ id: 项.id, display_name: 项.display_name });
    设已点选(true);
    设候选项([]);
  };

  const 输入改变 = (值: string) => {
    设专业(值);
    设已点选(false);
    if (专业引用 !== undefined) 设专业引用(undefined);
  };

  const 下一步 = async () => {
    if (词 === '') {
      轻提示('先填专业名称');
      return;
    }
    // Backend：没点过候选 → 阻止保存
    if (是后端 && 专业引用 === undefined) {
      轻提示('请从候选专业中选择');
      return;
    }
    try {
      await 操作.保存简历({
        基本信息: 全局.基本信息,
        个人优势: 全局.个人优势,
        技能: 全局.简历技能,
        经历: 全局.简历经历,
        教育: 全局.简历教育.map((条, 序) =>
          序 === 0 ? { ...条, 专业: 词, 专业引用 } : 条,
        ),
        证书: 全局.简历证书,
      });
      跳转(路径.就读时间段);
    } catch (错误) {
      轻提示(取后端错误文案(错误));
    }
  };

  return (
    <次级页外壳 白底>
      <返回栏 返回={返回} />

      {/* 副行回显学校名：确认「填的是这所学校的专业」 */}
      <页面大标题 标题="你的专业是" 说明={首段?.学校 || undefined} />

      <滚动区 样式覆盖={{ padding: '14px 22px 12px' }}>
        <div className={样式.输入行}>
          <input
            className={样式.输入}
            placeholder="专业名称"
            value={专业}
            onChange={(事件) => 输入改变(事件.target.value)}
          />
        </div>

        {/* 联想候选：与毕业院校页同款行样式 */}
        <div className={样式.候选列表}>
          {是后端
            ? 候选项.map((项) => (
                <button
                  key={项.id}
                  className={`${样式.候选行} 可点`}
                  onClick={() => 选候选(项)}
                >
                  {项.display_name}
                </button>
              ))
            : mock候选.map((名) => (
                <button
                  key={名}
                  className={`${样式.候选行} 可点`}
                  onClick={() => {
                    设专业(名);
                    设已点选(true);
                  }}
                >
                  {名}
                </button>
              ))}
        </div>
      </滚动区>

      <主按钮 文字="下一步" 按下={下一步} 禁用={词 === ''} />
    </次级页外壳>
  );
}