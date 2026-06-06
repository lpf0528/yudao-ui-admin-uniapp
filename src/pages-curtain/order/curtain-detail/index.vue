<script setup lang="ts">
import type { SalesOrderCurtainDetail } from '@/api/curtain/order'
import { onShow } from '@dcloudio/uni-app'
import { ref } from 'vue'
import { getSalesOrderDetail } from '@/api/curtain/order'
import { useDictStore } from '@/store/dict'
import { navigateBackPlus } from '@/utils'

const props = defineProps<{ orderId: string, curtainId: string }>()

definePage({
  style: {
    navigationBarTitleText: '',
    navigationStyle: 'custom',
  },
})

const loading = ref(true)
const curtain = ref<SalesOrderCurtainDetail>()
const curtainIndex = ref(0)
const totalSets = ref(0)
const activeStructureIdx = ref(0)
const dictStore = useDictStore()

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

function formatMountings(val: string) {
  if (!val)
    return '-'
  try {
    const arr = JSON.parse(val)
    if (Array.isArray(arr))
      return arr.join('、')
  } catch {}
  return val
}

function getStructureAttrValue(structure: any, key: string): string | null {
  if (key === 'installProcessId') {
    return structure.installProcessName || null
  }
  if (key === 'shaping') {
    return structure.isShaping ? '是' : '否'
  }
  if (key === 'pasteDirection') {
    const val = structure.pasteDirection
    if (!val)
      return null
    return dictStore.getDictData('zc_paste_direction', val)?.label ?? val
  }
  const val = structure[key]
  if (val === null || val === undefined || val === '')
    return null
  return String(val)
}

function getUnitLabel(val: string) {
  return dictStore.getDictData('zc_product_unit', val)?.label ?? val ?? '-'
}

async function loadDetail() {
  loading.value = true
  try {
    const detail = await getSalesOrderDetail(Number(props.orderId))
    const idx = detail.curtains?.findIndex(c => c.id === Number(props.curtainId)) ?? -1
    curtain.value = detail.curtains?.[idx]
    curtainIndex.value = idx + 1
    totalSets.value = detail.sets
  } finally {
    loading.value = false
  }
}

onShow(loadDetail)
</script>

<template>
  <view class="yd-page-container">
    <wd-navbar
      title="窗帘详情"
      left-arrow placeholder safe-area-inset-top fixed
      @click-left="navigateBackPlus()"
    />

    <view v-if="loading" class="flex items-center justify-center py-120rpx">
      <wd-loading />
    </view>

    <template v-else-if="curtain">
      <!-- 窗帘基本信息 -->
      <view class="info-card">
        <view class="card-header">
          <view class="flex items-center gap-12rpx">
            <view class="text-34rpx text-[#333] font-semibold">
              {{ curtain.curtainName || '-' }}
            </view>
            <view class="text-26rpx text-[#999]">
              {{ curtainIndex }}/{{ totalSets }}
            </view>
          </view>
          <view class="status-badge" :class="`status-${getStatusColorType((curtain as any).status)}`">
            {{ getStatusLabel((curtain as any).status) }}
          </view>
        </view>

        <view class="info-grid">
          <view class="info-row one-third">
            <view class="info-label">
              房间
            </view>
            <view class="info-value">
              {{ curtain.room || '-' }}
            </view>
          </view>
          <view class="info-row one-third">
            <view class="info-label">
              褶倍
            </view>
            <view class="info-value">
              {{ curtain.pleatRatioValue ?? '-' }}
            </view>
          </view>
          <view class="info-row one-third">
            <view class="info-label">
              褶距
            </view>
            <view class="info-value">
              {{ curtain.pleatsDistance ?? '-' }}
            </view>
          </view>
          <view v-if="curtain.mountings" class="info-row full-width">
            <view class="info-label">
              配件
            </view>
            <view class="info-value">
              {{ formatMountings(curtain.mountings) }}
            </view>
          </view>
          <view v-if="curtain.note" class="info-row full-width">
            <view class="info-label">
              备注
            </view>
            <view class="info-value">
              {{ curtain.note }}
            </view>
          </view>
        </view>
      </view>

      <!-- 图片 -->
      <view v-if="curtain.image1 || curtain.image2" class="info-card">
        <view class="card-title">
          图片
        </view>
        <view class="image-row">
          <image v-if="curtain.image1" :src="curtain.image1" class="curtain-image" mode="aspectFill" @click="uni.previewImage({ urls: [curtain.image1!] })" />
          <image v-if="curtain.image2" :src="curtain.image2" class="curtain-image" mode="aspectFill" @click="uni.previewImage({ urls: [curtain.image2!] })" />
        </view>
      </view>

      <!-- 结构明细 -->
      <view class="info-card structure-card">
        <view class="card-title">
          结构明细
        </view>
        <view v-if="!curtain.structures?.length" class="py-40rpx text-center text-28rpx text-[#999]">
          暂无结构
        </view>
        <template v-else>
          <!-- Tab 标签栏 -->
          <scroll-view scroll-x class="tab-scroll">
            <view class="tab-bar">
              <view
                v-for="(structure, idx) in curtain.structures"
                :key="structure.id"
                class="tab-item"
                :class="{ active: activeStructureIdx === idx }"
                @click="activeStructureIdx = idx"
              >
                {{ structure.structureName || `结构${idx + 1}` }}
              </view>
            </view>
          </scroll-view>

          <!-- Tab 内容 -->
          <template v-for="(structure, idx) in curtain.structures" :key="structure.id">
            <view v-if="activeStructureIdx === idx" class="structure-content">
              <!-- 尺寸 + 参数 -->
              <view class="structure-params">
                <view v-if="structure.width || structure.height" class="param-item">
                  <view class="info-label">
                    尺寸
                  </view>
                  <view class="info-value">
                    {{ structure.width }} × {{ structure.height }}
                  </view>
                </view>
                <template v-for="attr in dictStore.getDictOptions('zc_structure_attributes')" :key="attr.value">
                  <view v-if="getStructureAttrValue(structure, attr.value) !== null" class="param-item">
                    <view class="info-label">
                      {{ attr.label }}
                    </view>
                    <view class="info-value">
                      {{ getStructureAttrValue(structure, attr.value) }}
                    </view>
                  </view>
                </template>
              </view>

              <!-- 用料明细 -->
              <view v-if="structure.materials?.length" class="material-list">
                <view
                  v-for="mat in structure.materials"
                  :key="mat.id"
                  class="material-item"
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
                    <view
                      class="material-item-value"
                      :class="getMatStatusColorType(mat.status) ? `material-status-${getMatStatusColorType(mat.status)}` : ''"
                    >
                      {{ getMatStatusLabel(mat.status) }}
                    </view>
                  </view>
                  <view v-if="mat.batchNo" class="material-item-row">
                    <view class="material-item-label">
                      批次
                    </view>
                    <view class="material-item-value">
                      {{ mat.batchNo }}
                    </view>
                  </view>
                  <view v-if="mat.note" class="material-item-row full-width">
                    <view class="material-item-label">
                      备注
                    </view>
                    <view class="material-item-value">
                      {{ mat.note }}
                    </view>
                  </view>
                </view>
              </view>
              <view v-else class="py-16rpx text-28rpx text-[#bbb]">
                暂无用料
              </view>
            </view>
          </template>
        </template>
      </view>
    </template>

    <view v-else class="py-120rpx text-center">
      <wd-status-tip image="content" tip="暂无数据" />
    </view>
  </view>
</template>

<style lang="scss" scoped>
.info-card {
  background-color: #fff;
  margin: 0 24rpx 16rpx;
  border-radius: 12rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.06);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.card-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 20rpx;
  padding-bottom: 16rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.status-badge {
  padding: 4rpx 16rpx;
  border-radius: 4rpx;
  font-size: 24rpx;
  font-weight: 500;
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

  &.one-third {
    width: 33.333%;
  }

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

.image-row {
  display: flex;
  gap: 16rpx;
  flex-wrap: wrap;
}

.curtain-image {
  width: 200rpx;
  height: 200rpx;
  border-radius: 8rpx;
  border: 1rpx solid #f0f0f0;
}

.structure-card {
  padding-bottom: 0;
}

.tab-scroll {
  white-space: nowrap;
  margin: 0 -24rpx;
}

.tab-bar {
  display: inline-flex;
  border-bottom: 2rpx solid #f0f0f0;
  width: 100%;
  padding: 0 24rpx;
  box-sizing: border-box;
}

.tab-item {
  flex-shrink: 0;
  padding: 16rpx 24rpx;
  font-size: 28rpx;
  color: #666;
  position: relative;

  &.active {
    color: #1890ff;
    font-weight: 600;

    &::after {
      content: '';
      position: absolute;
      bottom: -2rpx;
      left: 50%;
      transform: translateX(-50%);
      width: 60%;
      height: 4rpx;
      background-color: #1890ff;
      border-radius: 2rpx;
    }
  }
}

.structure-content {
  padding: 20rpx 0 24rpx;
}

.structure-params {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx 0;
  margin-bottom: 12rpx;
  padding-bottom: 12rpx;
  border-bottom: 1rpx solid #efefef;
}

.param-item {
  width: 25%;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.material-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.material-item {
  background-color: #f0f4fa;
  border-radius: 8rpx;
  padding: 16rpx 20rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx 0;
}

.material-item-row {
  width: 33.333%;
  display: flex;
  flex-direction: column;
  gap: 4rpx;

  &.full-width {
    width: 100%;
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
</style>
