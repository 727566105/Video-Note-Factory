import request from '@/utils/request'

let saveTimer: ReturnType<typeof setTimeout> | null = null

export const fetchUserPreferences = async (): Promise<Record<string, any>> => {
  const res = await request.get('/user/preferences')
  return res || {}
}

export const saveUserPreferences = async (data: {
  summary?: Record<string, any>
  model?: Record<string, any>
}): Promise<void> => {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    try {
      await request.put('/user/preferences', data)
    } catch (e) {
    }
  }, 500)
}
