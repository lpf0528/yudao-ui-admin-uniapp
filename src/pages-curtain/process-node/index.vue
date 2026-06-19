<script setup lang="ts">
import type { InstallProcess } from '@/api/curtain/install-process/index'
import type { SalesOrderDetail } from '@/api/curtain/order'
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

let scanBuffer = ''
let scanTimer: ReturnType<typeof setTimeout> | null = null
let scannerListenerBound = false
let pendingScanCode = ''
let scannerListenerTarget: 'window' | 'document' | 'plus' | null = null

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

watch(
  () => selectedStructure.value?.structure.installProcessId,
  async (processId) => {
    installProcess.value = null
    scanContext.installProcess = null
    if (!processId)
      return
    try {
      installProcess.value = await getInstallProcess(processId)
      scanContext.installProcess = installProcess.value
    } catch {
      // 获取失败时静默处理，不影响主流程
    }
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

function canCommit(): boolean {
  if (!scanContext.orderDetail || !scanContext.structureId || !scanContext.nodeId)
    return false
  if (!scanContext.installProcess)
    return true
  const ids = parseNodeIds(scanContext.installProcess.nodeIds)
  return ids.includes(scanContext.nodeId)
}

async function ensureInstallProcessLoaded() {
  const processId = selectedStructure.value?.structure.installProcessId
  scanContext.installProcess = null
  installProcess.value = null
  if (!processId)
    return
  try {
    const process = await getInstallProcess(processId)
    installProcess.value = process
    scanContext.installProcess = process
  } catch {
    // 安装工艺加载失败时，按不可提交处理
  }
}

function showWrongNodeError(msg: string) {
  errorTipMsg.value = msg
  showWrongNodeTip.value = true
  setTimeout(() => { showWrongNodeTip.value = false }, 3000)
}

async function commitIfReady() {
  syncReadyState()
  await ensureInstallProcessLoaded()
  if (selectedStructure.value?.structure.installProcessId && !scanContext.installProcess) {
    showWrongNodeError('安装工艺加载失败，请重试扫码')
    return
  }
  if (!canCommit()) {
    showWrongNodeError('当前工序不允许执行')
    return
  }
  await handleCompleteProcess()
}

function selectNode(id: number) {
  selectedNodeId.value = selectedNodeId.value === id ? null : id
  scanContext.nodeId = selectedNodeId.value
  if (selectedNodeId.value)
    setNode(selectedNodeId.value)
}

watch(() => primaryOperator.value?.id, () => {
  selectedNodeId.value = null
  scanContext.nodeId = null
  if (processNodeList.value.length === 1) {
    selectedNodeId.value = processNodeList.value[0].id
    setNode(selectedNodeId.value)
  } else if (processNodeList.value.length > 1) {
    uni.showToast({ title: '请选择当前工序', icon: 'none', duration: 2000 })
  }
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
    errorTipMsg.value = e?.msg ?? e?.message ?? '提交失败，请重试'
    showWrongNodeTip.value = true
    setTimeout(() => { showWrongNodeTip.value = false }, 3000)
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
    uni.showToast({ title: '未找到该订单', icon: 'none' })
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
    await handleScanCode(val)
    return
  }
  await handleOrderSearch()
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

  if (scanning.value) {
    pendingScanCode = normalized
    console.warn('[scanner] 当前请求进行中，已排队等待下一次处理:', normalized)
    return
  }

  console.log('[scanner] 收到扫码内容:', normalized)
  scanning.value = true
  try {
    await processBarcodeData(normalized)
    console.log('[scanner] 扫码处理完成:', normalized)
  } catch (error) {
    console.error('[scanner] 扫码处理失败:', normalized, error)
    throw error
  } finally {
    scanning.value = false
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
  if (current.length >= SCAN_MIN_LENGTH)
    void handleScanCode(current)
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
  if (scannerListenerBound)
    return
  // 只绑定一个目标，避免同一事件双通道重复采集
  // #ifdef H5
  if (typeof window !== 'undefined') {
    window.addEventListener('keydown', handleGlobalKeydown, true)
    scannerListenerTarget = 'window'
  } else if (typeof document !== 'undefined') {
    document.addEventListener('keydown', handleGlobalKeydown, true)
    scannerListenerTarget = 'document'
  }
  // #endif
  // #ifdef APP-PLUS
  if (typeof plus !== 'undefined' && plus.key) {
    plus.key.addEventListener('keyup', handlePlusKeyup)
    scannerListenerTarget = 'plus'
  }
  // #endif
  scannerListenerBound = true
}

function unbindScannerListener() {
  if (!scannerListenerBound)
    return

  if (scannerListenerTarget === 'window' && typeof window !== 'undefined')
    window.removeEventListener('keydown', handleGlobalKeydown, true)
  else if (scannerListenerTarget === 'document' && typeof document !== 'undefined')
    document.removeEventListener('keydown', handleGlobalKeydown, true)
  // #ifdef APP-PLUS
  else if (scannerListenerTarget === 'plus' && typeof plus !== 'undefined' && plus.key)
    plus.key.removeEventListener('keyup', handlePlusKeyup)
  // #endif

  scannerListenerBound = false
  scannerListenerTarget = null
  pendingScanCode = ''
  resetScanBuffer()
}

async function processBarcodeData(codeId: string) {
  try {
    const data = await getBarcodeRegistry(codeId)
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
      uni.showToast({ title: '该码暂不支持解析', icon: 'none' })
    }
  } catch (error) {
    console.error('[scanner] 条码解析/请求失败:', codeId, error)
    uni.showToast({ title: '码ID无效或已过期', icon: 'none' })
  }
}

onLoad(async (query) => {
  bindScannerListener()
  ;[userList.value, processNodeList.value] = await Promise.all([
    getWorkshopUserSimpleList(),
    getMyProcessNodes(),
  ])
  // 初始化工序选择：仅一个工序时自动选中，多个时提醒用户选择
  if (processNodeList.value.length === 1) {
    selectedNodeId.value = processNodeList.value[0].id
  } else if (processNodeList.value.length > 1 && primaryOperator.value) {
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
    uni.showToast({ title: '主副操作员不能是同一人', icon: 'none' })
    return
  }
  if (pickerTarget.value === 'primary')
    operatorStore.setPrimary(user)
  else
    operatorStore.setSecondary(user)
  showPicker.value = false
}
</script>

<template>
  <view class="page-body">
    <!-- 左上角操作员 -->
    <view class="operator-panel">
      <view class="operator-item primary" @tap="openPicker('primary')">
        <view class="operator-avatar primary">
          <view class="i-carbon-user-avatar-filled text-64rpx text-[#018d71]" />
        </view>
        <view class="operator-info">
          <text class="operator-role">主操作员</text>
          <view class="operator-name-row">
            <text class="operator-name primary">{{ primaryOperator ? primaryOperator.name : '请选择' }}</text>
            <view class="i-carbon-chevron-down text-28rpx text-[#018d71]" />
          </view>
        </view>
      </view>
      <view class="operator-item secondary" @tap="openPicker('secondary')">
        <view class="operator-avatar secondary">
          <view class="i-carbon-user-avatar-filled text-42rpx text-[#666]" />
        </view>
        <view class="operator-info">
          <text class="operator-role secondary">副操作员</text>
          <view class="operator-name-row">
            <text class="operator-name secondary">{{ secondaryOperator ? secondaryOperator.name : '请选择' }}</text>
            <view class="i-carbon-chevron-down text-20rpx text-#999" />
            <view
              v-if="secondaryOperator"
              class="i-carbon-close-filled text-24rpx text-#ccc"
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
        <view class="i-carbon-list-boxes text-44rpx" :class="primaryOperator ? 'text-[#018d71]' : 'text-#ccc'" />
        <text class="record-entry-label" :class="primaryOperator ? 'text-[#018d71]' : 'text-#ccc'">操作记录</text>
      </view>
    </view>

    <!-- 工序节点选择 -->
    <view v-if="primaryOperator" class="process-node-wrap">
      <text class="process-node-label">当前工序</text>
      <view v-if="processNodeList.length" class="process-node-list">
        <view
          v-for="node in processNodeList"
          :key="node.id"
          class="process-node-chip"
          :class="{ 'process-node-chip--active': selectedNodeId === node.id }"
          @tap="selectNode(node.id)"
        >
          <view v-if="selectedNodeId === node.id" class="i-carbon-checkmark mr-8rpx text-22rpx" />
          <text>{{ node.name }}</text>
        </view>
      </view>
      <text v-else class="process-node-empty">该操作员暂无工序配置</text>
    </view>

    <!-- 订单号输入框 -->
    <view class="order-input-wrap">
      <view class="order-input-box">
        <view class="i-carbon-document text-32rpx text-#aaa" />
        <input
          v-model="orderNo"
          class="order-input"
          placeholder="扫码或输入订单号"
          placeholder-style="color:#bbb"
          confirm-type="search"
          @confirm="handleInputConfirm"
        >
        <view
          class="i-carbon-close-filled text-32rpx text-#ccc"
          @tap="orderNo = ''; orderDetail = null"
        />
      </view>
    </view>

    <!-- 搜索中 -->
    <view v-if="searching" class="empty-tip">
      <wd-loading color="#018d71" />
      <text class="mt-16rpx text-28rpx text-#999">查询中...</text>
    </view>

    <!-- 无结果 -->
    <view v-else-if="!orderDetail" class="empty-tip">
      <view class="i-carbon-document text-80rpx text-#ccc" />
      <text class="mt-16rpx text-28rpx text-#999">输入订单号后按回车查询</text>
    </view>

    <!-- 面料单提示 -->
    <view v-else-if="isFabricOnly" class="content-wrap">
      <view class="fabric-warning">
        <view class="i-carbon-warning text-48rpx text-[#fa8c16]" />
        <text class="fabric-warning-text">该订单为面料单，不需要进行工序操作</text>
      </view>
    </view>

    <!-- 订单详情 -->
    <view v-else class="content-wrap">
      <!-- 订单基本信息 -->
      <view class="order-card">
        <view class="order-card-body">
          <!-- 左：基本信息 -->
          <view class="order-card-left">
            <!-- <view class="order-card-row">
              <text class="order-card-label">订单号</text>
              <text class="order-card-value order-card-value--no font-600">{{ orderDetail.orderNo }}</text>
            </view> -->
            <view class="order-card-row">
              <text class="order-card-label">客户</text>
              <text class="order-card-value">{{ orderDetail.customerName }}</text>
            </view>
            <view class="order-card-row">
              <text class="order-card-label">交付日期</text>
              <text class="order-card-value">{{ orderDetail.deliveryDate || '-' }}</text>
            </view>
            <view v-if="orderDetail.isExpedited" class="expedited-tag">
              加急
            </view>
          </view>
          <!-- 交货提醒 -->
          <view v-if="deliveryStatus" class="delivery-badge" :class="`delivery-badge--${deliveryStatus.level}`">
            <view
              class="text-36rpx"
              :class="{
                'i-carbon-alarm': deliveryStatus.level === 'overdue',
                'i-carbon-warning-filled': deliveryStatus.level === 'today',
                'i-carbon-time': deliveryStatus.level === 'soon',
                'i-carbon-calendar': deliveryStatus.level === 'normal',
              }"
            />
            <text class="delivery-text">{{ deliveryStatus.text }}</text>
          </view>
        </view>
      </view>

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
            <view class="structure-row">
              <text class="structure-name-label">#{{ structureIndex + 1 }} {{ structure.structureName }}</text>
              <view class="material-tags">
                <view
                  v-for="mat in structure.materials"
                  :key="mat.id"
                  class="material-tag"
                >
                  <text class="mat-element">{{ mat.elementName }}</text>
                  <text class="mat-product">{{ mat.productName }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>

      <!-- 选中结构详情 -->
      <view v-if="selectedStructure" class="structure-detail-card">
        <view class="structure-detail-header">
          <text class="structure-detail-title">{{ selectedStructure.curtain.curtainName }} · {{ selectedStructure.structure.structureName }}</text>
          <text class="structure-detail-size">高×宽：{{ selectedStructure.structure.width }} × {{ selectedStructure.structure.height }}</text>
        </view>
        <view class="structure-detail-body">
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
          <view v-if="selectedStructure.structure.note" class="structure-detail-item structure-detail-item--full">
            <text class="structure-detail-label">备注</text>
            <text class="structure-detail-value">{{ selectedStructure.structure.note }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>

  <wd-message-box />

  <!-- 已完成工序居中提示 -->
  <view v-if="showCompletedTip" class="completed-tip-overlay">
    <view class="completed-tip-box">
      <view class="i-carbon-checkmark-filled text-72rpx text-white" />
      <text class="completed-tip-text">已完成【{{ selectedNodeName }}】</text>
    </view>
  </view>

  <!-- 错误居中提示（错误工序 / 提交失败） -->
  <view v-if="showWrongNodeTip" class="completed-tip-overlay">
    <view class="wrong-node-tip-box">
      <view class="i-carbon-warning-filled text-72rpx text-white" />
      <text class="completed-tip-text">{{ errorTipMsg || '当前窗帘不需要执行该工序' }}</text>
    </view>
  </view>

  <!-- 操作员切换弹框 -->
  <wd-popup v-model="showPicker" position="center">
    <view class="picker-wrap">
      <view class="picker-header">
        <text class="text-30rpx text-#333 font-500">切换{{ pickerTarget === 'primary' ? '主' : '副' }}操作员</text>
        <view class="i-carbon-close text-36rpx text-#999" @tap="showPicker = false" />
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
          <view v-if="user.id === currentSelectedId" class="i-carbon-checkmark text-32rpx text-[#018d71]" />
          <text v-else-if="user.id === disabledId" class="text-24rpx text-#ccc">已选为{{ pickerTarget === 'primary' ? '副' : '主' }}操作员</text>
        </view>
      </scroll-view>
    </view>
  </wd-popup>
</template>

<style lang="scss" scoped>
.page-body {
  min-height: 100vh;
  background-color: #f5f5f5;
}

.operator-panel {
  display: flex;
  align-items: center;
  margin: 24rpx 24rpx 0;
  padding: 28rpx 32rpx;
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
  font-size: 22rpx;
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
  font-size: 22rpx;
  color: #333;
  margin-bottom: 6rpx;

  &.secondary {
    font-size: 20rpx;
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
    font-size: 42rpx;
    color: #018d71;
    max-width: 200rpx;
  }

  &.secondary {
    font-size: 28rpx;
    color: #555;
    max-width: 140rpx;
  }
}

.process-node-wrap {
  margin: 16rpx 24rpx 0;
  padding: 20rpx 28rpx;
  background-color: #fff;
  border-radius: 16rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.process-node-label {
  font-size: 26rpx;
  color: #333;
}

.process-node-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.process-node-chip {
  display: flex;
  align-items: center;
  padding: 12rpx 24rpx;
  border-radius: 10rpx;
  border: 2rpx solid #ccc;
  background-color: #e0e0e0;
  font-size: 28rpx;
  color: #666;
  font-weight: 500;

  &--active {
    background-color: #018d71;
    border-color: #018d71;
    color: #fff;
    font-weight: 600;
    box-shadow: 0 4rpx 12rpx rgba(1, 141, 113, 0.28);
  }
}

.process-node-empty {
  font-size: 26rpx;
  color: #ccc;
}

.order-input-wrap {
  margin: 20rpx 24rpx 0;
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
  font-size: 30rpx;
  color: #333;
}

.empty-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding-top: 200rpx;
}

.content-wrap {
  padding: 24rpx;
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

.delivery-text {
  font-size: 28rpx;
  font-weight: 600;
  text-align: center;
  line-height: 1.4;
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
}

.fabric-warning-text {
  margin-top: 16rpx;
  font-size: 28rpx;
  color: #d46b08;
  text-align: center;
}

.order-card {
  background-color: #fff;
  border-radius: 12rpx;
  margin-bottom: 20rpx;
  overflow: hidden;
}

.order-card-body {
  display: flex;
  align-items: stretch;
}

.order-card-left {
  flex: 1;
  padding: 24rpx 28rpx;
  position: relative;
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx 0;
}

.order-card-divider {
  width: 2rpx;
  background-color: #d9d9d9;
  flex-shrink: 0;
}

.order-card-right {
  flex: 1;
  padding: 24rpx 20rpx;
  background-color: #fafafa;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.node-section-title {
  font-size: 22rpx;
  color: #333;
  margin-bottom: 4rpx;
}

.node-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.node-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14rpx 0;
  border-radius: 10rpx;
  border: 2rpx solid #ccc;
  background-color: #e0e0e0;
  font-size: 28rpx;
  color: #666;
  font-weight: 500;

  &--active {
    background-color: #018d71;
    border-color: #018d71;
    color: #fff;
    font-weight: 600;
    box-shadow: 0 4rpx 12rpx rgba(1, 141, 113, 0.25);
  }
}

.node-empty {
  font-size: 24rpx;
  color: #ccc;
  text-align: center;
}

.order-card-row {
  display: flex;
  flex-direction: column;
  padding: 6rpx 16rpx 6rpx 0;
  min-width: 160rpx;
}

.order-card-label {
  font-size: 22rpx;
  color: #999;
  margin-bottom: 4rpx;
}

.order-card-value {
  font-size: 28rpx;
  color: #333;
  font-weight: 500;

  &--no {
    font-size: 26rpx;
  }
}

.expedited-tag {
  position: absolute;
  top: 28rpx;
  right: 32rpx;
  padding: 4rpx 16rpx;
  background-color: #fff1f0;
  color: #f5222d;
  font-size: 22rpx;
  border-radius: 6rpx;
  border: 1rpx solid #ffa39e;
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
  font-size: 24rpx;
  color: #018d71;
  font-weight: 600;
}

.curtain-name {
  font-size: 28rpx;
  color: #333;
  font-weight: 700;
  flex: 1;
}

.curtain-room {
  font-size: 24rpx;
  color: #333;
}

.structure-block {
  padding: 16rpx 32rpx;
  border-bottom: 1rpx solid #f5f5f5;

  &:last-child {
    border-bottom: none;
  }

  &--active {
    .structure-row {
      border-color: #018d71;
      background-color: #b8e0d4;
    }
  }

  &--selectable {
    &:active {
      background-color: #f5f5f5;
    }
  }
}

.structure-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12rpx;
  border: 2rpx solid #e0e0e0;
  border-radius: 8rpx;
  padding: 12rpx 16rpx;
}

.structure-name-label {
  font-size: 26rpx;
  color: #333;
  font-weight: 600;
  flex-shrink: 0;
}

.material-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.material-tag {
  display: flex;
  align-items: center;
  border-radius: 6rpx;
  overflow: hidden;
  border: 2rpx solid #bbb;
}

.mat-element {
  font-size: 22rpx;
  color: #fff;
  background-color: #888;
  padding: 4rpx 10rpx;
}

.mat-product {
  font-size: 24rpx;
  color: #333;
  background-color: #f5f5f5;
  padding: 4rpx 12rpx;
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
  font-size: 28rpx;
  color: #333;
  font-weight: 500;
}

.curtain-tab-room {
  font-size: 22rpx;
  color: #999;
}

.curtain-tab-content {
  padding: 0 0 8rpx;
}

.curtain-tab-name {
  font-size: 26rpx;
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
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 28rpx;
  background-color: #e8f4f0;
  border-bottom: 1rpx solid #c8e8df;
}

.structure-detail-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #018d71;
}

.structure-detail-size {
  font-size: 26rpx;
  color: #333;
  flex-shrink: 0;
}

.structure-detail-body {
  display: flex;
  flex-wrap: wrap;
  padding: 16rpx;
  gap: 12rpx;
}

.structure-detail-item {
  display: flex;
  flex-direction: column;
  padding: 10rpx 16rpx;
  min-width: 160rpx;
  border: 2rpx solid #e0e0e0;
  border-radius: 8rpx;

  &--full {
    width: 100%;
  }
}

.structure-detail-label {
  font-size: 22rpx;
  color: #999;
  margin-bottom: 4rpx;
}

.structure-detail-value {
  font-size: 28rpx;
  color: #333;
  font-weight: 700;
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
  font-size: 44rpx;
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
  font-size: 28rpx;
  color: #018d71;
  font-weight: 600;
}

.picker-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 32rpx;
  font-size: 30rpx;
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
  font-size: 34rpx;
  font-weight: 700;
  color: #fff;
}
</style>
