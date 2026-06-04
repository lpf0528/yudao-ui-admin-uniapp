import { httpPost } from '@/http/http'

export interface ZcInventoryRecordSaveReq {
  productId: number
  batchId: number
  oldQuantity: number
  newQuantity: number
  note?: string
}

export function createInventoryRecord(data: ZcInventoryRecordSaveReq) {
  return httpPost<number>('/zc/inventory-record/create', data)
}
