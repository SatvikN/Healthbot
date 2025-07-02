from pydantic_settings import BaseSettings
from typing import List, Optional
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Application
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "HealthBot Medical Assistant"
    VERSION: str = "1.0.0"
    DESCRIPTION: str = "AI-powered medical diagnosis assistance for healthcare professionals"
    
    # Database
    DATABASE_URL: str = "postgresql://healthbot_user:healthbot_password@localhost:5432/healthbot"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    
    # Ollama/LLM
    OLLAMA_URL: str = "http://localhost:11434"
    DEFAULT_MODEL: str = "llama2:7b"
    MEDICAL_MODEL: str = "llama2:7b"  # Can be upgraded to medical-specific models
    
    # Security
    SECRET_KEY: str = "your-secret-key-here-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # CORS
    BACKEND_CORS_ORIGINS: list = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
    # Medical APIs (optional)
    snomed_api_key: str = ""
    icd10_api_key: str = ""
    
    # Logging
    LOG_LEVEL: str = "INFO"
    
    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    
    class Config:
        env_file = ".env"
        case_sensitive = False


# Global settings instance
settings = Settings() 