<script setup lang="ts">
import type { OrderProcessRecord } from '@/api/curtain/order-process-record/index'
import { getOrderProcessRecordList, revokeOrderProcessRecord } from '@/api/curtain/order-process-record/index'

definePage({
  style: {
    navigationBarTitleText: '操作记录',
  },
})

const filterParams = ref<{
  orderId?: number
  masterId?: number
  curtainId?: number
  structureId?: number
  materialId?: number
  nodeId?: number
}>({})

const records = ref<OrderProcessRecord[]>([])
const loading = ref(false)
const revoking = ref<number | null>(null)

function formatTime(str: string) {
  if (!str)
    return ''
  return str.replace('T', ' ').slice(0, 16)
}

async function loadRecords() {
  loading.value = true
  try {
    records.value = await getOrderProcessRecordList(filterParams.value)
  } finally {
    loading.value = false
  }
}

onLoad(async (query) => {
  const numFields = ['orderId', 'masterId', 'curtainId', 'structureId', 'materialId', 'nodeId'] as const
  for (const key of numFields) {
    if (query?.[key])
      (filterParams.value as any)[key] = Number(query[key])
  }

  if (query?.title)
    uni.setNavigationBarTitle({ title: query.title })

  await loadRecords()
})

function handleRevoke(item: OrderProcessRecord) {
  uni.showModal({
    title: '撤销工序记录',
    content: `确认撤销【${item.nodeName}】记录？`,
    confirmColor: '#f5222d',
    confirmText: '撤销',
    success: async (res) => {
      if (!res.confirm)
        return
      revoking.value = item.id
      try {
        await revokeOrderProcessRecord({ id: item.id })
        // 本地更新状态，避免重新请求
        const target = records.value.find(r => r.id === item.id)
        if (target)
          target.status = 2
        uni.showToast({ title: '撤销成功', icon: 'success' })
      } catch (e: any) {
        uni.showToast({ title: e?.msg ?? e?.message ?? '撤销失败', icon: 'none' })
      } finally {
        revoking.value = null
      }
    },
  })
}
</script>

<template>
  <view class="page-body">
    <view v-if="loading" class="empty-tip">
      <wd-loading color="#018d71" />
      <text class="tip-text">加载中...</text>
    </view>

    <view v-else-if="!records.length" class="empty-tip">
      <view class="i-carbon-document text-80rpx text-#ccc" />
      <text class="tip-text">暂无操作记录</text>
    </view>

    <view v-else class="list">
      <view
        v-for="item in records"
        :key="item.id"
        class="item"
        :class="{ 'item--revoked': item.status === 2 }"
      >
        <!-- 左侧：工序标签 -->
        <view class="item-node">
          <text class="item-node-text">{{ item.nodeName }}</text>
        </view>

        <!-- 中间：内容 -->
        <view class="item-content">
          <view class="item-top">
            <text class="item-order">{{ item.orderNo }}</text>
            <view v-if="item.status === 2" class="item-revoked-tag">
              已撤销
            </view>
            <text class="item-time">{{ formatTime(item.createTime) }}</text>
          </view>
          <view v-if="item.curtainName" class="item-curtain">
            <view class="i-carbon-text-font text-22rpx text-#aaa" />
            <text class="item-curtain-text">{{ item.curtainName }}</text>
          </view>
          <view class="item-operators">
            <text class="item-operator-name">{{ item.masterName }}</text>
            <text v-if="item.assistantName" class="item-operator-sep">·</text>
            <text v-if="item.assistantName" class="item-operator-name item-operator-name--sub">{{ item.assistantName }}</text>
          </view>
          <text v-if="item.note" class="item-note">{{ item.note }}</text>
        </view>

        <!-- 右侧：撤销按钮（仅 status=1 可撤销） -->
        <view v-if="item.status === 1" class="item-action" @tap="handleRevoke(item)">
          <wd-loading v-if="revoking === item.id" size="32rpx" color="#f5222d" />
          <view v-else class="i-carbon-undo text-40rpx text-[#f5222d]" />
          <text class="item-action-text">撤销</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
.page-body {
  min-height: 100vh;
  background-color: #f5f5f5;
}

.empty-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 200rpx;
}

.tip-text {
  margin-top: 16rpx;
  font-size: 28rpx;
  color: #999;
}

.list {
  padding: 16rpx 0;
}

.item {
  display: flex;
  align-items: center;
  background-color: #fff;
  border-bottom: 1rpx solid #f0f0f0;
  padding: 24rpx 32rpx;
  gap: 24rpx;

  &--revoked {
    opacity: 0.55;

    .item-node {
      background-color: #e0e0e0;
    }

    .item-node-text {
      color: #999;
    }
  }
}

.item-node {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 88rpx;
  padding: 0 16rpx;
  border-radius: 10rpx;
  background-color: #e8f4f0;
  flex-shrink: 0;
  align-self: flex-start;
  min-height: 56rpx;
}

.item-node-text {
  font-size: 26rpx;
  font-weight: 700;
  color: #018d71;
  white-space: nowrap;
}

.item-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
}

.item-top {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.item-order {
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-revoked-tag {
  font-size: 20rpx;
  color: #fff;
  background-color: #bbb;
  padding: 2rpx 12rpx;
  border-radius: 20rpx;
  flex-shrink: 0;
}

.item-time {
  font-size: 22rpx;
  color: #bbb;
  flex-shrink: 0;
}

.item-curtain {
  display: flex;
  align-items: center;
  gap: 8rpx;
}

.item-curtain-text {
  font-size: 24rpx;
  color: #999;
}

.item-operators {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.item-operator-name {
  font-size: 26rpx;
  color: #555;

  &--sub {
    color: #999;
  }
}

.item-operator-sep {
  font-size: 22rpx;
  color: #ccc;
}

.item-note {
  font-size: 24rpx;
  color: #999;
  line-height: 1.5;
}

.item-action {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
  padding: 8rpx 12rpx;
  flex-shrink: 0;
  align-self: center;
}

.item-action-text {
  font-size: 22rpx;
  color: #f5222d;
}
</style>
