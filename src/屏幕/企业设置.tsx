// 企业设置 —— 企业「我的」右上齿轮进来。与求职端设置同款版式
// （样式复用 我的功能页.module.css），分组：账号 / 代理与接触 / 关于。

import { useEffect, useState } from 'react';
import 样式 from './我的功能页.module.css';
import { 次级页外壳, 返回栏, 滚动区 } from '../组件/通用';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import 弹层框架 from '../组件/弹层框架';
import { use应用状态 } from '../状态/应用状态';

export default function 企业设置() {
  const { 返回, 跳转, 替换跳转 } = use导航();
  const { 操作 } = use应用状态();
  const [提示, 设提示] = useState<string | null>(null);
  const [待退出, 设待退出] = useState(false);

  useEffect(() => {
    if (!提示) return;
    const 定时 = window.setTimeout(() => 设提示(null), 1600);
    return () => window.clearTimeout(定时);
  }, [提示]);


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
            <span className={样式.行值}>已认证</span>
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
