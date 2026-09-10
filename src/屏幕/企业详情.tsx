// 企业详情（公司档案）—— 从职位详情 / 在谈详情的职位详情 Tab 点公司卡进来。
//
// 本文件只做连接：两条成功路径 return 同一个 企业公开页展示（Mock/Backend 共用一份
// JSX/CSS，页面结构与占位规则见 src/组件/企业公开页）。这里保留的是各自的数据归属：
//   Backend（P1C Task 5）：route param 仅当 opaque organization_id，进入即读 operation，
//     缓存 DTO 经 从BFF公开企业() 投影；不从静态公司档案回退，不补线上没有的字段。
//   Mock：按原 slug 读静态档、叠加企业端 公司自述 覆盖，并准备本地岗位组合与导航回调。
//
// 导航原型轻提示仍由外层负责，展示只触发函数；页面的 catch 只消费已派发的结果，
// 不在这里改写成功/失败状态，也不让 rejection 无人接。

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import 样式 from './企业详情.module.css';
import { 次级页外壳, 返回栏, 滚动区 } from '../组件/通用';
import { use导航 } from '../路由/导航钩子';
import { 路径 } from '../路由/路径表';
import 企业公开页展示 from '../组件/企业公开页/企业公开页展示';
import { 从BFF公开企业 } from '../数据/组织映射';
import { 从公开企业到展示, 从模拟企业到展示 } from '../数据/企业公开页展示映射';
import { 取公司档案, type 公司档案 } from '../数据/公司档案';
import type { 公司自述覆盖 } from '../数据/类型';
import { 市场列表 } from '../数据/模拟数据';
import { use应用状态 } from '../状态/应用状态';

export default function 企业详情() {
  const { id: 键 = '' } = useParams<{ id: string }>();
  const { 返回, 跳转 } = use导航();
  const { 状态, 操作, 数据源模式 } = use应用状态();
  const [提示, 设提示] = useState<string | null>(null);

  useEffect(() => {
    if (!提示) return;
    const 定时 = window.setTimeout(() => 设提示(null), 1700);
    return () => window.clearTimeout(定时);
  }, [提示]);

  // ── Backend：进入即读 operation；错误已由 operation 派发进 state ──
  useEffect(() => {
    if (数据源模式 === 'backend' && 键) {
      void 操作.读取公开企业(键).catch(() => undefined);
    }
  }, [数据源模式, 键, 操作]);

  // 业务回调只在外层创建：展示不拼路由、不弹提示
  const 原型导航 = () => 设提示('原型未接入地图，正式版会唤起系统导航');
  const 打开岗位 = (编号: string, 在谈: boolean) =>
    在谈 ? 跳转(路径.在谈详情(编号)) : 跳转(路径.职位详情(编号));

  if (数据源模式 === 'backend') {
    // 渲染只吃冻结的 公开企业视图；缓存未到（加载中/404/suspended）一律诚实空态，
    // 不从静态公司档案回退，也不补线上没有的字段。
    const 公开企业 = 状态.公开企业表[键];
    const view = 公开企业 ? 从BFF公开企业(公开企业) : null;
    return view ? (
      <企业公开页展示
        资料={从公开企业到展示(view)}
        返回={返回}
        导航={null}
        岗位={null}
        岗位层说明={null}
        条款层说明={null}
      />
    ) : (
      <企业公开页空态 />
    );
  }

  // ── Mock 分支：按原 slug 读静态档 ──
  const 静态档 = 取公司档案(键);
  // 企业端在「公司主页资料」里改过自述，这里要立刻是新的（同一份数据源）。
  // 只有本公司（yunqu，即当前登录企业）适用覆盖，别家公司仍读静态档。
  // 类型写成交集：覆盖里 2026-08-20 新增的分区（公司相册 / 产品介绍 / 团队介绍）
  // 静态档没有，写成三目的联合类型会让读这些键的地方全部编译不过。
  const 档: 公司档案 & Partial<公司自述覆盖> =
    状态.公司自述 && (键 === 'yunqu' || 键 === '云衢科技')
      ? { ...静态档, ...状态.公司自述 }
      : 静态档;

  // 该公司在本地数据里能点开的岗位：在谈单在前，市场岗在后（岗位列表能力 Mock 独有）
  const 在谈的 = 状态.在谈列表.filter((条) => 条.公司 === 档.名称);
  const 市场的 = 市场列表.filter((条) => 条.公司 === 档.名称);
  const 岗位 = [
    ...在谈的.map((条) => ({
      编号: 条.编号,
      职位: 条.职位,
      薪资: 条.薪资,
      在谈: true,
      打开: () => 打开岗位(条.编号, true),
    })),
    ...市场的.map((条) => ({
      编号: 条.编号,
      职位: 条.职位,
      薪资: 条.薪资,
      在谈: false,
      打开: () => 打开岗位(条.编号, false),
    })),
  ];

  return (
    <>
      <企业公开页展示
        资料={从模拟企业到展示(档)}
        返回={返回}
        导航={原型导航}
        岗位={岗位}
        岗位层说明={`其余 ${Math.max(0, 档.在招岗位数 - 岗位.length)} 个岗位不匹配你当前的求职意向，已被「只接受与意向匹配的接触」过滤掉，没有展开。`}
        条款层说明="想让代理去核某一条？在这一单的详情页底部对代理说一句，它会带进下一轮。"
      />
      {提示 ? <div className={样式.浮层提示}>{提示}</div> : null}
    </>
  );
}

/** Backend 空态：缓存未到（加载中）、不存在或已停用。不给静态回退，不编造内容。 */
function 企业公开页空态() {
  const { 返回 } = use导航();
  return (
    <次级页外壳>
      <返回栏 返回={返回} 标题="企业主页" />
      <滚动区 样式覆盖={{ paddingBottom: 12 }}>
        <div className={样式.正文区}>
          <div className={样式.卡}>
            <div className={样式.卡头}>
              <span className={样式.卡标题}>这家企业暂时打不开</span>
            </div>
            <div className={样式.卡正文}>企业不存在或已被停用，没有可展示的公开信息。</div>
          </div>
        </div>
      </滚动区>
    </次级页外壳>
  );
}
