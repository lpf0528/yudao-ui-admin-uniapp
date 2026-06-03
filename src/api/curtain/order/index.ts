import type { PageResult } from '@/http/types'
import { httpGet } from '@/http/http'

/** 销售订单 */
export interface SalesOrder {
  id: number
  orderNo: string
  customerId: number
  mobile: string
  brandId: number
  orderDate: string
  logisticId: number
  receiver: string
  deliveryAddress: string
  freight: number
  types: string
  discountAmount: number
  totalAmount: number
  amount: number
  amountReceived: number
  deliveryDate: string
  payStatus: string
  status: string
  confirmTime: string
  isExpedited: boolean
  note: string
  customerName: string
  logisticName: string
  creatorName: string
  createTime: string
}

/** 销售订单分页参数 */
export interface SalesOrderPageParam {
  pageNo: number
  pageSize: number
  orderNo?: string
  types?: string
  orderDate?: string[]
}

/** 获取销售订单分页 */
export function getSalesOrderPage(params: SalesOrderPageParam) {
  return httpGet<PageResult<SalesOrder>>('/zc/sales-order/page', params as Record<string, any>)
}

/** 获取销售订单详情 */
// TODO: export function getSalesOrder(id: number) { return httpGet<SalesOrder>(`/admin-api/zc/sales-order/get?id=${id}`) }

/** 创建销售订单 */
// TODO: export function createSalesOrder(data: Partial<SalesOrder>) { return httpPost<number>('/admin-api/zc/sales-order/create', data) }

/** 更新销售订单 */
// TODO: export function updateSalesOrder(data: Partial<SalesOrder>) { return httpPut<boolean>('/admin-api/zc/sales-order/update', data) }

/** 删除销售订单 */
// TODO: export function deleteSalesOrder(id: number) { return httpDelete<boolean>(`/admin-api/zc/sales-order/delete?id=${id}`) }
