<script setup lang="ts">
import type { OrderProcessRecord } from '@/api/curtain/order-process-record/index'
import { getOrderProcessRecordList, revokeOrderProcessRecord } from '@/api/curtain/order-process-record/index'

definePage({
  style: {
    navigationBarTitleText: '操作记录',
  },
})

const filterParams = ref<{
  masterId?: number
}>({})

const records = ref<OrderProcessRecord[]>([])
const loading = ref(false)
const revoking = ref<number | null>(null)

function formatTime(val: string | number) {
  if (!val)
    return ''
  if (typeof val === 'number') {
    const d = new Date(val)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }
  return val.replace('T', ' ').slice(0, 16)
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
  if (query?.masterId)
    filterParams.value.masterId = Number(query.masterId)

  if (query?.title)
    uni.setNavigationBarTitle({ title: query.title })

  await loadRecords()
})

const showRevokeModal = ref(false)
const revokingItem = ref<OrderProcessRecord | null>(null)

function handleRevoke(item: OrderProcessRecord) {
  revokingItem.value = item
  showRevokeModal.value = true
}

async function confirmRevoke() {
  if (!revokingItem.value)
    return
  const item = revokingItem.value
  showRevokeModal.value = false
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
    revokingItem.value = null
  }
}

function cancelRevoke() {
  showRevokeModal.value = false
  revokingItem.value = null
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

    <scroll-view v-else scroll-x class="list-scroll">
      <view class="list">
        <!-- 表头 -->
        <view class="item item--header">
          <text class="item-order header-text">订单号</text>
          <text class="item-curtain header-text">款式</text>
          <text class="item-room header-text">房间</text>
          <text class="item-structure header-text">结构</text>
          <view class="item-node-header">
            <text class="header-text">工序</text>
          </view>
          <text class="item-operators header-text">操作人员</text>
          <view class="item-note-header">
            <text class="header-text">备注</text>
          </view>
          <text class="item-action-col header-text" style="text-align: center;">操作</text>
        </view>

        <view
          v-for="item in records"
          :key="item.id"
          class="item"
          :class="{ 'item--revoked': item.status === 2 }"
        >
          <!-- 订单号 -->
          <text class="item-order">{{ item.orderNo || '-' }}</text>

          <!-- 款式 -->
          <text class="item-curtain">{{ item.curtainName || '-' }}</text>

          <!-- 空间 -->
          <text class="item-room">{{ item.room || '-' }}</text>

          <!-- 结构 -->
          <text class="item-structure">{{ item.structureName || '-' }}</text>

          <!-- 工序 -->
          <view class="item-node">
            <text class="item-node-text">{{ item.nodeName }}</text>
          </view>

          <!-- 操作人员 -->
          <view class="item-operators">
            <text class="item-operator-name">{{ item.masterName || '-' }}</text>
            <text v-if="item.assistantName" class="item-operator-sep">·</text>
            <text v-if="item.assistantName" class="item-operator-name item-operator-name--sub">{{ item.assistantName }}</text>
          </view>

          <!-- 备注 -->
          <text class="item-note" :class="{ 'item-note--empty': !item.note }">{{ item.note || '-' }}</text>

          <!-- 右侧：撤销操作 / 状态 -->
          <view class="item-action-col">
            <view v-if="item.status === 2" class="item-revoked-tag">
              已撤销
            </view>
            <view v-else-if="item.status === 1 && item.nodeGroup !== 0" class="item-action" @tap="handleRevoke(item)">
              <wd-loading v-if="revoking === item.id" size="54rpx" color="#f5222d" />
              <view v-else class="i-carbon-undo text-54rpx text-[#f5222d]" />
              <text class="item-action-text">撤销</text>
            </view>
            <text v-else class="item-placeholder">-</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 自定义撤销确认弹窗 -->
    <view v-if="showRevokeModal" class="custom-modal-mask" @tap="cancelRevoke">
      <view class="custom-modal" @tap.stop>
        <view class="custom-modal-title">
          撤销工序记录
        </view>
        <view class="custom-modal-content">
          确认撤销【{{ revokingItem?.nodeName }}】记录？
        </view>
        <view class="custom-modal-actions">
          <button class="modal-btn modal-btn--cancel" @tap="cancelRevoke">
            取消
          </button>
          <button class="modal-btn modal-btn--confirm" @tap="confirmRevoke">
            撤销
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
$font-scale: 1.5;

@function fs($size) {
  @return $size * $font-scale * 1rpx;
}

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
  font-size: fs(36);
  color: #999;
}

.list-scroll {
  width: 100%;
  overflow: hidden;
}

.list {
  padding: 16rpx 0;
  width: max-content;
  min-width: 100%;
}

.item {
  display: flex;
  align-items: center;
  background-color: #fff;
  border-bottom: 1rpx solid #f0f0f0;
  padding: fs(24) fs(20);
  gap: fs(18);
  min-width: 100%;
  width: max-content;
  box-sizing: border-box;

  &--header {
    background-color: #fafafa;
    border-bottom: 2rpx solid #e8e8e8;
  }

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

.header-text {
  font-size: fs(36);
  font-weight: bold;
  color: #333;
}

.item-order {
  width: fs(450);
  font-size: fs(36);
  font-weight: 600;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.4;
  flex-shrink: 0;
}

.item-curtain {
  width: fs(200);
  font-size: fs(36);
  color: #666;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 0;
}

.item-room {
  width: fs(160);
  font-size: fs(36);
  color: #666;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 0;
}

.item-structure {
  width: fs(180);
  font-size: fs(36);
  color: #666;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 0;
}

.item-node {
  width: fs(330);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 fs(10);
  border-radius: 10rpx;
  background-color: #e8f4f0;
  flex-shrink: 0;
  min-height: fs(56);
  box-sizing: border-box;
}

.item-node-header {
  width: fs(330);
  flex-shrink: 0;
  text-align: center;
}

.item-node-text {
  font-size: fs(36);
  font-weight: 700;
  color: #018d71;
  white-space: nowrap;
}

.item-operators {
  width: fs(180);
  display: flex;
  align-items: center;
  gap: fs(6);
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-operator-name {
  font-size: fs(36);
  color: #555;
  line-height: 1.4;
  white-space: nowrap;

  &--sub {
    color: #999;
  }
}

.item-operator-sep {
  font-size: fs(36);
  color: #ccc;
}

.item-note {
  width: fs(220);
  flex-grow: 1;
  font-size: fs(36);
  color: #999;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  background-color: #fafafa;
  padding: fs(4) fs(10);
  border-radius: 6rpx;
  border: 1rpx solid #eee;
  flex-shrink: 0;
  box-sizing: border-box;

  &--empty {
    background-color: transparent;
    border: none;
    padding: 0;
    color: #ccc;
    text-align: center;
  }
}

.item-note-header {
  width: fs(220);
  flex-grow: 1;
  flex-shrink: 0;
  text-align: center;
}

.item-revoked-tag {
  font-size: fs(36);
  color: #fff;
  background-color: #bbb;
  padding: fs(2) fs(10);
  border-radius: fs(16);
  flex-shrink: 0;
  white-space: nowrap;
}

.item-action-col {
  width: fs(120);
  display: flex;
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
}

.item-action {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: fs(4);
  padding: fs(6) fs(8);
  flex-shrink: 0;
}

.item-action-text {
  font-size: fs(36);
  color: #f5222d;
}

.item-placeholder {
  font-size: fs(36);
  color: #ccc;
  text-align: center;
}

.custom-modal-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 999;
}

.custom-modal {
  width: 65%;
  max-width: fs(720);
  min-width: fs(480);
  background-color: #fff;
  border-radius: fs(24);
  padding: fs(48) fs(40);
  box-sizing: border-box;
  box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  align-items: center;
}

.custom-modal-title {
  font-size: fs(38);
  font-weight: bold;
  color: #333;
  text-align: center;
  margin-bottom: fs(32);
}

.custom-modal-content {
  font-size: fs(34);
  color: #666;
  text-align: center;
  line-height: 1.5;
  margin-bottom: fs(48);
}

.custom-modal-actions {
  width: 100%;
  display: flex;
  gap: fs(24);
}

.modal-btn {
  flex: 1;
  height: fs(88);
  line-height: fs(88);
  font-size: fs(34);
  border-radius: fs(12);
  text-align: center;
  margin: 0;
  padding: 0;
  border: none;
  box-sizing: border-box;
  font-weight: 500;

  &::after {
    border: none;
  }

  &--cancel {
    background-color: #f5f5f5;
    color: #666;
  }

  &--confirm {
    background-color: #f5222d;
    color: #fff;

    &:active {
      background-color: #d32029;
    }
  }
}
</style>
