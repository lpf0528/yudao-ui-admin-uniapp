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
  sets: number
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
  return httpGet<PageResult<SalesOrder>>('/zc/sales-order/app/page', params as Record<string, any>)
}

/** 用料明细 */
export interface SalesOrderMaterialDetail {
  id: number
  orderId: number
  orderStructureId: number
  elementId: number
  productId: number
  batchId: number
  price: number
  quantity: number
  unitValue: string
  discountRate: number
  amount: number
  note: string
  createTime: string
  elementName: string
  productName: string
  batchNo: string
}

/** 结构行详情 */
export interface SalesOrderStructureDetail {
  id: number
  orderId: number
  orderCurtainId: number
  structureId: number
  height: number
  width: number
  leftCorner: string
  rightCorner: string
  pasteDirection: string
  installProcessId: number
  openMethod: string
  processType: string
  isShaping: boolean
  pleatsNum: number
  pleatsDistance: number
  skirtHeight: number
  note: string
  createTime: string
  structureName: string
  installProcessName: string
  materials: SalesOrderMaterialDetail[]
}

/** 窗帘行详情 */
export interface SalesOrderCurtainDetail {
  id: number
  orderId: number
  curtainId: number
  room: string
  pleatRatioValue: number
  discountRate: number
  amount: number
  image1: string
  image2: string
  mountings: string
  note: string
  pleatsDistance: number
  createTime: string
  curtainName: string
  structures: SalesOrderStructureDetail[]
}

/** 销售订单完整详情 */
export interface SalesOrderDetail extends SalesOrder {
  curtains: SalesOrderCurtainDetail[]
}

/** 获取销售订单完整详情 */
export function getSalesOrderDetail(id: number) {
  return httpGet<SalesOrderDetail>('/zc/sales-order/detail', { id })
}

/** 创建销售订单 */
// TODO: export function createSalesOrder(data: Partial<SalesOrder>) { return httpPost<number>('/admin-api/zc/sales-order/create', data) }

/** 更新销售订单 */
// TODO: export function updateSalesOrder(data: Partial<SalesOrder>) { return httpPut<boolean>('/admin-api/zc/sales-order/update', data) }

/** 删除销售订单 */
// TODO: export function deleteSalesOrder(id: number) { return httpDelete<boolean>(`/admin-api/zc/sales-order/delete?id=${id}`) }
