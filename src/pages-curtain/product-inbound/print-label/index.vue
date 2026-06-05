<script setup lang="ts">
import qrcode from 'qrcode-generator'
import { getCurrentInstance, onMounted, ref } from 'vue'
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

// Label canvas: 300×480px maps to 40×64mm (approx)
const CANVAS_W = 300
const CANVAS_H = 480
const QR_DRAW_SIZE = 128 // QR code: half size, centered
const QR_X = (CANVAS_W - QR_DRAW_SIZE) / 2 // 86
const QR_Y = 20

const instance = getCurrentInstance()

const batchNo = ref('')
const productName = ref('')
const versionName = ref('')
const specValue = ref('')
const note = ref('')
const drawn = ref(false)
const saving = ref(false)

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

function drawLabel() {
  if (!batchNo.value)
    return

  const ctx = uni.createCanvasContext('label-canvas', instance?.proxy)

  // White background
  ctx.setFillStyle('#ffffff')
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // QR code
  const qr = qrcode(0, 'M')
  qr.addData(batchNo.value)
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
  let ty = lineY + 32
  const lh = 38

  ctx.setFontSize(22)
  ctx.fillText(`批次：${batchNo.value}`, tx, ty)
  ty += lh
  ctx.fillText(`产品：${productName.value || '-'}`, tx, ty)
  if (versionName.value) {
    ty += lh
    ctx.fillText(`版本：${versionName.value}`, tx, ty)
  }
  if (specValue.value) {
    ty += lh
    ctx.fillText(`规格：${specValue.value}`, tx, ty)
  }
  if (note.value) {
    ty += lh
    // first line: "备注：" prefix takes ~6 half-width units (3 CJK), rest ≈ 18; continuation ≈ 24
    const noteLines = splitLines(note.value, 18, 24)
    ctx.fillText(`备注：${noteLines[0]}`, tx, ty)
    for (let i = 1; i < noteLines.length; i++) {
      ty += lh
      ctx.fillText(`    ${noteLines[i]}`, tx, ty)
    }
  }

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
          height: CANVAS_H,
          destWidth: CANVAS_W * 3,
          destHeight: CANVAS_H * 3,
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
// 58mm 打印机：203 DPI，384 点宽
const PRINT_WIDTH = 384
const PRINT_HEIGHT = Math.round(PRINT_WIDTH * (CANVAS_H / CANVAS_W))

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
    // 1. Canvas → 临时图片文件（384px 对齐 58mm 打印宽度）
    uni.showToast({ title: `生成图片 ${PRINT_WIDTH}×${PRINT_HEIGHT}px…`, icon: 'none', duration: 1500 })
    const tempFilePath = await new Promise<string>((resolve, reject) => {
      uni.canvasToTempFilePath(
        {
          canvasId: 'label-canvas',
          x: 0,
          y: 0,
          width: CANVAS_W,
          height: CANVAS_H,
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

onMounted(() => {
  const pages = getCurrentPages()
  const cur = pages[pages.length - 1] as any
  const opts = cur.$page?.options ?? cur.options ?? {}
  batchNo.value = decodeURIComponent(opts.batchNo ?? '')
  productName.value = decodeURIComponent(opts.productName ?? '')
  versionName.value = decodeURIComponent(opts.versionName ?? '')
  specValue.value = decodeURIComponent(opts.specValue ?? '')
  note.value = decodeURIComponent(opts.note ?? '')
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
          :style="`width:${CANVAS_W}px;height:${CANVAS_H}px;display:block;`"
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
