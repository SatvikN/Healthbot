from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime
from pydantic import BaseModel
import json
import logging

logger = logging.getLogger(__name__)

from ..database import get_db
from ..models.user import User
from ..models.conversation import Conversation, Message, ConversationStatus, MessageType
from ..routers.auth import get_current_user
from ..services.llm_service import LLMService

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


class UpdateTitleRequest(BaseModel):
    title: str


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
        
        # Generate AI welcome response using LLM
        async with LLMService() as llm_service:
            welcome_response = await _generate_welcome_response_llm(
                llm_service, request.initial_message, request.chief_complaint
            )
        
        # Save AI message
        ai_message = Message(
            conversation_id=conversation.id,
            message_type=MessageType.ASSISTANT,
            content=welcome_response,
            requires_followup=True
        )
        
        db.add(ai_message)
        db.commit()
        db.refresh(ai_message)
        
        return {
            "conversation_id": conversation.id,
            "status": "started",
            "message": "Conversation started successfully",
            "initial_response": welcome_response,
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
        
        # Generate intelligent response using LLM
        async with LLMService() as llm_service:
            ai_response = await _generate_smart_response_llm(
                llm_service, request.content, conversation_history
            )
        
        # Analyze if response requires follow-up
        requires_followup = _requires_followup(ai_response)
        contains_medical_advice = _contains_medical_advice(ai_response)
        
        # Save AI message
        ai_message = Message(
            conversation_id=conversation.id,
            message_type=MessageType.ASSISTANT,
            content=ai_response,
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
                "requires_followup": ai_message.requires_followup
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


@router.put("/conversation/{conversation_id}/title")
async def update_conversation_title(
    conversation_id: int,
    request: UpdateTitleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update the title of a conversation."""
    
    # Validate title length
    if not request.title.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Title cannot be empty"
        )
    
    if len(request.title) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Title cannot exceed 100 characters"
        )
    
    # Find the conversation
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    ).first()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    # Update the title
    conversation.title = request.title.strip()
    conversation.updated_at = datetime.utcnow()
    
    db.commit()
    
    return {
        "status": "success",
        "message": "Title updated successfully",
        "conversation_id": conversation_id,
        "new_title": conversation.title
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
    
    # Generate follow-up questions based on conversation
    followup_questions = _generate_followup_questions(conversation_history)
    
    return {
        "status": "success",
        "followup_questions": followup_questions,
        "conversation_id": conversation_id
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


@router.get("/test")
async def test_chat():
    """Test endpoint for chat."""
    return {"message": "Chat router is working"}


@router.get("/test-data")
async def get_test_conversations():
    """Test endpoint that returns mock conversation data without auth."""
    return [
        {
            "id": 1,
            "title": "Headache Consultation",
            "chief_complaint": "Persistent headache for 3 days",
            "status": "completed",
            "started_at": "2025-07-01T09:00:00Z",
            "completed_at": "2025-07-01T09:30:00Z",
            "messages": []
        },
        {
            "id": 2,
            "title": "General Fatigue",
            "chief_complaint": "Feeling very tired lately",
            "status": "active",
            "started_at": "2025-07-01T14:00:00Z",
            "completed_at": None,
            "messages": []
        }
    ]


async def _generate_welcome_response_llm(
    llm_service: LLMService, initial_message: str, chief_complaint: Optional[str] = None
) -> str:
    """Generate contextual welcome response using LLM."""
    
    system_prompt = """You are a professional medical assistant helping patients document their symptoms for healthcare providers. 

Key guidelines:
- Be empathetic and professional
- Ask relevant follow-up questions based on their symptoms
- Provide structured guidance for symptom documentation
- Always recommend professional medical evaluation when appropriate
- Do not provide medical diagnoses or treatment advice
- Keep responses concise but comprehensive

Generate a warm, professional welcome response that acknowledges their symptoms and asks relevant follow-up questions to help document their condition properly."""

    context = f"Patient's initial message: {initial_message}"
    if chief_complaint:
        context += f"\nChief complaint: {chief_complaint}"
    
    try:
        result = await llm_service.generate_response(
            prompt=context,
            system_prompt=system_prompt,
            temperature=0.7,
            max_tokens=300
        )
        
        if result.get("success"):
            return result.get("response", "Thank you for reaching out. Please describe your symptoms in detail so I can help document them properly.")
        else:
            # Fallback response if LLM fails
            return _generate_fallback_welcome_response(initial_message, chief_complaint)
            
    except Exception as e:
        logger.error(f"Error generating welcome response: {e}")
        return _generate_fallback_welcome_response(initial_message, chief_complaint)


async def _generate_smart_response_llm(
    llm_service: LLMService, user_message: str, conversation_history: List[Dict]
) -> str:
    """Generate intelligent response using LLM based on user input and conversation context."""
    
    system_prompt = """You are a medical assistant helping patients document their symptoms for healthcare providers.

Guidelines:
- Ask follow-up questions to gather comprehensive symptom information
- Be empathetic and professional
- Guide patients to provide specific details (timeline, severity, triggers, etc.)
- Do not provide medical diagnoses or treatment advice
- Encourage professional medical evaluation when appropriate
- Keep responses focused and concise

Based on the conversation history and the latest user message, provide a helpful follow-up response that gathers more relevant medical information."""

    # Format conversation history for context
    history_text = ""
    for msg in conversation_history[-5:]:  # Last 5 messages for context
        role = "Patient" if msg.get("message_type") == "user" else "Assistant"
        history_text += f"{role}: {msg.get('content', '')}\n"
    
    context = f"Conversation history:\n{history_text}\nLatest patient message: {user_message}"
    
    try:
        result = await llm_service.generate_response(
            prompt=context,
            system_prompt=system_prompt,
            temperature=0.7,
            max_tokens=250
        )
        
        if result.get("success"):
            return result.get("response", "Thank you for that information. Could you tell me more about your symptoms?")
        else:
            # Fallback response if LLM fails
            return _generate_fallback_smart_response(user_message, conversation_history)
            
    except Exception as e:
        logger.error(f"Error generating smart response: {e}")
        return _generate_fallback_smart_response(user_message, conversation_history)


def _generate_fallback_welcome_response(initial_message: str, chief_complaint: Optional[str] = None) -> str:
    """Fallback welcome response when LLM is not available."""
    return f"""Hello! I'm your medical assistant and I'm here to help you document your symptoms for healthcare providers.

{f"I see you mentioned: {chief_complaint}. " if chief_complaint else ""}Thank you for reaching out about your health concerns.

To provide the most helpful documentation:
• Please describe your main symptoms in detail
• When did they start?
• How severe are they on a scale of 1-10?
• What makes them better or worse?

I'll help create a comprehensive report of your condition. Please note that I cannot provide medical diagnoses - my role is to help organize your symptoms for your healthcare provider."""


def _generate_fallback_smart_response(user_message: str, conversation_history: List[Dict]) -> str:
    """Fallback smart response when LLM is not available."""
    message_lower = user_message.lower()
    
    if any(word in message_lower for word in ["yes", "yeah", "yep", "correct"]):
        return "Thank you for confirming that. Could you provide more details about this symptom?"
    elif any(word in message_lower for word in ["no", "nope", "not really"]):
        return "I understand. Are there any other symptoms or concerns you'd like to discuss?"
    elif any(number in message_lower for number in ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]):
        return "Thank you for rating your symptoms. Are there any triggers that make them better or worse?"
    else:
        return "Thank you for that information. Could you tell me more about when these symptoms started and what they feel like?"


def _generate_welcome_response(initial_message: str, chief_complaint: Optional[str] = None) -> str:
    """Generate an intelligent welcome response based on the user's initial message."""
    
    # Extract key symptoms/conditions from the message
    message_lower = initial_message.lower()
    complaint_lower = (chief_complaint or "").lower()
    
    # Common response patterns based on symptoms
    if any(word in message_lower for word in ["pain", "hurt", "ache", "sore"]):
        if any(word in message_lower for word in ["head", "headache"]):
            return """Hello! I understand you're experiencing headache pain. I'm here to help you describe your symptoms in detail so we can create a comprehensive report for your healthcare provider.

Let me ask a few questions to better understand your situation:

• When did your headache start?
• How would you rate the pain intensity on a scale of 1-10?
• Can you describe the type of pain (throbbing, sharp, dull, pressure)?
• What makes it better or worse?

Please remember, I'm not a doctor and cannot provide medical diagnoses. My role is to help organize your symptoms for your healthcare provider."""

        elif any(word in message_lower for word in ["back", "spine"]):
            return """Hello! I see you're experiencing back pain. I'm here to help gather detailed information about your symptoms for your healthcare provider.

To better understand your back pain, could you tell me:

• Where exactly is the pain located (lower back, upper back, between shoulder blades)?
• When did it start and what were you doing when it began?
• How would you rate the pain on a scale of 1-10?
• Does the pain radiate to other areas (legs, arms, etc.)?

I'll help you organize this information into a clear report, but please remember that I cannot provide medical diagnoses."""

    elif any(word in message_lower for word in ["fever", "temperature", "hot", "chills"]):
        return """Hello! I understand you're dealing with fever symptoms. I'm here to help document your symptoms for your healthcare provider.

Let's gather some important details:

• What is your current temperature if you've measured it?
• When did the fever start?
• Are you experiencing any other symptoms along with the fever (headache, body aches, nausea)?
• Have you taken any medications for the fever?

Please note: If your fever is very high (over 103°F/39.4°C) or you're having difficulty breathing, please seek immediate medical attention."""

    elif any(word in message_lower for word in ["cough", "breathing", "chest"]):
        return """Hello! I see you're having respiratory symptoms. I'm here to help document these symptoms for your healthcare provider.

To better understand your condition, could you describe:

• When did your cough start?
• Is it a dry cough or are you producing phlegm?
• Are you experiencing any shortness of breath or chest pain?
• Do you have any fever or other symptoms?

If you're having severe difficulty breathing or chest pain, please seek immediate medical attention. Otherwise, I'll help you organize your symptoms into a comprehensive report."""

    else:
        # Generic welcome for other complaints
        return f"""Hello! I'm your medical assistant and I'm here to help you describe your symptoms and gather information for your healthcare provider.

I see you mentioned: "{chief_complaint or initial_message[:100]}..."

Please note that I'm not a doctor and cannot provide medical diagnoses. My role is to help you organize your symptoms into a clear, comprehensive report that you can share with your healthcare provider.

Could you tell me more about:
• When did these symptoms start?
• How severe are they on a scale of 1-10?
• What makes them better or worse?
• Any other symptoms you're experiencing?

Let's work together to document everything properly."""


def _generate_smart_response(user_message: str, conversation_history: List[Dict]) -> str:
    """Generate an intelligent response based on user input and conversation context."""
    
    message_lower = user_message.lower()
    message_count = len(conversation_history)
    
    # Analyze the type of response needed
    if any(word in message_lower for word in ["yes", "yeah", "yep", "correct"]):
        return "Thank you for confirming that. Could you provide more details about this symptom? For example, when did it start and how has it changed over time?"
    
    elif any(word in message_lower for word in ["no", "nope", "not really", "none"]):
        return "I understand. Let's explore other aspects of your symptoms. Are there any other symptoms or concerns you'd like to discuss?"
    
    elif any(word in message_lower for word in ["started", "began", "since"]):
        return "Thank you for that timeline information. That's very helpful. Now, could you describe the severity or intensity of your symptoms? How would you rate them on a scale of 1-10?"
    
    elif any(number in message_lower for number in ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"]):
        return "Thank you for rating your symptoms. That helps me understand the severity. Are there any specific triggers or activities that make your symptoms better or worse?"
    
    elif any(word in message_lower for word in ["better", "worse", "triggers", "helps", "relief"]):
        return "That's important information about what affects your symptoms. Are you currently taking any medications or treatments for these symptoms? Also, have you noticed any other symptoms occurring along with your main concern?"
    
    elif any(word in message_lower for word in ["medication", "medicine", "pills", "treatment"]):
        return "Thank you for sharing that medication information. It's important to include current treatments in your medical record. Is there anything else about your symptoms that you think would be important for your healthcare provider to know?"
    
    elif message_count < 3:
        # Early in conversation, ask basic follow-up questions
        return "Thank you for sharing that information. To help create a complete picture for your healthcare provider, could you tell me when these symptoms started and how you would rate their severity on a scale of 1-10?"
    
    elif message_count < 6:
        # Mid conversation, gather more specific details
        return "That's helpful detail. Are there any other symptoms occurring along with your main concern? Also, have you tried anything that makes the symptoms better or worse?"
    
    else:
        # Later in conversation, wrap up and summarize
        return "Thank you for providing all that detailed information. Based on what you've shared, I'm building a comprehensive symptom report for your healthcare provider. Is there anything else about your symptoms or health concerns that you'd like to add before we summarize everything?"


def _generate_followup_questions(conversation_history: List[Dict]) -> str:
    """Generate intelligent follow-up questions based on conversation history."""
    
    if not conversation_history:
        return "Let's start with some basic questions about your symptoms:\n\n• When did your symptoms first start?\n• How would you rate the severity on a scale of 1-10?\n• What makes your symptoms better or worse?"
    
    # Analyze what information is missing
    has_timeline = any("when" in msg.get("content", "").lower() or "started" in msg.get("content", "").lower() for msg in conversation_history)
    has_severity = any(str(i) in msg.get("content", "") for msg in conversation_history for i in range(1, 11))
    has_triggers = any(word in msg.get("content", "").lower() for msg in conversation_history for word in ["better", "worse", "trigger", "cause"])
    has_medications = any(word in msg.get("content", "").lower() for msg in conversation_history for word in ["medication", "medicine", "pills", "treatment"])
    
    questions = []
    
    if not has_timeline:
        questions.append("• When did your symptoms first start?")
    
    if not has_severity:
        questions.append("• How would you rate your symptoms on a scale of 1-10?")
    
    if not has_triggers:
        questions.append("• What makes your symptoms better or worse?")
    
    if not has_medications:
        questions.append("• Are you currently taking any medications for these symptoms?")
    
    # Always include general questions
    questions.extend([
        "• Have you noticed any other symptoms?",
        "• Is there anything else you think would be important for your doctor to know?"
    ])
    
    return "Here are some follow-up questions that might help gather more information:\n\n" + "\n".join(questions) 