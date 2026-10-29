# 在线1V1二维码交付状态

2026-10-29：房间专属PNG/SVG二维码功能已实现，并在本地真实HTTP/WebSocket联调中下载、独立解码验证。学生二维码指向具体 `/join/房间ID`，没有教师凭证；教师页面可复制和下载。

**公网后端尚未部署成功，故本轮未生成冒充正式在线入口的首页PNG/SVG。** 根目录已有 `qrcode.png`、`qrcode.svg`、`QR_CODE_README.md` 是上一版单人Pages试玩的交付物，不代表当前在线1V1验收。

后续Render实际部署后，执行 `npm run check:online -- <真实HTTPS网址>`。只有 `verification/online-live.json` 核验通过，才执行 `node scripts/publish-online-qr.mjs`，生成 `online-entry-qrcode.png`、`online-entry-qrcode.svg` 并覆盖本说明为真实地址、生成时间和验证结果。

本地联调中的二维码不作为学生公网访问入口。没有实体手机扫描或中国大陆跨设备网络实测结论。最终目标与待办见 `online-deployment.json`。
