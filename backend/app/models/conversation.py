from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from enum import Enum as PyEnum
from ..database import Base


class MessageType(PyEnum):
    """Enum for message types."""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ConversationStatus(PyEnum):
    """Enum for conversation status."""
    ACTIVE = "active"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class Conversation(Base):
    """Model for conversation sessions between user and chatbot."""
    
    __tablename__ = "conversations"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=True)
    status = Column(Enum(ConversationStatus), default=ConversationStatus.ACTIVE)
    
    # Conversation metadata
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Summary and analysis
    chief_complaint = Column(Text, nullable=True)  # Main symptom/concern
    conversation_summary = Column(Text, nullable=True)
    urgency_level = Column(String(20), nullable=True)  # low, medium, high, emergency
    
    # Relationships
    user = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")
    symptom_reports = relationship("SymptomReport", back_populates="conversation")
    
    def __repr__(self):
        return f"<Conversation(id={self.id}, user_id={self.user_id}, status='{self.status}')>"


class Message(Base):
    """Model for individual messages in a conversation."""
    
    __tablename__ = "messages"
    
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    message_type = Column(Enum(MessageType), nullable=False)
    content = Column(Text, nullable=False)
    
    # Message metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_edited = Column(Boolean, default=False)
    
    # AI-specific metadata
    model_used = Column(String(100), nullable=True)  # Which LLM model was used
    tokens_used = Column(Integer, nullable=True)
    processing_time = Column(Integer, nullable=True)  # in milliseconds
    confidence_score = Column(String(10), nullable=True)  # AI confidence in response
    
    # Medical classification
    contains_symptoms = Column(Boolean, default=False)
    contains_medical_advice = Column(Boolean, default=False)
    requires_followup = Column(Boolean, default=False)
    
    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    
    def __repr__(self):
        return f"<Message(id={self.id}, type='{self.message_type}', conversation_id={self.conversation_id})>" 