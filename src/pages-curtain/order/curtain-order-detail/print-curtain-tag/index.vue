<script setup lang="ts">
import type { CurtainPrintData } from '@/utils/print-curtain-tag'
import { getCurrentInstance, nextTick, onMounted, ref } from 'vue'
import { getSalesOrderDetail } from '@/api/curtain/order'
import { useDictStore } from '@/store/dict'
import { navigateBackPlus } from '@/utils'
import {
  calculateCurtainPrintCanvasHeight,
  CURTAIN_PRINT_CANVAS_W,
  drawCurtainPrintLabel,
  printCurtainTagToDevice,
} from '@/utils/print-curtain-tag'

definePage({
  style: {
    navigationBarTitleText: '',
    navigationStyle: 'custom',
  },
})

const instance = getCurrentInstance()
const dictStore = useDictStore()

const printData = ref<CurtainPrintData>({
  code: '',
  orderNo: '',
  customerName: '',
  receiver: '',
  orderDate: '',
  curtainIndex: 0,
  totalSets: 0,
  curtainDetail: null,
  getUnitLabel: (val: string) => dictStore.getDictData('zc_product_unit', val)?.label ?? val ?? '',
})
const canvasHeight = ref(400)
const drawn = ref(false)
const saving = ref(false)
const pageOrderId = ref(0)
const pageCurtainId = ref(0)

async function drawLabel() {
  if (!printData.value.code)
    return
  await drawCurtainPrintLabel(printData.value, 'curtain-tag-canvas', instance?.proxy, canvasHeight.value)
  drawn.value = true
}

async function loadCurtainDetail() {
  if (!pageOrderId.value)
    return
  try {
    const order = await getSalesOrderDetail({ id: pageOrderId.value })
    printData.value.curtainDetail = order.curtains?.find(c => c.id === pageCurtainId.value) ?? null
  } catch {}
  canvasHeight.value = calculateCurtainPrintCanvasHeight(printData.value)
  await nextTick()
  setTimeout(() => void drawLabel(), 100)
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
          width: CURTAIN_PRINT_CANVAS_W,
          height: canvasHeight.value,
          destWidth: CURTAIN_PRINT_CANVAS_W * 3,
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
    await printCurtainTagToDevice('curtain-tag-canvas', instance?.proxy, canvasHeight.value)
    uni.showToast({ title: '已发送至打印机 ✓', icon: 'success' })
  } catch (e: any) {
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
  const dec = (key: string) => decodeURIComponent(opts[key] ?? '')
  printData.value = {
    code: dec('code'),
    orderNo: dec('orderNo'),
    customerName: dec('customerName'),
    receiver: dec('receiver'),
    orderDate: dec('orderDate'),
    curtainIndex: Number(opts.curtainIndex ?? 0),
    totalSets: Number(opts.totalSets ?? 0),
    curtainDetail: null,
    getUnitLabel: (val: string) => dictStore.getDictData('zc_product_unit', val)?.label ?? val ?? '',
  }
  pageOrderId.value = Number(opts.orderId ?? 0)
  pageCurtainId.value = Number(opts.curtainId ?? 0)
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
          :style="`width:${CURTAIN_PRINT_CANVAS_W}px;height:${canvasHeight}px;display:block;`"
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
