from fastapi import FastAPI

from .routers import note, provider, model, config, export, siyuan



def create_app(lifespan) -> FastAPI:
    app = FastAPI(title="BiliNote",lifespan=lifespan)
    app.include_router(note.router, prefix="/api")
    app.include_router(provider.router, prefix="/api")
    app.include_router(model.router,prefix="/api")
    app.include_router(config.router,  prefix="/api")
    app.include_router(export.router, prefix="/api/export")
    app.include_router(siyuan.router, prefix="/api/siyuan")

    return app
