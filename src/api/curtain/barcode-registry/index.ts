import { httpGet } from '@/http/http'

export interface BarcodeRegistryVO {
  id: number
  codeId: string
  codeType: string
  targetRoute: string
  codeContent: string
  createTime: string
}

export function getBarcodeRegistry(codeId: string) {
  return httpGet<BarcodeRegistryVO>('/zc/barcode-registry/get', { codeId })
}
