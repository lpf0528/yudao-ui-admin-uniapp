import { httpGet } from '@/http/http'

/** 客户精简信息 */
export interface CustomerSimple {
  id: number
  shortName: string
  name: string
  contactName: string
  address: string
  deliveryAddress: string
  mobile: string
  mobile2: string
  logisticId: number
  brandId: number
  balance: number
}

/** 获取客户精简列表 */
export function getCustomerSimpleList(shortName?: string) {
  return httpGet<CustomerSimple[]>('/zc/customer/simple-list', shortName ? { shortName } : undefined)
}
