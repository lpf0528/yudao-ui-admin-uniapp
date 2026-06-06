import type { PageResult } from '@/http/types'
import { httpGet } from '@/http/http'

export interface OrderOperationLog {
  id: number
  orderId: number
  orderNo: string
  operateType: string
  operateTypeLabel: string
  targetType: string
  targetTypeLabel: string
  targetId: number
  beforeStatus: string
  afterStatus: string
  orderAfterStatus: string
  extJson: string
  note: string
  revoked: boolean
  creator: string
  createTime: string
}

export interface OrderOperationLogPageParam {
  orderId: string
  pageNo: string
  pageSize: string
  targetType?: string
  targetId?: string
  operateType?: string
  revoked?: string
}

export function getOrderOperationLogPage(params: OrderOperationLogPageParam) {
  return httpGet<PageResult<OrderOperationLog>>('/zc/order-operation-log/page', params as Record<string, any>)
}
