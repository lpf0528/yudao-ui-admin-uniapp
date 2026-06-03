import type { PageResult } from '@/http/types'
import { httpGet, httpPost } from '@/http/http'

export interface ZcProduct {
  id: number
  name: string
  versionId: number
  versionName: string
  specId: number
  specValue: string
  supplierId: number
  supplierName: string
  unitValue: string
  inboundPrice: number
  onePrice: number
  note: string
  creatorName: string
  createTime: string
}

export interface ZcProductPageParam {
  pageNo: number
  pageSize: number
  name?: string
  versionId?: number
  specId?: number
  supplierId?: number
  createTime?: string
}

export function getProductPage(params: ZcProductPageParam) {
  return httpGet<PageResult<ZcProduct>>('/zc/product/page', params as Record<string, any>)
}

export interface ZcProductBatchSaveReq {
  id?: number
  productId: number
  inboundDate: string
  inboundPrice?: number
  inboundQuantity: number
  quantity: number
  warehouseId?: number
  supplierId?: number
  note?: string
}

export function createProductBatchList(data: ZcProductBatchSaveReq[]) {
  return httpPost<number[]>('/zc/product-batch/create-batch', data)
}
