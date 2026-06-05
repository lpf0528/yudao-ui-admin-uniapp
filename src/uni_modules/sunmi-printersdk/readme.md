以下是为您整理好的 Markdown 格式文档：

# Sunmi 打印机 SDK 插件文档

## 插件介绍

本插件用于 **UniApp** 及 **UniApp-x** 环境下，开发针对 Sunmi V2sPlus、V3 等 Android 设备的打印功能。

---

## 插件使用

### 1. 引入插件

在页面的 `script` 标签中引入所需的 API 模块：

```javascript
import { PrinterSdk } from "@/uni_modules/sunmi-printersdk";
import { LineApi } from "@/uni_modules/sunmi-printersdk";
import { CanvasApi } from "@/uni_modules/sunmi-printersdk";
import { CommandApi } from "@/uni_modules/sunmi-printersdk";

```

### 2. 初始化与资源释放 (`PrinterSdk`)

建议在页面的生命周期函数中进行打印服务的初始化和资源释放。

```javascript
export default {
    data() {
        return {
            printerReady: false // 标记打印机是否就绪
        };
    },
    onLoad() {
        // 初始化打印机服务
        PrinterSdk.initPrinter((success, message) => {
            if (success) {
                console.log("打印机初始化成功:", message);
                // 可以在这里执行成功后的操作
                this.printerReady = true;
            } else {
                console.error("打印机初始化失败:", message);
                // 可以在这里执行失败后的操作
                this.printerReady = false;
            }
        });
    },
    onUnload() {
        // 退出页面时反初始化 SDK，释放资源，防止内存泄漏
        PrinterSdk.destroy();
        this.printerReady = false;
        console.log("打印机 SDK 已销毁");
    }
}
```

---

## 3. LineApi（行式打印）

**LineApi** 提供「按行」组版并打印的能力，适合小票、流水单等逐行输出的场景。使用前需先调用 `initLine(baseStyle)` 设置画布基础样式，然后依次调用各类 `print*` 方法往当前「行」里追加内容，最后通过 **事务模式** 或 **自动出纸** 输出。

### 3.1 事务模式（推荐）

先开启事务、组版多行，再一次性提交打印，减少多次走纸。

```javascript
import { LineApi } from "@/uni_modules/sunmi-printersdk";
import { BaseStyleBuilder, Align } from "@/uni_modules/sunmi-printersdk/utssdk/interface.uts";
import { TextStyleBuilder, FontStyle } from "@/uni_modules/sunmi-printersdk/utssdk/interface.uts";

// 1. 开启事务模式
LineApi.enableTransMode(true);

// 2. 初始化行样式（画布宽度、对齐等）
const baseStyle = BaseStyleBuilder.create()
    .align(Align.CENTER)
    .width(384)
    .height(0)
    .build();
LineApi.initLine(baseStyle);

// 3. 添加要打印的内容（可多次调用）
const textStyle = TextStyleBuilder.create()
    .align(Align.LEFT)
    .fontStyle(FontStyle.NORMAL)
    .textSize(24)
    .build();
LineApi.printText("订单号：202502100001", textStyle);
LineApi.addText("  |  金额：￥99.00", textStyle);
LineApi.printDividingLine(1, 2);  // 实线，高度 2

// 4. 提交事务，真正打印
LineApi.printTrans((success, message) => {
    if (success) {
        console.log("打印成功");
    } else {
        console.error("打印失败:", message);
    }
    LineApi.enableTransMode(false);  // 关闭事务模式
});
```

### 3.2 常用方法说明

| 方法 | 说明 |
|------|------|
| `enableTransMode(enable)` | 开启/关闭事务模式。为 `true` 时仅缓存不立即出纸，配合 `printTrans` 一次性打印。 |
| `printTrans(callback)` | 提交事务并执行打印，回调参数为 `(success, message)`。 |
| `initLine(baseStyle)` | 初始化行式画布。`baseStyle` 需包含 `align/width/height/renderColor/posX`，可用 `BaseStyleBuilder` 构建。 |
| `printText(text, textStyle)` | 打印一行文本并换行。`textStyle` 控制对齐、字体、字号等，可用 `TextStyleBuilder` 构建。 |
| `addText(text, textStyle)` | 在当前行追加文本，不换行。可与 `printText` 搭配实现同一行多段样式。 |
| `printTexts(textArray, colsWidthArr, textStyles)` | 多列对齐打印。传入文本数组、每列宽度数组、每列样式数组。 |
| `printBarCode(text, barcodeStyle)` | 打印条码。`barcodeStyle` 可指定条码类型、宽度、高度、是否显示底部文字等。 |
| `printQrCode(qrcode, qrStyle)` | 打印二维码。`qrStyle` 可指定点大小、纠错等级、宽高等。 |
| `printBitmap(bitmapBase64, bitmapStyle)` | 打印图片。`bitmapBase64` 为 Base64 字符串，`bitmapStyle` 可指定宽高、对齐、二值化算法等。 |
| `printDividingLine(lineType, lineHeight)` | 打印分割线。`lineType`：0 空/1 实线/2 虚线；`lineHeight` 为线高。 |
| `autoOut()` | 不开启事务时，每次组版后立即走纸输出。 |

### 3.3 简单出纸示例（非事务）

```javascript
const baseStyle = BaseStyleBuilder.create().align(Align.LEFT).width(384).build();
LineApi.initLine(baseStyle);
LineApi.printText("Hello Sunmi", TextStyleBuilder.create().build());
LineApi.autoOut();  // 立即打印并出纸
```

---

## 4. CanvasApi（画布模式）

**CanvasApi** 以「画布」为单位排版：先设定画布尺寸和对齐，再在画布上按坐标绘制文本、条码、二维码、图片、矩形等，最后一次性 `printCanvas` 输出。适合标签、票据等需要精确定位的场景。

### 4.1 基本流程

```javascript
import { CanvasApi } from "@/uni_modules/sunmi-printersdk";
import { BaseStyleBuilder, Align } from "@/uni_modules/sunmi-printersdk/utssdk/interface.uts";
import { TextStyleBuilder, FontStyle, Rotate } from "@/uni_modules/sunmi-printersdk/utssdk/interface.uts";
import { AreaStyleBuilder, Shape } from "@/uni_modules/sunmi-printersdk/utssdk/interface.uts";
import { QrStyleBuilder, ErrorLevel } from "@/uni_modules/sunmi-printersdk/utssdk/interface.uts";
import { BarcodeStyleBuilder } from "@/uni_modules/sunmi-printersdk/utssdk/interface.uts";

// 1. 初始化画布（宽度、高度、对齐等）
const baseStyle = BaseStyleBuilder.create()
    .align(Align.CENTER)
    .width(384)
    .height(219)
    .build();
CanvasApi.initCanvasApi(baseStyle);

// 2. 在画布上绘制内容（顺序即层级）
CanvasApi.renderArea(AreaStyleBuilder.create()
    .width(384).height(30).posX(0).posY(0)
    .shape(Shape.BOX).thick(1)
    .build());
CanvasApi.renderText("标题", TextStyleBuilder.create()
    .align(Align.CENTER).fontStyle(FontStyle.BOLD).textSize(28)
    .posX(0).posY(5).width(384).height(24)
    .build());
CanvasApi.renderQrCode("https://example.com", QrStyleBuilder.create()
    .posX(152).posY(40).width(80).height(80).dot(4)
    .errorLevel(ErrorLevel.M)
    .build());
CanvasApi.renderText("扫码查看", TextStyleBuilder.create()
    .align(Align.CENTER).posX(0).posY(125).width(384).height(20)
    .build());

// 3. 打印画布（count 为联数，如 1 表示打一张）
CanvasApi.printCanvas((success, message) => {
    console.log(success ? "打印成功" : "打印失败: " + message);
}, 1);
```

### 4.2 方法说明

| 方法 | 说明 |
|------|------|
| `initCanvasApi(baseStyle)` | 初始化画布。`baseStyle` 同 LineApi，建议设置 `width/height` 以匹配纸宽。 |
| `renderArea(areaStyle)` | 绘制区域（矩形/圆等）。`areaStyle` 含 `width/height/posX/posY/endX/endY/thick/shape`，可用 `AreaStyleBuilder`，`shape` 见 `Shape` 枚举（如 `BOX`、`RECT_FILL`、`CIRCLE`）。 |
| `renderText(text, textStyle)` | 在指定位置绘制文本。`textStyle` 需包含 `posX/posY/width/height` 及 `align/fontStyle/textSize` 等，支持 `rotate` 旋转。 |
| `renderBarCode(text, barcodeStyle)` | 在画布上绘制条码。需设置 `posX/posY/width/height` 及条码类型等。 |
| `renderBitmap(bitmapBase64, bitmapStyle)` | 在画布上绘制图片。`bitmapStyle` 需包含 `posX/posY/width/height`。 |
| `renderQrCode(qrcode, qrStyle)` | 在画布上绘制二维码。`qrStyle` 需包含 `posX/posY/width/height/dot` 等。 |
| `printCanvas(callback, count)` | 将当前画布发送打印机，`count` 为打印联数，回调 `(success, message)`。 |

---

## 5. CommandApi（指令透传）

**CommandApi** 用于直接向打印机发送 **ESC/POS** 或 **TSPL** 原始指令，适合已有指令文档、需要完全自定义控制或兼容第三方协议的场景。

### 5.1 ESC 指令（热敏小票常用）

```javascript
import { CommandApi } from "@/uni_modules/sunmi-printersdk";

// 字符串形式（如十六进制字符串或可打印字符）
CommandApi.sendEscCommand("\x1B\x40");           // 初始化打印机
CommandApi.sendEscCommand("\x1B\x61\x01");      // 居中
CommandApi.sendEscCommand("Hello ESC\n");
CommandApi.sendEscCommand("\x1D\x56\x00");      // 切纸

// 或传入 Byte 数组（需在 UTS 环境中按插件要求构造 Array<Byte>）
// CommandApi.sendEscCommand(byteArray);
```

### 5.2 TSPL 指令（标签机常用）

```javascript
import { CommandApi } from "@/uni_modules/sunmi-printersdk";

const tspl = "SIZE 40 mm, 30 mm\nGAP 2 mm, 0 mm\nDIRECTION 1\nCLS\nTEXT 10,10,\"3\",0,1,1,\"Label\"\nPRINT 1,1\n";
CommandApi.sendTsplCommand(tspl);
```

### 5.3 方法说明

| 方法 | 说明 |
|------|------|
| `sendEscCommand(data)` | 发送 ESC/POS 指令。`data` 可为 `string` 或 `Array<Byte>`（UTS 中）。 |
| `sendTsplCommand(data)` | 发送 TSPL 指令。`data` 可为 `string` 或 `Array<Byte>`。 |

**注意**：指令透传不经过插件内部排版逻辑，错误指令可能导致打印机无响应或异常，请参照设备对应的 ESC/POS 或 TSPL 手册使用。

---

## 6. 小结

| API | 适用场景 |
|-----|----------|
| **LineApi** | 小票、流水单，按行组版，支持事务模式批量打印。 |
| **CanvasApi** | 标签、票据，按坐标绘制文本/条码/二维码/图片/区域，再整体打印。 |
| **CommandApi** | 自定义协议、已有指令流，直接发送 ESC 或 TSPL 原始数据。 |

样式与枚举（如 `Align`、`FontStyle`、`BaseStyleBuilder`、`TextStyleBuilder`、`QrStyleBuilder`、`BarcodeStyleBuilder`、`AreaStyleBuilder`、`BitmapStyleBuilder`、`Shape`、`ErrorLevel`、`DividingLine` 等）定义在插件的 `utssdk/interface.uts` 中，按需从插件或对应路径引入即可。

```