// A2 工作经历 —— 参考 BOSS直聘 的「列表 + 全屏编辑页」形态重做（2026-08-17 用户反馈）。
//
// 两个视图，同屏切换：
//   · 列表视图：上传解析条 → 每段经历一张卡（公司 / 职位 / 起止时间 / 行业，点击进编辑）
//     → 「＋ 添加工作经历」→ 右上角「保存」进引导问答
//   · 编辑视图：公司名称 / 所属行业（快捷片 + 可输入）/ 职位名称
//     / 在职时间（原生年月选择器 + 「至今」开关）/ 工作内容（大文本）
//     必填齐「完成」才点亮；编辑已有段时底部有红字「删除这段经历」。
//
// 在职时间用 <input type="month">：iOS 弹原生年月滚轮，桌面有日历下拉，
// 不再是能输任意字符的自由文本 —— 这是上一版最大的 bug。

import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import 样式 from './工作经历.module.css';
import 年月滚轮层 from '../组件/年月滚轮层';
import { 次级页外壳, 返回栏, 页面大标题, 滚动区, 开关 } from '../组件/通用';
import { 轻提示 } from '../组件/轻提示';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';

/** 一段工作经历。开始/结束用 input[type=month] 的 yyyy-MM 格式；结束 null = 至今 */
interface 经历段 {
  编号: string;
  公司: string;
  行业: string;
  职位: string;
  开始: string;
  结束: string | null;
  内容: string;
  /** 对这家公司隐藏我的信息（只对「至今」在职段有意义） */
  隐藏: boolean;
}

/** 行业快捷片：点一下填入，省得手机上打字 */
const 常见行业 = ['互联网', '金融科技', 'AI / 大模型', '企业服务', '云计算', '电商', '游戏', '硬件'];

/** 教育经历（标注 2026-08-18：企业端简历上的学校来自这里，onboarding 必须能配置） */
interface 教育段 {
  学校: string;
  学历: string;
  专业: string;
  开始: string;
  结束: string;
}

const 学历选项 = ['大专', '本科', '硕士', '博士'];

const 初始教育: 教育段 = {
  学校: '上海交通大学',
  学历: '硕士',
  专业: '计算机科学',
  开始: '2014-09',
  结束: '2017-06',
};

/** 简历解析出来的初始两段（演示数据） */
const 初始经历: 经历段[] = [
  {
    编号: 'e1',
    公司: '字节跳动',
    行业: '互联网',
    职位: '研发专家 2-2 · 交易中台',
    开始: '2019-06',
    结束: null,
    内容: '主导交易网关重建与峰值稳定性治理，大促峰值 32 万 QPS。',
    隐藏: true,
  },
  {
    编号: 'e2',
    公司: '美团',
    行业: '互联网',
    职位: '后端开发工程师',
    开始: '2017-07',
    结束: '2019-05',
    内容: '',
    隐藏: false,
  },
];

/** 'yyyy-MM' → 'yyyy.MM'；null → '至今' */
function 显示年月(值: string | null): string {
  if (!值) return '至今';
  return 值.replace('-', '.');
}

export default function 工作经历() {
  const { 跳转, 返回 } = use导航();
  const [经历列表, 设经历列表] = useState<经历段[]>(初始经历);
  // null = 列表视图；'新增' = 空白编辑；其它 = 正在编辑的段编号
  const [编辑目标, 设编辑目标] = useState<string | '新增' | null>(null);
  const [解析提示, 设解析提示] = useState('沈亦舟_简历_2026.pdf ✓ 已解析，可逐段修改');
  const [教育, 设教育] = useState<教育段>(初始教育);
  const [编辑教育中, 设编辑教育中] = useState(false);
  const 文件选择框 = useRef<HTMLInputElement>(null);

  function 选中简历文件(事件: ChangeEvent<HTMLInputElement>) {
    const 文件 = 事件.target.files?.[0];
    if (!文件) return;
    设解析提示(`${文件.name} ✓ 已解析，可逐段修改`);
    轻提示('解析完成（原型演示，不真解析文件）');
  }

  // ── 教育编辑视图 ──────────────────────────────────────────
  if (编辑教育中) {
    return (
      <教育编辑页
        初始={教育}
        取消={() => 设编辑教育中(false)}
        完成={(段) => {
          设教育(段);
          设编辑教育中(false);
        }}
      />
    );
  }

  // ── 编辑视图 ──────────────────────────────────────────────
  if (编辑目标 !== null) {
    const 正在编辑的段 = 编辑目标 === '新增' ? null : 经历列表.find((段) => 段.编号 === 编辑目标)!;
    return (
      <经历编辑页
        初始={正在编辑的段}
        取消={() => 设编辑目标(null)}
        完成={(段) => {
          设经历列表((旧) =>
            正在编辑的段
              ? 旧.map((条) => (条.编号 === 段.编号 ? 段 : 条))
              : [...旧, 段]
          );
          设编辑目标(null);
        }}
        删除={
          正在编辑的段
            ? () => {
                设经历列表((旧) => 旧.filter((条) => 条.编号 !== 正在编辑的段.编号));
                设编辑目标(null);
              }
            : undefined
        }
      />
    );
  }

  // ── 列表视图 ──────────────────────────────────────────────
  return (
    <次级页外壳>
      <返回栏
        返回={返回}
        右侧={
          <button
            className={`${样式.保存} 可点`}
            onClick={() => {
              if (经历列表.length === 0) {
                轻提示('至少填一段工作经历');
                return;
              }
              跳转(路径.引导问答);
            }}
          >
            保存
          </button>
        }
      />

      <页面大标题 标题="工作经历" />

      {/* 一键上传简历：绿色虚线框，点了走真实文件选择 */}
      <button className={`${样式.上传条} 可点`} onClick={() => 文件选择框.current?.click()}>
        <span className={样式.上传图标}>⬆</span>
        <span className={样式.上传文案}>
          <span className={样式.上传标题}>一键上传简历 · 自动填好下面每一段</span>
          <span className={`${样式.上传说明} 单行`}>{解析提示}</span>
        </span>
      </button>
      <input
        ref={文件选择框}
        type="file"
        accept=".pdf,.doc,.docx"
        className={样式.隐藏文件框}
        onChange={选中简历文件}
      />

      <滚动区 样式覆盖={{ padding: '14px 18px 40px' }}>
        {经历列表.map((段) => (
          <button
            key={段.编号}
            className={`${样式.经历卡} 可点`}
            onClick={() => 设编辑目标(段.编号)}
          >
            <span className={样式.经历卡主体}>
              <span className={样式.经历卡头行}>
                <span className={`${样式.经历公司} 单行`}>{段.公司}</span>
                <span className={`${样式.经历时间} 等宽数字`}>
                  {显示年月(段.开始)} — {显示年月(段.结束)}
                </span>
              </span>
              <span className={`${样式.经历职位} 单行`}>{段.职位}</span>
              <span className={样式.经历底行}>
                {段.行业 ? <span className={样式.经历行业}>{段.行业}</span> : null}
                {段.结束 === null && 段.隐藏 ? (
                  <span className={样式.隐身徽标}>已对该公司隐身</span>
                ) : null}
              </span>
            </span>
            <span className={样式.尖括号}>›</span>
          </button>
        ))}

        <button className={`${样式.添加行} 可点`} onClick={() => 设编辑目标('新增')}>
          <span className={样式.添加加号}>＋</span>
          <span className={样式.添加文字}>添加工作经历</span>
        </button>

        {/* ── 教育经历（标注 2026-08-18）：企业端简历上的学校显示自这里 ── */}
        <div className={样式.区块标}>教育经历</div>
        <button className={`${样式.经历卡} 可点`} onClick={() => 设编辑教育中(true)}>
          <span className={样式.经历卡主体}>
            <span className={样式.经历卡头行}>
              <span className={`${样式.经历公司} 单行`}>{教育.学校}</span>
              <span className={`${样式.经历时间} 等宽数字`}>
                {显示年月(教育.开始)} — {显示年月(教育.结束)}
              </span>
            </span>
            <span className={`${样式.经历职位} 单行`}>
              {教育.学历} · {教育.专业}
            </span>
          </span>
          <span className={样式.尖括号}>›</span>
        </button>
      </滚动区>
    </次级页外壳>
  );
}

// ── 教育经历编辑页：学校 / 学历（快捷片）/ 专业 / 起止年月（滚轮）────
function 教育编辑页({
  初始,
  取消,
  完成,
}: {
  初始: 教育段;
  取消: () => void;
  完成: (段: 教育段) => void;
}) {
  const [草稿, 设草稿] = useState<教育段>(初始);
  const [滚轮, 设滚轮] = useState<'开始' | '结束' | null>(null);
  const 可完成 = 草稿.学校.trim() !== '' && 草稿.专业.trim() !== '';

  const 改 = <K extends keyof 教育段>(键: K, 值: 教育段[K]) =>
    设草稿((旧) => ({ ...旧, [键]: 值 }));

  return (
    <次级页外壳>
      <返回栏
        返回={取消}
        标题="教育经历"
        右侧={
          <button
            className={`${样式.完成键} ${可完成 ? '' : 样式.完成键灰} 可点`}
            onClick={() => 可完成 && 完成(草稿)}
          >
            完成
          </button>
        }
      />

      <滚动区 样式覆盖={{ padding: '4px 22px 40px' }}>
        <div className={样式.编辑条目}>
          <div className={样式.条目标签}>学校名称</div>
          <input
            className={样式.条目输入}
            value={草稿.学校}
            placeholder="必填，如：上海交通大学"
            onChange={(事件) => 改('学校', 事件.target.value)}
          />
        </div>

        <div className={样式.编辑条目}>
          <div className={样式.条目标签}>学历</div>
          <div className={样式.行业片行}>
            {学历选项.map((项) => (
              <button
                key={项}
                className={`${样式.行业片} ${草稿.学历 === 项 ? 样式.行业片选中 : ''} 可点`}
                onClick={() => 改('学历', 项)}
              >
                {项}
              </button>
            ))}
          </div>
        </div>

        <div className={样式.编辑条目}>
          <div className={样式.条目标签}>专业</div>
          <input
            className={样式.条目输入}
            value={草稿.专业}
            placeholder="必填，如：计算机科学"
            onChange={(事件) => 改('专业', 事件.target.value)}
          />
        </div>

        <div className={样式.编辑条目}>
          <div className={样式.条目标签}>在读时间</div>
          <div className={样式.时间行}>
            <button
              className={`${样式.月份键} 等宽数字 可点`}
              onClick={() => 设滚轮('开始')}
              aria-label="入学年月"
            >
              {草稿.开始.replace('-', '.')}
            </button>
            <span className={样式.时间连字}>—</span>
            <button
              className={`${样式.月份键} 等宽数字 可点`}
              onClick={() => 设滚轮('结束')}
              aria-label="毕业年月"
            >
              {草稿.结束.replace('-', '.')}
            </button>
          </div>
        </div>
      </滚动区>

      {滚轮 ? (
        <年月滚轮层
          标题={滚轮 === '开始' ? '选择入学年月' : '选择毕业年月'}
          初值={滚轮 === '开始' ? 草稿.开始 : 草稿.结束}
          最小={滚轮 === '结束' ? 草稿.开始 : undefined}
          最大={new Date().toISOString().slice(0, 7)}
          确认={(值) => {
            改(滚轮, 值);
            设滚轮(null);
          }}
          取消={() => 设滚轮(null)}
        />
      ) : null}
    </次级页外壳>
  );
}

// ── 全屏编辑页（BOSS直聘 形态：逐项表单 + 完成/删除）──────────────
function 经历编辑页({
  初始,
  取消,
  完成,
  删除,
}: {
  初始: 经历段 | null;
  取消: () => void;
  完成: (段: 经历段) => void;
  删除?: () => void;
}) {
  const [草稿, 设草稿] = useState<经历段>(
    初始 ?? {
      编号: `e${Date.now()}`,
      公司: '',
      行业: '',
      职位: '',
      开始: '',
      结束: null,
      内容: '',
      隐藏: false,
    }
  );
  const [行业层, 设行业层] = useState(false);
  // 年月滚轮打开在哪一侧：null = 没开
  const [滚轮, 设滚轮] = useState<'开始' | '结束' | null>(null);
  const 至今 = 草稿.结束 === null;
  const 必填齐 = 草稿.公司.trim() !== '' && 草稿.职位.trim() !== '' && 草稿.开始 !== '';

  const 改 = <键 extends keyof 经历段>(键名: 键, 值: 经历段[键]) =>
    设草稿((旧) => ({ ...旧, [键名]: 值 }));

  return (
    <次级页外壳>
      <返回栏
        返回={取消}
        标题={初始 ? '编辑工作经历' : '添加工作经历'}
        居中标题
        右侧={
          <button
            className={`${样式.完成键} ${必填齐 ? '' : 样式.完成键灰} 可点`}
            onClick={() => {
              if (!必填齐) {
                轻提示('公司、职位、入职时间是必填的');
                return;
              }
              完成(草稿);
            }}
          >
            完成
          </button>
        }
      />

      <滚动区 样式覆盖={{ padding: '6px 22px 40px' }}>
        <div className={样式.编辑条目}>
          <div className={样式.条目标签}>公司名称</div>
          <input
            className={样式.条目输入}
            value={草稿.公司}
            placeholder="必填"
            onChange={(事件) => 改('公司', 事件.target.value)}
          />
        </div>

        {/* 所属行业：标注意见 21:43 —— 不摊一排快捷片，改成和「公司名称」同款的
            点击行，点开从底部选择层里挑（也可在层里手输），选完回填 */}
        <button className={`${样式.选择条目} 可点`} onClick={() => 设行业层(true)}>
          <span className={样式.条目标签}>所属行业</span>
          <span className={样式.选择条目值行}>
            <span className={`${草稿.行业 ? 样式.条目值 : 样式.条目占位} 单行`}>
              {草稿.行业 || '选择行业'}
            </span>
            <span className={样式.尖括号}>›</span>
          </span>
        </button>

        <div className={样式.编辑条目}>
          <div className={样式.条目标签}>职位名称</div>
          <input
            className={样式.条目输入}
            value={草稿.职位}
            placeholder="必填，如：资深后端工程师"
            onChange={(事件) => 改('职位', 事件.target.value)}
          />
        </div>

        {/* 在职时间：点开弹自绘年月滚轮（标注意见 2026-08-18），结束侧被「至今」接管 */}
        <div className={样式.编辑条目}>
          <div className={样式.条目标签}>在职时间</div>
          <div className={样式.时间行}>
            <button
              className={`${样式.月份键} ${草稿.开始 ? '' : 样式.月份键空} 等宽数字 可点`}
              onClick={() => 设滚轮('开始')}
              aria-label="入职年月"
            >
              {草稿.开始 ? 草稿.开始.replace('-', '.') : '入职年月'}
            </button>
            <span className={样式.时间连字}>—</span>
            {至今 ? (
              <span className={样式.至今占位}>至今</span>
            ) : (
              <button
                className={`${样式.月份键} ${草稿.结束 ? '' : 样式.月份键空} 等宽数字 可点`}
                onClick={() => 设滚轮('结束')}
                aria-label="离职年月"
              >
                {草稿.结束 ? 草稿.结束.replace('-', '.') : '离职年月'}
              </button>
            )}
            <label className={`${样式.至今开关} 可点`}>
              <input
                type="checkbox"
                checked={至今}
                onChange={(事件) => 改('结束', 事件.target.checked ? null : '')}
                className={样式.至今勾选框}
              />
              至今
            </label>
          </div>
        </div>

        <div className={样式.编辑条目}>
          <div className={样式.条目标签}>工作内容</div>
          <textarea
            className={样式.内容输入}
            value={草稿.内容}
            placeholder="做了什么、拿到什么结果，两三句即可"
            rows={4}
            onChange={(事件) => 改('内容', 事件.target.value)}
          />
        </div>

        {/* 只有「至今」在职段才有隐身开关：对外双盲的产品语义 */}
        {至今 ? (
          <div className={样式.屏蔽条目}>
            <div className={样式.屏蔽头}>
              <span className={样式.屏蔽标题}>对这家公司隐藏我的信息</span>
              <开关 开={草稿.隐藏} 切换={() => 改('隐藏', !草稿.隐藏)} />
            </div>
            <div className={样式.屏蔽说明}>
              {草稿.隐藏
                ? `已屏蔽${草稿.公司 || '现雇主'}及关联公司 · 互不推荐`
                : '关闭后现雇主可能看到你的匿名档案'}
            </div>
          </div>
        ) : null}

        {删除 ? (
          <button className={`${样式.删除键} 可点`} onClick={删除}>
            删除这段经历
          </button>
        ) : null}
      </滚动区>

      {/* 行业选择层：常见行业一行一条，底部留手输入口 */}
      {滚轮 ? (
        <年月滚轮层
          标题={滚轮 === '开始' ? '选择入职年月' : '选择离职年月'}
          初值={(滚轮 === '开始' ? 草稿.开始 : 草稿.结束) ?? ''}
          最小={滚轮 === '结束' ? 草稿.开始 || undefined : undefined}
          最大={new Date().toISOString().slice(0, 7)}
          确认={(值) => {
            改(滚轮, 值);
            设滚轮(null);
          }}
          取消={() => 设滚轮(null)}
        />
      ) : null}

      {行业层 ? (
        <div className={样式.遮罩} onClick={() => 设行业层(false)}>
          <div className={样式.选择层} onClick={(事件) => 事件.stopPropagation()}>
            <div className={样式.选择层抓手} />
            <div className={样式.选择层标题}>所属行业</div>
            <div className={`${样式.选择层列表} 滚动区`}>
              {常见行业.map((行业) => (
                <button
                  key={行业}
                  className={`${样式.选择项} ${草稿.行业 === 行业 ? 样式.选择项选中 : ''} 可点`}
                  onClick={() => {
                    改('行业', 行业);
                    设行业层(false);
                  }}
                >
                  {行业}
                  {草稿.行业 === 行业 ? <span className={样式.选择勾}>✓</span> : null}
                </button>
              ))}
            </div>
            <input
              className={样式.选择层输入}
              value={草稿.行业}
              placeholder="没有合适的？直接输入"
              onChange={(事件) => 改('行业', 事件.target.value)}
              onKeyDown={(事件) => {
                if (事件.key === 'Enter' && !事件.nativeEvent.isComposing) 设行业层(false);
              }}
            />
          </div>
        </div>
      ) : null}
    </次级页外壳>
  );
}
