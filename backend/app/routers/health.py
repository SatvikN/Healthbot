from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import redis
from datetime import datetime
from typing import Dict, Any

from ..database import get_db, get_redis
from ..services.llm_service import llm_service
from ..config import settings

router = APIRouter()


@router.get("/")
async def health_check(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Basic health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": settings.app_version,
        "service": "HealthBot Medical Diagnosis Assistant"
    }


@router.get("/detailed")
async def detailed_health_check(
    db: Session = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis)
) -> Dict[str, Any]:
    """Detailed health check with database and service status."""
    
    health_status = {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "version": settings.app_version,
        "checks": {}
    }
    
    # Database check
    try:
        db.execute("SELECT 1")
        health_status["checks"]["database"] = {
            "status": "healthy",
            "message": "Database connection successful"
        }
    except Exception as e:
        health_status["status"] = "unhealthy"
        health_status["checks"]["database"] = {
            "status": "unhealthy",
            "message": f"Database connection failed: {str(e)}"
        }
    
    # Redis check
    try:
        redis_client.ping()
        health_status["checks"]["redis"] = {
            "status": "healthy",
            "message": "Redis connection successful"
        }
    except Exception as e:
        health_status["status"] = "degraded" if health_status["status"] == "healthy" else "unhealthy"
        health_status["checks"]["redis"] = {
            "status": "unhealthy",
            "message": f"Redis connection failed: {str(e)}"
        }
    
    # LLM service check
    try:
        async with llm_service:
            is_available = await llm_service.is_model_available()
            if is_available:
                health_status["checks"]["llm"] = {
                    "status": "healthy",
                    "message": f"LLM model {settings.ollama_model} is available",
                    "model": settings.ollama_model
                }
            else:
                health_status["status"] = "degraded" if health_status["status"] == "healthy" else "unhealthy"
                health_status["checks"]["llm"] = {
                    "status": "degraded",
                    "message": f"LLM model {settings.ollama_model} not available locally",
                    "model": settings.ollama_model
                }
    except Exception as e:
        health_status["status"] = "degraded" if health_status["status"] == "healthy" else "unhealthy"
        health_status["checks"]["llm"] = {
            "status": "unhealthy",
            "message": f"LLM service check failed: {str(e)}"
        }
    
    return health_status


@router.get("/ready")
async def readiness_check(
    db: Session = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis)
) -> Dict[str, Any]:
    """Kubernetes-style readiness probe."""
    
    try:
        # Check critical dependencies
        db.execute("SELECT 1")
        redis_client.ping()
        
        return {
            "status": "ready",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail={
                "status": "not ready",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }
        )


@router.get("/live")
async def liveness_check() -> Dict[str, Any]:
    """Kubernetes-style liveness probe."""
    return {
        "status": "alive",
        "timestamp": datetime.now().isoformat()
    } 