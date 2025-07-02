from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from ..database import Base


class MedicalReport(Base):
    """Model for medical reports generated from chat conversations."""
    
    __tablename__ = "medical_reports"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    
    # Report metadata
    title = Column(String(255), nullable=False)
    type = Column(String(50), nullable=False)  # initial_consultation, follow_up, symptom_tracking
    status = Column(String(20), default="pending")  # completed, pending, in_progress
    urgency_level = Column(String(20), default="low")  # low, medium, high
    
    # Report content
    summary = Column(Text, nullable=True)
    key_findings = Column(JSON, default=list)  # List of key medical findings
    recommendations = Column(JSON, default=list)  # List of medical recommendations
    
    # AI analysis metadata
    ai_model_used = Column(String(100), nullable=True)
    processing_time = Column(Integer, nullable=True)  # Processing time in milliseconds
    confidence_score = Column(Integer, nullable=True)  # 0-100
    
    # Report file information
    file_size = Column(String(20), nullable=True)  # e.g., "2.3 MB"
    file_format = Column(String(10), default="pdf")
    file_path = Column(String(500), nullable=True)  # Path to generated report file
    
    # Medical coding and categorization
    medical_categories = Column(JSON, default=list)  # List of relevant medical categories
    icd10_codes = Column(JSON, default=list)  # Relevant ICD-10 codes if applicable
    
    # Quality and validation
    validated_by_human = Column(Boolean, default=False)
    validation_notes = Column(Text, nullable=True)
    validation_timestamp = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    user = relationship("User")
    conversation = relationship("Conversation")
    
    def __repr__(self):
        return f"<MedicalReport(id={self.id}, title='{self.title}', type='{self.type}', status='{self.status}')>"
    
    def to_dict(self):
        """Convert to dictionary for API responses."""
        return {
            "id": self.id,
            "title": self.title,
            "type": self.type,
            "status": self.status,
            "createdAt": self.created_at.isoformat() if self.created_at else None,
            "conversationId": self.conversation_id,
            "conversationTitle": self.conversation.title if self.conversation else None,
            "summary": self.summary,
            "urgencyLevel": self.urgency_level,
            "keyFindings": self.key_findings or [],
            "recommendations": self.recommendations or [],
            "fileSize": self.file_size,
        } 