import { http } from '@/http/http'

export interface WorkshopUserSimple {
  id: number
  name: string
  nodeIds: number[]
}

export function getWorkshopUserSimpleList() {
  return http.get<WorkshopUserSimple[]>('/zc/workshop-user/simple-list')
}
