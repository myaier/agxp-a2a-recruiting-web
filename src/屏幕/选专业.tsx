// 你的专业是（/onboard/major）—— 2026-08-20 按 BOSS 截图顺序重排：
// 输入框 + 联想候选（标注 13:04：输「经济」出所有带经济字样的专业），
// 副行回显上一屏选好的学校名。答案落 简历教育[0].专业。

import { useState } from 'react';
import 样式 from './入职引导.module.css';
import { 次级页外壳, 返回栏, 页面大标题, 主按钮, 滚动区 } from '../组件/通用';
import { 轻提示 } from '../组件/轻提示';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 取后端错误文案 } from '../数据/HTTP客户端';
import { 路径 } from '../路由/路径表';
import { 专业名录 } from '../数据/专业名录';

export default function 选专业() {
  const { 跳转, 返回 } = use导航();
  const { 状态: 全局, 操作 } = use应用状态();
  const 首段 = 全局.简历教育[0];

  const [专业, 设专业] = useState(首段?.专业 ?? '');
  // 点过候选后收起联想，避免选完还挂着列表
  const [已点选, 设已点选] = useState(false);
  const 词 = 专业.trim();
  const 候选 = 已点选 || 词 === '' ? [] : 专业名录.filter((名) => 名.includes(词) && 名 !== 词);

  const 下一步 = async () => {
    if (词 === '') {
      轻提示('先填专业名称');
      return;
    }
    try {
      await 操作.保存简历({
        基本信息: 全局.基本信息,
        个人优势: 全局.个人优势,
        技能: 全局.简历技能,
        经历: 全局.简历经历,
        教育: 全局.简历教育.map((条, 序) => (序 === 0 ? { ...条, 专业: 词 } : 条)),
        证书: 全局.简历证书,
      });
      跳转(路径.就读时间段);
    } catch (错误) {
      轻提示(取后端错误文案(错误));
    }
  };

  return (
    <次级页外壳>
      <返回栏 返回={返回} />

      {/* 副行回显学校名：确认「填的是这所学校的专业」 */}
      <页面大标题 标题="你的专业是" 说明={首段?.学校 || undefined} />

      <滚动区 样式覆盖={{ padding: '14px 22px 12px' }}>
        <div className={样式.输入行}>
          <input
            className={样式.输入}
            placeholder="专业名称"
            value={专业}
            onChange={(事件) => {
              设专业(事件.target.value);
              设已点选(false);
            }}
          />
        </div>

        {/* 联想候选：与毕业院校页同款行样式 */}
        <div className={样式.候选列表}>
          {候选.map((名) => (
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
