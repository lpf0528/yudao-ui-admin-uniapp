<script setup lang="ts">
import type { SalesOrderDetail, SalesOrderMaterialDetail } from '@/api/curtain/order'
import { onMounted, ref } from 'vue'
import { getSalesOrderDetail } from '@/api/curtain/order'
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

function getStatusLabel(val: string) {
  return dictStore.getDictData('zc_order_status', val)?.label ?? val ?? '-'
}

function getStatusColorType(val: string) {
  return dictStore.getDictData('zc_order_status', val)?.colorType ?? 'default'
}

function getTypeLabel(val: string) {
  return dictStore.getDictData('zc_order_type', val)?.label ?? val ?? '-'
}

function getUnitLabel(val: string) {
  return dictStore.getDictData('zc_product_unit', val)?.label ?? val ?? '-'
}

function goInventory(mat: SalesOrderMaterialDetail) {
  uni.navigateTo({
    url: `/pages-curtain/cutting-outbound/index?mat=${encodeURIComponent(JSON.stringify(mat))}`,
  })
}

onMounted(async () => {
  try {
    detail.value = await getSalesOrderDetail(Number(props.id))
  } finally {
    loading.value = false
  }
})
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

      <!-- 操作卡片 -->
      <view class="action-card">
        <wd-button type="primary" size="medium" @click="() => {}">
          发货
        </wd-button>
        <wd-button type="info" size="medium" plain @click="() => {}">
          打印发货联
        </wd-button>
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

      <!-- 窗帘明细 -->
      <view class="info-card">
        <view class="card-title">
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
            <view class="flex items-center gap-8rpx">
              <view class="curtain-index">
                {{ idx + 1 }}
              </view>
              <view class="text-28rpx text-[#333] font-medium">
                {{ curtain.curtainName || '-' }}
              </view>
            </view>
            <view class="text-24rpx text-[#999]">
              {{ curtain.room || '-' }}
            </view>
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
                  <view class="material-item-value material-item-value--pending">
                    未配料
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
  width: 33.333%;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.material-item-label {
  font-size: 24rpx;
  color: #999;
}

.material-item-value {
  font-size: 28rpx;
  color: #333;
  word-break: break-all;

  &--pending {
    color: #faad14;
  }
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
