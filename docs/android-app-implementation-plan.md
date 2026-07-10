# VideoNote Android App 实施计划

> 日期：2026-07-09
> 状态：待审核
> 分支：dev3.0
> 关联设计文档：`docs/android-app-design.md`

## 文档说明

本文档是 VideoNote Android App 的详细实施计划，覆盖从项目脚手架到集成测试的全部 10 个步骤。每个步骤拆分为 bite-sized 任务（1-2 小时可完成），包含精确文件路径、完整 Kotlin 代码片段、TDD 步骤和提交节点。

**编码约定**：
- 包名：`com.videonote.android`
- 语言：Kotlin 2.0+
- 最低 SDK：31（Android 12）
- 文档语言：中文，代码注释中文，代码英文

---

## 步骤 1：项目脚手架

### 任务 1.1：创建项目根目录与 Gradle 配置

**文件路径**：
- `videoNote_android/settings.gradle.kts`
- `videoNote_android/build.gradle.kts`
- `videoNote_android/gradle.properties`
- `videoNote_android/gradle/libs.versions.toml`

**`settings.gradle.kts`**：

```kotlin
pluginManagement {
    repositories {
        google { url = uri("https://maven.google.com") }
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://jitpack.io") }  // compose-markdown
    }
}

rootProject.name = "VideoNote"
include(":app")
include(":core:designsystem")
include(":core:network")
include(":core:common")
// 注：v1 不包含 :core:database（无离线缓存），后续版本如需可添加
include(":feature:auth")
include(":feature:home")
include(":feature:notelist")
include(":feature:notedetail")
include(":feature:feed")
include(":feature:settings")
```

**`gradle/libs.versions.toml`**（版本目录）：

```toml
[versions]
agp = "8.7.0"
kotlin = "2.0.21"
composeBom = "2024.12.01"
hilt = "2.52"
hiltNavigation = "1.2.0"
navigation = "2.8.4"
retrofit = "2.11.0"
okhttp = "4.12.0"
coil = "2.7.0"
datastore = "1.1.1"
exoplayer = "1.5.0"
serialization = "1.7.3"
serializationConverter = "1.0.0"
coroutines = "1.9.0"
lifecycle = "2.8.7"

[libraries]
compose-bom = { group = "androidx.compose", name = "compose-bom", version.ref = "composeBom" }
compose-ui = { group = "androidx.compose.ui", name = "ui" }
compose-material3 = { group = "androidx.compose.material3", name = "material3" }
compose-ui-tooling = { group = "androidx.compose.ui", name = "ui-tooling" }
compose-icons = { group = "androidx.compose.material", name = "material-icons-extended" }

navigation-compose = { group = "androidx.navigation", name = "navigation-compose", version.ref = "navigation" }

hilt-android = { group = "com.google.dagger", name = "hilt-android", version.ref = "hilt" }
hilt-compiler = { group = "com.google.dagger", name = "hilt-android-compiler", version.ref = "hilt" }
hilt-navigation-compose = { group = "androidx.hilt", name = "hilt-navigation-compose", version.ref = "hiltNavigation" }

retrofit = { group = "com.squareup.retrofit2", name = "retrofit", version.ref = "retrofit" }
retrofit-serialization = { group = "com.jakewharton.retrofit", name = "retrofit2-kotlinx-serialization-converter", version.ref = "serializationConverter" }
okhttp = { group = "com.squareup.okhttp3", name = "okhttp", version.ref = "okhttp" }
okhttp-logging = { group = "com.squareup.okhttp3", name = "logging-interceptor", version.ref = "okhttp" }

# 注：v1 不使用 Room

coil-compose = { group = "io.coil-kt", name = "coil-compose", version.ref = "coil" }

# 注：v1 不使用 Room（无离线缓存），后续版本如需可添加

datastore = { group = "androidx.datastore", name = "datastore-preferences", version.ref = "datastore" }
datastore-security = { group = "androidx.security", name = "security-crypto", version = "1.1.0-alpha06" }

exoplayer = { group = "androidx.media3", name = "media3-exoplayer", version.ref = "exoplayer" }
exoplayer-ui = { group = "androidx.media3", name = "media3-ui", version.ref = "exoplayer" }

# Markdown 渲染
compose-markdown = { group = "com.github.jeziellago", name = "compose-markdown", version = "0.5.4" }

serialization-json = { group = "org.jetbrains.kotlinx", name = "kotlinx-serialization-json", version.ref = "serialization" }
coroutines = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-android", version.ref = "coroutines" }

lifecycle-runtime = { group = "androidx.lifecycle", name = "lifecycle-runtime-compose", version.ref = "lifecycle" }
lifecycle-viewmodel = { group = "androidx.lifecycle", name = "lifecycle-viewmodel-compose", version.ref = "lifecycle" }

[plugins]
android-application = { id = "com.android.application", version.ref = "agp" }
android-library = { id = "com.android.library", version.ref = "agp" }
kotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }
kotlin-compose = { id = "org.jetbrains.kotlin.plugin.compose", version.ref = "kotlin" }
kotlin-serialization = { id = "org.jetbrains.kotlin.plugin.serialization", version.ref = "kotlin" }
hilt = { id = "com.google.dagger.hilt.android", version.ref = "hilt" }
ksp = { id = "com.google.devtools.ksp", version = "2.0.21-1.0.28" }
```

**`build.gradle.kts`**（根项目）：

```kotlin
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.android.library) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.hilt) apply false
    alias(libs.plugins.ksp) apply false
}
```

**`gradle.properties`**：

```properties
org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
kotlin.code.style=official
android.nonTransitiveRClass=true
org.gradle.parallel=true
org.gradle.caching=true
```

### 任务 1.2：app 模块 Gradle 配置

**文件路径**：`videoNote_android/app/build.gradle.kts`

```kotlin
plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.hilt)
    alias(libs.plugins.ksp)
}

android {
    namespace = "com.videonote.android"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.videonote.android"
        minSdk = 31
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation(project(":core:designsystem"))
    implementation(project(":core:network"))
    implementation(project(":core:common"))
    // 注：v1 不依赖 :core:database
    implementation(project(":feature:auth"))
    implementation(project(":feature:home"))
    implementation(project(":feature:notelist"))
    implementation(project(":feature:notedetail"))
    implementation(project(":feature:feed"))
    implementation(project(":feature:settings"))

    implementation(platform(libs.compose.bom))
    implementation(libs.compose.ui)
    implementation(libs.compose.material3)
    implementation(libs.compose.ui.tooling)
    implementation(libs.compose.icons)
    implementation(libs.navigation.compose)
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
    implementation(libs.hilt.navigation.compose)
    implementation(libs.lifecycle.runtime)
    implementation(libs.coil.compose)
}
```

### 任务 1.3：core 与 feature 模块 Gradle 配置

每个 core/feature 模块需要 `build.gradle.kts`。以 `core/network` 为例：

**文件路径**：`videoNote_android/core/network/build.gradle.kts`

```kotlin
plugins {
    alias(libs.plugins.android.library)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.serialization)
    alias(libs.plugins.hilt)
    alias(libs.plugins.ksp)
}

android {
    namespace = "com.videonote.android.core.network"
    compileSdk = 35
    defaultConfig { minSdk = 31 }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    implementation(project(":core:common"))
    implementation(libs.retrofit)
    implementation(libs.retrofit.serialization)
    implementation(libs.okhttp)
    implementation(libs.okhttp.logging)
    implementation(libs.serialization.json)
    implementation(libs.coroutines)
    implementation(libs.hilt.android)
    ksp(libs.hilt.compiler)
}
```

> 其余模块（core/designsystem、core/common、feature/*）结构类似，按依赖表配置。每个模块的 `namespace` 为 `com.videonote.android.<模块名>`。
> 注：v1 不包含 core/database 模块（无离线缓存需求）。

### 任务 1.4：Application 类与 AndroidManifest

**文件路径**：`videoNote_android/app/src/main/java/com/videonote/android/VideoNoteApp.kt`

```kotlin
package com.videonote.android

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class VideoNoteApp : Application()
```

**文件路径**：`videoNote_android/app/src/main/AndroidManifest.xml`

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <!-- 剪贴板读取：Android 12+ 无需特殊权限，系统会在读取时提示用户 -->

    <application
        android:name=".VideoNoteApp"
        android:label="VideoNote"
        android:icon="@mipmap/ic_launcher"
        android:theme="@style/Theme.VideoNote"
        android:usesCleartextTraffic="true">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:windowSoftInputMode="adjustResize">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>
    </application>
</manifest>
```

> 注意：`usesCleartextTraffic="true"` 是因为用户服务器地址可能是 `http://192.168.x.x`（局域网非 HTTPS）。

### 任务 1.5：MainActivity

**文件路径**：`videoNote_android/app/src/main/java/com/videonote/android/MainActivity.kt`

```kotlin
package com.videonote.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.videonote.android.navigation.AppNavHost
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            AppNavHost()
        }
    }
}
```

### ✅ 提交节点 1

```bash
git add videoNote_android/
git commit -m "feat(android): 项目脚手架 - Gradle 多模块 + Hilt + Compose 配置"
```

---

## 步骤 2：core/network 网络层

### 任务 2.1：统一响应包装类与错误处理

**文件路径**：`videoNote_android/core/network/src/main/java/com/videonote/android/core/network/dto/ApiResponse.kt`

```kotlin
package com.videonote.android.core.network.dto

import kotlinx.serialization.Serializable

/**
 * 后端统一响应格式 {code, msg, data}
 * code == 0 表示成功
 */
@Serializable
data class ApiResponse<T>(
    val code: Int,
    val msg: String,
    val data: T? = null
)

/**
 * HTTP 错误响应格式 {detail: "..."}
 */
@Serializable
data class ErrorResponse(
    val detail: String? = null
)

/**
 * 业务异常：code != 0
 */
class ApiException(val code: Int, override val message: String) : Exception(message)

/**
 * HTTP 异常：4xx/5xx
 */
class HttpException(val statusCode: Int, val detail: String) : Exception(detail)
```

**TDD**：写 `ApiResponseTest`，验证：
1. `code=0` 时 `isSuccess()` 返回 true
2. `code!=0` 时抛出 `ApiException`
3. HTTP 4xx 响应解析出 `detail` 字段

### 任务 2.2：JWT Interceptor + 动态 BaseUrl Interceptor

**文件路径**：`videoNote_android/core/network/src/main/java/com/videonote/android/core/network/interceptor/AuthInterceptor.kt`

```kotlin
package com.videonote.android.core.network.interceptor

import com.videonote.android.core.network.SessionManager
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

/**
 * JWT 认证拦截器：自动注入 Authorization header
 * 401 响应时清除 token（由上层处理跳转登录页）
 */
@Singleton
class AuthInterceptor @Inject constructor(
    private val sessionManager: SessionManager
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val token = sessionManager.token
        val authedRequest = if (token != null && request.header("Authorization") == null) {
            request.newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
        } else {
            request
        }
        val response = chain.proceed(authedRequest)
        if (response.code == 401) {
            sessionManager.clearToken()
        }
        return response
    }
}
```

**文件路径**：`videoNote_android/core/network/src/main/java/com/videonote/android/core/network/interceptor/BaseUrlInterceptor.kt`

```kotlin
package com.videonote.android.core.network.interceptor

import com.videonote.android.core.network.SessionManager
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.Interceptor
import okhttp3.Response
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 动态 BaseUrl 拦截器：从 SessionManager 读取用户配置的服务器地址
 * 服务器地址示例：http://192.168.1.100:8483
 */
@Singleton
class BaseUrlInterceptor @Inject constructor(
    private val sessionManager: SessionManager
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()
        val serverUrl = sessionManager.serverUrl ?: return chain.proceed(originalRequest)

        val newUrl = originalRequest.url.newBuilder()
            .scheme(serverUrl.toHttpUrl().scheme)
            .host(serverUrl.toHttpUrl().host)
            .port(serverUrl.toHttpUrl().port)
            .build()

        val newRequest = originalRequest.newBuilder()
            .url(newUrl)
            .build()
        return chain.proceed(newRequest)
    }
}
```

**文件路径**：`videoNote_android/core/network/src/main/java/com/videonote/android/core/network/SessionManager.kt`

```kotlin
package com.videonote.android.core.network

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 会话管理器：内存中保存 token 和服务器地址
 * 实际持久化在 core/common 的 EncryptedDataStore 中
 * 由 SessionRepository 在启动时注入
 */
@Singleton
class SessionManager @Inject constructor() {
    private val _token = MutableStateFlow<String?>(null)
    val token: StateFlow<String?> = _token

    private val _serverUrl = MutableStateFlow<String?>(null)
    val serverUrl: StateFlow<String?> = _serverUrl

    fun setToken(token: String?) { _token.value = token }
    fun setServerUrl(url: String?) { _serverUrl.value = url }
    fun clearToken() { _token.value = null }
}
```

### 任务 2.3：Retrofit 配置与 Hilt NetworkModule

**文件路径**：`videoNote_android/app/src/main/java/com/videonote/android/di/NetworkModule.kt`

```kotlin
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
```

### 任务 2.4：API 接口定义 - Auth + Note

**文件路径**：`videoNote_android/core/network/src/main/java/com/videonote/android/core/network/api/AuthApi.kt`

```kotlin
package com.videonote.android.core.network.api

import com.videonote.android.core.network.dto.ApiResponse
import com.videonote.android.core.network.dto.LoginRequest
import com.videonote.android.core.network.dto.LoginResponse
import com.videonote.android.core.network.dto.UserDto
import com.videonote.android.core.network.dto.ChangePasswordRequest
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT

interface AuthApi {

    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): ApiResponse<LoginResponse>

    @GET("api/auth/me")
    suspend fun getMe(): ApiResponse<UserDto>

    @PUT("api/auth/change-password")
    suspend fun changePassword(@Body request: ChangePasswordRequest): ApiResponse<Unit>
}
```

**文件路径**：`videoNote_android/core/network/src/main/java/com/videonote/android/core/network/dto/AuthDtos.kt`

```kotlin
package com.videonote.android.core.network.dto

import kotlinx.serialization.Serializable

@Serializable
data class LoginRequest(
    val username: String,
    val password: String
)

@Serializable
data class LoginResponse(
    val access_token: String,
    val token_type: String = "bearer",
    val user: UserDto? = null
)

@Serializable
data class UserDto(
    val id: Int,
    val username: String,
    val role: String = "user",
    val avatar: String? = null
)

@Serializable
data class ChangePasswordRequest(
    val old_password: String,
    val new_password: String
)
```

**文件路径**：`videoNote_android/core/network/src/main/java/com/videonote/android/core/network/api/NoteApi.kt`

```kotlin
package com.videonote.android.core.network.api

import com.videonote.android.core.network.dto.ApiResponse
import com.videonote.android.core.network.dto.GenerateNoteRequest
import com.videonote.android.core.network.dto.GenerateNoteResponse
import com.videonote.android.core.network.dto.TaskStatusResponse
import com.videonote.android.core.network.dto.TaskListResponse
import com.videonote.android.core.network.dto.QuickViewResponse
import com.videonote.android.core.network.dto.CheckNoteRequest
import com.videonote.android.core.network.dto.CheckNoteResponse
import com.videonote.android.core.network.dto.TagsRequest
import okhttp3.MultipartBody
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query

interface NoteApi {

    @POST("api/generate_note")
    suspend fun generateNote(@Body request: GenerateNoteRequest): ApiResponse<GenerateNoteResponse>

    @GET("api/task_status/{taskId}")
    suspend fun getTaskStatus(@Path("taskId") taskId: String): ApiResponse<TaskStatusResponse>

    @GET("api/tasks")
    suspend fun getTasks(
        @Query("page") page: Int = 1,
        @Query("page_size") pageSize: Int = 20,
        @Query("platform") platform: String? = null,
        @Query("search") search: String? = null
    ): ApiResponse<TaskListResponse>

    @GET("api/quick_view/{taskId}")
    suspend fun getQuickView(@Path("taskId") taskId: String): ApiResponse<QuickViewResponse>

    @POST("api/check_note_availability")
    suspend fun checkNoteAvailability(@Body request: CheckNoteRequest): ApiResponse<CheckNoteResponse>

    @Multipart
    @POST("api/upload")
    suspend fun uploadFile(@Part file: MultipartBody.Part): ApiResponse<UploadResponse>

    @POST("api/cancel_task")
    suspend fun cancelTask(@Body request: TaskIdRequest): ApiResponse<Unit>

    @POST("api/delete_task")
    suspend fun deleteTask(@Body request: TaskIdRequest): ApiResponse<Unit>

    @PUT("api/notes/{taskId}/tags")
    suspend fun updateTags(
        @Path("taskId") taskId: String,
        @Body request: TagsRequest
    ): ApiResponse<Unit>

    @GET("api/image_proxy")
    suspend fun getImageProxy(@Query("url") url: String): okhttp3.ResponseBody
}
```

**DTO 文件**：`videoNote_android/core/network/src/main/java/com/videonote/android/core/network/dto/NoteDtos.kt`

```kotlin
package com.videonote.android.core.network.dto

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

@Serializable
data class GenerateNoteRequest(
    val video_url: String? = null,
    val platform: String = "bilibili",
    val smart_mode: Boolean = true,
    val model_name: String? = null,
    val provider_id: Int? = null,
    val style: String = "detailed",
    val output_language: String = "zh",
    val format: String = "screenshot",
    val screenshot: Boolean = true,
    val link: Boolean = false,
    val file_path: String? = null
)

@Serializable
data class GenerateNoteResponse(
    val task_id: String,
    val status: String = "PENDING",
    val reused: Boolean = false,
    val reuse_type: String? = null,
    val message: String? = null
)

@Serializable
data class TaskStatusResponse(
    val task_id: String,
    val status: String,
    val progress: Int = 0,
    val step: String? = null,
    val error: String? = null,
    val result: TaskResult? = null
)

@Serializable
data class TaskResult(
    val versions: List<NoteVersion> = emptyList(),
    /**
     * tags 是 JSON 字符串（后端 task_status 返回格式）。
     * 使用时需解码：Json.decodeFromString<List<String>>(tags)
     * 注意：quick_view/{id} 返回的 QuickViewResponse.tags 直接是 List<String>，
     * 这是两个不同的 API，格式不同，此处仅 task_status 用字符串。
     */
    val tags: String? = null
)

/**
 * 解码 task_status 中的 tags JSON 字符串为 List
 */
fun TaskResult.decodeTags(json: Json = Json): List<String> {
    return tags?.let {
        try { json.decodeFromString<List<String>>(it) } catch (_: Exception) { emptyList() }
    } ?: emptyList()
}

@Serializable
data class NoteVersion(
    val version: String,
    val timestamp: String? = null
)

@Serializable
data class TaskListResponse(
    val tasks: List<TaskItem> = emptyList(),
    val total: Int = 0,
    val page: Int = 1,
    val page_size: Int = 20
)

@Serializable
data class TaskItem(
    val task_id: String,
    val title: String,
    val author: String = "",
    val platform: String = "",
    val cover_url: String? = null,
    val created_at: String = "",
    val status: String = "SUCCESS",
    val duration: String? = null,
    val has_note: Boolean = true
)

@Serializable
data class QuickViewResponse(
    val task_id: String,
    val title: String,
    val author: String = "",
    val platform: String = "",
    val cover_url: String? = null,
    val video_url: String? = null,
    val duration: String? = null,
    val created_at: String = "",
    val summary: String? = null,
    val subtitles: String? = null,
    val raw_article: String? = null,
    val outline: String? = null,
    val screenshots: List<String> = emptyList(),
    val tags: List<String> = emptyList(),
    val author_id: String? = null,
    val subscribed: Boolean = false
)

@Serializable
data class CheckNoteRequest(
    val video_url: String,
    val platform: String
)

@Serializable
data class CheckNoteResponse(
    val exists: Boolean = false,
    val task_id: String? = null
)

@Serializable
data class UploadResponse(
    val file_path: String,
    val file_name: String? = null
)

@Serializable
data class TaskIdRequest(
    val task_id: String
)

@Serializable
data class TagsRequest(
    val tags: List<String>
)
```

### 任务 2.5：API 接口定义 - Feed + Collection + Export + Subscription + Config + Model

**文件路径**：`videoNote_android/core/network/src/main/java/com/videonote/android/core/network/api/FeedApi.kt`

```kotlin
package com.videonote.android.core.network.api

import com.videonote.android.core.network.dto.ApiResponse
import com.videonote.android.core.network.dto.FeedListResponse
import com.videonote.android.core.network.dto.UnreadCountResponse
import com.videonote.android.core.network.dto.GenerateNoteResponse
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

interface FeedApi {

    @GET("api/feed")
    suspend fun getFeed(
        @Query("page") page: Int = 1,
        @Query("page_size") pageSize: Int = 20,
        @Query("unread_only") unreadOnly: Boolean = false
    ): ApiResponse<FeedListResponse>

    @PUT("api/feed/{itemId}/read")
    suspend fun markRead(@Path("itemId") itemId: String): ApiResponse<Unit>

    @PUT("api/feed/read-all")
    suspend fun markAllRead(): ApiResponse<Unit>

    @POST("api/feed/refresh")
    suspend fun refresh(): ApiResponse<Unit>

    @GET("api/feed/unread-count")
    suspend fun getUnreadCount(): ApiResponse<UnreadCountResponse>

    @POST("api/feed/{itemId}/generate-note")
    suspend fun generateNoteFromFeed(
        @Path("itemId") itemId: String,
        @Query("smart_mode") smartMode: Boolean = true
    ): ApiResponse<GenerateNoteResponse>
}
```

**文件路径**：`videoNote_android/core/network/src/main/java/com/videonote/android/core/network/dto/FeedDtos.kt`

```kotlin
package com.videonote.android.core.network.dto

import kotlinx.serialization.Serializable

@Serializable
data class FeedListResponse(
    val items: List<FeedItem> = emptyList(),
    val total: Int = 0,
    val page: Int = 1,
    val page_size: Int = 20
)

@Serializable
data class FeedItem(
    val id: String,
    val title: String,
    val description: String = "",
    val cover_url: String? = null,
    val author: String = "",
    val platform: String = "",
    val published_at: String = "",
    val video_url: String? = null,
    val duration: String? = null,
    val is_read: Boolean = false,
    val note_available: Boolean = false,
    val available_task_id: String? = null
)

@Serializable
data class UnreadCountResponse(
    val count: Int
)
```

**文件路径**：`videoNote_android/core/network/src/main/java/com/videonote/android/core/network/api/CollectionApi.kt`

```kotlin
package com.videonote.android.core.network.api

import com.videonote.android.core.network.dto.ApiResponse
import com.videonote.android.core.network.dto.CollectionDto
import com.videonote.android.core.network.dto.CollectionDetailDto
import com.videonote.android.core.network.dto.CreateCollectionRequest
import com.videonote.android.core.network.dto.UpdateCollectionRequest
import com.videonote.android.core.network.dto.AddToCollectionRequest
import com.videonote.android.core.network.dto.CollectionSummaryDto
import com.videonote.android.core.network.dto.TaskMapResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.DELETE
import retrofit2.http.Path
import retrofit2.http.Query

interface CollectionApi {

    @GET("api/collections")
    suspend fun getCollections(): ApiResponse<List<CollectionDto>>

    @POST("api/collections")
    suspend fun createCollection(@Body request: CreateCollectionRequest): ApiResponse<CollectionDto>

    @GET("api/collections/{id}")
    suspend fun getCollection(
        @Path("id") id: String,
        @Query("page") page: Int = 1,
        @Query("page_size") pageSize: Int = 20
    ): ApiResponse<CollectionDetailDto>

    @PUT("api/collections/{id}")
    suspend fun updateCollection(
        @Path("id") id: String,
        @Body request: UpdateCollectionRequest
    ): ApiResponse<CollectionDto>

    @DELETE("api/collections/{id}")
    suspend fun deleteCollection(@Path("id") id: String): ApiResponse<Unit>

    @POST("api/collections/{id}/items")
    suspend fun addToCollection(
        @Path("id") id: String,
        @Body request: AddToCollectionRequest
    ): ApiResponse<Unit>

    @DELETE("api/collections/{id}/items/{taskId}")
    suspend fun removeFromCollection(
        @Path("id") id: String,
        @Path("taskId") taskId: String
    ): ApiResponse<Unit>

    @GET("api/collections/task_map")
    suspend fun getTaskMap(@Query("task_ids") taskIds: String): ApiResponse<TaskMapResponse>

    @POST("api/collections/{id}/generate_summary")
    suspend fun generateSummary(@Path("id") id: String): ApiResponse<Unit>

    @GET("api/collections/{id}/summary")
    suspend fun getSummary(@Path("id") id: String): ApiResponse<CollectionSummaryDto>
}
```

**文件路径**：`videoNote_android/core/network/src/main/java/com/videonote/android/core/network/dto/CollectionDtos.kt`

```kotlin
package com.videonote.android.core.network.dto

import kotlinx.serialization.Serializable

@Serializable
data class CollectionDto(
    val id: String,
    val name: String,
    val description: String = "",
    val note_count: Int = 0,
    val updated_at: String = ""
)

@Serializable
data class CollectionDetailDto(
    val id: String,
    val name: String,
    val description: String = "",
    val tasks: List<TaskItem> = emptyList(),
    val total: Int = 0,
    val page: Int = 1,
    val page_size: Int = 20
)

@Serializable
data class CreateCollectionRequest(
    val name: String,
    val description: String = ""
)

@Serializable
data class UpdateCollectionRequest(
    val name: String? = null,
    val description: String? = null
)

@Serializable
data class AddToCollectionRequest(
    val task_id: String
)

@Serializable
data class CollectionSummaryDto(
    val summary: String = "",
    val generated_at: String = ""
)

@Serializable
data class TaskMapResponse(
    val task_collections: Map<String, List<String>> = emptyMap()
)
```

**文件路径**：`videoNote_android/core/network/src/main/java/com/videonote/android/core/network/api/ExportApi.kt`

```kotlin
package com.videonote.android.core.network.api

import com.videonote.android.core.network.dto.ApiResponse
import com.videonote.android.core.network.dto.ObsidianExportRequest
import okhttp3.ResponseBody
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Body
import retrofit2.http.Streaming
import retrofit2.Response

interface ExportApi {

    @Streaming
    @GET("api/export/pdf/{taskId}")
    suspend fun exportPdf(@Path("taskId") taskId: String): Response<ResponseBody>

    @Streaming
    @GET("api/export/image/{taskId}")
    suspend fun exportImage(@Path("taskId") taskId: String): Response<ResponseBody>

    @POST("api/siyuan/export/siyuan/{taskId}")
    suspend fun exportToSiyuan(@Path("taskId") taskId: String): ApiResponse<Unit>

    @POST("api/obsidian/export/obsidian/{taskId}")
    suspend fun exportToObsidian(
        @Path("taskId") taskId: String,
        @Body request: ObsidianExportRequest = ObsidianExportRequest()
    ): ApiResponse<Unit>
}
```

```kotlin
// ObsidianExportRequest 放入 ExportDtos.kt
package com.videonote.android.core.network.dto

import kotlinx.serialization.Serializable

@Serializable
data class ObsidianExportRequest(
    val content_sections: List<String> = listOf("summary", "raw_article", "subtitles", "outline", "screenshots")
)
```

**文件路径**：`videoNote_android/core/network/src/main/java/com/videonote/android/core/network/api/SubscriptionApi.kt`

```kotlin
package com.videonote.android.core.network.api

import com.videonote.android.core.network.dto.ApiResponse
import com.videonote.android.core.network.dto.SubscriptionDto
import com.videonote.android.core.network.dto.CreateSubscriptionRequest
import com.videonote.android.core.network.dto.ChannelParseRequest
import com.videonote.android.core.network.dto.ChannelParseResponse
import com.videonote.android.core.network.dto.ChannelVideosResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.DELETE
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

interface SubscriptionApi {

    @GET("api/subscriptions")
    suspend fun getSubscriptions(): ApiResponse<List<SubscriptionDto>>

    @POST("api/subscriptions")
    suspend fun createSubscription(@Body request: CreateSubscriptionRequest): ApiResponse<SubscriptionDto>

    @DELETE("api/subscriptions/{id}")
    suspend fun deleteSubscription(@Path("id") id: String): ApiResponse<Unit>

    @PUT("api/subscriptions/{id}/toggle")
    suspend fun toggleSubscription(@Path("id") id: String): ApiResponse<Unit>

    @POST("api/subscriptions/{id}/refresh")
    suspend fun refreshSubscription(@Path("id") id: String): ApiResponse<Unit>

    @POST("api/channels/parse-url")
    suspend fun parseChannelUrl(@Body request: ChannelParseRequest): ApiResponse<ChannelParseResponse>

    @GET("api/channels/{platform}/{platformId}/videos")
    suspend fun getChannelVideos(
        @Path("platform") platform: String,
        @Path("platformId") platformId: String,
        @Query("page") page: Int = 1,
        @Query("page_size") pageSize: Int = 20
    ): ApiResponse<ChannelVideosResponse>
}
```

**文件路径**：`videoNote_android/core/network/src/main/java/com/videonote/android/core/network/api/ConfigApi.kt`

```kotlin
package com.videonote.android.core.network.api

import com.videonote.android.core.network.dto.ApiResponse
import com.videonote.android.core.network.dto.SiyuanConfigDto
import com.videonote.android.core.network.dto.ObsidianConfigDto
import com.videonote.android.core.network.dto.HealthResponse
import com.videonote.android.core.network.dto.UserPreferencesDto
import retrofit2.http.GET
import retrofit2.http.PUT
import retrofit2.http.Body

interface ConfigApi {

    @GET("api/siyuan/config")
    suspend fun getSiyuanConfig(): ApiResponse<SiyuanConfigDto>

    @GET("api/obsidian/config")
    suspend fun getObsidianConfig(): ApiResponse<ObsidianConfigDto>

    @GET("api/health")
    suspend fun getHealth(): ApiResponse<HealthResponse>

    @GET("api/user/preferences")
    suspend fun getUserPreferences(): ApiResponse<UserPreferencesDto>

    @PUT("api/user/preferences")
    suspend fun updateUserPreferences(@Body request: UserPreferencesDto): ApiResponse<Unit>
}
```

```kotlin
// ConfigDtos.kt
package com.videonote.android.core.network.dto

import kotlinx.serialization.Serializable

// 注意：enabled 是 Int (0/1)，不是 Boolean
@Serializable
data class SiyuanConfigDto(
    val enabled: Int = 0,
    val server_url: String = "",
    val token: String = "",
    val box: String = ""
)

@Serializable
data class ObsidianConfigDto(
    val enabled: Int = 0,
    val vault_path: String = ""
)

@Serializable
data class HealthResponse(
    val status: String = "ok",
    val version: String = ""
)

@Serializable
data class UserPreferencesDto(
    val theme: String = "system",
    val default_style: String = "detailed",
    val default_smart_mode: Boolean = true
)
```

**文件路径**：`videoNote_android/core/network/src/main/java/com/videonote/android/core/network/api/ModelApi.kt`

```kotlin
package com.videonote.android.core.network.api

import com.videonote.android.core.network.dto.ApiResponse
import com.videonote.android.core.network.dto.ProviderDto
import com.videonote.android.core.network.dto.ModelDto
import retrofit2.http.GET
import retrofit2.http.Path

interface ModelApi {

    @GET("api/model_list")
    suspend fun getModelList(): ApiResponse<List<ProviderDto>>

    @GET("api/model_list/{providerId}")
    suspend fun getModelsByProvider(@Path("providerId") providerId: Int): ApiResponse<List<ModelDto>>
}
```

```kotlin
// ModelDtos.kt
package com.videonote.android.core.network.dto

import kotlinx.serialization.Serializable

@Serializable
data class ProviderDto(
    val id: Int,
    val name: String,
    val enabled: Boolean = true
)

@Serializable
data class ModelDto(
    val id: String,
    val name: String,
    val provider_id: Int? = null
)
```

### 任务 2.6：统一错误处理包装器

**文件路径**：`videoNote_android/core/network/src/main/java/com/videonote/android/core/network/SafeApiCall.kt`

```kotlin
package com.videonote.android.core.network

import com.videonote.android.core.network.dto.ApiResponse
import com.videonote.android.core.network.dto.ErrorResponse
import kotlinx.serialization.json.Json
import retrofit2.HttpException as RetrofitHttpException
import retrofit2.Response
import java.io.IOException

/**
 * 统一 API 调用包装器，处理两种错误格式：
 * 1. 业务错误：HTTP 200 + {code: 非0, msg: "..."}
 * 2. HTTP 错误：HTTP 4xx/5xx + {detail: "..."}
 *
 * 注意：Retrofit 在 HTTP 4xx/5xx 时会抛出 retrofit2.HttpException，
 * 此时响应体尚未被反序列化为 ApiResponse，需要手动解析 errorBody 获取 detail。
 */
suspend fun <T> safeApiCall(apiCall: suspend () -> ApiResponse<T>): T {
    return try {
        val response = apiCall()
        if (response.code == 0) {
            response.data ?: throw ApiException(-1, "响应数据为空")
        } else {
            throw ApiException(response.code, response.msg)
        }
    } catch (e: ApiException) {
        throw e
    } catch (e: RetrofitHttpException) {
        val errorBody = e.response()?.errorBody()?.string()
        val detail = try {
            errorBody?.let { Json.decodeFromString<ErrorResponse>(it).detail }
        } catch (_: Exception) { null }
        throw HttpException(e.code(), detail ?: e.message ?: "网络请求失败")
    } catch (e: IOException) {
        throw NetworkException("网络连接失败，请检查服务器地址")
    }
}

/**
 * 对返回 ResponseBody 的流式接口（如导出 PDF/图片）的包装器。
 * HTTP 错误时解析 {detail}，成功时返回 ResponseBody 供调用方写入文件。
 */
suspend fun safeStreamCall(streamCall: suspend () -> Response<okhttp3.ResponseBody>): okhttp3.ResponseBody {
    return try {
        val response = streamCall()
        if (response.isSuccessful) {
            response.body() ?: throw NetworkException("响应体为空")
        } else {
            val errorBody = response.errorBody()?.string()
            val detail = try {
                errorBody?.let { Json.decodeFromString<ErrorResponse>(it).detail }
            } catch (_: Exception) { null }
            throw HttpException(response.code(), detail ?: "HTTP ${response.code()}")
        }
    } catch (e: HttpException) {
        throw e
    } catch (e: IOException) {
        throw NetworkException("网络连接失败，请检查服务器地址")
    }
}

class NetworkException(override val message: String) : Exception(message)
```

**TDD**：写 `SafeApiCallTest`，验证：
1. `code=0` + 有 data -> 返回 data
2. `code!=0` -> 抛出 ApiException 含 msg
3. HTTP 4xx + `{detail}` -> 抛出 HttpException 含 detail
4. IOException -> 抛出 NetworkException

### ✅ 提交节点 2

```bash
git add videoNote_android/core/network/ videoNote_android/app/src/main/java/com/videonote/android/di/NetworkModule.kt
git commit -m "feat(android): core/network - Retrofit + JWT 拦截器 + 动态 BaseUrl + 全部 API 接口定义"
```

---

## 步骤 3：core/designsystem 设计系统

### 任务 3.1：主题与颜色

**文件路径**：`videoNote_android/core/designsystem/src/main/java/com/videonote/android/core/designsystem/theme/Theme.kt`

```kotlin
package com.videonote.android.core.designsystem.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.staticCompositionLocalOf

private val DarkColorScheme = darkColorScheme(
    primary = Primary80,
    secondary = Secondary80,
    tertiary = Tertiary80,
    background = BackgroundDark,
    surface = SurfaceDark
)

private val LightColorScheme = lightColorScheme(
    primary = Primary40,
    secondary = Secondary40,
    tertiary = Tertiary40,
    background = BackgroundLight,
    surface = SurfaceLight
)

enum class ThemeMode { SYSTEM, LIGHT, DARK }

val LocalThemeMode = staticCompositionLocalOf { ThemeMode.SYSTEM }

@Composable
fun VideoNoteTheme(
    themeMode: ThemeMode = ThemeMode.SYSTEM,
    content: @Composable () -> Unit
) {
    val useDark = when (themeMode) {
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
    }
    val colorScheme = if (useDark) DarkColorScheme else LightColorScheme

    CompositionLocalProvider(LocalThemeMode provides themeMode) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = VideoNoteTypography,
            content = content
        )
    }
}
```

**文件路径**：`videoNote_android/core/designsystem/src/main/java/com/videonote/android/core/designsystem/theme/Color.kt`

```kotlin
package com.videonote.android.core.designsystem.theme

import androidx.compose.ui.graphics.Color

// Light theme
val Primary40 = Color(0xFF006A6A)
val Secondary40 = Color(0xFF4A6363)
val Tertiary40 = Color(0xFF4B6074)
val BackgroundLight = Color(0xFFFAFDFC)
val SurfaceLight = Color(0xFFFAFDFC)

// Dark theme
val Primary80 = Color(0xFF4ADADA)
val Secondary80 = Color(0xFFB1CCCC)
val Tertiary80 = Color(0xFFB3C8E4)
val BackgroundDark = Color(0xFF111414)
val SurfaceDark = Color(0xFF111414)

// 平台品牌色
val BilibiliPink = Color(0xFFFB7299)
val YoutubeRed = Color(0xFFFF0000)
val DouyinBlack = Color(0xFF161823)
val XiaohongshuRed = Color(0xFFFF2442)
val KuaishouOrange = Color(0xFFFF6600)
```

**文件路径**：`videoNote_android/core/designsystem/src/main/java/com/videonote/android/core/designsystem/theme/Type.kt`

```kotlin
package com.videonote.android.core.designsystem.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

val VideoNoteTypography = Typography(
    headlineLarge = TextStyle(fontSize = 28.sp, fontWeight = FontWeight.Bold),
    headlineMedium = TextStyle(fontSize = 24.sp, fontWeight = FontWeight.Bold),
    titleLarge = TextStyle(fontSize = 20.sp, fontWeight = FontWeight.SemiBold),
    titleMedium = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.SemiBold),
    bodyLarge = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Normal),
    bodyMedium = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.Normal),
    bodySmall = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.Normal),
    labelLarge = TextStyle(fontSize = 14.sp, fontWeight = FontWeight.Medium),
    labelSmall = TextStyle(fontSize = 11.sp, fontWeight = FontWeight.Medium)
)
```

### 任务 3.2：通用组件

**文件路径**：`videoNote_android/core/designsystem/src/main/java/com/videonote/android/core/designsystem/component/VNComponents.kt`

```kotlin
package com.videonote.android.core.designsystem.component

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/**
 * 加载状态组件
 */
@Composable
fun VNLoading(modifier: Modifier = Modifier) {
    Box(modifier = modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator()
    }
}

/**
 * 错误状态组件
 */
@Composable
fun VNError(
    message: String,
    onRetry: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxSize().padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(text = message, style = MaterialTheme.typography.bodyLarge)
        if (onRetry != null) {
            Spacer(modifier = Modifier.height(8.dp))
            Button(onClick = onRetry) { Text("重试") }
        }
    }
}

/**
 * 空状态组件
 */
@Composable
fun VNEmpty(
    message: String = "暂无数据",
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier.fillMaxSize().padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(text = message, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.outline)
    }
}

/**
 * 平台标签
 */
@Composable
fun PlatformChip(platform: String, modifier: Modifier = Modifier) {
    val display = when (platform) {
        "bilibili" -> "B站"
        "youtube" -> "YouTube"
        "douyin" -> "抖音"
        "xiaohongshu" -> "小红书"
        "kuaishou" -> "快手"
        "cctv" -> "央视频"
        "local" -> "本地"
        "local_audio" -> "本地音频"
        else -> platform
    }
    AssistChip(
        onClick = {},
        label = { Text(display, style = MaterialTheme.typography.labelSmall) },
        modifier = modifier
    )
}
```

### 任务 3.3：core/common 工具类

**文件路径**：`videoNote_android/core/common/src/main/java/com/videonote/android/core/common/PlatformDetector.kt`

```kotlin
package com.videonote.android.core.common

/**
 * 平台检测工具：从 URL 识别视频平台
 * 支持短链和分享文本
 */
object PlatformDetector {

    fun detect(url: String): String? {
        val lower = url.lowercase().trim()
        return when {
            // Bilibili: bilibili.com, b23.tv 短链
            lower.contains("bilibili.com") || lower.contains("b23.tv") -> "bilibili"
            // YouTube
            lower.contains("youtube.com") || lower.contains("youtu.be") -> "youtube"
            // 抖音: douyin.com, v.douyin.com, 分享文本
            lower.contains("douyin.com") || lower.contains("v.douyin.com") ||
                lower.contains("复制打开抖音") || lower.contains("抖音") -> "douyin"
            // 小红书: xiaohongshu.com, xhslink.com 短链
            lower.contains("xiaohongshu.com") || lower.contains("xhslink.com") -> "xiaohongshu"
            // 快手: kuaishou.com, v.kuaishou.com 短链
            lower.contains("kuaishou.com") || lower.contains("v.kuaishou.com") -> "kuaishou"
            // 央视频
            lower.contains("cctv.com") -> "cctv"
            else -> null
        }
    }

    fun isVideoUrl(text: String): Boolean {
        val lower = text.lowercase().trim()
        return lower.startsWith("http://") || lower.startsWith("https://") ||
            lower.contains("b23.tv") || lower.contains("xhslink.com") ||
            lower.contains("v.douyin.com") || lower.contains("v.kuaishou.com")
    }

    /**
     * 判断平台封面图是否需要通过后端代理加载（有 Referer 限制）
     */
    fun needsImageProxy(platform: String?): Boolean {
        return when (platform) {
            "bilibili", "douyin", "xiaohongshu", "kuaishou" -> true
            else -> false
        }
    }
}
```

**文件路径**：`videoNote_android/core/common/src/main/java/com/videonote/android/core/common/ImageProxyHelper.kt`

```kotlin
package com.videonote.android.core.common

import com.videonote.android.core.network.SessionManager
import java.net.URLEncoder
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 图片代理 URL 构造器
 *
 * B站、抖音等平台的封面图有 Referer 校验，直接加载会 403。
 * 通过后端图片代理 GET /api/image_proxy?url=... 加载，后端自动处理 Referer。
 *
 * 使用方式：
 *   AsyncImage(model = ImageProxyHelper.getProxyUrl(coverUrl, platform), ...)
 */
@Singleton
class ImageProxyHelper @Inject constructor(
    private val sessionManager: SessionManager
) {
    fun getProxyUrl(originalUrl: String?, platform: String?): String? {
        if (originalUrl == null) return null
        // 不需要代理的平台直接返回原 URL
        if (!PlatformDetector.needsImageProxy(platform)) return originalUrl

        val serverUrl = sessionManager.serverUrl.value ?: return originalUrl
        val encoded = URLEncoder.encode(originalUrl, "UTF-8")
        return "${serverUrl}/api/image_proxy?url=$encoded"
    }

    /**
     * 静态版本（用于无 Hilt 注入的场景）
     */
    companion object {
        fun buildProxyUrl(serverUrl: String, originalUrl: String): String {
            val encoded = URLEncoder.encode(originalUrl, "UTF-8")
            return "${serverUrl}/api/image_proxy?url=$encoded"
        }
    }
}
```

**文件路径**：`videoNote_android/core/common/src/main/java/com/videonote/android/core/common/ClipboardHelper.kt`

```kotlin
package com.videonote.android.core.common

import android.content.ClipData
import android.content.ClipboardManager

/**
 * 剪贴板工具：提取 URL
 * 支持 text/plain 和 text/x-uri 两种格式
 */
object ClipboardHelper {

    fun extractUrl(clipboardManager: ClipboardManager?): String? {
        if (clipboardManager == null || !clipboardManager.hasPrimaryClip()) return null
        val clip = clipboardManager.primaryClip ?: return null
        if (clip.itemCount == 0) return null

        // 尝试 text/x-uri
        val uriText = clip.getItemAt(0).uri?.toString()
        if (uriText != null && PlatformDetector.isVideoUrl(uriText)) return uriText

        // 尝试 text/plain
        val plainText = clip.getItemAt(0).text?.toString() ?: return null
        val trimmed = plainText.trim()

        // 分享文本可能包含 URL（如抖音分享文本）
        if (PlatformDetector.isVideoUrl(trimmed)) return trimmed

        // 从分享文本中提取 URL
        val urlRegex = Regex("""https?://[^\s<>"']+""")
        val match = urlRegex.find(trimmed)
        if (match != null && PlatformDetector.isVideoUrl(match.value)) return match.value

        // 短链检测
        if (PlatformDetector.isVideoUrl(trimmed)) return trimmed

        return null
    }
}
```

**文件路径**：`videoNote_android/core/common/src/main/java/com/videonote/android/core/common/EncryptedDataStore.kt`

```kotlin
package com.videonote.android.core.common

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 加密数据存储：保存 token 和服务器地址
 *
 * 使用 EncryptedSharedPreferences（AES256-GCM）加密敏感数据。
 * 对于 token 这类敏感凭证，不使用明文 DataStore。
 *
 * 通过 StateFlow 暴露数据，方便 Compose 收集。
 */
@Singleton
class EncryptedDataStore @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        "videonote_secure_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    // StateFlow 缓存：避免每次读取都走 SP IO
    private val _token = MutableStateFlow<String?>(prefs.getString(KEY_TOKEN, null))
    val token: Flow<String?> = _token.asStateFlow()

    private val _serverUrl = MutableStateFlow(prefs.getString(KEY_SERVER_URL, null))
    val serverUrl: Flow<String?> = _serverUrl.asStateFlow()

    private val _username = MutableStateFlow(prefs.getString(KEY_USERNAME, null))
    val username: Flow<String?> = _username.asStateFlow()

    private val _themeMode = MutableStateFlow(prefs.getString(KEY_THEME_MODE, "system") ?: "system")
    val themeMode: Flow<String> = _themeMode.asStateFlow()

    fun setToken(token: String?) {
        if (token != null) prefs.edit().putString(KEY_TOKEN, token).apply()
        else prefs.edit().remove(KEY_TOKEN).apply()
        _token.value = token
    }

    fun setServerUrl(url: String) {
        prefs.edit().putString(KEY_SERVER_URL, url).apply()
        _serverUrl.value = url
    }

    fun setUsername(username: String) {
        prefs.edit().putString(KEY_USERNAME, username).apply()
        _username.value = username
    }

    fun setThemeMode(mode: String) {
        prefs.edit().putString(KEY_THEME_MODE, mode).apply()
        _themeMode.value = mode
    }

    fun clearAll() {
        prefs.edit().clear().apply()
        _token.value = null
        _serverUrl.value = null
        _username.value = null
        _themeMode.value = "system"
    }

    companion object {
        private const val KEY_TOKEN = "jwt_token"
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_USERNAME = "username"
        private const val KEY_THEME_MODE = "theme_mode"
    }
}
```

**TDD**：写 `PlatformDetectorTest`，验证：
1. `bilibili.com/video/BV1xxx` -> `bilibili`
2. `b23.tv/abc` -> `bilibili`
3. `youtu.be/abc` -> `youtube`
4. 抖音分享文本 -> `douyin`
5. `xhslink.com/abc` -> `xiaohongshu`
6. 无效 URL -> `null`

### ✅ 提交节点 3

```bash
git add videoNote_android/core/designsystem/ videoNote_android/core/common/
git commit -m "feat(android): core/designsystem + core/common - 主题、组件、平台检测、加密存储"
```

---

## 步骤 4：feature/auth 登录模块

### 任务 4.1：AuthRepository

**文件路径**：`videoNote_android/feature/auth/src/main/java/com/videonote/android/feature/auth/AuthRepository.kt`

```kotlin
package com.videonote.android.feature.auth

import com.videonote.android.core.common.EncryptedDataStore
import com.videonote.android.core.network.SessionManager
import com.videonote.android.core.network.api.AuthApi
import com.videonote.android.core.network.dto.LoginRequest
import com.videonote.android.core.network.safeApiCall
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val authApi: AuthApi,
    private val sessionManager: SessionManager,
    private val dataStore: EncryptedDataStore
) {
    suspend fun login(serverUrl: String, username: String, password: String): Result<String> {
        return try {
            sessionManager.setServerUrl(serverUrl.trimEnd('/'))
            val response = safeApiCall { authApi.login(LoginRequest(username, password)) }
            val token = response.access_token
            sessionManager.setToken(token)
            dataStore.setServerUrl(serverUrl.trimEnd('/'))
            dataStore.setToken(token)
            dataStore.setUsername(username)
            Result.success(token)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun restoreSession(): Boolean {
        // 从 DataStore 恢复 token 和 serverUrl（在 Application 启动时调用）
        return false // 实现见下方
    }

    suspend fun logout() {
        sessionManager.setToken(null)
        dataStore.setToken(null)
    }
}
```

### 任务 4.2：LoginViewModel

**文件路径**：`videoNote_android/feature/auth/src/main/java/com/videonote/android/feature/auth/LoginViewModel.kt`

```kotlin
package com.videonote.android.feature.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LoginUiState(
    val serverUrl: String = "",
    val username: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    val loginSuccess: Boolean = false
)

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState: StateFlow<LoginUiState> = _uiState.asStateFlow()

    fun updateServerUrl(url: String) { _uiState.value = _uiState.value.copy(serverUrl = url) }
    fun updateUsername(name: String) { _uiState.value = _uiState.value.copy(username = name) }
    fun updatePassword(pwd: String) { _uiState.value = _uiState.value.copy(password = pwd) }

    fun login() {
        val state = _uiState.value
        if (state.serverUrl.isBlank()) {
            _uiState.value = state.copy(error = "请输入服务器地址")
            return
        }
        if (state.username.isBlank()) {
            _uiState.value = state.copy(error = "请输入用户名")
            return
        }
        if (state.password.isBlank()) {
            _uiState.value = state.copy(error = "请输入密码")
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            val result = authRepository.login(state.serverUrl, state.username, state.password)
            result.fold(
                onSuccess = { _uiState.value = _uiState.value.copy(isLoading = false, loginSuccess = true) },
                onFailure = { e -> _uiState.value = _uiState.value.copy(isLoading = false, error = e.message ?: "登录失败") }
            )
        }
    }
}
```

### 任务 4.3：LoginPage Composable

**文件路径**：`videoNote_android/feature/auth/src/main/java/com/videonote/android/feature/auth/LoginScreen.kt`

```kotlin
package com.videonote.android.feature.auth

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@Composable
fun LoginScreen(
    onLoginSuccess: () -> Unit,
    viewModel: LoginViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(uiState.loginSuccess) {
        if (uiState.loginSuccess) onLoginSuccess()
    }

    Surface(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier.fillMaxSize().padding(24.dp),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text("VideoNote", style = MaterialTheme.typography.headlineLarge)
            Spacer(Modifier.height(32.dp))

            // 服务器地址
            OutlinedTextField(
                value = uiState.serverUrl,
                onValueChange = viewModel::updateServerUrl,
                label = { Text("服务器地址") },
                placeholder = { Text("http://192.168.1.100:8483") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(12.dp))

            // 用户名
            OutlinedTextField(
                value = uiState.username,
                onValueChange = viewModel::updateUsername,
                label = { Text("用户名") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(12.dp))

            // 密码
            OutlinedTextField(
                value = uiState.password,
                onValueChange = viewModel::updatePassword,
                label = { Text("密码") },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(Modifier.height(16.dp))

            // 错误提示
            if (uiState.error != null) {
                Text(
                    text = uiState.error!!,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(Modifier.height(8.dp))
            }

            // 登录按钮
            Button(
                onClick = viewModel::login,
                enabled = !uiState.isLoading,
                modifier = Modifier.fillMaxWidth().height(48.dp)
            ) {
                if (uiState.isLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                } else {
                    Text("登录")
                }
            }
        }
    }
}
```

### 任务 4.4：导航图骨架

**文件路径**：`videoNote_android/app/src/main/java/com/videonote/android/navigation/Routes.kt`

```kotlin
package com.videonote.android.navigation

import kotlinx.serialization.Serializable

// 底部导航 Tab 路由
@Serializable sealed class Route {
    @Serializable data object Login : Route()
    @Serializable data object Home : Route()
    @Serializable data object Notes : Route()
    @Serializable data object Feed : Route()
    @Serializable data object Settings : Route()
    @Serializable data class NoteDetail(val taskId: String) : Route()
    @Serializable data class CollectionDetail(val collectionId: String) : Route()
}
```

**文件路径**：`videoNote_android/app/src/main/java/com/videonote/android/navigation/AppNavHost.kt`

```kotlin
package com.videonote.android.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.videonote.android.core.designsystem.theme.VideoNoteTheme
import com.videonote.android.feature.auth.LoginScreen

@Composable
fun AppNavHost() {
    val navController = rememberNavController()
    // 初始路由判定：是否有 token -> Login 或 Home
    // 后续步骤扩展完整导航

    VideoNoteTheme {
        NavHost(navController = navController, startDestination = Route.Login) {
            composable<Route.Login> {
                LoginScreen(onLoginSuccess = {
                    navController.navigate(Route.Home) {
                        popUpTo(Route.Login) { inclusive = true }
                    }
                })
            }
            // 后续步骤添加 Home, Notes, Feed, Settings, NoteDetail, CollectionDetail
        }
    }
}
```

**TDD**：写 `LoginViewModelTest`，验证：
1. 空服务器地址 -> error = "请输入服务器地址"
2. 空用户名 -> error = "请输入用户名"
3. 空密码 -> error = "请输入密码"
4. mock 成功响应 -> loginSuccess = true

### ✅ 提交节点 4

```bash
git add videoNote_android/feature/auth/ videoNote_android/app/src/main/java/com/videonote/android/navigation/
git commit -m "feat(android): feature/auth - 登录页 + 服务器地址配置 + Token 管理 + 导航骨架"
```

---

## 步骤 5：feature/home 快速添加模块

### 任务 5.1：HomeRepository

**文件路径**：`videoNote_android/feature/home/src/main/java/com/videonote/android/feature/home/HomeRepository.kt`

```kotlin
package com.videonote.android.feature.home

import com.videonote.android.core.network.api.NoteApi
import com.videonote.android.core.network.dto.*
import com.videonote.android.core.network.safeApiCall
import okhttp3.MultipartBody
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class HomeRepository @Inject constructor(
    private val noteApi: NoteApi
) {
    suspend fun generateNote(
        videoUrl: String?,
        platform: String,
        smartMode: Boolean,
        style: String,
        modelName: String? = null,
        providerId: Int? = null,
        filePath: String? = null
    ): GenerateNoteResponse {
        return safeApiCall {
            noteApi.generateNote(
                GenerateNoteRequest(
                    video_url = videoUrl,
                    platform = platform,
                    smart_mode = smartMode,
                    model_name = if (!smartMode) modelName else null,
                    provider_id = if (!smartMode) providerId else null,
                    style = style,
                    output_language = "zh",
                    format = "screenshot",
                    screenshot = true,
                    link = false,
                    file_path = filePath
                )
            )
        }
    }

    suspend fun getTaskStatus(taskId: String): TaskStatusResponse {
        return safeApiCall { noteApi.getTaskStatus(taskId) }
    }

    suspend fun checkNoteAvailability(videoUrl: String, platform: String): CheckNoteResponse {
        return safeApiCall { noteApi.checkNoteAvailability(CheckNoteRequest(videoUrl, platform)) }
    }

    suspend fun uploadFile(part: MultipartBody.Part): UploadResponse {
        return safeApiCall { noteApi.uploadFile(part) }
    }

    suspend fun cancelTask(taskId: String) {
        safeApiCall { noteApi.cancelTask(TaskIdRequest(taskId)) }
    }
}
```

### 任务 5.2：HomeViewModel + 任务轮询

**文件路径**：`videoNote_android/feature/home/src/main/java/com/videonote/android/feature/home/HomeViewModel.kt`

```kotlin
package com.videonote.android.feature.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.videonote.android.core.common.ClipboardHelper
import com.videonote.android.core.common.PlatformDetector
import com.videonote.android.core.network.dto.GenerateNoteResponse
import com.videonote.android.core.network.dto.TaskStatusResponse
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class HomeUiState(
    val urlInput: String = "",
    val detectedPlatform: String? = null,
    val clipboardConsumed: Boolean = false,
    val smartMode: Boolean = true,
    val style: String = "detailed",
    val selectedModelName: String? = null,
    val selectedProviderId: Int? = null,
    val isGenerating: Boolean = false,
    val currentTaskId: String? = null,
    val taskStatus: TaskStatusResponse? = null,
    val error: String? = null,
    val noteReused: Boolean = false,
    val reuseType: String? = null
)

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val homeRepository: HomeRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    private var pollingJob: Job? = null

    fun updateUrl(url: String) {
        val platform = PlatformDetector.detect(url)
        _uiState.value = _uiState.value.copy(urlInput = url, detectedPlatform = platform)
    }

    fun clearUrl() {
        _uiState.value = _uiState.value.copy(urlInput = "", detectedPlatform = null)
    }

    /**
     * 剪贴板自动填入：仅在输入框为空 + 未消费过时触发
     * 由 Composable 层传入 ClipboardManager 提取的文本，ViewModel 负责判断和标记
     *
     * 设计要求（零步操作）：
     * - 输入框为空 + 剪贴板有 URL -> 直接填入
     * - 输入框已有内容 -> 不覆盖
     * - clipboardConsumed 确保只自动填入一次
     */
    fun tryAutoFillFromClipboard(clipboardText: String?) {
        val state = _uiState.value
        if (state.urlInput.isNotEmpty() || state.clipboardConsumed || clipboardText.isNullOrBlank()) {
            return
        }
        // 使用 ClipboardHelper 从文本中提取 URL（支持分享文本、短链等）
        val url = extractUrlFromText(clipboardText)
        if (url != null) {
            val platform = PlatformDetector.detect(url)
            _uiState.value = state.copy(
                urlInput = url,
                detectedPlatform = platform,
                clipboardConsumed = true
            )
        }
    }

    /**
     * 从纯文本中提取视频 URL
     * 处理：纯 URL、分享文本中嵌入的 URL、短链
     */
    private fun extractUrlFromText(text: String): String? {
        val trimmed = text.trim()
        // 直接是 URL
        if (PlatformDetector.isVideoUrl(trimmed)) return trimmed
        // 从分享文本中提取 URL（如抖音分享文本："xxx https://v.douyin.com/xxx 复制打开抖音"）
        val urlRegex = Regex("""https?://[^\s<>"']+""")
        val match = urlRegex.find(trimmed)
        if (match != null && PlatformDetector.isVideoUrl(match.value)) return match.value
        // 短链检测（不带 http 前缀的短链）
        if (trimmed.contains("b23.tv") || trimmed.contains("xhslink.com") ||
            trimmed.contains("v.douyin.com") || trimmed.contains("v.kuaishou.com")) {
            return "https://$trimmed".let { if (PlatformDetector.isVideoUrl(it)) it else null }
        }
        return null
    }

    /**
     * 标记剪贴板已消费（Composable 在成功自动填入后调用）
     */
    fun markClipboardConsumed() {
        _uiState.value = _uiState.value.copy(clipboardConsumed = true)
    }

    fun setSmartMode(enabled: Boolean) {
        _uiState.value = _uiState.value.copy(smartMode = enabled)
    }

    fun setStyle(style: String) {
        _uiState.value = _uiState.value.copy(style = style)
    }

    fun generateNote() {
        val state = _uiState.value
        val platform = state.detectedPlatform ?: run {
            _uiState.value = state.copy(error = "无法识别视频平台")
            return
        }

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isGenerating = true, error = null)
            try {
                val response = homeRepository.generateNote(
                    videoUrl = state.urlInput.ifBlank { null },
                    platform = platform,
                    smartMode = state.smartMode,
                    style = state.style,
                    modelName = state.selectedModelName,
                    providerId = state.selectedProviderId
                )
                _uiState.value = _uiState.value.copy(
                    isGenerating = false,
                    currentTaskId = response.task_id,
                    noteReused = response.reused,
                    reuseType = response.reuse_type
                )
                // 开始轮询任务状态
                startPolling(response.task_id)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isGenerating = false, error = e.message)
            }
        }
    }

    private fun startPolling(taskId: String) {
        pollingJob?.cancel()
        pollingJob = viewModelScope.launch {
            while (true) {
                delay(3000) // 3 秒轮询
                try {
                    val status = homeRepository.getTaskStatus(taskId)
                    _uiState.value = _uiState.value.copy(taskStatus = status)
                    // 终止条件：SUCCESS, FAILED, CANCELLED
                    if (status.status in listOf("SUCCESS", "FAILED", "CANCELLED")) break
                } catch (e: Exception) {
                    _uiState.value = _uiState.value.copy(error = e.message)
                    break
                }
            }
        }
    }

    fun cancelCurrentTask() {
        val taskId = _uiState.value.currentTaskId ?: return
        viewModelScope.launch {
            try { homeRepository.cancelTask(taskId) } catch (_: Exception) {}
            pollingJob?.cancel()
            _uiState.value = _uiState.value.copy(taskStatus = null, currentTaskId = null)
        }
    }

    override fun onCleared() {
        super.onCleared()
        pollingJob?.cancel()
    }
}
```

### 任务 5.3：HomeScreen Composable

**文件路径**：`videoNote_android/feature/home/src/main/java/com/videonote/android/feature/home/HomeScreen.kt`

```kotlin
package com.videonote.android.feature.home

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.videonote.android.core.designsystem.component.PlatformChip

@Composable
fun HomeScreen(
    onNavigateToNoteDetail: (String) -> Unit,
    onOpenUserMenu: () -> Unit,
    viewModel: HomeViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val clipboardManager = LocalClipboardManager.current

    // 剪贴板自动填入（LaunchedEffect 只执行一次）
    // 设计要求：输入框为空 + 剪贴板有 URL -> 直接填入（零步操作）
    LaunchedEffect(Unit) {
        if (uiState.urlInput.isEmpty() && !uiState.clipboardConsumed) {
            val clipText = clipboardManager.getText()?.text
            // 委托给 ViewModel 处理：内部会判断 URL 有效性、提取 URL、标记 consumed
            viewModel.tryAutoFillFromClipboard(clipText)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("VideoNote") },
                actions = {
                    IconButton(onClick = onOpenUserMenu) {
                        Icon(Icons.Default.Person, contentDescription = "用户")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // URL 输入框
            OutlinedTextField(
                value = uiState.urlInput,
                onValueChange = viewModel::updateUrl,
                label = { Text("视频链接") },
                placeholder = { Text("粘贴或输入视频 URL") },
                singleLine = true,
                trailingIcon = {
                    if (uiState.urlInput.isNotEmpty()) {
                        IconButton(onClick = viewModel::clearUrl) {
                            Icon(Icons.Default.Clear, contentDescription = "清除")
                        }
                    }
                },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                modifier = Modifier.fillMaxWidth()
            )

            // 平台检测结果
            if (uiState.detectedPlatform != null) {
                PlatformChip(platform = uiState.detectedPlatform!!)
            }

            // 笔记风格选择
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf("minimal" to "简洁", "detailed" to "详细", "bullet" to "要点").forEach { (value, label) ->
                    FilterChip(
                        selected = uiState.style == value,
                        onClick = { viewModel.setStyle(value) },
                        label = { Text(label) }
                    )
                }
            }

            // 智能模式开关
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("智能选择模型")
                Spacer(Modifier.weight(1f))
                Switch(checked = uiState.smartMode, onCheckedChange = viewModel::setSmartMode)
            }

            Spacer(Modifier.height(8.dp))

            // 生成按钮
            Button(
                onClick = viewModel::generateNote,
                enabled = !uiState.isGenerating && uiState.urlInput.isNotBlank(),
                modifier = Modifier.fillMaxWidth().height(50.dp)
            ) {
                if (uiState.isGenerating) {
                    CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
                } else {
                    Text("生成笔记")
                }
            }

            // 错误提示
            uiState.error?.let { err ->
                Text(err, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }

            // 任务状态实时显示
            uiState.taskStatus?.let { status ->
                TaskStatusCard(
                    status = status,
                    onCancel = viewModel::cancelCurrentTask,
                    onViewNote = { onNavigateToNoteDetail(uiState.currentTaskId ?: return@let) }
                )
            }

            // 笔记复用提示
            if (uiState.noteReused) {
                Text("该视频已有笔记，已复用", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.tertiary)
            }
        }
    }
}

@Composable
private fun TaskStatusCard(
    status: com.videonote.android.core.network.dto.TaskStatusResponse,
    onCancel: () -> Unit,
    onViewNote: () -> Unit
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text("任务状态：${status.status}", style = MaterialTheme.typography.titleMedium)
            if (status.progress > 0) {
                Spacer(Modifier.height(8.dp))
                LinearProgressIndicator(progress = { status.progress / 100f }, modifier = Modifier.fillMaxWidth())
            }
            status.step?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
            Spacer(Modifier.height(12.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (status.status == "SUCCESS") {
                    Button(onClick = onViewNote) { Text("查看笔记") }
                }
                if (status.status !in listOf("SUCCESS", "FAILED", "CANCELLED")) {
                    OutlinedButton(onClick = onCancel) { Text("取消") }
                }
                if (status.status == "FAILED") {
                    Text("失败：${status.error ?: "未知错误"}", color = MaterialTheme.colorScheme.error)
                }
            }
        }
    }
}
```

**TDD**：写 `HomeViewModelTest`，验证：
1. `updateUrl("bilibili.com/video/BV1xx")` -> detectedPlatform = "bilibili"
2. `clearUrl()` -> urlInput 为空, detectedPlatform 为 null
3. `tryAutoFillFromClipboard("https://b23.tv/abc")` -> urlInput 被填入, clipboardConsumed = true
4. `tryAutoFillFromClipboard("无效文本")` -> urlInput 不变, clipboardConsumed = false
5. 再次调用 `tryAutoFillFromClipboard` -> 不覆盖（已 consumed）
6. mock generateNote 成功 -> currentTaskId 不为空, 轮询启动
7. mock taskStatus 返回 SUCCESS -> 轮询停止

### ✅ 提交节点 5

```bash
git add videoNote_android/feature/home/
git commit -m "feat(android): feature/home - 快速添加页 + 剪贴板自动填入 + 任务轮询"
```

---

## 步骤 6：feature/notelist 笔记列表 + 收藏夹

### 任务 6.1：NoteListRepository

**文件路径**：`videoNote_android/feature/notelist/src/main/java/com/videonote/android/feature/notelist/NoteListRepository.kt`

```kotlin
package com.videonote.android.feature.notelist

import com.videonote.android.core.network.api.CollectionApi
import com.videonote.android.core.network.api.NoteApi
import com.videonote.android.core.network.dto.*
import com.videonote.android.core.network.safeApiCall
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class NoteListRepository @Inject constructor(
    private val noteApi: NoteApi,
    private val collectionApi: CollectionApi
) {
    suspend fun getTasks(page: Int = 1, platform: String? = null, search: String? = null): TaskListResponse {
        return safeApiCall { noteApi.getTasks(page = page, platform = platform, search = search) }
    }

    suspend fun deleteTask(taskId: String) {
        safeApiCall { noteApi.deleteTask(TaskIdRequest(taskId)) }
    }

    // 收藏夹相关
    suspend fun getCollections(): List<CollectionDto> {
        return safeApiCall { collectionApi.getCollections() }
    }

    suspend fun createCollection(name: String, description: String = ""): CollectionDto {
        return safeApiCall { collectionApi.createCollection(CreateCollectionRequest(name, description)) }
    }

    suspend fun getCollection(id: String, page: Int = 1): CollectionDetailDto {
        return safeApiCall { collectionApi.getCollection(id, page = page) }
    }

    suspend fun deleteCollection(id: String) {
        safeApiCall { collectionApi.deleteCollection(id) }
    }

    suspend fun addToCollection(collectionId: String, taskId: String) {
        safeApiCall { collectionApi.addToCollection(collectionId, AddToCollectionRequest(taskId)) }
    }

    suspend fun removeFromCollection(collectionId: String, taskId: String) {
        safeApiCall { collectionApi.removeFromCollection(collectionId, taskId) }
    }

    suspend fun getTaskMap(taskIds: List<String>): TaskMapResponse {
        return safeApiCall { collectionApi.getTaskMap(taskIds.joinToString(",")) }
    }

    suspend fun generateSummary(collectionId: String) {
        safeApiCall { collectionApi.generateSummary(collectionId) }
    }

    suspend fun getSummary(collectionId: String): CollectionSummaryDto {
        return safeApiCall { collectionApi.getSummary(collectionId) }
    }
}
```

### 任务 6.2：NoteListViewModel

**文件路径**：`videoNote_android/feature/notelist/src/main/java/com/videonote/android/feature/notelist/NoteListViewModel.kt`

```kotlin
package com.videonote.android.feature.notelist

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.videonote.android.core.network.dto.CollectionDto
import com.videonote.android.core.network.dto.TaskItem
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class NoteListUiState(
    val selectedTab: Int = 0, // 0=全部笔记, 1=收藏夹
    val tasks: List<TaskItem> = emptyList(),
    val collections: List<CollectionDto> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null,
    val selectedPlatform: String? = null,
    val searchQuery: String = "",
    val page: Int = 1,
    val hasMore: Boolean = true
)

@HiltViewModel
class NoteListViewModel @Inject constructor(
    private val repository: NoteListRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(NoteListUiState())
    val uiState: StateFlow<NoteListUiState> = _uiState.asStateFlow()

    init { loadTasks() }

    fun loadTasks(refresh: Boolean = false) {
        if (refresh) {
            _uiState.value = _uiState.value.copy(page = 1, tasks = emptyList(), hasMore = true)
        }
        val state = _uiState.value
        if (!state.hasMore && !refresh) return

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val response = repository.getTasks(
                    page = state.page,
                    platform = state.selectedPlatform,
                    search = state.searchQuery.ifBlank { null }
                )
                _uiState.value = _uiState.value.copy(
                    tasks = if (refresh) response.tasks else state.tasks + response.tasks,
                    isLoading = false,
                    page = state.page + 1,
                    hasMore = response.tasks.size >= 20
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, error = e.message)
            }
        }
    }

    fun selectPlatform(platform: String?) {
        _uiState.value = _uiState.value.copy(selectedPlatform = platform)
        loadTasks(refresh = true)
    }

    fun updateSearch(query: String) {
        _uiState.value = _uiState.value.copy(searchQuery = query)
    }

    fun search() { loadTasks(refresh = true) }

    fun deleteTask(taskId: String) {
        viewModelScope.launch {
            try {
                repository.deleteTask(taskId)
                _uiState.value = _uiState.value.copy(
                    tasks = _uiState.value.tasks.filter { it.task_id != taskId }
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = e.message)
            }
        }
    }

    fun loadCollections() {
        viewModelScope.launch {
            try {
                val collections = repository.getCollections()
                _uiState.value = _uiState.value.copy(collections = collections)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = e.message)
            }
        }
    }

    fun selectTab(tab: Int) {
        _uiState.value = _uiState.value.copy(selectedTab = tab)
        if (tab == 1 && _uiState.value.collections.isEmpty()) loadCollections()
    }
}
```

### 任务 6.3：NoteListScreen + NoteCard

**文件路径**：`videoNote_android/feature/notelist/src/main/java/com/videonote/android/feature/notelist/NoteListScreen.kt`

```kotlin
package com.videonote.android.feature.notelist

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items as gridItems
import androidx.compose.foundation.lazy.items as lazyItems
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.videonote.android.core.common.ImageProxyHelper
import com.videonote.android.core.designsystem.component.PlatformChip
import com.videonote.android.core.network.dto.TaskItem

@Composable
fun NoteListScreen(
    onNoteClick: (String) -> Unit,
    onCollectionClick: (String) -> Unit,
    viewModel: NoteListViewModel = hiltViewModel(),
    imageProxyHelper: ImageProxyHelper = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Column(modifier = Modifier.fillMaxSize()) {
        // Tab: 全部笔记 | 收藏夹
        TabRow(selectedTabIndex = uiState.selectedTab) {
            Tab(selected = uiState.selectedTab == 0, onClick = { viewModel.selectTab(0) }, text = { Text("全部笔记") })
            Tab(selected = uiState.selectedTab == 1, onClick = { viewModel.selectTab(1) }, text = { Text("收藏夹") })
        }

        when (uiState.selectedTab) {
            0 -> AllNotesTab(uiState, viewModel, onNoteClick)
            1 -> CollectionsTab(uiState, viewModel, onCollectionClick)
        }
    }
}

@Composable
private fun AllNotesTab(
    uiState: NoteListUiState,
    viewModel: NoteListViewModel,
    onNoteClick: (String) -> Unit
) {
    Column(modifier = Modifier.fillMaxSize()) {
        // 搜索框
        OutlinedTextField(
            value = uiState.searchQuery,
            onValueChange = viewModel::updateSearch,
            placeholder = { Text("搜索笔记...") },
            trailingIcon = { IconButton(onClick = viewModel::search) { Icon(Icons.Default.Search, null) } },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp)
        )

        // 平台筛选 chips（横向滚动）
        Row(
            modifier = Modifier.horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FilterChip(selected = uiState.selectedPlatform == null, onClick = { viewModel.selectPlatform(null) }, label = { Text("全部") })
            listOf("bilibili", "youtube", "douyin", "xiaohongshu", "kuaishou", "cctv").forEach { platform ->
                FilterChip(
                    selected = uiState.selectedPlatform == platform,
                    onClick = { viewModel.selectPlatform(platform) },
                    label = { Text(platform) }
                )
            }
        }

        Spacer(Modifier.height(8.dp))

        // 笔记卡片网格（每行 2 张）
        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            contentPadding = PaddingValues(16.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            gridItems(uiState.tasks, key = { it.task_id }) { task ->
                NoteCard(task = task, imageProxyHelper = imageProxyHelper, onClick = { onNoteClick(task.task_id) })
            }
            if (uiState.hasMore && !uiState.isLoading) {
                item { LaunchedEffect(Unit) { viewModel.loadTasks() } }
            }
        }
    }
}

@Composable
private fun NoteCard(task: TaskItem, imageProxyHelper: ImageProxyHelper, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth()
    ) {
        Column {
            // 封面图：通过图片代理加载（B站/抖音等有 Referer 限制）
            AsyncImage(
                model = imageProxyHelper.getProxyUrl(task.cover_url, task.platform),
                contentDescription = null,
                modifier = Modifier.fillMaxWidth().height(100.dp).clip(MaterialTheme.shapes.medium)
            )
            Column(modifier = Modifier.padding(8.dp)) {
                Text(task.title, maxLines = 2, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.titleSmall)
                Spacer(Modifier.height(4.dp))
                Text(task.author, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.outline)
                Spacer(Modifier.height(4.dp))
                PlatformChip(platform = task.platform)
            }
        }
    }
}

@Composable
private fun CollectionsTab(
    uiState: NoteListUiState,
    viewModel: NoteListViewModel,
    onCollectionClick: (String) -> Unit
) {
    LazyColumn(
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Button(onClick = { /* 新建收藏夹对话框 */ }, modifier = Modifier.fillMaxWidth()) {
                Text("新建收藏夹")
            }
        }
        lazyItems(uiState.collections, key = { it.id }) { collection ->
            CollectionCard(collection = collection, onClick = { onCollectionClick(collection.id) })
        }
    }
}

@Composable
private fun CollectionCard(collection: CollectionDto, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text(collection.name, style = MaterialTheme.typography.titleMedium)
                Text("${collection.note_count} 篇笔记", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.outline)
            }
        }
    }
}
```

### 任务 6.4：CollectionDetailScreen

**文件路径**：`videoNote_android/feature/notelist/src/main/java/com/videonote/android/feature/notelist/CollectionDetailScreen.kt`

```kotlin
package com.videonote.android.feature.notelist

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.videonote.android.core.network.dto.CollectionDetailDto

/**
 * 收藏夹详情页：使用独立的 CollectionDetailViewModel
 */
@Composable
fun CollectionDetailScreen(
    collectionId: String,
    onBack: () -> Unit,
    onNoteClick: (String) -> Unit,
    viewModel: CollectionDetailViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(collectionId) {
        viewModel.loadCollection(collectionId)
        viewModel.loadSummary(collectionId)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(uiState.collection?.name ?: "收藏夹") },
                navigationIcon = { TextButton(onClick = onBack) { Text("返回") } }
            )
        }
    ) { padding ->
        LazyColumn(modifier = Modifier.fillMaxSize().padding(padding)) {
            // AI 摘要
            uiState.summary?.let { summary ->
                item {
                    Card(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                        Text(summary, modifier = Modifier.padding(16.dp))
                    }
                }
            }

            // 笔记列表
            uiState.collection?.tasks?.let { tasks ->
                items(tasks, key = { it.task_id }) { task ->
                    ListItem(
                        headlineContent = { Text(task.title, maxLines = 1) },
                        supportingContent = { Text(task.author, style = MaterialTheme.typography.bodySmall) },
                        modifier = Modifier.clickable { onNoteClick(task.task_id) }
                    )
                    HorizontalDivider()
                }
            }
        }
    }
}
```

**TDD**：写 `NoteListViewModelTest`，验证：
1. 初始加载 -> tasks 不为空
2. `selectPlatform("bilibili")` -> 重新加载
3. `selectTab(1)` -> 加载收藏夹列表
4. `deleteTask(id)` -> tasks 过滤掉该项

**文件路径**：`videoNote_android/feature/notelist/src/main/java/com/videonote/android/feature/notelist/CollectionDetailViewModel.kt`

```kotlin
package com.videonote.android.feature.notelist

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.videonote.android.core.network.dto.CollectionDetailDto
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class CollectionDetailUiState(
    val collection: CollectionDetailDto? = null,
    val summary: String? = null,
    val isLoading: Boolean = false,
    val error: String? = null
)

/**
 * 收藏夹详情 ViewModel：独立于 NoteListViewModel
 * 负责加载收藏夹内容、摘要、添加/移除笔记
 */
@HiltViewModel
class CollectionDetailViewModel @Inject constructor(
    private val repository: NoteListRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(CollectionDetailUiState())
    val uiState: StateFlow<CollectionDetailUiState> = _uiState.asStateFlow()

    fun loadCollection(collectionId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                val detail = repository.getCollection(collectionId)
                _uiState.value = _uiState.value.copy(collection = detail, isLoading = false)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, error = e.message)
            }
        }
    }

    fun loadSummary(collectionId: String) {
        viewModelScope.launch {
            try {
                val summaryDto = repository.getSummary(collectionId)
                _uiState.value = _uiState.value.copy(summary = summaryDto.summary.ifBlank { null })
            } catch (_: Exception) { /* 摘要可选，静默失败 */ }
        }
    }

    fun removeNote(collectionId: String, taskId: String) {
        viewModelScope.launch {
            try {
                repository.removeFromCollection(collectionId, taskId)
                _uiState.value.collection?.let { col ->
                    _uiState.value = _uiState.value.copy(
                        collection = col.copy(tasks = col.tasks.filter { it.task_id != taskId })
                    )
                }
            } catch (_: Exception) {}
        }
    }
}
```

### ✅ 提交节点 6

```bash
git add videoNote_android/feature/notelist/
git commit -m "feat(android): feature/notelist - 笔记列表 + 平台筛选 + 收藏夹 CRUD"
```

---

## 步骤 7：feature/notedetail 笔记详情

### 任务 7.1：NoteDetailRepository

**文件路径**：`videoNote_android/feature/notedetail/src/main/java/com/videonote/android/feature/notedetail/NoteDetailRepository.kt`

```kotlin
package com.videonote.android.feature.notedetail

import com.videonote.android.core.network.api.ConfigApi
import com.videonote.android.core.network.api.ExportApi
import com.videonote.android.core.network.api.NoteApi
import com.videonote.android.core.network.dto.*
import com.videonote.android.core.network.safeApiCall
import com.videonote.android.core.network.safeStreamCall
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class NoteDetailRepository @Inject constructor(
    private val noteApi: NoteApi,
    private val exportApi: ExportApi,
    private val configApi: ConfigApi
) {
    suspend fun getNoteDetail(taskId: String): QuickViewResponse {
        return safeApiCall { noteApi.getQuickView(taskId) }
    }

    suspend fun updateTags(taskId: String, tags: List<String>) {
        safeApiCall { noteApi.updateTags(taskId, TagsRequest(tags)) }
    }

    // 导出相关：流式接口使用 safeStreamCall 包装，调用方负责写入文件
    suspend fun exportPdf(taskId: String): okhttp3.ResponseBody = safeStreamCall { exportApi.exportPdf(taskId) }
    suspend fun exportImage(taskId: String): okhttp3.ResponseBody = safeStreamCall { exportApi.exportImage(taskId) }
    suspend fun exportToSiyuan(taskId: String) { safeApiCall { exportApi.exportToSiyuan(taskId) } }
    suspend fun exportToObsidian(taskId: String) {
        safeApiCall { exportApi.exportToObsidian(taskId, ObsidianExportRequest()) }
    }

    // 导出配置检查（动态菜单）
    suspend fun getSiyuanConfig(): SiyuanConfigDto = safeApiCall { configApi.getSiyuanConfig() }
    suspend fun getObsidianConfig(): ObsidianConfigDto = safeApiCall { configApi.getObsidianConfig() }
}
```

### 任务 7.2：NoteDetailViewModel

**文件路径**：`videoNote_android/feature/notedetail/src/main/java/com/videonote/android/feature/notedetail/NoteDetailViewModel.kt`

```kotlin
package com.videonote.android.feature.notedetail

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.videonote.android.core.network.dto.ObsidianConfigDto
import com.videonote.android.core.network.dto.QuickViewResponse
import com.videonote.android.core.network.dto.SiyuanConfigDto
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class NoteDetailUiState(
    val note: QuickViewResponse? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
    val selectedTab: Int = 0, // 0=摘要 1=字幕 2=导图 3=原文
    val siyuanConfig: SiyuanConfigDto? = null,
    val obsidianConfig: ObsidianConfigDto? = null,
    val exportMessage: String? = null
)

@HiltViewModel
class NoteDetailViewModel @Inject constructor(
    private val repository: NoteDetailRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(NoteDetailUiState())
    val uiState: StateFlow<NoteDetailUiState> = _uiState.asStateFlow()

    fun loadNote(taskId: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val note = repository.getNoteDetail(taskId)
                _uiState.value = _uiState.value.copy(note = note, isLoading = false)
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, error = e.message)
            }
        }
    }

    fun selectTab(tab: Int) { _uiState.value = _uiState.value.copy(selectedTab = tab) }

    fun loadExportConfigs() {
        viewModelScope.launch {
            try {
                val siyuan = repository.getSiyuanConfig()
                val obsidian = repository.getObsidianConfig()
                _uiState.value = _uiState.value.copy(siyuanConfig = siyuan, obsidianConfig = obsidian)
            } catch (_: Exception) {}
        }
    }

    fun exportToSiyuan(taskId: String) {
        viewModelScope.launch {
            try {
                repository.exportToSiyuan(taskId)
                _uiState.value = _uiState.value.copy(exportMessage = "已导出到思源笔记")
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(exportMessage = "导出失败: ${e.message}")
            }
        }
    }

    fun exportToObsidian(taskId: String) {
        viewModelScope.launch {
            try {
                repository.exportToObsidian(taskId)
                _uiState.value = _uiState.value.copy(exportMessage = "已导出到 Obsidian")
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(exportMessage = "导出失败: ${e.message}")
            }
        }
    }
}
```

### 任务 7.3：NoteDetailScreen + 4 Tab

**文件路径**：`videoNote_android/feature/notedetail/src/main/java/com/videonote/android/feature/notedetail/NoteDetailScreen.kt`

```kotlin
package com.videonote.android.feature.notedetail

import android.webkit.WebView
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.videonote.android.core.common.ImageProxyHelper
import com.videonote.android.core.designsystem.component.VNLoading
import com.videonote.android.core.network.dto.QuickViewResponse
import dev.jeziellago.compose.markdowntext.MarkdownText

@Composable
fun NoteDetailScreen(
    taskId: String,
    onBack: () -> Unit,
    viewModel: NoteDetailViewModel = hiltViewModel(),
    imageProxyHelper: ImageProxyHelper = hiltViewModel()  // 通过 Hilt 注入
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(taskId) {
        viewModel.loadNote(taskId)
        viewModel.loadExportConfigs()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(uiState.note?.title ?: "笔记详情") },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, null) } },
                actions = { IconButton(onClick = { /* 更多操作 */ }) { Icon(Icons.Default.MoreVert, null) } }
            )
        },
        bottomBar = {
            // 底部操作栏：复制 | 导出 | 重做
            BottomAppBar {
                TextButton(onClick = { /* 复制 Markdown */ }) { Text("复制") }
                TextButton(onClick = { /* 显示导出 BottomSheet */ }) { Text("导出") }
                TextButton(onClick = { /* 重做 */ }) { Text("重做") }
            }
        }
    ) { padding ->
        if (uiState.isLoading) {
            VNLoading(modifier = Modifier.padding(padding))
            return@Scaffold
        }

        uiState.note?.let { note ->
            Column(modifier = Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState())) {
                // 封面图 / 视频播放区
                NoteMediaSection(note, imageProxyHelper)

                // 视频信息
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(note.title, style = MaterialTheme.typography.titleLarge)
                    Text(note.author, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.outline)
                    Row {
                        Text(note.platform, style = MaterialTheme.typography.labelSmall)
                        note.duration?.let { Text(" · $it", style = MaterialTheme.typography.labelSmall) }
                    }
                }

                // 4 Tab
                TabRow(selectedTabIndex = uiState.selectedTab) {
                    listOf("摘要", "字幕", "导图", "原文").forEachIndexed { index, label ->
                        Tab(selected = uiState.selectedTab == index, onClick = { viewModel.selectTab(index) }, text = { Text(label) })
                    }
                }

                when (uiState.selectedTab) {
                    // 摘要：Markdown 渲染（使用 compose-markdown 库）
                    0 -> note.summary?.let {
                        MarkdownText(
                            markdown = it,
                            modifier = Modifier.padding(16.dp).fillMaxWidth()
                        )
                    }
                    // 字幕：带时间轴的纯文本
                    1 -> note.subtitles?.let { Text(it, modifier = Modifier.padding(16.dp)) }
                    // 导图：Kotlin Canvas 渲染树形图
                    2 -> note.outline?.let {
                        MindMapCanvas(markdown = it, modifier = Modifier.fillMaxWidth().height(300.dp))
                    }
                    // 原文：分段文本 + 截图
                    3 -> {
                        Column(modifier = Modifier.padding(16.dp)) {
                            note.raw_article?.let { MarkdownText(markdown = it, modifier = Modifier.fillMaxWidth()) }
                            if (note.screenshots.isNotEmpty()) {
                                Spacer(Modifier.height(16.dp))
                                note.screenshots.forEach { screenshotUrl ->
                                    AsyncImage(
                                        model = imageProxyHelper.getProxyUrl(screenshotUrl, note.platform),
                                        contentDescription = null,
                                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

/**
 * 笔记媒体区：封面图始终显示，点击播放按钮后懒加载 WebView/播放器
 * - B站/抖音：WebView 加载移动端页面
 * - YouTube：WebView 嵌入播放器（后续可替换为官方 YouTube Player API）
 * - 本地文件：ExoPlayer
 */
@Composable
private fun NoteMediaSection(note: QuickViewResponse, imageProxyHelper: ImageProxyHelper) {
    var playerVisible by remember { mutableStateOf(false) }
    Box(modifier = Modifier.fillMaxWidth().height(200.dp)) {
        // 封面图（通过代理加载）
        AsyncImage(
            model = imageProxyHelper.getProxyUrl(note.cover_url, note.platform),
            contentDescription = null,
            modifier = Modifier.fillMaxSize()
        )
        // 播放按钮覆盖层（懒加载：点击后才初始化播放器）
        if (!playerVisible && note.video_url != null) {
            FloatingActionButton(
                onClick = { playerVisible = true },
                modifier = Modifier.align(Alignment.Center)
            ) {
                Icon(Icons.Default.PlayArrow, contentDescription = "播放")
            }
        }
        // 播放器（用户点击后懒加载）
        if (playerVisible && note.video_url != null) {
            when (note.platform) {
                "local", "local_audio" -> {
                    // 本地文件用 ExoPlayer
                    AndroidView(factory = { ctx ->
                        androidx.media3.ui.PlayerView(ctx).apply {
                            player = androidx.media3.exoplayer.ExoPlayer.Builder(ctx).build().apply {
                                setMediaItem(androidx.media3.common.MediaItem.fromUri(note.video_url))
                                prepare()
                                playWhenReady = true
                            }
                        }
                    }, modifier = Modifier.fillMaxSize())
                }
                else -> {
                    // B站/抖音/YouTube：WebView 加载移动端页面
                    AndroidView(factory = { ctx ->
                        WebView(ctx).apply {
                            settings.javaScriptEnabled = true
                            settings.domStorageEnabled = true
                            // 设置合理的 User-Agent（移动端）
                            settings.userAgentString = "Mozilla/5.0 (Linux; Android 12) Mobile"
                            loadUrl(note.video_url)
                        }
                    }, modifier = Modifier.fillMaxSize())
                }
            }
        }
    }
}
```

### 任务 7.4：MindMapCanvas 思维导图渲染

**文件路径**：`videoNote_android/feature/notedetail/src/main/java/com/videonote/android/feature/notedetail/MindMapCanvas.kt`

```kotlin
package com.videonote.android.feature.notedetail

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.material3.MaterialTheme

/**
 * 数据类：思维导图节点
 */
data class MindMapNode(
    val text: String,
    val level: Int,
    val children: List<MindMapNode> = emptyList(),
    var x: Float = 0f,
    var y: Float = 0f,
    var width: Float = 0f,
    var height: Float = 0f
)

/**
 * 从 Markdown 标题层级解析树结构
 * 支持 # / ## / ###
 */
fun parseMarkdownToTree(markdown: String): MindMapNode {
    val lines = markdown.lines().filter { it.startsWith("#") }
    if (lines.isEmpty()) return MindMapNode("无标题", 0)

    val root = MindMapNode(text = lines.first().removePrefix("#").trim(), level = 0)
    val stack = mutableListOf(root)

    for (line in lines.drop(1)) {
        val level = line.takeWhile { it == '#' }.length
        val text = line.dropWhile { it == '#' }.trim()
        val node = MindMapNode(text = text, level = level)

        while (stack.isNotEmpty() && stack.last().level >= level) {
            stack.removeAt(stack.lastIndex)
        }
        if (stack.isNotEmpty()) {
            val parent = stack.last()
            parent.children.add(node)
        }
        stack.add(node)
    }
    return root
}

/**
 * 思维导图 Canvas 渲染
 * 支持双指缩放 + 拖拽平移
 */
@Composable
fun MindMapCanvas(
    markdown: String,
    modifier: Modifier = Modifier
) {
    val tree = remember(markdown) { parseMarkdownToTree(markdown) }
    var scale by remember { mutableFloatStateOf(1f) }
    var offset by remember { mutableStateOf(Offset.Zero) }
    val textMeasurer = rememberTextMeasurer()
    val textColor = MaterialTheme.colorScheme.onSurface

    Canvas(
        modifier = modifier
            .fillMaxSize()
            .pointerInput(Unit) {
                detectTransformGestures { _, pan, zoom, _ ->
                    scale = (scale * zoom).coerceIn(0.5f, 3f)
                    offset += pan
                }
            }
    ) {
        // 布局：计算节点位置
        layoutTree(tree, size.width, size.height)

        // 绘制
        drawTree(tree, textMeasurer, textColor, scale, offset)
    }
}

private fun layoutTree(root: MindMapNode, canvasWidth: Float, canvasHeight: Float) {
    val nodeWidth = 120f
    val nodeHeight = 40f
    val horizontalGap = 40f
    val verticalGap = 20f

    // 简单布局：根节点在左侧，子节点向右展开
    root.x = 20f
    root.y = canvasHeight / 2
    root.width = nodeWidth
    root.height = nodeHeight

    layoutChildren(root, root.x + nodeWidth + horizontalGap, verticalGap)
}

private fun layoutChildren(parent: MindMapNode, childX: Float, gap: Float): Float {
    if (parent.children.isEmpty()) return parent.y

    val totalHeight = parent.children.size * (40f + gap) - gap
    var startY = parent.y - totalHeight / 2

    for (child in parent.children) {
        child.x = childX
        child.y = startY + 20f
        child.width = 120f
        child.height = 40f
        layoutChildren(child, childX + 120f + 40f, gap)
        startY += 40f + gap
    }
    return parent.y
}

private fun DrawScope.drawTree(
    node: MindMapNode,
    textMeasurer: TextMeasurer,
    textColor: Color,
    scale: Float,
    offset: Offset
) {
    // 绘制连线（贝塞尔曲线）
    for (child in node.children) {
        drawConnection(node, child, scale, offset)
        drawTree(child, textMeasurer, textColor, scale, offset)
    }

    // 绘制节点（圆角矩形 + 文字）
    val nodeColor = when (node.level) {
        0 -> Color(0xFF006A6A)
        1 -> Color(0xFF4A6363)
        else -> Color(0xFF4B6074)
    }

    val rect = androidx.compose.ui.geometry.Rect(
        offset = Offset(node.x * scale + offset.x, node.y * scale + offset.y),
        size = Size(node.width * scale, node.height * scale)
    )

    drawRect(
        color = nodeColor.copy(alpha = 0.2f),
        topLeft = rect.topLeft,
        size = rect.size
    )

    // 文字
    val measuredText = textMeasurer.measure(
        text = node.text.take(10),
        style = TextStyle(color = textColor, fontSize = 12.sp)
    )
    drawText(
        textMeasurer,
        node.text.take(10),
        topLeft = Offset(rect.left + 8f, rect.top + 8f),
        style = TextStyle(color = textColor, fontSize = 12.sp)
    )
}

private fun DrawScope.drawConnection(
    parent: MindMapNode,
    child: MindMapNode,
    scale: Float,
    offset: Offset
) {
    val startX = (parent.x + parent.width) * scale + offset.x
    val startY = (parent.y + parent.height / 2) * scale + offset.y
    val endX = child.x * scale + offset.x
    val endY = (child.y + child.height / 2) * scale + offset.y
    val midX = (startX + endX) / 2

    val path = Path().apply {
        moveTo(startX, startY)
        cubicTo(midX, startY, midX, endY, endX, endY)
    }
    drawPath(path, color = Color.Gray, style = Stroke(width = 2f))
}
```

### 任务 7.5：ExportSheet 导出底部弹窗

**文件路径**：`videoNote_android/feature/notedetail/src/main/java/com/videonote/android/feature/notedetail/ExportSheet.kt`

```kotlin
package com.videonote.android.feature.notedetail

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/**
 * 导出 Bottom Sheet
 * 动态显示：始终可用项 + 条件可用项（检查配置）
 */
@Composable
fun ExportSheet(
    noteId: String,
    siyuanEnabled: Boolean,
    obsidianEnabled: Boolean,
    onCopyMarkdown: () -> Unit,
    onExportPdf: () -> Unit,
    onExportImage: () -> Unit,
    onExportSiyuan: () -> Unit,
    onExportObsidian: () -> Unit,
    onDismiss: () -> Unit
) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("导出", style = MaterialTheme.typography.titleMedium)
            HorizontalDivider()

            // 始终可用
            ListItem(headlineContent = { Text("复制 Markdown") }, modifier = Modifier.clickable { onCopyMarkdown(); onDismiss() })
            ListItem(headlineContent = { Text("导出 PDF") }, modifier = Modifier.clickable { onExportPdf(); onDismiss() })
            ListItem(headlineContent = { Text("导出图片") }, modifier = Modifier.clickable { onExportImage(); onDismiss() })

            // 条件可用：只在已配置且已启用时显示
            if (siyuanEnabled) {
                HorizontalDivider()
                ListItem(headlineContent = { Text("导出到思源笔记") }, modifier = Modifier.clickable { onExportSiyuan(); onDismiss() })
            }
            if (obsidianEnabled) {
                ListItem(headlineContent = { Text("导出到 Obsidian") }, modifier = Modifier.clickable { onExportObsidian(); onDismiss() })
            }
        }
    }
}
```

> **关键点**：`siyuanEnabled` 和 `obsidianEnabled` 来自 ViewModel 中 `config.enabled == 1`（Int 类型比较，非 Boolean）。

**TDD**：写 `NoteDetailViewModelTest`，验证：
1. `loadNote(taskId)` -> note 不为空
2. `loadExportConfigs()` -> siyuanConfig 和 obsidianConfig 被加载
3. siyuanConfig.enabled=1 -> siyuanEnabled = true
4. siyuanConfig.enabled=0 -> siyuanEnabled = false

### ✅ 提交节点 7

```bash
git add videoNote_android/feature/notedetail/
git commit -m "feat(android): feature/notedetail - 笔记详情 + 4 Tab + 思维导图 Canvas + 导出动态菜单"
```

---

## 步骤 8：feature/feed 动态模块

### 任务 8.1：FeedRepository

**文件路径**：`videoNote_android/feature/feed/src/main/java/com/videonote/android/feature/feed/FeedRepository.kt`

```kotlin
package com.videonote.android.feature.feed

import com.videonote.android.core.network.api.FeedApi
import com.videonote.android.core.network.api.SubscriptionApi
import com.videonote.android.core.network.dto.*
import com.videonote.android.core.network.safeApiCall
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class FeedRepository @Inject constructor(
    private val feedApi: FeedApi,
    private val subscriptionApi: SubscriptionApi
) {
    suspend fun getFeed(page: Int = 1, unreadOnly: Boolean = false): FeedListResponse {
        return safeApiCall { feedApi.getFeed(page = page, unreadOnly = unreadOnly) }
    }

    suspend fun markRead(itemId: String) {
        safeApiCall { feedApi.markRead(itemId) }
    }

    suspend fun markAllRead() {
        safeApiCall { feedApi.markAllRead() }
    }

    suspend fun refresh() {
        safeApiCall { feedApi.refresh() }
    }

    suspend fun getUnreadCount(): UnreadCountResponse {
        return safeApiCall { feedApi.getUnreadCount() }
    }

    suspend fun generateNoteFromFeed(itemId: String, smartMode: Boolean = true): GenerateNoteResponse {
        return safeApiCall { feedApi.generateNoteFromFeed(itemId, smartMode) }
    }

    // 订阅管理
    suspend fun getSubscriptions(): List<SubscriptionDto> {
        return safeApiCall { subscriptionApi.getSubscriptions() }
    }

    suspend fun createSubscription(request: CreateSubscriptionRequest): SubscriptionDto {
        return safeApiCall { subscriptionApi.createSubscription(request) }
    }

    suspend fun deleteSubscription(id: String) {
        safeApiCall { subscriptionApi.deleteSubscription(id) }
    }

    suspend fun toggleSubscription(id: String) {
        safeApiCall { subscriptionApi.toggleSubscription(id) }
    }

    suspend fun parseChannelUrl(url: String): ChannelParseResponse {
        return safeApiCall { subscriptionApi.parseChannelUrl(ChannelParseRequest(url)) }
    }
}
```

**DTO 文件**：`videoNote_android/core/network/src/main/java/com/videonote/android/core/network/dto/SubscriptionDtos.kt`

```kotlin
package com.videonote.android.core.network.dto

import kotlinx.serialization.Serializable

@Serializable
data class SubscriptionDto(
    val id: String,
    val platform: String,
    val platform_id: String,
    val author: String,
    val avatar: String? = null,
    val enabled: Boolean = true,
    val last_updated: String = ""
)

@Serializable
data class CreateSubscriptionRequest(
    val url: String,
    val platform: String
)

@Serializable
data class ChannelParseRequest(
    val url: String
)

@Serializable
data class ChannelParseResponse(
    val platform: String,
    val platform_id: String,
    val author: String,
    val avatar: String? = null
)

@Serializable
data class ChannelVideosResponse(
    val videos: List<FeedItem> = emptyList(),
    val total: Int = 0
)
```

### 任务 8.2：FeedViewModel

**文件路径**：`videoNote_android/feature/feed/src/main/java/com/videonote/android/feature/feed/FeedViewModel.kt`

```kotlin
package com.videonote.android.feature.feed

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.videonote.android.core.network.dto.FeedItem
import com.videonote.android.core.network.dto.SubscriptionDto
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class FeedUiState(
    val items: List<FeedItem> = emptyList(),
    val subscriptions: List<SubscriptionDto> = emptyList(),
    val unreadCount: Int = 0,
    val isLoading: Boolean = false,
    val error: String? = null,
    val selectedItem: FeedItem? = null,
    val page: Int = 1,
    val hasMore: Boolean = true
)

@HiltViewModel
class FeedViewModel @Inject constructor(
    private val repository: FeedRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(FeedUiState())
    val uiState: StateFlow<FeedUiState> = _uiState.asStateFlow()

    init {
        loadFeed()
        loadSubscriptions()
        loadUnreadCount()
    }

    fun loadFeed(refresh: Boolean = false) {
        if (refresh) _uiState.value = _uiState.value.copy(page = 1, items = emptyList(), hasMore = true)
        val state = _uiState.value
        if (!state.hasMore && !refresh) return

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                val response = repository.getFeed(page = state.page)
                _uiState.value = _uiState.value.copy(
                    items = if (refresh) response.items else state.items + response.items,
                    isLoading = false,
                    page = state.page + 1,
                    hasMore = response.items.size >= 20
                )
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isLoading = false, error = e.message)
            }
        }
    }

    fun loadSubscriptions() {
        viewModelScope.launch {
            try { _uiState.value = _uiState.value.copy(subscriptions = repository.getSubscriptions()) }
            catch (e: Exception) { /* 静默 */ }
        }
    }

    fun loadUnreadCount() {
        viewModelScope.launch {
            try { _uiState.value = _uiState.value.copy(unreadCount = repository.getUnreadCount().count) }
            catch (_: Exception) {}
        }
    }

    fun selectItem(item: FeedItem) { _uiState.value = _uiState.value.copy(selectedItem = item) }
    fun clearSelectedItem() { _uiState.value = _uiState.value.copy(selectedItem = null) }

    fun markRead(itemId: String) {
        viewModelScope.launch {
            try {
                repository.markRead(itemId)
                _uiState.value = _uiState.value.copy(
                    items = _uiState.value.items.map { if (it.id == itemId) it.copy(is_read = true) else it },
                    unreadCount = (_uiState.value.unreadCount - 1).coerceAtLeast(0)
                )
            } catch (_: Exception) {}
        }
    }

    fun markAllRead() {
        viewModelScope.launch {
            try {
                repository.markAllRead()
                _uiState.value = _uiState.value.copy(
                    items = _uiState.value.items.map { it.copy(is_read = true) },
                    unreadCount = 0
                )
            } catch (_: Exception) {}
        }
    }

    fun refreshFeed() {
        viewModelScope.launch {
            try {
                repository.refresh()
                loadFeed(refresh = true)
                loadUnreadCount()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = e.message)
            }
        }
    }

    fun generateNoteFromFeed(itemId: String) {
        viewModelScope.launch {
            try {
                val response = repository.generateNoteFromFeed(itemId)
                // 通知 UI 导航到任务状态页或笔记详情
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = e.message)
            }
        }
    }

    fun addSubscription(url: String) {
        viewModelScope.launch {
            try {
                val parsed = repository.parseChannelUrl(url)
                repository.createSubscription(CreateSubscriptionRequest(url, parsed.platform))
                loadSubscriptions()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = e.message)
            }
        }
    }

    fun deleteSubscription(id: String) {
        viewModelScope.launch {
            try {
                repository.deleteSubscription(id)
                _uiState.value = _uiState.value.copy(
                    subscriptions = _uiState.value.subscriptions.filter { it.id != id }
                )
            } catch (_: Exception) {}
        }
    }
}
```

### 任务 8.3：FeedScreen + FeedItemCard + DetailBottomSheet

**文件路径**：`videoNote_android/feature/feed/src/main/java/com/videonote/android/feature/feed/FeedScreen.kt`

```kotlin
package com.videonote.android.feature.feed

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import coil.compose.AsyncImage
import com.videonote.android.core.common.ImageProxyHelper
import com.videonote.android.core.network.dto.FeedItem

@Composable
fun FeedScreen(
    onNavigateToNoteDetail: (String) -> Unit,
    viewModel: FeedViewModel = hiltViewModel(),
    imageProxyHelper: ImageProxyHelper = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("动态${if (uiState.unreadCount > 0) " (${uiState.unreadCount})" else ""}") },
                actions = {
                    IconButton(onClick = viewModel::markAllRead) { Icon(Icons.Default.Check, "全部已读") }
                    IconButton(onClick = viewModel::refreshFeed) { Icon(Icons.Default.Refresh, "刷新") }
                }
            )
        }
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            // 订阅频道横栏
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(uiState.subscriptions) { sub ->
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        AsyncImage(
                            model = imageProxyHelper.getProxyUrl(sub.avatar, sub.platform),
                            contentDescription = null,
                            modifier = Modifier.size(48.dp)
                        )
                        Text(sub.author, maxLines = 1, style = MaterialTheme.typography.labelSmall)
                    }
                }
                item {
                    IconButton(onClick = { /* 添加订阅对话框 */ }) { Icon(Icons.Default.Add, "添加") }
                }
            }

            // 动态列表
            LazyColumn(modifier = Modifier.fillMaxSize()) {
                items(uiState.items, key = { it.id }) { item ->
                    FeedItemCard(
                        item = item,
                        imageProxyHelper = imageProxyHelper,
                        onClick = { viewModel.selectItem(item) }
                    )
                    HorizontalDivider()
                }
                if (uiState.hasMore && !uiState.isLoading) {
                    item { LaunchedEffect(Unit) { viewModel.loadFeed() } }
                }
            }
        }
    }

    // 详情 Bottom Sheet
    uiState.selectedItem?.let { item ->
        ModalBottomSheet(onDismissRequest = viewModel::clearSelectedItem) {
            Column(modifier = Modifier.padding(16.dp)) {
                AsyncImage(
                    model = imageProxyHelper.getProxyUrl(item.cover_url, item.platform),
                    contentDescription = null,
                    modifier = Modifier.fillMaxWidth().height(180.dp)
                )
                Spacer(Modifier.height(8.dp))
                Text(item.title, style = MaterialTheme.typography.titleMedium)
                Text(item.author, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.outline)
                item.description.takeIf { it.isNotBlank() }?.let {
                    Text(it, maxLines = 3, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodyMedium)
                }
                Spacer(Modifier.height(16.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (item.note_available && item.available_task_id != null) {
                        Button(onClick = { onNavigateToNoteDetail(item.available_task_id) }) { Text("查看笔记") }
                    } else {
                        Button(onClick = { viewModel.generateNoteFromFeed(item.id) }) { Text("生成笔记") }
                    }
                    if (!item.is_read) {
                        OutlinedButton(onClick = { viewModel.markRead(item.id) }) { Text("标记已读") }
                    }
                }
            }
        }
    }
}

@Composable
private fun FeedItemCard(item: FeedItem, imageProxyHelper: ImageProxyHelper, onClick: () -> Unit) {
    ListItem(
        headlineContent = { Text(item.title, maxLines = 2, overflow = TextOverflow.Ellipsis) },
        supportingContent = { Text(item.author, style = MaterialTheme.typography.bodySmall) },
        leadingContent = {
            AsyncImage(
                model = imageProxyHelper.getProxyUrl(item.cover_url, item.platform),
                contentDescription = null,
                modifier = Modifier.size(56.dp)
            )
        },
        trailingContent = {
            if (item.note_available) Text("已生成", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.tertiary)
            else if (!item.is_read) Text("未读", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
        },
        modifier = Modifier.clickable { onClick() }
    )
}
```

**TDD**：写 `FeedViewModelTest`，验证：
1. 初始加载 -> items 不为空, unreadCount > 0
2. `markRead(id)` -> 该项 is_read = true, unreadCount 减 1
3. `markAllRead()` -> 全部 is_read = true, unreadCount = 0
4. `addSubscription(url)` -> subscriptions 增加一项

### ✅ 提交节点 8

```bash
git add videoNote_android/feature/feed/
git commit -m "feat(android): feature/feed - 动态列表 + 订阅管理 + Bottom Sheet 详情"
```

---

## 步骤 9：feature/settings 设置模块

### 任务 9.1：SettingsViewModel

**文件路径**：`videoNote_android/feature/settings/src/main/java/com/videonote/android/feature/settings/SettingsViewModel.kt`

```kotlin
package com.videonote.android.feature.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.videonote.android.core.common.EncryptedDataStore
import com.videonote.android.core.network.SessionManager
import com.videonote.android.core.network.api.AuthApi
import com.videonote.android.core.network.api.ConfigApi
import com.videonote.android.core.network.dto.ChangePasswordRequest
import com.videonote.android.core.network.safeApiCall
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class SettingsUiState(
    val serverUrl: String = "",
    val username: String = "",
    val themeMode: String = "system",
    val healthStatus: String? = null,
    val oldPassword: String = "",
    val newPassword: String = "",
    val isChangingPassword: Boolean = false,
    val message: String? = null,
    val isLoggedOut: Boolean = false
)

@HiltViewModel
class SettingsViewModel @Inject constructor(
    private val authApi: AuthApi,
    private val configApi: ConfigApi,
    private val sessionManager: SessionManager,
    private val dataStore: EncryptedDataStore
) : ViewModel() {

    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    init {
        viewModelScope.launch {
            dataStore.serverUrl.collect { url -> _uiState.value = _uiState.value.copy(serverUrl = url ?: "") }
        }
        viewModelScope.launch {
            dataStore.username.collect { name -> _uiState.value = _uiState.value.copy(username = name ?: "") }
        }
        viewModelScope.launch {
            dataStore.themeMode.collect { mode -> _uiState.value = _uiState.value.copy(themeMode = mode) }
        }
    }

    fun updateOldPassword(pwd: String) { _uiState.value = _uiState.value.copy(oldPassword = pwd) }
    fun updateNewPassword(pwd: String) { _uiState.value = _uiState.value.copy(newPassword = pwd) }

    fun changePassword() {
        val state = _uiState.value
        if (state.oldPassword.isBlank() || state.newPassword.isBlank()) {
            _uiState.value = state.copy(message = "请填写完整")
            return
        }
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isChangingPassword = true, message = null)
            try {
                safeApiCall {
                    authApi.changePassword(ChangePasswordRequest(state.oldPassword, state.newPassword))
                }
                _uiState.value = _uiState.value.copy(isChangingPassword = false, message = "密码修改成功", oldPassword = "", newPassword = "")
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(isChangingPassword = false, message = "修改失败: ${e.message}")
            }
        }
    }

    fun setThemeMode(mode: String) {
        viewModelScope.launch { dataStore.setThemeMode(mode) }
    }

    fun checkHealth() {
        viewModelScope.launch {
            try {
                val health = safeApiCall { configApi.getHealth() }
                _uiState.value = _uiState.value.copy(healthStatus = "${health.status} (v${health.version})")
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(healthStatus = "连接失败: ${e.message}")
            }
        }
    }

    fun updateServerUrl(url: String) {
        viewModelScope.launch {
            dataStore.setServerUrl(url)
            sessionManager.setServerUrl(url)
            _uiState.value = _uiState.value.copy(message = "服务器地址已更新，请重新登录")
        }
    }

    fun logout() {
        viewModelScope.launch {
            sessionManager.clearToken()
            dataStore.setToken(null)
            _uiState.value = _uiState.value.copy(isLoggedOut = true)
        }
    }
}
```

### 任务 9.2：SettingsScreen

**文件路径**：`videoNote_android/feature/settings/src/main/java/com/videonote/android/feature/settings/SettingsScreen.kt`

```kotlin
package com.videonote.android.feature.settings

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle

@Composable
fun SettingsScreen(
    onLogout: () -> Unit,
    viewModel: SettingsViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var showChangePasswordDialog by remember { mutableStateOf(false) }
    var showServerUrlDialog by remember { mutableStateOf(false) }

    LaunchedEffect(uiState.isLoggedOut) {
        if (uiState.isLoggedOut) onLogout()
    }

    LazyColumn(modifier = Modifier.fillMaxSize()) {
        // 用户信息卡片
        item {
            Card(modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text(uiState.username, style = MaterialTheme.typography.titleMedium)
                    Text(uiState.serverUrl, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.outline)
                }
            }
        }

        // 服务器地址
        item {
            ListItem(
                headlineContent = { Text("服务器地址") },
                supportingContent = { Text(uiState.serverUrl) },
                modifier = Modifier.clickable { showServerUrlDialog = true }
            )
        }

        // 修改密码
        item {
            ListItem(
                headlineContent = { Text("修改密码") },
                modifier = Modifier.clickable { showChangePasswordDialog = true }
            )
        }

        // 深色模式
        item {
            Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                Text("深色模式", style = MaterialTheme.typography.bodyLarge)
                Row {
                    listOf("system" to "跟随系统", "light" to "浅色", "dark" to "深色").forEach { (value, label) ->
                        FilterChip(
                            selected = uiState.themeMode == value,
                            onClick = { viewModel.setThemeMode(value) },
                            label = { Text(label) },
                            modifier = Modifier.padding(end = 8.dp)
                        )
                    }
                }
            }
        }

        // 系统健康检查
        item {
            ListItem(
                headlineContent = { Text("系统健康检查") },
                supportingContent = uiState.healthStatus?.let { { Text(it) } },
                modifier = Modifier.clickable { viewModel.checkHealth() }
            )
        }

        // 关于
        item {
            ListItem(
                headlineContent = { Text("关于") },
                supportingContent = { Text("VideoNote Android v1.0.0") }
            )
        }

        // 退出登录
        item {
            Button(
                onClick = viewModel::logout,
                modifier = Modifier.fillMaxWidth().padding(16.dp),
                colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)
            ) {
                Text("退出登录")
            }
        }
    }

    // 消息提示
    uiState.message?.let { msg ->
        LaunchedEffect(msg) { /* 显示 Snackbar */ }
    }

    // 修改密码对话框
    if (showChangePasswordDialog) {
        AlertDialog(
            onDismissRequest = { showChangePasswordDialog = false },
            title = { Text("修改密码") },
            text = {
                Column {
                    OutlinedTextField(value = uiState.oldPassword, onValueChange = viewModel::updateOldPassword, label = { Text("旧密码") }, singleLine = true)
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(value = uiState.newPassword, onValueChange = viewModel::updateNewPassword, label = { Text("新密码") }, singleLine = true)
                }
            },
            confirmButton = { TextButton(onClick = { viewModel.changePassword(); showChangePasswordDialog = false }) { Text("确认") } },
            dismissButton = { TextButton(onClick = { showChangePasswordDialog = false }) { Text("取消") } }
        )
    }

    // 修改服务器地址对话框
    if (showServerUrlDialog) {
        var newUrl by remember { mutableStateOf(uiState.serverUrl) }
        AlertDialog(
            onDismissRequest = { showServerUrlDialog = false },
            title = { Text("修改服务器地址") },
            text = {
                OutlinedTextField(value = newUrl, onValueChange = { newUrl = it }, label = { Text("服务器地址") }, singleLine = true)
            },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.updateServerUrl(newUrl)
                    showServerUrlDialog = false
                }) { Text("确认") }
            },
            dismissButton = { TextButton(onClick = { showServerUrlDialog = false }) { Text("取消") } }
        )
    }
}
```

**TDD**：写 `SettingsViewModelTest`，验证：
1. `changePassword()` 空密码 -> message = "请填写完整"
2. mock 成功 -> message = "密码修改成功"
3. `logout()` -> isLoggedOut = true
4. `setThemeMode("dark")` -> themeMode = "dark"

### ✅ 提交节点 9

```bash
git add videoNote_android/feature/settings/
git commit -m "feat(android): feature/settings - 极简设置页 + 服务器地址修改 + 深色模式 + 退出登录"
```

---

## 步骤 10：集成测试 + 优化

### 任务 10.1：完善导航图（完整底部导航）

**文件路径**：`videoNote_android/app/src/main/java/com/videonote/android/navigation/AppNavHost.kt`（更新）

```kotlin
package com.videonote.android.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddCircle
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.RssFeed
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.compose.*
import androidx.navigation.toRoute
import com.videonote.android.core.designsystem.theme.ThemeMode
import com.videonote.android.core.designsystem.theme.VideoNoteTheme
import com.videonote.android.feature.auth.LoginScreen
import com.videonote.android.feature.feed.FeedScreen
import com.videonote.android.feature.home.HomeScreen
import com.videonote.android.feature.notedetail.NoteDetailScreen
import com.videonote.android.feature.notelist.CollectionDetailScreen
import com.videonote.android.feature.notelist.NoteListScreen
import com.videonote.android.feature.settings.SettingsScreen

/**
 * 主导航图。
 * 使用类型安全路由（Route sealed class），通过 toRoute() 提取参数。
 * 启动时根据 token 是否存在决定起始页。
 */
@Composable
fun AppNavHost(
    mainViewModel: MainViewModel = hiltViewModel()
) {
    val navController = rememberNavController()
    val token by mainViewModel.token.collectAsStateWithLifecycle(initialValue = null)
    val themeMode by mainViewModel.themeMode.collectAsStateWithLifecycle(initialValue = "system")

    val startDestination: Route = if (token != null) Route.Home else Route.Login

    VideoNoteTheme(
        themeMode = when (themeMode) {
            "light" -> ThemeMode.LIGHT
            "dark" -> ThemeMode.DARK
            else -> ThemeMode.SYSTEM
        }
    ) {
        Scaffold(
            bottomBar = {
                val navBackStackEntry by navController.currentBackStackEntryAsState()
                val currentDestination = navBackStackEntry?.destination
                // 只在 4 个主 Tab 上显示底部导航栏
                val mainRoutes = setOf(
                    Route.Home::class, Route.Notes::class, Route.Feed::class, Route.Settings::class
                )
                val showBottomBar = currentDestination?.hierarchy?.any { dest ->
                    mainRoutes.any { it.simpleName == dest.route }
                } == true
                if (showBottomBar && token != null) {
                    NavigationBar {
                        val items = listOf(
                            Triple(Route.Home, "首页", Icons.Default.Home),
                            Triple(Route.Notes, "笔记", Icons.Default.MenuBook),
                            Triple(Route.Feed, "动态", Icons.Default.RssFeed),
                            Triple(Route.Settings, "设置", Icons.Default.Settings)
                        )
                        items.forEach { (route, label, icon) ->
                            NavigationBarItem(
                                selected = currentDestination?.hierarchy?.any { it.route == route::class.simpleName } == true,
                                onClick = {
                                    navController.navigate(route) {
                                        popUpTo(Route.Home) { saveState = true }
                                        launchSingleTop = true
                                        restoreState = true
                                    }
                                },
                                icon = { Icon(icon, label) },
                                label = { Text(label) }
                            )
                        }
                    }
                }
            }
        ) { padding ->
            NavHost(
                navController = navController,
                startDestination = startDestination,
                modifier = Modifier.padding(padding)
            ) {
                composable<Route.Login> {
                    LoginScreen(onLoginSuccess = {
                        navController.navigate(Route.Home) {
                            popUpTo(Route.Login) { inclusive = true }
                        }
                    })
                }
                composable<Route.Home> {
                    HomeScreen(
                        onNavigateToNoteDetail = { taskId -> navController.navigate(Route.NoteDetail(taskId)) },
                        onOpenUserMenu = { navController.navigate(Route.Settings) }
                    )
                }
                composable<Route.Notes> {
                    NoteListScreen(
                        onNoteClick = { taskId -> navController.navigate(Route.NoteDetail(taskId)) },
                        onCollectionClick = { id -> navController.navigate(Route.CollectionDetail(id)) }
                    )
                }
                composable<Route.Feed> {
                    FeedScreen(onNavigateToNoteDetail = { taskId -> navController.navigate(Route.NoteDetail(taskId)) })
                }
                composable<Route.Settings> {
                    SettingsScreen(onLogout = {
                        navController.navigate(Route.Login) { popUpTo(0) { inclusive = true } }
                    })
                }
                // 类型安全路由参数提取：使用 toRoute() 扩展函数
                composable<Route.NoteDetail> { backStackEntry ->
                    val route = backStackEntry.toRoute<Route.NoteDetail>()
                    NoteDetailScreen(taskId = route.taskId, onBack = { navController.popBackStack() })
                }
                composable<Route.CollectionDetail> { backStackEntry ->
                    val route = backStackEntry.toRoute<Route.CollectionDetail>()
                    CollectionDetailScreen(
                        collectionId = route.collectionId,
                        onBack = { navController.popBackStack() },
                        onNoteClick = { taskId -> navController.navigate(Route.NoteDetail(taskId)) }
                    )
                }
            }
        }
    }
}
```

**文件路径**：`videoNote_android/app/src/main/java/com/videonote/android/navigation/MainViewModel.kt`

```kotlin
package com.videonote.android.navigation

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.videonote.android.core.common.EncryptedDataStore
import com.videonote.android.core.network.SessionRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * 主 ViewModel：管理全局状态（token、主题），在 App 启动时恢复会话。
 */
@HiltViewModel
class MainViewModel @Inject constructor(
    private val dataStore: EncryptedDataStore,
    private val sessionRepository: SessionRepository
) : ViewModel() {

    val token: StateFlow<String?> = dataStore.token.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), null
    )

    val themeMode: StateFlow<String> = dataStore.themeMode.stateIn(
        viewModelScope, SharingStarted.WhileSubscribed(5000), "system"
    )

    init {
        // 启动时恢复 token 和 serverUrl 到 SessionManager
        viewModelScope.launch { sessionRepository.restoreSession() }
    }
}
```

### 任务 10.2：SessionRepository 启动恢复

**文件路径**：`videoNote_android/core/network/src/main/java/com/videonote/android/core/network/SessionRepository.kt`

```kotlin
package com.videonote.android.core.network

import com.videonote.android.core.common.EncryptedDataStore
import kotlinx.coroutines.flow.first
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 会话恢复：App 启动时从 EncryptedDataStore 恢复 token 和 serverUrl 到 SessionManager
 */
@Singleton
class SessionRepository @Inject constructor(
    private val sessionManager: SessionManager,
    private val dataStore: EncryptedDataStore
) {
    suspend fun restoreSession(): Boolean {
        val token = dataStore.token.first()
        val serverUrl = dataStore.serverUrl.first()

        if (token != null && serverUrl != null) {
            sessionManager.setToken(token)
            sessionManager.setServerUrl(serverUrl)
            return true
        }
        return false
    }
}
```

### 任务 10.3：SessionManager 401 全局处理

更新 `AuthInterceptor`，在 401 时通过 EventBus 或 SharedFlow 通知 UI 层跳转登录页：

```kotlin
// 在 SessionManager 中添加
private val _authExpired = MutableSharedFlow<Unit>()
val authExpired: SharedFlow<Unit> = _authExpired

// 在 AuthInterceptor 中 401 时触发
if (response.code == 401) {
    sessionManager.clearToken()
    // 注意：Interceptor 在 IO 线程，不能直接调用 SharedFlow.emit
    // 使用 tryEmit
    sessionManager._authExpired.tryEmit(Unit)
}
```

在 `AppNavHost` 中收集 `authExpired` 事件，自动跳转登录页。

### 任务 10.4：Coil 图片代理配置

**文件路径**：`videoNote_android/app/src/main/java/com/videonote/android/di/CoilModule.kt`

```kotlin
package com.videonote.android.di

import coil.ImageLoader
import coil.disk.DiskCache
import coil.memory.MemoryCache
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object CoilModule {

    @Provides
    @Singleton
    fun provideImageLoader(): ImageLoader {
        return ImageLoader.Builder(/* context */)
            .memoryCache { MemoryCache.Builder().maxSizePercent(0.25).build() }
            .diskCache { DiskCache.Builder().directory(/* cacheDir */).maxSizeBytes(100L * 1024 * 1024).build() }
            .build()
    }
}
```

> **图片代理使用**：对于 B站/抖音封面图，不直接加载原始 URL，而是构造代理 URL：
> `GET /api/image_proxy?url=<原始URL>` -> 通过后端转发，后端自动处理 Referer。

### 任务 10.5：端到端测试

**测试路径**：

1. **登录流程**：输入服务器地址 + 用户名密码 -> 登录成功 -> 进入首页
2. **生成笔记**：粘贴 URL -> 自动识别平台 -> 点击生成 -> 轮询状态 -> 查看笔记
3. **笔记列表**：切换平台筛选 -> 搜索 -> 点击进入详情 -> 长按删除
4. **收藏夹**：新建收藏夹 -> 添加笔记 -> 查看详情 -> 删除
5. **动态**：查看 Feed -> 点击展开 -> 生成笔记 -> 标记已读
6. **导出**：笔记详情 -> 导出 PDF -> 导出图片 -> 导出思源（如已配置）
7. **设置**：修改服务器地址 -> 修改密码 -> 切换深色模式 -> 退出登录

**性能优化清单**：
- [ ] LazyVerticalGrid/LazyColumn 添加 `key` 参数
- [ ] 图片加载添加占位图和错误图
- [ ] ViewModel 使用 `collectAsStateWithLifecycle` 避免后台收集
- [ ] 网络请求超时配置（30s 连接，60s 读写）
- [ ] 思维导图 Canvas 大数据量时分页或虚拟化
- [ ] 深色模式全量适配验证

### ✅ 提交节点 10

```bash
git add videoNote_android/
git commit -m "feat(android): 集成测试 + 导航完善 + 会话恢复 + 401 全局处理 + 性能优化"
```

---

## 附录：关键实现要点速查

### A1. API 双重错误格式处理

```kotlin
// safeApiCall 已处理两种格式：
// 1. HTTP 200 + {code: 非0, msg} -> ApiException
// 2. HTTP 4xx/5xx + {detail} -> HttpException
// UI 层统一 catch Exception，显示 message
```

### A2. enabled 字段是 Int 不是 Boolean

```kotlin
// 后端 siyuan/obsidian config 的 enabled 是 Int (0/1)
// 判断方式：
if (config.enabled == 1) { /* 已启用 */ }
// 不是 if (config.enabled) 或 if (config.enabled == true)
```

### A3. generate_note 复用检测

```kotlin
// response.reused == true 表示笔记已存在，后端复用了已有笔记
// response.reuse_type 表示复用类型
// UI 应提示用户"该视频已有笔记，已复用"
```

### A4. tags 是 JSON 字符串

```kotlin
// task_status SUCCESS 响应中 result.tags 是 JSON 字符串，不是数组
// 需要反序列化：Json.decodeFromString<List<String>>(tagsString)
```

### A5. 图片代理 URL 构造

```kotlin
// 对于有 Referer 限制的封面图（B站、抖音），使用图片代理：
val proxyUrl = "${serverUrl}/api/image_proxy?url=${URLEncoder.encode(originalUrl, "UTF-8")}"
// Coil 加载 proxyUrl 而非 originalUrl
```

### A6. Obsidian 导出 content_sections

```kotlin
// Obsidian 导出默认全选：
ObsidianExportRequest(
    content_sections = listOf("summary", "raw_article", "subtitles", "outline", "screenshots")
)
```

### A7. 思维导图 Canvas 第一版限制

- 仅解析 Markdown 标题层级（#/##/###）
- 不支持 checkbox、列表等节点类型（后续扩展）
- 节点文字截断为前 10 个字符（避免溢出）
- 支持双指缩放（0.5x-3x）和拖拽平移

### A8. 视频播放策略

| 平台 | 播放方式 |
|------|----------|
| Bilibili | WebView 加载移动端页面 |
| 抖音 | WebView 加载移动端页面 |
| YouTube | YouTube Player API |
| 本地文件 | ExoPlayer |
| 其他 | 封面图占位，不播放 |

### A9. 文件上传

```kotlin
// POST /api/upload 使用 multipart/form-data
val filePart = MultipartBody.Part.createFormData(
    "file", file.name, file.asRequestBody("video/*".toMediaType())
)
val response = noteApi.uploadFile(filePart)
// response.file_path 传给 generate_note 的 file_path 参数
```

### A10. smart_mode 切换逻辑

```kotlin
// 默认 smart_mode = true，用户不选模型
// 用户手动选模型时：smart_mode = false, model_name = "xxx", provider_id = 1
// 切回智能模式时：smart_mode = true, 清空 model_name 和 provider_id
```

### A11. Room/数据库决策（v1 不实现离线缓存）

设计文档中列出了 `core/database` 模块和 Room 依赖，但 v1 精简版**不实现离线缓存**：
- 所有数据实时从后端 API 获取
- Room 模块和依赖在 v1 中**移除**，后续版本如需离线支持再添加
- `settings.gradle.kts` 中**不** include `:core:database`
- `DatabaseModule.kt` **不**创建

> 后续如需离线缓存：为 TaskItem/FeedItem 添加 Room Entity + DAO，在 Repository 中先查本地、再请求远程。

### A12. 测试基础设施

各模块 `build.gradle.kts` 需添加测试依赖（在 `libs.versions.toml` 中声明）：

```toml
[versions]
junit = "4.13.2"
mockk = "1.13.13"
turbine = "1.2.0"
coroutinesTest = "1.9.0"

[libraries]
junit = { group = "junit", name = "junit", version.ref = "junit" }
mockk = { group = "io.mockk", name = "mockk", version.ref = "mockk" }
turbine = { group = "app.cash.turbine", name = "turbine", version.ref = "turbine" }
coroutines-test = { group = "org.jetbrains.kotlinx", name = "kotlinx-coroutines-test", version.ref = "coroutinesTest" }
```

每个模块 `build.gradle.kts` 的 `dependencies` 块添加：

```kotlin
dependencies {
    testImplementation(libs.junit)
    testImplementation(libs.mockk)
    testImplementation(libs.turbine)
    testImplementation(libs.coroutines.test)
}
```

### A13. JitPack 仓库（compose-markdown）

`compose-markdown` 库托管在 JitPack，需在 `settings.gradle.kts` 中添加仓库：

```kotlin
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
        maven { url = uri("https://jitpack.io") }  // compose-markdown
    }
}
```

### A14. 401 全局处理（AuthInterceptor -> UI 跳转）

`SessionManager` 暴露 `authExpired` 事件流，`AuthInterceptor` 在 401 时触发：

```kotlin
// SessionManager 中添加：
private val _authExpired = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
val authExpired: SharedFlow<Unit> = _authExpired

fun notifyAuthExpired() {
    _authExpired.tryEmit(Unit)
}

// AuthInterceptor 中 401 时调用：
if (response.code == 401) {
    sessionManager.clearToken()
    sessionManager.notifyAuthExpired()
}

// MainViewModel 中收集事件，触发跳转：
viewModelScope.launch {
    sessionManager.authExpired.collect {
        // 通知 UI 跳转登录页
        _navigateToLogin.value = true
    }
}
```

### A15. 导出文件保存

PDF/图片导出后需保存到设备，通过 `MediaStore` 写入 Downloads 目录：

```kotlin
suspend fun saveResponseBodyToDownloads(
    context: Context,
    body: okhttp3.ResponseBody,
    fileName: String,
    mimeType: String
): Uri {
    val resolver = context.contentResolver
    val contentValues = ContentValues().apply {
        put(MediaStore.MediaColumns.DISPLAY_NAME, fileName)
        put(MediaStore.MediaColumns.MIME_TYPE, mimeType)
        put(MediaStore.MediaColumns.RELATIVE_PATH, "Downloads/VideoNote")
    }
    val uri = resolver.insert(MediaStore.Files.getContentUri("external"), contentValues)
        ?: throw IOException("无法创建文件")
    resolver.openOutputStream(uri)?.use { out ->
        body.byteStream().use { it.copyTo(out) }
    }
    return uri
}
```

### A16. Markdown 渲染说明

使用 `dev.jeziellago:compose-markdown` 库渲染 Markdown 内容：

```kotlin
// build.gradle.kts (feature:notedetail 模块)
implementation(libs.compose.markdown)

// 使用
MarkdownText(
    markdown = note.summary,
    modifier = Modifier.padding(16.dp).fillMaxWidth()
)
```

支持：标题、列表、代码块、图片、链接等常用 Markdown 语法。

