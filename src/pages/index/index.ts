import { useAccess } from '@/hooks/useAccess'

/**
 * 工作台菜单数据
 * 定义菜单分组和菜单项的数据结构
 */

/** 菜单项类型 */
export interface MenuItem {
  key: string // 菜单唯一标识
  name: string // 菜单名称
  icon: string // 菜单图标（支持 wot-design-uni 图标名或图片路径）
  url?: string // 跳转路径
  iconColor?: string // 图标颜色（可选）
  enabled?: boolean // 是否启用（可选，默认 true）
  permission?: string // 权限标识（可选）
}

/** 菜单分组类型 */
export interface MenuGroup {
  key: string // 分组唯一标识
  name: string // 分组名称
  menus: MenuItem[] // 分组下的菜单列表
}

/** 菜单分组原始数据 */
const menuGroupsData: MenuGroup[] = [
  {
    key: 'curtain',
    name: '窗帘管理',
    menus: [
      {
        key: 'order',
        name: '订单管理',
        icon: 'user',
        url: '/pages-curtain/order/index',
        iconColor: '#1890ff',
        permission: 'system:user:list',
      },
      {
        key: 'inbound',
        name: '产品入库',
        icon: 'add-circle',
        url: '/pages-curtain/product-inbound/index',
        iconColor: '#52c41a',
        permission: 'system:user:list',
      },
      {
        key: 'process_node',
        name: '工序操作',
        icon: 'user',
        url: '/pages-curtain/process-node/index',
        iconColor: '#1890ff',
        permission: 'system:user:list',
      },
      {
        key: 'crop',
        name: '入库管理',
        icon: 'user',
        url: '/pages-system/user/index',
        iconColor: '#1890ff',
        permission: 'system:user:list',
      },
    ],
  },
]

/**
 * 获取所有菜单分组数据（带权限过滤）：过滤掉没有权限的菜单项，如果整个分组都没有权限则不展示该分组
 */
export function getMenuGroups(): MenuGroup[] {
  const { hasAccessByCodes } = useAccess()
  return menuGroupsData
    .map(group => ({
      ...group,
      // 过滤掉没有权限的菜单项
      menus: group.menus.filter((menu) => {
        // 没有配置权限的菜单项默认展示
        if (!menu.permission) {
          return true
        }
        return hasAccessByCodes([menu.permission])
      }),
    }))
    // 过滤掉没有菜单项的分组
    .filter(group => group.menus.length > 0)
}

/** 获取所有菜单项（扁平化） */
export function getAllMenuItems(): MenuItem[] {
  const groups = getMenuGroups()
  return groups.flatMap(group => group.menus)
}

/** 根据 key 获取菜单项 */
export function getMenuItemByKey(key: string): MenuItem | undefined {
  return getAllMenuItems().find(item => item.key === key)
}
