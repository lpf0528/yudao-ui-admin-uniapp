<script setup lang="ts">
import type { SalesOrderDetail } from '@/api/curtain/order'
import type { WorkshopUserSimple } from '@/api/curtain/workshop-user/index'
import { storeToRefs } from 'pinia'
import { getSalesOrderDetail } from '@/api/curtain/order'
import { getWorkshopUserSimpleList } from '@/api/curtain/workshop-user/index'
import { useOperatorStore } from '@/store'

definePage({
  style: {
    navigationBarTitleText: '工序操作',
  },
})

const operatorStore = useOperatorStore()
const { primaryOperator, secondaryOperator } = storeToRefs(operatorStore)

const userList = ref<WorkshopUserSimple[]>([])
const pickerTarget = ref<'primary' | 'secondary'>('primary')
const showPicker = ref(false)
const orderNo = ref('')
const orderDetail = ref<SalesOrderDetail | null>(null)
const searching = ref(false)
const locateCurtainId = ref<number | null>(null)
const locateStructureId = ref<number | null>(null)

type DeliveryLevel = 'overdue' | 'today' | 'soon' | 'normal'

interface DeliveryStatus {
  text: string
  level: DeliveryLevel
}

const deliveryStatus = computed<DeliveryStatus | null>(() => {
  const date = orderDetail.value?.deliveryDate
  if (!date)
    return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diffDays < 0)
    return { text: `已超期 ${-diffDays} 天`, level: 'overdue' }
  if (diffDays === 0)
    return { text: '今日要交货', level: 'today' }
  if (diffDays <= 3)
    return { text: `还有 ${diffDays} 天交货`, level: 'soon' }
  return { text: `还有 ${diffDays} 天交货`, level: 'normal' }
})

const filteredCurtains = computed(() => {
  const curtains = orderDetail.value?.curtains ?? []
  if (!locateCurtainId.value)
    return curtains
  return curtains.filter(c => c.id === locateCurtainId.value)
})

function filteredStructures(curtainId: number, structures: SalesOrderDetail['curtains'][0]['structures']) {
  if (curtainId !== locateCurtainId.value || !locateStructureId.value)
    return structures
  return structures.filter(s => s.id === locateStructureId.value)
}

// 是否纯面料单（无成品帘工序）
const isFabricOnly = computed(() => {
  const t = orderDetail.value?.types ?? ''
  return (t.includes('FABRIC') || t.includes('面料单'))
    && !t.includes('CURTAIN') && !t.includes('成品帘')
})

async function handleOrderSearch() {
  const no = orderNo.value.trim()
  if (!no)
    return
  searching.value = true
  orderDetail.value = null
  try {
    orderDetail.value = await getSalesOrderDetail({ orderNo: no })
  } catch {
    uni.showToast({ title: '未找到该订单', icon: 'none' })
  } finally {
    searching.value = false
  }
}

onLoad(async (query) => {
  userList.value = await getWorkshopUserSimpleList()
  if (query?.orderNo) {
    orderNo.value = query.orderNo
    if (query.curtainId)
      locateCurtainId.value = Number(query.curtainId)
    if (query.structureId)
      locateStructureId.value = Number(query.structureId)
    await handleOrderSearch()
  }
})

function openPicker(target: 'primary' | 'secondary') {
  pickerTarget.value = target
  showPicker.value = true
}

const currentSelectedId = computed(() =>
  pickerTarget.value === 'primary' ? primaryOperator.value?.id : secondaryOperator.value?.id,
)

const disabledId = computed(() =>
  pickerTarget.value === 'primary' ? secondaryOperator.value?.id : primaryOperator.value?.id,
)

function selectUser(user: WorkshopUserSimple) {
  if (user.id === disabledId.value) {
    uni.showToast({ title: '主副操作员不能是同一人', icon: 'none' })
    return
  }
  if (pickerTarget.value === 'primary')
    operatorStore.setPrimary(user)
  else
    operatorStore.setSecondary(user)
  showPicker.value = false
}
</script>

<template>
  <view class="page-body">
    <!-- 左上角操作员 -->
    <view class="operator-panel">
      <view class="operator-item primary" @tap="openPicker('primary')">
        <view class="operator-avatar primary">
          <view class="i-carbon-user-avatar-filled text-64rpx text-[#018d71]" />
        </view>
        <view class="operator-info">
          <text class="operator-role">主操作员</text>
          <view class="operator-name-row">
            <text class="operator-name primary">{{ primaryOperator ? primaryOperator.name : '请选择' }}</text>
            <view class="i-carbon-chevron-down text-28rpx text-[#018d71]" />
          </view>
        </view>
      </view>
      <view class="operator-item secondary" @tap="openPicker('secondary')">
        <view class="operator-avatar secondary">
          <view class="i-carbon-user-avatar-filled text-42rpx text-[#666]" />
        </view>
        <view class="operator-info">
          <text class="operator-role secondary">副操作员</text>
          <view class="operator-name-row">
            <text class="operator-name secondary">{{ secondaryOperator ? secondaryOperator.name : '请选择' }}</text>
            <view class="i-carbon-chevron-down text-20rpx text-#999" />
            <view
              v-if="secondaryOperator"
              class="i-carbon-close-filled text-24rpx text-#ccc"
              @tap.stop="operatorStore.setSecondary(null)"
            />
          </view>
        </view>
      </view>

      <!-- 交货提醒 -->
      <view v-if="deliveryStatus" class="delivery-divider" />
      <view v-if="deliveryStatus" class="delivery-badge" :class="`delivery-badge--${deliveryStatus.level}`">
        <view
          class="text-28rpx"
          :class="{
            'i-carbon-alarm': deliveryStatus.level === 'overdue',
            'i-carbon-warning-filled': deliveryStatus.level === 'today',
            'i-carbon-time': deliveryStatus.level === 'soon',
            'i-carbon-calendar': deliveryStatus.level === 'normal',
          }"
        />
        <text class="delivery-text">{{ deliveryStatus.text }}</text>
      </view>
    </view>

    <!-- 订单号输入框 -->
    <view class="order-input-wrap">
      <view class="order-input-box">
        <view class="i-carbon-document text-32rpx text-#aaa" />
        <input
          v-model="orderNo"
          class="order-input"
          placeholder="请输入订单号"
          placeholder-style="color:#bbb"
          confirm-type="search"
          @confirm="handleOrderSearch"
        >
        <view
          v-if="orderNo"
          class="i-carbon-close-filled text-32rpx text-#ccc"
          @tap="orderNo = ''"
        />
      </view>
    </view>

    <!-- 搜索中 -->
    <view v-if="searching" class="empty-tip">
      <wd-loading color="#018d71" />
      <text class="mt-16rpx text-28rpx text-#999">查询中...</text>
    </view>

    <!-- 无结果 -->
    <view v-else-if="!orderDetail" class="empty-tip">
      <view class="i-carbon-document text-80rpx text-#ccc" />
      <text class="mt-16rpx text-28rpx text-#999">输入订单号后按回车查询</text>
    </view>

    <!-- 面料单提示 -->
    <view v-else-if="isFabricOnly" class="content-wrap">
      <view class="fabric-warning">
        <view class="i-carbon-warning text-48rpx text-[#fa8c16]" />
        <text class="fabric-warning-text">该订单为面料单，不需要进行工序操作</text>
      </view>
    </view>

    <!-- 订单详情 -->
    <view v-else class="content-wrap">
      <!-- 订单基本信息 -->
      <view class="order-card">
        <view class="order-card-row">
          <text class="order-card-label">订单号</text>
          <text class="order-card-value font-600">{{ orderDetail.orderNo }}</text>
        </view>
        <view class="order-card-row">
          <text class="order-card-label">客户</text>
          <text class="order-card-value">{{ orderDetail.customerName }}</text>
        </view>
        <view class="order-card-row">
          <text class="order-card-label">交付日期</text>
          <text class="order-card-value">{{ orderDetail.deliveryDate || '-' }}</text>
        </view>
        <view class="order-card-row">
          <text class="order-card-label">订单类型</text>
          <text class="order-card-value">{{ orderDetail.types || '-' }}</text>
        </view>
        <view v-if="orderDetail.isExpedited" class="expedited-tag">
          加急
        </view>
      </view>

      <!-- 窗帘行列表 -->
      <view
        v-for="curtain in filteredCurtains"
        :key="curtain.id"
        class="curtain-card"
        :class="{ 'curtain-card--located': curtain.id === locateCurtainId }"
      >
        <view class="curtain-header">
          <text class="curtain-index">第 {{ curtain.index }} 帘</text>
          <text class="curtain-name">{{ curtain.curtainName }}</text>
          <text v-if="curtain.room" class="curtain-room">{{ curtain.room }}</text>
        </view>
        <view
          v-for="structure in filteredStructures(curtain.id, curtain.structures)"
          :key="structure.id"
          class="structure-block"
          :class="{ 'structure-block--located': structure.id === locateStructureId }"
        >
          <view class="structure-title">
            {{ structure.structureName }}
            <text class="structure-size">{{ structure.width }} × {{ structure.height }}</text>
          </view>
          <view
            v-for="mat in structure.materials"
            :key="mat.id"
            class="material-row"
          >
            <view class="material-left">
              <text class="material-element">{{ mat.elementName }}</text>
              <text class="material-product">{{ mat.productName }}</text>
            </view>
            <view class="material-right">
              <text class="material-qty">{{ mat.quantity }} {{ mat.unitValue }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>

  <!-- 操作员切换弹框 -->
  <wd-popup v-model="showPicker" position="center">
    <view class="picker-wrap">
      <view class="picker-header">
        <text class="text-30rpx text-#333 font-500">切换{{ pickerTarget === 'primary' ? '主' : '副' }}操作员</text>
        <view class="i-carbon-close text-36rpx text-#999" @tap="showPicker = false" />
      </view>
      <scroll-view scroll-y style="max-height: 50vh">
        <view
          v-for="user in userList"
          :key="user.id"
          class="picker-item"
          :class="{
            'picker-item--selected': user.id === currentSelectedId,
            'picker-item--disabled': user.id === disabledId,
          }"
          @tap="selectUser(user)"
        >
          <text>{{ user.name }}</text>
          <view v-if="user.id === currentSelectedId" class="i-carbon-checkmark text-32rpx text-[#018d71]" />
          <text v-else-if="user.id === disabledId" class="text-24rpx text-#ccc">已选为{{ pickerTarget === 'primary' ? '副' : '主' }}操作员</text>
        </view>
      </scroll-view>
    </view>
  </wd-popup>
</template>

<style lang="scss" scoped>
.page-body {
  min-height: 100vh;
  background-color: #f5f5f5;
}

.operator-panel {
  display: flex;
  align-items: flex-end;
  margin: 24rpx 24rpx 0;
  padding: 28rpx 32rpx;
  background-color: #fff;
  border-radius: 16rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.operator-item {
  display: flex;
  align-items: center;

  &.primary {
    gap: 18rpx;
  }

  &.secondary {
    gap: 12rpx;
    margin-left: 32rpx;
  }
}

.operator-avatar {
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &.primary {
    width: 100rpx;
    height: 100rpx;
    background-color: #e8f4f0;
  }

  &.secondary {
    width: 66rpx;
    height: 66rpx;
    background-color: #f5f5f5;
  }
}

.operator-info {
  display: flex;
  flex-direction: column;
}

.operator-role {
  font-size: 22rpx;
  color: #999;
  margin-bottom: 6rpx;

  &.secondary {
    font-size: 20rpx;
    margin-bottom: 4rpx;
  }
}

.operator-name-row {
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.operator-name {
  font-weight: 600;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;

  &.primary {
    font-size: 42rpx;
    color: #018d71;
    max-width: 200rpx;
  }

  &.secondary {
    font-size: 28rpx;
    color: #555;
    max-width: 140rpx;
  }
}

.order-input-wrap {
  margin: 20rpx 24rpx 0;
}

.order-input-box {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 0 28rpx;
  height: 88rpx;
  background-color: #fff;
  border-radius: 12rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}

.order-input {
  flex: 1;
  font-size: 30rpx;
  color: #333;
}

.empty-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 200rpx;
}

.content-wrap {
  padding: 24rpx;
}

.delivery-divider {
  width: 2rpx;
  height: 72rpx;
  background-color: #f0f0f0;
  margin: 0 20rpx;
  flex-shrink: 0;
}

.delivery-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 16rpx 20rpx;
  border-radius: 12rpx;
  flex-shrink: 0;

  &--overdue {
    background-color: #fff1f0;
    color: #f5222d;
  }

  &--today {
    background-color: #fff7e6;
    color: #d46b08;
  }

  &--soon {
    background-color: #fffbe6;
    color: #d4b106;
  }

  &--normal {
    background-color: #f6ffed;
    color: #389e0d;
  }
}

.delivery-text {
  font-size: 22rpx;
  font-weight: 600;
  text-align: center;
  line-height: 1.4;
}

.fabric-warning {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60rpx 40rpx;
  background-color: #fffbe6;
  border: 1rpx solid #ffe58f;
  border-radius: 12rpx;
}

.fabric-warning-text {
  margin-top: 16rpx;
  font-size: 28rpx;
  color: #d46b08;
  text-align: center;
}

.order-card {
  position: relative;
  padding: 28rpx 32rpx;
  background-color: #fff;
  border-radius: 12rpx;
  margin-bottom: 20rpx;
}

.order-card-row {
  display: flex;
  align-items: center;
  padding: 10rpx 0;
}

.order-card-label {
  width: 140rpx;
  font-size: 26rpx;
  color: #999;
  flex-shrink: 0;
}

.order-card-value {
  flex: 1;
  font-size: 28rpx;
  color: #333;
}

.expedited-tag {
  position: absolute;
  top: 28rpx;
  right: 32rpx;
  padding: 4rpx 16rpx;
  background-color: #fff1f0;
  color: #f5222d;
  font-size: 22rpx;
  border-radius: 6rpx;
  border: 1rpx solid #ffa39e;
}

.curtain-card {
  background-color: #fff;
  border-radius: 12rpx;
  margin-bottom: 20rpx;
  overflow: hidden;

  &--located {
    border: 2rpx solid #018d71;
    box-shadow: 0 0 0 4rpx rgba(1, 141, 113, 0.12);
  }
}

.curtain-header {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 22rpx 32rpx;
  background-color: #f0faf7;
  border-bottom: 1rpx solid #e8f4f0;
}

.curtain-index {
  font-size: 24rpx;
  color: #018d71;
  font-weight: 600;
}

.curtain-name {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
  flex: 1;
}

.curtain-room {
  font-size: 24rpx;
  color: #999;
}

.structure-block {
  padding: 16rpx 32rpx;
  border-bottom: 1rpx solid #f5f5f5;

  &:last-child {
    border-bottom: none;
  }

  &--located {
    background-color: #f0faf7;
  }
}

.structure-title {
  display: flex;
  align-items: center;
  gap: 16rpx;
  font-size: 26rpx;
  color: #555;
  font-weight: 500;
  margin-bottom: 12rpx;
}

.structure-size {
  font-size: 24rpx;
  color: #aaa;
  font-weight: 400;
}

.material-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10rpx 0;
}

.material-left {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.material-element {
  font-size: 22rpx;
  color: #fff;
  background-color: #aaa;
  padding: 2rpx 10rpx;
  border-radius: 4rpx;
}

.material-product {
  font-size: 26rpx;
  color: #333;
}

.material-right {
  flex-shrink: 0;
}

.material-qty {
  font-size: 26rpx;
  color: #666;
}

.picker-wrap {
  width: 560rpx;
  padding: 32rpx 0 0;
  border-radius: 16rpx;
  overflow: hidden;
}

.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32rpx 24rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.picker-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx;
  font-size: 30rpx;
  color: #333;

  &:first-child {
    margin-top: 16rpx;
  }

  &:last-child {
    margin-bottom: 16rpx;
  }

  &--selected {
    color: #018d71;
    background-color: #f0faf7;
  }

  &--disabled {
    color: #ccc;
  }
}
</style>
