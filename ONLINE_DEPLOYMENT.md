# 在线1V1部署记录与步骤

更新日期：2026-10-29（Asia/Shanghai）。本地服务已完成，公网后端正在推进。**旧GitHub Pages只运行原单人版，没有在线后端；旧二维码不等于在线版入口。**

## 已具备

- 原仓库 `https://github.com/lizekun250/lizekun250-math-arena`，不改公开属性，不强推。
- Node.js 24 / Express / Socket.IO / SQLite；一个进程同时提供网页、HTTP API、实时连接，无外部CDN或客户端密钥。
- `.env.example`、`Dockerfile`、`render.yaml`、`deploy/nginx.conf.example`。
- 本地真实HTTP/WebSocket三独立会话流程通过。`verification/online-local.json` 是本机网络检查，不是公网或跨设备证明。
- 用户已确认完成Render安装和授权，插件安装状态已确认；当前回合尚未加载部署接口，正在尝试可用的官方部署路径。

## 公网服务所需配置

`NODE_ENV=production`，`PUBLIC_BASE_URL` 为实际HTTPS源地址（不能含密钥、路径、查询或片段），`DATABASE_PATH` 指向私有可持久化卷。端口由 `PORT` 传入，默认3000。Render若提供 `RENDER_EXTERNAL_URL` 可自动作为源地址，避免提前编造域名。

教师权限与学生身份在服务器动态创建，无需把密码、Token或私钥粘贴聊天。凭证不能出现在静态HTML、Git、日志或房间二维码中。根目录与 `data/` 均不是静态文件目录，Git及Docker忽略数据库和真实环境文件。

## Render免费联调方案

使用公开仓库的 `render.yaml`，或创建Web Service：Node运行时；Build=`npm ci --omit=dev`；Start=`npm start`；Health Check=`/healthz`；计划选择**Free**，不要添加付费磁盘或升级。环境配置见上述文件，当前免费示例数据库在 `/tmp/math-arena.sqlite`。

免费Web Service可支持WebSocket和托管HTTPS，但空闲休眠可能需要约一分钟唤醒，重启、重新部署或休眠会丢失SQLite。免费层不提供持久化磁盘。因此只适合临时联调，不能承诺比赛记录跨实例重建保存。免费额度、外网流量与构建分钟数以账号官方页面为准，不承诺永久无条件免费。相关条件见 [Render免费层](https://render.com/docs/free)、[WebSocket支持](https://render.com/docs/websocket)。

## 正式单机/国内云部署

1. 用户选定云服务器与预算，在官方登录和Secret界面授权；域名、实名、必要备案及证书由用户具备相应管理条件后处理。未执行购买、收费开通或绑定支付方式。
2. 用Docker构建镜像，挂载 `/data`，配置实际 `PUBLIC_BASE_URL`。只启动一个副本，避免两个进程各自维护冲突的活动房间。
3. 通过Nginx等反向代理开放443，配置有效证书，转发Upgrade/Connection并关闭实时路由缓冲；示例见 `deploy/nginx.conf.example`。信任代理配置仅在单层可信代理改写客户端地址时打开。
4. 用真实HTTPS网址运行公网核验脚本，必须确认HTTP API、会话Cookie、WSS握手、双方同题、统一结算、重连和房间二维码均通过。
5. 教师与两名真实学生使用不同设备和网络，尤其大陆移动/联通/电信/校园网及微信内置浏览器，完成建赛、扫码、答题、断线重连、结束及再开。不能以本机或海外请求成功替代这些测试。
6. 通过公网核验后运行 `scripts/publish-online-qr.mjs`，保存新的在线首页PNG/SVG与验证记录。房间二维码自动使用实际服务源地址，不含管理凭证。更换域名必须更新环境、部署、重新核验并重新生成入口二维码。

大陆服务器及域名相关条件需按实际平台和地域核对。先前Pages在用户单次国内网络可以访问，只能证明静态试玩当时可达，不能证明新后端/WSS可达。先前Sites被国内直连拦截，不选其作为本次在线课堂后端。[腾讯云地域与备案说明](https://cloud.tencent.com/document/product/243/19630/)。

## 尚待实际验证

公网后端正式URL、上线后的HTTPS/WSS、Render实际资源状态、线上首页二维码、两设备/两网络对战、大陆直连及实体手机扫码。成功后将真实地址和验证记录追加于此，绝不以占位网址、localhost或旧单人地址替代。
