// 学生分流（完善资料）—— 引导说明之后的资料第一屏（标注 10:49 调整顺序）。
//
// 2026-08-19 按用户给的 BOSS 截图重构：原来只问「还在读书吗」一件事，
// 现在按截图合并成一屏三问 —— 是不是学生（并排双选钮）→ 希望在哪里工作（单选城市）
// → 期望的职位（可多选，上限 3）。选好的城市 + 职位落 全局.引导预填，
// 引导问答读到它就跳过「期望职位 / 工作城市」两题，不重复问。
//
// 学生答案仍落 全局.基本信息.身份（在校 / 在职），基本信息、工作经历、
// 引导问答三屏都读它分支 —— 这条链路与重构前一致。

import { useState } from 'react';
import 样式 from './学生分流.module.css';
import { 次级页外壳, 返回栏, 页面大标题, 主按钮, 滚动区 } from '../组件/通用';
import { 轻提示 } from '../组件/轻提示';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 路径 } from '../路由/路径表';
import { 城市字典, 热门城市 } from '../数据/城市与行业';
import { 职业分类表 } from '../数据/职业分类';

/** 期望职位上限：与 BOSS 同档，选满后再点给轻提示 */
const 职位上限 = 3;

/** 「猜你想找」快捷片：从职业分类表里挑三个常见小类，点了等同在弹层里选 */
const 快捷职位 = ['后端开发', '产品经理', '算法'];

export default function 学生分流() {
  const { 跳转, 返回 } = use导航();
  const { 状态: 全局, 派发 } = use应用状态();

  // 是否学生：默认跟着全局身份走，退回本屏重选时之前的选择还在
  const [是学生, 设是学生] = useState(全局.基本信息.身份 === '在校');
  const [城市, 设城市] = useState(全局.引导预填?.城市 ?? '上海');
  const [已选职位, 设已选职位] = useState<string[]>(全局.引导预填?.职位 ?? []);
  const [开城市层, 设开城市层] = useState(false);
  const [开职位层, 设开职位层] = useState(false);

  const 切职位 = (名: string) => {
    设已选职位((旧) => {
      if (旧.includes(名)) return 旧.filter((条) => 条 !== 名);
      if (旧.length >= 职位上限) {
        轻提示(`最多选 ${职位上限} 个`);
        return 旧;
      }
      return [...旧, 名];
    });
  };

  const 下一步 = () => {
    const 旧 = 全局.基本信息;
    // 选「是」→ 身份=在校；选「不是」→ 若此前是在校则落回在职，
    // 已是在职/离职的保持不动（离职是基本信息屏才细分的档，这里不覆盖）
    const 新身份 = 是学生 ? '在校' : 旧.身份 === '在校' ? '在职' : 旧.身份;
    // 学生没有工龄：清掉演示种子残留的 开始工作年，防止后面按「有工龄=社招」误判
    const 新开始工作年 = 是学生 ? '' : 旧.开始工作年;
    派发({
      型: '存简历',
      经历: 全局.简历经历,
      教育: 全局.简历教育,
      技能: 全局.简历技能,
      证书: 全局.简历证书,
      基本信息: { ...旧, 身份: 新身份, 开始工作年: 新开始工作年 },
    });
    派发({ 型: '存引导预填', 城市, 职位: 已选职位 });
    跳转(路径.基本信息);
  };

  return (
    <次级页外壳>
      <返回栏 返回={返回} />

      <页面大标题 标题="完善资料" />

      <滚动区 样式覆盖={{ padding: '4px 18px 10px' }}>
        {/* ── 你是学生吗：并排双选钮（截图同款布局）── */}
        <div className={样式.节问}>你是学生吗？</div>
        <div className={样式.双选行}>
          {([true, false] as const).map((值) => (
            <button
              key={String(值)}
              className={`${样式.选钮} ${是学生 === 值 ? 样式.选钮当前 : ''} 可点`}
              onClick={() => 设是学生(值)}
              aria-pressed={是学生 === 值}
            >
              {值 ? '是' : '不是'}
            </button>
          ))}
        </div>
        {/* 副行沿用重构前两张分流卡的既有文案，跟着当前选择切换 */}
        <div className={样式.选钮副行}>
          {是学生 ? '校招与实习岗位 · 不卡年限' : '社招岗位 · 按工作年限核对'}
        </div>

        {/* ── 希望在哪里工作：单选城市 ── */}
        <div className={`${样式.节问} ${样式.节问间距}`}>希望在哪里工作</div>
        <button className={`${样式.选择行} 可点`} onClick={() => 设开城市层(true)}>
          <span className={样式.选择值}>{城市}</span>
          <span className={样式.选择尖}>›</span>
        </button>

        {/* ── 期望的职位：可多选，上限 3 ── */}
        <div className={`${样式.节问} ${样式.节问间距}`}>期望的职位是（可多选）</div>
        <button className={`${样式.选择行} 可点`} onClick={() => 设开职位层(true)}>
          {已选职位.length === 0 ? (
            <span className={样式.选择占位}>选择期望职位</span>
          ) : (
            <span className={样式.选择值}>{已选职位.join('、')}</span>
          )}
          <span className={样式.选择尖}>›</span>
        </button>

        {/* 猜你想找：快捷片，点了等同在弹层里选中 */}
        <div className={样式.猜标}>猜你想找</div>
        <div className={样式.猜片行}>
          {快捷职位.map((名) => (
            <button
              key={名}
              className={`${样式.猜片} ${已选职位.includes(名) ? 样式.猜片选中 : ''} 可点`}
              onClick={() => 切职位(名)}
            >
              {名}
            </button>
          ))}
        </div>
      </滚动区>

      <主按钮 文字="下一步" 按下={下一步} 禁用={已选职位.length === 0} />

      {开城市层 ? (
        <城市弹层 当前={城市} 选定={(城) => { 设城市(城); 设开城市层(false); }} 关闭={() => 设开城市层(false)} />
      ) : null}
      {开职位层 ? (
        <职位弹层 已选={已选职位} 切换={切职位} 关闭={() => 设开职位层(false)} />
      ) : null}
    </次级页外壳>
  );
}

// ── 城市弹层：搜索 + 热门 + 按省铺开，单选即关 ─────────────────────
function 城市弹层({
  当前,
  选定,
  关闭,
}: {
  当前: string;
  选定: (城: string) => void;
  关闭: () => void;
}) {
  const [关键词, 设关键词] = useState('');
  const 词 = 关键词.trim();
  // 省名也算命中：输「浙」出浙江全省
  const 搜索结果 =
    词 === ''
      ? []
      : 城市字典.flatMap((组) =>
          组.省.includes(词) ? 组.城市 : 组.城市.filter((城) => 城.includes(词))
        );

  const 城市键 = (城: string) => (
    <button
      key={城}
      className={`${样式.城片} ${城 === 当前 ? 样式.城片选中 : ''} 可点`}
      onClick={() => 选定(城)}
    >
      {城}
    </button>
  );

  return (
    <div className={样式.遮罩} onClick={关闭}>
      <div className={样式.弹层} onClick={(事件) => 事件.stopPropagation()}>
        <div className={样式.弹层顶}>
          <span className={样式.弹层题}>希望在哪里工作</span>
          <button className={`${样式.弹层关} 可点`} onClick={关闭} aria-label="关闭">✕</button>
        </div>
        <div className={样式.弹层搜}>
          <input
            className={样式.弹层搜入}
            placeholder="搜索城市 / 省份"
            value={关键词}
            onChange={(事件) => 设关键词(事件.target.value)}
          />
        </div>
        <div className={`${样式.弹层体} 滚动区`}>
          {词 !== '' ? (
            <div className={样式.城网}>{搜索结果.map(城市键)}</div>
          ) : (
            <>
              <div className={样式.组标}>热门城市</div>
              <div className={样式.城网}>{热门城市.map(城市键)}</div>
              {城市字典.map((组) => (
                <div key={组.省}>
                  <div className={样式.组标}>{组.省}</div>
                  <div className={样式.城网}>{组.城市.map(城市键)}</div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 职位弹层：左大类栏 + 右小类多选（沿用 发布岗位 的职业分类表）──────
function 职位弹层({
  已选,
  切换,
  关闭,
}: {
  已选: string[];
  切换: (名: string) => void;
  关闭: () => void;
}) {
  const [当前大类, 设当前大类] = useState(职业分类表[0].大类);
  const 小类列表 = 职业分类表.find((组) => 组.大类 === 当前大类)?.小类 ?? [];

  return (
    <div className={样式.遮罩} onClick={关闭}>
      <div className={样式.弹层} onClick={(事件) => 事件.stopPropagation()}>
        <div className={样式.弹层顶}>
          <span className={样式.弹层题}>期望的职位是（可多选）</span>
          <button className={`${样式.弹层关} 可点`} onClick={关闭} aria-label="关闭">✕</button>
        </div>
        <div className={样式.职双栏}>
          <div className={`${样式.职左栏} 滚动区`}>
            {职业分类表.map((组) => (
              <button
                key={组.大类}
                className={`${样式.职大类} ${组.大类 === 当前大类 ? 样式.职大类当前 : ''} 可点`}
                onClick={() => 设当前大类(组.大类)}
              >
                {组.大类}
              </button>
            ))}
          </div>
          <div className={`${样式.职右栏} 滚动区`}>
            {小类列表.map((名) => (
              <button
                key={名}
                className={`${样式.职小类} ${已选.includes(名) ? 样式.职小类选中 : ''} 可点`}
                onClick={() => 切换(名)}
              >
                {名}
              </button>
            ))}
          </div>
        </div>
        <div className={样式.弹层脚}>
          <button className={`${样式.弹层定} 可点`} onClick={关闭}>
            完成{已选.length > 0 ? `（已选 ${已选.length}）` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
