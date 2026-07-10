package com.videonote.android.di

import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import com.videonote.android.core.network.SessionManager
import com.videonote.android.core.network.interceptor.AuthInterceptor
import com.videonote.android.core.network.interceptor.BaseUrlInterceptor
import com.videonote.android.core.network.api.AuthApi
import com.videonote.android.core.network.api.NoteApi
import com.videonote.android.core.network.api.FeedApi
import com.videonote.android.core.network.api.CollectionApi
import com.videonote.android.core.network.api.ExportApi
import com.videonote.android.core.network.api.SubscriptionApi
import com.videonote.android.core.network.api.ConfigApi
import com.videonote.android.core.network.api.ModelApi
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    private val PLACEHOLDER_URL = "http://localhost:8483/"

    @Provides
    @Singleton
    fun provideJson(): Json = Json {
        ignoreUnknownKeys = true
        coerceInputValues = true
        explicitNulls = false
        encodeDefaults = true  // 序列化时包含有默认值的字段（后端需要 platform/quality 等必填字段）
    }

    @Provides
    @Singleton
    fun provideOkHttpClient(
        authInterceptor: AuthInterceptor,
        baseUrlInterceptor: BaseUrlInterceptor,
        json: Json
    ): OkHttpClient {
        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }
        return OkHttpClient.Builder()
            .addInterceptor(baseUrlInterceptor)
            .addInterceptor(authInterceptor)
            .addInterceptor(loggingInterceptor)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(client: OkHttpClient, json: Json): Retrofit {
        return Retrofit.Builder()
            .baseUrl(PLACEHOLDER_URL) // 实际 URL 由 BaseUrlInterceptor 动态替换
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
    }

    @Provides fun provideAuthApi(retrofit: Retrofit) = retrofit.create(AuthApi::class.java)
    @Provides fun provideNoteApi(retrofit: Retrofit) = retrofit.create(NoteApi::class.java)
    @Provides fun provideFeedApi(retrofit: Retrofit) = retrofit.create(FeedApi::class.java)
    @Provides fun provideCollectionApi(retrofit: Retrofit) = retrofit.create(CollectionApi::class.java)
    @Provides fun provideExportApi(retrofit: Retrofit) = retrofit.create(ExportApi::class.java)
    @Provides fun provideSubscriptionApi(retrofit: Retrofit) = retrofit.create(SubscriptionApi::class.java)
    @Provides fun provideConfigApi(retrofit: Retrofit) = retrofit.create(ConfigApi::class.java)
    @Provides fun provideModelApi(retrofit: Retrofit) = retrofit.create(ModelApi::class.java)
}
