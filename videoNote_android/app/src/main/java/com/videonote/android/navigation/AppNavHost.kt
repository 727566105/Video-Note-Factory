package com.videonote.android.navigation

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.RssFeed
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.compose.*
import androidx.navigation.toRoute
import com.videonote.android.core.designsystem.theme.*
import com.videonote.android.feature.auth.LoginScreen
import com.videonote.android.feature.feed.FeedScreen
import com.videonote.android.feature.home.HomeScreen
import com.videonote.android.feature.notedetail.NoteDetailScreen
import com.videonote.android.feature.notelist.CollectionDetailScreen
import com.videonote.android.feature.notelist.NoteListScreen
import com.videonote.android.feature.settings.SettingsScreen

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
            else -> ThemeMode.DARK  // SYSTEM 也走暗色
        }
    ) {
        Scaffold(
            containerColor = XaiBg,
            bottomBar = {
                val navBackStackEntry by navController.currentBackStackEntryAsState()
                val currentDestination = navBackStackEntry?.destination
                val mainRoutes = setOf(
                    Route.Home::class, Route.Notes::class, Route.Feed::class, Route.Settings::class
                )
                val showBottomBar = currentDestination?.hierarchy?.any { dest ->
                    mainRoutes.any { it.simpleName == dest.route }
                } == true
                if (showBottomBar && token != null) {
                    XaiBottomBar(
                        currentRoute = currentDestination?.route,
                        onNavigate = { route ->
                            navController.navigate(route) {
                                popUpTo(Route.Home) { saveState = true }
                                launchSingleTop = true
                                restoreState = true
                            }
                        }
                    )
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

/// xAI 风格底部导航栏
@Composable
private fun XaiBottomBar(
    currentRoute: String?,
    onNavigate: (Route) -> Unit
) {
    Column {
        HorizontalDivider(thickness = 1.dp, color = XaiBorder)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(XaiBg)
                .navigationBarsPadding()
        ) {
            val items = listOf(
                BottomNavItem("Home", "首页", Icons.Default.Home) { onNavigate(Route.Home) },
                BottomNavItem("Notes", "笔记", Icons.Default.MenuBook) { onNavigate(Route.Notes) },
                BottomNavItem("Feed", "动态", Icons.Default.RssFeed) { onNavigate(Route.Feed) },
                BottomNavItem("Settings", "设置", Icons.Default.Settings) { onNavigate(Route.Settings) }
            )
            items.forEach { item ->
                val active = currentRoute == item.routeName
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clickable { item.onClick() }
                        .padding(top = 10.dp, bottom = 6.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // active 顶部 2px 白条
                    Box(
                        modifier = Modifier
                            .width(24.dp)
                            .height(2.dp)
                            .background(if (active) XaiFg else Color.Transparent)
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Icon(
                        imageVector = item.icon,
                        contentDescription = item.label,
                        tint = if (active) XaiFg else XaiMuted,
                        modifier = Modifier.size(22.dp)
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = item.label,
                        style = TextStyle(
                            fontSize = 10.sp,
                            fontFamily = FontFamily.Monospace,
                            letterSpacing = 0.6.sp
                        ),
                        color = if (active) XaiFg else XaiMuted
                    )
                }
            }
        }
    }
}

private data class BottomNavItem(
    val routeName: String,
    val label: String,
    val icon: androidx.compose.ui.graphics.vector.ImageVector,
    val onClick: () -> Unit
)
