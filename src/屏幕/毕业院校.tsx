// 你毕业于（/onboard/school）—— 2026-08-20 按 BOSS 截图顺序重排：
// 搜索输入，输入后才出高校候选（数据/高校名录 30 所 mock），
// 点选或直接手输均可。答案落 简历教育[0].学校。
//
// Task 4：Backend 分支按需 查询Institution（250ms debounce），候选行复用现有
// 候选行 副行元素显示「城市 · 国家」，点候选才存 学校引用；继续输入清除旧引用，
// 没点候选时复用 轻提示 阻止保存。Mock 分支保持本地 高校名录 不变。

import { useEffect, useRef, useState } from 'react';
import 样式 from './入职引导.module.css';
import { 次级页外壳, 返回栏, 页面大标题, 主按钮, 滚动区 } from '../组件/通用';
import { 放大镜图标 } from '../组件/图标';
import { 轻提示 } from '../组件/轻提示';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 取后端错误文案 } from '../数据/HTTP客户端';
import { 路径 } from '../路由/路径表';
import { 高校名录 } from '../数据/高校名录';
import { 学校副标题 } from '../数据/目录选择';
import type { BFFInstitutionItem } from '../数据/BFF契约';
import type { 目录选择值 } from '../数据/招聘数据源类型';

const 搜索防抖毫秒 = 250;

export default function 毕业院校() {
  const { 跳转, 返回 } = use导航();
  const { 状态: 全局, 操作, 数据源模式, 目录查询 } = use应用状态();
  const 是后端 = 数据源模式 === 'backend';
  const 首段 = 全局.简历教育[0];

  // 输入框即答案：点候选 = 把校名灌进输入框，也可以直接手输名录外的学校
  const [学校, 设学校] = useState(首段?.学校 ?? '');
  // Backend：点候选后才落的引用；继续输入立即清空
  const [学校引用, 设学校引用] = useState<目录选择值 | undefined>(首段?.学校引用);
  const [候选项, 设候选项] = useState<BFFInstitutionItem[]>([]);
  const 计时 = useRef(0);
  const 方法引用 = useRef(目录查询?.查询Institution);
  方法引用.current = 目录查询?.查询Institution;

  const 词 = 学校.trim();

  // Backend 搜索：250ms debounce 后 查询Institution({ q, limit: 20 })
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
        const 页 = await 方法({ q: trimmed, limit: 20 });
        设候选项(页.items);
      } catch {
        设候选项([]);
      }
    }, 搜索防抖毫秒);
    return () => window.clearTimeout(计时.current);
  }, [学校, 是后端, 词]);

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
        </div>
      </滚动区>

      <主按钮 文字="下一步" 按下={下一步} 禁用={词 === ''} />
    </次级页外壳>
  );
}