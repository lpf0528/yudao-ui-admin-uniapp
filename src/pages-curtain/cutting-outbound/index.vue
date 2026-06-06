<script setup lang="ts">
import type { ZcProductBatch } from '@/api/curtain/product'
import type { ZcSupplierSimple } from '@/api/curtain/supplier'
import type { ZcWarehouseSimple } from '@/api/curtain/warehouse'
import type { LoadMoreState } from '@/http/types'
import { computed, onMounted, ref } from 'vue'
import { createInventoryRecord } from '@/api/curtain/inventory-record'
import { cutMaterial } from '@/api/curtain/order'
import { getProductBatchPage } from '@/api/curtain/product'
import { getSupplierSimpleList } from '@/api/curtain/supplier'
import { getWarehouseSimpleList } from '@/api/curtain/warehouse'
import { useDictStore } from '@/store/dict'
import { navigateBackPlus } from '@/utils'

const dictStore = useDictStore()

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
  productId: number
  productName: string
  batchId: number
  batchNo: string
  elementName: string
  quantity: number
  unitValue: string
}

const matInfo = ref<MatInfo | null>(null)
const barcodeInput = ref('')

const productId = ref<number | undefined>()
const productName = ref('')

const total = ref(0)
const list = ref<ZcProductBatch[]>([])

const displayList = computed(() => {
  let result = list.value

  if (barcodeInput.value.trim()) {
    const keyword = barcodeInput.value.trim().toLowerCase()
    result = result.filter(item => item.batchNo?.toLowerCase().includes(keyword))
  }

  const pinnedId = matInfo.value?.batchId
  if (pinnedId) {
    const idx = result.findIndex(item => item.id === pinnedId)
    if (idx > 0)
      result = [result[idx], ...result.slice(0, idx), ...result.slice(idx + 1)]
  }

  return result
})
const loadMoreState = ref<LoadMoreState>('loading')
const queryParams = ref({ pageNo: 1, pageSize: 199 })
const filterParams = ref<{ warehouseId?: number, supplierId?: number }>({})

const warehouseList = ref<ZcWarehouseSimple[]>([])
const supplierList = ref<ZcSupplierSimple[]>([])
const warehouseIndex = ref<number | null>(null)
const supplierIndex = ref<number | null>(null)

function handleBack() {
  navigateBackPlus()
}

async function getList() {
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

function onSupplierChange(e: any) {
  const idx = Number(e.detail.value)
  supplierIndex.value = idx
  filterParams.value.supplierId = supplierList.value[idx]?.id
  resetAndLoad()
}

function clearWarehouse() {
  warehouseIndex.value = null
  filterParams.value.warehouseId = undefined
  resetAndLoad()
}

function clearSupplier() {
  supplierIndex.value = null
  filterParams.value.supplierId = undefined
  resetAndLoad()
}

async function loadDropdowns() {
  try {
    const [warehouses, suppliers] = await Promise.all([
      getWarehouseSimpleList(),
      getSupplierSimpleList(),
    ])
    warehouseList.value = warehouses
    supplierList.value = suppliers
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
    })
    uni.showToast({ title: '裁剪成功', icon: 'success' })
    handleCloseCutPopup()
    resetAndLoad()
  } catch {
    uni.showToast({ title: '裁剪失败，请重试', icon: 'none' })
  } finally {
    cutSubmitting.value = false
  }
}

function handlePrintLabel(item: ZcProductBatch) {
  const enc = encodeURIComponent
  const query = `batchId=${item.id}`
    + `&batchNo=${enc(item.batchNo || String(item.id))}`
    + `&productName=${enc(item.productName || '')}`
    + `&versionName=${enc(item.versionName || '')}`
    + `&specValue=${enc(item.specValue || '')}`
    + `&note=${enc(item.note || '')}`
  uni.navigateTo({ url: `/pages-curtain/product-inbound/print-label/index?${query}` })
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
    } catch {}
  } else {
    productId.value = opts.productId ? Number(opts.productId) : undefined
    productName.value = decodeURIComponent(opts.productName ?? '')
  }

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

    <!-- Barcode 输入筛选 -->
    <view class="barcode-bar">
      <view class="barcode-input-wrap">
        <text class="barcode-icon">⌕</text>
        <input
          v-model="barcodeInput"
          class="barcode-input"
          placeholder="扫码或输入批次号筛选"
          confirm-type="search"
        >
        <text v-if="barcodeInput" class="barcode-clear" @click="barcodeInput = ''">✕</text>
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
      <view class="filter-divider" />
      <view class="filter-cell">
        <text class="filter-label">供应商</text>
        <picker
          mode="selector"
          :range="supplierList"
          range-key="shortName"
          :value="supplierIndex ?? 0"
          @change="onSupplierChange"
        >
          <view class="filter-trigger">
            <text class="filter-value" :class="{ placeholder: supplierIndex === null }">
              {{ supplierIndex !== null ? (supplierList[supplierIndex]?.shortName || '全部') : '全部供应商' }}
            </text>
            <text class="filter-arrow">▾</text>
          </view>
        </picker>
        <text v-if="supplierIndex !== null" class="filter-clear" @click.stop="clearSupplier">✕</text>
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
        <!-- 顶部行：批号 + 日期 -->
        <view class="card-header">
          <view class="batch-no">
            {{ item.batchNo || `批次 #${item.id}` }}
          </view>
          <view class="inbound-date">
            {{ item.inboundDate || '-' }}
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
            <text class="detail-label">供应商</text>
            <text class="detail-value">{{ item.supplierName || '-' }}</text>
          </view>
          <view v-if="item.note" class="detail-item full-width">
            <text class="detail-label">备注</text>
            <text class="detail-value">{{ item.note }}</text>
          </view>
        </view>

        <!-- 操作按钮 -->
        <view class="card-actions">
          <view class="action-btn check-btn" @click.stop="handleStockCheck(item)">
            库存盘点
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
  </view>
</template>

<style lang="scss" scoped>
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
  font-weight: 500;
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

.inbound-date {
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
  color: #555;
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
  color: #333;

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
