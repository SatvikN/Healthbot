from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Application
    app_name: str = "HealthBot Medical Diagnosis Assistant"
    app_version: str = "1.0.0"
    debug: bool = True
    
    # Database
    database_url: str = "postgresql://healthbot_user:healthbot_password@localhost:5432/healthbot"
    
    # Redis
    redis_url: str = "redis://localhost:6379"
    
    # Ollama LLM
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1:8b"
    
    # Security
    secret_key: str = "your-secret-key-here-change-in-production"
    jwt_secret_key: str = "your-jwt-secret-key-here"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # CORS
    allowed_origins: List[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
    # Medical APIs (optional)
    snomed_api_key: str = ""
    icd10_api_key: str = ""
    
    # Logging
    log_level: str = "INFO"
    
    # Rate Limiting
    rate_limit_requests: int = 100
    rate_limit_window: int = 60
    
    class Config:
        env_file = ".env"
        case_sensitive = False


# Global settings instance
settings = Settings() 