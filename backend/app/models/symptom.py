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
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=True)
    
    # Report metadata
    title = Column(String, nullable=False)
    status = Column(String, default="draft")  # draft, completed, reviewed, archived
    
    # Patient information (anonymized)
    patient_age_range = Column(String, nullable=True)  # "20-30", "40-50", etc.
    patient_gender = Column(String, nullable=True)
    patient_id_hash = Column(String, nullable=True)  # Hashed identifier for privacy
    
    # Symptom summary
    primary_symptoms = Column(JSON, default=list)  # List of main symptoms
    secondary_symptoms = Column(JSON, default=list)  # Additional symptoms
    symptom_timeline = Column(JSON, default=dict)  # When symptoms started/progressed
    symptom_severity = Column(JSON, default=dict)  # Severity ratings 1-10
    
    # Context information
    medical_history = Column(Text, nullable=True)
    current_medications = Column(JSON, default=list)
    allergies = Column(JSON, default=list)
    lifestyle_factors = Column(JSON, default=dict)
    
    # AI analysis results
    ai_analysis_summary = Column(Text, nullable=True)
    confidence_level = Column(Integer, nullable=True)  # 0-100
    requires_immediate_attention = Column(Boolean, default=False)
    
    # Generated reports
    structured_report = Column(JSON, default=dict)  # For healthcare providers
    patient_summary = Column(Text, nullable=True)  # For patients
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="symptom_reports")
    conversation = relationship("Conversation")
    
    def __repr__(self):
        return f"<SymptomReport(id={self.id}, title='{self.title}', status='{self.status}')>"


class SymptomEntry(Base):
    __tablename__ = "symptom_entries"
    
    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("symptom_reports.id"), nullable=False)
    
    # Symptom details
    symptom_name = Column(String, nullable=False)
    symptom_category = Column(String, nullable=True)  # pain, digestive, respiratory, etc.
    description = Column(Text, nullable=True)
    
    # Characteristics
    severity = Column(Integer, nullable=True)  # 1-10 scale
    duration = Column(String, nullable=True)  # "2 days", "1 week", etc.
    frequency = Column(String, nullable=True)  # "constant", "intermittent", etc.
    triggers = Column(JSON, default=list)  # What makes it worse/better
    
    # Location (for physical symptoms)
    body_location = Column(String, nullable=True)
    location_specificity = Column(String, nullable=True)  # "left side", "upper", etc.
    
    # Timestamps
    symptom_onset = Column(DateTime(timezone=True), nullable=True)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    report = relationship("SymptomReport")
    
    def __repr__(self):
        return f"<SymptomEntry(id={self.id}, symptom_name='{self.symptom_name}', severity={self.severity})>" 