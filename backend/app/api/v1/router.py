from fastapi import APIRouter

from app.api.v1.endpoints.catalog import router as catalog_router
from app.api.v1.endpoints.ingestion import router as ingestion_router
from app.api.v1.endpoints.matches import router as matches_router
from app.api.v1.endpoints.profile_documents import router as profile_documents_router

api_router = APIRouter()

api_router.include_router(profile_documents_router)
api_router.include_router(catalog_router)
api_router.include_router(ingestion_router)
api_router.include_router(matches_router)
