import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const h5Dir = path.resolve('dist/build/h5/assets')
const indexJs = fs.readdirSync(h5Dir).find(f => /^index-.*\.js$/.test(f) && !f.includes('pages'))

if (!indexJs) {
  console.error('❌ 未找到主包 index-*.js')
  process.exit(1)
}

const content = fs.readFileSync(path.join(h5Dir, indexJs), 'utf8')
const checks = ['wd-input', 'wd-icon', 'wd-button', 'wd-input__inner']

console.log(`检查文件: ${indexJs}`)
for (const key of checks) {
  const count = (content.match(new RegExp(key, 'g')) || []).length
  console.log(`  ${key}: ${count}`)
}

const wdInputOk = content.includes('wd-input__inner')
if (!wdInputOk) {
  console.error('❌ 主包缺少 wot-design-uni 组件（wd-input），H5 登录页输入框将无法渲染')
  process.exit(1)
}

console.log('✅ H5 主包组件检查通过')
