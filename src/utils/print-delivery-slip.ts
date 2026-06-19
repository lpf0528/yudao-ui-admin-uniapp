import type { SalesOrderDetail } from '@/api/curtain/order'
// #ifdef APP-PLUS
import type { TextStyle } from '@/uni_modules/sunmi-printersdk/utssdk/interface.uts'
import { LineApi, PrinterSdk } from '@/uni_modules/sunmi-printersdk'
// #endif

export function deliveryPrintTodayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// #ifdef APP-PLUS
let printerReady = false

function makeTextStyle(align: number, textSize: number): TextStyle {
  return {
    align,
    fontStyle: 1,
    textSize,
    textWidthRatio: 0,
    textHeightRatio: 0,
    posX: 0,
    posY: 0,
    width: 0,
    height: 0,
    rotate: 0,
    textSpace: 0,
  }
}

function initSunmiSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('初始化超时（5s）')), 5000)
    PrinterSdk.initPrinter((success: boolean, message: string) => {
      clearTimeout(timer)
      if (success) {
        printerReady = true
        resolve()
      } else {
        reject(new Error(message || '打印机初始化失败'))
      }
    })
  })
}
// #endif

/** 直接打印发货联（商米 APP） */
export async function printDeliverySlip(detail: SalesOrderDetail): Promise<void> {
  // #ifdef APP-PLUS
  if (!printerReady)
    await initSunmiSdk()

  const left = makeTextStyle(1, 28)
  LineApi.initLine({ align: 2, width: 456, height: 0, renderColor: 0, posX: 0 })
  LineApi.printText('发货联', makeTextStyle(2, 32))
  LineApi.printDividingLine(1, 2)
  LineApi.printText(`订单号：${detail.orderNo}`, left)
  LineApi.printText(`客户名称：${detail.customerName || '-'}`, left)
  LineApi.printText(`收货人：${detail.receiver || '-'}`, left)
  LineApi.printText(`打印日期：${deliveryPrintTodayStr()}`, left)
  LineApi.printText(`电话：${detail.mobile || '-'}`, left)
  LineApi.printText(`收货地址：${detail.deliveryAddress || '-'}`, left)
  LineApi.printDividingLine(1, 2)
  LineApi.autoOut()
  // #endif

  // #ifndef APP-PLUS
  throw new Error('当前环境不支持打印')
  // #endif
}
