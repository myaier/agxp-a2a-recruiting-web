// 设置 —— 「我的」右上齿轮进来。
//
// 分三组：账号 / 隐私与可见性 / 关于。开关都接真状态（改了立刻生效、
// 返回再进来还在），跳转项通向已有的功能页，剩下少数没有独立屏的给浮层反馈。
// 「对现雇主隐身」关掉时给一次明确警示 —— 这是会让当前公司看到你的唯一开关。

import { useEffect, useState } from 'react';
import 样式 from './我的功能页.module.css';
import { 次级页外壳, 返回栏, 滚动区, 开关 } from '../组件/通用';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import { use应用状态 } from '../状态/应用状态';
import 弹层框架 from '../组件/弹层框架';

export default function 设置() {
  const { 返回, 跳转, 替换跳转 } = use导航();
  const { 状态, 派发, 操作 } = use应用状态();
  const [提示, 设提示] = useState<string | null>(null);
  const [待关隐身, 设待关隐身] = useState(false);
  const [待退出, 设待退出] = useState(false);

  useEffect(() => {
    if (!提示) return;
    const 定时 = window.setTimeout(() => 设提示(null), 1600);
    return () => window.clearTimeout(定时);
  }, [提示]);

  const 开关行 = (键: string) => (
    <div className={样式.行} key={键}>
      <span className={样式.行文字组}>
        <span className={样式.行标题}>{键}</span>
      </span>
      <开关
        开={状态.设置开关[键]}
        标签={键}
        切换={() => {
          // 隐身是唯一一个「关掉会让当前公司看到你」的开关，关之前必须确认
          if (键 === '对现雇主隐身' && 状态.设置开关[键]) {
            设待关隐身(true);
            return;
          }
          派发({ 型: '切设置开关', 键 });
        }}
      />
    </div>
  );

  return (
    <次级页外壳 白底>
      <返回栏 返回={返回} 标题="设置" />

      <滚动区 样式覆盖={{ padding: '14px 18px 24px' }}>
        <div className={样式.组标}>账号</div>
        <div className={样式.平铺组}>
          <div className={样式.行}>
            <span className={样式.行文字组}>
              <span className={样式.行标题}>手机号</span>
            </span>
            <span className={样式.行值}>138 **** 6021</span>
          </div>
          <button
            className={`${样式.行} 可点`}
            onClick={() => 设提示('实名认证 · 已通过，无需重复认证')}
          >
            <span className={样式.行文字组}>
              <span className={样式.行标题}>实名认证</span>
            </span>
            <span className={样式.行值}>已认证</span>
            <span className={样式.尖括号}>›</span>
          </button>
          <button className={`${样式.行} 可点`} onClick={() => 跳转(路径.账号安全)}>
            <span className={样式.行文字组}>
              <span className={样式.行标题}>账号与安全</span>
            </span>
            <span className={样式.尖括号}>›</span>
          </button>
        </div>

        <div className={`${样式.组标} ${样式.组标间距}`}>隐私与可见性</div>
        <div className={样式.平铺组}>
          {开关行('对现雇主隐身')}
          <button className={`${样式.行} 可点`} onClick={() => 跳转(路径.披露偏好)}>
            <span className={样式.行文字组}>
              <span className={样式.行标题}>披露偏好</span>
            </span>
            <span className={样式.尖括号}>›</span>
          </button>
          <button className={`${样式.行} 可点`} onClick={() => 跳转(路径.屏蔽名单)}>
            <span className={样式.行文字组}>
              <span className={样式.行标题}>屏蔽名单</span>
            </span>
            <span className={样式.尖括号}>›</span>
          </button>
          <button className={`${样式.行} 可点`} onClick={() => 跳转(路径.接触记录)}>
            <span className={样式.行文字组}>
              <span className={样式.行标题}>谁接触过我</span>
            </span>
            <span className={样式.尖括号}>›</span>
          </button>
        </div>



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

        <div className={样式.版本}>
          AGXP A2A 招聘原型 · 前端 0.9.0
          <br />
          人力资源服务许可证 · 算法举报 · 资质证照
        </div>
      </滚动区>

      {待关隐身 ? (
        <弹层框架 标签="关闭对现雇主隐身" 遮罩类名={样式.遮罩} 面板类名={样式.确认框} 关闭={() => 设待关隐身(false)}>
            <div className={样式.确认标题}>关闭「对现雇主隐身」？</div>
            <div className={样式.确认正文}>
              关闭后，你当前公司及其关联公司可以在平台上看到你的匿名画像，也可能主动发起接触。
              保密求职期间建议保持开启。
            </div>
            <div className={样式.确认键行}>
              <button className={`${样式.确认取消} 可点`} onClick={() => 设待关隐身(false)}>
                保持开启
              </button>
              <button
                className={`${样式.确认执行} 可点`}
                onClick={() => {
                  派发({ 型: '切设置开关', 键: '对现雇主隐身' });
                  设待关隐身(false);
                  设提示('隐身已关闭');
                }}
              >
                仍要关闭
              </button>
            </div>
        </弹层框架>
      ) : null}

      {待退出 ? (
        <弹层框架 标签="退出当前账号" 遮罩类名={样式.遮罩} 面板类名={样式.确认框} 关闭={() => 设待退出(false)}>
            <div className={样式.确认标题}>退出当前账号？</div>
            <div className={样式.确认正文}>
              退出后代理仍会按既有规则继续匹配和初筛，但你收不到需要确认的提醒。
            </div>
            <div className={样式.确认键行}>
              <button className={`${样式.确认取消} 可点`} onClick={() => 设待退出(false)}>
                取消
              </button>
              <button
                className={`${样式.确认执行} 可点`}
                onClick={async () => {
                  try {
                    await 操作.退出登录();
                    替换跳转(路径.登录);
                  } catch {
                    // 退出失败：保留弹层，用户可重试或取消（不改弹层 DOM/CSS）
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
