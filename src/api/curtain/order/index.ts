import type { PageResult } from '@/http/types'
import { httpGet, httpPut } from '@/http/http'

export const MAT_STATUS = {
  NOT_PEILIAO: 'NOT_PEILIAO',
  HAVE_PEILIAO: 'HAVE_PEILIAO',
} as const

export const ZcOrderType = {
  FABRIC: 'FABRIC',
  CURTAIN: 'CURTAIN',
} as const

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
  status: string
  elementName: string
  productName: string
  batchNo: string
  barcode: string
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
  packTime: string | null
  shipTime: string | null
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

/** 成品订单裁剪请求 */
export interface CutMaterialReq {
  id: number
  batchId: number
  cutQuantity: number
}

/** 成品订单裁剪（绑定批次、记录裁剪数量、扣减批次库存） */
export function cutMaterial(data: CutMaterialReq) {
  return httpPut<boolean>('/zc/sales-order/cut-material', data)
}

/** 撤销裁剪（回退批次库存、清空配料绑定、写入撤销裁剪记录） */
export function cancelCutMaterial(materialId: number) {
  return httpPut<boolean>('/zc/sales-order/cancel-cut-material', { materialId })
}

/** 打包窗帘行（将窗帘行状态更新为已打包，并联动更新订单状态） */
export function packSalesOrderCurtain(id: number) {
  return httpPut<boolean>('/zc/sales-order-curtain/pack', undefined, { id })
}

/** 发货窗帘行（将窗帘行状态更新为已发货，并联动更新订单状态） */
export function shipSalesOrderCurtain(id: number) {
  return httpPut<boolean>('/zc/sales-order-curtain/ship', undefined, { id })
}

/** 撤销打包 */
export function cancelPackSalesOrderCurtain(id: number) {
  return httpPut<boolean>('/zc/sales-order-curtain/cancel-pack', undefined, { id })
}

/** 撤销发货 */
export function cancelShipSalesOrderCurtain(id: number) {
  return httpPut<boolean>('/zc/sales-order-curtain/cancel-ship', undefined, { id })
}

/** 面料单产品行 */
export interface SalesOrderProductLine {
  id: number
  productId: number
  productName: string
  batchId: number
  batchNo: string
  quantity: number
  price: number
  amount: number
  note: string
  index: number
  status: string
}

/** 面料单详情 */
export interface SalesOrderProductDetail extends SalesOrder {
  batchs: SalesOrderProductLine[]
}

/** 获取面料单详情（含产品批次行列表） */
export function getSalesOrderProductDetail(id: number) {
  return httpGet<SalesOrderProductDetail>('/zc/sales-order-product/detail', { id })
}

/** 创建销售订单 */
// TODO: export function createSalesOrder(data: Partial<SalesOrder>) { return httpPost<number>('/admin-api/zc/sales-order/create', data) }

/** 更新销售订单 */
// TODO: export function updateSalesOrder(data: Partial<SalesOrder>) { return httpPut<boolean>('/admin-api/zc/sales-order/update', data) }

/** 删除销售订单 */
// TODO: export function deleteSalesOrder(id: number) { return httpDelete<boolean>(`/admin-api/zc/sales-order/delete?id=${id}`) }
