import { useMemo } from 'react'
import { getPlatformFeatures, PLATFORM_FEATURES, type PlatformFeatures } from '@/config/platformFeatures'

export function usePlatformFeatures(platform: string): PlatformFeatures {
  return useMemo(() => getPlatformFeatures(platform), [platform])
}

export function canBatchFetch(platform: string): boolean {
  return PLATFORM_FEATURES[platform]?.batchFetch ?? false
}

export function canResumeFetch(platform: string): boolean {
  return PLATFORM_FEATURES[platform]?.resume ?? false
}

export function isPortraitPlatform(platform: string): boolean {
  return PLATFORM_FEATURES[platform]?.portraitVideo ?? false
}
