import type { MaterialTableRow } from '../types'
import type {
  SalesOrderCurtainDetail,
  SalesOrderDetail,
  SalesOrderMaterialDetail,
  SalesOrderStructureDetail,
} from '@/api/curtain/order'
import { ORDER_CURTAIN_SHIP_QR, ORDER_FABRIC_SHIP_QR } from '../types'

type GetUnitLabel = (val: string) => string

export function findCurtain(curtains: SalesOrderCurtainDetail[], curtainId: number) {
  return curtains.find(c => c.curtainId === curtainId || c.id === curtainId)
}

export function findStructure(curtain: SalesOrderCurtainDetail, structureId?: number): SalesOrderStructureDetail | undefined {
  if (structureId != null && Number.isFinite(structureId)) {
    return curtain.structures?.find(s => s.id === structureId || s.structureId === structureId)
  }
  return curtain.structures?.[0]
}

export function getMaterialSpec(mat: SalesOrderMaterialDetail, structure?: SalesOrderStructureDetail) {
  const extra = mat as unknown as Record<string, unknown>
  const specFromMat = extra.specValue ?? extra.spec
  if (specFromMat)
    return String(specFromMat)
  if (structure?.width || structure?.height)
    return `${structure.width || '-'}×${structure.height || '-'}`
  return '-'
}

function buildMaterialRow(
  curtain: SalesOrderCurtainDetail,
  mat: SalesOrderMaterialDetail,
  structure: SalesOrderStructureDetail,
  getUnitLabel: GetUnitLabel,
): MaterialTableRow {
  const spec = getMaterialSpec(mat, structure)
  const shipped = !!curtain.shipTime
  const structureKey = structure.id ?? structure.structureId ?? 0
  return {
    rowKey: `${curtain.id}-${structureKey}`,
    curtainId: curtain.id,
    structureId: structureKey,
    productDisplay: `${mat.productName || '-'}(${spec})`,
    usage: `${mat.quantity ?? 0}${getUnitLabel(mat.unitValue)}`,
    shipped,
    checked: !shipped,
  }
}

function parseStructureIds(content: Record<string, any>): number[] {
  if (Array.isArray(content.structureIds)) {
    const ids = content.structureIds
      .map((id: unknown) => Number(id))
      .filter(id => Number.isFinite(id) && id > 0)
    if (ids.length)
      return ids
  }
  const single = Number(content.structureId)
  if (Number.isFinite(single) && single > 0)
    return [single]
  return []
}

export function buildFabricShipRows(
  order: SalesOrderDetail,
  content: Record<string, any>,
  getUnitLabel: GetUnitLabel,
): MaterialTableRow[] | null {
  const curtains = order.curtains ?? []
  const contentCurtainId = content.curtainId != null ? Number(content.curtainId) : undefined
  const contentStructureId = content.structureId != null ? Number(content.structureId) : undefined
  const hasCurtainId = contentCurtainId != null && Number.isFinite(contentCurtainId) && contentCurtainId > 0

  if (hasCurtainId) {
    const curtain = findCurtain(curtains, contentCurtainId!)
    if (!curtain) {
      uni.showToast({ title: '未找到对应窗帘', icon: 'none' })
      return null
    }

    const structure = findStructure(curtain, contentStructureId)
    if (!structure) {
      uni.showToast({ title: '未找到对应结构', icon: 'none' })
      return null
    }

    const mat = structure.materials?.[0]
    if (!mat) {
      uni.showToast({ title: '未找到用料信息', icon: 'none' })
      return null
    }

    return [buildMaterialRow(curtain, mat, structure, getUnitLabel)]
  }

  const rows = curtains.flatMap((curtain) => {
    const structure = curtain.structures?.[0]
    const mat = structure?.materials?.[0]
    if (!structure || !mat)
      return []
    return [buildMaterialRow(curtain, mat, structure, getUnitLabel)]
  })

  if (!rows.length) {
    uni.showToast({ title: '未找到用料信息', icon: 'none' })
    return null
  }

  return rows
}

export function buildCurtainShipRows(
  order: SalesOrderDetail,
  content: Record<string, any>,
  getUnitLabel: GetUnitLabel,
): MaterialTableRow[] | null {
  const contentCurtainId = content.curtainId != null ? Number(content.curtainId) : undefined
  if (contentCurtainId == null || !Number.isFinite(contentCurtainId) || contentCurtainId <= 0) {
    uni.showToast({ title: '条码未包含有效窗帘ID(curtainId)', icon: 'none' })
    return null
  }

  const curtain = findCurtain(order.curtains ?? [], contentCurtainId)
  if (!curtain) {
    uni.showToast({ title: '未找到对应窗帘', icon: 'none' })
    return null
  }

  const structureIds = parseStructureIds(content)
  if (!structureIds.length) {
    uni.showToast({ title: '条码未包含有效结构ID(structureIds)', icon: 'none' })
    return null
  }

  const rows = structureIds.flatMap((structureId) => {
    const structure = findStructure(curtain, structureId)
    if (!structure)
      return []
    const mat = structure.materials?.[0]
    if (!mat)
      return []
    return [buildMaterialRow(curtain, mat, structure, getUnitLabel)]
  })

  if (!rows.length) {
    uni.showToast({ title: '未找到用料信息', icon: 'none' })
    return null
  }

  return rows
}

export function buildShipRows(
  codeType: string,
  order: SalesOrderDetail,
  content: Record<string, any>,
  getUnitLabel: GetUnitLabel,
): MaterialTableRow[] | null {
  if (codeType === ORDER_FABRIC_SHIP_QR)
    return buildFabricShipRows(order, content, getUnitLabel)
  if (codeType === ORDER_CURTAIN_SHIP_QR)
    return buildCurtainShipRows(order, content, getUnitLabel)
  uni.showToast({ title: '暂不支持该码类型', icon: 'none' })
  return null
}
