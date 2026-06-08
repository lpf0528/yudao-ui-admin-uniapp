import { http } from '@/http/http'

export interface ProcessNodeSimple {
  id: number
  name: string
}

export function getProcessNodeSimpleList() {
  return http.get<ProcessNodeSimple[]>('/zc/process-node/simple-list')
}

export function getMyProcessNodes() {
  return http.get<ProcessNodeSimple[]>('/zc/user-process-node/my-nodes')
}
