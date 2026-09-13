// 公司选择层（Task 2 合同 B）：七页共用的「选择企业」底部抽屉正文。纯展示组件 ——
// 不读 Context、HTTP、BFF DTO、路由或存储：搜索/创建回调与结果行都由页面给入，
// 结果行只按 键（organization_id）交回，完整项由调用方在本实例结果中定位，
// 正常选中回填后关闭；添加成功用返回项执行同一个回填路径。
//
// 骨架以 弹层框架 为骨架，版式照原行业选择（工作经历.module.css 的 遮罩/选择层/
// 抓手/标题/列表），候选行沿用教育候选列表（目录候选列表，入职引导.module.css 的
// 行与选中勾）；本文件 CSS 只补公司特有的 搜索框、正文高度与错误位置。
//
// 「搜索/添加」两视图与名称编辑值是本组件的局部展示状态；创建在途禁用「添加并选择」，
// 失败保留名称与错误；进入添加预填搜索词，返回搜索不丢原父页选择。
// 名称校验是创建链路的上游守门（组织操作层不做名称校验）：去首尾空白后
// 1–80 个 Unicode 码点，且不含控制字符。
//
// 关闭回调经 ref 稳定化：弹层框架的 effect 依赖 关闭，不稳定的关闭会让父层每次
// 重渲染把焦点收回首个控件，打断连续输入与中文输入法。组件不给 Enter 绑定任何
// 选择/提交 —— 中文输入法组词确认不会触发首行选择或创建。

import { useCallback, useRef, useState } from 'react';
import 抽屉样式 from '../屏幕/工作经历.module.css';
import 界面样式 from './通用.module.css';
import 本样式 from './公司选择层.module.css';
import 弹层框架 from './弹层框架';
import { 目录候选列表 } from './目录候选列表';

/** 一枚结果行：键 = organization_id，由页面从其搜索结果原样映射 */
export type 公司选择行 = { 键: string; 名称: string; 正式名: string | null; 已认证: boolean; 选中: boolean };

/** 正文 props（页面局部契约，不是公共领域模型） */
export type 公司选择层属性 = {
  搜索词: string; 修改搜索词: (value: string) => void;
  项们: 公司选择行[]; 搜索中: boolean; 搜索错误: string | null; 重试搜索: () => void;
  还有: boolean; 加载中: boolean; 加载错误: string | null; 加载更多: () => void;
  选定: (key: string) => void; 关闭: () => void;
  创建中: boolean; 创建错误: string | null; 添加: (name: string) => void;
};

/** 创建名称的上游校验（组织操作层不做名称校验，本 UI 层把守后端同名规则）：
    去首尾空白后 1–80 个 Unicode 码点，不含控制字符；空时返回「输入公司名称」。 */
export function 校验公司名称(值: string): string | null {
  const 名称 = 值.trim();
  const 码点数 = Array.from(名称).length;
  if (码点数 === 0) return '输入公司名称';
  // 故意匹配控制字符：这里就是要拦下它们
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001F\u007F-\u009F]/.test(名称)) return '公司名称不能包含控制字符';
  if (码点数 > 80) return '公司名称需为 1–80 个字符';
  return null;
}

export function 公司选择层({
  搜索词,
  修改搜索词,
  项们,
  搜索中,
  搜索错误,
  重试搜索,
  还有,
  加载中,
  加载错误,
  加载更多,
  选定,
  关闭,
  创建中,
  创建错误,
  添加,
}: 公司选择层属性): React.JSX.Element {
  const [在添加, 设在添加] = useState(false);
  const [名称, 设名称] = useState('');
  // 关闭 经 ref 稳定化后交给 弹层框架：弹层 effect 依赖 关闭，父层每次重渲染的新
  // 标识若直达弹层，焦点会被收回首个控件，连续输入/中文输入法被打断
  const 关闭引用 = useRef(关闭);
  关闭引用.current = 关闭;
  const 稳定关闭 = useCallback(() => 关闭引用.current(), []);
  const 添加引用 = useRef(添加);
  添加引用.current = 添加;

  const 校验错误 = 校验公司名称(名称);
  const 词非空 = 搜索词.trim() !== '';

  const 提交添加 = () => {
    if (创建中 || 校验公司名称(名称) !== null) return;
    添加引用.current(名称);
  };

  /** 公司行 → 简单候选行：主行常用名，副文 = 正式名（存在时）+ 认证文字（恒展示） */
  const 列表项 = 项们.map((行) => {
    const 认证文字 = 行.已认证 ? '已认证' : '未认证';
    return {
      键: 行.键,
      名称: 行.名称,
      副文: 行.正式名 !== null ? `${行.正式名} · ${认证文字}` : 认证文字,
      选中: 行.选中,
    };
  });

  return (
    <弹层框架 标签="选择企业" 遮罩类名={抽屉样式.遮罩} 面板类名={抽屉样式.选择层} 关闭={稳定关闭}>
      <div className={抽屉样式.选择层抓手} />
      {在添加 ? (
        <>
          <button type="button" className={本样式.返回键} onClick={() => 设在添加(false)}>
            返回搜索
          </button>
          <div className={抽屉样式.选择层标题}>添加新企业</div>
          <input
            className={本样式.输入框}
            value={名称}
            placeholder="输入公司名称"
            onChange={(事件) => 设名称(事件.target.value)}
          />
          <div className={本样式.说明行}>添加企业不会自动获得管理员权限</div>
          {创建错误 ? <div className={本样式.错误行}>{创建错误}</div> : null}
          {校验错误 !== null && 名称.trim() !== '' ? (
            <div className={本样式.错误行}>{校验错误}</div>
          ) : null}
          <button
            type="button"
            className={界面样式.主按钮}
            onClick={提交添加}
            disabled={创建中 || 校验错误 !== null}
            aria-busy={创建中 || undefined}
          >
            添加并选择
          </button>
        </>
      ) : (
        <>
          <div className={抽屉样式.选择层标题}>选择企业</div>
          <input
            className={本样式.输入框}
            value={搜索词}
            placeholder="输入公司名称"
            onChange={(事件) => 修改搜索词(事件.target.value)}
          />
          <div className={本样式.正文}>
            <目录候选列表 项们={列表项} 加载中={加载中} 还有={还有} 选定={选定} 加载更多={加载更多} />
            {/* 首页失败给错误与重试，不假称「没有企业」；空词提示输入；真零结果才提示没找到 */}
            {搜索错误 ? (
              <>
                <div className={本样式.错误行}>{搜索错误}</div>
                <button type="button" className={本样式.重试键} onClick={重试搜索}>
                  重试
                </button>
              </>
            ) : null}
            {!搜索错误 && 搜索中 && 项们.length === 0 ? (
              <div className={本样式.提示行}>搜索中…</div>
            ) : null}
            {!搜索错误 && !搜索中 && 词非空 && 项们.length === 0 ? (
              <div className={本样式.提示行}>没有找到相关企业</div>
            ) : null}
            {!搜索错误 && !词非空 ? <div className={本样式.提示行}>输入公司名称</div> : null}
          </div>
          {加载错误 ? <div className={本样式.错误行}>{加载错误}</div> : null}
          <button type="button" className={本样式.添加入口} onClick={() => { 设名称(搜索词); 设在添加(true); }}>
            添加新企业
          </button>
        </>
      )}
    </弹层框架>
  );
}