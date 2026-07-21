import type { CustomRequestOptions } from '@/http/types'
import { httpGet } from '@/http/http'

export interface InstallProcess {
  id: number
  name: string
  note: string
  nodeIds: number[] | string
  creator: string
  createTime: string
}

export function getInstallProcess(id: number, options?: Partial<CustomRequestOptions>) {
  return httpGet<InstallProcess>('/zc/curtain-install-process/get', { id }, undefined, options)
}
