import { httpGet } from '@/http/http'

export interface InstallProcess {
  id: number
  name: string
  note: string
  nodeIds: number[] | string
  creator: string
  createTime: string
}

export function getInstallProcess(id: number) {
  return httpGet<InstallProcess>('/zc/curtain-install-process/get', { id })
}
