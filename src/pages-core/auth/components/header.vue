<template>
  <view class="header flex flex-col items-center">
    <image class="header-logo" src="/static/logo.svg" mode="aspectFit" />
    <view class="header-title">
      {{ title }}
    </view>
  </view>
</template>

<script lang="ts" setup>
const title = import.meta.env.VITE_APP_TITLE // 应用标题
</script>

<style lang="scss" scoped>
@import '../styles/auth.scss';

.header {
  padding-top: rpx(120);
  padding-bottom: rpx(60);
}

.header-logo {
  width: rpx(160);
  height: rpx(160);
  margin-bottom: rpx(24);
}

.header-title {
  font-size: fs(44);
  color: #1890ff;
  font-weight: bold;
}
</style>
