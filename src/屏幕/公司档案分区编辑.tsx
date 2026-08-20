// 公司主页资料 · 单个分区的编辑页（/hr/company-profile/:area）
//
// 标注 2026-08-20 15:40：用户要求「点击编辑的时候不要把输入框做到下面……可以跳到一个
// 新的页面让用户去输入」。所以每个分区都是一整屏：返回栏（左 ‹ + 右上「保存」）+
// 大标题（分区名）+ 全屏编辑区。公司介绍这类长文用整屏 textarea，字数计在右下角。
//
// 与清单页的分工：清单页只读、只显示计数与摘要；本页读同一份 读资料() 起草稿，
// 保存时 合成覆盖() 写回全局 + localStorage，然后返回清单页。
// 直接返回（不点保存）就是丢弃改动 —— 草稿只活在本页的 useState 里。

import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import 样式 from './公司档案分区编辑.module.css';
import { 次级页外壳, 返回栏, 滚动区, 页面大标题 } from '../组件/通用';
import { 轻提示 } from '../组件/轻提示';
import { 相机图标 } from '../组件/图标';
import { use导航 } from '../路由/导航钩子';
import { 取公司档案 } from '../数据/公司档案';
import type { 团队成员项 } from '../数据/类型';
import {
  按段取分区,
  本公司键,
  合成覆盖,
  作息池,
  规模池,
  融资阶段池,
  行业池,
  相册每组上限,
  福利标签池,
  读资料,
  type 资料形,
} from '../数据/公司主页资料';
import { use应用状态 } from '../状态/应用状态';

/** 把用户选的图片压成 128×128 居中裁切的 JPEG dataURL —— 实现镜像 招聘名片 的
 *  压成头像，只是边长换成 LOGO 用的 128（约 6-12KB，localStorage 装得下） */
function 压成LOGO(文件: File): Promise<string> {
  return 压图(文件, (图, 画布) => {
    const 边 = 128;
    画布.width = 边;
    画布.height = 边;
    const 笔 = 画布.getContext('2d')!;
    const 源边 = Math.min(图.width, 图.height);
    笔.drawImage(图, (图.width - 源边) / 2, (图.height - 源边) / 2, 源边, 源边, 0, 0, 边, 边);
  });
}

/** 相册图压到长边 480（约 30-60KB/张）—— 两组各最多 3 张，写得进 localStorage */
function 压成相册图(文件: File): Promise<string> {
  return 压图(文件, (图, 画布) => {
    const 长边 = 480;
    const 比 = Math.min(1, 长边 / Math.max(图.width, 图.height));
    画布.width = Math.round(图.width * 比);
    画布.height = Math.round(图.height * 比);
    画布.getContext('2d')!.drawImage(图, 0, 0, 画布.width, 画布.height);
  });
}

/** 读文件 → 解码 → 交给调用方往画布上画 → 导出 JPEG dataURL */
function 压图(
  文件: File,
  画: (图: HTMLImageElement, 画布: HTMLCanvasElement) => void
): Promise<string> {
  return new Promise((成, 败) => {
    const 读 = new FileReader();
    读.onerror = () => 败(new Error('读取失败'));
    读.onload = () => {
      const 图 = new Image();
      图.onerror = () => 败(new Error('不是可用的图片'));
      图.onload = () => {
        const 画布 = document.createElement('canvas');
        画(图, 画布);
        成(画布.toDataURL('image/jpeg', 0.82));
      };
      图.src = String(读.result);
    };
    读.readAsDataURL(文件);
  });
}

export default function 公司档案分区编辑() {
  const { area: 段 } = useParams<{ area: string }>();
  const { 返回 } = use导航();
  const { 状态, 派发 } = use应用状态();
  const 静态档 = 取公司档案(本公司键);
  const 覆盖 = 状态.公司自述;
  const 分区 = 按段取分区(段);

  // 草稿：进页时从全局读一份，改完点保存才写回去
  const [资料, 设资料] = useState<资料形>(() => 读资料(静态档, 覆盖));

  // 地址栏被手改成不存在的分区时不白屏，退回清单
  if (!分区) {
    return (
      <次级页外壳>
        <返回栏 返回={返回} />
        <页面大标题 标题="公司主页资料" />
      </次级页外壳>
    );
  }

  function 改(补丁: Partial<资料形>) {
    设资料((旧) => ({ ...旧, ...补丁 }));
  }

  function 保存() {
    派发({ 型: '存公司自述', 值: 合成覆盖(资料, 静态档, 覆盖) });
    轻提示('已保存');
    返回();
  }

  return (
    <次级页外壳>
      <返回栏
        返回={返回}
        右侧={
          <button className={`${样式.保存键} 可点`} onClick={保存}>
            保存
          </button>
        }
      />

      <页面大标题 标题={分区.键} />

      {/* 长文分区：整屏 textarea（字数在右下角）；其余分区：可滚的字段区 */}
      {分区.键 === '公司介绍' ? (
        <整屏文本 值={资料.公司介绍} 上限={500} 标题="公司介绍" 改变={(值) => 改({ 公司介绍: 值 })} />
      ) : null}

      {分区.键 === '主营业务' ? (
        <整屏文本 值={资料.主营业务} 上限={200} 标题="主营业务" 改变={(值) => 改({ 主营业务: 值 })} />
      ) : null}

      {分区.键 === '产品介绍' ? (
        <整屏文本 值={资料.产品介绍} 上限={300} 标题="产品介绍" 改变={(值) => 改({ 产品介绍: 值 })} />
      ) : null}

      {分区.键 === '基本信息' ? (
        <基本信息区
          资料={资料}
          改={改}
          LOGO={状态.公司LOGO}
          存LOGO={(图) => 派发({ 型: '存公司LOGO', 图 })}
        />
      ) : null}

      {分区.键 === '公司福利' ? <公司福利区 资料={资料} 改={改} /> : null}

      {分区.键 === '公司相册' ? <公司相册区 资料={资料} 改={改} /> : null}

      {分区.键 === '团队介绍' ? <团队介绍区 资料={资料} 改={改} /> : null}
    </次级页外壳>
  );
}

/** 整屏文本：输入框占满剩余高度，字数压在右下角 —— 长文写得开，不再挤在半屏抽屉里 */
function 整屏文本({
  值,
  上限,
  标题,
  改变,
}: {
  值: string;
  上限: number;
  标题: string;
  改变: (值: string) => void;
}) {
  return (
    <div className={样式.整屏区}>
      <div className={样式.整屏框}>
        <textarea
          className={样式.整屏输入}
          value={值}
          maxLength={上限}
          aria-label={标题}
          autoFocus
          onChange={(事件) => 改变(事件.target.value)}
        />
        <div className={`${样式.整屏字数} 等宽数字`}>
          {值.length} / {上限}
        </div>
      </div>
    </div>
  );
}

/** 基本信息：公司全称 · 公司 LOGO · 行业 · 规模 · 融资阶段 · 办公地址（截图里的 6 项）*/
function 基本信息区({
  资料,
  改,
  LOGO,
  存LOGO,
}: {
  资料: 资料形;
  改: (补丁: Partial<资料形>) => void;
  LOGO: string | null;
  存LOGO: (图: string) => void;
}) {
  const LOGO框 = useRef<HTMLInputElement>(null);

  async function 选了LOGO(事件: React.ChangeEvent<HTMLInputElement>) {
    const 文件 = 事件.target.files?.[0];
    事件.target.value = ''; // 允许再次选同一张
    if (!文件) return;
    try {
      存LOGO(await 压成LOGO(文件));
      轻提示('LOGO 已更新');
    } catch {
      轻提示('这张图片读不出来，换一张试试');
    }
  }

  return (
    <字段区>
      <div className={样式.字段}>
        <div className={样式.字段标签}>公司全称</div>
        <input
          className={样式.单行输入}
          value={资料.公司全称}
          maxLength={40}
          aria-label="公司全称"
          onChange={(事件) => 改({ 公司全称: 事件.target.value })}
        />
      </div>

      <div className={样式.字段}>
        <div className={样式.字段标签}>公司 LOGO</div>
        <button
          className={`${样式.LOGO键} 可点`}
          onClick={() => LOGO框.current?.click()}
          aria-label="上传公司 LOGO"
        >
          {LOGO ? (
            <img className={样式.LOGO图} src={LOGO} alt="" />
          ) : (
            <span className={样式.LOGO空} />
          )}
          <span className={样式.相机角标}>
            <相机图标 尺寸={11} 色="var(--正文)" />
          </span>
        </button>
        <input
          ref={LOGO框}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={选了LOGO}
        />
      </div>

      <单选片组 标签="行业" 选项={行业池} 当前={资料.行业} 选中={(值) => 改({ 行业: 值 })} />
      <单选片组 标签="规模" 选项={规模池} 当前={资料.规模} 选中={(值) => 改({ 规模: 值 })} />
      <单选片组
        标签="融资阶段"
        选项={融资阶段池}
        当前={资料.融资阶段}
        选中={(值) => 改({ 融资阶段: 值 })}
      />

      <div className={`${样式.字段} ${样式.末条}`}>
        <div className={样式.字段标签}>办公地址</div>
        <textarea
          className={样式.多行输入}
          style={{ height: 66 }}
          value={资料.办公地址}
          maxLength={80}
          aria-label="办公地址"
          onChange={(事件) => 改({ 办公地址: 事件.target.value })}
        />
      </div>
    </字段区>
  );
}

/** 公司福利：福利标签（多选）+ 作息（单选），即清单上的 N/2 */
function 公司福利区({
  资料,
  改,
}: {
  资料: 资料形;
  改: (补丁: Partial<资料形>) => void;
}) {
  return (
    <字段区>
      <div className={样式.字段}>
        <div className={样式.字段标签}>福利标签</div>
        <div className={样式.片行}>
          {福利标签池.map((名) => {
            const 选中 = 资料.福利标签.includes(名);
            return (
              <button
                key={名}
                className={`${样式.片} ${选中 ? 样式.片选中 : ''} 可点`}
                aria-pressed={选中}
                onClick={() =>
                  改({
                    福利标签: 选中
                      ? 资料.福利标签.filter((条) => 条 !== 名)
                      : [...资料.福利标签, 名],
                  })
                }
              >
                {名}
              </button>
            );
          })}
        </div>
      </div>

      <单选片组
        标签="作息"
        选项={作息池}
        当前={资料.作息档}
        选中={(值) => 改({ 作息档: 值 })}
        末条
      />
    </字段区>
  );
}

/** 公司相册：实景照片 / 公司照片 两组（标注 2026-08-20 15:46：公司视频删） */
function 公司相册区({
  资料,
  改,
}: {
  资料: 资料形;
  改: (补丁: Partial<资料形>) => void;
}) {
  return (
    <字段区>
      <图片组
        标签="实景照片"
        图们={资料.实景照片}
        设图们={(新图们) => 改({ 实景照片: 新图们 })}
      />
      <图片组
        标签="公司照片"
        图们={资料.公司照片}
        设图们={(新图们) => 改({ 公司照片: 新图们 })}
        末条
      />

    </字段区>
  );
}

/** 一组图片：已选的缩略图（右上角 ✕ 删）+ 未满时的「＋」格 */
function 图片组({
  标签,
  图们,
  设图们,
  末条 = false,
}: {
  标签: string;
  图们: string[];
  设图们: (新图们: string[]) => void;
  /** 分区最后一行：不画底部分隔线 */
  末条?: boolean;
}) {
  const 选框 = useRef<HTMLInputElement>(null);

  async function 选了图(事件: React.ChangeEvent<HTMLInputElement>) {
    const 文件 = 事件.target.files?.[0];
    事件.target.value = '';
    if (!文件) return;
    try {
      const 图 = await 压成相册图(文件);
      设图们([...图们, 图].slice(0, 相册每组上限));
    } catch {
      轻提示('这张图片读不出来，换一张试试');
    }
  }

  return (
    <div className={`${样式.字段} ${末条 ? 样式.末条 : ''}`}>
      <div className={样式.字段标签}>
        {标签} {图们.length}/{相册每组上限}
      </div>
      <div className={样式.图格行}>
        {图们.map((图, 序) => (
          <span key={`${序}-${图.slice(-24)}`} className={样式.图格}>
            <img className={样式.图格图} src={图} alt="" />
            <button
              className={`${样式.图格删} 可点`}
              aria-label={`删除${标签}第 ${序 + 1} 张`}
              onClick={() => 设图们(图们.filter((_, i) => i !== 序))}
            >
              ✕
            </button>
          </span>
        ))}
        {图们.length < 相册每组上限 ? (
          <button
            className={`${样式.图格加} 可点`}
            aria-label={`添加${标签}`}
            onClick={() => 选框.current?.click()}
          >
            ＋
          </button>
        ) : null}
      </div>
      <input
        ref={选框}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={选了图}
      />
    </div>
  );
}

/** 团队介绍：姓名 + 职务 + 一句话简介，可增可删 */
function 团队介绍区({
  资料,
  改,
}: {
  资料: 资料形;
  改: (补丁: Partial<资料形>) => void;
}) {
  // 一条都没有时先摆一张空卡，进来就能直接写，不用先点「添加」
  const 列表: 团队成员项[] =
    资料.团队介绍.length > 0 ? 资料.团队介绍 : [{ 姓名: '', 职务: '', 简介: '' }];

  function 改一条(序: number, 补丁: Partial<团队成员项>) {
    改({ 团队介绍: 列表.map((位, i) => (i === 序 ? { ...位, ...补丁 } : 位)) });
  }

  return (
    <字段区>
      {列表.map((位, 序) => (
        <div key={序} className={样式.成员块}>
          <div className={样式.成员头}>
            <span className={`${样式.字段标签} 等宽数字`}>成员 {序 + 1}</span>
            <button
              className={`${样式.成员删} 可点`}
              aria-label={`删除成员 ${序 + 1}`}
              onClick={() => 改({ 团队介绍: 列表.filter((_, i) => i !== 序) })}
            >
              ✕
            </button>
          </div>
          <input
            className={样式.单行输入}
            value={位.姓名}
            maxLength={16}
            placeholder="姓名"
            aria-label={`成员 ${序 + 1} 姓名`}
            onChange={(事件) => 改一条(序, { 姓名: 事件.target.value })}
          />
          <input
            className={样式.单行输入}
            value={位.职务}
            maxLength={20}
            placeholder="职务"
            aria-label={`成员 ${序 + 1} 职务`}
            onChange={(事件) => 改一条(序, { 职务: 事件.target.value })}
          />
          <textarea
            className={样式.多行输入}
            style={{ height: 60 }}
            value={位.简介}
            maxLength={60}
            placeholder="一句话简介"
            aria-label={`成员 ${序 + 1} 简介`}
            onChange={(事件) => 改一条(序, { 简介: 事件.target.value })}
          />
        </div>
      ))}

      <button
        className={`${样式.加一条} 可点`}
        onClick={() => 改({ 团队介绍: [...列表, { 姓名: '', 职务: '', 简介: '' }] })}
      >
        ＋ 添加成员
      </button>
    </字段区>
  );
}

/** 字段型分区共用的滚动容器：一张白卡装所有字段 */
function 字段区({ children }: { children: ReactNode }) {
  return (
    <滚动区 样式覆盖={{ padding: '14px 18px calc(24px + var(--安全区下))' }}>
      <div className={样式.卡}>{children}</div>
    </滚动区>
  );
}

/** 一组单选片：标签 + 平铺档位，点一片即选中 */
function 单选片组({
  标签,
  选项,
  当前,
  选中,
  末条 = false,
}: {
  标签: string;
  选项: string[];
  当前: string;
  选中: (值: string) => void;
  末条?: boolean;
}) {
  return (
    <div className={`${样式.字段} ${末条 ? 样式.末条 : ''}`}>
      <div className={样式.字段标签}>{标签}</div>
      <div className={样式.片行}>
        {选项.map((项) => (
          <button
            key={项}
            className={`${样式.片} ${项 === 当前 ? 样式.片选中 : ''} 可点`}
            aria-pressed={项 === 当前}
            onClick={() => 选中(项)}
          >
            {项}
          </button>
        ))}
      </div>
    </div>
  );
}
