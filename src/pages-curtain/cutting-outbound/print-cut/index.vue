<script setup lang="ts">
import type { CutPrintData } from '@/utils/print-cut-label'
import { getCurrentInstance, nextTick, onMounted, ref } from 'vue'
import { navigateBackPlus } from '@/utils'
import {
  calculateCutPrintCanvasHeight,
  CUT_PRINT_CANVAS_W,
  drawCutPrintLabel,
  printCutLabelToDevice,
} from '@/utils/print-cut-label'

definePage({
  style: {
    navigationBarTitleText: '',
    navigationStyle: 'custom',
  },
})

const instance = getCurrentInstance()

const printData = ref<CutPrintData>({
  qrCode: '',
  orderNo: '',
  customerName: '',
  curtainName: '',
  structureName: '',
  elementName: '',
  productName: '',
  cutQuantity: '',
  unitLabel: '',
})
const drawn = ref(false)
const saving = ref(false)
const canvasHeight = ref(0)

async function drawLabel() {
  await drawCutPrintLabel(printData.value, 'cut-canvas', instance?.proxy, canvasHeight.value)
  drawn.value = true
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
          canvasId: 'cut-canvas',
          x: 0,
          y: 0,
          width: CUT_PRINT_CANVAS_W,
          height: canvasHeight.value,
          destWidth: CUT_PRINT_CANVAS_W * 3,
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
async function handlePrintApp() {
  if (!drawn.value) {
    uni.showToast({ title: '图片生成中，请稍候', icon: 'none' })
    return
  }
  saving.value = true
  try {
    uni.showToast({ title: '生成图片…', icon: 'none', duration: 1500 })
    await printCutLabelToDevice('cut-canvas', instance?.proxy, canvasHeight.value)
    uni.showToast({ title: '已发送至打印机 ✓', icon: 'success' })
  } catch (e: any) {
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
  const dec = (key: string) => decodeURIComponent(opts[key] ?? '')
  printData.value = {
    qrCode: dec('qrCode'),
    orderNo: dec('orderNo'),
    customerName: dec('customerName'),
    curtainName: dec('curtainName'),
    structureName: dec('structureName'),
    elementName: dec('elementName'),
    productName: dec('productName'),
    cutQuantity: dec('cutQuantity'),
    unitLabel: dec('unitLabel'),
  }
  canvasHeight.value = calculateCutPrintCanvasHeight(printData.value)
  await nextTick()
  setTimeout(() => void drawLabel(), 100)
})
</script>

<template>
  <view class="page-wrap">
    <wd-navbar
      title="裁剪信息打印"
      left-arrow placeholder safe-area-inset-top fixed
      @click-left="navigateBackPlus"
    />

    <view class="preview-area">
      <view class="label-shadow">
        <canvas
          canvas-id="cut-canvas"
          :style="`width:${CUT_PRINT_CANVAS_W}px;height:${canvasHeight}px;display:block;`"
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
