// 年份区间层 —— 就读时间段（入学年 / 毕业年）共用的年份区间抽屉
// （bottom-drawer 统一 Task 4，2026-09-15）。
//
// 壳复用 弹层框架（遮罩 + Escape 关闭 + 焦点恢复），滚动手感复用 内嵌双滚轮
// 的 `允许空值` 联合分支（2000–2030 档 + 「请选择」空档），顶栏/层/轮区样式
// 直接借用 薪资区间层.module.css，不另造年份主题。
//
// 与 薪资区间层 的区别：年份可空且抽屉内不做任何落数校验 —— 单侧空、两侧空、
// 倒置都原样输出完整二元组；完整性与起止合法性校验留在父页下一步，不在抽屉
// 里提前替代（Spec §6.2）。临时值自持到卸载，确定才回传，取消/遮罩/Escape 零写入。

import { useState } from 'react';
import 样式 from './薪资区间层.module.css';
import 弹层框架 from './弹层框架';
import 内嵌双滚轮 from './内嵌双滚轮';

/** 年份档位：2000–2030（原 就读时间段 页内滚轮同一份档表） */
const 年档 = Array.from({ length: 31 }, (_, 序) => 2000 + 序);

export type 年份区间层属性 = {
  入学年: number | null;
  毕业年: number | null;
  确认: (入学年: number | null, 毕业年: number | null) => void;
  取消: () => void;
};

export default function 年份区间层({ 入学年, 毕业年, 确认, 取消 }: 年份区间层属性) {
  // 抽屉生命期内的临时值：滚动只改这里，确定才输出；父页迟到回填不改写它
  const [入学年值, 设入学年值] = useState<number | null>(入学年);
  const [毕业年值, 设毕业年值] = useState<number | null>(毕业年);

  return (
    <弹层框架 标签="就读时间段" 遮罩类名={样式.遮罩} 面板类名={样式.层} 关闭={取消} 层级={71}>
      <div className={样式.顶栏}>
        <button type="button" className={`${样式.取消键} 可点`} onClick={取消}>
          取消
        </button>
        <span className={样式.标题}>就读时间段</span>
        <button type="button" className={`${样式.确认键} 可点`} onClick={() => 确认(入学年值, 毕业年值)}>
          确定
        </button>
      </div>

      <div className={样式.轮区}>
        <内嵌双滚轮
          允许空值
          左档={年档}
          右档={年档}
          左值={入学年值}
          右值={毕业年值}
          设左值={设入学年值}
          设右值={设毕业年值}
          左名="入学年"
          右名="毕业年"
          左单位="年"
          右单位="年"
        />
      </div>
    </弹层框架>
  );
}