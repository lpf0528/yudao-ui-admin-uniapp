<template>
  <view class="page min-h-screen flex flex-col bg-#f7f8fa">
    <wd-navbar title="扫码发货" left-arrow safe-area-inset-top placeholder @click-left="handleBack" />

    <view class="flex flex-1 flex-col items-center justify-center">
      <view
        class="scan-btn h-160rpx w-160rpx flex items-center justify-center rounded-full bg-#1890ff shadow-lg"
        :class="{ 'opacity-60': isLoading }"
        @click="handleScanCode"
      >
        <view v-if="!isLoading" class="i-carbon-scan text-72rpx text-white" />
        <view v-else class="i-carbon-loading animate-spin text-72rpx text-white" />
      </view>
      <view class="mt-48rpx text-center text-26rpx text-#8c8c8c">
        {{ isLoading ? '正在识别并查询订单，请稍候...' : '点击扫码按钮，扫描订单码完成发货' }}
      </view>
    </view>

    <wd-message-box />
  </view>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useMessage } from 'wot-design-uni/components/wd-message-box/index'
import { getBarcodeRegistry } from '@/api/curtain/barcode-registry/index'
import { getSalesOrderDetail } from '@/api/curtain/order/index'

const message = useMessage()
const isLoading = ref(false)

onMounted(() => {
  uni.showModal({
    title: '提示',
    content: '请点击扫码按钮进行扫码发货',
    showCancel: false,
  })
})

function handleBack() {
  if (getCurrentPages().length > 1) {
    uni.navigateBack()
    return
  }
  uni.reLaunch({ url: '/pages/index/index' })
}

async function handleCodeId(codeId: string) {
  const id = codeId.trim()
  if (!id) {
    uni.showToast({ title: '扫码内容为空', icon: 'none' })
    return
  }

  isLoading.value = true
  uni.showLoading({
    title: '加载中',
    mask: true,
  })

  let data: Awaited<ReturnType<typeof getBarcodeRegistry>>
  try {
    data = await getBarcodeRegistry(id)
  } catch {
    uni.showToast({ title: '获取条码注册信息失败', icon: 'none' })
    uni.hideLoading()
    isLoading.value = false
    return
  }

  let content: Record<string, any>
  try {
    content = JSON.parse(data.codeContent ?? '{}') as Record<string, any>
  } catch {
    uni.showToast({ title: '条码注册信息格式错误', icon: 'none' })
    uni.hideLoading()
    isLoading.value = false
    return
  }

  const orderId = Number(content.orderId)
  if (!Number.isFinite(orderId) || orderId <= 0) {
    uni.showToast({ title: '条码未包含有效订单ID(orderId)', icon: 'none' })
    uni.hideLoading()
    isLoading.value = false
    return
  }

  try {
    await getSalesOrderDetail({ id: orderId })
  } catch {
    uni.showToast({ title: '获取订单信息失败', icon: 'none' })
    uni.hideLoading()
    isLoading.value = false
    return
  }

  uni.hideLoading()
  isLoading.value = false
  uni.showToast({ title: '订单获取成功', icon: 'success' })
}

async function handleH5MockScan() {
  let result: { value?: string }
  try {
    result = await message.prompt({
      title: '模拟扫码',
      msg: '请输入扫码内容',
      inputPlaceholder: '请输入码内容',
    })
  } catch {
    return
  }

  const value = result.value?.trim() ?? ''
  await handleCodeId(value)
}

function handleScanCode() {
  if (isLoading.value)
    return

  // #ifndef H5
  uni.scanCode({
    onlyFromCamera: false,
    success: async (res) => {
      const value = (res.result || '').trim()
      await handleCodeId(value)
    },
    fail: (err) => {
      if (err.errMsg?.includes('cancel'))
        return
      uni.showToast({ title: '扫码失败，请重试', icon: 'none' })
    },
  })
  // #endif

  // #ifdef H5
  handleH5MockScan()
  // #endif
}

definePage({
  style: {
    navigationStyle: 'custom',
  },
})
</script>

<style lang="scss" scoped>
.page {
  min-height: 100vh;
}

.scan-btn {
  box-shadow: 0 8rpx 32rpx rgba(24, 144, 255, 0.35);
}
</style>
