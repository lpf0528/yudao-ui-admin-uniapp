<script setup lang="ts">
import type { ZcProduct } from '@/api/curtain/product'
import type { ZcProductVersionSimple, ZcProductVersionSpecResp } from '@/api/curtain/product-version'
import type { ZcSupplierSimple } from '@/api/curtain/supplier'
import type { ZcWarehouseSimple } from '@/api/curtain/warehouse'
import type { LoadMoreState } from '@/http/types'
import { onReachBottom } from '@dcloudio/uni-app'
import { onMounted, ref } from 'vue'
import { createProductBatchList, getProductPage } from '@/api/curtain/product'
import { getProductVersionSimpleList } from '@/api/curtain/product-version'
import { getSupplierSimpleList } from '@/api/curtain/supplier'
import { getWarehouseSimpleList } from '@/api/curtain/warehouse'
import { useDictStore } from '@/store/dict'
import { navigateBackPlus } from '@/utils'

const dictStore = useDictStore()

function getUnitLabel(val: string) {
  return dictStore.getDictData('zc_product_unit', val)?.label ?? val ?? '-'
}

definePage({
  style: {
    navigationBarTitleText: '',
    navigationStyle: 'custom',
  },
})

// ---------- 列表 ----------
const total = ref(0)
const list = ref<ZcProduct[]>([])
const loadMoreState = ref<LoadMoreState>('loading')
const queryParams = ref({ pageNo: 1, pageSize: 20 })
const filterParams = ref<{ versionId?: number }>({})
const searchName = ref('')

const versionList = ref<ZcProductVersionSimple[]>([])
const versionIndex = ref<number | null>(null)

function handleBack() {
  navigateBackPlus()
}

async function getList() {
  loadMoreState.value = 'loading'
  try {
    const data = await getProductPage({
      ...queryParams.value,
      name: searchName.value || undefined,
      ...filterParams.value,
    })
    list.value = queryParams.value.pageNo === 1
      ? data.list
      : [...list.value, ...data.list]
    total.value = data.total
    loadMoreState.value = list.value.length >= total.value ? 'finished' : 'loading'
  } catch {
    if (queryParams.value.pageNo > 1)
      queryParams.value.pageNo--
    loadMoreState.value = 'error'
  }
}

function resetAndLoad() {
  queryParams.value.pageNo = 1
  list.value = []
  getList()
}

function handleSearch() {
  resetAndLoad()
}

function onVersionChange(e: any) {
  const idx = Number(e.detail.value)
  versionIndex.value = idx
  filterParams.value.versionId = versionList.value[idx]?.id
  resetAndLoad()
}

function clearVersion() {
  versionIndex.value = null
  filterParams.value.versionId = undefined
  resetAndLoad()
}

function loadMore() {
  if (loadMoreState.value === 'finished')
    return
  queryParams.value.pageNo++
  getList()
}

function handleViewInventory(item: ZcProduct) {
  uni.navigateTo({ url: `/pages-curtain/product-inbound/inventory/index?productId=${item.id}&productName=${item.name}` })
}

// ---------- 仓库 & 供应商下拉 ----------
const warehouseList = ref<ZcWarehouseSimple[]>([])
const supplierList = ref<ZcSupplierSimple[]>([])
const warehouseIndex = ref(0)
const supplierIndex = ref<number | null>(null)

async function loadDropdowns() {
  try {
    const [warehouses, suppliers, versions] = await Promise.all([
      getWarehouseSimpleList(),
      getSupplierSimpleList(),
      getProductVersionSimpleList(),
    ])
    warehouseList.value = warehouses
    supplierList.value = suppliers
    versionList.value = versions
    const defaultIdx = warehouses.findIndex(w => w.defaultStatus)
    if (defaultIdx >= 0)
      warehouseIndex.value = defaultIdx
  } catch {}
}

function onWarehouseChange(e: any) {
  warehouseIndex.value = Number(e.detail.value)
}

function onSupplierChange(e: any) {
  supplierIndex.value = Number(e.detail.value)
}

// ---------- 弹窗表单 ----------
interface BatchRow {
  specIndex: number | null
  inboundPrice: number | undefined
  inboundQuantity: number | undefined
  note: string
}

const showPopup = ref(false)
const currentProduct = ref<ZcProduct | null>(null)
const submitting = ref(false)
const batches = ref<BatchRow[]>([])
const specOptions = ref<ZcProductVersionSpecResp[]>([])

function getBatchSpec(batch: BatchRow): ZcProductVersionSpecResp | null {
  if (batch.specIndex === null)
    return null
  return specOptions.value[batch.specIndex] ?? null
}

function createDefaultSpecIndex(product?: ZcProduct): number | null {
  if (specOptions.value.length === 1)
    return 0
  if (product?.specId) {
    const idx = specOptions.value.findIndex(s => s.id === product.specId)
    return idx >= 0 ? idx : null
  }
  return null
}

function getSpecInboundPrice(specIndex: number | null): number | undefined {
  if (specIndex === null)
    return undefined
  return specOptions.value[specIndex]?.inboundPrice
}

function initSpecOptions(product: ZcProduct) {
  const version = versionList.value.find(v => v.id === product.versionId)
  specOptions.value = version?.specConfs ?? []
}

function onSpecChange(e: any, batchIndex: number) {
  const idx = Number(e.detail.value)
  const batch = batches.value[batchIndex]
  if (!batch)
    return
  batch.specIndex = idx
  batch.inboundPrice = specOptions.value[idx]?.inboundPrice
}

function newRow(product?: ZcProduct): BatchRow {
  const specIndex = createDefaultSpecIndex(product)
  return {
    specIndex,
    inboundPrice: getSpecInboundPrice(specIndex),
    inboundQuantity: undefined,
    note: '',
  }
}

function handleItemClick(item: ZcProduct) {
  currentProduct.value = item
  initSpecOptions(item)
  batches.value = [newRow(item)]
  supplierIndex.value = null
  showPopup.value = true
}

function handleClosePopup() {
  showPopup.value = false
  currentProduct.value = null
  specOptions.value = []
}

function addBatch() {
  batches.value.push(newRow())
}

function removeBatch(index: number) {
  batches.value.splice(index, 1)
}

async function handleSubmit() {
  if (!currentProduct.value)
    return

  for (let i = 0; i < batches.value.length; i++) {
    const b = batches.value[i]
    if (!getBatchSpec(b)) {
      uni.showToast({ title: `第 ${i + 1} 条批次请选择规格`, icon: 'none' })
      return
    }
    if (!b.inboundQuantity || b.inboundQuantity <= 0) {
      uni.showToast({ title: `第 ${i + 1} 条批次请填写入库数量`, icon: 'none' })
      return
    }
  }

  submitting.value = true
  try {
    const today = new Date().toISOString().slice(0, 10)
    await createProductBatchList(
      batches.value.map(b => ({
        productId: currentProduct.value!.id,
        inboundDate: today,
        inboundPrice: b.inboundPrice,
        inboundQuantity: b.inboundQuantity!,
        quantity: b.inboundQuantity!,
        warehouseId: warehouseList.value[warehouseIndex.value]?.id,
        supplierId: supplierIndex.value !== null ? supplierList.value[supplierIndex.value]?.id : undefined,
        note: b.note || undefined,
        spec: getBatchSpec(b)!.spec,
      })),
    )
    uni.showToast({ title: '入库成功', icon: 'success' })
    handleClosePopup()
  } catch {
    uni.showToast({ title: '入库失败，请重试', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

onReachBottom(() => { loadMore() })
onMounted(() => {
  getList()
  loadDropdowns()
})
</script>

<template>
  <view class="yd-page-container">
    <wd-navbar
      title="产品入库"
      left-arrow placeholder safe-area-inset-top fixed
      @click-left="handleBack"
    />

    <!-- 搜索栏 -->
    <view class="search-bar">
      <input
        v-model="searchName"
        type="text"
        class="search-input"
        placeholder="输入产品名称搜索"
        confirm-type="search"
        @confirm="handleSearch"
      >
      <view class="search-btn" @click="handleSearch">
        搜索
      </view>
    </view>

    <!-- 版本筛选 -->
    <view class="filter-bar">
      <view class="filter-cell">
        <text class="filter-label">版本</text>
        <picker
          mode="selector"
          :range="versionList"
          range-key="name"
          :value="versionIndex ?? 0"
          @change="onVersionChange"
        >
          <view class="filter-trigger">
            <text class="filter-value" :class="{ placeholder: versionIndex === null }">
              {{ versionIndex !== null ? (versionList[versionIndex]?.name || '全部') : '全部版本' }}
            </text>
            <text class="filter-arrow">▾</text>
          </view>
        </picker>
        <text v-if="versionIndex !== null" class="filter-clear" @click.stop="clearVersion">✕</text>
      </view>
    </view>

    <!-- 产品列表 -->
    <view class="p-24rpx">
      <view
        v-for="item in list"
        :key="item.id"
        class="mb-16rpx overflow-hidden rounded-8rpx bg-white shadow-sm"
        @click="handleItemClick(item)"
      >
        <view class="p-24rpx">
          <view class="mb-12rpx flex items-center justify-between">
            <view class="text-30rpx text-[#333] font-semibold">
              {{ item.name }}
            </view>
            <view class="inventory-btn" @click.stop="handleViewInventory(item)">
              查看库存
            </view>
          </view>
          <view class="grid grid-cols-2 gap-y-10rpx">
            <view class="info-item">
              <view class="label">
                版本:
              </view>
              <view class="value">
                {{ item.versionName || '-' }}
              </view>
            </view>
            <view class="info-item">
              <view class="label">
                供应商:
              </view>
              <view class="value">
                {{ item.supplierName || '-' }}
              </view>
            </view>
            <view class="info-item">
              <view class="label">
                单位:
              </view>
              <view class="value">
                {{ getUnitLabel(item.unitValue) }}
              </view>
            </view>
          </view>
        </view>
      </view>

      <view v-if="loadMoreState !== 'loading' && list.length === 0" class="py-100rpx text-center">
        <wd-status-tip image="content" tip="暂无产品数据" />
      </view>
      <wd-loadmore
        v-if="list.length > 0"
        :state="loadMoreState"
        @reload="loadMore"
      />
    </view>

    <!-- 入库表单弹窗 -->
    <wd-popup
      v-model="showPopup"
      position="bottom"
      :safe-area-inset-bottom="true"
      custom-style="border-radius: 24rpx 24rpx 0 0; max-height: 90vh; display: flex; flex-direction: column;"
      @close="handleClosePopup"
    >
      <view v-if="currentProduct" class="popup-container">
        <!-- 标题 -->
        <view class="popup-header">
          <view class="popup-title">
            产品入库
          </view>
          <view class="popup-close" @click="handleClosePopup">
            ✕
          </view>
        </view>

        <!-- 产品基本信息 -->
        <view class="product-info">
          <view class="product-name">
            {{ currentProduct.name }}
          </view>
          <view class="product-meta">
            <view class="meta-item">
              <text class="meta-label">版本</text>
              <text class="meta-value">{{ currentProduct.versionName || '-' }}</text>
            </view>
            <view class="meta-item">
              <text class="meta-label">供应商</text>
              <text class="meta-value">{{ currentProduct.supplierName || '-' }}</text>
            </view>
            <view class="meta-item">
              <text class="meta-label">单位</text>
              <text class="meta-value">{{ getUnitLabel(currentProduct.unitValue) }}</text>
            </view>
          </view>
        </view>

        <!-- 仓库 & 供应商下拉 -->
        <view class="filter-row">
          <view class="filter-cell">
            <text class="filter-label">仓库</text>
            <picker
              mode="selector"
              :range="warehouseList"
              range-key="name"
              :value="warehouseIndex"
              @change="onWarehouseChange"
            >
              <view class="filter-picker-trigger">
                <text class="filter-value">{{ warehouseList[warehouseIndex]?.name || '请选择仓库' }}</text>
                <text class="filter-arrow">▾</text>
              </view>
            </picker>
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
              <view class="filter-picker-trigger">
                <text class="filter-value" :class="{ placeholder: supplierIndex === null }">
                  {{ supplierIndex !== null ? (supplierList[supplierIndex]?.shortName || '请选择供应商') : '请选择供应商' }}
                </text>
                <text class="filter-arrow">▾</text>
              </view>
            </picker>
          </view>
        </view>

        <!-- 批次列表（可滚动） -->
        <scroll-view scroll-y class="batches-scroll" style="width: 100%; overflow-x: hidden;">
          <view
            v-for="(batch, index) in batches"
            :key="index"
            class="batch-card"
          >
            <!-- 批次标题行 -->
            <view class="batch-header">
              <view class="batch-index">
                批次 {{ index + 1 }}
              </view>
              <view
                v-if="batches.length > 1"
                class="batch-remove"
                @click="removeBatch(index)"
              >
                删除
              </view>
            </view>

            <!-- 规格 + 数量 + 进货价 -->
            <view class="batch-row batch-fields-row">
              <view class="top-field">
                <view class="field-label-top required">
                  规格
                </view>
                <picker
                  v-if="specOptions.length > 1"
                  mode="selector"
                  :range="specOptions"
                  range-key="spec"
                  :value="batch.specIndex ?? 0"
                  @change="onSpecChange($event, index)"
                >
                  <view class="top-field-picker">
                    <text class="top-field-text" :class="{ placeholder: batch.specIndex === null }">
                      {{ batch.specIndex !== null ? (specOptions[batch.specIndex]?.spec || '请选择') : '请选择' }}
                    </text>
                    <text class="filter-arrow">▾</text>
                  </view>
                </picker>
                <view v-else class="top-field-picker readonly">
                  <text class="top-field-text" :class="{ placeholder: !specOptions.length }">
                    {{ specOptions[0]?.spec || '暂无规格' }}
                  </text>
                </view>
              </view>
              <view class="top-field">
                <view class="field-label-top">
                  进货价
                </view>
                <input
                  v-model.number="batch.inboundPrice"
                  type="digit"
                  class="top-field-input"
                  placeholder="进货价"
                >
              </view>
              <view class="top-field">
                <view class="field-label-top required">
                  数量
                </view>
                <input
                  v-model.number="batch.inboundQuantity"
                  type="digit"
                  class="top-field-input"
                  placeholder="数量"
                >
              </view>
            </view>

            <!-- 备注 -->
            <view class="batch-row note-row">
              <view class="field-label">
                备注
              </view>
              <input
                v-model="batch.note"
                type="text"
                class="field-input note-input"
                placeholder="备注（选填）"
                :maxlength="200"
              >
            </view>
          </view>

          <!-- 添加批次按钮 -->
          <view class="add-batch-btn" @click="addBatch">
            + 添加批次
          </view>
        </scroll-view>

        <!-- 底部按钮 -->
        <view class="popup-footer">
          <view class="cancel-btn" @click="handleClosePopup">
            取消
          </view>
          <view class="submit-btn" :class="{ loading: submitting }" @click="handleSubmit">
            {{ submitting ? '提交中...' : `确认入库（${batches.length} 批）` }}
          </view>
        </view>
      </view>
    </wd-popup>
  </view>
</template>

<style lang="scss" scoped>
.search-bar {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 24rpx;
  background-color: #fff;
  border-bottom: 1rpx solid #f0f0f0;
}

.search-input {
  flex: 1;
  height: 72rpx;
  padding: 0 24rpx;
  border: 1rpx solid #ddd;
  border-radius: 36rpx;
  font-size: 28rpx;
  color: #333;
  background-color: #f9f9f9;

  &::placeholder {
    color: #bbb;
  }
}

.search-btn {
  flex-shrink: 0;
  height: 72rpx;
  padding: 0 36rpx;
  line-height: 72rpx;
  border-radius: 36rpx;
  font-size: 28rpx;
  font-weight: 500;
  color: #fff;
  background-color: #1890ff;
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
  padding: 4rpx 8rpx;
}

.inventory-btn {
  flex-shrink: 0;
  padding: 6rpx 24rpx;
  border-radius: 24rpx;
  font-size: 24rpx;
  font-weight: 500;
  color: #1890ff;
  border: 1rpx solid #1890ff;
  background-color: #e6f7ff;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.label {
  font-size: 24rpx;
  color: #999;
  white-space: nowrap;
  flex-shrink: 0;
}

.value {
  font-size: 26rpx;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

// 弹窗
.popup-container {
  display: flex;
  flex-direction: column;
  max-height: 90vh;
  width: 100%;
  overflow: hidden;
  padding-bottom: env(safe-area-inset-bottom);
  box-sizing: border-box;
}

.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 32rpx 32rpx 24rpx;
  flex-shrink: 0;
}

.popup-title {
  font-size: 34rpx;
  font-weight: 600;
  color: #222;
}

.popup-close {
  font-size: 32rpx;
  color: #999;
  padding: 8rpx;
}

.product-info {
  background-color: #f8f9fb;
  margin: 0 32rpx;
  border-radius: 12rpx;
  padding: 24rpx;
  flex-shrink: 0;
}

.product-name {
  font-size: 32rpx;
  font-weight: 600;
  color: #222;
  margin-bottom: 16rpx;
}

.product-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10rpx 0;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.meta-label {
  font-size: 24rpx;
  color: #999;
}

.meta-value {
  font-size: 24rpx;
  color: #555;
}

// 仓库 & 供应商下拉
.filter-row {
  display: flex;
  align-items: center;
  margin: 16rpx 32rpx 0;
  border: 1rpx solid #eee;
  border-radius: 12rpx;
  background-color: #f8f9fb;
  flex-shrink: 0;
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

.filter-picker-trigger {
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

.filter-divider {
  width: 1rpx;
  height: 40rpx;
  background-color: #eee;
  flex-shrink: 0;
}

// 批次滚动区
.batches-scroll {
  flex: 1;
  width: 100%;
  box-sizing: border-box;
  padding: 16rpx 32rpx 0;
  overflow-x: hidden;
}

.batch-card {
  width: 100%;
  box-sizing: border-box;
  background-color: #fff;
  border: 1rpx solid #f0f0f0;
  border-radius: 12rpx;
  padding: 0 24rpx;
  margin-bottom: 20rpx;
}

.batch-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 0 4rpx;
  border-bottom: 1rpx solid #f5f5f5;
}

.batch-index {
  font-size: 26rpx;
  font-weight: 600;
  color: #1890ff;
}

.batch-remove {
  font-size: 24rpx;
  color: #ff4d4f;
  padding: 4rpx 8rpx;
}

.batch-row {
  display: flex;
  align-items: center;
  min-height: 80rpx;
  border-bottom: 1rpx solid #f5f5f5;

  &:last-child {
    border-bottom: none;
  }

  &.batch-fields-row {
    align-items: flex-start;
    gap: 12rpx;
    padding: 16rpx 4rpx;
  }

  &.note-row {
    gap: 12rpx;
    padding: 0 4rpx;
  }
}

.top-field {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.field-label-top {
  font-size: 24rpx;
  color: #999;
  line-height: 1.2;

  &.required::before {
    content: '*';
    color: #ff4d4f;
    margin-right: 2rpx;
  }
}

.top-field-input {
  width: 100%;
  height: 64rpx;
  padding: 0 12rpx;
  font-size: 26rpx;
  color: #333;
  border: 1rpx solid #ddd;
  border-radius: 8rpx;
  background-color: #fafafa;
  box-sizing: border-box;

  &::placeholder {
    color: #ccc;
  }
}

.top-field-picker {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64rpx;
  padding: 0 12rpx;
  border: 1rpx solid #ddd;
  border-radius: 8rpx;
  background-color: #fafafa;
  box-sizing: border-box;

  &.readonly {
    background-color: #f5f5f5;
  }
}

.top-field-text {
  flex: 1;
  min-width: 0;
  font-size: 26rpx;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.placeholder {
    color: #ccc;
  }
}

.batch-field {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 0 4rpx;
}

.batch-field-divider {
  width: 1rpx;
  height: 40rpx;
  background-color: #eee;
  flex-shrink: 0;
}

.field-label {
  font-size: 26rpx;
  color: #999;
  white-space: nowrap;
  flex-shrink: 0;

  &.required::before {
    content: '*';
    color: #ff4d4f;
    margin-right: 2rpx;
  }
}

.field-input {
  flex: 1;
  min-width: 0;
  height: 64rpx;
  padding: 0 16rpx;
  font-size: 28rpx;
  color: #333;
  text-align: right;
  border: 1rpx solid #ddd;
  border-radius: 8rpx;
  background-color: #fafafa;

  &.note-input {
    text-align: left;
  }

  &::placeholder {
    color: #ccc;
  }
}

// 添加批次
.add-batch-btn {
  height: 80rpx;
  line-height: 80rpx;
  text-align: center;
  font-size: 28rpx;
  color: #1890ff;
  border: 1rpx dashed #91caff;
  border-radius: 12rpx;
  margin-bottom: 24rpx;
  background-color: #f0f7ff;
}

// 底部按钮
.popup-footer {
  display: flex;
  gap: 24rpx;
  padding: 24rpx 32rpx;
  flex-shrink: 0;
  border-top: 1rpx solid #f0f0f0;
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
