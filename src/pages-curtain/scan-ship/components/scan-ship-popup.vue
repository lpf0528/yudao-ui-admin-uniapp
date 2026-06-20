<script setup lang="ts">
import type { OrderSummary, ShipDisplayMode, ShipTableRow } from '../types'
import type { SalesOrderDetail } from '@/api/curtain/order'
import { computed, ref, watch } from 'vue'
import { useMessage } from 'wot-design-uni/components/wd-message-box/index'
import { cancelShipSalesOrderCurtain, getSalesOrderDetail, shipSalesOrderCurtain } from '@/api/curtain/order/index'
import { useOperatorStore } from '@/store'
import { useDictStore } from '@/store/dict'
import { ORDER_CURTAIN_SHIP_QR } from '../types'
import { buildShipRows } from '../utils/build-ship-rows'

const props = defineProps<{
  modelValue: boolean
  order: SalesOrderDetail | null
  codeType: string
  scanContent: Record<string, any>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'shipped': []
}>()

const message = useMessage()
const dictStore = useDictStore()
const operatorStore = useOperatorStore()

const shipping = ref(false)
const cancellingCurtainId = ref<number | null>(null)
const tableRows = ref<ShipTableRow[]>([])
const displayMode = ref<ShipDisplayMode>('fabric')
const currentOrder = ref<SalesOrderDetail | null>(null)

const isCurtainMode = computed(() => displayMode.value === 'curtain' || props.codeType === ORDER_CURTAIN_SHIP_QR)
const sectionTitle = computed(() => isCurtainMode.value ? '结构信息' : '用料信息')

const visible = computed({
  get: () => props.modelValue,
  set: value => emit('update:modelValue', value),
})

const orderSummary = computed<OrderSummary | null>(() => {
  const order = currentOrder.value
  if (!order)
    return null
  return {
    orderNo: order.orderNo || '-',
    customerName: order.customerName || '-',
    receiver: order.receiver || '-',
    deliveryAddress: order.deliveryAddress || '-',
    mobile: order.mobile || '-',
    statusCode: order.status ?? '',
  }
})

function getUnitLabel(val: string) {
  return dictStore.getDictData('zc_product_unit', val)?.label ?? val ?? '-'
}

function getOrderStatusLabel(val: string) {
  return dictStore.getDictData('zc_order_status', val)?.label ?? val ?? '-'
}

async function rebuildRows(order: SalesOrderDetail) {
  await dictStore.loadDictCache()
  const result = buildShipRows(props.codeType, order, props.scanContent, getUnitLabel)
  if (!result) {
    visible.value = false
    return
  }
  currentOrder.value = order
  displayMode.value = result.mode
  tableRows.value = result.rows
}

watch(
  () => [props.modelValue, props.order, props.codeType, props.scanContent] as const,
  async ([show, order]) => {
    if (show && order)
      await rebuildRows(order)
  },
  { immediate: true, deep: true },
)

function requirePrimaryOperator(): boolean {
  if (operatorStore.primaryOperator)
    return true
  uni.showModal({
    title: '未选择主操作员',
    content: '请先选择主操作员，是否返回首页选择？',
    confirmText: '去选择',
    success: (res) => {
      if (res.confirm)
        uni.switchTab({ url: '/pages/index/index' })
    },
  })
  return false
}

function buildOperationReq(curtainRowId: number) {
  return {
    id: curtainRowId,
    masterId: operatorStore.primaryOperator!.id,
    assistantId: operatorStore.secondaryOperator?.id,
  }
}

function handleClosePopup() {
  visible.value = false
}

async function promptCancelReason(): Promise<string | null> {
  let result: { value?: string }
  try {
    result = await message.prompt({
      title: '取消发货',
      msg: '请输入取消原因',
      inputPlaceholder: '取消原因不能为空',
    })
  } catch {
    return null
  }
  const reason = (result.value ?? '').trim()
  if (!reason) {
    uni.showToast({ title: '请输入取消原因', icon: 'none' })
    return null
  }
  return reason
}

async function refreshOrderRows() {
  if (!currentOrder.value)
    return
  const order = await getSalesOrderDetail({ id: currentOrder.value.id })
  await rebuildRows(order)
}

async function handleCancelCurtainShip(row: ShipTableRow) {
  if (!requirePrimaryOperator() || cancellingCurtainId.value)
    return

  const reason = await promptCancelReason()
  if (!reason)
    return

  cancellingCurtainId.value = row.curtainId
  uni.showLoading({ title: '取消发货中...', mask: true })
  try {
    await cancelShipSalesOrderCurtain({ ...buildOperationReq(row.curtainId), reason })
    uni.showToast({ title: '取消发货成功', icon: 'success' })
    await refreshOrderRows()
  } catch {
    uni.showToast({ title: '取消发货失败，请重试', icon: 'none' })
  } finally {
    cancellingCurtainId.value = null
    uni.hideLoading()
  }
}

async function handleConfirmShip() {
  if (!requirePrimaryOperator())
    return

  const toShip = [...new Map(
    tableRows.value
      .filter(row => row.checked && !row.shipped)
      .map(row => [row.curtainId, row]),
  ).values()]

  if (!toShip.length) {
    uni.showToast({ title: '请选择待发货的窗帘', icon: 'none' })
    return
  }

  shipping.value = true
  uni.showLoading({ title: '发货中...', mask: true })
  try {
    for (const row of toShip)
      await shipSalesOrderCurtain(buildOperationReq(row.curtainId))
    uni.showToast({ title: '发货成功', icon: 'success' })
    visible.value = false
    emit('shipped')
  } catch {
    uni.showToast({ title: '发货失败，请重试', icon: 'none' })
  } finally {
    shipping.value = false
    uni.hideLoading()
  }
}
</script>

<template>
  <wd-popup v-model="visible" position="center" custom-style="border-radius: 16rpx; overflow: hidden;">
    <view class="material-popup">
      <view class="material-popup__title">
        扫码发货
      </view>
      <view v-if="orderSummary" class="order-info">
        <view class="order-info__row">
          <text class="order-info__label">订单号</text>
          <text class="order-info__value">{{ orderSummary.orderNo }}</text>
        </view>
        <view class="order-info__row">
          <text class="order-info__label">客户名称</text>
          <text class="order-info__value">{{ orderSummary.customerName }}</text>
        </view>
        <view class="order-info__row">
          <text class="order-info__label">收货人</text>
          <text class="order-info__value">{{ orderSummary.receiver }}</text>
        </view>
        <view class="order-info__row">
          <text class="order-info__label">地址</text>
          <text class="order-info__value">{{ orderSummary.deliveryAddress }}</text>
        </view>
        <view class="order-info__row">
          <text class="order-info__label">电话</text>
          <text class="order-info__value">{{ orderSummary.mobile }}</text>
        </view>
        <view class="order-info__row">
          <text class="order-info__label">订单状态</text>
          <text class="order-info__value">{{ getOrderStatusLabel(orderSummary.statusCode) }}</text>
        </view>
      </view>
      <view class="material-section-title">
        {{ sectionTitle }}
      </view>
      <scroll-view scroll-x scroll-y class="material-popup__scroll">
        <!-- 成品窗帘：结构信息 -->
        <view v-if="isCurtainMode" class="material-table">
          <view class="material-table__row material-table__row--head">
            <view class="material-table__cell material-table__cell--check" />
            <view class="material-table__cell material-table__cell--structure">
              结构名称
            </view>
            <view class="material-table__cell material-table__cell--size">
              尺寸
            </view>
            <view class="material-table__cell material-table__cell--status">
              状态
            </view>
          </view>
          <view
            v-for="row in tableRows"
            :key="row.rowKey"
            class="material-table__row"
          >
            <view class="material-table__cell material-table__cell--check">
              <wd-checkbox v-model="row.checked" shape="square" :disabled="row.shipped" />
            </view>
            <view class="material-table__cell material-table__cell--structure">
              {{ row.structureName }}
            </view>
            <view class="material-table__cell material-table__cell--size">
              {{ row.sizeDisplay }}
            </view>
            <view
              class="material-table__cell material-table__cell--status"
              :class="row.shipped ? 'ship-action--cancel' : 'ship-status--pending'"
              @click="row.shipped && handleCancelCurtainShip(row)"
            >
              {{ row.shipped ? '取消发货' : '未发货' }}
            </view>
          </view>
        </view>
        <!-- 面料单：用料信息 -->
        <view v-else class="material-table">
          <view class="material-table__row material-table__row--head">
            <view class="material-table__cell material-table__cell--check" />
            <view class="material-table__cell material-table__cell--product">
              产品（规格）
            </view>
            <view class="material-table__cell material-table__cell--usage">
              用料
            </view>
            <view class="material-table__cell material-table__cell--status">
              状态
            </view>
          </view>
          <view
            v-for="row in tableRows"
            :key="row.rowKey"
            class="material-table__row"
          >
            <view class="material-table__cell material-table__cell--check">
              <wd-checkbox v-model="row.checked" shape="square" :disabled="row.shipped" />
            </view>
            <view class="material-table__cell material-table__cell--product">
              {{ row.productDisplay }}
            </view>
            <view class="material-table__cell material-table__cell--usage">
              {{ row.usage }}
            </view>
            <view
              class="material-table__cell material-table__cell--status"
              :class="row.shipped ? 'ship-action--cancel' : 'ship-status--pending'"
              @click="row.shipped && handleCancelCurtainShip(row)"
            >
              {{ row.shipped ? '取消发货' : '未发货' }}
            </view>
          </view>
        </view>
      </scroll-view>
      <view class="material-popup__footer material-popup__footer--actions">
        <wd-button plain :disabled="shipping" @click="handleClosePopup">
          取消
        </wd-button>
        <wd-button type="primary" :loading="shipping" @click="handleConfirmShip">
          确认发货
        </wd-button>
      </view>
    </view>
  </wd-popup>

  <wd-message-box />
</template>

<style lang="scss" scoped>
.material-popup {
  width: 680rpx;
  max-width: 92vw;
  background-color: #fff;
}

.material-popup__title {
  padding: 28rpx 32rpx 20rpx;
  font-size: 32rpx;
  font-weight: 600;
  color: #333;
  text-align: center;
  border-bottom: 1rpx solid #f0f0f0;
}

.order-info {
  padding: 20rpx 32rpx;
  border-bottom: 1rpx solid #f0f0f0;
  background-color: #fafafa;
}

.order-info__row {
  display: flex;
  align-items: flex-start;
  gap: 16rpx;
  padding: 8rpx 0;
  font-size: 26rpx;
  line-height: 1.5;
}

.order-info__label {
  flex-shrink: 0;
  width: 128rpx;
  color: #999;
}

.order-info__value {
  flex: 1;
  color: #333;
  word-break: break-all;
}

.material-section-title {
  padding: 20rpx 32rpx 12rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: #333;
}

.material-popup__scroll {
  max-height: 40vh;
}

.material-popup__footer {
  padding: 20rpx 32rpx 28rpx;
  border-top: 1rpx solid #f0f0f0;

  &--actions {
    display: flex;
    gap: 24rpx;

    :deep(.wd-button) {
      flex: 1;
    }
  }
}

.material-table {
  min-width: 100%;
}

.material-table__row {
  display: flex;
  border-bottom: 1rpx solid #f0f0f0;

  &:last-child {
    border-bottom: none;
  }

  &--head {
    background-color: #fafafa;

    .material-table__cell {
      font-weight: 600;
      color: #666;
    }
  }
}

.material-table__cell {
  flex-shrink: 0;
  padding: 20rpx 16rpx;
  font-size: 26rpx;
  color: #333;
  line-height: 1.5;
  word-break: break-all;

  &--check {
    width: 80rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20rpx 8rpx;

    :deep(.wd-checkbox__shape) {
      border-radius: 6rpx;
    }
  }

  &--product {
    flex: 1;
    min-width: 240rpx;
  }

  &--structure {
    flex: 1;
    min-width: 200rpx;
  }

  &--size {
    width: 160rpx;
  }

  &--usage {
    width: 120rpx;
  }

  &--status {
    width: 140rpx;
  }
}

.ship-action--cancel {
  color: #1890ff;
  font-weight: 500;
}

.ship-status--pending {
  color: #ff4d4f;
  font-weight: 500;
}
</style>
