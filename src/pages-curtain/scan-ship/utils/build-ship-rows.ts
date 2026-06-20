import type { BuildShipRowsResult, ShipTableRow } from '../types'
import type {
  SalesOrderCurtainDetail,
  SalesOrderDetail,
  SalesOrderMaterialDetail,
  SalesOrderStructureDetail,
} from '@/api/curtain/order'
import { ORDER_CURTAIN_SHIP_QR, ORDER_FABRIC_SHIP_QR } from '../types'

type GetUnitLabel = (val: string) => string

/** 按窗帘行 id 匹配 */
export function findCurtainById(curtains: SalesOrderCurtainDetail[], id: number) {
  return curtains.find(c => c.id === id)
}

export function findStructure(curtain: SalesOrderCurtainDetail, structureId?: number): SalesOrderStructureDetail | undefined {
  if (structureId != null && Number.isFinite(structureId)) {
    return curtain.structures?.find(s => s.id === structureId)
  }
  return curtain.structures?.[0]
}

/** 成品窗帘发货码：按结构行 id 匹配 */
export function findStructureById(curtain: SalesOrderCurtainDetail, id: number) {
  return curtain.structures?.find(s => s.id === id)
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

function formatStructureSize(structure: SalesOrderStructureDetail) {
  if (structure.width || structure.height)
    return `${structure.width || '-'}×${structure.height || '-'}`
  return '-'
}

function buildFabricRow(
  curtain: SalesOrderCurtainDetail,
  mat: SalesOrderMaterialDetail,
  structure: SalesOrderStructureDetail,
  getUnitLabel: GetUnitLabel,
): ShipTableRow {
  const spec = getMaterialSpec(mat, structure)
  const shipped = !!curtain.shipTime
  const structureKey = structure.id ?? 0
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

function buildStructureRow(
  curtain: SalesOrderCurtainDetail,
  structure: SalesOrderStructureDetail,
): ShipTableRow {
  const shipped = !!curtain.shipTime
  return {
    rowKey: `${curtain.id}-${structure.id}`,
    curtainId: curtain.id,
    structureId: structure.id,
    structureName: structure.structureName || '-',
    sizeDisplay: formatStructureSize(structure),
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
): ShipTableRow[] | null {
  const curtains = order.curtains ?? []
  const contentCurtainId = content.curtainId != null ? Number(content.curtainId) : undefined
  const contentStructureId = content.structureId != null ? Number(content.structureId) : undefined
  const hasCurtainId = contentCurtainId != null && Number.isFinite(contentCurtainId) && contentCurtainId > 0

  if (hasCurtainId) {
    const curtain = findCurtainById(curtains, contentCurtainId!)
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

    return [buildFabricRow(curtain, mat, structure, getUnitLabel)]
  }

  const rows = curtains.flatMap((curtain) => {
    const structure = curtain.structures?.[0]
    const mat = structure?.materials?.[0]
    if (!structure || !mat)
      return []
    return [buildFabricRow(curtain, mat, structure, getUnitLabel)]
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
): ShipTableRow[] | null {
  const contentCurtainId = content.curtainId != null ? Number(content.curtainId) : undefined
  if (contentCurtainId == null || !Number.isFinite(contentCurtainId) || contentCurtainId <= 0) {
    uni.showToast({ title: '条码未包含有效窗帘ID(curtainId)', icon: 'none' })
    return null
  }

  const curtain = findCurtainById(order.curtains ?? [], contentCurtainId)
  if (!curtain) {
    uni.showToast({ title: '未找到对应窗帘', icon: 'none' })
    return null
  }

  const structureIds = parseStructureIds(content)
  if (!structureIds.length) {
    uni.showToast({ title: '条码未包含有效结构ID(structureIds)', icon: 'none' })
    return null
  }

  const rows = structureIds.flatMap((id) => {
    const structure = findStructureById(curtain, id)
    if (!structure)
      return []
    return [buildStructureRow(curtain, structure)]
  })

  if (!rows.length) {
    uni.showToast({ title: '未找到结构信息', icon: 'none' })
    return null
  }

  return rows
}

export function buildShipRows(
  codeType: string,
  order: SalesOrderDetail,
  content: Record<string, any>,
  getUnitLabel: GetUnitLabel,
): BuildShipRowsResult | null {
  if (codeType === ORDER_FABRIC_SHIP_QR) {
    const rows = buildFabricShipRows(order, content, getUnitLabel)
    if (!rows)
      return null
    return { mode: 'fabric', rows }
  }
  if (codeType === ORDER_CURTAIN_SHIP_QR) {
    const rows = buildCurtainShipRows(order, content)
    if (!rows)
      return null
    return { mode: 'curtain', rows }
  }
  uni.showToast({ title: '暂不支持该码类型', icon: 'none' })
  return null
}
