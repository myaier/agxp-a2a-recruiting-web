// R9 招聘名片 · 招聘方注册第二步（名片 → 发岗）。
//
// 业务口径（2026-08-18 用户定，见 数据/类型.ts 顶部的完整说明）：匿名是单向的 ——
// 这张名片从第一轮起就对候选人可见，候选人对你则是代号，确认意向后才露真名。
//
// 交互（标注 2026-08-20 14:34 / 14:35）：姓名 / 职务 / 公司三行改成**点击就地编辑** ——
// 点哪一行，那一行的值当场变成输入框并自动聚焦，失焦或回车即保存。
// 原来那套底部升起的编辑抽屉（遮罩 + 抽屉 + 草稿 + 确定按钮）整套删掉：
// 三个字段都是一行短文本，为改一个词升起半屏抽屉是多余的一层。

import { useRef, useState } from 'react';
import 样式 from './招聘名片.module.css';
import {
  次级页外壳,
  返回栏,
  页面大标题,
  滚动区,
  表单条目,
  主按钮,
  公司字标,
} from '../组件/通用';
import { 轻提示 } from '../组件/轻提示';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 相机图标 } from '../组件/图标';
import { 路径 } from '../路由/路径表';

/** 姓名与公司来自认证结果，只允许编辑不会破坏认证关系的职务。 */
type 表单键 = '姓名' | '职务' | '公司';

const 表单字段表: { 键: 表单键; 标签: string; 已认证?: boolean }[] = [
  { 键: '姓名', 标签: '姓名', 已认证: true },
  { 键: '职务', 标签: '职务' },
  { 键: '公司', 标签: '公司', 已认证: true },
];


/** 把用户选的照片压成 256×256 居中裁切的 JPEG dataURL —— 原图可能好几 MB，
 *  localStorage 装不下也没必要装 */
function 压成头像(文件: File): Promise<string> {
  return new Promise((成, 败) => {
    const 读 = new FileReader();
    读.onerror = () => 败(new Error('读取失败'));
    读.onload = () => {
      const 图 = new Image();
      图.onerror = () => 败(new Error('不是可用的图片'));
      图.onload = () => {
        const 边 = 256;
        const 画布 = document.createElement('canvas');
        画布.width = 边;
        画布.height = 边;
        const 笔 = 画布.getContext('2d')!;
        // 居中裁成正方形再缩放（cover）
        const 源边 = Math.min(图.width, 图.height);
        笔.drawImage(图, (图.width - 源边) / 2, (图.height - 源边) / 2, 源边, 源边, 0, 0, 边, 边);
        成(画布.toDataURL('image/jpeg', 0.85));
      };
      图.src = String(读.result);
    };
    读.readAsDataURL(文件);
  });
}

export default function 招聘名片() {
  const { 跳转, 返回 } = use导航();
  // 姓名与公司来自全局（企业认证切片），职务为设计稿 R9 预填值
  const { 状态, 派发 } = use应用状态();
  const 文件框 = useRef<HTMLInputElement>(null);

  async function 选了照片(事件: React.ChangeEvent<HTMLInputElement>) {
    const 文件 = 事件.target.files?.[0];
    事件.target.value = ''; // 允许再次选同一张
    if (!文件) return;
    try {
      派发({ 型: '存招聘头像', 图: await 压成头像(文件) });
      轻提示('头像已更新');
    } catch {
      轻提示('这张图片读不出来，换一张试试');
    }
  }
  const [表单值, 设表单值] = useState<Record<表单键, string>>(() => ({
    姓名: 状态.企业认证.姓名,
    职务: 状态.企业认证.职务 ?? '技术 VP',
    公司: 状态.企业认证.公司,
  }));
  // 正在就地编辑哪一行（null = 三行都在展示态）
  const [编辑中, 设编辑中] = useState<表单键 | null>(null);

  /** 收笔：失焦或回车都走这里。空白视作没改 ——
   *  不允许把字段清空成空串，否则这一行会塌成没有值的空条目 */
  function 收笔(键: 表单键, 输入值: string) {
    const 新值 = 输入值.trim();
    if (新值) 设表单值((旧) => ({ ...旧, [键]: 新值 }));
    设编辑中(null);
  }

  return (
    <次级页外壳>
      <返回栏 返回={返回} />

      {/* 标注 22:48：说明小字删掉，只留标题 */}
      <页面大标题 标题="招聘名片" />

      <滚动区 样式覆盖={{ padding: '6px 22px 0' }}>
        {/* ── 名片预览：候选人从第一轮起看到的就是这一行（不对称双盲的实名侧）── */}
        <div className={样式.预览行}>
          {/* 头像可传真人照片（标注 22:27）：候选人第一轮就看到这张脸。没传用姓氏字标兜底 */}
          <button
            className={`${样式.头像键} 可点`}
            onClick={() => 文件框.current?.click()}
            aria-label="上传头像"
          >
            {状态.招聘头像 ? (
              <img className={样式.头像图} src={状态.招聘头像} alt="" />
            ) : (
              <公司字标
                首字={表单值.姓名.charAt(0)}
                尺寸={52}
                圆角={999}
                底色="var(--墨)"
                字色="var(--荧光绿)"
                描边={false}
                字号={21}
              />
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
            onChange={选了照片}
          />
          <span className={样式.预览文字}>
            <span className={`${样式.预览姓名} 单行`}>{表单值.姓名}</span>
            <span className={`${样式.预览副行} 单行`}>
              {表单值.职务} · {表单值.公司}
            </span>
          </span>
        </div>

        {/* ── 姓名 / 职务 / 公司：点行即就地变输入框 ── */}
        {表单字段表.map((字段) => (
          <就地编辑条目
            key={字段.键}
            标签={字段.标签}
            值={表单值[字段.键]}
            编辑态={编辑中 === 字段.键}
            已认证={字段.已认证}
            开始编辑={() => 设编辑中(字段.键)}
            收笔={(输入值) => 收笔(字段.键, 输入值)}
          />
        ))}

        {/* ── 公司主页资料：名片是「这个人」，公司主页是「这家公司」，
               候选人两处都会看，编辑入口挨着放 ── */}
        <表单条目
          标签="公司主页资料"
          值="LOGO · 简介 · 规模 · 办公地"
          按下={() => 跳转(路径.公司档案编辑)}
        />

      </滚动区>

      <主按钮
        文字="保存 · 去发岗位"
        按下={() => {
          // 姓名与公司沿用认证结果，名片只补充职务与头像。
          派发({ 型: '存企业认证', 姓名: 表单值.姓名, 公司: 表单值.公司, 职务: 表单值.职务 });
          跳转(路径.发布岗位);
        }}
      />
    </次级页外壳>
  );
}

/** 一条就地编辑行：版式与通用 表单条目 一比一（12px 标签 + 15.5/600 值 + 分隔线），
 *  差别只在展示态右侧是尖括号、编辑态整行换成同位置同字号的输入框，
 *  所以点下去时值不跳位，视觉上就是「这一行可以写字了」。 */
function 就地编辑条目({
  标签,
  值,
  编辑态,
  已认证 = false,
  开始编辑,
  收笔,
}: {
  标签: string;
  值: string;
  编辑态: boolean;
  已认证?: boolean;
  开始编辑: () => void;
  收笔: (输入值: string) => void;
}) {
  if (已认证) {
    return (
      <div className={样式.就地条目}>
        <div className={样式.就地标签}>{标签}</div>
        <div className={样式.就地值行}>
          <span className={`${样式.就地值} 单行`}>{值}</span>
          <span className={样式.认证标}>已认证</span>
        </div>
      </div>
    );
  }
  if (编辑态) {
    return (
      <div className={样式.就地条目}>
        <div className={样式.就地标签}>{标签}</div>
        <input
          className={样式.就地输入}
          defaultValue={值}
          autoFocus
          aria-label={标签}
          enterKeyHint="done"
          onFocus={(事件) => 事件.currentTarget.select()}
          onBlur={(事件) => 收笔(事件.currentTarget.value)}
          onKeyDown={(事件) => {
            // isComposing 挡住中文输入法「回车上屏候选词」那一下被误当收笔；
            // blur() 让收笔只走 onBlur 一条路径，避免回车与失焦各提交一次
            if (事件.key === 'Enter' && !事件.nativeEvent.isComposing) {
              事件.currentTarget.blur();
            }
          }}
        />
      </div>
    );
  }
  return (
    <button className={`${样式.就地条目} 可点`} onClick={开始编辑}>
      <span className={样式.就地标签}>{标签}</span>
      <span className={样式.就地值行}>
        <span className={`${样式.就地值} 单行`}>{值}</span>
        <span className={样式.就地尖括号}>›</span>
      </span>
    </button>
  );
}
