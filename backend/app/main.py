from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse

from app.config import settings

app = FastAPI(
    title="PathShala EdTech API",
    description="Backend API for the PathShala JEE/NEET cohort-based learning platform.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", include_in_schema=False)
def root():
    return RedirectResponse(url="/docs")


@app.get("/health", tags=["health"])
def health_check():
    """Simple health check endpoint — confirms the server is running."""
    return {"status": "ok", "service": "pathshala-api"}


# ---------------------------------------------------------------------------
# Routers are registered here as each module spec is completed
# ---------------------------------------------------------------------------
# from app.routers import clerk_webhooks, courses, payments, media, batches
# from app.routers import tests, admin, doubts, bookmarks, notifications

# app.include_router(clerk_webhooks.router)
# app.include_router(courses.router, prefix="/courses", tags=["courses"])
# app.include_router(payments.router, prefix="/payments", tags=["payments"])
# app.include_router(media.router, prefix="/media", tags=["media"])
# app.include_router(batches.router, prefix="/batches", tags=["batches"])
# app.include_router(tests.router, prefix="/tests", tags=["tests"])
# app.include_router(admin.router, prefix="/admin", tags=["admin"])
# app.include_router(doubts.router, prefix="/doubts", tags=["doubts"])
# app.include_router(bookmarks.router, prefix="/bookmarks", tags=["bookmarks"])
# app.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
