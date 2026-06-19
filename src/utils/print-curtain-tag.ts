import type { SalesOrderCurtainDetail } from '@/api/curtain/order'
import qrcode from 'qrcode-generator'
// #ifdef APP-PLUS
import { LineApi, PrinterSdk } from '@/uni_modules/sunmi-printersdk'
// #endif

export interface CurtainPrintData {
  code: string
  orderNo: string
  customerName: string
  receiver: string
  orderDate: string
  curtainIndex: number
  totalSets: number
  curtainDetail: SalesOrderCurtainDetail | null
  getUnitLabel: (val: string) => string
}

export const CURTAIN_PRINT_CANVAS_W = 300

const QR_SIZE = 110
const MARGIN_PX = Math.round(5 / 57 * CURTAIN_PRINT_CANVAS_W)
const MARGIN_2MM_PX = Math.round(2 / 57 * CURTAIN_PRINT_CANVAS_W)
const TITLE_FONT_SIZE = 18
const BODY_FONT_SIZE = 16
const LINE_HEIGHT = 28
const TITLE_Y = MARGIN_PX + 16

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

function safe(val: string | null | undefined): string {
  if (!val || val === 'null' || val === 'undefined')
    return ''
  return val
}

function drawDashedLine(ctx: any, y: number) {
  const dashLen = 8
  const gap = 5
  ctx.setStrokeStyle('#aaaaaa')
  ctx.setLineWidth(1)
  let x = 8
  while (x < CURTAIN_PRINT_CANVAS_W - 8) {
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(Math.min(x + dashLen, CURTAIN_PRINT_CANVAS_W - 8), y)
    ctx.stroke()
    x += dashLen + gap
  }
}

export function calculateCurtainPrintCanvasHeight(data: CurtainPrintData): number {
  const lh = LINE_HEIGHT
  let ty = TITLE_Y + lh

  ty += lh * 4

  if (safe(data.curtainDetail?.curtainName))
    ty += lh

  ty += lh
  ty += 10

  let hasContent = false
  for (const s of data.curtainDetail?.structures ?? []) {
    const printMats = s.materials.filter(m => m.elementIsPrint)
    if (!printMats.length)
      continue
    hasContent = true
    ty += lh
    ty += printMats.length * lh
    ty += 4
  }
  if (hasContent)
    ty += 10

  ty += QR_SIZE + MARGIN_PX
  return Math.max(ty, 420)
}

export function drawCurtainPrintLabel(
  data: CurtainPrintData,
  canvasId: string,
  componentInstance: unknown,
  canvasHeight: number,
): Promise<void> {
  return new Promise((resolve) => {
    const ctx = uni.createCanvasContext(canvasId, componentInstance)

    ctx.setFillStyle('#ffffff')
    ctx.fillRect(0, 0, CURTAIN_PRINT_CANVAS_W, canvasHeight)

    drawDashedLine(ctx, MARGIN_2MM_PX)

    ctx.setFillStyle('#000000')
    ctx.setFontSize(TITLE_FONT_SIZE)
    ctx.setTextAlign('center')
    ctx.fillText('打包标签', CURTAIN_PRINT_CANVAS_W / 2, TITLE_Y)
    ctx.setTextAlign('left')

    drawDashedLine(ctx, canvasHeight - MARGIN_2MM_PX)

    const tx = 16
    const lh = LINE_HEIGHT
    let ty = TITLE_Y + lh

    ctx.setFillStyle('#000000')
    ctx.setFontSize(BODY_FONT_SIZE)
    ctx.fillText(`订单号：${safe(data.orderNo) || '-'}`, tx, ty); ty += lh
    ctx.fillText(`客户名称：${safe(data.customerName) || '-'}`, tx, ty); ty += lh
    ctx.fillText(`收货人：${safe(data.receiver) || '-'}`, tx, ty); ty += lh
    ctx.fillText(`下单日期：${safe(data.orderDate) || '-'}`, tx, ty); ty += lh

    const curtainName = safe(data.curtainDetail?.curtainName)
    if (curtainName) {
      ctx.fillText(`窗帘名称：${curtainName}`, tx, ty); ty += lh
    }

    ctx.fillText(`第 ${data.curtainIndex} 套 / 共 ${data.totalSets} 套`, tx, ty)
    ty += lh

    ctx.setStrokeStyle('#dddddd')
    ctx.setLineWidth(1)
    ctx.beginPath()
    ctx.moveTo(16, ty)
    ctx.lineTo(CURTAIN_PRINT_CANVAS_W - 16, ty)
    ctx.stroke()
    ty += 10

    let hasDrawnMats = false
    for (const structure of data.curtainDetail?.structures ?? []) {
      const printMats = structure.materials.filter(m => m.elementIsPrint)
      if (!printMats.length)
        continue

      hasDrawnMats = true

      ctx.setFontSize(BODY_FONT_SIZE)
      ctx.setFillStyle('#000000')
      ctx.fillText(safe(structure.structureName) || '-', tx, ty)
      ty += lh

      for (const mat of printMats) {
        const name = `${safe(mat.elementName) || ''}：${safe(mat.productName) || ''}`
        ctx.fillText(`· ${name}  ${mat.quantity ?? 0}${data.getUnitLabel(mat.unitValue)}`, tx, ty)
        ty += lh
      }
      ty += 4
    }

    if (hasDrawnMats) {
      ctx.setStrokeStyle('#dddddd')
      ctx.setLineWidth(1)
      ctx.beginPath()
      ctx.moveTo(16, ty)
      ctx.lineTo(CURTAIN_PRINT_CANVAS_W - 16, ty)
      ctx.stroke()
      ty += 10
    }

    const qr = qrcode(0, 'M')
    qr.addData(data.code || 'EMPTY')
    qr.make()
    const count = qr.getModuleCount()
    const cell = QR_SIZE / count
    const qrX = (CURTAIN_PRINT_CANVAS_W - QR_SIZE) / 2
    ctx.setFillStyle('#000000')
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.isDark(r, c))
          ctx.fillRect(qrX + c * cell, ty + r * cell, cell, cell)
      }
    }

    ctx.draw(false, () => resolve())
  })
}

export async function printCurtainTagToDevice(
  canvasId: string,
  componentInstance: unknown,
  canvasHeight: number,
): Promise<void> {
  // #ifdef APP-PLUS
  const PRINT_HEIGHT = Math.round(PRINT_WIDTH * canvasHeight / CURTAIN_PRINT_CANVAS_W)
  const tempFilePath = await new Promise<string>((resolve, reject) => {
    uni.canvasToTempFilePath(
      {
        canvasId,
        x: 0,
        y: 0,
        width: CURTAIN_PRINT_CANVAS_W,
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

/** 绘制打包标签并发送至商米打印机（APP） */
export async function printCurtainTag(
  data: CurtainPrintData,
  canvasId: string,
  componentInstance: unknown,
): Promise<void> {
  const canvasHeight = calculateCurtainPrintCanvasHeight(data)
  await drawCurtainPrintLabel(data, canvasId, componentInstance, canvasHeight)
  await new Promise(resolve => setTimeout(resolve, 150))
  await printCurtainTagToDevice(canvasId, componentInstance, canvasHeight)
}
