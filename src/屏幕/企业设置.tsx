// 企业设置 —— 企业「我的」右上齿轮进来。与求职端设置同款版式
// （样式复用 我的功能页.module.css），分组：账号 / 代理与接触 / 通知 / 关于。
// 「允许代理自动发起接触」关掉时给一次明确说明 —— 这是影响寻访节奏的关键开关。

import { useEffect, useState } from 'react';
import 样式 from './我的功能页.module.css';
import { 次级页外壳, 返回栏, 滚动区, 开关 } from '../组件/通用';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { use应用状态 } from '../状态/应用状态';

export default function 企业设置() {
  const { 返回, 跳转, 替换跳转 } = use导航();
  const { 状态, 派发 } = use应用状态();
  const [提示, 设提示] = useState<string | null>(null);
  const [待退出, 设待退出] = useState(false);

  useEffect(() => {
    if (!提示) return;
    const 定时 = window.setTimeout(() => 设提示(null), 1600);
    return () => window.clearTimeout(定时);
  }, [提示]);

  const 开关行 = (键: string, 说明: string) => (
    <div className={样式.行} key={键}>
      <span className={样式.行文字组}>
        <span className={样式.行标题}>{键}</span>
        <span className={样式.行说明}>{说明}</span>
      </span>
      <开关 开={状态.企业设置开关[键]} 切换={() => 派发({ 型: '企业切设置开关', 键 })} />
    </div>
  );

  return (
    <次级页外壳>
      <返回栏 返回={返回} 标题="设置" />

      <滚动区 样式覆盖={{ padding: '14px 18px 24px' }}>
        <div className={样式.组标}>账号</div>
        <div className={样式.卡}>
          <div className={样式.行}>
            <span className={样式.行文字组}>
              <span className={样式.行标题}>企业实名认证</span>
              <span className={样式.行说明}>{状态.企业认证.公司} · 已通过工商核验</span>
            </span>
            <span className={样式.行值}>已认证</span>
          </div>
          <button className={`${样式.行} 可点`} onClick={() => 跳转(路径.招聘名片)}>
            <span className={样式.行文字组}>
              <span className={样式.行标题}>招聘名片</span>
              <span className={样式.行说明}>候选人从第一轮起就看得到这张名片</span>
            </span>
            <span className={样式.尖括号}>›</span>
          </button>
          <button className={`${样式.行} 可点`} onClick={() => 跳转(路径.账号安全)}>
            <span className={样式.行文字组}>
              <span className={样式.行标题}>账号与安全</span>
              <span className={样式.行说明}>换绑手机号、注销账号</span>
            </span>
            <span className={样式.尖括号}>›</span>
          </button>
          <button
            className={`${样式.行} 可点`}
            onClick={() => {
              // 与求职端设置对称：派发重置落地 Tab（「职位」）再切端
              派发({ 型: '切身份', 到: '求职者' });
              替换跳转(路径.主壳);
            }}
          >
            <span className={样式.行文字组}>
              <span className={样式.行标题}>切换到求职者身份</span>
              <span className={样式.行说明}>两侧数据完全隔离，同一手机号不会互相暴露</span>
            </span>
            <span className={样式.尖括号}>›</span>
          </button>
        </div>

        <div className={`${样式.组标} ${样式.组标间距}`}>代理与接触</div>
        <div className={样式.卡}>
          {开关行('允许代理自动发起接触', '关闭后代理只筛不聊，每次接触前先来问你')}
          <button className={`${样式.行} 可点`} onClick={() => 跳转(路径.企业代理设置)}>
            <span className={样式.行文字组}>
              <span className={样式.行标题}>AI代理设置</span>
              <span className={样式.行说明}>寻访规则、放宽边界、接触额度</span>
            </span>
            <span className={样式.尖括号}>›</span>
          </button>
          <button className={`${样式.行} 可点`} onClick={() => 跳转(路径.企业披露策略)}>
            <span className={样式.行文字组}>
              <span className={样式.行标题}>披露策略</span>
              <span className={样式.行说明}>逐项决定代理在什么时机交出岗位与团队细节</span>
            </span>
            <span className={样式.尖括号}>›</span>
          </button>
        </div>

        <div className={`${样式.组标} ${样式.组标间距}`}>通知</div>
        <div className={样式.卡}>
          {开关行('需要拍板时推送提醒', '代理谈到需要你拍板的分歧时才打扰你')}
          {开关行('有新候选时推送提醒', '匹配到高分候选时提醒')}
          {开关行('每日人才简报推送', '每天 09:00 汇总昨日全部寻访进展')}
        </div>

        <div className={`${样式.组标} ${样式.组标间距}`}>通用</div>
        <div className={样式.卡}>
          {开关行('允许平台用岗位数据改进匹配', '仅用于匹配算法，不会披露给候选人之外的第三方')}
        </div>

        {/* 关于组与求职端设置一比一，两端同一批外围页 */}
        <div className={`${样式.组标} ${样式.组标间距}`}>关于</div>
        <div className={样式.卡}>
          <button className={`${样式.行} 可点`} onClick={() => 跳转(路径.帮助与客服)}>
            <span className={样式.行文字组}>
              <span className={样式.行标题}>帮助与客服</span>
            </span>
            <span className={样式.尖括号}>›</span>
          </button>
          <button className={`${样式.行} 可点`} onClick={() => 跳转(路径.反馈)}>
            <span className={样式.行文字组}>
              <span className={样式.行标题}>反馈与举报</span>
              <span className={样式.行说明}>功能异常、体验建议、举报违规</span>
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
        <div className={样式.遮罩} onClick={() => 设待退出(false)}>
          <div className={样式.确认框} onClick={(事件) => 事件.stopPropagation()}>
            <div className={样式.确认标题}>退出当前账号？</div>
            <div className={样式.确认正文}>
              退出后代理仍会按既有规则继续寻访，但你收不到需要拍板的提醒。
            </div>
            <div className={样式.确认键行}>
              <button className={`${样式.确认取消} 可点`} onClick={() => 设待退出(false)}>
                取消
              </button>
              <button className={`${样式.确认执行} 可点`} onClick={() => 替换跳转(路径.登录)}>
                退出登录
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {提示 ? <div className={样式.浮层提示}>{提示}</div> : null}
    </次级页外壳>
  );
}
