import { httpGet } from '@/http/http'

export interface ZcProductVersionSpecResp {
  id: number
  versionId: number
  spec: string
  inboundPrice: number
  onePrice: number
  note: string
  createTime: string
}

export interface ZcProductVersionSimple {
  id: number
  name: string
  unitValue: string
  categoryId: number
  supplierId: number
  specConfs: ZcProductVersionSpecResp[]
}

export function getProductVersionSimpleList() {
  return httpGet<ZcProductVersionSimple[]>('/zc/product-version/simple-list', {})
}
