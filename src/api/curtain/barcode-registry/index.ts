import type { CustomRequestOptions } from '@/http/types'
import { httpGet, httpPost } from '@/http/http'

export interface BarcodeRegistryVO {
  id: number
  codeId: string
  codeType: string
  targetRoute: string
  codeContent: string
  createTime: string
}

export function getBarcodeRegistry(codeId: string, options?: Partial<CustomRequestOptions>) {
  return httpGet<BarcodeRegistryVO>('/zc/barcode-registry/get', { codeId }, undefined, options)
}

export interface BarcodeRegistryCreateReq {
  codeType: string
  targetRoute: string
  codeContent: Record<string, any>
}

export function createBarcodeRegistry(data: BarcodeRegistryCreateReq) {
  return httpPost<string>('/zc/barcode-registry/create', data)
}
