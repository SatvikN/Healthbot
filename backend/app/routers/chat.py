from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel
import json

from ..database import get_db
from ..models.user import User
from ..models.conversation import Conversation, Message, ConversationStatus, MessageType
from ..routers.auth import get_current_user
from ..services.llm_service import llm_service

router = APIRouter()


# Pydantic models for request/response
class MessageRequest(BaseModel):
    content: str
    conversation_id: Optional[int] = None


class MessageResponse(BaseModel):
    id: int
    content: str
    message_type: str
    created_at: datetime
    processing_time: Optional[int]
    contains_symptoms: bool
    requires_followup: bool


class ConversationResponse(BaseModel):
    id: int
    title: Optional[str]
    status: str
    started_at: datetime
    chief_complaint: Optional[str]
    urgency_level: Optional[str]
    message_count: int


class StartConversationRequest(BaseModel):
    initial_message: str
    chief_complaint: Optional[str] = None


@router.post("/start", response_model=Dict[str, Any])
async def start_new_conversation(
    request: StartConversationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Start a new conversation with the medical assistant."""
    
    try:
        # Create new conversation
        conversation = Conversation(
            user_id=current_user.id,
            title=f"Medical consultation - {datetime.now().strftime('%Y-%m-%d %H:%M')}",
            chief_complaint=request.chief_complaint,
            status=ConversationStatus.ACTIVE
        )
        
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
        
        # Add initial user message
        user_message = Message(
            conversation_id=conversation.id,
            message_type=MessageType.USER,
            content=request.initial_message,
            contains_symptoms=True  # Assume initial message contains symptoms
        )
        
        db.add(user_message)
        db.commit()
        db.refresh(user_message)
        
        # Generate AI welcome response
        welcome_prompt = f"""
        A new patient has started a medical consultation. Their initial message is:
        "{request.initial_message}"
        
        Please provide a warm, professional welcome response that:
        1. Acknowledges their concern
        2. Explains your role as a medical assistant (not a doctor)
        3. Asks a relevant follow-up question about their symptoms
        4. Reassures them about privacy and the process
        
        Keep it concise but empathetic.
        """
        
        # Get AI response
        async with llm_service:
            ai_result = await llm_service.generate_chat_response(
                request.initial_message, 
                []  # Empty conversation history for first message
            )
        
        if ai_result.get("success"):
            ai_response = ai_result.get("response", "Hello! I'm here to help you describe your symptoms.")
            
            # Save AI message
            ai_message = Message(
                conversation_id=conversation.id,
                message_type=MessageType.ASSISTANT,
                content=ai_response,
                model_used=ai_result.get("model"),
                processing_time=ai_result.get("processing_time"),
                requires_followup=True
            )
            
            db.add(ai_message)
            db.commit()
            db.refresh(ai_message)
            
        else:
            # Fallback response if AI fails
            ai_response = """Hello! I'm your medical assistant. I'm here to help you describe your symptoms and gather information for your healthcare provider. 

Please note that I'm not a doctor and cannot provide medical diagnoses. My role is to help you organize your symptoms and create a comprehensive report.

Can you tell me more about what you're experiencing? When did these symptoms start?"""
            
            ai_message = Message(
                conversation_id=conversation.id,
                message_type=MessageType.ASSISTANT,
                content=ai_response,
                requires_followup=True
            )
            
            db.add(ai_message)
            db.commit()
        
        return {
            "conversation_id": conversation.id,
            "status": "started",
            "message": "Conversation started successfully",
            "initial_response": ai_response,
            "user_message": {
                "id": user_message.id,
                "content": user_message.content,
                "created_at": user_message.created_at
            },
            "ai_message": {
                "id": ai_message.id,
                "content": ai_message.content,
                "created_at": ai_message.created_at
            }
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start conversation: {str(e)}"
        )


@router.post("/send-message", response_model=Dict[str, Any])
async def send_message(
    request: MessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Send a message in an existing conversation."""
    
    if not request.conversation_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Conversation ID is required"
        )
    
    # Verify conversation exists and belongs to user
    conversation = db.query(Conversation).filter(
        Conversation.id == request.conversation_id,
        Conversation.user_id == current_user.id
    ).first()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    if conversation.status != ConversationStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot send message to inactive conversation"
        )
    
    try:
        # Save user message
        user_message = Message(
            conversation_id=conversation.id,
            message_type=MessageType.USER,
            content=request.content,
            contains_symptoms=_contains_symptoms(request.content)
        )
        
        db.add(user_message)
        db.commit()
        db.refresh(user_message)
        
        # Get conversation history for context
        conversation_history = _get_conversation_history(db, conversation.id)
        
        # Generate AI response
        async with llm_service:
            ai_result = await llm_service.generate_chat_response(
                request.content,
                conversation_history
            )
        
        if ai_result.get("success"):
            ai_response = ai_result.get("response", "I understand. Can you tell me more about that?")
            
            # Analyze if response requires follow-up
            requires_followup = _requires_followup(ai_response)
            contains_medical_advice = _contains_medical_advice(ai_response)
            
            # Save AI message
            ai_message = Message(
                conversation_id=conversation.id,
                message_type=MessageType.ASSISTANT,
                content=ai_response,
                model_used=ai_result.get("model"),
                processing_time=ai_result.get("processing_time"),
                requires_followup=requires_followup,
                contains_medical_advice=contains_medical_advice
            )
            
            db.add(ai_message)
            
            # Update conversation metadata
            conversation.updated_at = datetime.utcnow()
            
            db.commit()
            db.refresh(ai_message)
            
            return {
                "status": "success",
                "user_message": {
                    "id": user_message.id,
                    "content": user_message.content,
                    "created_at": user_message.created_at
                },
                "ai_message": {
                    "id": ai_message.id,
                    "content": ai_message.content,
                    "created_at": ai_message.created_at,
                    "processing_time": ai_message.processing_time,
                    "requires_followup": ai_message.requires_followup
                }
            }
        else:
            # Fallback if AI fails
            fallback_response = "I'm having trouble processing that right now. Could you please rephrase your symptoms or try again?"
            
            ai_message = Message(
                conversation_id=conversation.id,
                message_type=MessageType.ASSISTANT,
                content=fallback_response,
                requires_followup=True
            )
            
            db.add(ai_message)
            db.commit()
            
            return {
                "status": "partial_success",
                "message": "Response generated with fallback",
                "user_message": {
                    "id": user_message.id,
                    "content": user_message.content,
                    "created_at": user_message.created_at
                },
                "ai_message": {
                    "id": ai_message.id,
                    "content": fallback_response,
                    "created_at": ai_message.created_at
                }
            }
            
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send message: {str(e)}"
        )


@router.get("/conversations", response_model=List[ConversationResponse])
async def get_user_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 20,
    offset: int = 0
):
    """Get all conversations for the current user."""
    
    conversations = db.query(Conversation).filter(
        Conversation.user_id == current_user.id
    ).order_by(
        Conversation.updated_at.desc()
    ).offset(offset).limit(limit).all()
    
    result = []
    for conv in conversations:
        message_count = db.query(Message).filter(
            Message.conversation_id == conv.id
        ).count()
        
        result.append(ConversationResponse(
            id=conv.id,
            title=conv.title,
            status=conv.status.value,
            started_at=conv.started_at,
            chief_complaint=conv.chief_complaint,
            urgency_level=conv.urgency_level,
            message_count=message_count
        ))
    
    return result


@router.get("/conversation/{conversation_id}", response_model=Dict[str, Any])
async def get_conversation_details(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed conversation information including all messages."""
    
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    ).first()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    messages = db.query(Message).filter(
        Message.conversation_id == conversation_id
    ).order_by(Message.created_at.asc()).all()
    
    message_list = []
    for msg in messages:
        message_list.append({
            "id": msg.id,
            "type": msg.message_type.value,
            "content": msg.content,
            "created_at": msg.created_at,
            "processing_time": msg.processing_time,
            "contains_symptoms": msg.contains_symptoms,
            "contains_medical_advice": msg.contains_medical_advice,
            "requires_followup": msg.requires_followup
        })
    
    return {
        "conversation": {
            "id": conversation.id,
            "title": conversation.title,
            "status": conversation.status.value,
            "started_at": conversation.started_at,
            "updated_at": conversation.updated_at,
            "chief_complaint": conversation.chief_complaint,
            "urgency_level": conversation.urgency_level
        },
        "messages": message_list,
        "message_count": len(message_list)
    }


@router.put("/conversation/{conversation_id}/complete")
async def complete_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a conversation as completed."""
    
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    ).first()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    conversation.status = ConversationStatus.COMPLETED
    conversation.completed_at = datetime.utcnow()
    
    db.commit()
    
    return {
        "status": "completed",
        "message": "Conversation marked as completed",
        "conversation_id": conversation_id
    }


@router.post("/conversation/{conversation_id}/generate-followup")
async def generate_followup_questions(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate AI-powered follow-up questions for the conversation."""
    
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    ).first()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    # Get conversation history
    conversation_history = _get_conversation_history(db, conversation_id)
    
    # Generate follow-up questions using AI
    async with llm_service:
        result = await llm_service.generate_followup_questions(conversation_history)
    
    if result.get("success"):
        return {
            "status": "success",
            "followup_questions": result.get("response", ""),
            "conversation_id": conversation_id
        }
    else:
        return {
            "status": "error",
            "message": "Failed to generate follow-up questions",
            "error": result.get("error")
        }


# Helper functions
def _get_conversation_history(db: Session, conversation_id: int) -> List[Dict]:
    """Get conversation history formatted for AI processing."""
    messages = db.query(Message).filter(
        Message.conversation_id == conversation_id
    ).order_by(Message.created_at.asc()).all()
    
    history = []
    for msg in messages:
        history.append({
            "type": msg.message_type.value,
            "content": msg.content,
            "created_at": msg.created_at.isoformat()
        })
    
    return history


def _contains_symptoms(content: str) -> bool:
    """Simple heuristic to detect if message contains symptom descriptions."""
    symptom_keywords = [
        "pain", "ache", "hurt", "sore", "fever", "headache", "nausea", 
        "vomit", "cough", "sneeze", "tired", "fatigue", "dizzy", "swollen",
        "rash", "itch", "bleeding", "shortness", "breath", "chest"
    ]
    
    content_lower = content.lower()
    return any(keyword in content_lower for keyword in symptom_keywords)


def _contains_medical_advice(content: str) -> bool:
    """Simple heuristic to detect if message contains medical advice."""
    advice_keywords = [
        "recommend", "suggest", "should take", "prescription", "medication",
        "treatment", "see a doctor", "emergency", "urgent care"
    ]
    
    content_lower = content.lower()
    return any(keyword in content_lower for keyword in advice_keywords)


def _requires_followup(content: str) -> bool:
    """Simple heuristic to detect if message requires follow-up."""
    followup_indicators = [
        "?", "tell me more", "can you describe", "how long", "when did",
        "have you tried", "any other symptoms"
    ]
    
    content_lower = content.lower()
    return any(indicator in content_lower for indicator in followup_indicators) 