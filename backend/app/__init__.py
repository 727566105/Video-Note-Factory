from fastapi import FastAPI

from .routers import note, provider, model, config, export, siyuan, webdav, config_backup, health, auth, user, subscription, feed, channels, authors, screenshot, collection, obsidian, note_share


def create_app(lifespan) -> FastAPI:
    app = FastAPI(title="videoNote",lifespan=lifespan)
    app.include_router(user.router, prefix="/api/user", tags=["user"])
    app.include_router(health.router, prefix="/api", tags=["health"])
    app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
    app.include_router(note.router, prefix="/api")
    app.include_router(provider.router, prefix="/api")
    app.include_router(model.router,prefix="/api")
    app.include_router(config.router,  prefix="/api")
    app.include_router(export.router, prefix="/api/export")
    app.include_router(siyuan.router, prefix="/api/siyuan")
    app.include_router(webdav.router, prefix="/api/webdav")
    app.include_router(config_backup.router, prefix="/api/configs", tags=["配置备份"])
    app.include_router(subscription.router)
    app.include_router(feed.router)
    app.include_router(channels.router)
    app.include_router(authors.router)
    app.include_router(screenshot.router)
    app.include_router(screenshot.cover_router)
    app.include_router(screenshot.video_router)
    app.include_router(screenshot.media_router)
    app.include_router(collection.router)
    app.include_router(obsidian.router, prefix="/api/obsidian")
    app.include_router(note_share.router, prefix="/api/notes/share", tags=["笔记分享"])

    # 挂载 MCP Server（Streamable HTTP，内部路由 /mcp）
    from app.mcp_server import mcp_auth_middleware
    app.mount("/", mcp_auth_middleware)

    return app
