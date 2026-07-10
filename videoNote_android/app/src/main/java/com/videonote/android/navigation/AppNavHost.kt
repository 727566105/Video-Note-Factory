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
