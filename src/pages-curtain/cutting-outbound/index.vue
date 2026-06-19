<script setup lang="ts">
import type { ZcProductBatch } from '@/api/curtain/product'
import type { ZcWarehouseSimple } from '@/api/curtain/warehouse'
import type { LoadMoreState } from '@/http/types'
import { computed, getCurrentInstance, nextTick, onMounted, reactive, ref } from 'vue'
import { useMessage } from 'wot-design-uni/components/wd-message-box/index'
import { createBarcodeRegistry, getBarcodeRegistry } from '@/api/curtain/barcode-registry'
import { createInventoryRecord } from '@/api/curtain/inventory-record'
import { cancelCutMaterial, cutMaterial, MAT_STATUS } from '@/api/curtain/order'
import { getProductBatchPage, getProductBatchStatusColorType, getProductBatchStatusLabel } from '@/api/curtain/product'
import { getWarehouseSimpleList } from '@/api/curtain/warehouse'
import { useOperatorStore } from '@/store'
import { useDictStore } from '@/store/dict'
import { navigateBackPlus } from '@/utils'
import {
  calculateCutPrintCanvasHeight,
  CUT_PRINT_CANVAS_W,
  printCutLabel,
} from '@/utils/print-cut-label'

const dictStore = useDictStore()
const operatorStore = useOperatorStore()
const instance = getCurrentInstance()
const printCutCanvasHeight = ref(0)

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

function getUnitLabel(val: string) {
  return dictStore.getDictData('zc_product_unit', val)?.label ?? val ?? ''
}

definePage({
  style: {
    navigationBarTitleText: '',
    navigationStyle: 'custom',
  },
})

interface MatInfo {
  id: number
  orderId: number
  productId: number
  productName: string
  batchId: number
  batchNo: string
  elementName: string
  quantity: number
  unitValue: string
  status?: string
  orderNo?: string
  customerName?: string
  curtainName?: string
  structureName?: string
  curtainId?: number
}

const matInfo = ref<MatInfo | null>(null)
const barcodeInput = ref('')

const productId = ref<number | undefined>()
const productName = ref('')

const total = ref(0)
const list = ref<ZcProductBatch[]>([])

const displayList = computed(() => {
  let result = list.value
  const pinnedId = matInfo.value?.batchId
  if (pinnedId) {
    const idx = result.findIndex(item => item.id === pinnedId)
    if (idx > 0)
      result = [result[idx], ...result.slice(0, idx), ...result.slice(idx + 1)]
  }
  return result
})
const isCut = computed(() => matInfo.value?.status === MAT_STATUS.HAVE_PEILIAO)

const loadMoreState = ref<LoadMoreState>('loading')
const queryParams = ref({ pageNo: 1, pageSize: 199 })
const filterParams = ref<{ batchNo?: string, warehouseId?: number }>({})

const warehouseList = ref<ZcWarehouseSimple[]>([])
const warehouseIndex = ref<number | null>(null)

function handleBack() {
  navigateBackPlus()
}

async function getList() {
  if (!productId.value)
    return
  loadMoreState.value = 'loading'
  try {
    const data = await getProductBatchPage({
      ...queryParams.value,
      productId: productId.value,
      ...filterParams.value,
    })
    list.value = data.list
    total.value = data.total
    loadMoreState.value = 'finished'
  } catch {
    loadMoreState.value = 'error'
  }
}

function resetAndLoad() {
  queryParams.value.pageNo = 1
  list.value = []
  getList()
}

function onWarehouseChange(e: any) {
  const idx = Number(e.detail.value)
  warehouseIndex.value = idx
  filterParams.value.warehouseId = warehouseList.value[idx]?.id
  resetAndLoad()
}

function clearWarehouse() {
  warehouseIndex.value = null
  filterParams.value.warehouseId = undefined
  resetAndLoad()
}

async function loadDropdowns() {
  try {
    warehouseList.value = await getWarehouseSimpleList()
  } catch {}
}

// ---------- 盘点弹窗 ----------
const showCheckPopup = ref(false)
const checkBatch = ref<ZcProductBatch | null>(null)
const checkNewQuantity = ref<number | undefined>()
const checkNote = ref('')
const checkSubmitting = ref(false)

function handleStockCheck(item: ZcProductBatch) {
  checkBatch.value = item
  checkNewQuantity.value = undefined
  checkNote.value = ''
  showCheckPopup.value = true
}

function handleCloseCheckPopup() {
  showCheckPopup.value = false
  checkBatch.value = null
}

async function handleCheckSubmit() {
  if (!checkBatch.value)
    return
  if (checkNewQuantity.value === undefined || checkNewQuantity.value < 0) {
    uni.showToast({ title: '请填写盘点后数量', icon: 'none' })
    return
  }
  checkSubmitting.value = true
  try {
    await createInventoryRecord({
      productId: checkBatch.value.productId,
      batchId: checkBatch.value.id,
      oldQuantity: checkBatch.value.quantity,
      newQuantity: checkNewQuantity.value,
      note: checkNote.value || undefined,
    })
    uni.showToast({ title: '盘点成功', icon: 'success' })
    handleCloseCheckPopup()
    resetAndLoad()
  } catch {
    uni.showToast({ title: '盘点失败，请重试', icon: 'none' })
  } finally {
    checkSubmitting.value = false
  }
}

// ---------- 裁剪弹窗 ----------
const showCutPopup = ref(false)
const cutBatch = ref<ZcProductBatch | null>(null)
const cutQuantity = ref<number | undefined>()
const cutSubmitting = ref(false)

function handleCutBatch(item: ZcProductBatch) {
  if (!requirePrimaryOperator())
    return
  cutBatch.value = item
  cutQuantity.value = matInfo.value?.quantity
  showCutPopup.value = true
}

function handleCloseCutPopup() {
  showCutPopup.value = false
  cutBatch.value = null
}

async function handleCutSubmit() {
  if (!cutBatch.value || !matInfo.value)
    return
  if (!cutQuantity.value || cutQuantity.value <= 0) {
    uni.showToast({ title: '请填写裁剪数量', icon: 'none' })
    return
  }
  cutSubmitting.value = true
  try {
    await cutMaterial({
      id: matInfo.value.id,
      batchId: cutBatch.value.id,
      cutQuantity: cutQuantity.value,
      masterId: operatorStore.primaryOperator!.id,
      assistantId: operatorStore.secondaryOperator?.id,
    })
    handleCloseCutPopup()
    await directPrintCut(cutQuantity.value)
    setTimeout(() => navigateBackPlus(), 600)
  } catch {
    // HTTP 层已自动展示后端错误信息
  } finally {
    cutSubmitting.value = false
  }
}

function handleViewCuttingRecords(item: ZcProductBatch) {
  const enc = encodeURIComponent
  uni.navigateTo({
    url: `/pages-curtain/cutting-outbound/cutting-records/index?batchId=${item.id}&batchNo=${enc(item.batchNo || String(item.id))}`,
  })
}

async function handlePrintLabel(item: ZcProductBatch) {
  uni.showLoading({ title: '生成二维码…', mask: true })
  try {
    const codeId = await createBarcodeRegistry({
      codeType: 'BATCH_QR',
      targetRoute: '/pages-curtain/product-inbound/inventory/index',
      codeContent: { productId: item.productId, batchNo: item.batchNo },
    })
    const enc = encodeURIComponent
    const query = `batchId=${item.id}`
      + `&batchNo=${enc(item.batchNo || String(item.id))}`
      + `&qrCode=${enc(codeId)}`
      + `&productName=${enc(item.productName || '')}`
      + `&warehouse=${enc(item.warehouseName || '')}`
      + `&versionName=${enc(item.versionName || '')}`
      + `&specValue=${enc(item.specValue || '')}`
      + `&quantity=${enc(String(item.quantity ?? ''))}`
      + `&note=${enc(item.note || '')}`
    uni.navigateTo({ url: `/pages-curtain/product-inbound/print-label/index?${query}` })
  } catch {
    uni.showToast({ title: '生成二维码失败，请重试', icon: 'none' })
  } finally {
    uni.hideLoading()
  }
}

async function directPrintCut(qty: number) {
  if (!matInfo.value)
    return
  uni.showLoading({ title: '裁剪成功，正在打印…', mask: true })
  try {
    const codeId = await createBarcodeRegistry({
      codeType: 'ORDER_QR',
      targetRoute: '/pages-curtain/order/curtain-order-detail/curtain-item/index',
      codeContent: { orderId: matInfo.value.orderId, curtainId: matInfo.value.curtainId },
    })
    const printData = {
      qrCode: codeId,
      orderNo: matInfo.value.orderNo ?? '',
      customerName: matInfo.value.customerName ?? '',
      curtainName: matInfo.value.curtainName ?? '',
      structureName: matInfo.value.structureName ?? '',
      elementName: matInfo.value.elementName ?? '',
      productName: matInfo.value.productName ?? '',
      cutQuantity: String(qty),
      unitLabel: getUnitLabel(matInfo.value.unitValue),
    }
    printCutCanvasHeight.value = calculateCutPrintCanvasHeight(printData)
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 150))
    await printCutLabel(printData, 'cut-print-canvas', instance?.proxy)
    uni.showToast({ title: '已发送至打印机 ✓', icon: 'success' })
  } catch (e: any) {
    uni.showToast({ title: e.message || '打印失败，请重试', icon: 'none', duration: 3000 })
  } finally {
    printCutCanvasHeight.value = 0
    uni.hideLoading()
  }
}

// ---------- 撤销裁剪 ----------
const cancelSubmitting = ref(false)

async function handleCancelCut() {
  if (!matInfo.value)
    return
  if (!requirePrimaryOperator())
    return
  uni.showModal({
    title: '确认撤销裁剪',
    content: '撤销后将回退批次库存并清空配料绑定，确认继续？',
    success: async (res) => {
      if (!res.confirm || !matInfo.value)
        return
      cancelSubmitting.value = true
      try {
        await cancelCutMaterial({
          materialId: matInfo.value.id,
          masterId: operatorStore.primaryOperator!.id,
          assistantId: operatorStore.secondaryOperator?.id,
        })
        uni.showToast({ title: '撤销成功', icon: 'success' })
        if (matInfo.value)
          matInfo.value.status = MAT_STATUS.NOT_PEILIAO
        resetAndLoad()
      } catch {
        uni.showToast({ title: '撤销失败，请重试', icon: 'none' })
      } finally {
        cancelSubmitting.value = false
      }
    },
  })
}

// ---------- 扫码悬浮按钮 ----------
const message = useMessage()
const scanPos = reactive({ x: 0, y: 0 })
const isScanDragging = ref(false)
let scanStartTouch = { x: 0, y: 0 }
let scanStartPos = { x: 0, y: 0 }
let scanBtnSize = 0

const scanBtnStyle = computed(() => ({
  left: `${scanPos.x}px`,
  top: `${scanPos.y}px`,
}))

function onScanTouchStart(e: TouchEvent) {
  isScanDragging.value = false
  scanStartTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  scanStartPos = { x: scanPos.x, y: scanPos.y }
}

function onScanTouchMove(e: TouchEvent) {
  isScanDragging.value = true
  const info = uni.getSystemInfoSync()
  const dx = e.touches[0].clientX - scanStartTouch.x
  const dy = e.touches[0].clientY - scanStartTouch.y
  scanPos.x = Math.max(0, Math.min(info.windowWidth - scanBtnSize, scanStartPos.x + dx))
  scanPos.y = Math.max(0, Math.min(info.windowHeight - scanBtnSize, scanStartPos.y + dy))
}

function onScanTouchEnd() {
  if (!isScanDragging.value)
    handleScanCode()
  isScanDragging.value = false
}

const barcodeProcessing = ref(false)

async function processBarcodeInput(codeId: string) {
  const trimmed = codeId.trim()
  if (!trimmed) {
    barcodeInput.value = ''
    filterParams.value.id = undefined
    resetAndLoad()
    return
  }
  barcodeProcessing.value = true
  try {
    const data = await getBarcodeRegistry(trimmed)
    const content = JSON.parse(data.codeContent) as { productId: number, batchNo: string }
    if (content.productId !== productId.value) {
      uni.showToast({ title: '产品不匹配，请扫描正确的批次码', icon: 'none', duration: 2500 })
      return
    }
    barcodeInput.value = content.batchNo
    filterParams.value.batchNo = content.batchNo
    resetAndLoad()
  } catch {
    uni.showToast({ title: '条码信息不存在或无效', icon: 'none' })
  } finally {
    barcodeProcessing.value = false
  }
}

function clearBarcode() {
  barcodeInput.value = ''
  filterParams.value.batchNo = undefined
  resetAndLoad()
}

function handleBatchNoConfirm() {
  const val = barcodeInput.value.trim()
  filterParams.value.batchNo = val || undefined
  resetAndLoad()
}

async function handleSimulateScan() {
  let result: { value?: string }
  try {
    result = await message.prompt({
      title: '模拟扫码',
      msg: '请输入批次码ID',
      inputPlaceholder: '请输入码ID',
    })
  } catch {
    return
  }
  const val = (result.value ?? '').trim()
  if (val)
    processBarcodeInput(val)
}

function handleScanCode() {
  // #ifndef H5
  uni.scanCode({
    onlyFromCamera: false,
    success(res) {
      processBarcodeInput(res.result)
    },
    fail(err) {
      if (err.errMsg?.includes('cancel'))
        return
      uni.showToast({ title: '扫码失败，请重试', icon: 'none' })
    },
  })
  // #endif

  // #ifdef H5
  handleSimulateScan()
  // #endif
}

onMounted(() => {
  const pages = getCurrentPages()
  const current = pages[pages.length - 1] as any
  const opts = current.$page?.options ?? current.options ?? {}

  if (opts.mat) {
    try {
      const mat = JSON.parse(decodeURIComponent(opts.mat)) as MatInfo
      matInfo.value = mat
      productId.value = mat.productId
      productName.value = mat.productName || ''
      console.log('matInfo', mat)
    } catch {}
  } else {
    productId.value = opts.productId ? Number(opts.productId) : undefined
    productName.value = decodeURIComponent(opts.productName ?? '')
  }

  const info = uni.getSystemInfoSync()
  const ratio = info.windowWidth / 750
  scanBtnSize = Math.round(100 * ratio)
  scanPos.x = info.windowWidth - scanBtnSize - Math.round(32 * ratio)
  scanPos.y = info.windowHeight - Math.round(200 * ratio) - scanBtnSize

  loadDropdowns()
  getList()
})
</script>

<template>
  <view class="yd-page-container">
    <wd-navbar
      :title="productName ? `${productName} · 裁剪出库` : '裁剪出库'"
      left-arrow placeholder safe-area-inset-top fixed
      @click-left="handleBack"
    />

    <!-- 用料信息卡片 -->
    <view v-if="matInfo" class="mat-info-card">
      <view class="mat-info-row">
        <view class="mat-info-item">
          <text class="mat-info-label">组件</text>
          <text class="mat-info-value">{{ matInfo.elementName || '-' }}</text>
        </view>
        <view class="mat-info-item">
          <text class="mat-info-label">产品</text>
          <text class="mat-info-value">{{ matInfo.productName || '-' }}</text>
        </view>
        <view class="mat-info-item">
          <text class="mat-info-label">用量</text>
          <text class="mat-info-value">{{ matInfo.quantity }}{{ getUnitLabel(matInfo.unitValue) }}</text>
        </view>
        <view class="mat-info-item">
          <text class="mat-info-label">批次号</text>
          <text class="mat-info-value">{{ matInfo.batchNo || '-' }}</text>
        </view>
      </view>
    </view>

    <!-- 已裁剪：撤销区域 -->
    <view v-if="isCut" class="cancel-cut-area">
      <view class="cancel-cut-tip">
        <text class="cancel-cut-tip-icon">✓</text>
        <text class="cancel-cut-tip-text">该用料已完成裁剪</text>
      </view>
      <view
        class="cancel-cut-btn"
        :class="{ loading: cancelSubmitting }"
        @click="handleCancelCut"
      >
        {{ cancelSubmitting ? '撤销中...' : '撤销裁剪' }}
      </view>
    </view>

    <template v-if="!isCut">
      <!-- 批次号输入 -->
      <view class="barcode-bar">
        <view class="barcode-input-wrap">
          <text class="barcode-icon">⌕</text>
          <input
            v-model="barcodeInput"
            class="barcode-input"
            :placeholder="barcodeProcessing ? '查询中...' : '扫码或输入批次号后按确认'"
            confirm-type="search"
            :disabled="barcodeProcessing"
            @confirm="handleBatchNoConfirm"
          >
          <text v-if="barcodeInput" class="barcode-clear" @click="clearBarcode">✕</text>
        </view>
      </view>

      <!-- 筛选栏 -->
      <view class="filter-bar">
        <view class="filter-cell">
          <text class="filter-label">仓库</text>
          <picker
            mode="selector"
            :range="warehouseList"
            range-key="name"
            :value="warehouseIndex ?? 0"
            @change="onWarehouseChange"
          >
            <view class="filter-trigger">
              <text class="filter-value" :class="{ placeholder: warehouseIndex === null }">
                {{ warehouseIndex !== null ? (warehouseList[warehouseIndex]?.name || '全部') : '全部仓库' }}
              </text>
              <text class="filter-arrow">▾</text>
            </view>
          </picker>
          <text v-if="warehouseIndex !== null" class="filter-clear" @click.stop="clearWarehouse">✕</text>
        </view>
      </view>

      <!-- 统计条 -->
      <view class="stat-bar">
        <text class="stat-text">共 {{ total }} 条批次记录</text>
      </view>

      <!-- 批次列表 -->
      <view class="p-24rpx">
        <view
          v-for="item in displayList"
          :key="item.id"
          class="batch-card"
          :class="{ 'batch-card--pinned': item.id === matInfo?.batchId }"
          @click="handleCutBatch(item)"
        >
          <!-- 顶部行：批号 + 批次状态 -->
          <view class="card-header">
            <view class="batch-no">
              {{ item.batchNo || `批次 #${item.id}` }}
            </view>
            <view class="batch-status" :class="`status-${getProductBatchStatusColorType(item.status)}`">
              {{ getProductBatchStatusLabel(item.status) }}
            </view>
          </view>

          <!-- 数量信息 -->
          <view class="quantity-row">
            <view class="qty-block">
              <view class="qty-label">
                剩余库存
              </view>
              <view class="qty-value remaining">
                {{ item.quantity }}
                <text class="qty-unit">{{ getUnitLabel(item.unitValue) }}</text>
              </view>
            </view>
            <view class="qty-divider" />
            <view class="qty-block">
              <view class="qty-label">
                入库数量
              </view>
              <view class="qty-value">
                {{ item.inboundQuantity }}
                <text class="qty-unit">{{ getUnitLabel(item.unitValue) }}</text>
              </view>
            </view>
            <view class="qty-divider" />
            <view class="qty-block">
              <view class="qty-label">
                规格
              </view>
              <view class="qty-value">
                {{ item.specValue || '-' }}
              </view>
            </view>
          </view>

          <!-- 详情信息 -->
          <view class="detail-grid">
            <view class="detail-item">
              <text class="detail-label">版本</text>
              <text class="detail-value">{{ item.versionName || '-' }}</text>
            </view>
            <view class="detail-item">
              <text class="detail-label">仓库</text>
              <text class="detail-value">{{ item.warehouseName || '-' }}</text>
            </view>
            <view class="detail-item">
              <text class="detail-label">产品名称</text>
              <text class="detail-value">{{ item.productName || '-' }}</text>
            </view>
          </view>

          <!-- 操作按钮 -->
          <view class="card-actions">
            <view class="action-btn check-btn" @click.stop="handleStockCheck(item)">
              库存盘点
            </view>
            <view class="action-btn record-btn" @click.stop="handleViewCuttingRecords(item)">
              裁剪记录
            </view>
            <view class="action-btn print-btn" @click.stop="handlePrintLabel(item)">
              打印标签
            </view>
          </view>
        </view>

        <view v-if="loadMoreState !== 'loading' && displayList.length === 0" class="py-100rpx text-center">
          <wd-status-tip image="content" tip="暂无库存批次数据" />
        </view>
      </view>
    </template>

    <!-- 盘点弹窗 -->
    <wd-popup
      v-model="showCheckPopup"
      position="bottom"
      :safe-area-inset-bottom="true"
      custom-style="border-radius: 24rpx 24rpx 0 0;"
      @close="handleCloseCheckPopup"
    >
      <view v-if="checkBatch" class="check-popup">
        <view class="check-header">
          <view class="check-title">
            库存盘点
          </view>
          <view class="check-close" @click="handleCloseCheckPopup">
            ✕
          </view>
        </view>

        <!-- 批次信息 -->
        <view class="check-info">
          <view class="check-info-row">
            <text class="check-info-label">批次</text>
            <text class="check-info-value">{{ checkBatch.batchNo || `#${checkBatch.id}` }}</text>
          </view>
          <view class="check-info-row">
            <text class="check-info-label">产品</text>
            <text class="check-info-value">{{ checkBatch.productName }}</text>
          </view>
          <view class="check-info-row">
            <text class="check-info-label">当前库存</text>
            <text class="check-info-value old-qty">{{ checkBatch.quantity }} {{ getUnitLabel(checkBatch.unitValue) }}</text>
          </view>
        </view>

        <!-- 表单 -->
        <view class="check-form">
          <view class="check-field">
            <text class="check-field-label required">盘点后数量</text>
            <input
              v-model.number="checkNewQuantity"
              type="digit"
              class="check-field-input"
              placeholder="请输入盘点后实际数量"
            >
            <text class="check-field-unit">{{ getUnitLabel(checkBatch.unitValue) }}</text>
          </view>
          <view class="check-field">
            <text class="check-field-label">备注</text>
            <input
              v-model="checkNote"
              type="text"
              class="check-field-input"
              placeholder="备注（选填）"
              :maxlength="200"
            >
          </view>
        </view>

        <!-- 差值提示 -->
        <view
          v-if="checkNewQuantity !== undefined"
          class="check-diff"
          :class="checkNewQuantity >= checkBatch.quantity ? 'diff-up' : 'diff-down'"
        >
          {{ checkNewQuantity >= checkBatch.quantity ? '盘盈' : '盘亏' }}
          {{ Math.abs(checkNewQuantity - checkBatch.quantity) }} {{ getUnitLabel(checkBatch.unitValue) }}
        </view>

        <view class="check-footer">
          <view class="cancel-btn" @click="handleCloseCheckPopup">
            取消
          </view>
          <view class="submit-btn" :class="{ loading: checkSubmitting }" @click="handleCheckSubmit">
            {{ checkSubmitting ? '提交中...' : '确认盘点' }}
          </view>
        </view>
      </view>
    </wd-popup>

    <!-- 扫码悬浮按钮（可拖动） -->
    <view
      class="fixed z-10 h-100rpx w-100rpx flex items-center justify-center rounded-full bg-[#1890ff] shadow-lg"
      :style="scanBtnStyle"
      @touchstart.stop="onScanTouchStart"
      @touchmove.stop.prevent="onScanTouchMove"
      @touchend.stop="onScanTouchEnd"
    >
      <view class="i-carbon-scan text-48rpx text-white" />
    </view>

    <!-- 模拟扫码输入弹窗 -->
    <wd-message-box />

    <!-- 裁剪弹窗 -->
    <wd-popup
      v-model="showCutPopup"
      position="bottom"
      :safe-area-inset-bottom="true"
      custom-style="border-radius: 24rpx 24rpx 0 0;"
      @close="handleCloseCutPopup"
    >
      <view v-if="cutBatch" class="check-popup">
        <view class="check-header">
          <view class="check-title">
            裁剪出库
          </view>
          <view class="check-close" @click="handleCloseCutPopup">
            ✕
          </view>
        </view>

        <view class="check-info">
          <view class="check-info-row">
            <text class="check-info-label">批次号</text>
            <text class="check-info-value">{{ cutBatch.batchNo || `#${cutBatch.id}` }}</text>
          </view>
          <view class="check-info-row">
            <text class="check-info-label">剩余库存</text>
            <text class="check-info-value old-qty">{{ cutBatch.quantity }} {{ getUnitLabel(cutBatch.unitValue) }}</text>
          </view>
          <view v-if="matInfo" class="check-info-row">
            <text class="check-info-label">订单用量</text>
            <text class="check-info-value">{{ matInfo.quantity }} {{ getUnitLabel(matInfo.unitValue) }}</text>
          </view>
        </view>

        <view class="check-form">
          <view class="check-field">
            <text class="check-field-label required">裁剪数量</text>
            <input
              v-model.number="cutQuantity"
              type="digit"
              class="check-field-input"
              placeholder="请输入裁剪数量"
            >
            <text class="check-field-unit">{{ getUnitLabel(cutBatch.unitValue) }}</text>
          </view>
        </view>

        <view class="check-footer">
          <view class="cancel-btn" @click="handleCloseCutPopup">
            取消
          </view>
          <view class="submit-btn" :class="{ loading: cutSubmitting }" @click="handleCutSubmit">
            {{ cutSubmitting ? '提交中...' : '确认裁剪' }}
          </view>
        </view>
      </view>
    </wd-popup>

    <!-- 隐藏 canvas，裁剪完成后直接打印用 -->
    <canvas
      v-if="printCutCanvasHeight > 0"
      canvas-id="cut-print-canvas"
      class="hidden-print-canvas"
      :style="`width:${CUT_PRINT_CANVAS_W}px;height:${printCutCanvasHeight}px;`"
    />
  </view>
</template>

<style lang="scss" scoped>
.hidden-print-canvas {
  position: fixed;
  left: -9999px;
  top: -9999px;
  opacity: 0;
  pointer-events: none;
}

.cancel-cut-area {
  margin: 24rpx 24rpx 0;
  background-color: #fff;
  border-radius: 12rpx;
  padding: 40rpx 32rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32rpx;
}

.cancel-cut-tip {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.cancel-cut-tip-icon {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background-color: #52c41a;
  color: #fff;
  font-size: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.cancel-cut-tip-text {
  font-size: 30rpx;
  color: #333;
  font-weight: 500;
}

.cancel-cut-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 500;
  text-align: center;
  color: #fff;
  background-color: #ff4d4f;

  &.loading {
    background-color: #ffa39e;
  }
}

.mat-info-card {
  background: linear-gradient(135deg, #1890ff, #096dd9);
  padding: 20rpx 24rpx;
}

.mat-info-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx 0;
}

.mat-info-item {
  width: 50%;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.mat-info-label {
  font-size: 22rpx;
  color: rgba(255, 255, 255, 0.7);
}

.mat-info-value {
  font-size: 28rpx;
  color: #fff;
  font-weight: 600;
}

.barcode-bar {
  padding: 16rpx 24rpx;
  background-color: #fff;
  border-bottom: 1rpx solid #f0f0f0;
}

.barcode-input-wrap {
  display: flex;
  align-items: center;
  background-color: #f5f7fa;
  border-radius: 8rpx;
  padding: 0 20rpx;
  height: 72rpx;
  gap: 12rpx;
}

.barcode-icon {
  font-size: 32rpx;
  color: #bbb;
  flex-shrink: 0;
}

.barcode-input {
  flex: 1;
  font-size: 28rpx;
  color: #333;
  height: 72rpx;
}

.barcode-clear {
  font-size: 24rpx;
  color: #bbb;
  padding: 4rpx;
  flex-shrink: 0;
}

.batch-card--pinned {
  border: 2rpx solid #1890ff;
}

.filter-bar {
  display: flex;
  align-items: center;
  background-color: #fff;
  border-bottom: 1rpx solid #f0f0f0;
}

.filter-cell {
  flex: 1;
  display: flex;
  align-items: center;
  padding: 20rpx 24rpx;
  gap: 8rpx;
  min-width: 0;
}

.filter-label {
  font-size: 26rpx;
  color: #999;
  white-space: nowrap;
  flex-shrink: 0;
}

.filter-trigger {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-width: 0;
}

.filter-value {
  font-size: 26rpx;
  color: #333;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.placeholder {
    color: #bbb;
  }
}

.filter-arrow {
  font-size: 20rpx;
  color: #bbb;
  flex-shrink: 0;
  margin-left: 4rpx;
}

.filter-clear {
  font-size: 22rpx;
  color: #bbb;
  flex-shrink: 0;
  padding: 4rpx;
}

.filter-divider {
  width: 1rpx;
  height: 40rpx;
  background-color: #eee;
  flex-shrink: 0;
}

.stat-bar {
  padding: 16rpx 24rpx;
  background-color: #f8f9fb;
  border-bottom: 1rpx solid #f0f0f0;
}

.stat-text {
  font-size: 24rpx;
  color: #999;
}

.batch-card {
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
  padding: 24rpx 24rpx 16rpx;
  border-bottom: 1rpx solid #f5f5f5;
}

.batch-no {
  font-size: 28rpx;
  font-weight: 600;
  color: #222;
}

.batch-status {
  padding: 4rpx 14rpx;
  border-radius: 4rpx;
  font-size: 24rpx;
  font-weight: 500;
}

.status-warning {
  background-color: #fff7e6;
  color: #faad14;
}

.status-info {
  background-color: #e6fffb;
  color: #13c2c2;
}

.status-success {
  background-color: #f6ffed;
  color: #52c41a;
}

.status-default {
  background-color: #f5f5f5;
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

  &.remaining {
    color: #1890ff;
  }
}

.qty-unit {
  font-size: 22rpx;
  font-weight: 400;
  color: #999;
  margin-left: 2rpx;
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
  color: #222;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-actions {
  display: flex;
  gap: 16rpx;
  padding: 16rpx 24rpx 20rpx;
  border-top: 1rpx solid #f5f5f5;
  justify-content: flex-end;
}

.action-btn {
  height: 56rpx;
  line-height: 56rpx;
  padding: 0 32rpx;
  border-radius: 28rpx;
  font-size: 24rpx;
  font-weight: 500;
  text-align: center;
}

.check-btn {
  color: #1890ff;
  border: 1rpx solid #1890ff;
  background-color: #e6f7ff;
}

.record-btn {
  color: #722ed1;
  border: 1rpx solid #722ed1;
  background-color: #f9f0ff;
}

.print-btn {
  color: #52c41a;
  border: 1rpx solid #52c41a;
  background-color: #f6ffed;
}

// 盘点弹窗
.check-popup {
  padding-bottom: env(safe-area-inset-bottom);
}

.check-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 32rpx 24rpx;
}

.check-title {
  font-size: 34rpx;
  font-weight: 600;
  color: #222;
}

.check-close {
  font-size: 32rpx;
  color: #999;
  padding: 8rpx;
}

.check-info {
  margin: 0 32rpx;
  background-color: #f8f9fb;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
}

.check-info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8rpx 0;
}

.check-info-label {
  font-size: 26rpx;
  color: #999;
}

.check-info-value {
  font-size: 26rpx;
  color: #222;
  font-weight: 600;

  &.old-qty {
    font-size: 30rpx;
    font-weight: 600;
    color: #1890ff;
  }
}

.check-form {
  margin: 24rpx 32rpx 0;
  border: 1rpx solid #f0f0f0;
  border-radius: 12rpx;
  overflow: hidden;
}

.check-field {
  display: flex;
  align-items: center;
  padding: 20rpx 24rpx;
  gap: 12rpx;
  border-bottom: 1rpx solid #f5f5f5;

  &:last-child {
    border-bottom: none;
  }
}

.check-field-label {
  font-size: 26rpx;
  color: #999;
  white-space: nowrap;
  flex-shrink: 0;
  width: 160rpx;

  &.required::before {
    content: '*';
    color: #ff4d4f;
    margin-right: 2rpx;
  }
}

.check-field-input {
  flex: 1;
  height: 64rpx;
  font-size: 28rpx;
  color: #333;
  padding: 0 16rpx;
  border: 1rpx solid #ddd;
  border-radius: 8rpx;
  background-color: #fafafa;

  &::placeholder {
    color: #ccc;
  }
}

.check-field-unit {
  font-size: 26rpx;
  color: #999;
  flex-shrink: 0;
}

.check-diff {
  margin: 16rpx 32rpx 0;
  padding: 16rpx 24rpx;
  border-radius: 8rpx;
  font-size: 26rpx;
  font-weight: 500;
  text-align: center;

  &.diff-up {
    background-color: #f6ffed;
    color: #52c41a;
  }

  &.diff-down {
    background-color: #fff2f0;
    color: #ff4d4f;
  }
}

.check-footer {
  display: flex;
  gap: 24rpx;
  padding: 24rpx 32rpx;
  border-top: 1rpx solid #f0f0f0;
  margin-top: 24rpx;
}

.cancel-btn,
.submit-btn {
  flex: 1;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 44rpx;
  font-size: 30rpx;
  font-weight: 500;
  text-align: center;
}

.cancel-btn {
  border: 1rpx solid #ddd;
  color: #666;
  background-color: #fff;
}

.submit-btn {
  color: #fff;
  background-color: #1890ff;

  &.loading {
    background-color: #91caff;
  }
}
</style>
