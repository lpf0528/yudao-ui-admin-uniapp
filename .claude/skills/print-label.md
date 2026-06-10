# Skill: 标签打印实现（print-label）

## 概述

`src/pages-curtain/product-inbound/print-label/index.vue` 实现了跨平台标签打印功能，核心链路为：**Canvas 手绘标签 → 图片转换 → 平台分支输出**。

---

## 标签绘制（drawLabel）

- 使用 `uni.createCanvasContext` 在 300×480px 离屏 Canvas 上绘制
- **二维码**：`qrcode-generator` 计算模块矩阵，逐格 `ctx.fillRect` 画黑块，避免跨端 `<img>` 兼容问题
- **文字**：`ctx.fillText` 逐行写死坐标；`splitLines()` 按 CJK=2单位/ASCII=1单位 手动折行（无跨端 `measureText`）
- `ctx.draw(false, callback)` 异步提交，完成后 `drawn = true` 解锁打印/保存按钮

---

## APP 端打印（`// #ifdef APP-PLUS`）

**链路：Canvas → 临时 PNG → Base64 → 商米 SDK**

| 步骤 | 实现 |
|---|---|
| Canvas 导出 | `uni.canvasToTempFilePath`，目标 384×614px（对齐 58mm/203DPI 打印宽度） |
| 文件转 Base64 | `plus.io.resolveLocalFileSystemURL` + `plus.io.FileReader.readAsDataURL` |
| 打印机初始化 | `PrinterSdk.initPrinter`，5s 超时；`printerReady` 标志位复用已就绪连接 |
| 发送打印 | `LineApi.initLine` → `LineApi.printBitmap(base64, ...)` → `LineApi.autoOut` 走纸 |

使用 `LineApi`（小票模式）传整张位图，Canvas 负责排版，SDK 只管输出。

---

## H5 端打印（`// #ifdef H5`）

- 调用 `window.print()`
- `@media print` CSS 隐藏导航栏与操作栏，只保留 Canvas 区域

---

## 保存图片（全平台兜底）

`canvasToTempFilePath`（3× 分辨率）→ `uni.saveImageToPhotosAlbum`

---

## 关键设计决策

- 不用 `<img>` 展示二维码：Canvas 手绘避免跨端 base64 渲染差异
- 选 `LineApi` 而非 `CanvasApi`：排版已在 Canvas 完成，打印层只传图
- `printerReady` 复用连接：商米 SDK 初始化耗时，异常时重置标志位重连
- 页面参数通过 `uni.navigateTo` URL query 传入，`onMounted` 读取 `$page.options` 解码
