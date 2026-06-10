<script setup lang="ts">
// #endif
import type { SalesOrderCurtainDetail } from '@/api/curtain/order'
import qrcode from 'qrcode-generator'
import { getCurrentInstance, nextTick, onMounted, ref } from 'vue'
import { getSalesOrderDetail } from '@/api/curtain/order'
import { useDictStore } from '@/store/dict'
// #ifdef APP-PLUS
import { LineApi, PrinterSdk } from '@/uni_modules/sunmi-printersdk'
import { navigateBackPlus } from '@/utils'

definePage({
  style: {
    navigationBarTitleText: '',
    navigationStyle: 'custom',
  },
})

const CANVAS_W = 300
const QR_SIZE = 160

const instance = getCurrentInstance()
const dictStore = useDictStore()

const code = ref('')
const orderNo = ref('')
const customerName = ref('')
const receiver = ref('')
const orderDate = ref('')
const curtainIndex = ref(0)
const totalSets = ref(0)
const orderId = ref(0)
const curtainId = ref(0)
const curtainDetail = ref<SalesOrderCurtainDetail | null>(null)
const canvasHeight = ref(400)
const drawn = ref(false)
const saving = ref(false)

function getUnitLabel(val: string) {
  return dictStore.getDictData('zc_product_unit', val)?.label ?? val ?? ''
}

function calculateCanvasHeight(): number {
  // header: 28 + 4×36 (text lines) + 32 (套数 line) + 12 (divider1) = 216
  let ty = 28 + 36 * 4 + 32 + 12

  let hasContent = false
  for (const s of curtainDetail.value?.structures ?? []) {
    const printMats = s.materials.filter(m => m.elementIsPrint)
    if (!printMats.length)
      continue
    hasContent = true
    ty += 26 // structure name line
    ty += printMats.length * 26 // material lines
    ty += 6 // gap after each structure
  }
  if (hasContent)
    ty += 12 // divider2

  ty += QR_SIZE + 20 // QR + bottom padding
  return Math.max(ty, 400)
}

function drawLabel() {
  if (!code.value)
    return

  const ctx = uni.createCanvasContext('curtain-tag-canvas', instance?.proxy)

  ctx.setFillStyle('#ffffff')
  ctx.fillRect(0, 0, CANVAS_W, canvasHeight.value)

  const tx = 16
  let ty = 28
  const lh = 36

  ctx.setFillStyle('#000000')
  ctx.setFontSize(20)
  ctx.fillText(`订单编号：${orderNo.value}`, tx, ty); ty += lh
  ctx.fillText(`客户名称：${customerName.value || '-'}`, tx, ty); ty += lh
  ctx.fillText(`收货人：${receiver.value || '-'}`, tx, ty); ty += lh
  ctx.fillText(`下单日期：${orderDate.value || '-'}`, tx, ty); ty += lh

  ctx.setFontSize(24)
  ctx.fillText(`第 ${curtainIndex.value} 套 / 共 ${totalSets.value} 套`, tx, ty)
  ty += 32

  // 分割线 1
  ctx.setStrokeStyle('#dddddd')
  ctx.setLineWidth(1)
  ctx.beginPath()
  ctx.moveTo(16, ty)
  ctx.lineTo(CANVAS_W - 16, ty)
  ctx.stroke()
  ty += 12

  // 结构 + 用料（仅 elementIsPrint=true）
  let hasDrawnMats = false
  for (const structure of curtainDetail.value?.structures ?? []) {
    const printMats = structure.materials.filter(m => m.elementIsPrint)
    if (!printMats.length)
      continue

    hasDrawnMats = true

    ctx.setFontSize(18)
    ctx.setFillStyle('#333333')
    ctx.fillText(structure.structureName || '-', tx, ty)
    ty += 26

    ctx.setFontSize(15)
    ctx.setFillStyle('#555555')
    for (const mat of printMats) {
      ctx.fillText(`· ${mat.elementName}/${mat.productName}  ${mat.quantity}${getUnitLabel(mat.unitValue)}`, tx, ty)
      ty += 26
    }
    ty += 6
  }

  if (hasDrawnMats) {
    // 分割线 2
    ctx.setStrokeStyle('#dddddd')
    ctx.setLineWidth(1)
    ctx.beginPath()
    ctx.moveTo(16, ty)
    ctx.lineTo(CANVAS_W - 16, ty)
    ctx.stroke()
    ty += 12
  }

  // 二维码（居中）
  const qr = qrcode(0, 'M')
  qr.addData(code.value)
  qr.make()
  const count = qr.getModuleCount()
  const cell = QR_SIZE / count
  const qrX = (CANVAS_W - QR_SIZE) / 2
  ctx.setFillStyle('#000000')
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c))
        ctx.fillRect(qrX + c * cell, ty + r * cell, cell, cell)
    }
  }

  ctx.draw(false, () => {
    drawn.value = true
  })
}

async function loadCurtainDetail() {
  if (!orderId.value)
    return
  try {
    const order = await getSalesOrderDetail({ id: orderId.value })
    curtainDetail.value = order.curtains?.find(c => c.id === curtainId.value) ?? null
  } catch {}
  canvasHeight.value = calculateCanvasHeight()
  await nextTick()
  setTimeout(drawLabel, 100)
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
          canvasId: 'curtain-tag-canvas',
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
const PRINT_WIDTH = 384
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

async function handlePrintApp() {
  if (!drawn.value) {
    uni.showToast({ title: '图片生成中，请稍候', icon: 'none' })
    return
  }
  saving.value = true
  const PRINT_HEIGHT = Math.round(PRINT_WIDTH * (canvasHeight.value / CANVAS_W))
  try {
    uni.showToast({ title: `生成图片 ${PRINT_WIDTH}×${PRINT_HEIGHT}px…`, icon: 'none', duration: 1500 })
    const tempFilePath = await new Promise<string>((resolve, reject) => {
      uni.canvasToTempFilePath(
        {
          canvasId: 'curtain-tag-canvas',
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

    if (!printerReady) {
      uni.showToast({ title: '初始化打印机…', icon: 'none', duration: 2000 })
      await initSunmiSdk(PrinterSdk)
    }

    LineApi.initLine({ align: 2, width: PRINT_WIDTH, height: 0, renderColor: 0, posX: 0 })
    LineApi.printBitmap(base64, { width: PRINT_WIDTH, height: PRINT_HEIGHT, posX: 0, posY: 0, align: 2, algorithm: 0, value: 0 })
    LineApi.autoOut()

    uni.showToast({ title: '已发送至打印机 ✓', icon: 'success' })
  } catch (e: any) {
    printerReady = false
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
  code.value = decodeURIComponent(opts.code ?? '')
  orderNo.value = decodeURIComponent(opts.orderNo ?? '')
  customerName.value = decodeURIComponent(opts.customerName ?? '')
  receiver.value = decodeURIComponent(opts.receiver ?? '')
  orderDate.value = decodeURIComponent(opts.orderDate ?? '')
  curtainIndex.value = Number(opts.curtainIndex ?? 0)
  totalSets.value = Number(opts.totalSets ?? 0)
  orderId.value = Number(opts.orderId ?? 0)
  curtainId.value = Number(opts.curtainId ?? 0)
  loadCurtainDetail()
})
</script>

<template>
  <view class="page-wrap">
    <wd-navbar
      title="打印窗帘标签"
      left-arrow placeholder safe-area-inset-top fixed
      @click-left="navigateBackPlus"
    />
    <view class="preview-area">
      <view class="label-shadow">
        <canvas
          canvas-id="curtain-tag-canvas"
          :style="`width:${CANVAS_W}px;height:${canvasHeight}px;display:block;`"
        />
      </view>
    </view>
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
  padding: 48rpx 32rpx 120rpx;
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
