// 屏蔽名单 —— 「我的 › 常用功能 › 屏蔽名单」。
//
// 屏蔽是双向的（业务约束 6）：加进来之后你看不到它的岗位，它也搜不到你的任何画像。
// 当前雇主及其关联公司在建档时自动进名单，可解除但会给一次明确警示。

import { useEffect, useState } from 'react';
import 样式 from './我的功能页.module.css';
import { 次级页外壳, 返回栏, 滚动区 } from '../组件/通用';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import type { 屏蔽项 } from '../数据/类型';
import 弹层框架 from '../组件/弹层框架';

export default function 屏蔽名单() {
  const { 返回 } = use导航();
  const { 状态, 派发 } = use应用状态();
  const [草稿, 设草稿] = useState('');
  const [待解除, 设待解除] = useState<屏蔽项 | null>(null);
  const [提示, 设提示] = useState<string | null>(null);

  useEffect(() => {
    if (!提示) return;
    const 定时 = window.setTimeout(() => 设提示(null), 1600);
    return () => window.clearTimeout(定时);
  }, [提示]);

  const 名称 = 草稿.trim();
  const 可加 = 名称 !== '';
  const 自动项 = 状态.屏蔽名单.filter((条) => 条.理由.includes('自动屏蔽'));
  const 手动项 = 状态.屏蔽名单.filter((条) => !条.理由.includes('自动屏蔽'));

  const 加入 = () => {
    if (!可加) return;
    if (状态.屏蔽名单.some((条) => 条.名称 === 名称)) {
      设提示(`${名称} 已在名单里`);
      设草稿('');
      return;
    }
    派发({ 型: '拉黑', 名称 });
    设提示(`已屏蔽 ${名称}，双向不可见`);
    设草稿('');
  };

  const 确认解除 = () => {
    if (!待解除) return;
    派发({ 型: '解除屏蔽', 编号: 待解除.编号 });
    设提示(`已解除对 ${待解除.名称} 的屏蔽`);
    设待解除(null);
  };

  return (
    <次级页外壳>
      <返回栏 返回={返回} 标题="屏蔽名单" 副标题={`${状态.屏蔽名单.length} 家 · 双向不可见`} />

      <滚动区 样式覆盖={{ padding: '14px 18px 24px' }}>
        <div className={样式.说明条}>
          屏蔽是<span className={样式.说明强调}>双向</span>
          的：你看不到这些公司的岗位，它们也搜不到、匹配不到你的任何画像，包括匿名画像。
        </div>

        <div className={样式.添加行}>
          <input
            className={样式.添加框}
            value={草稿}
            onChange={(事件) => 设草稿(事件.target.value)}
            onKeyDown={(事件) => {
              // 中文输入法确认候选词也会触发 Enter，isComposing 挡掉这次误提交
              if (事件.key === 'Enter' && !事件.nativeEvent.isComposing) 加入();
            }}
            placeholder="输入公司全称，如「某某科技」"
          />
          <button
            className={`${样式.添加键} ${可加 ? '可点' : 样式.添加键禁用}`}
            onClick={加入}
            disabled={!可加}
          >
            屏蔽
          </button>
        </div>

        {自动项.length > 0 ? (
          <>
            <div className={样式.组标}>建档时自动屏蔽</div>
            <div className={样式.卡}>
              {自动项.map((条) => (
                <屏蔽行 key={条.编号} 条={条} 解除={() => 设待解除(条)} />
              ))}
            </div>
          </>
        ) : null}

        {手动项.length > 0 ? (
          <>
            <div className={`${样式.组标} ${样式.组标间距}`}>你手动添加</div>
            <div className={样式.卡}>
              {手动项.map((条) => (
                <屏蔽行 key={条.编号} 条={条} 解除={() => 设待解除(条)} />
              ))}
            </div>
          </>
        ) : null}

        {状态.屏蔽名单.length === 0 ? (
          <div className={样式.空态}>
            <div className={样式.空态图}>🛡</div>
            <div className={样式.空态标题}>名单是空的</div>
            <div className={样式.空态说明}>
              没有屏蔽任何公司时，你的匿名画像对全部在招企业可见。
            </div>
          </div>
        ) : null}
      </滚动区>

      {待解除 ? (
        <弹层框架 标签={`解除屏蔽${待解除.名称}`} 遮罩类名={样式.遮罩} 面板类名={样式.确认框} 关闭={() => 设待解除(null)}>
            <div className={样式.确认标题}>解除对「{待解除.名称}」的屏蔽？</div>
            <div className={样式.确认正文}>
              解除后这家公司可以看到你的匿名画像，也可能主动发起接触。
              {待解除.理由.includes('自动屏蔽')
                ? '这是你的当前雇主或其关联公司，解除意味着放弃这层保密。'
                : ''}
            </div>
            <div className={样式.确认键行}>
              <button className={`${样式.确认取消} 可点`} onClick={() => 设待解除(null)}>
                不解除
              </button>
              <button className={`${样式.确认执行} 可点`} onClick={确认解除}>
                确认解除
              </button>
            </div>
        </弹层框架>
      ) : null}

      {提示 ? <div className={样式.浮层提示}>{提示}</div> : null}
    </次级页外壳>
  );
}

function 屏蔽行({ 条, 解除 }: { 条: 屏蔽项; 解除: () => void }) {
  return (
    <div className={样式.行}>
      <span className={样式.字标}>{条.首字}</span>
      <span className={样式.行文字组}>
        <span className={样式.行标题}>{条.名称}</span>
        <span className={样式.行说明}>
          {条.理由} · {条.时间}
        </span>
      </span>
      <button className={`${样式.次要键} 可点`} onClick={解除}>
        解除
      </button>
    </div>
  );
}
