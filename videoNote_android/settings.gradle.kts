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
