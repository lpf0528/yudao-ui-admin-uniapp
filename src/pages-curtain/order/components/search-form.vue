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
          v-model="formData.order_no"
          placeholder="请输入订单号"
          clearable
        />
      </view>
      <view class="yd-search-form-item">
        <view class="yd-search-form-label">
          客户名称
        </view>
        <wd-input
          v-model="formData.customer_name"
          placeholder="请输入客户名称"
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
  order_no: undefined as string | undefined,
  customer_name: undefined as string | undefined,
})

const placeholder = computed(() => {
  const conditions: string[] = []
  if (formData.order_no) {
    conditions.push(`订单号:${formData.order_no}`)
  }
  if (formData.customer_name) {
    conditions.push(`客户:${formData.customer_name}`)
  }
  return conditions.length > 0 ? conditions.join(' | ') : '搜索订单'
})

/** 搜索 */
function handleSearch() {
  visible.value = false
  emit('search', { ...formData })
}

/** 重置 */
function handleReset() {
  formData.order_no = undefined
  formData.customer_name = undefined
  visible.value = false
  emit('reset')
}
</script>
