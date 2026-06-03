import { httpGet } from '@/http/http'

export interface ZcWarehouseSimple {
  id: number
  name: string
  defaultStatus: boolean
}

export function getWarehouseSimpleList() {
  return httpGet<ZcWarehouseSimple[]>('/zc/warehouse/simple-list', {})
}
