import type { PageParam, PageResult } from '@/http/types'
import { httpGet, httpPost } from '@/http/http'

export interface ZcInventoryRecordSaveReq {
  productId: number
  batchId: number
  oldQuantity: number
  newQuantity: number
  note?: string
}

export interface ZcInventoryRecordRespVO {
  id: number
  productId: number
  batchId: number
  oldQuantity: number
  newQuantity: number
  diffQuantity: number
  changeQuantity: number
  note: string
  productName: string
  batchNo: string
  warehouseName: string
  warehouseId: number
  specValue: string
  specId: number
  versionName: string
  versionId: number
  nickname: string
  creator: string
  createTime: string
  operate: 'PANDIAN' | 'RUKU' | 'CAIJIAN' | 'CANCEL_CAIJIAN' | string
  orderId: number
}

export interface InventoryRecordPageParams extends PageParam {
  productId?: number
  productName?: string
  versionId?: number
  batchId?: number
  batchNo?: string
  warehouseId?: number
  createTime?: string
}

export function createInventoryRecord(data: ZcInventoryRecordSaveReq) {
  return httpPost<number>('/zc/inventory-record/create', data)
}

export function getInventoryRecordPage(params: InventoryRecordPageParams) {
  return httpGet<PageResult<ZcInventoryRecordRespVO>>('/zc/inventory-record/page', params)
}
