<template>
  <view class="min-h-screen bg-#f7f8fa">
    <wd-navbar title="扫码发货" left-arrow safe-area-inset-top placeholder @click-left="handleBack" />

    <view v-if="!orderDetail" class="px-32rpx pt-64rpx text-center">
      <view class="text-36rpx text-#1f1f1f font-600">
        扫码发货
      </view>
      <view class="mt-20rpx text-28rpx text-#8c8c8c">
        点击下方扫码按钮，扫描订单码完成发货
      </view>
    </view>

    <view v-if="!orderDetail" class="mt-120rpx text-center text-26rpx text-#bfbfbf">
      {{ isLoading ? '正在识别并查询订单，请稍候...' : '支持相机扫码（H5 环境下为手动输入模拟）' }}
    </view>

    <template v-if="orderDetail">
      <view class="status-card">
        <view class="flex items-center justify-between">
          <view class="flex items-center gap-12rpx">
            <view v-if="orderDetail.isExpedited" class="expedited-tag">
              加急
            </view>
            <view class="text-32rpx text-white font-semibold">
              {{ orderDetail.orderNo || '-' }}
            </view>
          </view>
          <view class="status-badge" :class="`status-${getStatusColorType(orderDetail.status)}`">
            {{ getStatusLabel(orderDetail.status) }}
          </view>
        </view>
        <view class="mt-16rpx text-26rpx text-white/80">
          {{ orderDetail.orderDate || '-' }}
        </view>
      </view>

      <view class="info-card">
        <view class="card-title card-title--clickable" :class="{ 'card-title--open': infoExpanded }" @click="infoExpanded = !infoExpanded">
          <view>基本信息</view>
          <view class="collapse-arrow" :class="{ expanded: infoExpanded }">
            ▾
          </view>
        </view>
        <view v-if="infoExpanded" class="info-grid">
          <view class="info-row">
            <view class="info-label">
              客户名称
            </view>
            <view class="info-value">
              {{ orderDetail.customerName || '-' }}
            </view>
          </view>
          <view class="info-row">
            <view class="info-label">
              联系手机
            </view>
            <view class="info-value">
              {{ orderDetail.mobile || '-' }}
            </view>
          </view>
          <view class="info-row">
            <view class="info-label">
              下单日期
            </view>
            <view class="info-value">
              {{ orderDetail.orderDate || '-' }}
            </view>
          </view>
          <view class="info-row">
            <view class="info-label">
              交付日期
            </view>
            <view class="info-value">
              {{ orderDetail.deliveryDate || '-' }}
            </view>
          </view>
          <view class="info-row">
            <view class="info-label">
              物流名称
            </view>
            <view class="info-value">
              {{ orderDetail.logisticName || '-' }}
            </view>
          </view>
          <view class="info-row">
            <view class="info-label">
              收货人
            </view>
            <view class="info-value">
              {{ orderDetail.receiver || '-' }}
            </view>
          </view>
          <view class="info-row full-width">
            <view class="info-label">
              送货地址
            </view>
            <view class="info-value">
              {{ orderDetail.deliveryAddress || '-' }}
            </view>
          </view>
          <view v-if="orderDetail.note" class="info-row full-width">
            <view class="info-label">
              备注
            </view>
            <view class="info-value">
              {{ orderDetail.note }}
            </view>
          </view>
        </view>
      </view>
    </template>

    <view
      class="fixed z-10 h-160rpx w-160rpx flex items-center justify-center rounded-full bg-#1890ff shadow-lg"
      :class="{ 'opacity-60': isLoading }"
      :style="btnStyle"
      @touchstart.stop="onTouchStart"
      @touchmove.stop.prevent="onTouchMove"
      @touchend.stop="onTouchEnd"
    >
      <view v-if="!isLoading" class="i-carbon-scan text-72rpx text-white" />
      <view v-else class="i-carbon-loading animate-spin text-72rpx text-white" />
    </view>

    <wd-message-box />
  </view>
</template>

<script setup lang="ts">
import type { SalesOrderDetail } from '@/api/curtain/order/index'
import { computed, onMounted, reactive, ref } from 'vue'
import { useMessage } from 'wot-design-uni/components/wd-message-box/index'
import { getBarcodeRegistry } from '@/api/curtain/barcode-registry/index'
import { getSalesOrderDetail } from '@/api/curtain/order/index'
import { useDictStore } from '@/store/dict'

const message = useMessage()
const dictStore = useDictStore()
const orderDetail = ref<SalesOrderDetail | null>(null)
const isLoading = ref(false)
const infoExpanded = ref(true)
const pos = reactive({ x: 0, y: 0 })
const isDragging = ref(false)
let startTouch = { x: 0, y: 0 }
let startPos = { x: 0, y: 0 }
let btnSize = 0

onMounted(() => {
  const info = uni.getSystemInfoSync()
  const ratio = info.windowWidth / 750
  btnSize = Math.round(160 * ratio)
  // 初始位置：右下角（right: 32rpx, bottom: 220rpx）
  pos.x = info.windowWidth - btnSize - Math.round(32 * ratio)
  pos.y = info.windowHeight - Math.round(220 * ratio) - btnSize

  uni.showModal({
    title: '提示',
    content: '请点击扫码按钮进行扫码发货',
    showCancel: false,
  })
})

const btnStyle = computed(() => ({
  left: `${pos.x}px`,
  top: `${pos.y}px`,
}))

function onTouchStart(e: TouchEvent) {
  if (isLoading.value)
    return

  isDragging.value = false
  startTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  startPos = { x: pos.x, y: pos.y }
}

function onTouchMove(e: TouchEvent) {
  if (isLoading.value)
    return

  isDragging.value = true
  const info = uni.getSystemInfoSync()
  const dx = e.touches[0].clientX - startTouch.x
  const dy = e.touches[0].clientY - startTouch.y
  pos.x = Math.max(0, Math.min(info.windowWidth - btnSize, startPos.x + dx))
  pos.y = Math.max(0, Math.min(info.windowHeight - btnSize, startPos.y + dy))
}

function onTouchEnd() {
  if (!isDragging.value) {
    handleScanCode()
  }
  isDragging.value = false
}

function handleBack() {
  if (getCurrentPages().length > 1) {
    uni.navigateBack()
    return
  }
  uni.reLaunch({ url: '/pages/index/index' })
}

function getStatusLabel(val: string) {
  return dictStore.getDictData('zc_order_status', val)?.label ?? val ?? '-'
}

function getStatusColorType(val: string) {
  return dictStore.getDictData('zc_order_status', val)?.colorType ?? 'default'
}

async function handleCodeId(codeId: string) {
  const id = codeId.trim()
  if (!id) {
    uni.showToast({ title: '扫码内容为空', icon: 'none' })
    return
  }

  isLoading.value = true
  uni.showLoading({
    title: '加载中',
    mask: true,
  })

  let data: Awaited<ReturnType<typeof getBarcodeRegistry>>
  try {
    data = await getBarcodeRegistry(id)
  } catch {
    uni.showToast({ title: '获取条码注册信息失败', icon: 'none' })
    uni.hideLoading()
    isLoading.value = false
    return
  }

  let content: Record<string, any>
  try {
    content = JSON.parse(data.codeContent ?? '{}') as Record<string, any>
  } catch {
    uni.showToast({ title: '条码注册信息格式错误', icon: 'none' })
    uni.hideLoading()
    isLoading.value = false
    return
  }

  const orderId = Number(content.orderId)
  if (!Number.isFinite(orderId) || orderId <= 0) {
    uni.showToast({ title: '条码未包含有效订单ID(orderId)', icon: 'none' })
    uni.hideLoading()
    isLoading.value = false
    return
  }

  try {
    orderDetail.value = await getSalesOrderDetail({ id: orderId })
  } catch {
    uni.showToast({ title: '获取订单信息失败', icon: 'none' })
    uni.hideLoading()
    isLoading.value = false
    return
  }

  uni.hideLoading()
  isLoading.value = false
  uni.showToast({ title: '订单获取成功', icon: 'success' })
}

async function handleH5MockScan() {
  let result: { value?: string }
  try {
    result = await message.prompt({
      title: '模拟扫码',
      msg: '请输入扫码内容',
      inputPlaceholder: '请输入码内容',
    })
  } catch {
    return
  }

  const value = result.value?.trim() ?? ''
  await handleCodeId(value)
}

function handleScanCode() {
  if (isLoading.value)
    return

  // #ifndef H5
  uni.scanCode({
    onlyFromCamera: false,
    success: async (res) => {
      const value = (res.result || '').trim()
      await handleCodeId(value)
    },
    fail: (err) => {
      if (err.errMsg?.includes('cancel'))
        return
      uni.showToast({ title: '扫码失败，请重试', icon: 'none' })
    },
  })
  // #endif

  // #ifdef H5
  handleH5MockScan()
  // #endif
}

definePage({
  style: {
    navigationStyle: 'custom',
  },
})
</script>

<style lang="scss" scoped>
.status-card {
  background: linear-gradient(135deg, #52c41a, #389e0d);
  padding: 32rpx 24rpx;
  margin: 16rpx 24rpx;
  border-radius: 12rpx;
}

.status-badge {
  padding: 4rpx 16rpx;
  border-radius: 4rpx;
  font-size: 24rpx;
  font-weight: 500;
  background-color: rgba(255, 255, 255, 0.2);
  color: #fff;
}

.expedited-tag {
  padding: 2rpx 12rpx;
  border-radius: 4rpx;
  font-size: 22rpx;
  background-color: #ff4d4f;
  color: #fff;
}

.info-card {
  background-color: #fff;
  margin: 0 24rpx 16rpx;
  border-radius: 12rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
}

.card-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 20rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #f0f0f0;

  &--clickable {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0;
  }

  &--open {
    margin-bottom: 20rpx;
  }
}

.collapse-arrow {
  font-size: 28rpx;
  color: #999;
  transition: transform 0.2s;
  transform: rotate(-90deg);

  &.expanded {
    transform: rotate(0deg);
  }
}

.info-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx 0;
}

.info-row {
  width: 50%;
  display: flex;
  flex-direction: column;
  gap: 4rpx;

  &.full-width {
    width: 100%;
  }
}

.info-label {
  font-size: 24rpx;
  color: #999;
}

.info-value {
  font-size: 28rpx;
  color: #333;
}

.status-warning {
  background-color: #fff7e6;
  color: #faad14;
}

.status-primary {
  background-color: #e6f7ff;
  color: #1890ff;
}

.status-info {
  background-color: #e6fffb;
  color: #13c2c2;
}

.status-success {
  background-color: #f6ffed;
  color: #52c41a;
}

.status-danger {
  background-color: #fff1f0;
  color: #ff4d4f;
}

.status-default {
  background-color: #f5f5f5;
  color: #999;
}
</style>
