package com.videonote.android.di

import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

/**
 * Coil ImageLoader 已通过 VideoNoteApp.newImageLoader() 提供（实现 ImageLoaderFactory）。
 *
 * 必须用 newImageLoader 而非 @Provides，因为 AsyncImage 默认用 LocalContext.imageLoader，
 * 它取的是 Application（实现 ImageLoaderFactory）的 newImageLoader()，不是 Hilt 注入的实例。
 *
 * 此 Module 保留为空，未来如需其他 DI 提供项可在此添加。
 */
@Module
@InstallIn(SingletonComponent::class)
object CoilModule
