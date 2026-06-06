<script setup lang="ts">
import type { ZcInventoryRecordRespVO } from '@/api/curtain/inventory-record'
import type { LoadMoreState } from '@/http/types'
import { onMounted, ref } from 'vue'
import { getInventoryRecordPage } from '@/api/curtain/inventory-record'
import { navigateBackPlus } from '@/utils'

definePage({
  style: {
    navigationBarTitleText: '',
    navigationStyle: 'custom',
  },
})

const batchId = ref<number | undefined>()
const batchNo = ref('')

const list = ref<ZcInventoryRecordRespVO[]>([])
const total = ref(0)
const loadMoreState = ref<LoadMoreState>('loading')
const queryParams = ref({ pageNo: 1, pageSize: 50 })
const isLoadingMore = ref(false)

const OPERATE_MAP: Record<string, { label: string, color: string, bg: string }> = {
  PANDIAN: { label: '盘点', color: '#722ed1', bg: '#f9f0ff' },
  RUKU: { label: '入库', color: '#52c41a', bg: '#f6ffed' },
  CAIJIAN: { label: '裁剪', color: '#1890ff', bg: '#e6f7ff' },
  CANCEL_CAIJIAN: { label: '撤销裁剪', color: '#ff4d4f', bg: '#fff2f0' },
}

function getOperateInfo(operate: string) {
  return OPERATE_MAP[operate] ?? { label: operate, color: '#999', bg: '#f5f5f5' }
}

function handleBack() {
  navigateBackPlus()
}

async function getList(append = false) {
  if (!append) {
    loadMoreState.value = 'loading'
  }
  try {
    const data = await getInventoryRecordPage({
      ...queryParams.value,
      batchId: batchId.value,
    })
    if (append) {
      list.value.push(...data.list)
    } else {
      list.value = data.list
    }
    total.value = data.total
    loadMoreState.value = list.value.length >= data.total ? 'finished' : 'more'
  } catch {
    loadMoreState.value = 'error'
  } finally {
    isLoadingMore.value = false
  }
}

async function loadMore() {
  if (loadMoreState.value !== 'more' || isLoadingMore.value)
    return
  isLoadingMore.value = true
  queryParams.value.pageNo += 1
  await getList(true)
}

onMounted(() => {
  const pages = getCurrentPages()
  const current = pages[pages.length - 1] as any
  const opts = current.$page?.options ?? current.options ?? {}

  batchId.value = opts.batchId ? Number(opts.batchId) : undefined
  batchNo.value = opts.batchNo ? decodeURIComponent(opts.batchNo) : ''

  getList()
})
</script>

<template>
  <view class="yd-page-container">
    <wd-navbar
      :title="batchNo ? `${batchNo} · 裁剪记录` : '裁剪记录'"
      left-arrow placeholder safe-area-inset-top fixed
      @click-left="handleBack"
    />

    <view class="stat-bar">
      <text class="stat-text">共 {{ total }} 条记录</text>
    </view>

    <view class="p-24rpx">
      <view
        v-for="item in list"
        :key="item.id"
        class="record-card"
      >
        <view class="card-header">
          <view class="operate-tag" :style="{ color: getOperateInfo(item.operate).color, backgroundColor: getOperateInfo(item.operate).bg }">
            {{ getOperateInfo(item.operate).label }}
          </view>
          <view class="create-time">
            {{ item.createTime || '-' }}
          </view>
        </view>

        <view class="quantity-row">
          <view class="qty-divider" />
          <view class="qty-block">
            <view class="qty-label">
              变化前
            </view>
            <view class="qty-value qty-old">
              {{ item.oldQuantity }}
            </view>
          </view>
          <view class="qty-divider" />
          <view class="qty-block">
            <view class="qty-label">
              变化后
            </view>
            <view class="qty-value qty-new">
              {{ item.newQuantity }}
            </view>
          </view>
          <view class="qty-block">
            <view class="qty-label">
              变化数量
            </view>
            <view class="qty-value" :class="item.changeQuantity > 0 ? 'qty-increase' : item.changeQuantity < 0 ? 'qty-decrease' : ''">
              {{ item.changeQuantity > 0 ? `+${item.changeQuantity}` : item.changeQuantity < 0 ? `-${Math.abs(item.changeQuantity)}` : '0' }}
            </view>
          </view>
        </view>

        <view class="detail-grid">
          <view class="detail-item">
            <text class="detail-label">操作人</text>
            <text class="detail-value">{{ item.nickname || item.creator || '-' }}</text>
          </view>
          <view v-if="item.orderId" class="detail-item">
            <text class="detail-label">关联订单</text>
            <text class="detail-value">{{ item.orderId }}</text>
          </view>
          <view v-if="item.note" class="detail-item full-width">
            <text class="detail-label">备注</text>
            <text class="detail-value">{{ item.note }}</text>
          </view>
        </view>
      </view>

      <wd-loadmore
        v-if="list.length > 0"
        :state="loadMoreState === 'more' ? 'loading' : loadMoreState === 'finished' ? 'finished' : 'finished'"
        @reload="loadMore"
      />
      <view v-if="loadMoreState !== 'loading' && list.length === 0" class="py-100rpx text-center">
        <wd-status-tip image="content" tip="暂无裁剪记录" />
      </view>
      <view v-if="loadMoreState === 'loading' && list.length === 0" class="py-100rpx text-center">
        <wd-loading />
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.stat-bar {
  padding: 16rpx 24rpx;
  background-color: #f8f9fb;
  border-bottom: 1rpx solid #f0f0f0;
}

.stat-text {
  font-size: 24rpx;
  color: #999;
}

.record-card {
  background-color: #fff;
  border-radius: 12rpx;
  margin-bottom: 16rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 24rpx 16rpx;
  border-bottom: 1rpx solid #f5f5f5;
}

.operate-tag {
  font-size: 24rpx;
  font-weight: 500;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
}

.create-time {
  font-size: 24rpx;
  color: #999;
}

.quantity-row {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
}

.qty-block {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
}

.qty-divider {
  width: 1rpx;
  height: 56rpx;
  background-color: #eee;
  flex-shrink: 0;
}

.qty-label {
  font-size: 22rpx;
  color: #999;
}

.qty-value {
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
}

.qty-decrease {
  color: #ff4d4f;
}

.qty-increase {
  color: #52c41a;
}

.qty-old {
  color: #999;
}

.qty-new {
  color: #1890ff;
}

.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  padding: 16rpx 24rpx 20rpx;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 0;

  &.full-width {
    grid-column: 1 / -1;
  }
}

.detail-label {
  font-size: 24rpx;
  color: #999;
  white-space: nowrap;
  flex-shrink: 0;
}

.detail-value {
  font-size: 24rpx;
  color: #555;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
