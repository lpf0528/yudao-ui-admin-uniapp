import type { SalesOrderDetail } from '@/api/curtain/order'

export const ORDER_FABRIC_SHIP_QR = 'ORDER_FABRIC_SHIP_QR'
export const ORDER_CURTAIN_SHIP_QR = 'ORDER_CURTAIN_SHIP_QR'

export const SHIP_QR_CODE_TYPES = [ORDER_FABRIC_SHIP_QR, ORDER_CURTAIN_SHIP_QR] as const

export interface MaterialTableRow {
  rowKey: string
  curtainId: number
  structureId?: number
  productDisplay: string
  usage: string
  shipped: boolean
  checked: boolean
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
