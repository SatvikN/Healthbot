from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
import uvicorn
from contextlib import asynccontextmanager
from sqlalchemy.orm import sessionmaker

from .config import settings
from .database import engine, Base
from .routers import auth, chat, symptoms, reports, health
from .models.user import User
from .routers.auth import get_password_hash, get_user_by_email

# Import all models to ensure they're registered with SQLAlchemy
from .models import user, conversation, symptom, diagnosis, medical_report


async def create_demo_account():
    """Create demo account if it doesn't exist."""
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        demo_email = "demo@healthbot.com"
        demo_password = "demo123"
        demo_name = "Demo User"
        
        # Check if demo account already exists
        existing_user = get_user_by_email(db, demo_email)
        if existing_user:
            print(f"📧 Demo account ({demo_email}) already exists")
            return
        
        # Create demo account with comprehensive profile data
        hashed_password = get_password_hash(demo_password)
        demo_user = User(
            email=demo_email,
            hashed_password=hashed_password,
            full_name=demo_name,
            date_of_birth="2000-01-01",
            phone="+1 (123) 456-7890",
            address="123 Main Street, San Francisco, CA 94102",
            emergency_contact="Emergency Contact - +1 (0987) 654-4321",
            medical_history="Hypertension (2018), Appendectomy (2015), Seasonal allergies",
            allergies="Penicillin, Shellfish, Pollen",
            current_medications="Vitamin B3, Multivitamins, Fish Oil",
            blood_type="O+",
            height="6'2\"",
            weight="175 lbs",
            age=25,
            gender="Male",
            is_active=True,
            is_verified=True
        )
        
        db.add(demo_user)
        db.commit()
        print(f"✅ Demo account created: {demo_email} / {demo_password}")
        
    except Exception as e:
        print(f"❌ Failed to create demo account: {e}")
        db.rollback()
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    print("🏥 Starting HealthBot Medical Diagnosis Assistant...")
    
    # Create database tables
    Base.metadata.create_all(bind=engine)
    print("📊 Database tables created/verified")
    
    # Create demo account
    await create_demo_account()
    
    # Test LLM connection - commented out for now
    # from .services.llm_service import llm_service
    # async with llm_service:
    #     is_available = await llm_service.is_model_available()
    #     if is_available:
    #         print(f"🤖 LLM Model '{settings.ollama_model}' is ready")
    #     else:
    #         print(f"⚠️ LLM Model '{settings.ollama_model}' not found. Will attempt to pull on first use.")
    
    print("✅ HealthBot is ready to help!")
    
    yield
    
    # Shutdown
    print("🔄 Shutting down HealthBot...")


# Initialize FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="An AI-powered medical diagnosis assistant to help analyze symptoms and generate reports for healthcare providers.",
    lifespan=lifespan,
    docs_url="/api/docs" if settings.debug else None,
    redoc_url="/api/redoc" if settings.debug else None,
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Add trusted host middleware for security
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["localhost", "127.0.0.1", "*.localhost"]
)

# Include routers
app.include_router(health.router, prefix="/api/health", tags=["Health"])
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(symptoms.router, prefix="/api/symptoms", tags=["Symptoms"])
app.include_router(reports.router, prefix="/api/reports", tags=["Reports"])


@app.get("/")
async def root():
    """Root endpoint with basic information."""
    return {
        "message": "Welcome to HealthBot Medical Diagnosis Assistant",
        "version": settings.app_version,
        "status": "healthy",
        "docs_url": "/api/docs" if settings.debug else "Documentation disabled in production",
        "description": "AI-powered symptom analysis and medical report generation"
    }


@app.get("/api")
async def api_info():
    """API information endpoint."""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "endpoints": {
            "health": "/api/health",
            "authentication": "/api/auth", 
            "chat": "/api/chat",
            "symptoms": "/api/symptoms",
            "reports": "/api/reports"
        },
        "features": [
            "Conversational symptom collection",
            "AI-powered symptom analysis", 
            "Medical report generation",
            "Healthcare provider integration",
            "Secure user authentication"
        ]
    }


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.debug,
        log_level=settings.log_level.lower()
    ) 