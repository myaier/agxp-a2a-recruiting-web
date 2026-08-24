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

import { useState } from 'react';
import 样式 from './工作经历.module.css';
import 年月滚轮层 from '../组件/年月滚轮层';
import { 次级页外壳, 返回栏, 页面大标题, 滚动区, 开关 } from '../组件/通用';
import { 轻提示 } from '../组件/轻提示';
import { use应用状态 } from '../状态/应用状态';
import { 取后端错误文案 } from '../数据/HTTP客户端';
import type { 简历经历段, 简历教育段, 简历项目, 简历证书 } from '../数据/类型';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import 弹层框架 from '../组件/弹层框架';
import { 规范化作品集链接, 校验作品集链接, 校验起止年月 } from '../流程/onboarding配置';

/** 一段工作经历。开始/结束用 input[type=month] 的 yyyy-MM 格式；结束 null = 至今 */
/** 行业快捷片：点一下填入，省得手机上打字 */
const 常见行业 = ['互联网', '金融科技', 'AI / 大模型', '企业服务', '云计算', '电商', '游戏', '硬件'];

const 学历选项 = ['大专', '本科', '硕士', '博士'];

/** 'yyyy-MM' → 'yyyy.MM'；null → '至今' */
function 显示年月(值: string | null): string {
  if (!值) return '至今';
  return 值.replace('-', '.');
}

/** 本月，'yyyy-MM'。入职 / 入学 / 离职都不该选到未来，这是滚轮的天然上界 */
const 本月 = () => new Date().toISOString().slice(0, 7);

/**
 * 「开始」侧滚轮的上界：既不能晚于已填的结束，也不能选到未来，取两者里更早的那个。
 *
 * 这是日期倒置的第一道防线 —— 结束侧本来就有 最小=开始 挡着，开始侧却一直没有上界，
 * 所以「先填结束、再把开始往后滚」这条路能滚出 2020.09 — 2018.06。
 * 第二道防线是提交前的 校验起止年月：滚轮只能挡住在这一屏改出来的倒置，
 * 挡不住旧存档里已经倒置的数据。
 */
function 开始上界(结束: string | null): string {
  const 今 = 本月();
  return 结束 && 结束 < 今 ? 结束 : 今;
}

export default function 工作经历() {
  const { 跳转, 返回 } = use导航();
  const { 状态: 全局, 派发, 操作 } = use应用状态();
  // 学生分支（身份来自学生分流屏）：教育置顶，工作经历段改叫「实习经历」
  const 在校中 = 全局.基本信息.身份 === '在校';
  const 经历区块名 = 在校中 ? '实习经历' : '工作经历';
  // 简历数据来自全局（并已持久化）：此前是本页 useState，一离开页面就回到 mock，
  // 用户「每次都要重走 onboarding 才能恢复」（2026-08-18 用户复现）
  const 经历列表 = 全局.简历经历;
  const 教育列表 = 全局.简历教育;
  const 技能列表 = 全局.简历技能;
  const 证书列表 = 全局.简历证书;
  // 作品集链接：整份简历一条，与专业技能 / 证书与语言并列的独立区块（2026-08-22 从「完善资料」屏搬来）
  const 作品集链接 = 全局.简历作品集链接;
  const 作品集错误 = 校验作品集链接(作品集链接);
  const 存作品集链接 = (值: string) => 派发({ 型: '存作品集链接', 链接: 值 });
  /** 统一写入口：任何一块改动都连同其余块一起存（保持快照完整）*/
  const 存 = (
    改: Partial<{
      经历: 简历经历段[];
      教育: 简历教育段[];
      技能: string[];
      证书: 简历证书[];
    }>
  ) =>
    派发({
      型: '存简历',
      经历: 改.经历 ?? 经历列表,
      教育: 改.教育 ?? 教育列表,
      技能: 改.技能 ?? 技能列表,
      证书: 改.证书 ?? 证书列表,
      基本信息: 全局.基本信息,
    });
  // null = 列表视图；'新增' = 空白编辑；其它 = 正在编辑的段编号
  const [编辑目标, 设编辑目标] = useState<string | '新增' | null>(null);
  // null = 不在编辑教育；'新增' = 空白；其它 = 正在编辑的教育段编号
  const [教育目标, 设教育目标] = useState<string | '新增' | null>(null);
  // 技能 / 证书的行内录入草稿
  const [技能草稿, 设技能草稿] = useState('');
  const [证书名草稿, 设证书名草稿] = useState('');

  /** 加一条技能：去重 + 去空白，重复的直接吞掉不报错（用户多半只是手抖点了两次）*/
  const 加技能 = () => {
    const 词 = 技能草稿.trim();
    if (词 === '') return;
    if (!技能列表.includes(词)) 存({ 技能: [...技能列表, 词] });
    设技能草稿('');
  };

  const 加证书 = () => {
    const 名 = 证书名草稿.trim();
    if (名 === '') {
      轻提示('先填证书名称');
      return;
    }
    // 年份录入框按标注 14:31 删掉，新加的证书年份留空（列表里年份为空即不渲染）
    存({
      证书: [...证书列表, { 编号: `c${Date.now()}`, 名称: 名, 年份: '' }],
    });
    设证书名草稿('');
  };



  // ── 教育编辑视图 ──────────────────────────────────────────
  if (教育目标 !== null) {
    const 正在编辑的教育 =
      教育目标 === '新增' ? null : 教育列表.find((条) => 条.编号 === 教育目标)!;
    return (
      <教育编辑页
        初始={正在编辑的教育}
        取消={() => 设教育目标(null)}
        完成={(段) => {
          存({
            教育: 正在编辑的教育
              ? 教育列表.map((条) => (条.编号 === 段.编号 ? 段 : 条))
              : [...教育列表, 段],
          });
          设教育目标(null);
        }}
        删除={
          正在编辑的教育 && 教育列表.length > 1
            ? () => {
                存({ 教育: 教育列表.filter((条) => 条.编号 !== 正在编辑的教育.编号) });
                设教育目标(null);
              }
            : undefined
        }
      />
    );
  }

  // ── 编辑视图 ──────────────────────────────────────────────
  if (编辑目标 !== null) {
    const 正在编辑的段 = 编辑目标 === '新增' ? null : 经历列表.find((段) => 段.编号 === 编辑目标)!;
    return (
      <经历编辑页
        初始={正在编辑的段}
        区块名={经历区块名}
        取消={() => 设编辑目标(null)}
        完成={(段) => {
          存({
            经历: 正在编辑的段
              ? 经历列表.map((条) => (条.编号 === 段.编号 ? 段 : 条))
              : [...经历列表, 段],
          });
          设编辑目标(null);
        }}
        删除={
          正在编辑的段
            ? () => {
                存({ 经历: 经历列表.filter((条) => 条.编号 !== 正在编辑的段.编号) });
                设编辑目标(null);
              }
            : undefined
        }
      />
    );
  }

  // ── 列表视图 ──────────────────────────────────────────────
  // 经历 / 教育两个区块抽成片段：学生分支教育置顶、经历区改叫「实习经历」，
  // 非学生保持 工作经历 → 教育经历 的现状顺序
  const 经历区 = (
    <>
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
        <span className={样式.添加文字}>添加{经历区块名}</span>
      </button>
    </>
  );

  // 教育经历：支持多段（本科+硕士），企业端简历的学校显示自这里
  const 教育区 = (
    <>
      {教育列表.map((条) => (
        <button
          key={条.编号}
          className={`${样式.经历卡} 可点`}
          onClick={() => 设教育目标(条.编号)}
        >
          <span className={样式.经历卡主体}>
            <span className={样式.经历卡头行}>
              <span className={`${样式.经历公司} 单行`}>{条.学校}</span>
              <span className={`${样式.经历时间} 等宽数字`}>
                {显示年月(条.开始)} — {显示年月(条.结束)}
              </span>
            </span>
            <span className={`${样式.经历职位} 单行`}>
              {条.学历} · {条.专业}
            </span>
          </span>
          <span className={样式.尖括号}>›</span>
        </button>
      ))}
      <button className={`${样式.添加行} 可点`} onClick={() => 设教育目标('新增')}>
        <span className={样式.添加加号}>＋</span>
        <span className={样式.添加文字}>添加教育经历</span>
      </button>
    </>
  );

  return (
    // 2026-08-24 全站选择风格统一（C1 定稿）：页底白底
    <次级页外壳 白底>
      <返回栏
        返回={返回}
        右侧={
          <button
            className={`${样式.保存} 可点`}
            onClick={async () => {
              // 学生的实习经历可以为空（没实习过是常态），不拦；社招至少一段
              if (!在校中 && 经历列表.length === 0) {
                轻提示('至少填一段工作经历');
                return;
              }
              if (作品集错误) {
                轻提示(作品集错误);
                return;
              }
              try {
                await 操作.保存简历({
                  基本信息: 全局.基本信息,
                  个人优势: 全局.个人优势,
                  技能: 技能列表,
                  经历: 经历列表,
                  教育: 教育列表,
                  证书: 证书列表,
                });
                跳转(在校中 ? 路径.求职状态 : 路径.引导问答);
              } catch (错误) {
                轻提示(取后端错误文案(错误));
              }
            }}
          >
            保存
          </button>
        }
      />

      {/* 整屏标题不能是其中某一块的名字。原来跟着首个区块走（学生态写「教育经历」、
          非学生写「工作经历」），可这一屏装着四块：教育经历 / 实习经历（或工作经历）/
          专业技能 / 证书与语言 —— 于是学生看到的是「标题写教育经历，下面却是实习经历」
          （2026-08-22 产品负责人当场指出）。
          改用「在线简历」：四块全是简历内容，两端两态都说得通；这个词项目里已经在用
          （基本信息屏的大标题就是「创建在线简历」），不是新造的说法，也不解释什么，就是个名字。
          刻意不叫「我的简历」—— 那是 /resume 那一屏的名字，两屏重名会分不清。 */}
      <页面大标题 标题="在线简历" />

      {/* 上传条按标注 2026-08-24 删除（「前面有一个上传简历了」）——
          完善资料屏已有唯一上传入口，这里只展示与逐段编辑 */}
      <滚动区 样式覆盖={{ padding: '14px 18px 40px' }}>
        {在校中 ? (
          <>
            {教育区}
            <div className={样式.区块标}>实习经历</div>
            {经历区}
          </>
        ) : (
          <>
            {经历区}
            <div className={样式.区块标}>教育经历</div>
            {教育区}
          </>
        )}

        {/* ── 专业技能：代理做匿名初筛时按标签逐条比对岗位的技术要求，
            所以它是标签而不是一段自由文本 —— 自由文本没法逐条核对 ── */}
        <div className={样式.区块标}>专业技能</div>
        <div className={样式.技能卡}>
          {技能列表.length > 0 ? (
            <div className={样式.标签组}>
              {技能列表.map((项) => (
                <button
                  key={项}
                  className={`${样式.标签} 可点`}
                  onClick={() => 存({ 技能: 技能列表.filter((条) => 条 !== 项) })}
                  aria-label={`删除技能 ${项}`}
                >
                  {项}
                  <span className={样式.标签删}>✕</span>
                </button>
              ))}
            </div>
          ) : (
            null /* 空态提示按标注 2026-08-24 删除（「把这个小文案删掉」）*/
          )}

          <div className={样式.录入行}>
            <input
              className={样式.录入框}
              value={技能草稿}
              placeholder="如：Go、分布式事务"
              onChange={(事件) => 设技能草稿(事件.target.value)}
              onKeyDown={(事件) => {
                // isComposing：挡住中文输入法「回车上屏候选词」那一下
                if (事件.key === 'Enter' && !事件.nativeEvent.isComposing) 加技能();
              }}
              enterKeyHint="done"
            />
            <button className={`${样式.录入键} 可点`} onClick={加技能}>
              添加
            </button>
          </div>
        </div>

        {/* ── 证书与语言：软考 / CPA / 司考这类硬门槛，加上雅思 / 托福 / 日语
               这类语言证明 —— 都是岗位可能设成硬性条件的项（标注 11:56）── */}
        <div className={样式.区块标}>证书与语言</div>
        {证书列表.map((条) => (
          <div key={条.编号} className={样式.证书行}>
            <span className={样式.证书主体}>
              <span className={`${样式.证书名} 单行`}>{条.名称}</span>
              {条.年份 ? (
                <span className={`${样式.证书年} 等宽数字`}>{条.年份} 年取得</span>
              ) : null}
            </span>
            <button
              className={`${样式.行删除} 可点`}
              onClick={() => 存({ 证书: 证书列表.filter((项) => 项.编号 !== 条.编号) })}
              aria-label={`删除证书 ${条.名称}`}
            >
              ✕
            </button>
          </div>
        ))}
        <div className={样式.录入行}>
          <input
            className={样式.录入框}
            value={证书名草稿}
            placeholder="证书或语言，如 CPA、雅思 7.0"
            onChange={(事件) => 设证书名草稿(事件.target.value)}
            onKeyDown={(事件) => {
              if (事件.key === 'Enter' && !事件.nativeEvent.isComposing) 加证书();
            }}
          />
          <button className={`${样式.录入键} 可点`} onClick={加证书}>
            添加
          </button>
        </div>

        {/* ── 作品集或项目链接（2026-08-22 从「完善资料」屏搬来）──
            产品负责人：作品集是简历内容，不是求职偏好，所以它属于这一屏。
            做成与「专业技能」「证书与语言」并列的独立区块、而不是塞进单段经历的表单里：
            一个人只有一个作品集，它是整份简历级别的；挂到某一段经历下面，
            换一段经历就得再填一次，企业端也不知道该读哪一段的那条。 */}
        <div className={样式.区块标}>作品集或项目链接</div>
        <input
          className={样式.整行输入}
          type="url"
          inputMode="url"
          value={作品集链接}
          placeholder="https://"
          aria-label="作品集或项目链接"
          aria-invalid={Boolean(作品集错误)}
          onChange={(事件) => 存作品集链接(事件.target.value)}
          // 失焦才规范化：边打字边补 https:// 会把光标顶走
          onBlur={() => 存作品集链接(规范化作品集链接(作品集链接))}
        />
        {作品集错误 ? <div className={样式.字段错误}>{作品集错误}</div> : null}
      </滚动区>
    </次级页外壳>
  );
}

// ── 教育经历编辑页：学校 / 学历（快捷片）/ 专业 / 起止年月（滚轮）────
function 教育编辑页({
  初始,
  取消,
  完成,
  删除,
}: {
  初始: 简历教育段 | null;
  取消: () => void;
  完成: (段: 简历教育段) => void;
  删除?: () => void;
}) {
  const [草稿, 设草稿] = useState<简历教育段>(
    初始 ?? {
      编号: `edu${Date.now()}`,
      学校: '',
      学历: '本科',
      专业: '',
      开始: '2016-09',
      结束: '2020-06',
    }
  );
  const [滚轮, 设滚轮] = useState<'开始' | '结束' | null>(null);
  // 毕业早于入学一定是滚错档：不拦住，这段教育会带着「2020.09 — 2018.06」一直存下去
  const 时间错误 = 校验起止年月(草稿.开始, 草稿.结束, '入学时间', '毕业时间');
  const 可完成 = 草稿.学校.trim() !== '' && 草稿.专业.trim() !== '' && !时间错误;

  const 改 = <K extends keyof 简历教育段>(键: K, 值: 简历教育段[K]) =>
    设草稿((旧) => ({ ...旧, [键]: 值 }));

  return (
    // 2026-08-24 全站选择风格统一（C1 定稿）：页底白底
    <次级页外壳 白底>
      <返回栏
        返回={取消}
        标题="教育经历"
        右侧={
          <button
            className={`${样式.完成键} ${可完成 ? '' : 样式.完成键灰} 可点`}
            onClick={() => {
              // 原来点灰按钮什么都不发生，用户不知道卡在哪一项 —— 照经历编辑页的做法给轻提示。
              // 报错顺序也跟经历编辑页对齐：先必填、后时间，两页体感一致
              if (草稿.学校.trim() === '' || 草稿.专业.trim() === '') {
                轻提示('学校、专业是必填的');
                return;
              }
              if (时间错误) {
                轻提示(时间错误);
                return;
              }
              完成(草稿);
            }}
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
            placeholder="必填"
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
            placeholder="必填"
            onChange={(事件) => 改('专业', 事件.target.value)}
          />
        </div>

        <div className={样式.编辑条目}>
          <div className={样式.条目标签}>在读时间</div>
          <div className={样式.时间行}>
            <button
              className={`${样式.月份键} ${时间错误 ? 样式.月份键错 : ''} 等宽数字 可点`}
              onClick={() => 设滚轮('开始')}
              aria-label="入学年月"
            >
              {草稿.开始.replace('-', '.')}
            </button>
            <span className={样式.时间连字}>—</span>
            <button
              className={`${样式.月份键} ${时间错误 ? 样式.月份键错 : ''} 等宽数字 可点`}
              onClick={() => 设滚轮('结束')}
              aria-label="毕业年月"
            >
              {草稿.结束.replace('-', '.')}
            </button>
          </div>
          {/* role=alert：两个键都是 button，button 不支持 aria-invalid，
              读屏用户靠这条即时播报的错误文案知道哪一项不对 */}
          {时间错误 ? (
            <div className={样式.字段错误} role="alert">
              {时间错误}
            </div>
          ) : null}
        </div>
      </滚动区>

      {删除 ? (
        <div style={{ padding: '0 22px 24px' }}>
          <button className={`${样式.删除键} 可点`} onClick={删除}>
            删除这段教育经历
          </button>
        </div>
      ) : null}

      {滚轮 ? (
        <年月滚轮层
          标题={滚轮 === '开始' ? '选择入学年月' : '选择毕业年月'}
          初值={滚轮 === '开始' ? 草稿.开始 : 草稿.结束}
          最小={滚轮 === '结束' ? 草稿.开始 : undefined}
          最大={滚轮 === '开始' ? 开始上界(草稿.结束) : 本月()}
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
  区块名,
  取消,
  完成,
  删除,
}: {
  初始: 简历经历段 | null;
  /** 学生分支叫「实习经历」，非学生叫「工作经历」，只是标题措辞，字段一致 */
  区块名: string;
  取消: () => void;
  完成: (段: 简历经历段) => void;
  删除?: () => void;
}) {
  const [草稿, 设草稿] = useState<简历经历段>(
    初始 ?? {
      编号: `e${Date.now()}`,
      公司: '',
      行业: '',
      职位: '',
      开始: '',
      结束: null,
      内容: '',
      // 底部两个开关的默认值：隐身默认开、实习默认关（标注 14:29）
      隐藏: true,
      实习: false,
    }
  );
  const [行业层, 设行业层] = useState(false);
  // 年月滚轮打开在哪一侧：null = 没开
  const [滚轮, 设滚轮] = useState<'开始' | '结束' | null>(null);
  const 至今 = 草稿.结束 === null;
  // 离职早于入职一定是滚错档。结束 = null 是「至今」，合法，校验函数会跳过它
  const 时间错误 = 校验起止年月(草稿.开始, 草稿.结束, '入职时间', '离职时间');
  const 必填齐 = 草稿.公司.trim() !== '' && 草稿.职位.trim() !== '' && 草稿.开始 !== '';
  const 可完成 = 必填齐 && !时间错误;

  const 改 = <键 extends keyof 简历经历段>(键名: 键, 值: 简历经历段[键]) =>
    设草稿((旧) => ({ ...旧, [键名]: 值 }));

  // ── 工作业绩（原「关键项目」，标注 14:28 改名）：挂在这一段经历里面，不做独立大分节 ──
  // 业绩脱离了公司和时间就没有可核对性（「这件事是在哪家公司、什么时候做的」），
  // 所以它必须长在经历段内部，而不是简历里另起一个平级分节。
  const 项目列表 = 草稿.项目 ?? [];
  const 写项目 = (新列表: 简历项目[]) => 改('项目', 新列表);
  const 改项目 = <键 extends keyof 简历项目>(编号: string, 键名: 键, 值: 简历项目[键]) =>
    写项目(项目列表.map((条) => (条.编号 === 编号 ? { ...条, [键名]: 值 } : 条)));

  return (
    // 2026-08-24 全站选择风格统一（C1 定稿）：页底白底
    <次级页外壳 白底>
      <返回栏
        返回={取消}
        标题={初始 ? `编辑${区块名}` : `添加${区块名}`}
        居中标题
        右侧={
          <button
            className={`${样式.完成键} ${可完成 ? '' : 样式.完成键灰} 可点`}
            onClick={() => {
              if (!必填齐) {
                轻提示('公司、职位、入职时间是必填的');
                return;
              }
              if (时间错误) {
                轻提示(时间错误);
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
            placeholder="必填"
            onChange={(事件) => 改('职位', 事件.target.value)}
          />
        </div>

        {/* 在职时间：点开弹自绘年月滚轮（标注意见 2026-08-18），结束侧被「至今」接管 */}
        <div className={样式.编辑条目}>
          <div className={样式.条目标签}>在职时间</div>
          <div className={样式.时间行}>
            <button
              className={`${样式.月份键} ${草稿.开始 ? '' : 样式.月份键空} ${时间错误 ? 样式.月份键错 : ''} 等宽数字 可点`}
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
                className={`${样式.月份键} ${草稿.结束 ? '' : 样式.月份键空} ${时间错误 ? 样式.月份键错 : ''} 等宽数字 可点`}
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
          {时间错误 ? (
            <div className={样式.字段错误} role="alert">
              {时间错误}
            </div>
          ) : null}
        </div>

        <div className={样式.编辑条目}>
          <div className={样式.条目标签}>工作内容</div>
          {/* 标注 2026-08-20 18:14：内容要整段展开，框内滚动很难用 ——
              随文本行数自动长高（onInput 里同步 scrollHeight），不设内部滚动 */}
          <textarea
            className={样式.内容输入}
            value={草稿.内容}
            placeholder="请详细写职责、规模、结果"
            rows={1}
            ref={(节点) => {
              if (节点) {
                节点.style.height = 'auto';
                节点.style.height = `${节点.scrollHeight}px`;
              }
            }}
            onChange={(事件) => {
              事件.target.style.height = 'auto';
              事件.target.style.height = `${事件.target.scrollHeight}px`;
              改('内容', 事件.target.value);
            }}
          />
        </div>

        {/* 工作业绩：名称 / 角色 / 结果三行，多条可增删。
            只要三项里填了任意一项就跟着这段经历一起存，不设必填 —— 它是加分项，
            不该拦住用户保存经历 */}
        <div className={样式.编辑条目}>
          <div className={样式.条目标签}>
            工作业绩<span className={样式.选填注}>选填</span>
          </div>

          {项目列表.map((条, 序) => (
            <div key={条.编号} className={样式.项目卡}>
              <div className={样式.项目卡头}>
                <span className={样式.项目序}>业绩 {序 + 1}</span>
                <button
                  className={`${样式.行删除} 可点`}
                  onClick={() => 写项目(项目列表.filter((项) => 项.编号 !== 条.编号))}
                  aria-label={`删除业绩 ${序 + 1}`}
                >
                  ✕
                </button>
              </div>
              <input
                className={样式.项目输入}
                value={条.名称}
                placeholder="名称"
                onChange={(事件) => 改项目(条.编号, '名称', 事件.target.value)}
              />
              <input
                className={样式.项目输入}
                value={条.角色}
                placeholder="角色"
                onChange={(事件) => 改项目(条.编号, '角色', 事件.target.value)}
              />
              <input
                className={`${样式.项目输入} ${样式.项目末行}`}
                value={条.结果}
                placeholder="结果"
                onChange={(事件) => 改项目(条.编号, '结果', 事件.target.value)}
              />
            </div>
          ))}

          <button
            className={`${样式.添加行} ${样式.添加行紧凑} 可点`}
            onClick={() =>
              写项目([
                ...项目列表,
                { 编号: `p${Date.now()}`, 名称: '', 角色: '', 结果: '' },
              ])
            }
          >
            <span className={样式.添加加号}>＋</span>
            <span className={样式.添加文字}>添加工作业绩</span>
          </button>
        </div>

        {/* 编辑页最底部两个开关（标注 14:29）：实习标记 + 对这家公司隐身。
            新增段默认「隐藏 = 开」，编辑老段沿用该段已存的值；实习字段可缺省 */}
        <div className={样式.开关条目}>
          <span className={样式.开关标题}>本段经历是实习经历</span>
          <开关 标签="本段经历是实习经历" 开={草稿.实习 === true} 切换={() => 改('实习', !草稿.实习)} />
        </div>
        <div className={样式.开关条目}>
          <span className={样式.开关标题}>对这家公司隐藏我的信息</span>
          <开关 标签="对这家公司隐藏我的信息" 开={草稿.隐藏} 切换={() => 改('隐藏', !草稿.隐藏)} />
        </div>

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
          最大={滚轮 === '开始' ? 开始上界(草稿.结束) : 本月()}
          确认={(值) => {
            改(滚轮, 值);
            设滚轮(null);
          }}
          取消={() => 设滚轮(null)}
        />
      ) : null}

      {行业层 ? (
        <弹层框架 标签="选择所属行业" 遮罩类名={样式.遮罩} 面板类名={样式.选择层} 关闭={() => 设行业层(false)}>
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
        </弹层框架>
      ) : null}
    </次级页外壳>
  );
}
