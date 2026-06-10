<script setup lang="ts">
import type { SalesOrderCurtainDetail, SalesOrderDetail, SalesOrderMaterialDetail } from '@/api/curtain/order'
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { useMessage } from 'wot-design-uni/components/wd-message-box/index'
import { cancelPackSalesOrderCurtain, cancelShipSalesOrderCurtain, completeSalesOrder, getSalesOrderDetail, packSalesOrderCurtain, shipSalesOrderCurtain, ZcOrderStatus, ZcOrderType } from '@/api/curtain/order'
import { useOperatorStore } from '@/store'
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
const detail = ref<SalesOrderDetail>()
const infoExpanded = ref(false)
const dictStore = useDictStore()
const operatorStore = useOperatorStore()
const message = useMessage()

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

function getStatusLabel(val: string) {
  return dictStore.getDictData('zc_order_status', val)?.label ?? val ?? '-'
}

function getStatusColorType(val: string) {
  return dictStore.getDictData('zc_order_status', val)?.colorType ?? 'default'
}

function getMatStatusLabel(val: string) {
  return dictStore.getDictData('zc_order_batch_status', val)?.label ?? val ?? '-'
}

function getMatStatusColorType(val: string) {
  return dictStore.getDictData('zc_order_batch_status', val)?.colorType ?? 'default'
}

function getTypeLabel(val: string) {
  return dictStore.getDictData('zc_order_type', val)?.label ?? val ?? '-'
}

function getUnitLabel(val: string) {
  return dictStore.getDictData('zc_product_unit', val)?.label ?? val ?? '-'
}

function goCurtainDetail(curtainId: number) {
  uni.navigateTo({
    url: `/pages-curtain/order/curtain-order-detail/curtain-item/index?orderId=${props.id}&curtainId=${curtainId}`,
  })
}

const packingId = ref<number | null>(null)
const shippingId = ref<number | null>(null)

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

function buildOperationReq(curtainId: number): CurtainRowOperationReq {
  return {
    id: curtainId,
    masterId: operatorStore.primaryOperator!.id,
    assistantId: operatorStore.secondaryOperator?.id,
  }
}

async function promptCancelReason(title: string): Promise<string | null> {
  let result: { value?: string }
  try {
    result = await message.prompt({
      title,
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

async function handlePack(curtain: SalesOrderCurtainDetail) {
  if (!requirePrimaryOperator())
    return
  const isPacked = !!curtain.packTime

  if (isPacked) {
    const reason = await promptCancelReason('撤销打包')
    if (!reason)
      return
    packingId.value = curtain.id
    try {
      await cancelPackSalesOrderCurtain({ ...buildOperationReq(curtain.id), reason })
      uni.showToast({ title: '撤销打包成功', icon: 'success' })
      await loadDetail()
    } catch {} finally {
      packingId.value = null
    }
  } else {
    confirmAction('确认打包', '确认将该窗帘标记为已打包？', async () => {
      packingId.value = curtain.id
      try {
        await packSalesOrderCurtain(buildOperationReq(curtain.id))
        uni.showToast({ title: '打包成功', icon: 'success' })
        await loadDetail()
      } catch {} finally {
        packingId.value = null
      }
    })
  }
}

async function handleShip(curtain: SalesOrderCurtainDetail) {
  if (!requirePrimaryOperator())
    return
  const isShipped = !!curtain.shipTime

  if (isShipped) {
    const reason = await promptCancelReason('撤销发货')
    if (!reason)
      return
    shippingId.value = curtain.id
    try {
      await cancelShipSalesOrderCurtain({ ...buildOperationReq(curtain.id), reason })
      uni.showToast({ title: '撤销发货成功', icon: 'success' })
      await loadDetail()
    } catch {} finally {
      shippingId.value = null
    }
  } else {
    confirmAction('确认发货', '确认将该窗帘标记为已发货？', async () => {
      shippingId.value = curtain.id
      try {
        await shipSalesOrderCurtain(buildOperationReq(curtain.id))
        uni.showToast({ title: '发货成功', icon: 'success' })
        await loadDetail()
      } catch {} finally {
        shippingId.value = null
      }
    })
  }
}

const completing = ref(false)

async function handleComplete() {
  uni.showModal({
    title: '确认完成',
    content: '订单标记完成后，将不会显示。',
    success: async (res) => {
      if (!res.confirm)
        return
      completing.value = true
      try {
        await completeSalesOrder(Number(props.id))
        uni.showToast({ title: '订单已完成', icon: 'success' })
        await loadDetail()
      } catch {} finally {
        completing.value = false
      }
    },
  })
}

function openPrintDelivery() {
  uni.navigateTo({
    url: `/pages-curtain/order/print-delivery/index?orderId=${encodeURIComponent(props.id)}`,
  })
}

function goInventory(mat: SalesOrderMaterialDetail) {
  uni.navigateTo({
    url: `/pages-curtain/cutting-outbound/index?mat=${encodeURIComponent(JSON.stringify({ ...mat, orderType: ZcOrderType.CURTAIN }))}`,
  })
}

async function loadDetail() {
  loading.value = true
  try {
    detail.value = await getSalesOrderDetail({ id: Number(props.id) })
  } finally {
    loading.value = false
  }
}

onShow(loadDetail)
</script>

<template>
  <view class="yd-page-container">
    <wd-navbar
      title="订单详情"
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
        <view class="mt-16rpx flex items-center gap-24rpx">
          <view class="text-26rpx text-white/80">
            {{ getTypeLabel(detail.types) }}
          </view>
          <view class="text-26rpx text-white/80">
            {{ detail.orderDate || '-' }}
          </view>
        </view>
      </view>

      <!-- 基本信息 -->
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
              创建人
            </view>
            <view class="info-value">
              {{ detail.creatorName || '-' }}
            </view>
          </view>
          <view class="info-row">
            <view class="info-label">
              创建时间
            </view>
            <view class="info-value">
              {{ detail.createTime || '-' }}
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

      <!-- 窗帘明细操作区 -->
      <view class="mx-24rpx mb-0 flex items-center justify-end gap-16rpx rounded-t-12rpx bg-white px-24rpx py-16rpx">
        <wd-button type="info" size="small" @click="openPrintDelivery">
          打印发货联
        </wd-button>
        <wd-button
          type="success"
          size="small"
          :loading="completing"
          :disabled="detail.status === ZcOrderStatus.UNCONFIRMED || detail.status === ZcOrderStatus.COMPLETE"
          @click="handleComplete"
        >
          完成
        </wd-button>
      </view>

      <!-- 窗帘明细 -->
      <view class="info-card">
        <view class="card-title card-title--curtain">
          窗帘明细
        </view>
        <view v-if="!detail.curtains?.length" class="py-40rpx text-center text-28rpx text-[#999]">
          暂无窗帘明细
        </view>
        <view
          v-for="(curtain, idx) in detail.curtains"
          :key="curtain.id"
          class="curtain-block"
        >
          <!-- 窗帘行标题 -->
          <view class="curtain-header">
            <view class="min-w-0 flex flex-1 items-center gap-8rpx">
              <view class="curtain-index">
                {{ idx + 1 }}
              </view>
              <view class="truncate text-30rpx text-[#333] font-medium">
                {{ curtain.curtainName || '-' }}
              </view>
              <view class="curtain-status-badge flex-shrink-0" :class="`status-${getStatusColorType(curtain.status)}`">
                {{ getStatusLabel(curtain.status) }}
              </view>
            </view>
            <wd-icon name="arrow-right" size="32rpx" color="#1890ff" class="ml-12rpx flex-shrink-0" @click.stop="goCurtainDetail(curtain.id)" />
          </view>

          <!-- 窗帘行操作栏 -->
          <view class="curtain-action-bar">
            <wd-button
              :type="curtain.packTime ? 'warning' : 'primary'"
              size="small"
              :loading="packingId === curtain.id"
              :disabled="!!curtain.shipTime"
              @click.stop="handlePack(curtain)"
            >
              {{ curtain.packTime ? '撤销打包' : '打包' }}
            </wd-button>
            <wd-button
              :type="curtain.shipTime ? 'warning' : 'success'"
              size="small"
              :loading="shippingId === curtain.id"
              @click.stop="handleShip(curtain)"
            >
              {{ curtain.shipTime ? '撤销发货' : '发货' }}
            </wd-button>
          </view>

          <!-- 结构行 -->
          <view
            v-for="structure in curtain.structures"
            :key="structure.id"
            class="structure-block"
          >
            <view class="structure-header">
              <view class="text-26rpx text-[#555] font-medium">
                {{ structure.structureName || '-' }}
              </view>
              <view v-if="structure.width || structure.height" class="text-24rpx text-[#999]">
                {{ structure.width }} × {{ structure.height }} cm
              </view>
            </view>

            <!-- 用料明细列表 -->
            <view v-if="structure.materials?.length" class="material-list">
              <view
                v-for="mat in structure.materials"
                :key="mat.id"
                class="material-item"
                @click="goInventory(mat)"
              >
                <view class="material-item-row">
                  <view class="material-item-label">
                    组件
                  </view>
                  <view class="material-item-value">
                    {{ mat.elementName || '-' }}
                  </view>
                </view>
                <view class="material-item-row">
                  <view class="material-item-label">
                    产品
                  </view>
                  <view class="material-item-value">
                    {{ mat.productName || '-' }}
                  </view>
                </view>
                <view class="material-item-row">
                  <view class="material-item-label">
                    用量
                  </view>
                  <view class="material-item-value">
                    {{ mat.quantity }}{{ getUnitLabel(mat.unitValue) }}
                  </view>
                </view>
                <view class="material-item-row">
                  <view class="material-item-label">
                    状态
                  </view>
                  <view class="material-item-value" :class="getMatStatusColorType(mat.status) ? `material-status-${getMatStatusColorType(mat.status)}` : ''">
                    {{ getMatStatusLabel(mat.status) }}
                  </view>
                </view>
              </view>
            </view>
            <view v-else class="py-16rpx pl-16rpx text-28rpx text-[#bbb]">
              暂无用料
            </view>
          </view>
        </view>
      </view>
    </template>

    <view v-else class="py-120rpx text-center">
      <wd-status-tip image="content" tip="暂无数据" />
    </view>

    <wd-message-box />
  </view>
</template>

<style lang="scss" scoped>
.status-card {
  background: linear-gradient(135deg, #1890ff, #096dd9);
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

  &--curtain {
    background-color: #e6f4ff;
    color: #1890ff;
    margin: -24rpx -24rpx 20rpx;
    padding: 16rpx 24rpx;
    border-radius: 12rpx 12rpx 0 0;
    border-bottom: none;
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

.curtain-block {
  border-bottom: 1rpx solid #f0f0f0;
  padding-bottom: 16rpx;
  margin-bottom: 16rpx;

  &:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }
}

.curtain-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
  background-color: #e6f4ff;
  border-radius: 8rpx;
  padding: 10rpx 12rpx;
}

.curtain-detail-btn {
  padding: 4rpx 16rpx;
  border-radius: 4rpx;
  font-size: 24rpx;
  color: #1890ff;
  border: 1rpx solid #1890ff;
  background-color: #fff;
}

.curtain-status-badge {
  padding: 4rpx 14rpx;
  border-radius: 4rpx;
  font-size: 24rpx;
  font-weight: 500;
}

.curtain-index {
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  background-color: #1890ff;
  color: #fff;
  font-size: 22rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.structure-block {
  background-color: #fafafa;
  border-radius: 8rpx;
  padding: 16rpx;
  margin-bottom: 10rpx;

  &:last-child {
    margin-bottom: 0;
  }
}

.structure-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.material-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.material-item {
  background-color: #f5f7fa;
  border-radius: 8rpx;
  padding: 16rpx 20rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx 0;
  cursor: pointer;
}

.material-item-row {
  width: 20%;
  display: flex;
  flex-direction: column;
  gap: 4rpx;

  &:nth-child(2) {
    width: 40%;
  }
}

.material-item-label {
  font-size: 24rpx;
  color: #999;
}

.material-item-value {
  font-size: 28rpx;
  color: #333;
  word-break: break-all;
}

.material-status-warning {
  color: #faad14;
}
.material-status-primary {
  color: #1890ff;
}
.material-status-info {
  color: #13c2c2;
}
.material-status-success {
  color: #52c41a;
}
.material-status-danger {
  color: #ff4d4f;
}
.material-status-default {
  color: #999;
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

.curtain-action-bar {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  margin-top: 12rpx;
  margin-bottom: 16rpx;
}

.curtain-action-btn {
  padding: 8rpx 28rpx;
  border-radius: 6rpx;
  font-size: 26rpx;
  font-weight: 500;

  &--pack {
    color: #fa8c16;
    border: 1rpx solid #fa8c16;
    background-color: #fff7e6;
  }

  &--ship {
    color: #fff;
    border: 1rpx solid #1890ff;
    background-color: #1890ff;
  }
}

.action-card {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  background-color: #fff;
  margin: 0 24rpx 16rpx;
  border-radius: 12rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
}
</style>
