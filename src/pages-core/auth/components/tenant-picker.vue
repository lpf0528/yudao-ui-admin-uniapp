<template>
  <view v-if="tenantEnabled" class="input-item">
    <wd-icon name="home" size="20px" color="#1890ff" />
    <wd-input
      v-model="tenantName"
      placeholder="请输入租户名称"
      clearable
      clear-trigger="focus"
      no-border
    />
  </view>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import { useToast } from 'wot-design-uni'
import { getTenantIdByName } from '@/api/login'
import { useUserStore } from '@/store/user'

const toast = useToast()
const userStore = useUserStore()

const tenantEnabled = import.meta.env.VITE_APP_TENANT_ENABLE === 'true'
const tenantName = ref('')

/** 校验并通过接口获取租户 ID，成功则写入 store */
async function validate(): Promise<boolean> {
  if (!tenantEnabled) {
    return true
  }
  if (!tenantName.value.trim()) {
    toast.warning('请输入租户名称')
    return false
  }
  try {
    const tenantId = await getTenantIdByName(tenantName.value.trim())
    if (!tenantId) {
      toast.warning('租户不存在，请确认名称')
      return false
    }
    userStore.setTenantId(tenantId)
    return true
  } catch {
    return false
  }
}

defineExpose({ validate })
</script>

<style lang="scss" scoped>
@import '../styles/auth.scss';
</style>
