<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getSalesOrderDetail } from '@/api/curtain/order'
import { navigateBackPlus } from '@/utils'
import { deliveryPrintTodayStr, printDeliverySlip } from '@/utils/print-delivery-slip'

definePage({
  style: {
    navigationBarTitleText: '',
    navigationStyle: 'custom',
  },
})

const detail = ref<Awaited<ReturnType<typeof getSalesOrderDetail>>>()
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
async function handlePrintApp() {
  if (!detail.value)
    return
  printing.value = true
  try {
    await printDeliverySlip(detail.value)
    uni.showToast({ title: '已发送至打印机 ✓', icon: 'success' })
  } catch (e: any) {
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
          <view class="slip-dashed-line" />
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
              {{ deliveryPrintTodayStr() }}
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
          <view class="slip-dashed-line slip-dashed-line--bottom" />
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
  .page-wrap {
    background: #fff !important;
  }
  .slip-container {
    padding: 0 !important;
  }
  .slip {
    width: 100% !important;
    padding-top: 0 !important;
    padding-bottom: 0 !important;
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
  padding: 48rpx 32rpx 32rpx;
}

.slip {
  width: 428rpx; /* 57mm */
  background: #fff;
  border-radius: 8rpx;
  padding: 32rpx 28rpx;
  box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.1);
}

.slip-dashed-line {
  height: 0;
  border-top: 2rpx dashed #aaaaaa;
  margin: 0 -28rpx 20rpx;

  &--bottom {
    margin-top: 20rpx;
    margin-bottom: 0;
  }
}

.slip-title {
  text-align: center;
  font-size: 40rpx;
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
  margin-bottom: 18rpx;
}

.slip-label {
  flex-shrink: 0;
  width: 136rpx;
  font-size: 30rpx;
  font-weight: 700;
  color: #555;
  line-height: 44rpx;
}

.slip-value {
  flex: 1;
  font-size: 30rpx;
  font-weight: 700;
  color: #111;
  line-height: 44rpx;
  word-break: break-all;
}

.action-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 24rpx 32rpx;
  padding-bottom: calc(24rpx + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1rpx solid #f0f0f0;
}
</style>
