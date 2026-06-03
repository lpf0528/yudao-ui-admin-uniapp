import { httpGet } from '@/http/http'

export interface ZcSupplierSimple {
  id: number
  shortName: string
}

export function getSupplierSimpleList() {
  return httpGet<ZcSupplierSimple[]>('/zc/supplier/simple-list', {})
}
