<template>
  <!-- 搜索框入口 -->
  <view @click="visible = true">
    <wd-search :placeholder="placeholder" hide-cancel disabled />
  </view>

  <!-- 搜索弹窗 -->
  <wd-popup v-model="visible" position="top" @close="visible = false">
    <view class="yd-search-form-container" :style="{ paddingTop: `${getNavbarHeight()}px` }">
      <view class="yd-search-form-item">
        <view class="yd-search-form-label">
          订单号
        </view>
        <wd-input
          v-model="formData.orderNo"
          placeholder="请输入订单号"
          clearable
        />
      </view>
      <view class="yd-search-form-item">
        <view class="yd-search-form-label">
          订单类型
        </view>
        <wd-input
          v-model="formData.types"
          placeholder="请输入订单类型"
          clearable
        />
      </view>
      <view class="yd-search-form-actions">
        <wd-button style="flex: 1;" plain @click="handleReset">
          重置
        </wd-button>
        <wd-button style="flex: 1; margin-left: 12rpx;" type="primary" @click="handleSearch">
          搜索
        </wd-button>
      </view>
    </view>
  </wd-popup>
</template>

<script lang="ts" setup>
import { computed, reactive, ref } from 'vue'
import { getNavbarHeight } from '@/utils'

const emit = defineEmits<{
  search: [data: Record<string, any>]
  reset: []
}>()

const visible = ref(false)
const formData = reactive({
  orderNo: undefined as string | undefined,
  types: undefined as string | undefined,
})

const placeholder = computed(() => {
  const conditions: string[] = []
  if (formData.orderNo)
    conditions.push(`订单号:${formData.orderNo}`)
  if (formData.types)
    conditions.push(`类型:${formData.types}`)
  return conditions.length > 0 ? conditions.join(' | ') : '搜索订单'
})

function handleSearch() {
  visible.value = false
  emit('search', { ...formData })
}

function handleReset() {
  formData.orderNo = undefined
  formData.types = undefined
  visible.value = false
  emit('reset')
}
</script>
