<template>
  <view class="yd-page-container">
    <!-- 顶部导航栏 -->
    <wd-navbar
      title="订单列表"
      left-arrow placeholder safe-area-inset-top fixed
      @click-left="handleBack"
    />

    <!-- 顶部筛选栏 -->
    <view class="filter-container">
      <!-- 订单号和客户名称搜索 -->
      <view class="filter-section">
        <view class="search-inputs">
          <input
            v-model="filterParams.orderNo"
            type="text"
            class="search-input"
            placeholder="订单号"
            @change="handleFilterChange"
          >
          <input
            v-model="filterParams.customerName"
            type="text"
            class="search-input"
            placeholder="客户名称"
            @change="handleFilterChange"
          >
        </view>
      </view>

      <!-- 时间范围筛选 -->
      <view class="filter-section">
        <view class="filter-label">
          订单日期
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

      <!-- 订单状态筛选 -->
      <view class="filter-section">
        <view class="filter-label">
          订单状态
        </view>
        <view class="status-chips">
          <view
            v-for="(text, status) in statusOptions"
            :key="status"
            class="status-chip" :class="[{ active: filterParams.status === status }]"
            @click="filterParams.status = status; handleFilterChange()"
          >
            {{ text }}
          </view>
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
        <view class="p-16rpx">
          <!-- 订单卡片头部：订单号和状态 -->
          <view class="mb-16rpx flex items-center justify-between">
            <view class="text-36rpx text-[#333] font-semibold">
              {{ index + 1 }}、NO：{{ item.order_no }}
            </view>
            <view class="text-32rpx">
              共<text class="text-red">{{ item.total }}</text>套
            </view>
            <view class="order-status" :class="[`status-${item.status}`]">
              {{ getStatusText(item.status) }}
            </view>
          </view>

          <!-- 订单卡片主要信息 -->
          <view class="grid grid-cols-2 gap-12rpx">
            <view class="order-item">
              <view class="value">
                客户：{{ item.customer_name }}
              </view>
            </view>

            <view class="order-item">
              <view class="value">
                类型：{{ item.types }}
              </view>
            </view>
            <view class="order-item">
              <view class="value">
                下单：{{ item.order_date }}
              </view>
            </view>
            <view class="order-item">
              <view class="value">
                交货：{{ item.delivery_date }}
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

    <!-- 新增按钮 -->
    <wd-fab
      position="right-bottom"
      type="primary"
      :expandable="false"
      @click="handleAdd"
    />
  </view>
</template>

<script lang="ts" setup>
import type { Order } from '@/api/curtain/order'
import type { LoadMoreState } from '@/http/types'
import { onReachBottom } from '@dcloudio/uni-app'
import { onMounted, ref } from 'vue'
import { getOrderPage } from '@/api/curtain/order'
import { navigateBackPlus } from '@/utils'

definePage({
  style: {
    navigationBarTitleText: '',
    navigationStyle: 'custom',
  },
})

const total = ref(0)
const list = ref<Order[]>([])
const loadMoreState = ref<LoadMoreState>('loading')
const queryParams = ref({
  pageNo: 1,
  pageSize: 10,
})
const filterParams = ref({
  orderNo: '',
  customerName: '',
  startDate: '',
  endDate: '',
  status: '',
})

const statusOptions = {
  '': '全部',
  '0': '待审核',
  '1': '已审核',
  '2': '已取消',
}

/** 获取状态文本 */
function getStatusText(status: number) {
  const statusMap: Record<number, string> = {
    0: '待审核',
    1: '已审核',
    2: '已取消',
  }
  return statusMap[status] || '未知'
}

/** 返回上一页 */
function handleBack() {
  navigateBackPlus()
}

/** 查询订单列表 */
async function getList() {
  loadMoreState.value = 'loading'
  try {
    const data = await getOrderPage(queryParams.value)
    list.value = [...list.value, ...data.list]
    total.value = data.total
    loadMoreState.value = list.value.length >= total.value ? 'finished' : 'loading'
  } catch {
    queryParams.value.pageNo = queryParams.value.pageNo > 1 ? queryParams.value.pageNo - 1 : 1
    loadMoreState.value = 'error'
  }
}

/** 筛选条件变化 */
function handleFilterChange() {
  // 仅用于触发UI更新
}

/** 查询按钮操作 */
function handleQuery() {
  const filter: Record<string, any> = {
    pageNo: 1,
    pageSize: queryParams.value.pageSize,
  }

  if (filterParams.value.orderNo) {
    filter.orderNo = filterParams.value.orderNo
  }
  if (filterParams.value.customerName) {
    filter.customerName = filterParams.value.customerName
  }
  if (filterParams.value.startDate) {
    filter.startDate = filterParams.value.startDate
  }
  if (filterParams.value.endDate) {
    filter.endDate = filterParams.value.endDate
  }
  if (filterParams.value.status !== '') {
    filter.status = Number(filterParams.value.status)
  }

  queryParams.value = filter
  list.value = [] // 清空列表
  getList()
}

/** 重置按钮操作 */
function handleReset() {
  filterParams.value = {
    orderNo: '',
    customerName: '',
    startDate: '',
    endDate: '',
    status: '',
  }
  queryParams.value = {
    pageNo: 1,
    pageSize: 10,
  }
  list.value = [] // 清空列表
  getList()
}

/** 加载更多 */
function loadMore() {
  if (loadMoreState.value === 'finished') {
    return
  }
  queryParams.value.pageNo++
  getList()
}

/** 新增订单 */
function handleAdd() {
  uni.navigateTo({
    url: '/pages-curtain/order/form/index',
  })
}

/** 查看详情 */
function handleDetail(item: Order) {
  uni.navigateTo({
    url: `/pages-curtain/order/detail/index?id=${item.id}`,
  })
}

/** 触底加载更多 */
onReachBottom(() => {
  loadMore()
})

/** 初始化 */
onMounted(() => {
  getList()
})
</script>

<style lang="scss" scoped>
.filter-container {
  background-color: #fff;
  padding: 16rpx 24rpx;
  // margin-top: 88rpx;
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

.search-input {
  flex: 1;
  padding: 8rpx 12rpx;
  border: 1rpx solid #ddd;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: #333;
  background-color: #fff;

  &::placeholder {
    color: #999;
  }
}

.filter-label {
  font-size: 30rpx;
  color: #333;
  font-weight: 500;
  margin-bottom: 8rpx;
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
  border-radius: 12rpx;
  font-size: 28rpx;
  color: #333;
  background-color: #fff;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;

  &:active {
    background-color: #f5f5f5;
  }
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
  padding: 8rpx 16rpx;
  border: 1rpx solid #ddd;
  border-radius: 24rpx;
  font-size: 28rpx;
  color: #666;
  background-color: #fff;
  transition: all 0.3s ease;

  &:active {
    opacity: 0.7;
  }

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
  border-radius: 12rpx;
  font-size: 30rpx;
  font-weight: 500;
  text-align: center;
  transition: all 0.3s ease;
}

.reset-btn {
  border: 1rpx solid #ddd;
  color: #333;
  background-color: #fff;

  &:active {
    background-color: #f5f5f5;
  }
}

.search-btn {
  border: none;
  color: #fff;
  background-color: #1890ff;

  &:active {
    background-color: #0050b3;
  }
}

.order-status {
  padding: 4rpx 12rpx;
  border-radius: 4rpx;
  font-size: 28rpx;
  font-weight: 500;

  &.status-0 {
    background-color: #fff7e6;
    color: #faad14;
  }

  &.status-1 {
    background-color: #f6ffed;
    color: #52c41a;
  }

  &.status-2 {
    background-color: #fff1f0;
    color: #ff4d4f;
  }
}

.order-item {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.label {
  font-size: 28rpx;
  color: #999;
}

.value {
  font-size: 30rpx;
  color: #333;
  font-weight: 500;
}
</style>
