// 屏蔽名单 —— 「我的 › 常用功能 › 屏蔽名单」。
//
// 屏蔽是双向的（业务约束 6）：加进来之后你看不到它的岗位，它也搜不到你的任何画像。
// 当前雇主及其关联公司在建档时自动进名单，可解除但会给一次明确警示。
//
// P3 Task 4：Backend 模式改为「选来源 → 搜组织 → 点结果 → 屏蔽」—— 输入框只作搜索文本，
// 自由文本本身永远不构成屏蔽，发给服务端的是搜索命中的稳定组织 ID；
// organization_unavailable 时弃选中、按同词重查。Mock 模式保持原本地 free-text 路径不变。

import { useEffect, useState } from 'react';
import 样式 from './我的功能页.module.css';
import { 次级页外壳, 返回栏, 滚动区 } from '../组件/通用';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import type { 屏蔽项, 屏蔽来源 } from '../数据/类型';
import { BFF错误 } from '../数据/HTTP客户端';
import 弹层框架 from '../组件/弹层框架';
import { use组织查询 } from './组织查询钩子';

const 全部来源: 屏蔽来源[] = ['当前雇主', '关联公司', '手动添加'];

export default function 屏蔽名单() {
  const { 返回 } = use导航();
  const { 状态, 派发, 操作, 数据源模式, 后端状态 } = use应用状态();
  const 是后端 = 数据源模式 === 'backend';
  // Backend 隐私未水合（隐私快照 null）：只留页面外壳与说明；不出现数字计数 / 空态断言 /
  // Mock 行，控件全部禁用，绝不发请求 —— Mock 数据不得冒充服务端视图。
  const 未水合 = 是后端 && 后端状态.隐私快照 === null;

  const [草稿, 设草稿] = useState('');
  const [待解除, 设待解除] = useState<屏蔽项 | null>(null);
  const [提示, 设提示] = useState<string | null>(null);

  // Backend 才挂搜索方法；Mock 不传 —— 组织查询钩子全体方法退化为空操作，绝不搜索
  const 查询 = use组织查询(是后端 ? 操作?.搜索可屏蔽组织 : undefined);

  useEffect(() => {
    if (!提示) return;
    const 定时 = window.setTimeout(() => 设提示(null), 1600);
    return () => window.clearTimeout(定时);
  }, [提示]);

  const 列表 = 未水合 ? [] : 状态.屏蔽名单;
  // 按 来源 归组（P3）：理由 只是展示文案，不再用它判断归属
  const 自动项 = 列表.filter((条) => 条.来源 !== '手动添加');
  const 手动项 = 列表.filter((条) => 条.来源 === '手动添加');

  const 名称 = 草稿.trim();
  const 可加 = 名称 !== '';

  const 加入 = () => {
    if (!可加) return;
    if (列表.some((条) => 条.名称 === 名称)) {
      设提示(`${名称} 已在名单里`);
      设草稿('');
      return;
    }
    派发({ 型: '拉黑', 名称 });
    设提示(`已屏蔽 ${名称}，双向不可见`);
    设草稿('');
  };

  /** Backend：屏蔽当前选中的搜索命中项（稳定组织 ID + 所选来源），成功后才清词保留来源 */
  const 执行屏蔽 = async () => {
    if (!是后端 || 未水合 || 查询.来源 === null || 查询.选择 === null) return;
    const 选中项 = 查询.选择;
    try {
      await 操作.添加组织屏蔽(选中项.organization_id, 查询.来源);
    } catch (错误) {
      // 所选组织已不存在：弃掉本次选中并按同词重查，输入框里的可见文字保持不动，
      // 让用户另选命中项；其余失败不派发任何本地假成功
      if (错误 instanceof BFF错误 && 错误.code === 'organization_unavailable') 查询.重新查询();
      return;
    }
    查询.设词('');
    设提示(`已屏蔽 ${选中项.display_name}，双向不可见`);
  };

  const 确认解除 = async () => {
    if (!待解除) return;
    if (是后端) {
      try {
        // 传完整条目：操作层按 条目.来源 推导是否需要风险确认
        await 操作.解除组织屏蔽(待解除);
      } catch {
        设待解除(null);
        return; // 服务端失败：权威视图不变，不派发本地假成功
      }
    } else {
      派发({ 型: '解除屏蔽', 编号: 待解除.编号 });
    }
    设提示(`已解除对 ${待解除.名称} 的屏蔽`);
    设待解除(null);
  };

  const 副标题 = 未水合 ? '双向不可见' : `${列表.length} 家 · 双向不可见`;

  return (
    <次级页外壳>
      <返回栏 返回={返回} 标题="屏蔽名单" 副标题={副标题} />

      <滚动区 样式覆盖={{ padding: '14px 18px 24px' }}>
        <div className={样式.说明条}>
          屏蔽是<span className={样式.说明强调}>双向</span>
          的：你看不到这些公司的岗位，它们也搜不到、匹配不到你的任何画像，包括匿名画像。
        </div>

        {是后端 ? (
          <>
            {/* 先选屏蔽来源，再搜组织、点结果 */}
            <div className={样式.分段}>
              {全部来源.map((源) => (
                <button
                  key={源}
                  className={`${样式.分段项} ${查询.来源 === 源 ? 样式.分段项选中 : ''} ${
                    未水合 ? 样式.分段项禁用 : '可点'
                  }`}
                  onClick={() => 查询.设来源(源)}
                  disabled={未水合}
                >
                  {源}
                </button>
              ))}
            </div>
            <div className={样式.添加行}>
              <input
                className={样式.添加框}
                value={查询.词}
                onChange={(事件) => 查询.设词(事件.target.value)}
                placeholder="输入公司全称，如「某某科技」"
                disabled={未水合 || 查询.来源 === null}
              />
              <button
                className={`${样式.添加键} ${查询.选择 ? '可点' : 样式.添加键禁用}`}
                onClick={() => void 执行屏蔽()}
                disabled={未水合 || 查询.选择 === null}
              >
                屏蔽
              </button>
            </div>
            {/* 搜索命中：整行可点即选中（词回显为该组织名，备选保持可见供换选） */}
            {查询.结果.length > 0 ? (
              <div className={样式.卡}>
                {查询.结果.map((项) => (
                  <button
                    key={项.organization_id}
                    className={`${样式.行} 可点`}
                    onClick={() => 查询.选中(项)}
                  >
                    <span className={样式.字标}>{项.display_name.charAt(0)}</span>
                    <span className={样式.行文字组}>
                      <span className={样式.行标题}>{项.display_name}</span>
                      <span className={样式.行说明}>{项.legal_name}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            {查询.下一页游标 !== null ? (
              <button
                className="可点"
                onClick={() => void 查询.加载更多()}
                disabled={查询.加载中}
                style={{ width: '100%', padding: '10px', color: 'var(--最弱)' }}
              >
                {查询.加载中 ? '加载中…' : '加载更多'}
              </button>
            ) : null}
          </>
        ) : (
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
        )}

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

        {列表.length === 0 && !未水合 ? (
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
              {(待解除.来源 === '当前雇主' || 待解除.来源 === '关联公司')
                ? '这是你的当前雇主或其关联公司，解除意味着放弃这层保密。'
                : ''}
            </div>
            <div className={样式.确认键行}>
              <button className={`${样式.确认取消} 可点`} onClick={() => 设待解除(null)}>
                不解除
              </button>
              <button className={`${样式.确认执行} 可点`} onClick={() => void 确认解除()}>
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
