import path from 'node:path'
import process from 'node:process'
// manifest.config.ts
import { defineManifestConfig } from '@uni-helper/vite-plugin-uni-manifest'
import { loadEnv } from 'vite'

// 手动解析命令行参数获取 mode
function getMode() {
  const args = process.argv.slice(2)
  const modeFlagIndex = args.findIndex(arg => arg === '--mode')
  return modeFlagIndex !== -1 ? args[modeFlagIndex + 1] : args[0] === 'build' ? 'production' : 'development' // 默认 development
}
// 获取环境变量的范例
const env = loadEnv(getMode(), path.resolve(process.cwd(), 'env'))
const {
  VITE_APP_TITLE,
  VITE_UNI_APPID,
  VITE_WX_APPID,
  VITE_APP_PUBLIC_BASE,
  VITE_FALLBACK_LOCALE,
} = env
// console.log('manifest.config.ts env:', env)

export default defineManifestConfig({
  'name': VITE_APP_TITLE,
  'appid': VITE_UNI_APPID,
  'description': '',
  'versionName': '1.0.0',
  'versionCode': '100',
  'transformPx': false,
  /**
   * rpx 计算基准（横屏平板适配关键）：
   * App 全局锁定横屏，平板 windowWidth 很大（如 1280），默认 750rpx=屏宽 会把
   * 1rpx 撑到约 1.7px，导致字体/元素巨大。这里限制 rpx 计算基准：
   * - rpxCalcMaxDeviceWidth: 设备宽度超过该值(px)时，改用 baseDeviceWidth 作为换算基准
   * - rpxCalcBaseDeviceWidth: 换算基准宽度(px)。取 560 => 1rpx≈0.75px，
   *   图标/间距/文字整体等比缩小到平板横屏合适大小（远小于原来的“巨大”）。
   * 若整体仍偏大，调小 rpxCalcBaseDeviceWidth；仍偏小则调大。
   */
  'rpxCalcMaxDeviceWidth': 750,
  'rpxCalcBaseDeviceWidth': 560,
  'locale': VITE_FALLBACK_LOCALE, // 'zh-Hans'
  'h5': {
    router: {
      base: VITE_APP_PUBLIC_BASE,
    },
  },
  /* 5+App特有相关 */
  'app-plus': {
    usingComponents: true,
    nvueStyleCompiler: 'uni-app',
    compilerVersion: 3,
    compatible: {
      ignoreVersion: true,
    },
    /** 强制横屏（仅适配 Android 平板横屏模式） */
    screenOrientation: ['landscape-primary', 'landscape-secondary'],
    /** 来自 https://gitee.com/yudaocode/yudao-ui-admin-uniapp/issues/IEZGWJ 反馈 */
    safearea: {
      bottom: {
        offset: 'none',
      },
    },
    splashscreen: {
      alwaysShowBeforeRender: true,
      waiting: true,
      autoclose: true,
      delay: 0,
    },
    /* 模块配置 */
    modules: {},
    /* 应用发布信息 */
    distribute: {
      /* android打包配置 */
      android: {
        minSdkVersion: 21,
        targetSdkVersion: 30,
        abiFilters: ['armeabi-v7a', 'arm64-v8a'],
        /** 锁定横屏 */
        screenOrientation: ['landscape-primary', 'landscape-secondary'],
        permissions: [
          '<uses-permission android:name="android.permission.CHANGE_NETWORK_STATE"/>',
          '<uses-permission android:name="android.permission.MOUNT_UNMOUNT_FILESYSTEMS"/>',
          '<uses-permission android:name="android.permission.VIBRATE"/>',
          '<uses-permission android:name="android.permission.READ_LOGS"/>',
          '<uses-permission android:name="android.permission.ACCESS_WIFI_STATE"/>',
          '<uses-feature android:name="android.hardware.camera.autofocus"/>',
          '<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>',
          '<uses-permission android:name="android.permission.CAMERA"/>',
          '<uses-permission android:name="android.permission.GET_ACCOUNTS"/>',
          '<uses-permission android:name="android.permission.READ_PHONE_STATE"/>',
          '<uses-permission android:name="android.permission.CHANGE_WIFI_STATE"/>',
          '<uses-permission android:name="android.permission.WAKE_LOCK"/>',
          '<uses-permission android:name="android.permission.FLASHLIGHT"/>',
          '<uses-feature android:name="android.hardware.camera"/>',
          '<uses-permission android:name="android.permission.WRITE_SETTINGS"/>',
        ],
      },
      /* ios打包配置 */
      ios: {},
      /* SDK配置 */
      sdkConfigs: {},
      /* 图标配置 */
      icons: {
        android: {
          hdpi: 'static/app/icons/72x72.png',
          xhdpi: 'static/app/icons/96x96.png',
          xxhdpi: 'static/app/icons/144x144.png',
          xxxhdpi: 'static/app/icons/192x192.png',
        },
        ios: {
          appstore: 'static/app/icons/1024x1024.png',
          ipad: {
            'app': 'static/app/icons/76x76.png',
            'app@2x': 'static/app/icons/152x152.png',
            'notification': 'static/app/icons/20x20.png',
            'notification@2x': 'static/app/icons/40x40.png',
            'proapp@2x': 'static/app/icons/167x167.png',
            'settings': 'static/app/icons/29x29.png',
            'settings@2x': 'static/app/icons/58x58.png',
            'spotlight': 'static/app/icons/40x40.png',
            'spotlight@2x': 'static/app/icons/80x80.png',
          },
          iphone: {
            'app@2x': 'static/app/icons/120x120.png',
            'app@3x': 'static/app/icons/180x180.png',
            'notification@2x': 'static/app/icons/40x40.png',
            'notification@3x': 'static/app/icons/60x60.png',
            'settings@2x': 'static/app/icons/58x58.png',
            'settings@3x': 'static/app/icons/87x87.png',
            'spotlight@2x': 'static/app/icons/80x80.png',
            'spotlight@3x': 'static/app/icons/120x120.png',
          },
        },
      },
    },
  },
  /* 快应用特有相关 */
  'quickapp': {},
  /* 小程序特有相关 */
  'mp-weixin': {
    appid: VITE_WX_APPID,
    setting: {
      urlCheck: false,
      // 是否启用 ES6 转 ES5
      es6: true,
      minified: true,
    },
    optimization: {
      subPackages: true,
    },
    // 是否合并组件虚拟节点外层属性，uni-app 3.5.1+ 开始支持。目前仅支持 style、class 属性。
    // 默认不开启（undefined），这里设置为开启。
    mergeVirtualHostAttributes: true,
    // styleIsolation: 'shared',
    usingComponents: true,
    // __usePrivacyCheck__: true,
  },
  'mp-alipay': {
    usingComponents: true,
    styleIsolation: 'shared',
    optimization: {
      subPackages: true,
    },
    // 解决支付宝小程序开发工具报错 【globalThis is not defined】
    compileOptions: {
      globalObjectMode: 'enable',
      transpile: {
        script: {
          ignore: ['node_modules/**'],
        },
      },
    },
  },
  'mp-baidu': {
    usingComponents: true,
  },
  'mp-toutiao': {
    usingComponents: true,
  },
  'uniStatistics': {
    enable: false,
  },
  'vueVersion': '3',
})
