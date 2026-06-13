<template>
  <view class="yd-page-container">
    <!-- 顶部导航栏 -->
    <wd-navbar
      title="销售订单列表"
      left-arrow placeholder safe-area-inset-top fixed
      @click-left="handleBack"
    />

    <!-- 顶部筛选栏 -->
    <view class="filter-container">
      <!-- 订单号 + 客户 -->
      <view class="filter-section">
        <view class="search-inputs">
          <input
            v-model="filterParams.orderNo"
            type="text"
            class="search-input"
            placeholder="订单号"
          >
          <picker
            mode="selector"
            :range="customerOptions"
            range-key="shortName"
            :value="selectedCustomerIndex"
            class="customer-picker"
            @change="onCustomerChange"
          >
            <view class="search-input picker-text" :class="{ 'has-value': filterParams.customerId }">
              {{ selectedCustomerName || '选择客户' }}
            </view>
          </picker>
        </view>
      </view>

      <!-- 订单类型 -->
      <view class="filter-section">
        <view class="filter-label">
          订单类型
        </view>
        <view class="status-chips">
          <view
            v-for="item in typeOptions"
            :key="item.value"
            class="status-chip" :class="[{ active: filterParams.types === item.value }]"
            @click="filterParams.types = item.value"
          >
            {{ item.label }}
          </view>
        </view>
      </view>

      <!-- 下单时间范围 -->
      <view class="filter-section">
        <view class="filter-label">
          下单时间
        </view>
        <view class="filter-inputs">
          <picker
            mode="date"
            :value="filterParams.startDate"
            class="date-picker-wrapper"
            @change="(e: any) => filterParams.startDate = e.detail.value"
          >
            <view class="date-input">
              {{ filterParams.startDate || '开始日期' }}
            </view>
          </picker>
          <view class="date-separator">
            至
          </view>
          <picker
            mode="date"
            :value="filterParams.endDate"
            class="date-picker-wrapper"
            @change="(e: any) => filterParams.endDate = e.detail.value"
          >
            <view class="date-input">
              {{ filterParams.endDate || '结束日期' }}
            </view>
          </picker>
        </view>
      </view>

      <!-- 操作按钮 -->
      <view class="filter-actions">
        <view class="reset-btn" @click="handleReset">
          重置
        </view>
        <view class="search-btn" @click="handleQuery">
          查询
        </view>
      </view>
    </view>

    <!-- 订单列表 -->
    <view class="p-24rpx">
      <view
        v-for="(item, index) in list"
        :key="item.id"
        class="mb-16rpx overflow-hidden rounded-8rpx bg-white shadow-sm"
        @click="handleDetail(item)"
      >
        <view class="p-24rpx">
          <!-- 头部：订单类型 + 序号 + 订单号 + 套数 | 加急 -->
          <view class="mb-16rpx flex items-center justify-between">
            <view class="flex items-center gap-8rpx">
              <view v-if="item.types" class="order-type" :class="[`status-${getTypeColorType(item.types)}`]">
                {{ getTypeLabel(item.types) }}
              </view>
              <view class="text-30rpx text-[#333] font-semibold">
                {{ index + 1 }}、{{ item.orderNo }}
              </view>
              <view class="text-24rpx text-[#999]">
                共{{ item.sets ?? 0 }}套
              </view>
            </view>
            <view v-if="item.isExpedited" class="urgent-tag">
              加急
            </view>
          </view>

          <!-- 主体信息 -->
          <view class="grid grid-cols-2 gap-y-12rpx">
            <view class="order-item">
              <view class="label">
                客户名称:
              </view>
              <view class="value">
                {{ item.customerName || '-' }}
              </view>
            </view>
            <view class="order-item">
              <view class="label">
                订单状态:
              </view>
              <view class="order-status" :class="[`status-${getStatusColorType(item.status)}`]">
                {{ getStatusLabel(item.status) }}
              </view>
            </view>
            <view class="order-item">
              <view class="label">
                下单时间:
              </view>
              <view class="value">
                {{ item.orderDate || '-' }}
              </view>
            </view>
            <view class="order-item">
              <view class="label">
                交付时间:
              </view>
              <view class="value">
                {{ item.deliveryDate || '-' }}
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-if="loadMoreState !== 'loading' && list.length === 0" class="py-100rpx text-center">
        <wd-status-tip image="content" tip="暂无订单数据" />
      </view>
      <wd-loadmore
        v-if="list.length > 0"
        :state="loadMoreState"
        @reload="loadMore"
      />
    </view>
  </view>
</template>

<script lang="ts" setup>
import type { CustomerSimple } from '@/api/curtain/customer'
import type { SalesOrder } from '@/api/curtain/order'
import type { LoadMoreState } from '@/http/types'
import { onReachBottom } from '@dcloudio/uni-app'
import { computed, onMounted, ref } from 'vue'
import { getCustomerSimpleList } from '@/api/curtain/customer'
import { getSalesOrderPage, ZcOrderType } from '@/api/curtain/order'
import { useDictStore } from '@/store/dict'
import { navigateBackPlus } from '@/utils'

definePage({
  style: {
    navigationBarTitleText: '',
    navigationStyle: 'custom',
  },
})

const total = ref(0)
const list = ref<SalesOrder[]>([])
const loadMoreState = ref<LoadMoreState>('loading')
const queryParams = ref({
  pageNo: 1,
  pageSize: 10,
})
const filterParams = ref({
  orderNo: '',
  customerId: undefined as number | undefined,
  types: '',
  startDate: '',
  endDate: '',
})

const customers = ref<CustomerSimple[]>([])
const customerOptions = computed(() => [{ id: undefined, shortName: '全部客户' }, ...customers.value])
const selectedCustomerIndex = computed(() => {
  if (!filterParams.value.customerId)
    return 0
  const idx = customerOptions.value.findIndex(c => c.id === filterParams.value.customerId)
  return idx > 0 ? idx : 0
})
const selectedCustomerName = computed(() => {
  if (!filterParams.value.customerId)
    return ''
  return customers.value.find(c => c.id === filterParams.value.customerId)?.shortName ?? ''
})

function onCustomerChange(e: any) {
  const idx = e.detail.value as number
  filterParams.value.customerId = customerOptions.value[idx]?.id
}

const dictStore = useDictStore()
const typeOptions = computed(() => [
  { label: '全部', value: '' },
  ...dictStore.getDictOptions('zc_order_type'),
])

function getTypeLabel(value: string) {
  return dictStore.getDictData('zc_order_type', value)?.label ?? value ?? '-'
}

function getTypeColorType(value: string) {
  return dictStore.getDictData('zc_order_type', value)?.colorType ?? 'default'
}

function getStatusLabel(status: string) {
  return dictStore.getDictData('zc_order_status', status)?.label ?? status ?? '-'
}

function getStatusColorType(status: string) {
  return dictStore.getDictData('zc_order_status', status)?.colorType ?? 'default'
}

function handleBack() {
  navigateBackPlus()
}

async function getList() {
  loadMoreState.value = 'loading'
  try {
    const params: Record<string, any> = {
      pageNo: queryParams.value.pageNo,
      pageSize: queryParams.value.pageSize,
    }
    if (filterParams.value.orderNo)
      params.orderNo = filterParams.value.orderNo
    if (filterParams.value.customerId)
      params.customerId = filterParams.value.customerId
    if (filterParams.value.types)
      params.types = filterParams.value.types
    if (filterParams.value.startDate || filterParams.value.endDate) {
      params.orderDate = [
        filterParams.value.startDate ? `${filterParams.value.startDate} 00:00:00` : '',
        filterParams.value.endDate ? `${filterParams.value.endDate} 23:59:59` : '',
      ]
    }

    const data = await getSalesOrderPage(params as any)
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

function handleQuery() {
  queryParams.value.pageNo = 1
  list.value = []
  getList()
}

function handleReset() {
  filterParams.value = { orderNo: '', customerId: undefined, types: '', startDate: '', endDate: '' }
  queryParams.value.pageNo = 1
  list.value = []
  getList()
}

function loadMore() {
  if (loadMoreState.value === 'finished')
    return
  queryParams.value.pageNo++
  getList()
}

function handleDetail(item: SalesOrder) {
  if (item.types === ZcOrderType.FABRIC) {
    uni.navigateTo({ url: `/pages-curtain/order/fabric-detail/index?id=${item.id}` })
  } else {
    uni.navigateTo({ url: `/pages-curtain/order/curtain-order-detail/index?id=${item.id}` })
  }
}

onReachBottom(() => { loadMore() })
onMounted(() => {
  getCustomerSimpleList().then((list) => { customers.value = list })
  getList()
})
</script>

<style lang="scss" scoped>
.filter-container {
  background-color: #fff;
  padding: 16rpx 24rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.filter-section {
  margin-bottom: 20rpx;

  &:last-of-type {
    margin-bottom: 16rpx;
  }
}

.search-inputs {
  display: flex;
  gap: 12rpx;
}

.customer-picker {
  flex: 1;
}

.picker-text {
  color: #bbb;
  text-align: left;

  &.has-value {
    color: #1890ff;
  }
}

.search-input {
  flex: 1;
  padding: 10rpx 16rpx;
  border: 1rpx solid #ddd;
  border-radius: 8rpx;
  font-size: 28rpx;
  color: #333;
  background-color: #f9f9f9;

  &::placeholder {
    color: #bbb;
  }
}

.filter-label {
  font-size: 28rpx;
  color: #666;
  font-weight: 500;
  margin-bottom: 10rpx;
}

.filter-inputs {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.date-picker-wrapper {
  flex: 1;
}

.date-input {
  padding: 10rpx 12rpx;
  border: 1rpx solid #ddd;
  border-radius: 8rpx;
  font-size: 26rpx;
  color: #333;
  background-color: #f9f9f9;
  text-align: center;
}

.date-separator {
  color: #999;
  font-size: 28rpx;
}

.status-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}

.status-chip {
  padding: 6rpx 20rpx;
  border: 1rpx solid #ddd;
  border-radius: 24rpx;
  font-size: 26rpx;
  color: #666;
  background-color: #fff;

  &.active {
    border-color: #1890ff;
    background-color: #e6f7ff;
    color: #1890ff;
  }
}

.filter-actions {
  display: flex;
  gap: 12rpx;
}

.reset-btn,
.search-btn {
  flex: 1;
  padding: 10rpx;
  border-radius: 8rpx;
  font-size: 28rpx;
  font-weight: 500;
  text-align: center;
}

.reset-btn {
  border: 1rpx solid #ddd;
  color: #333;
  background-color: #fff;
}

.search-btn {
  border: none;
  color: #fff;
  background-color: #1890ff;
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

.order-status {
  padding: 4rpx 14rpx;
  border-radius: 4rpx;
  font-size: 24rpx;
  font-weight: 500;
}

.order-type {
  display: inline-block;
  padding: 2rpx 12rpx;
  border-radius: 4rpx;
  font-size: 26rpx;
  font-weight: 500;
}

.urgent-tag {
  display: inline-block;
  padding: 2rpx 12rpx;
  border-radius: 4rpx;
  font-size: 22rpx;
  font-weight: 500;
  background-color: #fff1f0;
  color: #ff4d4f;
  border: 1rpx solid #ffccc7;
}

.order-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8rpx;
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
</style>
