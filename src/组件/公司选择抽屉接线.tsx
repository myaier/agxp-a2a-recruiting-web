// 公司选择抽屉接线（合同 B 消费样板）：use组织查询 的搜索/结果/翻页/创建态共 12 个
// props 在每个消费页逐字相同（Task 3 起已有 3 处，Task 4–6 还会再加 4–5 个），提取成
// 这一个薄包装；页间差异只有 选定/关闭/添加 三个回调与当前选中键 —— 回填、清材料、
// 写 URL 都是页面语义，仍由页面自带。不建配置表、不做万能 renderer。
import { 公司选择层 } from './公司选择层';
import type { use组织查询 } from '../屏幕/组织查询钩子';

type 组织查询 = ReturnType<typeof use组织查询>;

export default function 公司选择抽屉接线({
  查询,
  选中键,
  选定,
  关闭,
  添加,
}: {
  /** 页面自己的 use组织查询 实例 */
  查询: 组织查询;
  /** 当前选中行的键（organization_id）；null = 本实例无选中，抽屉不标 ✓ */
  选中键: string | null;
  选定: (键: string) => void;
  关闭: () => void;
  添加: (名称: string) => void;
}) {
  return (
    <公司选择层
      搜索词={查询.词}
      修改搜索词={查询.设词}
      项们={查询.结果.map((项) => ({
        键: 项.organization_id,
        名称: 项.display_name,
        正式名: 项.legal_name,
        已认证: 项.verification_status === 'verified',
        选中: 项.organization_id === 选中键,
      }))}
      搜索中={查询.搜索中}
      搜索错误={查询.搜索错误}
      重试搜索={查询.重新查询}
      还有={查询.下一页游标 !== null}
      加载中={查询.加载中}
      加载错误={查询.加载错误}
      加载更多={() => void 查询.加载更多()}
      选定={选定}
      关闭={关闭}
      创建中={查询.创建中}
      创建错误={查询.创建错误}
      添加={添加}
    />
  );
}