// 你毕业于（/onboard/school）—— 2026-08-20 按 BOSS 截图顺序重排：
// 搜索输入 + 常见高校候选列表（数据/高校名录 30 所 mock，输入即过滤），
// 点选或直接手输均可。答案落 简历教育[0].学校。

import { useState } from 'react';
import 样式 from './入职引导.module.css';
import { 次级页外壳, 返回栏, 页面大标题, 主按钮, 滚动区 } from '../组件/通用';
import { 放大镜图标 } from '../组件/图标';
import { 轻提示 } from '../组件/轻提示';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 路径 } from '../路由/路径表';
import { 高校名录 } from '../数据/高校名录';

export default function 毕业院校() {
  const { 跳转, 返回 } = use导航();
  const { 状态: 全局, 派发 } = use应用状态();
  const 首段 = 全局.简历教育[0];

  // 输入框即答案：点候选 = 把校名灌进输入框，也可以直接手输名录外的学校
  const [学校, 设学校] = useState(首段?.学校 ?? '');

  const 词 = 学校.trim();
  // 输入即过滤；为空时铺全名录当候选
  const 候选 = 词 === '' ? 高校名录 : 高校名录.filter((名) => 名.includes(词));

  const 下一步 = () => {
    if (词 === '') {
      轻提示('先填学校名称');
      return;
    }
    派发({
      型: '存简历',
      经历: 全局.简历经历,
      教育: 全局.简历教育.map((条, 序) => (序 === 0 ? { ...条, 学校: 词 } : 条)),
      技能: 全局.简历技能,
      证书: 全局.简历证书,
      基本信息: 全局.基本信息,
    });
    跳转(路径.选专业);
  };

  return (
    <次级页外壳>
      <返回栏 返回={返回} />

      <页面大标题 标题="你毕业于" />

      <滚动区 样式覆盖={{ padding: '14px 22px 12px' }}>
        <div className={样式.输入行}>
          <放大镜图标 尺寸={15} 色="var(--最弱)" 线宽={2.2} />
          <input
            className={样式.输入}
            placeholder="学校名称"
            value={学校}
            onChange={(事件) => 设学校(事件.target.value)}
          />
        </div>

        {/* 常见高校候选：点选即填入 */}
        <div className={样式.候选列表}>
          {候选.map((名) => (
            <button
              key={名}
              className={`${样式.候选行} ${名 === 词 ? 样式.候选行选中 : ''} 可点`}
              onClick={() => 设学校(名)}
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
