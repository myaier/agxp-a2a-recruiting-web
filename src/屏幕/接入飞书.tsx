// 接入工作台 —— 注册流最后一屏（用户 2026-08-20：注册最后能绑飞书也能跳过；
// 之后还会支持其他渠道；有代理的用户也可以扫我的码把我的代理加进去，所以要能切换）。
//
// 两个接入口（用户 2026-08-20）：
//   「飞书」   = 扫码，把代理接到飞书里；
//   「我的 Agent」= 命令行，用户自己的 agent 执行这行就和这边的代理互通。
// 两端共用：求职端走完添加头像到这里，企业端发完第一个岗位到这里。

import { useState } from 'react';
import 样式 from './接入飞书.module.css';
import { 次级页外壳, 主按钮 } from '../组件/通用';
import 接入二维码 from '../组件/接入二维码';
import { 轻提示 } from '../组件/轻提示';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';


type 方式键 = '飞书' | '我的Agent';

/** 两种接入各自能做什么：写清楚才知道值不值得绑（用户 2026-08-20）*/
const 飞书能做 = [
  '需要你拍板时，在飞书里直接收到提醒',
  '在飞书里对它说话，随时改要求',
  '问一句进展，它把所有在谈的状态报给你',
];

const 自有能做 = [
  '你的 agent 与AI招聘代理直接对谈，不用人转述',
  '谈判进展与卡点同步回你自己的 agent',
  '在你的环境里下指令、改规则，这边即时生效',
];

/** 自己的 agent 接入用的命令行（原型固定串，真实产品下发一次性密钥）*/
const 接入命令 = 'agxp link ak_7f3c9e21';

export default function 接入飞书({ 企业端 = false }: { 企业端?: boolean }) {
  const { 进主壳, 进企业主壳 } = use导航();
  const { 状态, 派发 } = use应用状态();
  const [方式, 设方式] = useState<方式键>('飞书');

  const 已接入 = 企业端 ? 状态.企业飞书已接入 : 状态.飞书已接入;
  const 完成 = () => (企业端 ? 进企业主壳() : 进主壳());

  const 绑定 = () => {
    派发(企业端 ? { 型: '设企业飞书接入', 接入: true } : { 型: '设飞书接入', 接入: true });
    轻提示('已接入飞书');
    完成();
  };

  return (
    <次级页外壳>
      <div className={样式.页}>
        <h1 className={样式.标题}>把AI代理接到飞书</h1>
        <p className={样式.副题}>不用打开 App，在飞书里收提醒、下指令</p>


        {/* 方式切换：接入我的工作台 / 分享我的代理 */}
        <div className={样式.分段}>
          {(['飞书', '我的Agent'] as 方式键[]).map((键) => (
            <button
              key={键}
              className={`${样式.分段项} ${方式 === 键 ? 样式.分段项选中 : ''} 可点`}
              onClick={() => 设方式(键)}
            >
              {键 === '飞书' ? '飞书' : '我的 Agent'}
            </button>
          ))}
        </div>

        {方式 === '飞书' ? (
          <div className={样式.码卡}>
            <div className={样式.码框}>
              <接入二维码 边长={150} />
            </div>
            <div className={样式.码说明}>
              用飞书扫这张码，你的AI招聘代理就出现在飞书里
            </div>
          </div>
        ) : (
          <div className={样式.码卡}>
            {/* 自己的 agent 走命令行接入（用户 2026-08-20）：一行命令带接入密钥，
                在自己的 agent 环境里执行即可与这边的代理互通 */}
            <div className={样式.命令块}>
              <code className={样式.命令文}>{接入命令}</code>
              <button
                className={`${样式.复制键} 可点`}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(接入命令);
                    轻提示('命令已复制');
                  } catch {
                    轻提示('复制失败，长按手动复制');
                  }
                }}
              >
                复制
              </button>
            </div>
            <div className={样式.码说明}>
              在你自己的 agent 里执行这行，它就能和你的AI招聘代理直接对谈
            </div>
          </div>
        )}

        {/* 接入后能做什么（用户 2026-08-20：下面也写一下都能让用户干什么）*/}
        <div className={样式.能做列}>
          {(方式 === '飞书' ? 飞书能做 : 自有能做).map((条) => (
            <div key={条} className={样式.能做行}>
              <span className={样式.能做点} />
              <span className={样式.能做文}>{条}</span>
            </div>
          ))}
        </div>

        <div className={样式.撑开} />

        <主按钮
          文字={已接入 ? '已接入 · 继续' : '完成绑定'}
          按下={已接入 ? 完成 : 绑定}
        />

        <button className={`${样式.跳过} 可点`} onClick={完成}>
          暂时跳过
        </button>
      </div>
    </次级页外壳>
  );
}
