// R8 企业实名认证 · 招聘方注册第一步。
// 同构源：选身份.tsx 的次级页版式（通用大标题 / 弹性占位 / 底部主按钮）。
//
// 业务口径：双盲机制是不对称的 —— 候选人在意向确认前只有代号，
// 招聘方却从一开始就实名示人。这一屏核验的「真实姓名 + 任职公司」
// 正是候选人敢把条件交给 AI 代理的前提。
//
// P1C 起分双分支：
//   Mock   —— 保留原 1.2 秒人脸识别原型：点「开始人脸识别」→「认证中…」
//              （setTimeout + 本地态）→ 轻提示('认证通过') → 跳 招聘名片。
//              合同 B/C：公司输入换成同一 公司选择层（本地 模拟企业目录，
//              不发任何请求），其余原型行为原样保留。
//   Backend —— 这屏不再是「做一次认证」，而是诚实的身份摘要：
//              个人 / 任职 / 管理员申请三条按服务端事实分开展示；
//              合同 C：申请入口显示待申请企业（档案 organization_ref 经
//              读取目录企业 恢复名称），按下携带 encoded 公开 ID 进申请页
//              —— 这只是进入申请页的待申请选择，不隐式修改招聘档案。
//              Backend 分支不进任何计时器代码 —— 没有 KYC 结果就不伪造「认证通过」。

import { useEffect, useRef, useState } from 'react';
import 样式 from './企业实名认证.module.css';
import { 次级页外壳, 返回栏, 页面大标题, 滚动区, 主按钮, 表单条目 } from '../组件/通用';
import 公司选择抽屉接线 from '../组件/公司选择抽屉接线';
import { 轻提示 } from '../组件/轻提示';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { 路径 } from '../路由/路径表';
import { 从BFF招聘身份 } from '../数据/组织映射';
import { use组织查询 } from './组织查询钩子';
import { 模拟目录搜索, 模拟目录添加 } from '../数据/企业端模拟数据';
import type { BFF组织搜索项 } from '../数据/BFF契约';

/** 公司全称的注意事项（BOSS 截图三条，换成我们的口径） */
const 公司注意事项 = [
  '填写营业执照上的公司全称，注意区分总公司与分公司',
  '全称用于核验你确实在该公司任职，请确保准确',
  '认证通过后，姓名与公司会写进你的招聘名片，候选人从第一轮起可见',
];

export default function 企业实名认证() {
  const { 数据源模式 } = use应用状态();
  return 数据源模式 === 'backend' ? <后端身份摘要 /> : <Mock人脸原型 />;
}

// ── Backend：只读身份摘要 + 两个组织动作入口 ─────────────────────────

function 后端身份摘要() {
  const { 跳转, 返回 } = use导航();
  const { 状态, 操作, 数据源模式, 后端状态 } = use应用状态();
  const 身份 = 从BFF招聘身份(
    状态.招聘方档案, 状态.企业关系列表, 状态.当前企业关系编号, 状态.企业管理员申请列表,
  );
  // 进入本屏才读管理员申请（不进登录链）：失败只收敛在本屏的申请行，不弹提示不阻断别处
  const [申请读取失败, 设申请读取失败] = useState(false);
  useEffect(() => {
    let 已取消 = false;
    操作.读取企业管理员申请().catch(() => {
      if (!已取消) 设申请读取失败(true);
    });
    return () => {
      已取消 = true;
    };
  }, [操作]);

  // ── 待申请企业的本页本地选择（Spec §4.1）：初始值 = 档案坐标，名称经 读取目录企业
  // 恢复；经抽屉另选只更新本页选择 —— 申请入口携带本页所选 ID，不 PATCH 档案、
  // 不改 affiliation。本地选择不持久化：重挂载/刷新自然回到档案默认。
  const 档案坐标 = 状态.招聘方档案?.organization_ref ?? null;
  const [待申请ID, 设待申请ID] = useState<string | null>(档案坐标);
  const [待申请名称, 设待申请名称] = useState<string | null>(null);
  const [待申请读取中, 设待申请读取中] = useState(false);
  const [待申请读取失败, 设待申请读取失败] = useState(false);
  // 用户经抽屉改选后置位：此后档案坐标的迟到变化不再覆盖本页选择
  const 已改选 = useRef(false);
  useEffect(() => {
    if (已改选.current) return;
    设待申请ID(档案坐标);
  }, [档案坐标]);
  useEffect(() => {
    if (已改选.current) return; // 改选的名称随回填已定，不再按 ID 重读
    if (待申请ID === null) {
      设待申请名称(null);
      设待申请读取中(false);
      设待申请读取失败(false);
      return;
    }
    let 已取消 = false;
    设待申请读取中(true);
    设待申请读取失败(false);
    操作.读取目录企业(待申请ID)
      .then((项) => {
        if (!已取消) 设待申请名称(项.display_name);
      })
      .catch(() => {
        if (!已取消) 设待申请读取失败(true);
      })
      .finally(() => {
        if (!已取消) 设待申请读取中(false);
      });
    return () => {
      已取消 = true;
    };
  }, [待申请ID, 操作]);
  const 待申请值 = 待申请读取中
    ? '公司信息加载中…'
    : 待申请读取失败
      ? '公司信息读取失败'
      : 待申请名称 ?? '未选择';

  // 公司选择抽屉（合同 B）：搜索/创建走操作层目录三操作，结果 ID 只经这里回填本页选择
  const [抽屉开, 设抽屉开] = useState(false);
  const 查询 = use组织查询({
    搜索: 操作.搜索组织,
    创建: 操作.创建组织,
    作用域键: JSON.stringify([数据源模式, 后端状态?.主体?.subject_id ?? null, '企业实名认证']),
  });
  function 回填待申请(项: BFF组织搜索项) {
    已改选.current = true;
    设待申请ID(项.organization_id);
    设待申请名称(项.display_name);
    查询.作废();
    设抽屉开(false);
  }
  async function 添加待申请(名称: string) {
    const 项 = await 查询.添加(名称);
    if (项) 回填待申请(项);
  }
  function 关闭抽屉() {
    // 取消/Escape/遮罩：本页选择不变，作废在飞请求后隐藏（合同 B：先 作废 再隐藏）
    查询.作废();
    设抽屉开(false);
  }
  /** 申请入口：空选择时引导先选（打开抽屉）；有选择携带本页所选 encoded ID 进申请页 */
  function 申请入口按下() {
    if (待申请ID === null) {
      设抽屉开(true);
      return;
    }
    跳转(路径.企业组织申请带企业(待申请ID));
  }

  const 当前任职 = 身份.currentAffiliation;
  const 申请行 = 申请读取失败
    ? '管理员申请：读取失败'
    : 身份.latestAdminRequest
      ? `管理员申请：${身份.latestAdminRequest.statusLabel}`
      : '管理员申请：暂无';

  return (
    <次级页外壳>
      <返回栏 返回={返回} />

      <页面大标题 标题="实名认证" 说明="按服务端记录如实展示，不做本地认证" />

      <滚动区 样式覆盖={{ padding: '0 0 8px' }}>
        <div className={样式.表单区}>
          {/* ── 个人：公开名 / 实名 / 验证状态 —— 三者分开，不合并成一个布尔 ── */}
          <div className={样式.编辑条目}>
            <div className={样式.条目标签}>公开名</div>
            <div className={样式.条目输入}>{身份.publicName || '未设置'}</div>
          </div>
          <div className={样式.编辑条目}>
            <div className={样式.条目标签}>个人认证</div>
            <div className={样式.条目输入}>实名：{身份.verifiedName ?? '未实名'}</div>
          </div>
          <div className={样式.编辑条目}>
            <div className={样式.条目标签}>验证状态</div>
            <div className={样式.条目输入}>个人身份：{身份.personalVerification.label}</div>
          </div>

          {/* ── 任职：当前 Affiliation 的企业名 / 角色 / 关系状态（Organization 事实）── */}
          <div className={样式.编辑条目}>
            <div className={样式.条目标签}>当前任职</div>
            <div className={样式.条目输入}>
              {当前任职
                ? `任职：${当前任职.organizationName} · ${当前任职.roleLabel} · ${当前任职.statusLabel}`
                : '任职：暂无'}
            </div>
          </div>

          {/* ── 管理员申请：最新一条的服务端状态 ── */}
          <div className={样式.编辑条目}>
            <div className={样式.条目标签}>组织管理员申请</div>
            <div className={样式.条目输入}>{申请行}</div>
          </div>
        </div>

        {/* ── 动作入口：本页选择待申请企业 / 申请企业管理员 / 输入邀请口令加入 ── */}
        <div className={样式.表单区}>
          <表单条目
            标签="待申请企业"
            值={待申请值}
            按下={() => 设抽屉开(true)}
          />
          <表单条目
            标签="申请企业管理员"
            值="按所选企业进入申请"
            按下={申请入口按下}
          />
          <表单条目
            标签="输入邀请口令加入企业"
            值="收到管理员邀请口令后在此加入"
            按下={() => 跳转(路径.企业邀请加入)}
          />
        </div>
      </滚动区>

      {抽屉开 ? (
        <公司选择抽屉接线
          查询={查询}
          选中键={待申请ID}
          选定={(键) => {
            // 选中 ID 只来自父页面：在本实例结果里定位完整项再回填
            const 项 = 查询.结果.find((候选) => 候选.organization_id === 键);
            if (项) 回填待申请(项);
          }}
          关闭={关闭抽屉}
          添加={(名称) => void 添加待申请(名称)}
        />
      ) : null}
    </次级页外壳>
  );
}

// ── Mock：1.2 秒人脸识别原型（计时行为逐字保留，公司输入换同一选择抽屉）────

function Mock人脸原型() {
  const { 跳转, 返回 } = use导航();
  const { 状态, 派发 } = use应用状态();
  // 预填上次认证的结果：老用户重走认证是「改」不是「重填」
  const [姓名, 设姓名] = useState(状态.企业认证.姓名);
  const [公司全称, 设公司全称] = useState(状态.企业认证.公司);
  const [认证中, 设认证中] = useState(false);
  // 计时器句柄：认证中途退出本屏时清掉，避免离屏后仍触发跳转
  const 计时器 = useRef<number | null>(null);
  // 合同 B/C：公司输入换同一 公司选择层 —— 搜索/添加走本地 模拟企业目录，
  // 不发任何请求；选中回填后关抽屉并 作废（父页面关闭时先作废再隐藏）。
  const [抽屉开, 设抽屉开] = useState(false);
  // 本地选择只留名称写 企业认证；抽屉的 ✓ 标记另记所选行的目录键
  const [选中键, 设选中键] = useState<string | null>(null);
  const 查询 = use组织查询({
    // Mock 不发请求：本地 模拟企业目录 直接当 Promise 返回
    搜索: async (查询参数) => 模拟目录搜索(查询参数),
    创建: async (名称) => 模拟目录添加(名称),
    作用域键: JSON.stringify(['mock', '企业实名认证']),
  });
  function 选定公司(键: string) {
    const 项 = 查询.结果.find((候选) => 候选.organization_id === 键);
    if (!项) return;
    设公司全称(项.display_name);
    设选中键(项.organization_id);
    查询.作废();
    设抽屉开(false);
  }
  async function 添加公司(名称: string) {
    const 项 = await 查询.添加(名称);
    if (!项) return;
    设公司全称(项.display_name);
    设选中键(项.organization_id);
    查询.作废();
    设抽屉开(false);
  }
  function 关闭抽屉() {
    查询.作废();
    设抽屉开(false);
  }

  useEffect(() => {
    return () => {
      if (计时器.current !== null) window.clearTimeout(计时器.current);
    };
  }, []);

  function 开始识别() {
    if (认证中) return;
    // 人脸识别核对的就是这两项，缺一项识别无从谈起
    if (姓名.trim() === '') {
      轻提示('请填写与证件一致的真实姓名');
      return;
    }
    if (公司全称.trim() === '') {
      轻提示('请填写营业执照上的公司全称');
      return;
    }
    设认证中(true);
    // 原型环境：1.2 秒模拟人脸识别，通过后把结果落进全局再进招聘名片
    计时器.current = window.setTimeout(() => {
      派发({ 型: '存企业认证', 姓名: 姓名.trim(), 公司: 公司全称.trim() });
      轻提示('认证通过');
      跳转(路径.招聘名片);
    }, 1200);
  }

  return (
    <次级页外壳>
      <返回栏 返回={返回} />

      {/* 标注 21:59：说明小字删掉，标题自己说得清 */}
      <页面大标题 标题="实名认证" />

      <滚动区 样式覆盖={{ padding: '0 0 8px' }}>
        {/* ── 核验的两项就在这里填：真实姓名 + 营业执照公司全称（BOSS 截图 1/2 对照）── */}
        <div className={样式.表单区}>
          <div className={样式.编辑条目}>
            <div className={样式.条目标签}>真实姓名</div>
            <input
              className={样式.条目输入}
              value={姓名}
              placeholder="与证件一致，向候选人实名示人"
              onChange={(事件) => 设姓名(事件.target.value)}
            />
          </div>

          <div className={样式.编辑条目}>
            <div className={样式.条目标签}>任职公司（营业执照全称）</div>
            <button
              type="button"
              className={`${样式.条目输入} 可点`}
              style={{ textAlign: 'left', cursor: 'pointer' }}
              onClick={() => 设抽屉开(true)}
            >
              {公司全称 || '请选择公司'}
            </button>
          </div>

          <div className={样式.注意事项}>
            {公司注意事项.map((行, 序) => (
              <div key={行} className={样式.注意行}>
                {序 + 1}. {行}
              </div>
            ))}
          </div>
        </div>

        {/* ── 居中人脸识别占位：外圈虚线旋转 ── */}
        <div className={样式.识别区}>
          <div className={`${样式.识别圈} ${认证中 ? 样式.认证中 : ''}`}>
            <svg className={样式.虚线环} viewBox="0 0 140 140" aria-hidden="true">
              <circle
                className={样式.环线}
                cx="70"
                cy="70"
                r="68.5"
                fill="none"
                strokeWidth="1.6"
                strokeDasharray="4.5 7.5"
                strokeLinecap="round"
              />
            </svg>
            <span className={样式.脸底}>
              <人脸占位 />
            </span>
          </div>
          <div className={样式.识别注}>人脸识别将核对上面两项</div>
        </div>
      </滚动区>

      <主按钮
        文字={认证中 ? '认证中…' : '开始人脸识别'}
        禁用={认证中}
        按下={开始识别}
      />

      {抽屉开 ? (
        <公司选择抽屉接线
          查询={查询}
          选中键={选中键}
          选定={选定公司}
          关闭={关闭抽屉}
          添加={(名称) => void 添加公司(名称)}
        />
      ) : null}
    </次级页外壳>
  );
}

/**
 * 简单人脸线性 SVG：头 + 双眼 + 微笑 + 肩线。
 * 图标.tsx 里没有人脸形状，按硬性要求就地内联，描边色走 module.css 变量。
 */
function 人脸占位() {
  return (
    <svg
      width={56}
      height={56}
      viewBox="0 0 64 64"
      fill="none"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={样式.人脸线}
      aria-hidden="true"
    >
      {/* 头 */}
      <circle cx="32" cy="27" r="15" />
      {/* 双眼 */}
      <path d="M26.4 24.6v3.2" />
      <path d="M37.6 24.6v3.2" />
      {/* 微笑 */}
      <path d="M26.8 33.4c1.5 1.8 8.9 1.8 10.4 0" />
      {/* 肩线 */}
      <path d="M14.5 57c3.3-6.6 10-10.4 17.5-10.4s14.2 3.8 17.5 10.4" />
    </svg>
  );
}
