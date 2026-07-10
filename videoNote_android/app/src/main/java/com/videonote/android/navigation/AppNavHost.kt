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
