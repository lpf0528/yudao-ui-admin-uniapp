import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const h5AssetsDir = path.resolve('dist/build/h5/assets')

if (!fs.existsSync(h5AssetsDir)) {
  console.error('❌ 未找到 dist/build/h5/assets 目录，请先执行 pnpm build:h5')
  process.exit(1)
}

const jsFiles = fs.readdirSync(h5AssetsDir).filter(f => f.endsWith('.js'))
const indexJs = jsFiles.find(f => /^index-.*\.js$/.test(f) && !f.includes('pages'))

if (!indexJs) {
  console.error('❌ 未找到主包 index-*.js')
  process.exit(1)
}

let allContent = ''
for (const file of jsFiles) {
  allContent += fs.readFileSync(path.join(h5AssetsDir, file), 'utf8')
}

const mainContent = fs.readFileSync(path.join(h5AssetsDir, indexJs), 'utf8')
const checks = ['wd-input', 'wd-icon', 'wd-button', 'wd-input__inner']

console.log(`检查主包: ${indexJs}（共 ${jsFiles.length} 个 js 文件）`)
for (const key of checks) {
  const mainCount = (mainContent.match(new RegExp(key, 'g')) || []).length
  const allCount = (allContent.match(new RegExp(key, 'g')) || []).length
  console.log(`  ${key}: 主包 ${mainCount} / 全部 ${allCount}`)
}

const wdInputOk = allContent.includes('wd-input__inner')
if (!wdInputOk) {
  console.error('❌ 构建产物缺少 wot-design-uni 组件（wd-input），H5 登录页输入框将无法渲染')
  console.error('   请确认 vite.config.ts 中 Components + WotResolver 位于 Uni() 之前')
  process.exit(1)
}

console.log('✅ H5 组件打包检查通过')
