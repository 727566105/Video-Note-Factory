import request from '@/utils/request'

export const systemCheck=async()=>{
  return await request.get('/health')
}

export const getHealth = async () => {
  return await request.get('/health')
}
