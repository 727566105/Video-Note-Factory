import request from '@/utils/request.ts'

export const getDownloaderCookie = async (id: string) => {
  return await request.get('/get_downloader_cookie/' + id)
}

export const updateDownloaderCookie = async (data: { cookie: string; platform: string }) => {
  return await request.post('/update_downloader_cookie', data)
}

export const testDownloaderCookie = async (data: { platform: string; cookie: string }) => {
  return await request.post<{ valid: boolean; message: string; details?: string }>('/test_downloader_cookie', data)
}
