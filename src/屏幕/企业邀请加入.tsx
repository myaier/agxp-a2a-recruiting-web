// 企业邀请加入 · 输入管理员分享的邀请口令加入企业（P1C Task 3）。
// raw token 只存在于输入组件内存与 POST body：不进 URL / query / history state /
// reducer action / 日志 / 错误详情 / storage；提交完成、失败、离页、subject 变更即清空。
// 不做邀请创建 / 分享 / roster / 成员管理 —— 那是组织管理员侧的能力，不在本屏。

import { useEffect, useState } from 'react';
import 样式 from './企业邀请加入.module.css';
import { 次级页外壳, 返回栏, 页面大标题, 滚动区, 主按钮 } from '../组件/通用';
import { 轻提示 } from '../组件/轻提示';
import { use导航 } from '../路由/导航钩子';
import { use应用状态 } from '../状态/应用状态';
import { BFF错误, 取后端错误文案 } from '../数据/HTTP客户端';

/** not_found 统一文案；invitation_used 单独提示。两者都不回显 token 与服务端原始 message */
function 邀请错误文案(error: unknown): string {
  if (error instanceof BFF错误) {
    if (error.code === 'invitation_used') return '该邀请已被使用';
    if (error.status === 404 || error.code === 'not_found') return '邀请口令无效或已过期';
  }
  return 取后端错误文案(error);
}

export default function 企业邀请加入() {
  const { 返回 } = use导航();
  const { 操作, 后端状态 } = use应用状态();
  // 口令只放组件本地 state；任何派发动作都不携带它
  const [口令, 设口令] = useState('');
  const [错误, 设错误] = useState<string | null>(null);
  const [提交中, 设提交中] = useState(false);

  // subject 变更（换账号 / 重登录）即清空：上个主体键入的口令不能留在输入框里
  const 主体编号 = 后端状态.主体?.subject_id ?? null;
  useEffect(() => {
    设口令('');
    设错误(null);
  }, [主体编号]);

  const 接受 = async () => {
    const once = 口令;
    try {
      await 操作.接受企业邀请(once);
    } finally {
      设口令('');
    }
  };

  async function 按下加入() {
    if (口令.trim() === '') {
      设错误('请输入邀请口令');
      return;
    }
    设提交中(true);
    try {
      await 接受();
      设错误(null);
      轻提示('已加入企业');
    } catch (错误) {
      设错误(邀请错误文案(错误));
    } finally {
      设提交中(false);
    }
  }

  return (
    <次级页外壳>
      <返回栏 返回={返回} />

      <页面大标题 标题="加入企业" 说明="输入组织管理员分享的邀请口令" />

      <滚动区 样式覆盖={{ padding: '0 22px 8px' }}>
        <div className={样式.表单区}>
          <div className={样式.编辑条目}>
            <div className={样式.条目标签}>邀请口令</div>
            <input
              className={样式.条目输入}
              aria-label="邀请口令"
              type="text"
              autoComplete="off"
              value={口令}
              placeholder="粘贴收到的邀请口令"
              onChange={(事件) => 设口令(事件.target.value)}
            />
            {错误 ? (
              <div className={样式.错误行} role="alert">
                {错误}
              </div>
            ) : null}
          </div>

          <div className={样式.说明行}>
            口令由组织管理员在后台生成并分享。加入后你的任职关系与企业状态以服务端记录为准；
            多家有效任职时，发岗前需要在招聘名片里明确选择当前任职企业。
          </div>
        </div>
      </滚动区>

      <主按钮 文字="加入企业" 禁用={提交中} 按下={按下加入} />
    </次级页外壳>
  );
}
