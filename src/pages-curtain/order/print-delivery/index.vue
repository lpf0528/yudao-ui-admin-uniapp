<script setup lang="ts">
import type { SalesOrderDetail } from '@/api/curtain/order'
import type { TextStyle } from '@/uni_modules/sunmi-printersdk/utssdk/interface.uts'
import { onMounted, ref } from 'vue'
import { getSalesOrderDetail } from '@/api/curtain/order'
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

function todayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const detail = ref<SalesOrderDetail>()
const loading = ref(true)
const printing = ref(false)

onMounted(async () => {
  const pages = getCurrentPages()
  const cur = pages[pages.length - 1] as any
  const opts = cur.$page?.options ?? cur.options ?? {}
  const orderId = Number(decodeURIComponent(opts.orderId ?? ''))
  try {
    detail.value = await getSalesOrderDetail({ id: orderId })
  } finally {
    loading.value = false
  }
})

// #ifdef H5
function handlePrint() {
  window.print()
}
// #endif

// #ifdef APP-PLUS
let printerReady = false

function makeTextStyle(align: number, textSize: number): TextStyle {
  return {
    align,
    fontStyle: 1,
    textSize,
    textWidthRatio: 0,
    textHeightRatio: 0,
    posX: 0,
    posY: 0,
    width: 0,
    height: 0,
    rotate: 0,
    textSpace: 0,
  }
}

function initSunmiSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('初始化超时（5s）')), 5000)
    PrinterSdk.initPrinter((success: boolean, message: string) => {
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
  if (!detail.value)
    return
  printing.value = true
  try {
    if (!printerReady) {
      uni.showToast({ title: '初始化打印机…', icon: 'none', duration: 2000 })
      await initSunmiSdk()
    }
    const d = detail.value
    // align: 2=CENTER, 1=LEFT; 57mm@203DPI=456dots
    LineApi.initLine({ align: 2, width: 456, height: 0, renderColor: 0, posX: 0 })
    LineApi.printText('发货联', makeTextStyle(2, 32))
    LineApi.printDividingLine(1, 2)
    const left = makeTextStyle(1, 24)
    LineApi.printText(`订单号：${d.orderNo}`, left)
    LineApi.printText(`客户名称：${d.customerName || '-'}`, left)
    LineApi.printText(`收货人：${d.receiver || '-'}`, left)
    LineApi.printText(`打印日期：${todayStr()}`, left)
    LineApi.printText(`电话：${d.mobile || '-'}`, left)
    LineApi.printText(`收货地址：${d.deliveryAddress || '-'}`, left)
    LineApi.printDividingLine(1, 2)
    LineApi.autoOut()
    uni.showToast({ title: '已发送至打印机 ✓', icon: 'success' })
  } catch (e: any) {
    printerReady = false
    uni.showToast({ title: e.message || '打印失败', icon: 'none', duration: 3000 })
  } finally {
    printing.value = false
  }
}
// #endif
</script>

<template>
  <view class="page-wrap">
    <wd-navbar
      title="发货联预览"
      left-arrow placeholder safe-area-inset-top fixed
      @click-left="navigateBackPlus()"
    />

    <view v-if="loading" class="flex items-center justify-center py-120rpx">
      <wd-loading />
    </view>

    <template v-else-if="detail">
      <view class="slip-container">
        <view class="slip">
          <view class="slip-title">
            发货联
          </view>
          <view class="slip-divider" />

          <view class="slip-row">
            <view class="slip-label">
              订单号
            </view>
            <view class="slip-value">
              {{ detail.orderNo }}
            </view>
          </view>
          <view class="slip-row">
            <view class="slip-label">
              客户名称
            </view>
            <view class="slip-value">
              {{ detail.customerName || '-' }}
            </view>
          </view>
          <view class="slip-row">
            <view class="slip-label">
              收货人
            </view>
            <view class="slip-value">
              {{ detail.receiver || '-' }}
            </view>
          </view>
          <view class="slip-row">
            <view class="slip-label">
              打印日期
            </view>
            <view class="slip-value">
              {{ todayStr() }}
            </view>
          </view>
          <view class="slip-row">
            <view class="slip-label">
              电话
            </view>
            <view class="slip-value">
              {{ detail.mobile || '-' }}
            </view>
          </view>
          <view class="slip-row">
            <view class="slip-label">
              收货地址
            </view>
            <view class="slip-value">
              {{ detail.deliveryAddress || '-' }}
            </view>
          </view>

          <view class="slip-divider slip-divider--bottom" />
        </view>
      </view>
    </template>

    <view v-else class="py-120rpx text-center">
      <wd-status-tip image="content" tip="暂无数据" />
    </view>

    <view class="action-bar">
      <!-- #ifdef H5 -->
      <wd-button type="primary" block @click="handlePrint">
        打印
      </wd-button>
      <!-- #endif -->
      <!-- #ifdef APP-PLUS -->
      <wd-button type="primary" block :loading="printing" @click="handlePrintApp">
        {{ printing ? '打印中…' : '打印' }}
      </wd-button>
      <!-- #endif -->
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
  .page-wrap {
    background: #fff !important;
  }
  .slip-container {
    padding: 0 !important;
  }
  .slip {
    box-shadow: none !important;
    border: none !important;
  }
}
</style>
<!-- #endif -->

<style lang="scss" scoped>
.page-wrap {
  min-height: 100vh;
  background-color: #f4f6f9;
  padding-bottom: 160rpx;
}

.slip-container {
  display: flex;
  justify-content: center;
  padding: 32rpx 24rpx;
}

.slip {
  width: 428rpx; /* 57mm */
  min-height: 528rpx; /* 70mm */
  background: #fff;
  border-radius: 8rpx;
  padding: 32rpx 28rpx;
  box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.1);
}

.slip-title {
  text-align: center;
  font-size: 34rpx;
  font-weight: 700;
  color: #111;
  letter-spacing: 6rpx;
  margin-bottom: 20rpx;
}

.slip-divider {
  height: 2rpx;
  background-color: #333;
  margin-bottom: 24rpx;

  &--dotted {
    background: none;
    border-top: 2rpx dashed #999;
    margin-top: 20rpx;
  }

  &--bottom {
    margin-top: 28rpx;
    margin-bottom: 0;
  }
}

.slip-row {
  display: flex;
  align-items: flex-start;
  gap: 12rpx;
  margin-bottom: 14rpx;
}

.slip-label {
  flex-shrink: 0;
  width: 120rpx;
  font-size: 24rpx;
  font-weight: 700;
  color: #555;
  line-height: 38rpx;
}

.slip-value {
  flex: 1;
  font-size: 24rpx;
  font-weight: 700;
  color: #111;
  line-height: 38rpx;
  word-break: break-all;
}

.action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20rpx 32rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1rpx solid #f0f0f0;
}
</style>
