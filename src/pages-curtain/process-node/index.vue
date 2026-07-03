<script setup lang="ts">
import type { BarcodeRegistryVO } from '@/api/curtain/barcode-registry/index'
import type { InstallProcess } from '@/api/curtain/install-process/index'
import type { SalesOrderDetail, SalesOrderMaterialDetail } from '@/api/curtain/order'
import type { ProcessNodeSimple } from '@/api/curtain/process-node/index'
import type { WorkshopUserSimple } from '@/api/curtain/workshop-user/index'
import { storeToRefs } from 'pinia'
import { useMessage } from 'wot-design-uni/components/wd-message-box/index'
import { getBarcodeRegistry } from '@/api/curtain/barcode-registry/index'
import { getInstallProcess } from '@/api/curtain/install-process/index'
import { getSalesOrderDetail } from '@/api/curtain/order'
import { createOrderProcessRecord } from '@/api/curtain/order-process-record/index'
import { getMyProcessNodes } from '@/api/curtain/process-node/index'
import { getWorkshopUserSimpleList } from '@/api/curtain/workshop-user/index'
import { useDictStore, useOperatorStore } from '@/store'

definePage({
  style: {
    navigationBarTitleText: '工序操作',
  },
})

const operatorStore = useOperatorStore()
const dictStore = useDictStore()

function translateDict(dictType: string, value: any) {
  return dictStore.getDictData(dictType, value)?.label ?? value
}

function getUnitLabel(val: string) {
  return dictStore.getDictData('zc_product_unit', val)?.label ?? val ?? '-'
}

function getPrintableMaterials(materials?: SalesOrderMaterialDetail[]) {
  return materials?.filter(m => m.elementIsPrint === true) ?? []
}
const { primaryOperator, secondaryOperator } = storeToRefs(operatorStore)

const message = useMessage()
const showCompletedTip = ref(false)
const showWrongNodeTip = ref(false)
const errorTipMsg = ref('')

const userList = ref<WorkshopUserSimple[]>([])
const processNodeList = ref<ProcessNodeSimple[]>([])
const pickerTarget = ref<'primary' | 'secondary'>('primary')
const showPicker = ref(false)
const orderNo = ref('')
const orderDetail = ref<SalesOrderDetail | null>(null)
const searching = ref(false)
const locateCurtainId = ref<number | null>(null)
const locateStructureId = ref<number | null>(null)
const scanning = ref(false)

const SCAN_END_DELAY = 100
const SCAN_MIN_LENGTH = 4
/** 错误提示弹窗显示时长 */
const ERROR_TIP_DURATION = 6000
/** 同一码短时间内多通道触发（plus.key / input / timer）去重窗口 */
const SCAN_DEDUPE_MS = 2000

let scanBuffer = ''
let scanTimer: ReturnType<typeof setTimeout> | null = null
let scannerListenerBound = false
let pendingScanCode = ''
let currentScanCode = ''
let lastScanCode = ''
let lastScanAt = 0
let loadingBarcodeCodeId: string | null = null
let loadingBarcodePromise: Promise<BarcodeRegistryVO> | null = null

/** Android 扫码枪 US Keyboard 模式 keyCode → 字符（APP 端 plus.key 事件无 e.key 时使用） */
const ANDROID_KEYCODE_CHAR: Record<number, string> = {
  7: '0',
  8: '1',
  9: '2',
  10: '3',
  11: '4',
  12: '5',
  13: '6',
  14: '7',
  15: '8',
  16: '9',
  29: 'A',
  30: 'B',
  31: 'C',
  32: 'D',
  33: 'E',
  34: 'F',
  35: 'G',
  36: 'H',
  37: 'I',
  38: 'J',
  39: 'K',
  40: 'L',
  41: 'M',
  42: 'N',
  43: 'O',
  44: 'P',
  45: 'Q',
  46: 'R',
  47: 'S',
  48: 'T',
  49: 'U',
  50: 'V',
  51: 'W',
  52: 'X',
  53: 'Y',
  54: 'Z',
  69: '-',
  189: '-',
}

const BARCODE_CODE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isBarcodeCodeId(val: string): boolean {
  return BARCODE_CODE_ID_RE.test(val)
}

function keyCodeToChar(keyCode: number): string {
  return ANDROID_KEYCODE_CHAR[keyCode] ?? ''
}

type DeliveryLevel = 'overdue' | 'today' | 'soon' | 'normal'
type ScanState = 'IDLE' | 'ORDER_LOADED' | 'STRUCT_SELECTED' | 'NODE_SELECTED' | 'READY_TO_COMMIT'

interface DeliveryStatus {
  text: string
  level: DeliveryLevel
}

const deliveryStatus = computed<DeliveryStatus | null>(() => {
  const date = orderDetail.value?.deliveryDate
  if (!date)
    return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diffDays < 0)
    return { text: `已超期 ${-diffDays} 天`, level: 'overdue' }
  if (diffDays === 0)
    return { text: '今日要交货', level: 'today' }
  if (diffDays <= 3)
    return { text: `还有 ${diffDays} 天交货`, level: 'soon' }
  return { text: `还有 ${diffDays} 天交货`, level: 'normal' }
})

const selectedStructureId = ref<number | null>(null)
const selectedNodeId = ref<number | null>(null)
const activeCurtainId = ref<number | null>(null)
const installProcess = ref<InstallProcess | null>(null)
const scanState = ref<ScanState>('IDLE')
const scanContext = reactive({
  orderDetail: null as SalesOrderDetail | null,
  installProcess: null as InstallProcess | null,
  structureId: null as number | null,
  nodeId: null as number | null,
})

const activeCurtain = computed(() => {
  if (!orderDetail.value)
    return null
  return orderDetail.value.curtains.find(c => c.id === activeCurtainId.value) ?? null
})

watch(orderDetail, (detail) => {
  if (!detail)
    return
  if (locateCurtainId.value && detail.curtains.some(c => c.id === locateCurtainId.value))
    activeCurtainId.value = locateCurtainId.value
  else
    activeCurtainId.value = detail.curtains[0]?.id ?? null
})

const selectedStructure = computed(() => {
  if (!selectedStructureId.value || !orderDetail.value)
    return null
  for (const curtain of orderDetail.value.curtains) {
    const s = curtain.structures.find(s => s.id === selectedStructureId.value)
    if (s)
      return { curtain, structure: s }
  }
  return null
})

const selectedPrintableMaterials = computed(() =>
  getPrintableMaterials(selectedStructure.value?.structure.materials),
)

// 解析安装工艺的 nodeIds（后端可能返回 JSON 字符串或数组）
function parseNodeIds(raw: number[] | string): number[] {
  if (Array.isArray(raw))
    return raw
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// 当前工序节点是否已在安装工艺的工序列表中（提示已完成）
const isCurrentNodeCompleted = computed(() => {
  if (!selectedNodeId.value || !installProcess.value)
    return false
  const ids = parseNodeIds(installProcess.value.nodeIds)
  return ids.includes(selectedNodeId.value)
})

// 当前工序节点不在安装工艺的工序列表中（错误工序）
const isWrongNode = computed(() => {
  if (!selectedNodeId.value || !installProcess.value)
    return false
  const ids = parseNodeIds(installProcess.value.nodeIds)
  return !ids.includes(selectedNodeId.value)
})

const selectedNodeName = computed(() =>
  processNodeList.value.find(n => n.id === selectedNodeId.value)?.name ?? '',
)

let loadingInstallProcessId: number | null = null
let loadingInstallProcessPromise: Promise<InstallProcess | null> | null = null

/** 安装工艺请求去重：同一 processId 复用缓存或进行中的 Promise */
async function fetchInstallProcess(processId: number): Promise<InstallProcess | null> {
  if (installProcess.value?.id === processId)
    return installProcess.value
  if (loadingInstallProcessId === processId && loadingInstallProcessPromise)
    return loadingInstallProcessPromise

  loadingInstallProcessId = processId
  loadingInstallProcessPromise = getInstallProcess(processId)
    .then((process) => {
      installProcess.value = process
      return process
    })
    .catch(() => null)
    .finally(() => {
      if (loadingInstallProcessId === processId) {
        loadingInstallProcessId = null
        loadingInstallProcessPromise = null
      }
    })
  return loadingInstallProcessPromise
}

watch(
  () => selectedStructure.value?.structure.installProcessId,
  async (processId) => {
    installProcess.value = null
    scanContext.installProcess = null
    if (!processId)
      return
    scanContext.installProcess = await fetchInstallProcess(processId)
  },
  { immediate: true },
)

function setOrder(detail: SalesOrderDetail) {
  scanContext.orderDetail = detail
  scanState.value = 'ORDER_LOADED'
}

function setStructure(id: number) {
  scanContext.structureId = id
  scanState.value = 'STRUCT_SELECTED'
}

function setNode(id: number) {
  scanContext.nodeId = id
  scanState.value = 'NODE_SELECTED'
}

function syncReadyState() {
  if (scanContext.orderDetail && scanContext.structureId && scanContext.nodeId)
    scanState.value = 'READY_TO_COMMIT'
}

function resetScanState() {
  scanState.value = 'IDLE'
  scanContext.orderDetail = null
  scanContext.installProcess = null
  scanContext.structureId = null
  scanContext.nodeId = null
}

function getCommitBlockReason(): string | null {
  if (!scanContext.orderDetail || !scanContext.structureId || !scanContext.nodeId)
    return '扫码信息不完整，请重新扫码'
  if (!scanContext.installProcess)
    return null
  const ids = parseNodeIds(scanContext.installProcess.nodeIds)
  if (!ids.includes(scanContext.nodeId)) {
    const nodeName = processNodeList.value.find(n => n.id === scanContext.nodeId)?.name
    return nodeName
      ? `「${nodeName}」不在安装工艺「${scanContext.installProcess.name}」允许范围内`
      : '当前工序不在安装工艺允许范围内'
  }
  return null
}

async function ensureInstallProcessLoaded() {
  const processId = selectedStructure.value?.structure.installProcessId
  if (!processId) {
    scanContext.installProcess = null
    return
  }
  scanContext.installProcess = await fetchInstallProcess(processId)
}

function showWrongNodeError(msg: string) {
  errorTipMsg.value = msg
  showWrongNodeTip.value = true
  const audio = uni.createInnerAudioContext()
  audio.src = '/static/audio/error_node.mp3'
  audio.play()
  setTimeout(() => { showWrongNodeTip.value = false }, ERROR_TIP_DURATION)
}

async function commitIfReady() {
  syncReadyState()
  await ensureInstallProcessLoaded()
  if (selectedStructure.value?.structure.installProcessId && !scanContext.installProcess) {
    showWrongNodeError('安装工艺加载失败，请重试扫码')
    return
  }
  const commitBlockReason = getCommitBlockReason()
  if (commitBlockReason) {
    showWrongNodeError(commitBlockReason)
    return
  }
  await handleCompleteProcess()
}

function saveProcessNodeCache(nodeId: number | null) {
  const operatorId = primaryOperator.value?.id
  if (!operatorId)
    return
  operatorStore.setProcessNode(operatorId, nodeId)
}

async function restoreProcessNodeSelection(promptIfMissing = false) {
  if (!primaryOperator.value || !processNodeList.value.length)
    return

  if (processNodeList.value.length === 1) {
    selectedNodeId.value = processNodeList.value[0].id
    setNode(selectedNodeId.value)
    saveProcessNodeCache(selectedNodeId.value)
    return
  }

  const cachedId = operatorStore.getProcessNode(primaryOperator.value.id)
  const validCached = cachedId != null && processNodeList.value.some(n => n.id === cachedId)

  if (validCached) {
    selectedNodeId.value = cachedId!
    setNode(cachedId!)
    return
  }

  selectedNodeId.value = null
  scanContext.nodeId = null

  if (!promptIfMissing)
    return

  try {
    await message.alert({
      title: '请先选择当前工序',
      msg: `您有 ${processNodeList.value.length} 个工序，请在上方选择您当前正在执行的工序后再扫码`,
      confirmButtonText: '知道了',
    })
  } catch {
    // 忽略
  }
}

function selectNode(id: number) {
  selectedNodeId.value = selectedNodeId.value === id ? null : id
  scanContext.nodeId = selectedNodeId.value
  if (selectedNodeId.value)
    setNode(selectedNodeId.value)
  saveProcessNodeCache(selectedNodeId.value)
}

watch(() => primaryOperator.value?.id, async () => {
  await restoreProcessNodeSelection(true)
})

function selectStructure(id: number) {
  if (locateStructureId.value)
    return
  selectedStructureId.value = selectedStructureId.value === id ? null : id
  scanContext.structureId = selectedStructureId.value
  if (selectedStructureId.value)
    setStructure(selectedStructureId.value)
}

const submitting = ref(false)

async function handleCompleteProcess() {
  if (!selectedStructure.value || !selectedNodeId.value || !primaryOperator.value || submitting.value)
    return
  const { curtain, structure } = selectedStructure.value
  submitting.value = true
  try {
    await createOrderProcessRecord({
      orderId: orderDetail.value!.id,
      curtainId: curtain.id,
      structureId: structure.id,
      nodeId: selectedNodeId.value!,
      masterId: primaryOperator.value!.id,
      assistantId: secondaryOperator.value?.id,
    })
    const audio = uni.createInnerAudioContext()
    audio.src = '/static/audio/completed_node.mp3'
    audio.play()
    showCompletedTip.value = true
    setTimeout(() => { showCompletedTip.value = false }, 3000)
  } catch (e: any) {
    showWrongNodeError(e?.msg ?? e?.message ?? '提交失败，请重试')
  } finally {
    submitting.value = false
  }
}

// 是否纯面料单（无成品帘工序）
const isFabricOnly = computed(() => {
  const t = orderDetail.value?.types ?? ''
  return (t.includes('FABRIC') || t.includes('面料单'))
    && !t.includes('CURTAIN') && !t.includes('成品帘')
})

async function handleOrderSearch() {
  const no = orderNo.value.trim()
  if (!no)
    return
  searching.value = true
  orderDetail.value = null
  try {
    orderDetail.value = await getSalesOrderDetail({ orderNo: no })
    if (orderDetail.value)
      setOrder(orderDetail.value)
  } catch {
    showWrongNodeError('未找到该订单')
    resetScanState()
  } finally {
    searching.value = false
  }
}

async function handleInputConfirm() {
  const val = orderNo.value.trim()
  if (!val)
    return
  // APP 端扫码枪常把内容注入到 input，需按条码 ID 解析而非订单号查询
  if (isBarcodeCodeId(val)) {
    orderNo.value = ''
    resetScanBuffer()
    await handleScanCode(val)
    return
  }
  await handleOrderSearch()
}

function shouldIgnoreDuplicateScan(code: string): boolean {
  const now = Date.now()
  if (code === currentScanCode)
    return true
  return code === lastScanCode && now - lastScanAt < SCAN_DEDUPE_MS
}

function normalizeKey(e: any): string {
  return typeof e?.key === 'string' ? e.key : ''
}

function isPrintableScanChar(key: string, e: any): boolean {
  if (e?.ctrlKey || e?.altKey || e?.metaKey)
    return false
  if (key.length !== 1)
    return false
  // 条码场景仅允许常见可见字符，避免拼入控制字符
  return /^[\w\-.:/]$/.test(key)
}

function clearScanTimer() {
  if (scanTimer) {
    clearTimeout(scanTimer)
    scanTimer = null
  }
}

function resetScanBuffer() {
  scanBuffer = ''
  clearScanTimer()
}

async function handleScanCode(code: string) {
  const normalized = code.trim()
  if (!normalized)
    return

  if (shouldIgnoreDuplicateScan(normalized)) {
    console.warn('[scanner] 忽略重复扫码:', normalized)
    return
  }

  if (scanning.value) {
    if (normalized === currentScanCode || normalized === pendingScanCode) {
      console.warn('[scanner] 忽略排队中的重复扫码:', normalized)
      return
    }
    pendingScanCode = normalized
    console.warn('[scanner] 当前请求进行中，已排队等待下一次处理:', normalized)
    return
  }

  console.log('[scanner] 收到扫码内容:', normalized)
  currentScanCode = normalized
  scanning.value = true
  // 每次扫码前清空当前订单信息，避免残留上次数据
  orderDetail.value = null
  orderNo.value = ''
  resetScanState()
  locateCurtainId.value = null
  locateStructureId.value = null
  selectedStructureId.value = null
  activeCurtainId.value = null
  try {
    await processBarcodeData(normalized)
    lastScanCode = normalized
    lastScanAt = Date.now()
    console.log('[scanner] 扫码处理完成:', normalized)
  } catch (error) {
    console.error('[scanner] 扫码处理失败:', normalized, error)
    throw error
  } finally {
    scanning.value = false
    currentScanCode = ''
    if (pendingScanCode) {
      const nextCode = pendingScanCode
      pendingScanCode = ''
      console.log('[scanner] 开始处理排队扫码:', nextCode)
      void handleScanCode(nextCode)
    }
  }
}

function flushScanBuffer() {
  const current = scanBuffer.trim()
  resetScanBuffer()
  if (current.length >= SCAN_MIN_LENGTH) {
    if (isBarcodeCodeId(current))
      orderNo.value = ''
    void handleScanCode(current)
  }
}

function appendScanChar(key: string, e?: any) {
  if (!isPrintableScanChar(key, e ?? {}))
    return
  scanBuffer += key
  clearScanTimer()
  scanTimer = setTimeout(() => {
    flushScanBuffer()
  }, SCAN_END_DELAY)
}

function handleGlobalKeydown(e: any) {
  if (e?.isComposing)
    return

  const key = normalizeKey(e)
  if (!key)
    return

  if (key === 'Enter' || key === 'NumpadEnter') {
    flushScanBuffer()
    return
  }

  appendScanChar(key, e)
}

/** APP 端扫码枪键盘事件（plus.key，document/window 在 WebView 中不可用） */
function handlePlusKeyup(e: any) {
  const keyCode = Number(e?.keyCode)
  if (keyCode === 66 || e?.key === 'Enter') {
    flushScanBuffer()
    return
  }
  let key = typeof e?.key === 'string' && e.key.length === 1 ? e.key : ''
  if (!key && keyCode)
    key = keyCodeToChar(keyCode)
  if (!key)
    return
  appendScanChar(key, e)
}

function bindScannerListener() {
  // 先强制解绑，防止 onHide 未完全移除导致切回页面后监听器叠加
  unbindScannerListener()
  // #ifdef H5
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleGlobalKeydown, true)
    scannerListenerBound = true
  } else if (typeof document !== 'undefined') {
    document.addEventListener('keydown', handleGlobalKeydown, true)
    scannerListenerBound = true
  }
  // #endif
  // #ifdef APP-PLUS
  if (typeof plus !== 'undefined' && plus.key) {
    plus.key.addEventListener('keyup', handlePlusKeyup)
    scannerListenerBound = true
  }
  // #endif
}

function unbindScannerListener() {
  // 无论 bound 标记如何，都尝试从所有可能目标移除，避免监听器泄漏
  // #ifdef H5
  if (typeof window !== 'undefined')
    window.removeEventListener('keydown', handleGlobalKeydown, true)
  if (typeof document !== 'undefined')
    document.removeEventListener('keydown', handleGlobalKeydown, true)
  // #endif
  // #ifdef APP-PLUS
  if (typeof plus !== 'undefined' && plus.key)
    plus.key.removeEventListener('keyup', handlePlusKeyup)
  // #endif

  scannerListenerBound = false
  pendingScanCode = ''
  currentScanCode = ''
  resetScanBuffer()
}

/** 条码注册请求去重：同一 codeId 复用进行中的 Promise */
function fetchBarcodeRegistry(codeId: string): Promise<BarcodeRegistryVO> {
  if (loadingBarcodeCodeId === codeId && loadingBarcodePromise)
    return loadingBarcodePromise

  loadingBarcodeCodeId = codeId
  loadingBarcodePromise = getBarcodeRegistry(codeId).finally(() => {
    if (loadingBarcodeCodeId === codeId) {
      loadingBarcodeCodeId = null
      loadingBarcodePromise = null
    }
  })
  return loadingBarcodePromise
}

async function processBarcodeData(codeId: string) {
  try {
    const data = await fetchBarcodeRegistry(codeId)
    console.log('[scanner] 条码注册信息:', data)
    const content = JSON.parse(data.codeContent ?? '{}') as Record<string, any>
    console.log('[scanner] 解析后的条码内容:', content)
    if (content.orderNo) {
      resetScanState()
      orderNo.value = content.orderNo
      locateCurtainId.value = content.curtainId ? Number(content.curtainId) : null
      if (content.structureId) {
        locateStructureId.value = Number(content.structureId)
        selectedStructureId.value = Number(content.structureId)
        setStructure(Number(content.structureId))
      } else {
        locateStructureId.value = null
        selectedStructureId.value = null
        if (selectedStructureId.value)
          setStructure(selectedStructureId.value)
      }
      await handleOrderSearch()
      if (orderDetail.value)
        setOrder(orderDetail.value)
      if (locateStructureId.value && orderDetail.value) {
        const found = orderDetail.value.curtains.some(c =>
          c.structures.some(s => s.id === locateStructureId.value),
        )
        if (!found) {
          locateStructureId.value = null
          selectedStructureId.value = null
          scanContext.structureId = null
        }
      }
      if (selectedStructureId.value && !scanContext.structureId)
        setStructure(selectedStructureId.value)
      if (!selectedNodeId.value) {
        try {
          await message.confirm({
            title: '请先选择当前工序',
            msg: '您尚未选择当前工序，请在上方选择后再次扫码',
            confirmButtonText: '知道了',
            cancelButtonText: '取消',
          })
        } catch {
          // 用户取消，无需处理
        }
      } else {
        setNode(selectedNodeId.value)
        await commitIfReady()
      }
      console.log('[scanner] 本次扫码业务处理成功，订单号:', content.orderNo)
    } else {
      console.warn('[scanner] 条码缺少 orderNo，无法处理:', content)
      showWrongNodeError('该码暂不支持解析')
    }
  } catch (error) {
    console.error('[scanner] 条码解析/请求失败:', codeId, error)
    showWrongNodeError('码ID无效或已过期')
  }
}

onLoad(async (query) => {
  ;[userList.value, processNodeList.value] = await Promise.all([
    getWorkshopUserSimpleList(),
    getMyProcessNodes(),
  ])
  // 初始化工序选择：优先恢复缓存，无缓存时再提示用户选择
  await restoreProcessNodeSelection(true)
  if (query?.orderNo) {
    orderNo.value = query.orderNo
    if (query.curtainId)
      locateCurtainId.value = Number(query.curtainId)
    if (query.structureId) {
      locateStructureId.value = Number(query.structureId)
      selectedStructureId.value = Number(query.structureId)
    }
    await handleOrderSearch()
    if (locateStructureId.value && orderDetail.value) {
      const found = orderDetail.value.curtains.some(c =>
        c.structures.some(s => s.id === locateStructureId.value),
      )
      if (!found) {
        locateStructureId.value = null
        selectedStructureId.value = null
      }
    }
  }
})

onShow(() => {
  bindScannerListener()
})

onHide(() => {
  unbindScannerListener()
  // #ifdef APP-PLUS
  uni.hideKeyboard()
  // #endif
})

onUnload(() => {
  unbindScannerListener()
})

function openPicker(target: 'primary' | 'secondary') {
  pickerTarget.value = target
  showPicker.value = true
}

const currentSelectedId = computed(() =>
  pickerTarget.value === 'primary' ? primaryOperator.value?.id : secondaryOperator.value?.id,
)

const disabledId = computed(() =>
  pickerTarget.value === 'primary' ? secondaryOperator.value?.id : primaryOperator.value?.id,
)

function selectUser(user: WorkshopUserSimple) {
  if (user.id === disabledId.value) {
    showWrongNodeError('主副操作员不能是同一人')
    return
  }
  if (pickerTarget.value === 'primary')
    operatorStore.setPrimary(user)
  else
    operatorStore.setSecondary(user)
  showPicker.value = false
}

function previewCurtainImage(url: string) {
  const curtain = activeCurtain.value
  if (!curtain)
    return
  const urls = [curtain.image1, curtain.image2].filter(Boolean)
  uni.previewImage({ urls, current: url })
}
</script>

<template>
  <view class="page-body">
    <view class="page-split">
      <!-- 左侧 2/3 -->
      <view class="page-left">
        <!-- 操作员（置顶） -->
        <view class="operator-panel">
          <view class="operator-item primary" @tap="openPicker('primary')">
            <view class="operator-avatar primary">
              <view class="i-carbon-user-avatar-filled text-84rpx text-[#018d71]" />
            </view>
            <view class="operator-info">
              <text class="operator-role">主操作员</text>
              <view class="operator-name-row">
                <text class="operator-name primary">{{ primaryOperator ? primaryOperator.name : '请选择' }}</text>
                <view class="i-carbon-chevron-down text-42rpx text-[#018d71]" />
              </view>
            </view>
          </view>
          <view class="operator-item secondary" @tap="openPicker('secondary')">
            <view class="operator-avatar secondary">
              <view class="i-carbon-user-avatar-filled text-60rpx text-[#666]" />
            </view>
            <view class="operator-info">
              <text class="operator-role secondary">副操作员</text>
              <view class="operator-name-row">
                <text class="operator-name secondary">{{ secondaryOperator ? secondaryOperator.name : '请选择' }}</text>
                <view class="i-carbon-chevron-down text-30rpx text-#999" />
                <view
                  v-if="secondaryOperator"
                  class="i-carbon-close-filled text-36rpx text-#ccc"
                  @tap.stop="operatorStore.setSecondary(null)"
                />
              </view>
            </view>
          </view>
          <view class="operator-spacer" />
          <view
            class="record-entry"
            @tap="primaryOperator && uni.navigateTo({ url: `/pages-curtain/process-node/operation-records/index?masterId=${primaryOperator.id}&masterName=${primaryOperator.name}` })"
          >
            <view class="i-carbon-list-boxes text-60rpx" :class="primaryOperator ? 'text-[#018d71]' : 'text-#ccc'" />
            <text class="record-entry-label" :class="primaryOperator ? 'text-[#018d71]' : 'text-#ccc'">操作记录</text>
          </view>
        </view>

        <!-- 订单号输入 -->
        <view class="order-input-wrap">
          <view class="order-input-box">
            <view class="i-carbon-document text-48rpx text-#aaa" />
            <input
              v-model="orderNo"
              class="order-input"
              placeholder="扫码或输入订单号"
              placeholder-style="color:#bbb"
              confirm-type="search"
              @confirm="handleInputConfirm"
            >
            <view
              class="i-carbon-close-filled text-48rpx text-#ccc"
              @tap="orderNo = ''; orderDetail = null"
            />
          </view>
        </view>

        <scroll-view scroll-y class="page-left-scroll">
          <view class="page-left-inner">
            <!-- 搜索中 -->
            <view v-if="searching" class="empty-tip">
              <wd-loading color="#018d71" />
              <text class="mt-16rpx text-42rpx text-#999">查询中...</text>
            </view>

            <!-- 无结果 -->
            <view v-else-if="!orderDetail" class="empty-tip">
              <view class="i-carbon-document text-120rpx text-#ccc" />
              <text class="mt-16rpx text-42rpx text-#999">输入订单号后按回车查询</text>
            </view>

            <!-- 面料单提示 -->
            <view v-else-if="isFabricOnly" class="fabric-warning">
              <view class="i-carbon-warning text-72rpx text-[#fa8c16]" />
              <text class="fabric-warning-text">该订单为面料单，不需要进行工序操作</text>
            </view>

            <!-- 订单详情 -->
            <template v-else>
              <!-- 窗帘行列表（Tab） -->
              <view class="curtain-tabs-card">
                <scroll-view scroll-x class="curtain-tabs-scroll">
                  <view class="curtain-tabs">
                    <view
                      v-for="curtain in orderDetail.curtains"
                      :key="curtain.id"
                      class="curtain-tab"
                      :class="{ 'curtain-tab--active': curtain.id === activeCurtainId }"
                      @tap="activeCurtainId = curtain.id"
                    >
                      <text class="curtain-tab-index">第{{ curtain.index }}帘</text>
                      <text v-if="curtain.curtainName" class="curtain-tab-room">{{ curtain.curtainName }}</text>
                    </view>
                  </view>
                </scroll-view>
                <view v-if="activeCurtain" class="curtain-tab-content">
                  <view
                    v-for="(structure, structureIndex) in activeCurtain.structures"
                    :key="structure.id"
                    class="structure-block"
                    :class="{
                      'structure-block--active': structure.id === selectedStructureId,
                      'structure-block--selectable': !locateStructureId,
                    }"
                    @tap="selectStructure(structure.id)"
                  >
                    <text class="structure-index-label">#{{ structureIndex + 1 }}</text>
                    <text class="structure-name-label">{{ structure.structureName }}</text>
                  </view>
                </view>
              </view>

              <!-- 款式信息 -->
              <view v-if="selectedStructure" class="structure-detail-card">
                <view class="structure-detail-header">
                  <text class="structure-detail-title">款式信息</text>
                  <text class="structure-detail-subtitle">{{ selectedStructure.curtain.curtainName }} · {{ selectedStructure.structure.structureName }}</text>
                </view>
                <view class="structure-detail-body">
                  <view v-if="selectedStructure.curtain.room" class="structure-detail-item">
                    <text class="structure-detail-label">房间</text>
                    <text class="structure-detail-value">{{ selectedStructure.curtain.room }}</text>
                  </view>
                  <view v-if="selectedStructure.curtain.pleatRatioValue != null && selectedStructure.curtain.pleatRatioValue !== ''" class="structure-detail-item">
                    <text class="structure-detail-label">褶倍</text>
                    <text class="structure-detail-value">{{ selectedStructure.curtain.pleatRatioValue }}</text>
                  </view>
                  <view class="structure-detail-item">
                    <text class="structure-detail-label">宽*高</text>
                    <text class="structure-detail-value">{{ selectedStructure.structure.width }}*{{ selectedStructure.structure.height }}</text>
                  </view>
                  <view v-if="selectedStructure.structure.installProcessName" class="structure-detail-item">
                    <text class="structure-detail-label">安装工艺</text>
                    <text class="structure-detail-value">{{ selectedStructure.structure.installProcessName }}</text>
                  </view>
                  <view v-if="selectedStructure.structure.openMethod" class="structure-detail-item">
                    <text class="structure-detail-label">开合方式</text>
                    <text class="structure-detail-value">{{ translateDict('zc_open_method', selectedStructure.structure.openMethod) }}</text>
                  </view>
                  <view v-if="selectedStructure.structure.processType" class="structure-detail-item">
                    <text class="structure-detail-label">加工类型</text>
                    <text class="structure-detail-value">{{ translateDict('zc_process_type', selectedStructure.structure.processType) }}</text>
                  </view>
                  <view class="structure-detail-item">
                    <text class="structure-detail-label">定型</text>
                    <text class="structure-detail-value">{{ selectedStructure.structure.isShaping ? '是' : '否' }}</text>
                  </view>
                  <view v-if="selectedStructure.structure.pleatsNum" class="structure-detail-item">
                    <text class="structure-detail-label">褶数</text>
                    <text class="structure-detail-value">{{ selectedStructure.structure.pleatsNum }}</text>
                  </view>
                  <view v-if="selectedStructure.structure.pleatsDistance" class="structure-detail-item">
                    <text class="structure-detail-label">褶距</text>
                    <text class="structure-detail-value">{{ selectedStructure.structure.pleatsDistance }}</text>
                  </view>
                  <view v-if="selectedStructure.structure.skirtHeight" class="structure-detail-item">
                    <text class="structure-detail-label">裙摆高</text>
                    <text class="structure-detail-value">{{ selectedStructure.structure.skirtHeight }}</text>
                  </view>
                  <view v-if="selectedStructure.structure.leftCorner" class="structure-detail-item">
                    <text class="structure-detail-label">左弯角</text>
                    <text class="structure-detail-value">{{ selectedStructure.structure.leftCorner }}</text>
                  </view>
                  <view v-if="selectedStructure.structure.rightCorner" class="structure-detail-item">
                    <text class="structure-detail-label">右弯角</text>
                    <text class="structure-detail-value">{{ selectedStructure.structure.rightCorner }}</text>
                  </view>
                  <view v-if="selectedStructure.structure.pasteDirection" class="structure-detail-item">
                    <text class="structure-detail-label">粘贴方向</text>
                    <text class="structure-detail-value">{{ translateDict('zc_paste_direction', selectedStructure.structure.pasteDirection) }}</text>
                  </view>
                </view>

                <!-- 用料明细 -->
                <view class="structure-materials-section">
                  <text class="structure-materials-title">用料信息</text>
                  <view v-if="selectedPrintableMaterials.length" class="material-detail-table">
                    <view class="material-detail-header">
                      <text class="material-detail-label">组件</text>
                      <text class="material-detail-label">产品</text>
                      <text class="material-detail-label">用量</text>
                      <text class="material-detail-label">单位</text>
                    </view>
                    <view
                      v-for="mat in selectedPrintableMaterials"
                      :key="mat.id"
                      class="material-detail-item"
                    >
                      <text class="material-detail-value">{{ mat.elementName || '-' }}</text>
                      <text class="material-detail-value">{{ mat.productName || '-' }}</text>
                      <text class="material-detail-value">{{ mat.quantity ?? '-' }}</text>
                      <text class="material-detail-value">{{ getUnitLabel(mat.unitValue) }}</text>
                    </view>
                  </view>
                  <text v-else class="structure-materials-empty">暂无用料</text>
                </view>
              </view>
            </template>
          </view>
        </scroll-view>
      </view>

      <!-- 右侧 1/3：交货提醒 + 工序 -->
      <view class="page-right">
        <!-- 交货提醒 -->
        <view class="delivery-panel">
          <text class="delivery-panel-title">交货提醒</text>
          <view
            v-if="deliveryStatus"
            class="delivery-badge delivery-badge--panel"
            :class="`delivery-badge--${deliveryStatus.level}`"
          >
            <view
              class="delivery-badge-icon"
              :class="{
                'i-carbon-alarm': deliveryStatus.level === 'overdue',
                'i-carbon-warning-filled': deliveryStatus.level === 'today',
                'i-carbon-time': deliveryStatus.level === 'soon',
                'i-carbon-calendar': deliveryStatus.level === 'normal',
              }"
            />
            <text class="delivery-text">{{ deliveryStatus.text }}</text>
            <text v-if="orderDetail?.deliveryDate" class="delivery-date">{{ orderDetail.deliveryDate }}</text>
          </view>
          <view v-else class="delivery-placeholder">
            <view class="i-carbon-calendar text-72rpx text-#ccc" />
            <text class="delivery-placeholder-text">查询订单后显示交货提醒</text>
          </view>
        </view>

        <!-- 当前工序 -->
        <view v-if="primaryOperator" class="delivery-panel">
          <text class="delivery-panel-title">当前工序</text>
          <view v-if="processNodeList.length" class="process-node-list">
            <view
              v-for="node in processNodeList"
              :key="node.id"
              class="process-node-chip"
              :class="{ 'process-node-chip--active': selectedNodeId === node.id }"
              @tap="selectNode(node.id)"
            >
              <view v-if="selectedNodeId === node.id" class="i-carbon-checkmark mr-8rpx text-42rpx" />
              <text>{{ node.name }}</text>
            </view>
          </view>
          <text v-else class="process-node-empty">该操作员暂无工序配置</text>
        </view>

        <!-- 窗帘图片 -->
        <view v-if="primaryOperator && activeCurtain" class="delivery-panel">
          <text class="delivery-panel-title">窗帘图片</text>
          <view class="curtain-image-row">
            <view class="curtain-image-cell">
              <view class="curtain-image-inner">
                <image
                  v-if="activeCurtain.image1"
                  :src="activeCurtain.image1"
                  class="curtain-image-item"
                  mode="aspectFit"
                  @tap="previewCurtainImage(activeCurtain.image1)"
                />
                <view v-else class="curtain-image-slot-empty">
                  <view class="i-carbon-image text-48rpx text-#ccc" />
                </view>
              </view>
            </view>
            <view class="curtain-image-cell">
              <view class="curtain-image-inner">
                <image
                  v-if="activeCurtain.image2"
                  :src="activeCurtain.image2"
                  class="curtain-image-item"
                  mode="aspectFit"
                  @tap="previewCurtainImage(activeCurtain.image2)"
                />
                <view v-else class="curtain-image-slot-empty">
                  <view class="i-carbon-image text-48rpx text-#ccc" />
                </view>
              </view>
            </view>
          </view>
        </view>

        <!-- 备注信息 -->
        <view
          v-if="primaryOperator && activeCurtain && (activeCurtain.note || selectedStructure?.structure.note)"
          class="delivery-panel"
        >
          <text class="delivery-panel-title">备注信息</text>
          <view class="curtain-notes-body">
            <view v-if="activeCurtain.note" class="curtain-note-item">
              <text class="curtain-note-label">窗帘备注</text>
              <text class="curtain-note-value">{{ activeCurtain.note }}</text>
            </view>
            <view v-if="selectedStructure?.structure.note" class="curtain-note-item">
              <text class="curtain-note-label">结构备注</text>
              <text class="curtain-note-value">{{ selectedStructure.structure.note }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>

  <wd-message-box />

  <!-- 已完成工序居中提示 -->
  <view v-if="showCompletedTip" class="completed-tip-overlay">
    <view class="completed-tip-box">
      <view class="i-carbon-checkmark-filled text-108rpx text-white" />
      <text class="completed-tip-text">已完成【{{ selectedNodeName }}】</text>
    </view>
  </view>

  <!-- 错误居中提示（错误工序 / 提交失败） -->
  <view v-if="showWrongNodeTip" class="completed-tip-overlay">
    <view class="wrong-node-tip-box">
      <view class="i-carbon-warning-filled text-108rpx text-white" />
      <text class="completed-tip-text">{{ errorTipMsg || '当前窗帘不需要执行该工序' }}</text>
    </view>
  </view>

  <!-- 操作员切换弹框 -->
  <wd-popup v-model="showPicker" position="center">
    <view class="picker-wrap">
      <view class="picker-header">
        <text class="text-45rpx text-#333 font-500">切换{{ pickerTarget === 'primary' ? '主' : '副' }}操作员</text>
        <view class="i-carbon-close text-54rpx text-#999" @tap="showPicker = false" />
      </view>
      <scroll-view scroll-y style="max-height: 50vh">
        <view
          v-for="user in userList"
          :key="user.id"
          class="picker-item"
          :class="{
            'picker-item--selected': user.id === currentSelectedId,
            'picker-item--disabled': user.id === disabledId,
          }"
          @tap="selectUser(user)"
        >
          <text>{{ user.name }}</text>
          <view v-if="user.id === currentSelectedId" class="i-carbon-checkmark text-48rpx text-[#018d71]" />
          <text v-else-if="user.id === disabledId" class="text-36rpx text-#ccc">已选为{{ pickerTarget === 'primary' ? '副' : '主' }}操作员</text>
        </view>
      </scroll-view>
    </view>
  </wd-popup>
</template>

<style lang="scss" scoped>
$font-scale: 1.5;

@function fs($size) {
  @return $size * $font-scale * 1rpx;
}

.page-body {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #f5f5f5;
}

.page-split {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: 20rpx;
  padding: 20rpx 24rpx 24rpx;
  overflow: hidden;
}

.page-left {
  flex: 2;
  min-width: 0;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  min-height: 0;
}

.page-left-scroll {
  flex: 1;
  min-height: 0;
  height: 0;
}

.page-left-inner {
  padding: 0 0 24rpx;
}

.page-right {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  padding: 4rpx 0 24rpx;
  height: 100%;
  overflow-y: auto;
  box-sizing: border-box;
}

.delivery-panel {
  background-color: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  flex-shrink: 0;
}

.delivery-panel-title {
  display: block;
  font-size: fs(32);
  color: #333;
  margin-bottom: 16rpx;
  font-weight: 600;
}

.delivery-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  padding: 32rpx 16rpx;
  background-color: #fafafa;
  border-radius: 12rpx;
  border: 2rpx dashed #e8e8e8;
}

.delivery-placeholder-text {
  font-size: fs(24);
  color: #bbb;
  text-align: center;
}

.operator-panel {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-shrink: 0;
  padding: 24rpx 28rpx;
  background-color: #fff;
  border-radius: 16rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
}

.operator-spacer {
  flex: 1;
}

.record-entry {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  padding: 0 8rpx;
  flex-shrink: 0;
}

.record-entry-label {
  font-size: fs(22);
}

.operator-item {
  display: flex;
  align-items: center;

  &.primary {
    gap: 18rpx;
  }

  &.secondary {
    gap: 12rpx;
    margin-left: 32rpx;
  }
}

.operator-avatar {
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  &.primary {
    width: 100rpx;
    height: 100rpx;
    background-color: #e8f4f0;
  }

  &.secondary {
    width: 66rpx;
    height: 66rpx;
    background-color: #f5f5f5;
  }
}

.operator-info {
  display: flex;
  flex-direction: column;
}

.operator-role {
  font-size: fs(22);
  color: #333;
  margin-bottom: 6rpx;

  &.secondary {
    font-size: fs(20);
    margin-bottom: 4rpx;
  }
}

.operator-name-row {
  display: flex;
  align-items: center;
  gap: 6rpx;
}

.operator-name {
  font-weight: 600;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;

  &.primary {
    font-size: fs(36);
    color: #018d71;
    max-width: 100%;
  }

  &.secondary {
    font-size: fs(28);
    color: #555;
    max-width: 100%;
  }
}

.process-node-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.process-node-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18rpx 20rpx;
  border-radius: 10rpx;
  border: 2rpx solid #ccc;
  background-color: #e0e0e0;
  font-size: fs(36);
  color: #666;
  font-weight: 500;
  flex: 1;
  min-width: calc(50% - 6rpx);
  box-sizing: border-box;

  &--active {
    background-color: #018d71;
    border-color: #018d71;
    color: #fff;
    font-weight: 600;
    box-shadow: 0 4rpx 12rpx rgba(1, 141, 113, 0.28);
  }
}

.process-node-empty {
  font-size: fs(30);
  color: #ccc;
}

.curtain-image-row {
  display: flex;
  gap: 12rpx;
}

.curtain-image-cell {
  flex: 1;
  width: 0;
  box-sizing: border-box;
}

.curtain-image-inner {
  position: relative;
  width: 100%;
  padding-bottom: 100%;
  border-radius: 12rpx;
  border: 1rpx solid #e8e8e8;
  background-color: #fafafa;
  overflow: hidden;
}

.curtain-image-item,
.curtain-image-slot-empty {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.curtain-image-slot-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #fafafa;
}

.curtain-notes-body {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.curtain-note-item {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 12rpx 16rpx;
  background-color: #fafafa;
  border-radius: 10rpx;
  border: 1rpx solid #e8e8e8;
}

.curtain-note-label {
  font-size: fs(32);
  color: #333;
  font-weight: 600;
}

.curtain-note-value {
  font-size: fs(32);
  color: #333;
  line-height: 1.5;
  word-break: break-all;
}

.order-input-wrap {
  flex-shrink: 0;
}

.order-input-box {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 0 28rpx;
  height: 88rpx;
  background-color: #fff;
  border-radius: 12rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}

.order-input {
  flex: 1;
  font-size: fs(30);
  color: #333;
}

.empty-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx 40rpx;
  min-height: 400rpx;
}

.delivery-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  padding: 16rpx 20rpx;
  border-radius: 12rpx;
  flex-shrink: 0;

  &--panel {
    padding: 28rpx 20rpx;
    gap: 12rpx;
  }

  &--overdue {
    background-color: #fff1f0;
    color: #f5222d;
  }

  &--today {
    background-color: #fff7e6;
    color: #d46b08;
  }

  &--soon {
    background-color: #fffbe6;
    color: #d4b106;
  }

  &--normal {
    background-color: #f6ffed;
    color: #389e0d;
  }
}

.delivery-badge-icon {
  font-size: fs(56);
}

.delivery-text {
  font-size: fs(32);
  font-weight: 600;
  text-align: center;
  line-height: 1.4;
}

.delivery-date {
  font-size: fs(24);
  opacity: 0.75;
  margin-top: 4rpx;
}

.fabric-warning {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60rpx 40rpx;
  background-color: #fffbe6;
  border: 1rpx solid #ffe58f;
  border-radius: 12rpx;
  margin-bottom: 20rpx;
}

.fabric-warning-text {
  margin-top: 16rpx;
  font-size: fs(28);
  color: #d46b08;
  text-align: center;
}

.curtain-card {
  background-color: #f5f5f5;
  border-radius: 12rpx;
  margin-bottom: 20rpx;
  overflow: hidden;
  border: 2rpx solid #e0e0e0;
}

.curtain-header {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 22rpx 32rpx;
  background-color: #e8e8e8;
  border-bottom: 1rpx solid #d5d5d5;
}

.curtain-index {
  font-size: fs(24);
  color: #018d71;
  font-weight: 600;
}

.curtain-name {
  font-size: fs(28);
  color: #333;
  font-weight: 700;
  flex: 1;
}

.curtain-room {
  font-size: fs(24);
  color: #333;
}

.structure-block {
  display: inline-flex;
  align-items: center;
  gap: 12rpx;
  padding: 8rpx 12rpx;
  border-radius: 8rpx;
  border: 2rpx solid #e0e0e0;
  background-color: #f5f5f5;

  &--active {
    background-color: #b8e0d4;
    border-color: #018d71;
  }

  &--selectable {
    &:active {
      background-color: #f5f5f5;
    }
  }
}

.structure-index-label {
  font-size: fs(36);
  color: #018d71;
  font-weight: 700;
  flex-shrink: 0;
}

.structure-name-label {
  font-size: fs(36);
  color: #333;
  font-weight: 600;
  min-width: 0;
  word-break: break-all;
}

.curtain-tabs-card {
  background-color: #fff;
  border-radius: 12rpx;
  margin-bottom: 20rpx;
  overflow: hidden;
  border: 2rpx solid #e0e0e0;
}

.curtain-tabs-scroll {
  width: 100%;
  white-space: nowrap;
}

.curtain-tabs {
  display: flex;
  background-color: #f5f5f5;
  border-bottom: 2rpx solid #e0e0e0;
}

.curtain-tab {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: 8rpx;
  padding: 18rpx 28rpx;
  border-bottom: 4rpx solid transparent;
  flex-shrink: 0;

  &--active {
    background-color: #018d71;
    border-bottom-color: #018d71;

    .curtain-tab-index {
      color: #fff;
      font-weight: 700;
    }

    .curtain-tab-room {
      color: #fff;
    }
  }
}

.curtain-tab-index {
  font-size: fs(28);
  color: #333;
  font-weight: 500;
}

.curtain-tab-room {
  font-size: fs(22);
  color: #999;
}

.curtain-tab-content {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx 24rpx;
  padding: 16rpx 32rpx 8rpx;
}

.curtain-tab-name {
  font-size: fs(26);
  color: #666;
  padding: 16rpx 32rpx 8rpx;
  font-weight: 600;
  border-bottom: 1rpx solid #f0f0f0;
}

.structure-detail-card {
  background-color: #fff;
  border-radius: 12rpx;
  margin-bottom: 20rpx;
  overflow: hidden;
  border: 2rpx solid #018d71;
}

.structure-detail-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 20rpx;
  padding: 20rpx 28rpx;
  background-color: #e8f4f0;
  border-bottom: 1rpx solid #c8e8df;
}

.structure-detail-title {
  font-size: fs(28);
  font-weight: 600;
  color: #018d71;
  flex-shrink: 0;
}

.structure-detail-subtitle {
  font-size: fs(28);
  color: #333;
  font-weight: 600;
  min-width: 0;
  word-break: break-all;
}

.structure-detail-body {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  padding: 12rpx;
  gap: 10rpx;
}

.structure-detail-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: 12rpx 10rpx;
  border: 2rpx solid #e0e0e0;
  border-radius: 8rpx;
  box-sizing: border-box;
  text-align: center;

  &--full {
    grid-column: 1 / -1;
  }
}

.structure-detail-label {
  font-size: fs(38);
  color: #1890ff;
  margin-bottom: 8rpx;
  font-weight: 500;
  text-align: center;
  width: 100%;
}

.structure-detail-value {
  font-size: fs(40);
  color: #333;
  font-weight: 600;
  word-break: break-all;
  text-align: center;
  width: 100%;
}

.structure-materials-section {
  border-top: 1rpx solid #c8e8df;
  padding: 20rpx 28rpx 24rpx;
  background-color: #fff;
}

.structure-materials-title {
  display: block;
  font-size: fs(28);
  font-weight: 600;
  color: #018d71;
  margin-bottom: 16rpx;
  text-align: center;
}

.structure-materials-empty {
  display: block;
  font-size: fs(26);
  color: #bbb;
  text-align: center;
  padding: 16rpx 0;
}

.material-detail-table {
  border: 2rpx solid #d4ebe4;
  border-radius: 8rpx;
  overflow: hidden;
}

.material-detail-header,
.material-detail-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 14rpx 20rpx;
}

.material-detail-header {
  background-color: #e8f4f0;
  border-bottom: 1rpx solid #d4ebe4;
}

.material-detail-item {
  background-color: #f5f9f7;

  &:not(:last-child) {
    border-bottom: 1rpx solid #e8f0ec;
  }
}

.material-detail-label,
.material-detail-value {
  flex: 1;
  min-width: 0;
  text-align: center;
}

.material-detail-label {
  font-size: fs(24);
  color: #666;
  font-weight: 600;
}

.material-detail-value {
  font-size: fs(30);
  color: #333;
  font-weight: 600;
  word-break: break-all;
}

.picker-wrap {
  width: 560rpx;
  padding: 32rpx 0 0;
  border-radius: 16rpx;
  overflow: hidden;
}

.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32rpx 24rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.completed-tip-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  pointer-events: none;
}

.completed-tip-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
  padding: 56rpx 80rpx;
  background-color: rgba(1, 141, 113, 0.92);
  border-radius: 24rpx;
  box-shadow: 0 8rpx 40rpx rgba(1, 141, 113, 0.4);
}

.wrong-node-tip-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
  padding: 56rpx 80rpx;
  background-color: rgba(245, 34, 45, 0.92);
  border-radius: 24rpx;
  box-shadow: 0 8rpx 40rpx rgba(245, 34, 45, 0.4);
}

.completed-tip-text {
  font-size: fs(44);
  font-weight: 700;
  color: #fff;
  letter-spacing: 4rpx;
}

.node-completed-tip {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10rpx;
  background-color: #f0faf7;
  border-color: #018d71;
}

.node-completed-text {
  font-size: fs(28);
  color: #018d71;
  font-weight: 600;
}

.picker-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx;
  font-size: fs(30);
  color: #333;

  &:first-child {
    margin-top: 16rpx;
  }

  &:last-child {
    margin-bottom: 16rpx;
  }

  &--selected {
    color: #018d71;
    background-color: #f0faf7;
  }

  &--disabled {
    color: #ccc;
  }
}

.complete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  margin-top: 24rpx;
  height: 96rpx;
  border-radius: 16rpx;
  background-color: #018d71;
  color: #fff;
  box-shadow: 0 4rpx 16rpx rgba(1, 141, 113, 0.35);

  &--disabled {
    background-color: #b2b2b2;
    box-shadow: none;
  }
}

.complete-btn-text {
  font-size: fs(34);
  font-weight: 700;
  color: #fff;
}
</style>
