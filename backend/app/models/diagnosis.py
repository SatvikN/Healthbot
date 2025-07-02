from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, Float, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class Diagnosis(Base):
    """Model for medical conditions/diagnoses that the AI can suggest."""
    
    __tablename__ = "diagnoses"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)  # e.g., "infectious", "chronic", "acute"
    
    # Medical coding
    icd10_code = Column(String(10), nullable=True, index=True)
    snomed_code = Column(String(20), nullable=True)
    
    # Condition characteristics
    common_symptoms = Column(JSON, nullable=True)  # List of typical symptoms
    severity_range = Column(String(50), nullable=True)  # "mild to moderate", "severe"
    urgency_indicators = Column(JSON, nullable=True)  # Red flag symptoms
    
    # Demographics and risk factors
    common_age_groups = Column(JSON, nullable=True)  # Age groups most affected
    gender_prevalence = Column(String(20), nullable=True)  # "equal", "male", "female"
    risk_factors = Column(JSON, nullable=True)
    
    # Treatment and management
    typical_treatment = Column(Text, nullable=True)
    home_care_suggestions = Column(JSON, nullable=True)
    when_to_seek_care = Column(Text, nullable=True)
    
    # System metadata
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<Diagnosis(id={self.id}, name='{self.name}', icd10='{self.icd10_code}')>"


class DiagnosisResult(Base):
    """Model for AI-generated diagnosis results for specific symptom reports."""
    
    __tablename__ = "diagnosis_results"
    
    id = Column(Integer, primary_key=True, index=True)
    symptom_report_id = Column(Integer, ForeignKey("symptom_reports.id"), nullable=False)
    diagnosis_id = Column(Integer, ForeignKey("diagnoses.id"), nullable=False)
    
    # AI confidence and scoring
    confidence_score = Column(Float, nullable=False)  # 0.0 to 1.0
    match_percentage = Column(Float, nullable=True)  # Symptom match percentage
    
    # Reasoning and explanation
    ai_reasoning = Column(Text, nullable=True)  # Why this diagnosis was suggested
    matching_symptoms = Column(JSON, nullable=True)  # Which symptoms matched
    missing_symptoms = Column(JSON, nullable=True)  # Expected symptoms not present
    
    # Risk assessment
    likelihood = Column(String(20), nullable=True)  # "very low", "low", "moderate", "high", "very high"
    urgency = Column(String(20), nullable=True)  # "routine", "soon", "urgent", "emergency"
    
    # Recommendations specific to this diagnosis
    recommended_actions = Column(JSON, nullable=True)
    home_care_advice = Column(Text, nullable=True)
    warning_signs = Column(JSON, nullable=True)  # When to seek immediate care
    
    # Follow-up suggestions
    followup_timeframe = Column(String(50), nullable=True)  # "24 hours", "1 week"
    specialist_referral = Column(String(100), nullable=True)  # Type of specialist
    
    # Model metadata
    model_version = Column(String(50), nullable=True)
    processing_time = Column(Integer, nullable=True)  # milliseconds
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    symptom_report = relationship("SymptomReport")
    diagnosis = relationship("Diagnosis")
    
    def __repr__(self):
        return f"<DiagnosisResult(id={self.id}, confidence={self.confidence_score}, likelihood='{self.likelihood}')>" 