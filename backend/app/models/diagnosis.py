from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, Float, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class MedicalCondition(Base):
    __tablename__ = "medical_conditions"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Condition identification
    name = Column(String, nullable=False, index=True)
    icd10_code = Column(String, nullable=True, index=True)  # ICD-10 diagnostic code
    category = Column(String, nullable=True)  # cardiovascular, respiratory, etc.
    
    # Condition details
    description = Column(Text, nullable=True)
    common_symptoms = Column(JSON, default=list)
    typical_age_range = Column(String, nullable=True)
    prevalence = Column(String, nullable=True)  # common, rare, very rare
    
    # Severity and urgency
    severity_level = Column(String, nullable=True)  # mild, moderate, severe, critical
    requires_emergency_care = Column(Boolean, default=False)
    
    # Reference information
    reference_sources = Column(JSON, default=list)
    last_updated = Column(DateTime(timezone=True), onupdate=func.now())
    
    def __repr__(self):
        return f"<MedicalCondition(id={self.id}, name='{self.name}', icd10='{self.icd10_code}')>"


class DiagnosisResult(Base):
    __tablename__ = "diagnosis_results"
    
    id = Column(Integer, primary_key=True, index=True)
    symptom_report_id = Column(Integer, ForeignKey("symptom_reports.id"), nullable=False)
    
    # AI diagnosis information
    ai_model_used = Column(String, nullable=False)
    model_version = Column(String, nullable=True)
    analysis_timestamp = Column(DateTime(timezone=True), server_default=func.now())
    
    # Diagnosis results
    primary_diagnosis = Column(String, nullable=True)
    differential_diagnoses = Column(JSON, default=list)  # List of possible conditions
    confidence_scores = Column(JSON, default=dict)  # Confidence for each diagnosis
    
    # Risk assessment
    urgency_level = Column(String, default="routine")  # emergency, urgent, routine
    risk_factors = Column(JSON, default=list)
    red_flags = Column(JSON, default=list)  # Warning signs
    
    # Recommendations
    recommended_actions = Column(JSON, default=list)
    follow_up_timeframe = Column(String, nullable=True)
    specialist_referral = Column(String, nullable=True)
    
    # Additional analysis
    symptom_pattern_analysis = Column(Text, nullable=True)
    medical_reasoning = Column(Text, nullable=True)
    limitations_disclaimer = Column(Text, nullable=True)
    
    # Quality metrics
    analysis_completeness = Column(Integer, nullable=True)  # 0-100
    data_quality_score = Column(Integer, nullable=True)  # 0-100
    
    # Review and validation
    reviewed_by_human = Column(Boolean, default=False)
    human_reviewer_notes = Column(Text, nullable=True)
    review_timestamp = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    symptom_report = relationship("SymptomReport")
    
    def __repr__(self):
        return f"<DiagnosisResult(id={self.id}, primary_diagnosis='{self.primary_diagnosis}', urgency='{self.urgency_level}')>"


class DiagnosisConditionLink(Base):
    __tablename__ = "diagnosis_condition_links"
    
    id = Column(Integer, primary_key=True, index=True)
    diagnosis_result_id = Column(Integer, ForeignKey("diagnosis_results.id"), nullable=False)
    medical_condition_id = Column(Integer, ForeignKey("medical_conditions.id"), nullable=False)
    
    # Link metadata
    confidence_score = Column(Float, nullable=True)  # 0.0-1.0
    is_primary_diagnosis = Column(Boolean, default=False)
    reasoning = Column(Text, nullable=True)
    
    # Relationships
    diagnosis_result = relationship("DiagnosisResult")
    medical_condition = relationship("MedicalCondition")
    
    def __repr__(self):
        return f"<DiagnosisConditionLink(diagnosis_id={self.diagnosis_result_id}, condition_id={self.medical_condition_id})>" 