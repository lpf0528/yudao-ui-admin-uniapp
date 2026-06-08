import { http } from '@/http/http'

export interface OrderProcessRecordCreateReq {
  orderId: number
  curtainId: number
  structureId: number
  materialId?: number
  nodeId: number
  masterId: number
  assistantId?: number
  note?: string
  imageUrls?: string[]
}

export function createOrderProcessRecord(data: OrderProcessRecordCreateReq) {
  return http.post<number>('/zc/order-process-record/create', data)
}
