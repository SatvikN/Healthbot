from sqlalchemy import create_engine, MetaData
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import redis
from .config import settings

# PostgreSQL Database
engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    echo=settings.debug
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Redis connection
redis_client = redis.from_url(settings.redis_url, decode_responses=True)

# Database dependency
def get_db():
    """Dependency to get database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Redis dependency
def get_redis():
    """Dependency to get Redis client."""
    return redis_client

# Metadata for migrations
metadata = MetaData() 