from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, Enum, JSON
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
    
    # Conversation metadata
    title = Column(String, nullable=True)  # Auto-generated from first few messages
    status = Column(String, default="active")  # active, completed, archived
    
    # Medical context
    chief_complaint = Column(Text, nullable=True)  # Primary symptom/concern
    context_summary = Column(Text, nullable=True)  # AI-generated summary
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Conversation(id={self.id}, user_id={self.user_id}, status='{self.status}')>"


class Message(Base):
    """Model for individual messages in a conversation."""
    
    __tablename__ = "messages"
    
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id"), nullable=False)
    
    # Message content
    content = Column(Text, nullable=False)
    role = Column(String, nullable=False)  # user, assistant, system
    
    # Message metadata
    message_type = Column(String, default="text")  # text, symptom_analysis, diagnosis_request
    contains_medical_info = Column(Boolean, default=False)
    contains_symptoms = Column(Boolean, default=False)
    
    # AI processing metadata
    model_used = Column(String, nullable=True)
    processing_time = Column(Integer, nullable=True)  # milliseconds
    confidence_score = Column(Integer, nullable=True)  # 0-100
    
    # Additional data (JSON for flexibility)
    extra_data = Column(JSON, default=dict)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    conversation = relationship("Conversation", back_populates="messages")
    
    def __repr__(self):
        return f"<Message(id={self.id}, role='{self.role}', conversation_id={self.conversation_id})>" 