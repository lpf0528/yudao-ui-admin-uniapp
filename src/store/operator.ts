import type { WorkshopUserSimple } from '@/api/curtain/workshop-user/index'
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useOperatorStore = defineStore(
  'operator',
  () => {
    const primaryOperator = ref<WorkshopUserSimple | null>(null)
    const secondaryOperator = ref<WorkshopUserSimple | null>(null)

    const setPrimary = (user: WorkshopUserSimple | null) => {
      primaryOperator.value = user
    }

    const setSecondary = (user: WorkshopUserSimple | null) => {
      secondaryOperator.value = user
    }

    const clear = () => {
      primaryOperator.value = null
      secondaryOperator.value = null
    }

    return { primaryOperator, secondaryOperator, setPrimary, setSecondary, clear }
  },
  {
    persist: true,
  },
)
