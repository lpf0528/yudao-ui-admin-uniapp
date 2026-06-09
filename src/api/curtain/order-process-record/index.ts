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

export interface OrderProcessRecord {
  id: number
  orderId: number
  orderNo: string
  curtainName: string
  curtainId: number
  structureId: number
  materialId: number
  nodeId: number
  nodeName: string
  status: number
  masterId: number
  masterName: string
  assistantId: number
  assistantName: string
  note: string
  imageUrls: string[]
  createTime: string
  updateTime: string
}

export interface OrderProcessRecordListParam {
  orderId?: number
  masterId?: number
  curtainId?: number
  structureId?: number
  materialId?: number
  nodeId?: number
}

export function getOrderProcessRecordList(params: OrderProcessRecordListParam) {
  return http.get<OrderProcessRecord[]>('/zc/order-process-record/list', params)
}

export function revokeOrderProcessRecord(data: { id: number, note?: string }) {
  return http.put<boolean>('/zc/order-process-record/revoke', data)
}
