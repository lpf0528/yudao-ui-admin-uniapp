import { http } from '@/http/http'

export interface ProcessNodeSimple {
  id: number
  name: string
}

export function getProcessNodeSimpleList() {
  return http.get<ProcessNodeSimple[]>('/zc/process-node/simple-list')
}
