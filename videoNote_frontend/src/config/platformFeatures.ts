export interface PlatformFeatures {
  pagination: boolean
  paginationType: 'page' | 'cursor'
  resume: boolean
  batchFetch: boolean
  defaultPageSize: number
  dynamicFeed: boolean
  videoDuration: boolean
  channelAvatar: boolean
  channelStats: boolean
  subscribersDisplay: boolean
  timeJump: boolean
  portraitVideo?: boolean
}

export const PLATFORM_FEATURES: Record<string, PlatformFeatures> = {
  bilibili: {
    pagination: true,
    paginationType: 'page',
    resume: true,
    batchFetch: true,
    defaultPageSize: 50,
    dynamicFeed: true,
    videoDuration: true,
    channelAvatar: true,
    channelStats: true,
    subscribersDisplay: true,
    timeJump: true,
  },
  cctv: {
    pagination: false,
    paginationType: 'page',
    resume: false,
    batchFetch: false,
    defaultPageSize: 30,
    dynamicFeed: false,
    videoDuration: true,
    channelAvatar: false,
    channelStats: false,
    subscribersDisplay: false,
    timeJump: true,
  },
  douyin: {
    pagination: true,
    paginationType: 'cursor',
    resume: true,
    batchFetch: true,
    defaultPageSize: 20,
    dynamicFeed: false,
    videoDuration: true,
    channelAvatar: true,
    channelStats: false,
    subscribersDisplay: false,
    timeJump: false,
    portraitVideo: true,
  },
  youtube: {
    pagination: false,
    paginationType: 'page',
    resume: false,
    batchFetch: false,
    defaultPageSize: 30,
    dynamicFeed: false,
    videoDuration: true,
    channelAvatar: true,
    channelStats: true,
    subscribersDisplay: false,
    timeJump: true,
  },
  kuaishou: {
    pagination: false,
    paginationType: 'page',
    resume: false,
    batchFetch: false,
    defaultPageSize: 30,
    dynamicFeed: false,
    videoDuration: true,
    channelAvatar: true,
    channelStats: false,
    subscribersDisplay: false,
    timeJump: false,
    portraitVideo: true,
  },
}

export function getPlatformFeatures(platform: string): PlatformFeatures {
  return PLATFORM_FEATURES[platform] || PLATFORM_FEATURES.bilibili
}
