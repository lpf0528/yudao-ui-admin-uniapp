<template>
  <view class="yd-page-container">
    <!-- 顶部导航栏 -->
    <wd-navbar
      title="工作台"
      placeholder safe-area-inset-top fixed
    />
    <!-- 用户信息头部 -->
    <UserHeader />
    <!-- Banner 轮播图 -->
    <!-- <HomeBanner /> -->
    <!-- 菜单区域 -->
    <MenuSection />
    <!-- 扫码按钮（可拖动） -->
    <view
      class="fixed z-10 h-100rpx w-100rpx flex items-center justify-center rounded-full bg-[#1890ff] shadow-lg"
      :style="btnStyle"
      @touchstart.stop="onTouchStart"
      @touchmove.stop.prevent="onTouchMove"
      @touchend.stop="onTouchEnd"
    >
      <view class="i-carbon-scan text-48rpx text-white" />
    </view>
  </view>
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, ref } from 'vue'
import MenuSection from './components/menu-section.vue'
import UserHeader from './components/user-header.vue'

defineOptions({
  name: 'Home',
})

const pos = reactive({ x: 0, y: 0 })
const isDragging = ref(false)
let startTouch = { x: 0, y: 0 }
let startPos = { x: 0, y: 0 }
let btnSize = 0

onMounted(() => {
  const info = uni.getSystemInfoSync()
  const ratio = info.windowWidth / 750
  btnSize = Math.round(100 * ratio)
  // 初始位置：右下角（right: 32rpx, bottom: 200rpx）
  pos.x = info.windowWidth - btnSize - Math.round(32 * ratio)
  pos.y = info.windowHeight - Math.round(200 * ratio) - btnSize
})

const btnStyle = computed(() => ({
  left: `${pos.x}px`,
  top: `${pos.y}px`,
}))

function onTouchStart(e: TouchEvent) {
  isDragging.value = false
  startTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  startPos = { x: pos.x, y: pos.y }
}

function onTouchMove(e: TouchEvent) {
  isDragging.value = true
  const info = uni.getSystemInfoSync()
  const dx = e.touches[0].clientX - startTouch.x
  const dy = e.touches[0].clientY - startTouch.y
  pos.x = Math.max(0, Math.min(info.windowWidth - btnSize, startPos.x + dx))
  pos.y = Math.max(0, Math.min(info.windowHeight - btnSize, startPos.y + dy))
}

function onTouchEnd() {
  if (!isDragging.value) {
    handleScanCode()
  }
  isDragging.value = false
}

function handleScanCode() {
  // #ifndef H5
  uni.scanCode({
    onlyFromCamera: false,
    success(res) {
      uni.showToast({
        title: res.result,
        icon: 'none',
        duration: 3000,
      })
    },
    fail(err) {
      if (err.errMsg?.includes('cancel'))
        return
      uni.showToast({ title: '扫码失败，请重试', icon: 'none' })
    },
  })
  // #endif

  // #ifdef H5
  uni.showToast({ title: '请在APP或小程序中使用扫码功能', icon: 'none' })
  // #endif
}

definePage({
  type: 'home',
  style: {
    navigationStyle: 'custom',
  },
})
</script>
