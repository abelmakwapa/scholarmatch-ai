from fastapi import APIRouter

from app.api.v1.endpoints.profile_documents import router as profile_documents_router

api_router = APIRouter()

api_router.include_router(profile_documents_router)
