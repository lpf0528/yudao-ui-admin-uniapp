<script setup lang="ts">
import qrcode from 'qrcode-generator'
import { getCurrentInstance, onMounted, ref } from 'vue'
import { navigateBackPlus } from '@/utils'

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
// V2s: 58mm 纸，203 DPI，可打宽度 384 点
const SUNMI_V2S_PRINT_WIDTH = 384
const SUNMI_V2S_PRINT_HEIGHT = Math.round(SUNMI_V2S_PRINT_WIDTH * (CANVAS_H / CANVAS_W)) // 614

let woyouService: any = null

function connectSunmiPrinter(): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const mainActivity = plus.android.runtimeMainActivity()
      const Intent = plus.android.importClass('android.content.Intent')
      const intent = new Intent('woyou.aidlservice.jiuiv5.IWoyouService')
      intent.setPackage('woyou.aidlservice.jiuiv5')

      // ServiceConnection：plus.android.implements 同样支持抽象类
      const conn = plus.android.implements('android.content.ServiceConnection', {
        onServiceConnected(_name: any, binder: any) {
          // 通过反射获取 IWoyouService Stub 代理
          try {
            const IWoyouService = plus.android.importClass('woyou.aidlservice.jiuiv5.IWoyouService')
            woyouService = IWoyouService.Stub.asInterface(binder)
          } catch {
            // 部分固件 Stub 不可直接 import，降级用 binder 直调
            woyouService = binder
          }
          resolve()
        },
        onServiceDisconnected(_name: any) {
          woyouService = null
        },
      })

      // BIND_AUTO_CREATE = 1
      const bound = mainActivity.bindService(intent, conn, 1)
      if (!bound)
        reject(new Error('商米打印服务绑定失败，请确认是 V2s 设备'))
    } catch (e: any) {
      reject(e)
    }
  })
}

async function handlePrintApp() {
  if (!drawn.value) {
    uni.showToast({ title: '图片生成中，请稍候', icon: 'none' })
    return
  }
  saving.value = true
  try {
    // 1. Canvas → 临时文件，宽度对齐 V2s 打印点数 384px，避免打印机二次缩放
    const tempFilePath = await new Promise<string>((resolve, reject) => {
      uni.canvasToTempFilePath(
        {
          canvasId: 'label-canvas',
          x: 0,
          y: 0,
          width: CANVAS_W,
          height: CANVAS_H,
          destWidth: SUNMI_V2S_PRINT_WIDTH,
          destHeight: SUNMI_V2S_PRINT_HEIGHT,
          fileType: 'png',
          success: res => resolve(res.tempFilePath),
          fail: reject,
        },
        instance?.proxy,
      )
    })

    // 2. 连接商米 AIDL 打印服务（已连接则复用）
    if (!woyouService)
      await connectSunmiPrinter()

    // 3. 文件路径 → Android Bitmap
    const BitmapFactory = plus.android.importClass('android.graphics.BitmapFactory')
    const realPath = tempFilePath.replace(/^file:\/\//, '')
    const bitmap = BitmapFactory.decodeFile(realPath)
    if (!bitmap)
      throw new Error('图片解码失败，请重试')

    // 4. 发送至 V2s 打印机
    woyouService.printerInit(null)
    woyouService.setAlignment(1, null) // 1 = 居中
    woyouService.printBitmap(bitmap, null)
    woyouService.lineWrap(3, null) // 走纸 3 行，确保标签完整撕出

    uni.showToast({ title: '已发送至打印机', icon: 'success' })
  } catch (e: any) {
    console.error('[Sunmi Print]', e)
    uni.showToast({ title: e.message || '打印失败，请重试', icon: 'none' })
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
