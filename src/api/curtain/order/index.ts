import type { PageParam, PageResult } from '@/http/types'

/** 订单信息 */
export interface Order {
  id?: number
  order_no: string
  customer_name: string
  customer_id: number
  order_date: string
  types: string
  delivery_date: string
  status: number
  note?: string
  total: number
}

/** 模拟订单数据 */
const mockOrders: Order[] = [
  {
    id: 1,
    order_no: 'wqw890009883',
    customer_name: 'aoteman001',
    customer_id: 1212,
    order_date: '2026-09-01',
    types: 'chengpindan',
    delivery_date: '2026-09-20',
    status: 0,
    note: '时代即将开始的饭',
    total: 2,
  },
  {
    id: 2,
    order_no: 'WQW890009884',
    customer_name: '客户002',
    customer_id: 1213,
    order_date: '2026-09-02',
    types: 'standard',
    delivery_date: '2026-09-25',
    status: 1,
    note: '标准订单',
    total: 5,
  },
  {
    id: 3,
    order_no: 'WQW890009885',
    customer_name: '客户003',
    customer_id: 1214,
    order_date: '2026-09-03',
    types: 'custom',
    delivery_date: '2026-10-01',
    status: 0,
    note: '定制产品',
    total: 10,
  },
  {
    id: 4,
    order_no: 'WQW890009886',
    customer_name: '客户004',
    customer_id: 1215,
    order_date: '2026-09-04',
    types: 'chengpindan',
    delivery_date: '2026-09-30',
    status: 2,
    note: '已取消的订单',
    total: 3,
  },
  {
    id: 5,
    order_no: 'WQW890009887',
    customer_name: '客户005',
    customer_id: 1216,
    order_date: '2026-09-05',
    types: 'standard',
    delivery_date: '2026-10-05',
    status: 1,
    total: 8,
  },
  {
    id: 6,
    order_no: 'WQW890009888',
    customer_name: '客户006',
    customer_id: 1217,
    order_date: '2026-09-06',
    types: 'custom',
    delivery_date: '2026-10-10',
    status: 0,
    note: '紧急订单',
    total: 15,
  },
  {
    id: 7,
    order_no: 'WQW890009889',
    customer_name: '客户007',
    customer_id: 1218,
    order_date: '2026-09-07',
    types: 'chengpindan',
    delivery_date: '2026-09-28',
    status: 1,
    total: 4,
  },
  {
    id: 8,
    order_no: 'WQW890009890',
    customer_name: '客户008',
    customer_id: 1219,
    order_date: '2026-09-08',
    types: 'standard',
    delivery_date: '2026-10-08',
    status: 0,
    note: '批量订单',
    total: 20,
  },
]

/** 获取订单分页列表 */
// TODO: 接口实现后替换为：return http.get<PageResult<Order>>('/curtain/order/page', params)
export function getOrderPage(params: PageParam) {
  // 模拟数据实现，真实环境移除此代码
  return new Promise<PageResult<Order>>((resolve) => {
    setTimeout(() => {
      const { pageNo = 1, pageSize = 10, order_no, customer_name } = params as any

      // 搜索过滤
      let filtered = mockOrders
      if (order_no) {
        filtered = filtered.filter(item =>
          item.order_no.toLowerCase().includes(String(order_no).toLowerCase()),
        )
      }
      if (customer_name) {
        filtered = filtered.filter(item =>
          item.customer_name.toLowerCase().includes(String(customer_name).toLowerCase()),
        )
      }

      // 分页处理
      const start = (pageNo - 1) * pageSize
      const end = start + pageSize
      const list = filtered.slice(start, end)

      resolve({
        total: filtered.length,
        list,
      })
    }, 300)
  })
}

/** 获取订单详情 */
// TODO: 接口实现后替换为：return http.get<Order>(`/curtain/order/get?id=${id}`)
export function getOrder(id: number) {
  return new Promise<Order | null>((resolve) => {
    setTimeout(() => {
      const order = mockOrders.find(item => item.id === id)
      resolve(order || null)
    }, 200)
  })
}

/** 创建订单 */
// TODO: 接口实现后替换为：return http.post<number>('/curtain/order/create', data)
export function createOrder(data: Order) {
  return new Promise<number>((resolve) => {
    setTimeout(() => {
      const newId = Math.max(...mockOrders.map(o => o.id || 0)) + 1
      const newOrder = { ...data, id: newId }
      mockOrders.push(newOrder)
      resolve(newId)
    }, 200)
  })
}

/** 更新订单 */
// TODO: 接口实现后替换为：return http.put<boolean>('/curtain/order/update', data)
export function updateOrder(data: Order) {
  return new Promise<boolean>((resolve) => {
    setTimeout(() => {
      const index = mockOrders.findIndex(item => item.id === data.id)
      if (index > -1) {
        mockOrders[index] = data
        resolve(true)
      } else {
        resolve(false)
      }
    }, 200)
  })
}

/** 删除订单 */
// TODO: 接口实现后替换为：return http.delete<boolean>(`/curtain/order/delete?id=${id}`)
export function deleteOrder(id: number) {
  return new Promise<boolean>((resolve) => {
    setTimeout(() => {
      const index = mockOrders.findIndex(item => item.id === id)
      if (index > -1) {
        mockOrders.splice(index, 1)
        resolve(true)
      } else {
        resolve(false)
      }
    }, 200)
  })
}
