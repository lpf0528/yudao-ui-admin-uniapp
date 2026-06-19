import type { PageResult } from '@/http/types'
import { httpGet, httpPost } from '@/http/http'

/** 产品批次状态：1 整匹、0 零裁、-1 余料 */
export const PRODUCT_BATCH_STATUS = {
  WHOLE: 1,
  PARTIAL: 0,
  REMAINDER: -1,
} as const

export type ProductBatchStatusType = typeof PRODUCT_BATCH_STATUS[keyof typeof PRODUCT_BATCH_STATUS]

const PRODUCT_BATCH_STATUS_LABEL: Record<ProductBatchStatusType, string> = {
  [PRODUCT_BATCH_STATUS.WHOLE]: '整匹',
  [PRODUCT_BATCH_STATUS.PARTIAL]: '零裁',
  [PRODUCT_BATCH_STATUS.REMAINDER]: '余料',
}

export function getProductBatchStatusLabel(status?: ProductBatchStatusType | null): string {
  if (status == null)
    return '-'
  return PRODUCT_BATCH_STATUS_LABEL[status] ?? String(status)
}

export function getProductBatchStatusColorType(status?: ProductBatchStatusType | null): string {
  if (status === PRODUCT_BATCH_STATUS.WHOLE)
    return 'success'
  if (status === PRODUCT_BATCH_STATUS.PARTIAL)
    return 'warning'
  if (status === PRODUCT_BATCH_STATUS.REMAINDER)
    return 'info'
  return 'default'
}

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
  spec?: string
  status?: ProductBatchStatusType
}

export function createProductBatchList(data: ZcProductBatchSaveReq[]) {
  return httpPost<number[]>('/zc/product-batch/create-batch', data)
}

export interface ZcProductBatch {
  id: number
  batchNo: string
  status?: ProductBatchStatusType
  inboundDate: string
  productId: number
  inboundPrice: number
  inboundQuantity: number
  quantity: number
  warehouseId: number
  supplierId: number
  note: string
  productName: string
  productPrice: number
  spec: string
  versionName: string
  supplierName: string
  warehouseName: string
  unitValue: string
  createTime: string
}

export interface ZcProductBatchPageParam {
  pageNo: number
  pageSize: number
  productId?: number
  warehouseId?: number
  supplierId?: number
  batchNo?: string
  inboundDate?: string
}

export function getProductBatchPage(params: ZcProductBatchPageParam) {
  return httpGet<PageResult<ZcProductBatch>>('/zc/product-batch/page', params as Record<string, any>)
}
