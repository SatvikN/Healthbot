from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class User(Base):
    """User model for authentication and profile management."""
    
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String, nullable=False)
    
    # User profile
    full_name = Column(String, nullable=True)
    age = Column(Integer, nullable=True)
    gender = Column(String(20), nullable=True)
    date_of_birth = Column(String, nullable=True)  # Store as ISO date string
    phone = Column(String(50), nullable=True)
    address = Column(Text, nullable=True)
    blood_type = Column(String(10), nullable=True)
    height = Column(String(20), nullable=True)  # e.g., "6'2\"" or "188cm"
    weight = Column(String(20), nullable=True)  # e.g., "175 lbs" or "80kg"
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    
    # Medical professional info (optional)
    medical_license = Column(String, nullable=True)
    specialty = Column(String, nullable=True)
    institution = Column(String, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    
    # Medical information (optional)
    medical_history = Column(Text, nullable=True)
    allergies = Column(Text, nullable=True)
    current_medications = Column(Text, nullable=True)
    emergency_contact = Column(String(255), nullable=True)
    
    # Relationships
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")
    symptom_reports = relationship("SymptomReport", back_populates="user", cascade="all, delete-orphan")
    medical_reports = relationship("MedicalReport", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}', email='{self.email}')>" 