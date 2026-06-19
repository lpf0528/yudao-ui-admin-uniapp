<script setup lang="ts">
import qrcode from 'qrcode-generator'
import { getCurrentInstance, nextTick, onMounted, ref } from 'vue'
// #ifdef APP-PLUS
import { LineApi, PrinterSdk } from '@/uni_modules/sunmi-printersdk'
import { navigateBackPlus } from '@/utils'
// #endif

definePage({
  style: {
    navigationBarTitleText: '',
    navigationStyle: 'custom',
  },
})

// 57mm 标签：宽度固定 57mm，高度随内容动态计算
const CANVAS_W = 300
const QR_DRAW_SIZE = 110
const QR_X = (CANVAS_W - QR_DRAW_SIZE) / 2
const MARGIN_PX = Math.round(5 / 57 * CANVAS_W) // 5mm 上下边距 ≈ 26px
const MARGIN_2MM_PX = Math.round(2 / 57 * CANVAS_W) // 2mm 边距 ≈ 11px
const TITLE_Y = MARGIN_PX + 20
const QR_Y = TITLE_Y + 26

const instance = getCurrentInstance()

const batchNo = ref('')
const qrCode = ref('')
const productName = ref('')
const warehouse = ref('')
const versionName = ref('')
const specValue = ref('')
const quantity = ref('')
const note = ref('')
const drawn = ref(false)
const saving = ref(false)
const canvasHeight = ref(0)

// 按字符宽度（CJK=2单位，ASCII=1单位）拆分成多行
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

function calculateCanvasHeight(): number {
  const lh = 34
  const lineY = QR_Y + QR_DRAW_SIZE + 14
  let ty = lineY + 28
  ty += lh // 批次 → 产品
  if (warehouse.value)
    ty += lh
  if (versionName.value)
    ty += lh
  if (specValue.value)
    ty += lh
  ty += lh // 剩余数量
  if (note.value) {
    const noteLines = splitLines(note.value, 18, 24)
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
  while (x < CANVAS_W - 8) {
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(Math.min(x + dashLen, CANVAS_W - 8), y)
    ctx.stroke()
    x += dashLen + gap
  }
}

function drawLabel() {
  if (!batchNo.value)
    return

  const ctx = uni.createCanvasContext('label-canvas', instance?.proxy)

  // White background
  ctx.setFillStyle('#ffffff')
  ctx.fillRect(0, 0, CANVAS_W, canvasHeight.value)

  // 顶部虚线（2mm）
  drawDashedLine(ctx, MARGIN_2MM_PX)

  // Title
  ctx.setFillStyle('#000000')
  ctx.setFontSize(22)
  ctx.setTextAlign('center')
  ctx.fillText('布匹信息', CANVAS_W / 2, TITLE_Y)
  ctx.setTextAlign('left')

  // QR code
  const qr = qrcode(0, 'M')
  qr.addData(qrCode.value || batchNo.value)
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

  // Divider
  const lineY = QR_Y + QR_DRAW_SIZE + 14
  ctx.setStrokeStyle('#dddddd')
  ctx.setLineWidth(1)
  ctx.beginPath()
  ctx.moveTo(16, lineY)
  ctx.lineTo(CANVAS_W - 16, lineY)
  ctx.stroke()

  // Text
  ctx.setFillStyle('#000000')
  const tx = 16
  let ty = lineY + 28
  const lh = 34

  ctx.setFontSize(20)
  ctx.fillText(`批次：${batchNo.value}`, tx, ty)
  ty += lh
  ctx.fillText(`产品：${productName.value || '-'}`, tx, ty)
  if (warehouse.value) {
    ty += lh
    ctx.fillText(`仓库：${warehouse.value}`, tx, ty)
  }
  if (versionName.value) {
    ty += lh
    ctx.fillText(`版本：${versionName.value}`, tx, ty)
  }
  if (specValue.value) {
    ty += lh
    ctx.fillText(`规格：${specValue.value}`, tx, ty)
  }
  ty += lh
  ctx.fillText(`剩余数量：${quantity.value || '-'}`, tx, ty)
  if (note.value) {
    ty += lh
    const noteLines = splitLines(note.value, 18, 24)
    ctx.fillText(`备注：${noteLines[0]}`, tx, ty)
    for (let i = 1; i < noteLines.length; i++) {
      ty += lh
      ctx.fillText(`    ${noteLines[i]}`, tx, ty)
    }
  }

  // 底部虚线（2mm）
  drawDashedLine(ctx, canvasHeight.value - MARGIN_2MM_PX)

  ctx.draw(false, () => {
    drawn.value = true
  })
}

async function handleSaveImage() {
  if (!drawn.value) {
    uni.showToast({ title: '图片生成中，请稍候', icon: 'none' })
    return
  }
  saving.value = true
  try {
    const tempFilePath = await new Promise<string>((resolve, reject) => {
      uni.canvasToTempFilePath(
        {
          canvasId: 'label-canvas',
          x: 0,
          y: 0,
          width: CANVAS_W,
          height: canvasHeight.value,
          destWidth: CANVAS_W * 3,
          destHeight: canvasHeight.value * 3,
          fileType: 'png',
          success: res => resolve(res.tempFilePath),
          fail: reject,
        },
        instance?.proxy,
      )
    })
    await new Promise<void>((resolve, reject) => {
      uni.saveImageToPhotosAlbum({
        filePath: tempFilePath,
        success: () => resolve(),
        fail: reject,
      })
    })
    uni.showToast({ title: '已保存到相册', icon: 'success' })
  } catch {
    uni.showToast({ title: '保存失败，请重试', icon: 'none' })
  } finally {
    saving.value = false
  }
}

// #ifdef H5
function handlePrint() {
  window.print()
}
// #endif

// #ifdef APP-PLUS
// 57mm 标签：203 DPI = 456 点宽，高度随 canvas 动态计算
const PRINT_WIDTH = 456

let printerReady = false

/** 初始化商米 SDK 打印服务（5s 超时） */
function initSunmiSdk(PrinterSdk: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('初始化超时（5s）')), 5000)
    PrinterSdk.initPrinter((success: boolean, message: string) => {
      clearTimeout(timer)
      console.log('[Sunmi] initPrinter:', success, message)
      if (success) {
        printerReady = true
        resolve()
      } else {
        reject(new Error(message || '打印机初始化失败'))
      }
    })
  })
}

async function handlePrintApp() {
  if (!drawn.value) {
    uni.showToast({ title: '图片生成中，请稍候', icon: 'none' })
    return
  }
  saving.value = true

  try {
    const PRINT_HEIGHT = Math.round(PRINT_WIDTH * canvasHeight.value / CANVAS_W)
    // 1. Canvas → 临时图片文件
    uni.showToast({ title: `生成图片 ${PRINT_WIDTH}×${PRINT_HEIGHT}px…`, icon: 'none', duration: 1500 })
    const tempFilePath = await new Promise<string>((resolve, reject) => {
      uni.canvasToTempFilePath(
        {
          canvasId: 'label-canvas',
          x: 0,
          y: 0,
          width: CANVAS_W,
          height: canvasHeight.value,
          destWidth: PRINT_WIDTH,
          destHeight: PRINT_HEIGHT,
          fileType: 'png',
          success: res => resolve(res.tempFilePath),
          fail: reject,
        },
        instance?.proxy,
      )
    })
    uni.showToast({ title: '图片生成成功', icon: 'none', duration: 1000 })

    // 2. 临时文件 → base64（plus.io.FileReader，APP 端稳定可用）
    uni.showToast({ title: '转换图片格式…', icon: 'none', duration: 1000 })
    const base64 = await new Promise<string>((resolve, reject) => {
      plus.io.resolveLocalFileSystemURL(
        tempFilePath,
        (entry: any) => {
          entry.file((file: any) => {
            const reader = new plus.io.FileReader()
            reader.onload = (e: any) => {
              // readAsDataURL 返回 "data:image/png;base64,xxx"，截取逗号后内容
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

    // 3. 初始化打印服务（复用已就绪的连接）
    if (!printerReady) {
      uni.showToast({ title: '初始化打印机…', icon: 'none', duration: 2000 })
      await initSunmiSdk(PrinterSdk)
      uni.showToast({ title: '打印机连接成功', icon: 'none', duration: 1500 })
    } else {
      uni.showToast({ title: '打印机已就绪（复用）', icon: 'none', duration: 800 })
    }

    // 5. 打印图片（LineApi：全宽居中）
    // BaseStyle: align 2=CENTER, renderColor 0=BLACK
    // BitmapStyle: algorithm 0=BINARIZATION, value 0=默认阈值
    uni.showToast({ title: '发送图片至打印机…', icon: 'none', duration: 1500 })
    LineApi.initLine({ align: 2, width: PRINT_WIDTH, height: 0, renderColor: 0, posX: 0 })
    LineApi.printBitmap(base64, { width: PRINT_WIDTH, height: PRINT_HEIGHT, posX: 0, posY: 0, align: 2, algorithm: 0, value: 0 })
    LineApi.autoOut()

    uni.showToast({ title: '已发送至打印机 ✓', icon: 'success' })
  } catch (e: any) {
    printerReady = false
    console.error('[Print]', e)
    uni.showToast({ title: e.message || '打印失败，请重试', icon: 'none', duration: 3000 })
  } finally {
    saving.value = false
  }
}
// #endif

onMounted(async () => {
  const pages = getCurrentPages()
  const cur = pages[pages.length - 1] as any
  const opts = cur.$page?.options ?? cur.options ?? {}
  batchNo.value = decodeURIComponent(opts.batchNo ?? '')
  qrCode.value = decodeURIComponent(opts.qrCode ?? '')
  productName.value = decodeURIComponent(opts.productName ?? '')
  warehouse.value = decodeURIComponent(opts.warehouse ?? '')
  versionName.value = decodeURIComponent(opts.versionName ?? '')
  specValue.value = decodeURIComponent(opts.spec ?? opts.specValue ?? '')
  quantity.value = decodeURIComponent(opts.quantity ?? '')
  note.value = decodeURIComponent(opts.note ?? '')
  canvasHeight.value = calculateCanvasHeight()
  await nextTick()
  setTimeout(drawLabel, 100)
})
</script>

<template>
  <view class="page-wrap">
    <wd-navbar
      title="打印标签"
      left-arrow placeholder safe-area-inset-top fixed
      @click-left="navigateBackPlus"
    />

    <!-- Label preview -->
    <view class="preview-area">
      <view class="label-shadow">
        <canvas
          canvas-id="label-canvas"
          :style="`width:${CANVAS_W}px;height:${canvasHeight}px;display:block;`"
        />
      </view>
    </view>

    <!-- Actions -->
    <view class="action-bar">
      <!-- #ifdef H5 -->
      <view class="btn btn-print" @click="handlePrint">
        打印
      </view>
      <!-- #endif -->
      <!-- #ifdef APP-PLUS -->
      <view
        class="btn btn-print"
        :class="{ disabled: saving || !drawn }"
        @click="handlePrintApp"
      >
        {{ saving ? '打印中…' : '打印' }}
      </view>
      <!-- #endif -->
      <view
        class="btn btn-save"
        :class="{ disabled: saving || !drawn }"
        @click="handleSaveImage"
      >
        {{ saving ? '保存中…' : '保存图片' }}
      </view>
    </view>
  </view>
</template>

<!-- #ifdef H5 -->
<style>
@page {
  size: 57mm auto;
  margin: 5mm 0;
}
@media print {
  body > *:not(.page-wrap) {
    display: none !important;
  }
  .wd-navbar,
  .action-bar {
    display: none !important;
  }
  .preview-area {
    margin: 0 !important;
    padding: 0 !important;
  }
  .label-shadow {
    box-shadow: none !important;
  }
  canvas {
    width: 100% !important;
    page-break-inside: avoid;
  }
}
</style>
<!-- #endif -->

<style lang="scss" scoped>
.page-wrap {
  min-height: 100vh;
  background-color: #f4f6f9;
}

.preview-area {
  display: flex;
  justify-content: center;
  padding: 48rpx 32rpx 32rpx;
}

.label-shadow {
  border-radius: 8rpx;
  box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.15);
  background: #fff;
  overflow: hidden;
  border: 1rpx solid #e8e8e8;
}

.action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 24rpx;
  padding: 24rpx 32rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1rpx solid #f0f0f0;
}

.btn {
  flex: 1;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 500;
  text-align: center;
}

.btn-print {
  border: 1rpx solid #1890ff;
  color: #1890ff;
  background-color: #e6f7ff;
}

.btn-save {
  color: #fff;
  background-color: #1890ff;

  &.disabled {
    background-color: #91caff;
  }
}
</style>
