import qrcode from 'qrcode-generator'
// #ifdef APP-PLUS
import { LineApi, PrinterSdk } from '@/uni_modules/sunmi-printersdk'
// #endif

export interface ProductLabelPrintData {
  batchNo: string
  qrCode: string
  productName: string
  warehouse: string
  versionName: string
  specValue: string
  quantity: string
  note: string
}

export const PRODUCT_LABEL_CANVAS_W = 300

const QR_DRAW_SIZE = 110
const QR_X = (PRODUCT_LABEL_CANVAS_W - QR_DRAW_SIZE) / 2
const MARGIN_PX = Math.round(5 / 57 * PRODUCT_LABEL_CANVAS_W)
const MARGIN_2MM_PX = Math.round(2 / 57 * PRODUCT_LABEL_CANVAS_W)
const TITLE_Y = MARGIN_PX + 20
const QR_Y = TITLE_Y + 26

// #ifdef APP-PLUS
const PRINT_WIDTH = 456
let printerReady = false

function initSunmiSdk(sdk: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('初始化超时（5s）')), 5000)
    sdk.initPrinter((success: boolean, message: string) => {
      clearTimeout(timer)
      if (success) {
        printerReady = true
        resolve()
      } else {
        reject(new Error(message || '打印机初始化失败'))
      }
    })
  })
}
// #endif

function splitLines(text: string, firstMax: number, restMax: number): string[] {
  const lines: string[] = []
  let cur = ''
  let w = 0
  let max = firstMax
  for (const ch of Array.from(text)) {
    const cw = ch.charCodeAt(0) > 127 ? 2 : 1
    if (w + cw > max && cur.length > 0) {
      lines.push(cur)
      cur = ch
      w = cw
      max = restMax
    } else {
      cur += ch
      w += cw
    }
  }
  if (cur)
    lines.push(cur)
  return lines
}

export function calculateProductLabelCanvasHeight(data: ProductLabelPrintData): number {
  const lh = 34
  const lineY = QR_Y + QR_DRAW_SIZE + 14
  let ty = lineY + 28
  ty += lh
  if (data.warehouse)
    ty += lh
  if (data.versionName)
    ty += lh
  if (data.specValue)
    ty += lh
  ty += lh
  if (data.note) {
    const noteLines = splitLines(data.note, 18, 24)
    ty += noteLines.length * lh
  }
  return ty + MARGIN_PX
}

function drawDashedLine(ctx: any, y: number) {
  const dashLen = 8
  const gap = 5
  ctx.setStrokeStyle('#aaaaaa')
  ctx.setLineWidth(1)
  let x = 8
  while (x < PRODUCT_LABEL_CANVAS_W - 8) {
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(Math.min(x + dashLen, PRODUCT_LABEL_CANVAS_W - 8), y)
    ctx.stroke()
    x += dashLen + gap
  }
}

export function drawProductLabel(
  data: ProductLabelPrintData,
  canvasId: string,
  componentInstance: unknown,
  canvasHeight: number,
): Promise<void> {
  return new Promise((resolve) => {
    const ctx = uni.createCanvasContext(canvasId, componentInstance)

    ctx.setFillStyle('#ffffff')
    ctx.fillRect(0, 0, PRODUCT_LABEL_CANVAS_W, canvasHeight)

    drawDashedLine(ctx, MARGIN_2MM_PX)

    ctx.setFillStyle('#000000')
    ctx.setFontSize(22)
    ctx.setTextAlign('center')
    ctx.fillText('布匹信息', PRODUCT_LABEL_CANVAS_W / 2, TITLE_Y)
    ctx.setTextAlign('left')

    const qr = qrcode(0, 'M')
    qr.addData(data.qrCode || data.batchNo)
    qr.make()
    const count = qr.getModuleCount()
    const cell = QR_DRAW_SIZE / count
    ctx.setFillStyle('#000000')
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c))
          ctx.fillRect(QR_X + c * cell, QR_Y + r * cell, cell, cell)
      }
    }

    const lineY = QR_Y + QR_DRAW_SIZE + 14
    ctx.setStrokeStyle('#dddddd')
    ctx.setLineWidth(1)
    ctx.beginPath()
    ctx.moveTo(16, lineY)
    ctx.lineTo(PRODUCT_LABEL_CANVAS_W - 16, lineY)
    ctx.stroke()

    const tx = 16
    let ty = lineY + 28
    const lh = 34

    ctx.setFontSize(20)
    ctx.fillText(`批次：${data.batchNo}`, tx, ty)
    ty += lh
    ctx.fillText(`产品：${data.productName || '-'}`, tx, ty)
    if (data.warehouse) {
      ty += lh
      ctx.fillText(`仓库：${data.warehouse}`, tx, ty)
    }
    if (data.versionName) {
      ty += lh
      ctx.fillText(`版本：${data.versionName}`, tx, ty)
    }
    if (data.specValue) {
      ty += lh
      ctx.fillText(`规格：${data.specValue}`, tx, ty)
    }
    ty += lh
    ctx.fillText(`剩余数量：${data.quantity || '-'}`, tx, ty)
    if (data.note) {
      ty += lh
      const noteLines = splitLines(data.note, 18, 24)
      ctx.fillText(`备注：${noteLines[0]}`, tx, ty)
      for (let i = 1; i < noteLines.length; i++) {
        ty += lh
        ctx.fillText(`    ${noteLines[i]}`, tx, ty)
      }
    }

    drawDashedLine(ctx, canvasHeight - MARGIN_2MM_PX)

    ctx.draw(false, () => resolve())
  })
}

export async function printProductLabelToDevice(
  canvasId: string,
  componentInstance: unknown,
  canvasHeight: number,
): Promise<void> {
  // #ifdef APP-PLUS
  const PRINT_HEIGHT = Math.round(PRINT_WIDTH * canvasHeight / PRODUCT_LABEL_CANVAS_W)
  const tempFilePath = await new Promise<string>((resolve, reject) => {
    uni.canvasToTempFilePath(
      {
        canvasId,
        x: 0,
        y: 0,
        width: PRODUCT_LABEL_CANVAS_W,
        height: canvasHeight,
        destWidth: PRINT_WIDTH,
        destHeight: PRINT_HEIGHT,
        fileType: 'png',
        success: res => resolve(res.tempFilePath),
        fail: reject,
      },
      componentInstance,
    )
  })

  const base64 = await new Promise<string>((resolve, reject) => {
    plus.io.resolveLocalFileSystemURL(
      tempFilePath,
      (entry: any) => {
        entry.file((file: any) => {
          const reader = new plus.io.FileReader()
          reader.onload = (e: any) => {
            const result: string = e.target.result
            resolve(result.includes(',') ? result.split(',')[1] : result)
          }
          reader.onerror = (e: any) => reject(new Error(`文件读取失败: ${JSON.stringify(e)}`))
          reader.readAsDataURL(file)
        }, reject)
      },
      reject,
    )
  })

  if (!printerReady)
    await initSunmiSdk(PrinterSdk)

  LineApi.initLine({ align: 2, width: PRINT_WIDTH, height: 0, renderColor: 0, posX: 0 })
  LineApi.printBitmap(base64, { width: PRINT_WIDTH, height: PRINT_HEIGHT, posX: 0, posY: 0, align: 2, algorithm: 0, value: 0 })
  LineApi.autoOut()
  // #endif

  // #ifndef APP-PLUS
  throw new Error('当前环境不支持打印')
  // #endif
}

/** 绘制布匹标签并发送至商米打印机（APP） */
export async function printProductLabel(
  data: ProductLabelPrintData,
  canvasId: string,
  componentInstance: unknown,
): Promise<void> {
  const canvasHeight = calculateProductLabelCanvasHeight(data)
  await drawProductLabel(data, canvasId, componentInstance, canvasHeight)
  await new Promise(resolve => setTimeout(resolve, 150))
  await printProductLabelToDevice(canvasId, componentInstance, canvasHeight)
}
