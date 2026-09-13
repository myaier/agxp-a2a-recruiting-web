// 屏蔽名单 —— 「我的 › 常用功能 › 屏蔽名单」。
//
// 屏蔽是双向的（业务约束 6）：加进来之后你看不到它的岗位，它也搜不到你的任何画像。
// 当前雇主及其关联公司在建档时自动进名单，可解除但会给一次明确警示。
//
// 2026-09-13 合同 A/B（Task 5）：Backend 模式改为「选来源 → 开抽屉搜/选组织 → 屏蔽」——
// 搜索与创建走 公司选择抽屉接线（合同 B，操作.搜索组织 / 操作.创建组织），
// 发给服务端的是选中的稳定组织 ID，自由文本本身永远不构成屏蔽。
// 来源 与 待选企业 是页面本地 state 且互相独立：两者都有值才启用「屏蔽」，
// 改来源不清理待选，取消抽屉保留原值；写入成功后权威隐私由操作层合并提交，chip 随权威名单展示。
// organization_unavailable 时弃掉本次待选。Mock 模式保持原本地 free-text 路径不变。

import { useEffect, useRef, useState } from 'react';
import 样式 from './我的功能页.module.css';
import { 次级页外壳, 返回栏, 滚动区 } from '../组件/通用';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import type { BFF组织搜索项 } from '../数据/BFF契约';
import type { 屏蔽项, 屏蔽来源 } from '../数据/类型';
import { BFF错误, 取后端错误文案 } from '../数据/HTTP客户端';
import { 轻提示 } from '../组件/轻提示';
import 弹层框架 from '../组件/弹层框架';
import { use组织查询 } from './组织查询钩子';
import 公司选择抽屉接线 from '../组件/公司选择抽屉接线';

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
  // 合同 B：来源 与 待选企业 都是页面本地 state，互相独立；两者都有值才启用「屏蔽」
  const [来源, 设来源] = useState<屏蔽来源 | null>(null);
  const [待选, 设待选] = useState<BFF组织搜索项 | null>(null);
  const [抽屉开, 设抽屉开] = useState(false);

  // 合同 B：Backend 才挂目录搜索/创建（合同 A 组织操作）；Mock 不传 —— 钩子全体方法退化为空操作
  const 查询 = use组织查询({
    搜索: 是后端 ? 操作?.搜索组织 : undefined,
    创建: 是后端 ? 操作?.创建组织 : undefined,
    作用域键: JSON.stringify([数据源模式, 后端状态?.主体?.subject_id ?? null, '屏蔽名单']),
  });

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

  /** Backend：屏蔽当前选中的待选企业（稳定组织 ID + 页面所选来源）。
   *  在途时「屏蔽」禁用挡下重入 —— 操作层对相同在途键的重复提交会被背刺防护吞掉，
   *  不能把未执行的调用当成功：只有真实请求结算后才清待选/显示成功。
   *  成功后权威隐私已由操作层合并提交 —— 清掉待选、保留来源，chip 随权威名单展示。 */
  const [屏蔽中, 设屏蔽中] = useState(false);
  const 屏蔽锁 = useRef(false);
  const 执行屏蔽 = async () => {
    if (!是后端 || 未水合 || 来源 === null || 待选 === null || 屏蔽锁.current) return;
    const 选中项 = 待选;
    const 所选来源 = 来源;
    屏蔽锁.current = true;
    设屏蔽中(true);
    try {
      await 操作.添加组织屏蔽(选中项.organization_id, 所选来源);
    } catch (错误) {
      // 所选组织已不存在：弃掉本次待选，让用户重开抽屉另选；其余失败不派发任何
      // 本地假成功，只复用现有轻提示报错，待选保留供直接重试
      if (错误 instanceof BFF错误 && 错误.code === 'organization_unavailable') 设待选(null);
      else 轻提示(取后端错误文案(错误));
      return;
    } finally {
      屏蔽锁.current = false;
      设屏蔽中(false);
    }
    查询.设词('');
    设待选(null);
    设提示(`已屏蔽 ${选中项.display_name}，双向不可见`);
  };

  /** 抽屉选定回填：真实 ID 与显示名一起落，关抽屉先 作废（合同 B：父页面关闭时先作废再隐藏） */
  const 回填待选 = (项: BFF组织搜索项) => {
    设待选(项);
    查询.作废();
    设抽屉开(false);
  };
  const 选定企业键 = (键: string) => {
    // 选中 ID 只来自父页面：在本实例结果里定位完整项，同名不同 ID 不混淆
    const 项 = 查询.结果.find((候选) => 候选.organization_id === 键);
    if (项) 回填待选(项);
  };
  const 添加企业 = async (名称: string) => {
    const 项 = await 查询.添加(名称);
    if (项) 回填待选(项);
  };
  const 关闭抽屉 = () => {
    // 取消 / Escape / 遮罩：待选与来源都不变，作废在飞请求后隐藏，原值保留
    查询.作废();
    设抽屉开(false);
  };

  const 确认解除 = async () => {
    if (!待解除) return;
    if (是后端) {
      try {
        // 传完整条目：操作层按 条目.来源 推导是否需要风险确认
        await 操作.解除组织屏蔽(待解除);
      } catch (错误) {
        设待解除(null);
        // 服务端失败：权威视图不变，不派发本地假成功；复用现有轻提示，失败不再静默
        轻提示(取后端错误文案(错误));
        return;
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
            {/* 先选屏蔽来源；来源与待选企业互相独立，两者都有值才启用「屏蔽」 */}
            <div className={样式.分段}>
              {全部来源.map((源) => (
                <button
                  key={源}
                  className={`${样式.分段项} ${来源 === 源 ? 样式.分段项选中 : ''} ${
                    未水合 ? 样式.分段项禁用 : '可点'
                  }`}
                  onClick={() => 设来源(源)}
                  disabled={未水合}
                >
                  {源}
                </button>
              ))}
            </div>
            <div className={样式.添加行}>
              {/* 公司搜索/选择在合同 B 抽屉里进行：入口回显当前待选，点开抽屉换选 */}
              <button
                type="button"
                className={样式.添加框}
                style={{ textAlign: 'left' }}
                onClick={() => 设抽屉开(true)}
                disabled={未水合}
              >
                {待选 ? 待选.display_name : '选择要屏蔽的公司'}
              </button>
              <button
                className={`${样式.添加键} ${来源 !== null && 待选 ? '可点' : 样式.添加键禁用}`}
                onClick={() => void 执行屏蔽()}
                disabled={未水合 || 来源 === null || 待选 === null || 屏蔽中}
              >
                屏蔽
              </button>
            </div>
            {/* 合同 B：公司选择抽屉（合同 B 薄包装）；关闭已先 作废 在飞搜索/创建 */}
            {抽屉开 ? (
              <公司选择抽屉接线
                查询={查询}
                选中键={待选?.organization_id ?? null}
                选定={选定企业键}
                关闭={关闭抽屉}
                添加={(名称) => void 添加企业(名称)}
              />
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
        <弹层框架 标签={`解除屏蔽${待解除.名称}`} 遮罩类名={样式.遮罩} 面板类名={样式.确认框} 位置="居中" 关闭={() => 设待解除(null)}>
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
