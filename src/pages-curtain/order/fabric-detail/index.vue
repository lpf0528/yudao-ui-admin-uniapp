<script setup lang="ts">
import type { SalesOrderProductDetail, SalesOrderProductLine } from '@/api/curtain/order'
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { cancelShipFabricProduct, getSalesOrderProductDetail, shipFabricProduct, ZcOrderType } from '@/api/curtain/order'
import { useDictStore } from '@/store/dict'
import { navigateBackPlus } from '@/utils'

const props = defineProps<{ id: string }>()

definePage({
  style: {
    navigationBarTitleText: '',
    navigationStyle: 'custom',
  },
})

const loading = ref(true)
const detail = ref<SalesOrderProductDetail>()
const infoExpanded = ref(false)
const shippingId = ref<number | null>(null)
const dictStore = useDictStore()

function confirmAction(title: string, content: string, onConfirm: () => Promise<void>) {
  uni.showModal({
    title,
    content,
    success: async (res) => {
      if (res.confirm)
        await onConfirm()
    },
  })
}

function handleShip(line: SalesOrderProductLine) {
  const isShipped = !!line.shipTime
  confirmAction(
    isShipped ? '确认撤销发货' : '确认发货',
    isShipped ? `确认撤销"${line.productName}"的发货状态？` : `确认将"${line.productName}"标记为已发货？`,
    async () => {
      shippingId.value = line.id
      try {
        if (isShipped) {
          await cancelShipFabricProduct(line.id)
        } else {
          await shipFabricProduct(line.id)
        }
        uni.showToast({ title: isShipped ? '撤销发货成功' : '发货成功', icon: 'success' })
        await loadDetail()
      } catch {} finally {
        shippingId.value = null
      }
    },
  )
}

function getStatusLabel(val: string) {
  return dictStore.getDictData('zc_order_status', val)?.label ?? val ?? '-'
}

function getStatusColorType(val: string) {
  return dictStore.getDictData('zc_order_status', val)?.colorType ?? 'default'
}

function getBatchStatusLabel(val: string) {
  return dictStore.getDictData('zc_order_batch_status', val)?.label ?? val ?? '-'
}

function getBatchStatusColorType(val: string) {
  return dictStore.getDictData('zc_order_batch_status', val)?.colorType ?? 'default'
}

function goInventory(line: SalesOrderProductLine) {
  const mat = {
    id: line.id,
    productId: line.productId,
    productName: line.productName,
    batchId: line.batchId,
    batchNo: line.batchNo,
    elementName: '面料',
    quantity: line.quantity,
    unitValue: '',
    status: line.status,
    orderType: ZcOrderType.FABRIC,
  }
  uni.navigateTo({
    url: `/pages-curtain/cutting-outbound/index?mat=${encodeURIComponent(JSON.stringify(mat))}`,
  })
}

async function loadDetail() {
  loading.value = true
  try {
    detail.value = await getSalesOrderProductDetail(Number(props.id))
  } finally {
    loading.value = false
  }
}

onShow(loadDetail)
</script>

<template>
  <view class="yd-page-container">
    <wd-navbar
      title="面料单详情"
      left-arrow placeholder safe-area-inset-top fixed
      @click-left="navigateBackPlus()"
    />

    <view v-if="loading" class="flex items-center justify-center py-120rpx">
      <wd-loading />
    </view>

    <template v-else-if="detail">
      <!-- 订单状态卡片 -->
      <view class="status-card">
        <view class="flex items-center justify-between">
          <view class="flex items-center gap-12rpx">
            <view v-if="detail.isExpedited" class="expedited-tag">
              加急
            </view>
            <view class="text-32rpx text-white font-semibold">
              {{ detail.orderNo }}
            </view>
          </view>
          <view class="status-badge" :class="`status-${getStatusColorType(detail.status)}`">
            {{ getStatusLabel(detail.status) }}
          </view>
        </view>
        <view class="mt-16rpx text-26rpx text-white/80">
          {{ detail.orderDate || '-' }}
        </view>
      </view>

      <!-- 基本信息（可折叠） -->
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
              {{ detail.customerName || '-' }}
            </view>
          </view>
          <view class="info-row">
            <view class="info-label">
              联系手机
            </view>
            <view class="info-value">
              {{ detail.mobile || '-' }}
            </view>
          </view>
          <view class="info-row">
            <view class="info-label">
              下单日期
            </view>
            <view class="info-value">
              {{ detail.orderDate || '-' }}
            </view>
          </view>
          <view class="info-row">
            <view class="info-label">
              交付日期
            </view>
            <view class="info-value">
              {{ detail.deliveryDate || '-' }}
            </view>
          </view>
          <view class="info-row">
            <view class="info-label">
              物流名称
            </view>
            <view class="info-value">
              {{ detail.logisticName || '-' }}
            </view>
          </view>
          <view class="info-row">
            <view class="info-label">
              收货人
            </view>
            <view class="info-value">
              {{ detail.receiver || '-' }}
            </view>
          </view>
          <view class="info-row full-width">
            <view class="info-label">
              送货地址
            </view>
            <view class="info-value">
              {{ detail.deliveryAddress || '-' }}
            </view>
          </view>
          <view class="info-row">
            <view class="info-label">
              运费
            </view>
            <view class="info-value">
              ¥{{ detail.freight ?? '-' }}
            </view>
          </view>
          <view class="info-row">
            <view class="info-label">
              优惠金额
            </view>
            <view class="info-value">
              ¥{{ detail.discountAmount ?? '-' }}
            </view>
          </view>
          <view class="info-row">
            <view class="info-label">
              订单金额
            </view>
            <view class="info-value">
              ¥{{ detail.amount ?? '-' }}
            </view>
          </view>
          <view class="info-row">
            <view class="info-label">
              已收金额
            </view>
            <view class="info-value">
              ¥{{ detail.amountReceived ?? '-' }}
            </view>
          </view>
          <view v-if="detail.note" class="info-row full-width">
            <view class="info-label">
              备注
            </view>
            <view class="info-value">
              {{ detail.note }}
            </view>
          </view>
        </view>
      </view>

      <!-- 产品批次明细 -->
      <view class="info-card">
        <view class="card-title">
          产品明细
        </view>
        <view v-if="!detail.batchs?.length" class="py-40rpx text-center text-28rpx text-[#999]">
          暂无产品明细
        </view>
        <view
          v-for="line in detail.batchs"
          :key="line.id"
          class="batch-item"
          @click="goInventory(line)"
        >
          <view class="batch-header">
            <view class="batch-index">
              {{ line.index }}
            </view>
            <view class="text-30rpx text-[#333] font-medium">
              {{ line.productName || '-' }}
            </view>
            <view class="batch-status" :class="`status-${getStatusColorType(line.status)}`">
              {{ getStatusLabel(line.status) }}
            </view>
          </view>
          <view class="batch-body">
            <view class="batch-row">
              <view class="batch-label">
                批次号
              </view>
              <view class="batch-value">
                {{ line.batchNo || '-' }}
              </view>
            </view>
            <view class="batch-row">
              <view class="batch-label">
                数量
              </view>
              <view class="batch-value">
                {{ line.quantity }}
              </view>
            </view>
            <view class="batch-row">
              <view class="batch-label">
                裁剪状态
              </view>
              <view class="batch-value" :class="line.cutQuantity ? 'cut-done' : 'cut-pending'">
                {{ line.cutQuantity ? '已裁剪' : '未裁剪' }}
              </view>
            </view>
            <view class="batch-row full-width">
              <view class="batch-label">
                备注
              </view>
              <view class="batch-value">
                {{ line.note || '-' }}
              </view>
            </view>
          </view>
          <view class="batch-footer">
            <wd-button
              type="info"
              size="small"
              plain
              @click.stop="() => {}"
            >
              打印发货联
            </wd-button>
            <wd-button
              :type="line.shipTime ? 'warning' : 'success'"
              size="small"
              :loading="shippingId === line.id"
              @click.stop="handleShip(line)"
            >
              {{ line.shipTime ? '撤销发货' : '发货' }}
            </wd-button>
          </view>
        </view>
      </view>
    </template>

    <view v-else class="py-120rpx text-center">
      <wd-status-tip image="content" tip="暂无数据" />
    </view>
  </view>
</template>

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
    cursor: pointer;
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

.batch-footer {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  padding: 12rpx 16rpx;
  border-top: 1rpx solid #f0f0f0;
  background-color: #fafafa;
}

.batch-item {
  border: 1rpx solid #f0f0f0;
  border-radius: 10rpx;
  overflow: hidden;
  margin-bottom: 16rpx;

  &:last-of-type {
    margin-bottom: 0;
  }
}

.batch-header {
  display: flex;
  align-items: center;
  gap: 12rpx;
  background-color: #f6ffed;
  padding: 12rpx 16rpx;
}

.batch-index {
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  background-color: #52c41a;
  color: #fff;
  font-size: 22rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.batch-status {
  margin-left: auto;
  padding: 4rpx 14rpx;
  border-radius: 4rpx;
  font-size: 24rpx;
  font-weight: 500;
}

.batch-body {
  padding: 16rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx 0;
}

.batch-row {
  width: 33.3333%;
  display: flex;
  flex-direction: column;
  gap: 4rpx;

  &.full-width {
    width: 100%;
  }
}

.batch-label {
  font-size: 24rpx;
  color: #999;
}

.batch-value {
  font-size: 28rpx;
  color: #333;
}

.cut-done {
  color: #52c41a;
}

.cut-pending {
  color: #faad14;
}

.total-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 20rpx;
  padding-top: 16rpx;
  border-top: 1rpx solid #f0f0f0;
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
