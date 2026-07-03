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

    /** 主操作员 id → 上次选择的工序节点 id */
    const processNodeByOperator = ref<Record<number, number>>({})

    const setProcessNode = (operatorId: number, nodeId: number | null) => {
      if (nodeId === null) {
        const next = { ...processNodeByOperator.value }
        delete next[operatorId]
        processNodeByOperator.value = next
      } else {
        processNodeByOperator.value = { ...processNodeByOperator.value, [operatorId]: nodeId }
      }
    }

    const getProcessNode = (operatorId: number) => processNodeByOperator.value[operatorId]

    const clear = () => {
      primaryOperator.value = null
      secondaryOperator.value = null
      processNodeByOperator.value = {}
    }

    return {
      primaryOperator,
      secondaryOperator,
      processNodeByOperator,
      setPrimary,
      setSecondary,
      setProcessNode,
      getProcessNode,
      clear,
    }
  },
  {
    persist: true,
  },
)
