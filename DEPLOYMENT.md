# 部署条件、实际状态与中国大陆访问

核查日期：2026-10-28（Asia/Shanghai）。

## 最终入口与实际访问

**实际交付游戏：https://lizekun250.github.io/lizekun250-math-arena/** 。GitHub Pages发布任务已成功，未登录HTTPS检查返回200与游戏HTML。用户反馈“国内直连能打开并开始答题”。二维码、海报及页面教师分享入口均已重新生成并指向此地址。

这个反馈验证了用户本次网络可以使用，未提供设备、浏览器、运营商，也没有验证长期稳定性或全国可达性。Pages仍可能在其他大陆网络波动，不能宣称已达到正式国内部署的稳定服务标准。实体手机扫码和微信内置浏览器尚未测试。

## 先前Sites尝试（不作为最终入口）

- 平台：Sites；静态 HTML，无构建运行时、数据库、付费云资源或新购域名。
- 先前测试地址：<https://math-arena-trial.lizekun250.chatgpt.site>，不是最终交付二维码目标。
- 平台返回 `succeeded`，站点访问权限 `public`，`requires_byop=false`。游戏本身无登录。
- 当前网络的未登录HTTP检查得到**Cloudflare 403 / Sorry, you have been blocked**；用户明确反馈国内网络无法访问、需要VPN，因此不适合当前课堂直连。
- 未验证中国大陆电信、联通、移动或校园网的稳定性；现有工作环境网络出口不作为大陆直连证据。
- Sites尝试的记录保留在verification/sites-deployment.json以供排查；旧二维码已被最终Pages二维码替换。若学校网络无法打开Pages，应使用离线HTML或后续国内静态托管。不要转发旧测试入口。

## 方案比较

| 方案 | 静态 HTML 与 HTTPS | 前置条件、费用与复杂度 | 本项目结论 |
|---|---|---|---|
| GitHub Pages | 可直接发布 index.html；支持 HTTPS | 公共仓库可用 GitHub Free；有用量限制，可用默认 github.io 子域，不必购买域名；需启用 Pages，复杂度低 | 本次最终演示入口；平台发布成功、未登录HTTP200、用户国内直连能开始答题。其他运营商与长期稳定性未测。 |
| 腾讯云 COS / 静态网站托管 | 可上传原生静态文件；可配置 HTTPS | 需要云账号与相应实名；域名、内地地域备案和证书按官方要求办理；存储、请求、流量可能计费，新用户免费额度不是所有费用全免；操作复杂度中等 | 条件齐备后更适合面向大陆课堂的正式版本；当前无账号授权、域名或备案，未开通。 |
| 阿里云 OSS 静态网站 | 直接上传 index.html；自定义域名配置 HTTPS | 需要云账号、域名、证书；内地地域自定义域名需 ICP 备案；默认桶域名可能触发下载，不能当可直接浏览的游戏入口；存储、请求、外网流量均可能计费 | 可作为正式静态托管，不需要为本试玩增加后端；当前未开通。 |
| Sites 先前演示 | 已成功发布静态文件到平台提供的 HTTPS 地址 | 使用现有连接能力，没有执行购买、绑卡、升级或开通收费产品；平台后续政策和额度以账号界面为准，不作永久免费承诺 | 已部署，但HTTP被拦截、用户大陆直连失败，不再作为最终分享入口。 |

以上大陆网络稳定性结论是部署工程判断，并非云商的全国可用性保证。ICP备案等条件随服务地域与产品而异，正式开通前以平台控制台和主管部门最新要求为准。

## 免费额度与费用核查

GitHub Pages 的公共仓库免费资格见 [GitHub 官方说明](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages)，软用量限制见 [Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)，HTTPS 见 [GitHub 官方公告](https://github.blog/news-insights/product-news/github-pages-custom-domains-https/)。未把 Pages 当作大陆稳定访问方案。

腾讯 COS 当前文档列出个人新用户 50GB 标准存储容量、6 个月免费包；范围只抵扣相应存储项，流量和请求等需另外核对。[免费额度](https://cloud.tencent.com/document/product/436/6240)、[计费概述](https://intl.cloud.tencent.com/zh/document/product/436/16871)。腾讯静态托管的[产品页面](https://cloud.tencent.cn/product/wh)还介绍新用户试用和默认域名/HTTPS；实际资格不能替用户假定。

阿里 OSS 为按量计费，基本项含存储、请求、外网传输，新客免费层并不等于完全免费。[官方计费说明](https://www.alibabacloud.com/help/en/oss/billing-overview)。本次没有开启任何这些云资源，没有购买域名或承担收费承诺。

内地与境外地域备案区别见 [腾讯云是否需要备案](https://cloud.tencent.com/document/product/243/19630/)。OSS 自定义域名、浏览器预览和内地 ICP 条件见 [阿里云官方文档](https://www.alibabacloud.com/help/en/oss/user-guide/access-buckets-via-custom-domain-names)、[静态网站托管](https://www.alibabacloud.com/help/en/oss/user-guide/hosting-static-websites)。

## 正式大陆部署最少步骤（尚未执行）

1. 用户决定云平台、地域与预算，在官方界面完成实名；如使用已有学校域名，先确认域名管理权、主体、备案及接入条件。无需把任何密码、Token、私钥发送到聊天或写入前端。
2. 按所选平台要求完成域名和必要备案。涉及购买、开通计费或修改访问属性时，先取得明确授权。
3. 上传 `dist/` 静态文件，首页设为 `index.html`，绑定域名，配置有效 HTTPS 证书及 DNS。不要把默认桶的强制下载链接当作游戏网址。
4. 在普通手机浏览器、微信内置浏览器、校园网及大陆不同运营商检查：首页→答题→解析→结算→再开，确认无登录门槛。
5. 新网址成功部署并实际可访问后，更新 `deployment.json`，运行 `node scripts/qrcode.mjs <真实HTTPS地址>`、`npm run build`、`npm test`，发布新文件。重新解码 PNG/SVG/海报，更新 README 与所有分享入口，再用实体手机扫码。

## Git 及 GitHub

用户创建的实际仓库名为 `lizekun250/lizekun250-math-arena`，与原计划的 math-arena 名称略有不同。本次按用户新建的空公开仓库发布，不更名、不修改公开属性，也不触碰其他物理实验仓库。

本地仓库初始化于Mathlab、分支main；Sites源码托管与GitHub代码托管分别管理，采用正常追加提交，不强制推送。GitHub连接器已确认对新仓库有admin/push权限。本地未配置GitHub CLI登录，故通过已连接GitHub API发布，不要求用户粘贴密钥。用户已设置Pages发布来源为main分支根目录，已创建.nojekyll；不需要Actions密钥、构建框架或额外后端。

本地已添加origin指向该GitHub仓库。但当前网络下git fetch访问github.com:443失败，API连接器发布与Pages访问正常；因此本地main的Sites提交历史与GitHub的API提交历史分别保留，没有执行重置或强推。后续使用命令行维护时，最简单的方式是在网络及官方登录就绪后新clone GitHub仓库再修改；若继续用原工作目录，先fetch并合并远程历史，再正常push，勿force覆盖。

最终线上6文件的HTTP200、SHA-256与二维码解码结果见verification/live-validation.json；完整交付源码和验证文件已发布到上述公开仓库。没有购买或开通国内付费服务，正式国内域名/备案部署尚未完成。
