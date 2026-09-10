import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { 规则 } from '../数据/类型';
import 确认层 from './确认层';
import { 轻提示 } from './轻提示';
import { 取Agent规则错误文案 } from '../状态/后端/Agent规则操作';
import 样式 from './可编辑规则行.module.css';

/** 双端共用：编辑、开关独立；滑动只揭开删除操作，确认后才写入。 */
export default function 可编辑规则行({ 条, 可编辑 = true, 保存, 删除, 切换 }: {
  条: 规则; 可编辑?: boolean;
  保存: (内容: string) => Promise<void>;
  删除: () => Promise<void>;
  切换: () => Promise<void>;
}) {
  const [编辑中, 设编辑中] = useState(false);
  const [草稿, 设草稿] = useState('');
  const [展开, 设展开] = useState(false);
  const [确认删除, 设确认删除] = useState(false);
  const [忙, 设忙] = useState(false);
  const 编辑输入 = useRef<HTMLTextAreaElement>(null);
  // 保留原生输入法与选区行为；正文换行时随内容、可用宽度调整高度。
  useLayoutEffect(() => {
    const 输入 = 编辑输入.current;
    if (!编辑中 || !输入) return;
    const 调整高度 = () => {
      输入.style.height = '0px';
      输入.style.height = `${输入.scrollHeight}px`;
    };
    调整高度();
    let 上次宽度 = 输入.clientWidth;
    const 观察器 = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
      if (输入.clientWidth === 上次宽度) return;
      上次宽度 = 输入.clientWidth;
      调整高度();
    });
    观察器?.observe(输入);
    return () => 观察器?.disconnect();
  }, [编辑中, 草稿]);
  const 锁 = useRef(false);
  const 组合中 = useRef(false);
  const 起点 = useRef<{ x: number; y: number } | null>(null);
  const 滑过 = useRef(false);
  const 执行 = async (操作: () => Promise<void>, 成功?: () => void) => {
    if (锁.current) return;
    锁.current = true; 设忙(true);
    try { await 操作(); 成功?.(); }
    catch (错误) { 轻提示(取Agent规则错误文案(错误)); }
    finally { 锁.current = false; 设忙(false); }
  };
  const 取消 = () => { if (!锁.current) { 设编辑中(false); 设草稿(''); } };
  const 提交 = () => {
    if (!草稿.trim() || 组合中.current) return;
    void 执行(() => 保存(草稿.trim()), () => 设编辑中(false));
  };
  return <>
    <div className={`${样式.外壳} ${展开 ? 样式.展开 : ''}`}>
      {可编辑 && 展开 ? <button className={样式.删除} aria-label={`删除规则：${条.内容}`} disabled={忙} onClick={() => 设确认删除(true)}><svg width="17" height="19" viewBox="0 0 20 22" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 6h14M7 6V3h6v3M5 6l.7 13h8.6L15 6M8 9v7m4-7v7" /></svg>删除</button> : null}
      <div className={样式.行}
        onTouchStart={事件 => { const 点 = 事件.touches[0]; 起点.current = { x: 点.clientX, y: 点.clientY }; 滑过.current = false; }}
        onTouchEnd={事件 => {
          if (!起点.current || !可编辑 || 编辑中 || 忙) return;
          const 点 = 事件.changedTouches[0]; const 横移 = 点.clientX - 起点.current.x; const 纵移 = 点.clientY - 起点.current.y;
          if (Math.abs(横移) > 30 && Math.abs(横移) > Math.abs(纵移)) { 设展开(横移 < 0); 滑过.current = true; }
          起点.current = null;
        }}
        onClickCapture={事件 => { if (滑过.current) { 事件.preventDefault(); 事件.stopPropagation(); 滑过.current = false; } }}>
        {编辑中 && 可编辑 ? <>
          <div className={样式.编辑正文}>
          <textarea ref={编辑输入} rows={1} aria-label={`编辑规则：${条.内容}`} className={样式.输入} value={草稿} autoFocus disabled={忙} enterKeyHint="done"
            onChange={事件 => 设草稿(事件.target.value)}
            onCompositionStart={() => { 组合中.current = true; }} onCompositionEnd={() => { 组合中.current = false; }}
            onKeyDown={事件 => {
              if (组合中.current || 事件.nativeEvent.isComposing || 事件.keyCode === 229) return;
              if (事件.key === 'Enter') { 事件.preventDefault(); 提交(); }
              if (事件.key === 'Escape') 取消();
            }} />
          </div>
          <button className={样式.文字键} disabled={忙} onClick={取消}>取消</button>
          <button className={样式.文字键} disabled={忙 || !草稿.trim()} onClick={提交}>完成</button>
        </> : <>
          <button className={`${样式.内容} ${!条.生效 ? 样式.停用 : ''}`} disabled={!可编辑 || 忙} onClick={() => {
            if (展开) { 设展开(false); return; }
            设草稿(条.内容); 设编辑中(true);
          }}>{条.内容}{可编辑 ? <svg className={样式.铅笔} width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25"><path d="m10.8 2.3 2.9 2.9M3 10.2l7.8-7.9a1.4 1.4 0 0 1 2 0l.9.9a1.4 1.4 0 0 1 0 2L5.8 13H3z" /></svg> : null}</button>
          {可编辑 ? <>
            <button className={样式.更多} aria-label={`${展开 ? '收起' : '显示'}删除：${条.内容}`} aria-expanded={展开} disabled={忙} onClick={() => 设展开(!展开)}>⋯</button>
            <button role="switch" aria-label={`规则：${条.内容}`} aria-checked={条.生效} className={样式.开关键} disabled={忙} onClick={() => { void 执行(切换); }}><span className={`${样式.勾圈} ${条.生效 ? 样式.生效 : ''}`}>{条.生效 ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M2 6.2 4.8 9 10 3.5" /></svg> : null}</span></button>
          </> : null}
        </>}
      </div>
    </div>
    {/* 放到既有设备遮罩挂载点，避免滚动清单和滑动行的层叠上下文遮挡。 */}
    {确认删除 ? createPortal(<确认层 标题="删除这条规则？" 正文={条.内容} 执行文={忙 ? '删除中…' : '删除'} 执行={() => { void 执行(删除, () => { 设确认删除(false); 设展开(false); }); }} 取消={() => { if (!锁.current) 设确认删除(false); }} />, document.querySelector('[data-遮罩挂载点]') ?? document.body) : null}
  </>;
}
