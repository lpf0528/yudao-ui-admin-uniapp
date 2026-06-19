import qrcode from 'qrcode-generator'
// #ifdef APP-PLUS
import { LineApi, PrinterSdk } from '@/uni_modules/sunmi-printersdk'
// #endif

export interface CutPrintData {
  qrCode: string
  orderNo: string
  customerName: string
  curtainName: string
  structureName: string
  elementName: string
  productName: string
  cutQuantity: string
  unitLabel: string
}

export const CUT_PRINT_CANVAS_W = 300

const QR_DRAW_SIZE = 110
const QR_X = (CUT_PRINT_CANVAS_W - QR_DRAW_SIZE) / 2
const MARGIN_PX = Math.round(5 / 57 * CUT_PRINT_CANVAS_W)
const MARGIN_2MM_PX = Math.round(2 / 57 * CUT_PRINT_CANVAS_W)
const TITLE_Y = MARGIN_PX + 16
const QR_Y = TITLE_Y + 22
const TEXT_X = 16
const BODY_FONT_SIZE = 17
const TEXT_MAX_PX = CUT_PRINT_CANVAS_W - TEXT_X * 2
const CONT_INDENT = '    '
const LH = 28

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

function measureCharWidth(ch: string, fontSize = BODY_FONT_SIZE): number {
  return ch.charCodeAt(0) > 127 ? fontSize : fontSize * 0.55
}

function measureTextWidth(text: string, fontSize = BODY_FONT_SIZE): number {
  let w = 0
  for (const ch of Array.from(text))
    w += measureCharWidth(ch, fontSize)
  return w
}

function splitFieldLines(label: string, val: string): string[] {
  const prefix = `${label}：`
  const firstMaxPx = TEXT_MAX_PX - measureTextWidth(prefix)
  const restMaxPx = TEXT_MAX_PX - measureTextWidth(CONT_INDENT)
  const lines: string[] = []
  let cur = ''
  let w = 0
  let max = firstMaxPx
  for (const ch of Array.from(val)) {
    const cw = measureCharWidth(ch)
    if (w + cw > max && cur.length > 0) {
      lines.push(cur)
      cur = ch
      w = cw
      max = restMaxPx
    } else {
      cur += ch
      w += cw
    }
  }
  if (cur)
    lines.push(cur)
  return lines
}

function getFieldRows(data: CutPrintData): [string, string][] {
  return [
    ['订单号', data.orderNo],
    ['客户', data.customerName],
    ['窗帘', data.curtainName],
    ['结构', data.structureName],
    ['组件', data.elementName],
    ['产品', data.productName],
    ['裁剪数量', `${data.cutQuantity} ${data.unitLabel}`.trim()],
  ]
}

export function calculateCutPrintCanvasHeight(data: CutPrintData): number {
  const lineY = QR_Y + QR_DRAW_SIZE + 14
  let ty = lineY + 24
  for (const [label, val] of getFieldRows(data)) {
    if (!val)
      continue
    const lines = splitFieldLines(label, val)
    ty += lines.length * LH
  }
  return ty + MARGIN_PX
}

function drawDashedLine(ctx: any, y: number) {
  const dashLen = 8
  const gap = 5
  ctx.setStrokeStyle('#aaaaaa')
  ctx.setLineWidth(1)
  let x = 8
  while (x < CUT_PRINT_CANVAS_W - 8) {
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(Math.min(x + dashLen, CUT_PRINT_CANVAS_W - 8), y)
    ctx.stroke()
    x += dashLen + gap
  }
}

export function drawCutPrintLabel(
  data: CutPrintData,
  canvasId: string,
  componentInstance: unknown,
  canvasHeight: number,
): Promise<void> {
  return new Promise((resolve) => {
    const ctx = uni.createCanvasContext(canvasId, componentInstance)

    ctx.setFillStyle('#ffffff')
    ctx.fillRect(0, 0, CUT_PRINT_CANVAS_W, canvasHeight)

    drawDashedLine(ctx, MARGIN_2MM_PX)

    ctx.setFillStyle('#000000')
    ctx.setFontSize(18)
    ctx.setTextAlign('center')
    ctx.fillText('布匹裁剪信息', CUT_PRINT_CANVAS_W / 2, TITLE_Y)
    ctx.setTextAlign('left')

    const qr = qrcode(0, 'M')
    qr.addData(data.qrCode || 'EMPTY')
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
    ctx.lineTo(CUT_PRINT_CANVAS_W - 16, lineY)
    ctx.stroke()

    const tx = TEXT_X
    let ty = lineY + 24

    ctx.setFontSize(BODY_FONT_SIZE)
    ctx.setFillStyle('#000000')
    for (const [label, val] of getFieldRows(data)) {
      if (!val)
        continue
      const lines = splitFieldLines(label, val)
      ctx.fillText(`${label}：${lines[0]}`, tx, ty)
      for (let i = 1; i < lines.length; i++) {
        ty += LH
        ctx.fillText(`${CONT_INDENT}${lines[i]}`, tx, ty)
      }
      ty += LH
    }

    drawDashedLine(ctx, canvasHeight - MARGIN_2MM_PX)

    ctx.draw(false, () => resolve())
  })
}

export async function printCutLabelToDevice(
  canvasId: string,
  componentInstance: unknown,
  canvasHeight: number,
): Promise<void> {
  // #ifdef APP-PLUS
  const PRINT_HEIGHT = Math.round(PRINT_WIDTH * canvasHeight / CUT_PRINT_CANVAS_W)
  const tempFilePath = await new Promise<string>((resolve, reject) => {
    uni.canvasToTempFilePath(
      {
        canvasId,
        x: 0,
        y: 0,
        width: CUT_PRINT_CANVAS_W,
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
  throw new Error('当前环境不支持直接打印，请使用 APP')
  // #endif
}

/** 绘制标签并发送至商米打印机（APP） */
export async function printCutLabel(
  data: CutPrintData,
  canvasId: string,
  componentInstance: unknown,
): Promise<void> {
  const canvasHeight = calculateCutPrintCanvasHeight(data)
  await drawCutPrintLabel(data, canvasId, componentInstance, canvasHeight)
  await new Promise(resolve => setTimeout(resolve, 150))
  await printCutLabelToDevice(canvasId, componentInstance, canvasHeight)
}
