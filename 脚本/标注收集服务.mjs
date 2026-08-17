// 标注收集服务：接收原型「标注模式」直接推送的修改意见，落到本地 JSONL，
// Claude 在会话里 tail 这个文件实时开改 —— 用户点「记下这条」即送达，无需复制粘贴。
//
// 只在开发者本机跑（node 脚本/标注收集服务.mjs），零依赖。
// 手机需与本机同 Wi-Fi，用局域网地址打开原型（http://<Mac IP>:8083）。

import { createServer } from 'node:http';
import { appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const 端口 = 8090;
const 收件箱 = join(dirname(fileURLToPath(import.meta.url)), '..', '标注收件箱.jsonl');

const 服务 = createServer((请求, 响应) => {
  // CORS 全开：请求只来自本机/局域网的原型页面，收的又只是文本意见，风险面可接受
  响应.setHeader('Access-Control-Allow-Origin', '*');
  响应.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  响应.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (请求.method === 'OPTIONS') {
    响应.writeHead(204);
    响应.end();
    return;
  }

  if (请求.method === 'GET') {
    响应.writeHead(200, { 'Content-Type': 'application/json' });
    响应.end('{"ok":true}');
    return;
  }

  if (请求.method === 'POST') {
    let 体 = '';
    请求.on('data', (块) => {
      体 += 块;
      if (体.length > 64 * 1024) 请求.destroy(); // 意见不该超 64KB
    });
    请求.on('end', () => {
      try {
        const 标注 = JSON.parse(体);
        // 一行一条 JSON，附收到时间；tail -F 消费
        appendFileSync(收件箱, JSON.stringify({ 收到于: new Date().toISOString(), ...标注 }) + '\n');
        console.log(`[收到标注] ${标注.位置 ?? '?'} — ${标注.意见 ?? ''}`);
        响应.writeHead(200, { 'Content-Type': 'application/json' });
        响应.end('{"ok":true}');
      } catch {
        响应.writeHead(400);
        响应.end('{"ok":false}');
      }
    });
    return;
  }

  响应.writeHead(405);
  响应.end();
});

服务.listen(端口, '0.0.0.0', () => {
  console.log(`标注收集服务已启动 :${端口} → ${收件箱}`);
});
