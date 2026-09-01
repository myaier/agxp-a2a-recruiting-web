import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type KeyboardEventHandler,
  type MouseEventHandler,
  type RefObject,
} from 'react';

interface 可访问滚轮参数 {
  选项: readonly number[];
  值: number;
  设值: (值: number) => void;
  行高: number;
}

interface 滚轮选项属性 {
  id: string;
  onClick: MouseEventHandler<HTMLElement>;
}

interface 可访问滚轮结果 {
  滚轮引用: RefObject<HTMLDivElement | null>;
  活动项编号: string | undefined;
  处理滚动: () => void;
  处理按键: KeyboardEventHandler<HTMLDivElement>;
  取选项属性: (序号: number) => 滚轮选项属性;
}

const 夹序号 = (序号: number, 长度: number) =>
  Math.min(Math.max(序号, 0), Math.max(长度 - 1, 0));

export function use可访问滚轮({ 选项, 值, 设值, 行高 }: 可访问滚轮参数): 可访问滚轮结果 {
  const 滚轮引用 = useRef<HTMLDivElement>(null);
  const 防抖计时 = useRef(0);
  const 自报值 = useRef(值);
  const 已定位序号 = useRef<number | null>(null);
  const 待忽略程序序号 = useRef<number | null>(null);
  const 编号前缀 = `wheel-${useId().replaceAll(':', '')}`;
  const 当前序号 = 选项.indexOf(值);
  const 选项编号 = useCallback(
    (序号: number) => `${编号前缀}-option-${序号}`,
    [编号前缀],
  );

  const 滚到序号 = useCallback((序号: number) => {
    const 节点 = 滚轮引用.current;
    if (!节点) return;
    window.clearTimeout(防抖计时.current);
    待忽略程序序号.current = 序号;
    已定位序号.current = 序号;
    节点.scrollTop = 序号 * 行高;
  }, [行高]);

  const 选择序号 = useCallback((原序号: number, 聚焦: boolean) => {
    if (选项.length === 0) return;
    const 序号 = 夹序号(原序号, 选项.length);
    const 下一值 = 选项[序号];
    自报值.current = 下一值;
    滚到序号(序号);
    if (聚焦) 滚轮引用.current?.focus();
    if (下一值 !== 值) 设值(下一值);
  }, [值, 滚到序号, 设值, 选项]);

  useEffect(() => {
    if (当前序号 < 0) return;
    if (已定位序号.current === 当前序号 && 自报值.current === 值) return;
    自报值.current = 值;
    滚到序号(当前序号);
  }, [值, 当前序号, 滚到序号]);

  useEffect(() => () => window.clearTimeout(防抖计时.current), []);

  const 处理滚动 = useCallback(() => {
    window.clearTimeout(防抖计时.current);
    防抖计时.current = window.setTimeout(() => {
      const 节点 = 滚轮引用.current;
      if (!节点 || 选项.length === 0) return;
      const 序号 = 夹序号(Math.round(节点.scrollTop / 行高), 选项.length);
      if (待忽略程序序号.current === 序号) {
        待忽略程序序号.current = null;
        return;
      }
      待忽略程序序号.current = null;
      已定位序号.current = 序号;
      const 下一值 = 选项[序号];
      自报值.current = 下一值;
      if (下一值 !== 值) 设值(下一值);
    }, 90);
  }, [值, 设值, 行高, 选项]);

  const 处理按键: KeyboardEventHandler<HTMLDivElement> = useCallback((事件) => {
    if (选项.length === 0) return;
    // 值不在档表内时两个方向的第一按都要夹回首档：基准取 -1，ArrowDown 落 0、
    // ArrowUp 落 -1 再被夹到 0（取 0 会让 ArrowDown 跳到第二档，两个方向不一致）
    const 基准 = 当前序号 < 0 ? -1 : 当前序号;
    const 目标 = 事件.key === 'ArrowUp' ? 基准 - 1
      : 事件.key === 'ArrowDown' ? 基准 + 1
        : 事件.key === 'Home' ? 0
          : 事件.key === 'End' ? 选项.length - 1
            : null;
    if (目标 === null) return;
    事件.preventDefault();
    选择序号(目标, false);
  }, [当前序号, 选择序号, 选项.length]);

  const 取选项属性 = useCallback((序号: number): 滚轮选项属性 => ({
    id: 选项编号(序号),
    onClick: () => 选择序号(序号, true),
  }), [选择序号, 选项编号]);

  return {
    滚轮引用,
    活动项编号: 当前序号 >= 0 ? 选项编号(当前序号) : undefined,
    处理滚动,
    处理按键,
    取选项属性,
  };
}
