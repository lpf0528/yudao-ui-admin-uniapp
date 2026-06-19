<script lang="ts" setup>
import type { WorkshopUserSimple } from '@/api/curtain/workshop-user/index'
import { storeToRefs } from 'pinia'
import { getWorkshopUserSimpleList } from '@/api/curtain/workshop-user/index'
import { useOperatorStore } from '@/store'

defineOptions({
  name: 'UserHeader',
})

const operatorStore = useOperatorStore()
const { primaryOperator, secondaryOperator } = storeToRefs(operatorStore)

const userList = ref<WorkshopUserSimple[]>([])
const refreshing = ref(false)

// 弹框状态：'primary' | 'secondary' | null
const pickerTarget = ref<'primary' | 'secondary' | null>(null)
const showPicker = ref(false)

function syncSelectedOperators(list: WorkshopUserSimple[]) {
  if (primaryOperator.value) {
    const found = list.find(u => u.id === primaryOperator.value!.id)
    operatorStore.setPrimary(found ?? null)
  }
  if (secondaryOperator.value) {
    const found = list.find(u => u.id === secondaryOperator.value!.id)
    operatorStore.setSecondary(found ?? null)
  }
}

async function loadUserList(showToast = false) {
  const list = await getWorkshopUserSimpleList()
  userList.value = list
  syncSelectedOperators(list)
  if (showToast)
    uni.showToast({ title: '已刷新', icon: 'success' })
}

async function handleRefresh() {
  if (refreshing.value)
    return
  refreshing.value = true
  try {
    await loadUserList(true)
  } catch {
    uni.showToast({ title: '刷新失败', icon: 'none' })
  } finally {
    refreshing.value = false
  }
}

async function initLoad() {
  try {
    await loadUserList()
  } catch {
    // http 层已 toast，此处避免 Uncaught (in promise)
  }
}

/**
 * 初始化操作员列表
 * 不使用 onMounted：登录后页面可能已挂载，需在 onShow 时重新拉取
 */
onShow(() => {
  initLoad()
})

function openPicker(target: 'primary' | 'secondary') {
  pickerTarget.value = target
  showPicker.value = true
}

function selectUser(user: WorkshopUserSimple) {
  if (pickerTarget.value === 'primary') {
    if (primaryOperator.value?.id === user.id) {
      operatorStore.setPrimary(null)
      showPicker.value = false
      return
    }
    if (secondaryOperator.value?.id === user.id) {
      uni.showToast({ title: '主副操作员不能是同一人', icon: 'none' })
      return
    }
    operatorStore.setPrimary(user)
  } else {
    if (secondaryOperator.value?.id === user.id) {
      operatorStore.setSecondary(null)
      showPicker.value = false
      return
    }
    if (primaryOperator.value?.id === user.id) {
      uni.showToast({ title: '主副操作员不能是同一人', icon: 'none' })
      return
    }
    operatorStore.setSecondary(user)
  }
  showPicker.value = false
}

// 当前弹框中已选中的用户 id（用于高亮）
const currentSelectedId = computed(() => {
  if (pickerTarget.value === 'primary')
    return primaryOperator.value?.id
  return secondaryOperator.value?.id
})

// 另一方已选中的 id（用于禁用）
const disabledId = computed(() => {
  if (pickerTarget.value === 'primary')
    return secondaryOperator.value?.id
  return primaryOperator.value?.id
})
</script>

<template>
  <view class="mx-20rpx mt-20rpx overflow-hidden rounded-16rpx bg-white">
    <view class="flex items-center p-24rpx">
      <view class="avatar-wrapper mr-20rpx h-100rpx w-100rpx flex items-center justify-center rounded-full bg-[#e8f4f0]">
        <view class="i-carbon-user-avatar-filled text-64rpx text-[#018d71]" />
      </view>
      <view class="flex-1">
        <view class="flex items-center text-32rpx text-#333 font-500">
          <text class="mr-8rpx text-28rpx text-#666">操作员(主)：</text>
          <text class="text-[#018d71] underline" @tap="openPicker('primary')">
            {{ primaryOperator ? primaryOperator.name : '请选择' }}
          </text>
        </view>
        <view class="mt-8rpx flex items-center text-26rpx text-#999">
          <text class="mr-8rpx">操作员(副)：</text>
          <text class="text-[#018d71] underline" @tap="openPicker('secondary')">
            {{ secondaryOperator ? secondaryOperator.name : '请选择' }}
          </text>
        </view>
      </view>
    </view>
  </view>

  <!-- 操作员选择弹框 -->
  <wd-popup v-model="showPicker" position="center">
    <view class="picker-wrap">
      <view class="picker-header">
        <text class="text-30rpx text-#333 font-500">
          选择{{ pickerTarget === 'primary' ? '主' : '副' }}操作员
        </text>
        <view class="picker-header-actions">
          <view
            class="refresh-btn i-carbon-renew text-36rpx text-[#018d71]"
            :class="{ 'refresh-btn--loading': refreshing }"
            @tap.stop="handleRefresh"
          />
          <view class="i-carbon-close text-36rpx text-#999" @tap="showPicker = false" />
        </view>
      </view>
      <scroll-view scroll-y style="max-height: 50vh">
        <view
          v-for="user in userList"
          :key="user.id"
          class="picker-item"
          :class="{
            'picker-item--selected': user.id === currentSelectedId,
            'picker-item--disabled': user.id === disabledId,
          }"
          @tap="user.id !== disabledId && selectUser(user)"
        >
          <text>{{ user.name }}</text>
          <view v-if="user.id === currentSelectedId" class="i-carbon-checkmark text-32rpx text-[#018d71]" />
          <text v-if="user.id === disabledId" class="text-24rpx text-#ccc">已选为{{ pickerTarget === 'primary' ? '副' : '主' }}操作员</text>
        </view>
      </scroll-view>
    </view>
  </wd-popup>
</template>

<style lang="scss" scoped>
.avatar-wrapper {
  border: 3rpx solid #f0f0f0;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.06);
}

.refresh-btn {
  padding: 4rpx;

  &--loading {
    opacity: 0.5;
    animation: refresh-spin 0.8s linear infinite;
  }
}

@keyframes refresh-spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.picker-wrap {
  width: 560rpx;
  padding: 32rpx 0 0;
  border-radius: 16rpx;
  overflow: hidden;
}

.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32rpx 24rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.picker-header-actions {
  display: flex;
  align-items: center;
  gap: 24rpx;
}

.picker-item:first-child {
  margin-top: 16rpx;
}

.picker-item:last-child {
  margin-bottom: 16rpx;
}

.picker-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx;
  font-size: 30rpx;
  color: #333;

  &--selected {
    color: #018d71;
    background-color: #f0faf7;
  }

  &--disabled {
    color: #ccc;
  }
}
</style>
