from pydantic_settings import BaseSettings
from typing import List, Optional
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Application
    app_name: str = "HealthBot Medical Assistant"
    app_version: str = "1.0.0"
    debug: bool = True
    log_level: str = "INFO"
    
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "HealthBot Medical Assistant"
    VERSION: str = "1.0.0"
    DESCRIPTION: str = "AI-powered medical diagnosis assistance for healthcare professionals"
    
    # Database
    DATABASE_URL: str = "sqlite:///./healthbot.db"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379"
    
    # Ollama/LLM
    OLLAMA_URL: str = "http://localhost:11434"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama2:7b"
    DEFAULT_MODEL: str = "llama2:7b"
    MEDICAL_MODEL: str = "llama2:7b"  # Can be upgraded to medical-specific models
    
    # Security
    SECRET_KEY: str = "your-secret-key-here-change-in-production"
    jwt_secret_key: str = "your-secret-key-here-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # CORS
    allowed_origins: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    BACKEND_CORS_ORIGINS: list = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
    # Medical APIs (optional)
    snomed_api_key: str = ""
    icd10_api_key: str = ""
    
    # Rate limiting
    RATE_LIMIT_PER_MINUTE: int = 60
    
    class Config:
        env_file = ".env"
        case_sensitive = False


# Global settings instance
settings = Settings() 