<template>
  <view class="page min-h-screen flex flex-col bg-#f7f8fa">
    <wd-navbar title="扫码发货" left-arrow safe-area-inset-top placeholder @click-left="handleBack" />

    <view class="flex flex-1 flex-col items-center justify-center">
      <view
        class="scan-btn h-160rpx w-160rpx flex items-center justify-center rounded-full bg-#1890ff shadow-lg"
        :class="{ 'opacity-60': isLoading }"
        @click="handleScanCode"
      >
        <view v-if="!isLoading" class="i-carbon-scan text-72rpx text-white" />
        <view v-else class="i-carbon-loading animate-spin text-72rpx text-white" />
      </view>
      <view class="mt-48rpx text-center text-26rpx text-#8c8c8c">
        {{ isLoading ? '正在识别并查询订单，请稍候...' : '点击扫码按钮，扫描订单码完成发货' }}
      </view>
    </view>

    <wd-message-box />

    <wd-popup v-model="showMaterialPopup" position="center" custom-style="border-radius: 16rpx; overflow: hidden;">
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
          用料信息
        </view>
        <scroll-view scroll-x scroll-y class="material-popup__scroll">
          <view class="material-table">
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
              v-for="row in materialRows"
              :key="row.curtainId"
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
  </view>
</template>

<script setup lang="ts">
import type { SalesOrderCurtainDetail, SalesOrderDetail, SalesOrderMaterialDetail, SalesOrderStructureDetail } from '@/api/curtain/order'
import { ref } from 'vue'
import { useMessage } from 'wot-design-uni/components/wd-message-box/index'
import { getBarcodeRegistry } from '@/api/curtain/barcode-registry/index'
import { cancelShipSalesOrderCurtain, getSalesOrderDetail, shipSalesOrderCurtain } from '@/api/curtain/order/index'
import { useOperatorStore } from '@/store'
import { useDictStore } from '@/store/dict'

const ORDER_FABRIC_SHIP_QR = 'ORDER_FABRIC_SHIP_QR'

interface MaterialTableRow {
  curtainId: number
  productDisplay: string
  usage: string
  shipped: boolean
  checked: boolean
}

interface OrderSummary {
  orderNo: string
  customerName: string
  receiver: string
  deliveryAddress: string
  mobile: string
  statusCode: string
}

const message = useMessage()
const dictStore = useDictStore()
const operatorStore = useOperatorStore()
const isLoading = ref(false)
const shipping = ref(false)
const showMaterialPopup = ref(false)
const orderSummary = ref<OrderSummary | null>(null)
const materialRows = ref<MaterialTableRow[]>([])
const currentOrderId = ref(0)
const currentScanContent = ref<Record<string, any>>({})
const cancellingCurtainId = ref<number | null>(null)

function getUnitLabel(val: string) {
  return dictStore.getDictData('zc_product_unit', val)?.label ?? val ?? '-'
}

function getOrderStatusLabel(val: string) {
  return dictStore.getDictData('zc_order_status', val)?.label ?? val ?? '-'
}

function getMaterialSpec(mat: SalesOrderMaterialDetail, structure?: SalesOrderStructureDetail) {
  const extra = mat as Record<string, unknown>
  const specFromMat = extra.specValue ?? extra.spec
  if (specFromMat)
    return String(specFromMat)
  if (structure?.width || structure?.height)
    return `${structure.width || '-'}×${structure.height || '-'}`
  return '-'
}

function buildMaterialRow(
  curtain: SalesOrderCurtainDetail,
  mat: SalesOrderMaterialDetail,
  structure?: SalesOrderStructureDetail,
): MaterialTableRow {
  const spec = getMaterialSpec(mat, structure)
  const shipped = !!curtain.shipTime
  return {
    curtainId: curtain.id,
    productDisplay: `${mat.productName || '-'}(${spec})`,
    usage: `${mat.quantity ?? 0}${getUnitLabel(mat.unitValue)}`,
    shipped,
    checked: !shipped,
  }
}

function buildOrderSummary(order: SalesOrderDetail): OrderSummary {
  return {
    orderNo: order.orderNo || '-',
    customerName: order.customerName || '-',
    receiver: order.receiver || '-',
    deliveryAddress: order.deliveryAddress || '-',
    mobile: order.mobile || '-',
    statusCode: order.status ?? '',
  }
}

function showMaterialTable(order: SalesOrderDetail, rows: MaterialTableRow[]) {
  orderSummary.value = buildOrderSummary(order)
  materialRows.value = rows
  showMaterialPopup.value = true
}

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
  showMaterialPopup.value = false
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

async function handleCancelCurtainShip(row: MaterialTableRow) {
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
    const order = await getSalesOrderDetail({ id: currentOrderId.value })
    await showFabricShipMaterialInfo(order, currentScanContent.value)
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

  const toShip = materialRows.value.filter(row => row.checked && !row.shipped)
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
    showMaterialPopup.value = false
  } catch {
    uni.showToast({ title: '发货失败，请重试', icon: 'none' })
  } finally {
    shipping.value = false
    uni.hideLoading()
  }
}

function findCurtain(curtains: SalesOrderCurtainDetail[], curtainId: number) {
  return curtains.find(c => c.curtainId === curtainId || c.id === curtainId)
}

function findStructure(curtain: SalesOrderCurtainDetail, structureId?: number): SalesOrderStructureDetail | undefined {
  if (structureId != null && Number.isFinite(structureId)) {
    return curtain.structures?.find(s => s.id === structureId || s.structureId === structureId)
  }
  return curtain.structures?.[0]
}

async function showFabricShipMaterialInfo(order: SalesOrderDetail, content: Record<string, any>) {
  await dictStore.loadDictCache()
  currentOrderId.value = order.id
  currentScanContent.value = content

  const curtains = order.curtains ?? []
  const contentCurtainId = content.curtainId != null ? Number(content.curtainId) : undefined
  const contentStructureId = content.structureId != null ? Number(content.structureId) : undefined
  const hasCurtainId = contentCurtainId != null && Number.isFinite(contentCurtainId) && contentCurtainId > 0

  if (hasCurtainId) {
    const curtain = findCurtain(curtains, contentCurtainId!)
    if (!curtain) {
      uni.showToast({ title: '未找到对应窗帘', icon: 'none' })
      return
    }

    const structure = findStructure(curtain, contentStructureId)
    if (!structure) {
      uni.showToast({ title: '未找到对应结构', icon: 'none' })
      return
    }

    const mat = structure.materials?.[0]
    if (!mat) {
      uni.showToast({ title: '未找到用料信息', icon: 'none' })
      return
    }

    showMaterialTable(order, [buildMaterialRow(curtain, mat, structure)])
    return
  }

  const rows = curtains.flatMap((curtain) => {
    const structure = curtain.structures?.[0]
    const mat = structure?.materials?.[0]
    if (!mat)
      return []
    return [buildMaterialRow(curtain, mat, structure)]
  })

  if (!rows.length) {
    uni.showToast({ title: '未找到用料信息', icon: 'none' })
    return
  }

  showMaterialTable(order, rows)
}

function handleBack() {
  if (getCurrentPages().length > 1) {
    uni.navigateBack()
    return
  }
  uni.reLaunch({ url: '/pages/index/index' })
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

  let order: SalesOrderDetail
  try {
    order = await getSalesOrderDetail({ id: orderId })
  } catch {
    uni.showToast({ title: '获取订单信息失败', icon: 'none' })
    uni.hideLoading()
    isLoading.value = false
    return
  }

  uni.hideLoading()
  isLoading.value = false

  if (data.codeType === ORDER_FABRIC_SHIP_QR) {
    await showFabricShipMaterialInfo(order, content)
    return
  }

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
.page {
  min-height: 100vh;
}

.scan-btn {
  box-shadow: 0 8rpx 32rpx rgba(24, 144, 255, 0.35);
}

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
