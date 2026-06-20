import type { SalesOrderDetail } from '@/api/curtain/order'

export const ORDER_FABRIC_SHIP_QR = 'ORDER_FABRIC_SHIP_QR'
export const ORDER_CURTAIN_SHIP_QR = 'ORDER_CURTAIN_SHIP_QR'

export const SHIP_QR_CODE_TYPES = [ORDER_FABRIC_SHIP_QR, ORDER_CURTAIN_SHIP_QR] as const

export type ShipDisplayMode = 'fabric' | 'curtain'

export interface ShipTableRow {
  rowKey: string
  curtainId: number
  structureId?: number
  shipped: boolean
  checked: boolean
  /** 面料单：产品（规格） */
  productDisplay?: string
  /** 面料单：用料 */
  usage?: string
  /** 成品窗帘：结构名称 */
  structureName?: string
  /** 成品窗帘：尺寸 */
  sizeDisplay?: string
}

export interface BuildShipRowsResult {
  mode: ShipDisplayMode
  rows: ShipTableRow[]
}

export interface OrderSummary {
  orderNo: string
  customerName: string
  receiver: string
  deliveryAddress: string
  mobile: string
  statusCode: string
}

export interface ScanShipPopupPayload {
  codeType: string
  content: Record<string, any>
  order: SalesOrderDetail
}
