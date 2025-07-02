from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, Float, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class Symptom(Base):
    """Model for individual symptoms extracted from conversations."""
    
    __tablename__ = "symptoms"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)  # e.g., "respiratory", "digestive", "neurological"
    
    # Medical coding (when available)
    snomed_code = Column(String(20), nullable=True)
    icd10_code = Column(String(10), nullable=True)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<Symptom(id={self.id}, name='{self.name}', category='{self.category}')>"


class SymptomReport(Base):
    """Model for comprehensive symptom reports generated for healthcare providers."""
    
    __tablename__ = "symptom_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    
    # Report identification
    report_code = Column(String(20), unique=True, index=True)  # Unique code for sharing
    title = Column(String(255), nullable=False)
    
    # Chief complaint
    chief_complaint = Column(Text, nullable=False)
    symptom_onset = Column(String(100), nullable=True)  # "2 days ago", "1 week ago"
    symptom_duration = Column(String(100), nullable=True)
    
    # Detailed symptoms (JSON structure)
    symptoms_detailed = Column(JSON, nullable=True)  # Structured symptom data
    severity_assessment = Column(JSON, nullable=True)  # Severity ratings
    
    # Patient responses to follow-up questions
    followup_responses = Column(JSON, nullable=True)
    
    # AI Analysis
    ai_analysis = Column(Text, nullable=True)
    potential_conditions = Column(JSON, nullable=True)  # List of possible conditions
    recommended_actions = Column(JSON, nullable=True)  # Suggested next steps
    urgency_level = Column(String(20), nullable=True)  # low, medium, high, emergency
    
    # Patient information at time of report
    patient_age = Column(Integer, nullable=True)
    patient_gender = Column(String(20), nullable=True)
    relevant_medical_history = Column(Text, nullable=True)
    current_medications = Column(Text, nullable=True)
    known_allergies = Column(Text, nullable=True)
    
    # Report status and sharing
    is_shared = Column(Boolean, default=False)
    shared_at = Column(DateTime(timezone=True), nullable=True)
    healthcare_provider_email = Column(String(255), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Quality metrics
    conversation_completeness = Column(Float, nullable=True)  # 0.0 to 1.0
    information_quality = Column(Float, nullable=True)  # 0.0 to 1.0
    
    # Relationships
    user = relationship("User", back_populates="symptom_reports")
    conversation = relationship("Conversation", back_populates="symptom_reports")
    
    def __repr__(self):
        return f"<SymptomReport(id={self.id}, report_code='{self.report_code}', user_id={self.user_id})>" 