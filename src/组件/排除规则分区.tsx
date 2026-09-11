import { useRef, useState } from 'react';
import { use应用状态 } from '../状态/应用状态';
import 可编辑规则行 from './可编辑规则行';
import type { 规则 } from '../数据/类型';
import 样式 from '../屏幕/规则库.module.css';

// 仅演示账号的初始数据；真实后端不得用模拟排除条件冒充权威数据。
const 演示排除规则: 规则[] = ['大小周', '纯外包 / 乙方', '全现场办公', '频繁出差'].map((内容, 序) => ({
  编号: `排除-${序 + 1}`, 内容, 来源: '初始化排除条件', 生效: 序 !== 1,
}));
export default function 排除规则分区() {
  const { 状态, 派发, 数据源模式 } = use应用状态();
  const [添加中, 设添加中] = useState(false);
  const [草稿, 设草稿] = useState('');
  const 组合中 = useRef(false);
  const 列 = 状态.排除规则 ?? 演示排除规则;
  const 写 = async (规则们: 规则[]) => { 派发({ 型: '设排除规则', 规则: 规则们 }); };
  const 取消 = () => { 设添加中(false); 设草稿(''); };
  const 添加 = () => {
    if (!草稿.trim() || 组合中.current) return;
    void 写([...列, { 编号: `排除-${crypto.randomUUID()}`, 内容: 草稿.trim(), 生效: true, 来源: '手动添加' }]);
    取消();
  };
  return <section aria-label="哪些情况直接排除" className={样式.分区}>
    <h2 className={样式.分组标}>哪些情况直接排除</h2>
    {数据源模式 === 'backend' ? <p className={样式.边界说明}>初始化排除条件保存在求职意向中，暂不支持在此统一编辑；已有条件继续生效。</p> : <>
      <div className={样式.卡}>{列.map(条 => <可编辑规则行 key={条.编号} 条={条}
        保存={内容 => 写(列.map(项 => 项.编号 === 条.编号 ? { ...项, 内容 } : 项))}
        删除={() => 写(列.filter(项 => 项.编号 !== 条.编号))}
        切换={() => 写(列.map(项 => 项.编号 === 条.编号 ? { ...项, 生效: !项.生效 } : 项))} />)}</div>
      {添加中 ? <div className={样式.添加输入行}>
        <input className={样式.添加输入框} aria-label="添加排除规则" placeholder="写下要直接排除的情况" value={草稿} autoFocus enterKeyHint="done" onChange={事件 => 设草稿(事件.target.value)}
          onCompositionStart={() => { 组合中.current = true; }} onCompositionEnd={() => { 组合中.current = false; }}
          onKeyDown={事件 => { if (组合中.current || 事件.nativeEvent.isComposing || 事件.keyCode === 229) return; if (事件.key === 'Enter') 添加(); if (事件.key === 'Escape') 取消(); }} />
        <button className={样式.取消添加} onClick={取消}>取消</button><button className={样式.确认添加} disabled={!草稿.trim()} onClick={添加}>添加</button>
      </div> : <button className={样式.手动添加} onClick={() => 设添加中(true)}><span className={样式.添加圆}>＋</span><span className={样式.添加文字}>添加规则</span></button>}
    </>}
  </section>;
}
