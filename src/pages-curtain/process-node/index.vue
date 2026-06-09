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

const pos = reactive({ x: 0, y: 0 })
const isDragging = ref(false)
let startTouch = { x: 0, y: 0 }
let startPos = { x: 0, y: 0 }
let btnSize = 0

onMounted(() => {
  const info = uni.getSystemInfoSync()
  const ratio = info.windowWidth / 750
  btnSize = Math.round(100 * ratio)
  pos.x = info.windowWidth - btnSize - Math.round(32 * ratio)
  pos.y = info.windowHeight - Math.round(200 * ratio) - btnSize
})

const btnStyle = computed(() => ({ left: `${pos.x}px`, top: `${pos.y}px` }))

function onTouchStart(e: TouchEvent) {
  isDragging.value = false
  startTouch = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  startPos = { x: pos.x, y: pos.y }
}

function onTouchMove(e: TouchEvent) {
  isDragging.value = true
  const info = uni.getSystemInfoSync()
  const dx = e.touches[0].clientX - startTouch.x
  const dy = e.touches[0].clientY - startTouch.y
  pos.x = Math.max(0, Math.min(info.windowWidth - btnSize, startPos.x + dx))
  pos.y = Math.max(0, Math.min(info.windowHeight - btnSize, startPos.y + dy))
}

function onTouchEnd() {
  if (!isDragging.value)
    handleScanCode()
  isDragging.value = false
}

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

type DeliveryLevel = 'overdue' | 'today' | 'soon' | 'normal'

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
    if (!processId)
      return
    try {
      installProcess.value = await getInstallProcess(processId)
    } catch {
      // 获取失败时静默处理，不影响主流程
    }
  },
  { immediate: true },
)

// 扫码后安装工艺异步加载完成时：校验工序并提交
watch(installProcess, (newProcess) => {
  if (!newProcess || !selectedNodeId.value)
    return
  const ids = parseNodeIds(newProcess.nodeIds)
  if (!ids.includes(selectedNodeId.value)) {
    errorTipMsg.value = '当前窗帘不需要执行该工序'
    showWrongNodeTip.value = true
    setTimeout(() => { showWrongNodeTip.value = false }, 3000)
  } else {
    handleCompleteProcess()
  }
})

function selectNode(id: number) {
  selectedNodeId.value = selectedNodeId.value === id ? null : id
}

watch(() => primaryOperator.value?.id, () => {
  selectedNodeId.value = null
  if (processNodeList.value.length === 1) {
    selectedNodeId.value = processNodeList.value[0].id
  } else if (processNodeList.value.length > 1) {
    uni.showToast({ title: '请选择当前工序', icon: 'none', duration: 2000 })
  }
})

function selectStructure(id: number) {
  if (locateStructureId.value)
    return
  selectedStructureId.value = selectedStructureId.value === id ? null : id
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
  } catch {
    uni.showToast({ title: '未找到该订单', icon: 'none' })
  } finally {
    searching.value = false
  }
}

async function processBarcodeData(codeId: string) {
  try {
    const data = await getBarcodeRegistry(codeId)
    const content = JSON.parse(data.codeContent ?? '{}') as Record<string, any>
    if (content.orderNo) {
      orderNo.value = content.orderNo
      locateCurtainId.value = content.curtainId ? Number(content.curtainId) : null
      if (content.structureId) {
        locateStructureId.value = Number(content.structureId)
        selectedStructureId.value = Number(content.structureId)
      } else {
        locateStructureId.value = null
        selectedStructureId.value = null
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
      } else if (!selectedStructure.value?.structure.installProcessId) {
        // 该结构无安装工艺要求，直接提交
        handleCompleteProcess()
      } else if (installProcess.value) {
        // 同一结构重复扫码，installProcess 未变化，watch 不会再触发，直接校验
        const ids = parseNodeIds(installProcess.value.nodeIds)
        if (!ids.includes(selectedNodeId.value)) {
          errorTipMsg.value = '当前窗帘不需要执行该工序'
          showWrongNodeTip.value = true
          setTimeout(() => { showWrongNodeTip.value = false }, 3000)
        } else {
          handleCompleteProcess()
        }
      }
    } else {
      uni.showToast({ title: '该码暂不支持解析', icon: 'none' })
    }
  } catch {
    uni.showToast({ title: '码ID无效或已过期', icon: 'none' })
  }
}

async function handleSimulateScan() {
  let result: { value?: string }
  try {
    result = await message.prompt({
      title: '模拟扫码',
      msg: '请输入码ID（codeId）',
      inputPlaceholder: '请输入 UUID 格式的码ID',
    })
  } catch {
    return
  }
  const codeId = (result.value ?? '').trim()
  if (!codeId) {
    uni.showToast({ title: '请输入码ID', icon: 'none' })
    return
  }
  await processBarcodeData(codeId)
}

function handleScanCode() {
  // #ifndef H5
  uni.scanCode({
    onlyFromCamera: false,
    async success(res) {
      await processBarcodeData(res.result)
    },
    fail(err) {
      if (err.errMsg?.includes('cancel'))
        return
      uni.showToast({ title: '扫码失败，请重试', icon: 'none' })
    },
  })
  // #endif
  // #ifdef H5
  handleSimulateScan()
  // #endif
}

onLoad(async (query) => {
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
          placeholder=""
          placeholder-style="color:#bbb"
          confirm-type="search" disabled
          @confirm="handleOrderSearch"
        >
        <!-- <view
          v-if="orderNo"
          class="i-carbon-close-filled text-32rpx text-#ccc"
          @tap="orderNo = ''; orderDetail = null"
        /> -->
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

  <!-- 可拖动扫码悬浮按钮 -->
  <view
    class="fixed z-10 h-100rpx w-100rpx flex items-center justify-center rounded-full bg-[#018d71] shadow-lg"
    :style="btnStyle"
    @touchstart.stop="onTouchStart"
    @touchmove.stop.prevent="onTouchMove"
    @touchend.stop="onTouchEnd"
  >
    <view class="i-carbon-scan text-48rpx text-white" />
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
