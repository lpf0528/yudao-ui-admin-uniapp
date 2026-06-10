# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**芋道管理后台 · 移动端** — 基于 [unibest](https://unibest.tech) 框架的 uni-app 跨平台移动端管理系统，对接芋道后端（Spring Boot / Spring Cloud）。当前正在此基础上二次开发**智仓-窗帘仓储系统**（`curtain` 模块）。

技术栈：Vue 3 + TypeScript + Vite 5 + UnoCSS + wot-design-uni + Pinia + z-paging

运行环境要求：Node >= 20，pnpm >= 9

---

## 常用命令

```bash
pnpm install          # 安装依赖
pnpm dev              # H5 开发模式（默认）
pnpm dev:mp           # 微信小程序开发模式
pnpm dev:app          # APP 开发模式
pnpm build            # H5 生产构建
pnpm build:mp         # 微信小程序构建
pnpm build:app        # APP 构建
pnpm lint             # ESLint 检查
pnpm lint:fix         # ESLint 自动修复
pnpm type-check       # TypeScript 类型检查
```

---

## 代码架构

### 分包结构（Vite subPackages）

约定式路由，文件即路由。主包和分包在 `vite.config.ts` 中配置：

| 目录 | 说明 |
|---|---|
| `src/pages/` | 主包页面（首页、审批、通讯录、消息、个人中心） |
| `src/pages-core/` | 核心分包（登录/注册/找回密码、用户设置、404 等） |
| `src/pages-system/` | 系统管理分包 |
| `src/pages-infra/` | 基础设施分包 |
| `src/pages-bpm/` | 工作流分包 |
| `src/pages-curtain/` | **窗帘仓储分包**（二次开发主战场） |

每个页面用 `definePage({ style: {...} })` 宏配置页面标题、导航栏样式等，框架自动写入 `pages.json`。

### HTTP 请求层

- `src/http/interceptor.ts` — 请求拦截器：自动拼接 `baseUrl`、注入 `Authorization` Bearer Token、租户 ID header、可选 AES 加密
- `src/http/http.ts` — 核心请求函数，暴露 `http.get/post/put/delete`；内置 401 处理（单 token 跳登录页 / 双 token 无感刷新）
- `src/http/types.ts` — 公共类型：`PageParam`、`PageResult<T>`、`IResponse<T>`、`LoadMoreState`

调用方式：

```typescript
import { httpGet, httpPost } from '@/http/http'
// 或
import { http } from '@/http/http'
http.get<MyType>('/curtain/order/page', params)
```

### API 接口层

`src/api/` 按业务模块分目录，每个文件导出接口函数和对应 TypeScript 类型。

窗帘模块已有接口文件：

| 文件 | 说明 |
|---|---|
| `src/api/curtain/order/index.ts` | 销售订单（分页、详情、裁剪、撤销裁剪） |
| `src/api/curtain/inventory-record/index.ts` | 库存变动记录（盘点创建、分页查询），操作类型：`PANDIAN/RUKU/CAIJIAN/CANCEL_CAIJIAN` |
| `src/api/curtain/product/index.ts` | 产品与批次（批次分页 `getProductBatchPage`） |
| `src/api/curtain/supplier/index.ts` | 供应商简单列表 `getSupplierSimpleList` |
| `src/api/curtain/warehouse/index.ts` | 仓库简单列表 `getWarehouseSimpleList` |
| `src/api/curtain/customer/index.ts` | 客户 |
| `src/api/curtain/workshop-user/index.ts` | 工车间用户 |

后端接口路径均以 `/zc/` 为前缀（如 `/zc/sales-order/app/page`、`/zc/inventory-record/page`）。未实现的接口在文件末尾以 `// TODO:` 注释标明，对接时直接取消注释并补全实现即可。

### 状态管理

`src/store/` 使用 Pinia，全部开启 `persist: true` 持久化：

| Store | 职责 |
|---|---|
| `token.ts` | 登录/登出/刷新 token，支持单/双 token 模式（由 `VITE_AUTH_MODE` 控制） |
| `user.ts` | 用户信息 |
| `dict.ts` | 字典缓存 |
| `theme.ts` | 主题配置 |

`tokenStore.hasLogin` 是判断登录状态的统一入口。

### 样式系统

- **优先用 UnoCSS 原子化类名**（配置见 `uno.config.ts`），减少 scoped 样式块
- 尺寸使用 `rpx`（如 `p-24rpx`、`text-32rpx`）适配多端
- 全局样式在 `src/style/`，主题变量在 `src/uni_modules/uni-scss/`

### 组件库

主要用 **wot-design-uni**（组件前缀 `wd-`），自动按需引入无需 import。分页场景用 `z-paging`，也可用 `wd-loadmore` + 手动触底。

### 打印插件（sunmi-printersdk）

> **触发规则**：当用户说"添加打印页面"或"实现打印功能"时，**必须先读取 `.claude/skills/print-label.md`**，按照其中的实现模式执行。



`src/uni_modules/sunmi-printersdk/` — 商米打印机 SDK，**仅 APP-PLUS 环境可用**，需用 `// #ifdef APP-PLUS` 条件编译包裹。

| API 类 | 适用场景 |
|---|---|
| `LineApi` | 小票/流水单，按行组版，支持事务模式批量打印 |
| `CanvasApi` | 标签/票据，按坐标精确定位文本/条码/二维码/图片 |
| `CommandApi` | 直接发送 ESC/POS 或 TSPL 原始指令 |

样式枚举（`Align`、`FontStyle`、`BaseStyleBuilder` 等）从 `@/uni_modules/sunmi-printersdk/utssdk/interface.uts` 引入。标签打印示例见 `src/pages-curtain/product-inbound/print-label/index.vue`（使用 `qrcode-generator` 生成二维码后通过 `LineApi` 打印）。

### 环境变量

存放于 `env/` 目录（不是根目录），Vite 通过 `envDir: './env'` 加载。关键变量：

| 变量 | 说明 |
|---|---|
| `VITE_SERVER_BASEURL` | 后端 API 地址 |
| `VITE_AUTH_MODE` | `single` 或 `double`（单/双 token） |
| `VITE_APP_TENANT_ENABLE` | 是否启用多租户 |
| `VITE_APP_PROXY_ENABLE` | H5 是否开启代理（其他端无效） |

---

## Vue SFC 规范

```vue
<script setup lang="ts">  <!-- 必须第一 -->
<template>               <!-- 必须第二 -->
<style lang="scss" scoped> <!-- 最后，优先用 UnoCSS 原子类可省略此块 -->
```

- 使用 `interface` 定义对象类型，`type` 定义联合类型
- 导入类型用 `import type`，避免 `any`
- 条件编译：`// #ifdef H5` / `// #ifndef H5` 处理多端差异
- 导航使用 `uni.navigateTo`；封装了 `navigateBackPlus`（`src/utils/index.ts`）

---

## 窗帘模块开发约定（智仓-窗帘仓储系统）

- 新页面放 `src/pages-curtain/<功能>/index.vue`，子页面放 `src/pages-curtain/<功能>/<子功能>/index.vue`
- API 接口放 `src/api/curtain/<功能>/index.ts`，未实现的接口以 `// TODO:` 注释标明，对接时取消注释并实现
- 分页列表遵循 `queryParams`（pageNo/pageSize）+ `filterParams`（筛选条件）双 ref 模式，见 `src/pages-curtain/order/index.vue`
- Tabbar 配置在 `src/tabbar/config.ts`，新增模块入口在此配置

### 已实现页面概览

| 页面路径 | 功能 |
|---|---|
| `src/pages-curtain/order/index.vue` | 销售订单列表 |
| `src/pages-curtain/order/detail/index.vue` | 销售订单详情（含用料明细、裁剪操作入口） |
| `src/pages-curtain/product-inbound/index.vue` | 产品入库 |
| `src/pages-curtain/product-inbound/inventory/index.vue` | 库存盘点（扫码/搜索批次，调用 `createInventoryRecord`） |
| `src/pages-curtain/product-inbound/print-label/index.vue` | 标签打印（生成二维码，通过商米 SDK 打印，APP 专属） |
| `src/pages-curtain/cutting-outbound/index.vue` | 裁剪出库（选批次 + 录入裁剪数量，调用 `cutMaterial` / `cancelCutMaterial`） |
| `src/pages-curtain/cutting-outbound/cutting-records/index.vue` | 裁剪记录（按批次查看库存变动历史） |
