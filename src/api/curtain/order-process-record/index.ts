import type { CustomRequestOptions } from '@/http/types'
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

export function createOrderProcessRecord(data: OrderProcessRecordCreateReq, options?: Partial<CustomRequestOptions>) {
  return http.post<number>('/zc/order-process-record/create', data, undefined, undefined, options)
}

export interface OrderProcessRecord {
  id: number
  orderId: number
  orderNo: string
  room?: string
  curtainName: string
  curtainId: number
  structureId: number
  structureName?: string
  materialId: number
  elementName?: string
  nodeId: number
  nodeName: string
  nodeGroup: number
  status: number
  masterId: number
  masterName: string
  assistantId: number
  assistantName: string
  note: string
  imageUrls: string[]
  createTime: string | number
  updateTime: string | number
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

export interface OrderProcessRecordMasterMaterialStat {
  elementId: number
  elementName: string
  processCount: number
  totalQuantity: number
}

export interface OrderProcessRecordMasterMaterialStatParam {
  masterId: number
  nodeId: number
  beginCreateTime?: string
  endCreateTime?: string
}

export function getOrderProcessRecordMasterMaterialStat(params: OrderProcessRecordMasterMaterialStatParam, options?: Partial<CustomRequestOptions>) {
  return http.get<OrderProcessRecordMasterMaterialStat[]>('/zc/order-process-record/master-material-stat', params, undefined, options)
}
