<template>
  <view class="auth-container">
    <!-- 顶部 -->
    <Header />

    <!-- 表单区域 -->
    <view class="form-container">
      <TenantPicker ref="tenantPickerRef" />
      <view class="input-item">
        <wd-icon name="user" size="20px" color="#1890ff" />
        <wd-input
          v-model="formData.username"
          placeholder="请输入用户名"
          clearable
          clear-trigger="focus"
          no-border
        />
      </view>
      <view class="input-item">
        <wd-icon name="lock-on" size="20px" color="#1890ff" />
        <wd-input
          v-model="formData.password"
          placeholder="请输入密码"
          clearable
          clear-trigger="focus"
          show-password
          no-border
        />
      </view>
      <!-- 记住我 -->
      <view class="remember-row">
        <wd-checkbox v-model="rememberMe" shape="square">
          记住我
        </wd-checkbox>
      </view>

      <view v-if="captchaEnabled">
        <Verify
          ref="verifyRef"
          :captcha-type="captchaType"
          explain="向右滑动完成验证"
          :img-size="{ width: '300px', height: '150px' }"
          mode="pop"
          @success="verifySuccess"
        />
      </view>

      <!-- 登录按钮 -->
      <wd-button block :loading="loading" type="primary" @click="handleLogin">
        登录
      </wd-button>

      <!-- 第三方登录 -->

      <!-- 创建账号 -->
    </view>
  </view>
</template>

<script lang="ts" setup>
import { nextTick, reactive, ref } from 'vue'
import { useToast } from 'wot-design-uni'
import {
  CODE_LOGIN_PAGE,
  FORGET_PASSWORD_PAGE,
  REGISTER_PAGE,
} from '@/router/config'
import { useTokenStore } from '@/store/token'
import { ensureDecodeURIComponent, redirectAfterLogin } from '@/utils'
import Header from './components/header.vue'
import TenantPicker from './components/tenant-picker.vue'
import Verify from './components/verifition/verify.vue'

defineOptions({
  name: 'LoginPage',
  style: {
    navigationStyle: 'custom',
  },
})

definePage({
  style: {
    navigationStyle: 'custom',
  },
})

const REMEMBER_KEY = 'loginRemember'

const toast = useToast()
const loading = ref(false)
const redirectUrl = ref<string>()
const tenantPickerRef = ref<InstanceType<typeof TenantPicker>>()
const captchaEnabled = import.meta.env.VITE_APP_CAPTCHA_ENABLE === 'true'
const verifyRef = ref()
const captchaType = ref('blockPuzzle')
const rememberMe = ref(false)

const formData = reactive({
  username: import.meta.env.VITE_APP_DEFAULT_LOGIN_USERNAME || '',
  password: import.meta.env.VITE_APP_DEFAULT_LOGIN_PASSWORD || '',
  captchaVerification: '',
})

/** 页面加载时处理重定向，并回填记住的账号密码 */
onLoad((options) => {
  if (options?.redirect) {
    redirectUrl.value = ensureDecodeURIComponent(options.redirect)
  }
  const saved = uni.getStorageSync(REMEMBER_KEY)
  if (saved) {
    formData.username = saved.username
    formData.password = saved.password
    rememberMe.value = true
    nextTick(() => {
      if (tenantPickerRef.value && saved.tenantName) {
        tenantPickerRef.value.tenantName = saved.tenantName
      }
    })
  }
})

/** 获取验证码 */
async function getCode() {
  // 情况一，未开启：则直接登录
  if (!captchaEnabled) {
    await verifySuccess({})
  } else {
    // 情况二，已开启：则展示验证码；只有完成验证码的情况，才进行登录
    // 弹出验证码
    verifyRef.value.show()
  }
}

/** 登录处理 */
async function handleLogin() {
  if (!(await tenantPickerRef.value?.validate())) {
    return
  }
  if (!formData.username) {
    toast.warning('请输入用户名')
    return
  }
  if (!formData.password) {
    toast.warning('请输入密码')
    return
  }
  await getCode()
}

async function verifySuccess(params: any) {
  loading.value = true
  try {
    // 调用登录接口
    const tokenStore = useTokenStore()
    formData.captchaVerification = params.captchaVerification
    await tokenStore.login({
      type: 'username',
      ...formData,
    })
    // 保存或清除记住我的凭据
    if (rememberMe.value) {
      uni.setStorageSync(REMEMBER_KEY, {
        username: formData.username,
        password: formData.password,
        tenantName: tenantPickerRef.value?.tenantName || '',
      })
    } else {
      uni.removeStorageSync(REMEMBER_KEY)
    }
    // 处理跳转
    redirectAfterLogin(redirectUrl.value)
  } finally {
    loading.value = false
  }
}

/** 跳转到注册页面 */
function goToRegister() {
  uni.navigateTo({ url: REGISTER_PAGE })
}

/** 跳转到验证码登录 */
function goToSmsLogin() {
  uni.navigateTo({ url: CODE_LOGIN_PAGE })
}

/** 跳转到忘记密码 */
function goToForgetPassword() {
  uni.navigateTo({ url: FORGET_PASSWORD_PAGE })
}

/** 微信登录 */
// TODO @芋艿：后续开发
function handleWechatLogin() {
  toast.info('微信登录功能开发中')
}

/** 钉钉登录 */
// TODO @芋艿：后续开发
function handleDingTalkLogin() {
  toast.info('钉钉登录功能开发中')
}
</script>

<style lang="scss" scoped>
@import './styles/auth.scss';

.remember-row {
  display: flex;
  align-items: center;
  padding: 8rpx 0 16rpx;
}

// 第三方登录图标
.icon-item {
  width: 40rpx;
  height: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #f5f7fa;
}
</style>
