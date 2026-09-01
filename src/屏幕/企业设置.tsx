// 企业设置 —— 企业「我的」右上齿轮进来。与求职端设置同款版式
// （样式复用 我的功能页.module.css），分组：账号 / 代理与接触 / 关于。

import { useEffect, useState } from 'react';
import 样式 from './我的功能页.module.css';
import { 次级页外壳, 返回栏, 滚动区 } from '../组件/通用';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import 弹层框架 from '../组件/弹层框架';
import { use应用状态 } from '../状态/应用状态';
import { 取企业认证状态文案 } from '../数据/组织映射';

export default function 企业设置() {
  const { 返回, 跳转, 替换跳转 } = use导航();
  const { 数据源模式, 状态, 操作 } = use应用状态();
  const [提示, 设提示] = useState<string | null>(null);
  const [待退出, 设待退出] = useState(false);
  // 「企业实名认证」行原来是写死的「已认证」——Backend 下不管有没有企业关系都这么显示。
  // 改成只读 affiliation/管理员申请 两类服务端事实；申请列表不进登录链，进屏读一次。
  // Mock 不走这套：Mock 有自己的认证流程（企业实名认证 的人脸原型 → 存企业认证 →
  // 轻提示『认证通过』），把 Backend 投影套到 Mock 上会让用户刚被告知认证通过、
  // 转头在设置里看见「未认证」。双分支口径与 企业我的 的 显示公司 一致。
  const 是后端 = 数据源模式 === 'backend';
  const [申请读取状态, 设申请读取状态] = useState<'读取中' | '成功' | '失败'>(
    是后端 ? '读取中' : '成功',
  );

  useEffect(() => {
    if (!提示) return;
    const 定时 = window.setTimeout(() => 设提示(null), 1600);
    return () => window.clearTimeout(定时);
  }, [提示]);

  useEffect(() => {
    if (!是后端) return;
    let active = true;
    void 操作.读取企业管理员申请().then(
      () => { if (active) 设申请读取状态('成功'); },
      () => { if (active) 设申请读取状态('失败'); },
    );
    return () => { active = false; };
  }, [是后端, 操作]);

  const 企业认证文案 = 是后端 ? 取后端认证文案() : 取Mock认证文案();

  /** Mock：认证事实就是 企业认证 fixture 本身（人脸原型走完会写进它）。 */
  function 取Mock认证文案(): string {
    return 状态.企业认证.公司.trim() !== '' ? '已认证' : '未认证';
  }

  /** Backend：读取未落定/失败时如实说「正在读取」「读取失败」，绝不退回乐观的「已认证」。
   *  唯一例外在**终态失败**这一支：current 已是 verified+active 时，投影的答案根本不
   *  依赖 requests（固定优先级里 current 就是决定性的一级），读申请失败不该盖掉这条
   *  本地权威事实。读取中不套这个例外 —— 那是个转瞬即逝的中间态，说「正在读取」不算撒谎，
   *  先把话说满反而会在读回来的结果推翻它时闪一下。 */
  function 取后端认证文案(): string {
    const 投影 = 取企业认证状态文案(
      状态.企业关系列表,
      状态.当前企业关系编号,
      状态.企业管理员申请列表,
    );
    if (申请读取状态 === '成功') return 投影;
    if (申请读取状态 === '读取中') return '正在读取';
    return 投影 === '已认证' ? 投影 : '读取失败';
  }


  return (
    <次级页外壳 白底>
      <返回栏 返回={返回} 标题="设置" />

      <滚动区 样式覆盖={{ padding: '14px 18px 24px' }}>
        <div className={样式.组标}>账号</div>
        <div className={样式.平铺组}>
          <div className={样式.行}>
            <span className={样式.行文字组}>
              <span className={样式.行标题}>企业实名认证</span>
            </span>
            <span className={样式.行值}>{企业认证文案}</span>
          </div>
          <button className={`${样式.行} 可点`} onClick={() => 跳转(路径.招聘名片)}>
            <span className={样式.行文字组}>
              <span className={样式.行标题}>招聘名片</span>
            </span>
            <span className={样式.尖括号}>›</span>
          </button>
          <button className={`${样式.行} 可点`} onClick={() => 跳转(路径.账号安全)}>
            <span className={样式.行文字组}>
              <span className={样式.行标题}>账号与安全</span>
            </span>
            <span className={样式.尖括号}>›</span>
          </button>
        </div>

        <div className={`${样式.组标} ${样式.组标间距}`}>代理与接触</div>
        <div className={样式.平铺组}>
          {/* 「允许代理自动发起接触」按标注 2026-08-24 删除 */}
          <button className={`${样式.行} 可点`} onClick={() => 跳转(路径.企业代理设置)}>
            <span className={样式.行文字组}>
              <span className={样式.行标题}>AI代理设置</span>
            </span>
            <span className={样式.尖括号}>›</span>
          </button>
          <button className={`${样式.行} 可点`} onClick={() => 跳转(路径.企业披露策略)}>
            <span className={样式.行文字组}>
              <span className={样式.行标题}>披露策略</span>
            </span>
            <span className={样式.尖括号}>›</span>
          </button>
        </div>


        {/* 关于组与求职端设置一比一，两端同一批外围页 */}
        <div className={`${样式.组标} ${样式.组标间距}`}>关于</div>
        <div className={样式.平铺组}>
          <button className={`${样式.行} 可点`} onClick={() => 跳转(路径.帮助与客服)}>
            <span className={样式.行文字组}>
              <span className={样式.行标题}>帮助与客服</span>
            </span>
            <span className={样式.尖括号}>›</span>
          </button>
          <button className={`${样式.行} 可点`} onClick={() => 跳转(路径.反馈)}>
            <span className={样式.行文字组}>
              <span className={样式.行标题}>反馈与举报</span>
            </span>
            <span className={样式.尖括号}>›</span>
          </button>
          <button className={`${样式.行} 可点`} onClick={() => 跳转(路径.用户协议)}>
            <span className={样式.行文字组}>
              <span className={样式.行标题}>用户协议与隐私政策</span>
            </span>
            <span className={样式.尖括号}>›</span>
          </button>
          <div className={样式.行}>
            <span className={样式.行文字组}>
              <span className={样式.行标题}>当前版本</span>
            </span>
            <span className={样式.行值}>0.9.0（原型）</span>
          </div>
        </div>

        <button className={`${样式.危险键} 可点`} onClick={() => 设待退出(true)}>
          退出登录
        </button>
      </滚动区>

      {待退出 ? (
        <弹层框架 标签="退出企业账号" 遮罩类名={样式.遮罩} 面板类名={样式.确认框} 位置="居中" 关闭={() => 设待退出(false)}>
            <div className={样式.确认标题}>退出当前账号？</div>
            <div className={样式.确认正文}>
              退出后代理仍会按既有规则继续寻访，但你收不到需要拍板的提醒。
            </div>
            <div className={样式.确认键行}>
              <button className={`${样式.确认取消} 可点`} onClick={() => 设待退出(false)}>
                取消
              </button>
              <button
                className={`${样式.确认执行} 可点`}
                /* 与求职端 设置.tsx 同一处修复：<dialog open> 是非模态的，确认层开着时
                   页面上那枚同样写着「退出登录」的触发键仍在可访问树里，读屏用户分不开。
                   只改可访问名称，不动可见文案。「确认」前缀是为了避开遮罩键
                   「关闭退出企业账号」（组件/弹层框架.tsx:61 的 `关闭${标签}`）——
                   不加前缀就成了遮罩名的子串，子串匹配的定位器会同时命中两枚。 */
                aria-label="确认退出企业账号"
                onClick={async () => {
                  try {
                    await 操作.退出登录();
                    替换跳转(路径.登录);
                  } catch {
                    设待退出(false);
                  }
                }}
              >
                退出登录
              </button>
            </div>
        </弹层框架>
      ) : null}

      {提示 ? <div className={样式.浮层提示}>{提示}</div> : null}
    </次级页外壳>
  );
}
