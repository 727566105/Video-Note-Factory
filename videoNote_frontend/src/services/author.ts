import request from '@/utils/request'

export interface AuthorInfo {
  author_id: string
  author_name: string
  video_count: number
}

export interface AuthorVideo {
  task_id: string
  video_id: string
  platform: string
  title: string | null
  cover_url: string | null
  duration: number | null
  status: string
  created_at: string | null
}

export const getAuthors = () =>
  request.get<AuthorInfo[]>('/authors')

export const getAuthorVideos = (authorId: string, limit = 50, offset = 0) =>
  request.get<{ videos: AuthorVideo[]; total: number }>(`/authors/${authorId}/videos`, { params: { limit, offset } })