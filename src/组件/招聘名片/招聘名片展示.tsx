// 招聘名片共用展示（接口 B）：Mock「收笔落全局」与 Backend「受控一次保存」两条来源只渲染这一份 JSX。
//
// 只吃 招聘名片展示属性 + 业务回调：不读数据源模式、不读全局业务状态、不 import Mock 表、
// 不发请求、不按 ID 拼路由 —— 保存、选图、关系选择、返回、公司主页资料都由外层连接函数传入。
// 纯展示状态只有 file input ref；上传事务与保存生命周期留在外层。
//
// Spec §3.6：占位只用于展示文案与 input placeholder；value/defaultValue 永远是真实字段或空串，
// 「未知」不参与校验、保存或上传。
//
// 两种持久化时机刻意不统一（Spec §5.2）：受控模式 value/onChange（外层持有 state），
// 收笔模式 defaultValue/onBlur（失焦才通知外层），绝不同时给同一 input 传 value 与 defaultValue。
// 只有收笔模式处理非合成回车 → blur（Mock 原行为）；Backend 的受控输入不新增回车提交。

import { useRef } from 'react';
import { 次级页外壳, 返回栏, 页面大标题, 滚动区, 表单条目, 主按钮 } from '../通用';
import { 相机图标 } from '../图标';
import 样式 from './招聘名片展示.module.css';

export type 名片输入 =
  | { 模式: '受控'; 值: string; 修改: (值: string) => void }
  | { 模式: '收笔'; 值: string; 收笔: (值: string) => void };

export interface 招聘名片展示属性 {
  预览: {
    姓名: string;
    职务: string;
    公司: string;
    图片: string | null;
    暂存图片: boolean;
    已认证: boolean;
  };
  姓名: { 类型: '只读'; 值: string } | { 类型: '公开名'; 输入: 名片输入 } | { 类型: '姓名'; 输入: 名片输入 };
  职务: 名片输入;
  公司: {
    关系: readonly { id: string; 名称: string; 角色: string; 状态: string; 可选: boolean; 当前: boolean }[];
    选择: (id: string) => void;
    待选提示: boolean;
    声明: { 标签: '公司' | '公司（未认证声明）'; 输入: 名片输入 } | null;
  };
  选照片: (文件: File) => void;
  保存: () => void;
  保存文字: string;
  保存中: boolean;
  返回: () => void;
  打开公司资料: () => void;
}

/** 未知占位：只用于展示文案，不进入输入、校验或提交 */
function 未知(文案: string) {
  return <span className={样式.未知}>{文案}</span>;
}

/** 一条无框就地输入行：外壳 + 唯一一份 input JSX，受控/收笔只差事件属性。
 *  aria-label 稳定为字段名，不随标签文案（姓名（公开名）等）改变。 */
function 就地输入行({
  标签,
  无障碍标签,
  提示,
  输入,
}: {
  标签: string;
  无障碍标签: string;
  提示: string;
  输入: 名片输入;
}) {
  const 事件属性 =
    输入.模式 === '受控'
      ? {
          value: 输入.值,
          onChange: (事件: React.ChangeEvent<HTMLInputElement>) => 输入.修改(事件.target.value),
        }
      : {
          defaultValue: 输入.值,
          onBlur: (事件: React.FocusEvent<HTMLInputElement>) => 输入.收笔(事件.currentTarget.value),
          onKeyDown: (事件: React.KeyboardEvent<HTMLInputElement>) => {
            // isComposing 挡住中文输入法「回车上屏候选词」那一下被误当收笔；
            // blur() 让收笔只走 onBlur 一条路径，避免回车与失焦各提交一次
            if (事件.key === 'Enter' && !事件.nativeEvent.isComposing) {
              事件.currentTarget.blur();
            }
          },
        };
  return (
    <div className={样式.就地条目}>
      <div className={样式.就地标签}>{标签}</div>
      <input
        className={样式.就地输入}
        aria-label={无障碍标签}
        placeholder={提示}
        enterKeyHint="done"
        {...事件属性}
      />
    </div>
  );
}

export default function 招聘名片展示({
  预览,
  姓名,
  职务,
  公司,
  选照片,
  保存,
  保存文字,
  保存中,
  返回,
  打开公司资料,
}: 招聘名片展示属性) {
  const 文件框 = useRef<HTMLInputElement>(null);
  /** 选取后立刻清空 value：同一张图重选也触发 change；File 交给外层，事件不出展示层 */
  function 选了文件(事件: React.ChangeEvent<HTMLInputElement>) {
    const 文件 = 事件.target.files?.[0];
    事件.target.value = '';
    if (文件) 选照片(文件);
  }

  return (
    <次级页外壳>
      <返回栏 返回={返回} />

      <页面大标题 标题="招聘名片" />

      <滚动区 样式覆盖={{ padding: '6px 22px 0' }}>
        {/* ── 名片预览：候选人从第一轮起看到的就是这一行 ── */}
        <div className={样式.预览行}>
          {/* 头像可传真人照片；暂存预览优先于权威图，无图是中性空白图位，不用首字冒充 */}
          <button
            className={`${样式.头像键} 可点`}
            onClick={() => 文件框.current?.click()}
            aria-label="上传头像"
          >
            {预览.图片 ? (
              <img
                className={样式.头像图}
                src={预览.图片}
                alt={预览.暂存图片 ? '头像预览' : ''}
              />
            ) : (
              <span className={样式.头像占位} role="img" aria-label="头像未知" />
            )}
            <span className={样式.相机角标}>
              <相机图标 尺寸={11} 色="var(--正文)" />
            </span>
          </button>
          <input
            ref={文件框}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            aria-label="更换头像"
            onChange={选了文件}
          />
          <span className={样式.预览文字}>
            <span className={`${样式.预览姓名} 单行`}>
              {预览.姓名 || 未知('姓名未知')}
              {预览.已认证 ? <span className={样式.认证标}>已认证</span> : null}
            </span>
            <span className={`${样式.预览副行} 单行`}>
              {预览.职务 || 未知('职务未知')} · {预览.公司 || 未知('企业信息未知')}
            </span>
          </span>
        </div>

        {/* ── 姓名：实名只读文本；可编辑时 aria-label 仍稳定为「姓名」── */}
        {姓名.类型 === '只读' ? (
          <div className={样式.就地条目}>
            <div className={样式.就地标签}>姓名（已实名，不可修改）</div>
            <div className={样式.就地输入}>{姓名.值}</div>
          </div>
        ) : 姓名.类型 === '公开名' ? (
          <就地输入行 标签="姓名（公开名）" 无障碍标签="姓名" 提示="请填写姓名" 输入={姓名.输入} />
        ) : (
          <就地输入行 标签="姓名" 无障碍标签="姓名" 提示="请填写姓名" 输入={姓名.输入} />
        )}

        {/* ── 职务 ── */}
        <就地输入行 标签="职务" 无障碍标签="职务" 提示="请填写职务" 输入={职务} />

        {/* ── 公司：关系列表与声明输入是连接层算好的两种业务状态 ── */}
        {公司.关系.length > 0 ? (
          <div className={样式.就地条目}>
            <div className={样式.就地标签}>任职企业</div>
            {公司.待选提示 ? <div className={样式.就地标签}>请选择当前任职企业</div> : null}
            {公司.关系.map((项) =>
              项.可选 ? (
                <button
                  key={项.id}
                  className={`${样式.就地输入} 可点`}
                  style={{ textAlign: 'left', cursor: 'pointer' }}
                  onClick={() => 公司.选择(项.id)}
                >
                  {项.名称} · {项.角色} · {项.状态}
                  {项.当前 ? '（当前）' : ''}
                </button>
              ) : (
                <div key={项.id} className={样式.就地输入} style={{ color: 'var(--次要浅)' }}>
                  {项.名称} · {项.角色} · {项.状态}（不可选）
                </div>
              ),
            )}
          </div>
        ) : null}
        {公司.声明 ? (
          <就地输入行
            标签={公司.声明.标签}
            无障碍标签="公司"
            提示="请填写公司名称"
            输入={公司.声明.输入}
          />
        ) : null}

        {/* ── 公司主页资料：名片是「这个人」，公司主页是「这家公司」── */}
        <表单条目 标签="公司主页资料" 值="LOGO · 简介 · 规模 · 办公地" 按下={打开公司资料} />
      </滚动区>

      <主按钮 文字={保存中 ? '保存中…' : 保存文字} 禁用={保存中} 按下={保存} />
    </次级页外壳>
  );
}
