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
from ..models.conversation import Conversation, Message
from ..models.medical_report import MedicalReport
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
            status="active"
        )
        
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
        
        # Add initial user message
        user_message = Message(
            conversation_id=conversation.id,
            role="user",
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
            role="assistant",
            content=welcome_response
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
    
    if conversation.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot send message to inactive conversation"
        )
    
    try:
        # Save user message
        user_message = Message(
            conversation_id=conversation.id,
            role="user",
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
            role="assistant",
            content=ai_response
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
                "requires_followup": requires_followup
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
            status=conv.status,
            started_at=conv.created_at,
            chief_complaint=conv.chief_complaint,
            urgency_level=None,
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
            "message_type": msg.role,  # Use role field which contains user/assistant/system
            "content": msg.content,
            "created_at": msg.created_at,
            "processing_time": msg.processing_time,
            "contains_symptoms": msg.contains_symptoms,
            "contains_medical_advice": msg.contains_medical_info,
            "requires_followup": _requires_followup(msg.content)
        })
    
    return {
        "conversation": {
            "id": conversation.id,
            "title": conversation.title,
            "status": conversation.status,
            "started_at": conversation.created_at,
            "updated_at": conversation.updated_at,
            "chief_complaint": conversation.chief_complaint,
            "urgency_level": None
        },
        "messages": message_list,
        "message_count": len(message_list)
    }


@router.post("/conversation/{conversation_id}/complete")
async def complete_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark conversation as completed."""
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    ).first()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    conversation.status = "completed"
    conversation.completed_at = datetime.utcnow()
    
    db.commit()
    
    return {"status": "success", "message": "Conversation marked as completed"}


@router.post("/conversation/{conversation_id}/diagnosis", response_model=Dict[str, Any])
async def generate_diagnosis_recommendations(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate diagnosis and treatment recommendations based on conversation history."""
    
    conversation = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    ).first()
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversation not found"
        )
    
    try:
        # Get conversation history
        conversation_history = _get_conversation_history(db, conversation_id)
        
        if not conversation_history:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No conversation history available for analysis"
            )
        
        # Generate diagnosis using LLM
        async with LLMService() as llm_service:
            diagnosis_response = await _generate_diagnosis_llm(
                llm_service, conversation_history, current_user
            )
        
        # Save AI diagnosis message
        ai_message = Message(
            conversation_id=conversation.id,
            role="assistant",
            content=diagnosis_response
        )
        
        db.add(ai_message)
        db.commit()
        db.refresh(ai_message)
        
        return {
            "status": "success",
            "diagnosis_message": {
                "id": ai_message.id,
                "content": ai_message.content,
                "created_at": ai_message.created_at
            },
            "conversation_id": conversation_id
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate diagnosis: {str(e)}"
        )


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


@router.post("/conversation/{conversation_id}/medical-report")
async def generate_medical_report(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a formal medical report from conversation history suitable for healthcare providers."""
    
    # Verify conversation exists and belongs to user
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
    
    if not conversation_history:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No conversation history available for report generation"
        )
    
    try:
        # Initialize LLM service
        llm_service = LLMService()
        
        # Generate medical report
        report_content = await _generate_medical_report_llm(
            llm_service, conversation_history, current_user
        )
        
        # Create a medical report record
        
        report = MedicalReport(
            user_id=current_user.id,
            conversation_id=conversation_id,
            title=f"Medical Report - {conversation.title}",
            type="medical_consultation",
            summary=report_content.get("summary", ""),
            key_findings=report_content.get("key_findings", []),
            recommendations=report_content.get("recommendations", []),
            urgency_level=report_content.get("urgency_level", "medium"),
            status="completed"
        )
        
        db.add(report)
        db.commit()
        db.refresh(report)
        
        return {
            "report_id": report.id,
            "title": report.title,
            "content": report_content,
            "status": "completed",
            "message": "Medical report generated successfully"
        }
        
    except Exception as e:
        logger.error(f"Error generating medical report: {str(e)}")
        # Return fallback report if LLM fails
        fallback_content = _generate_fallback_medical_report(conversation_history, current_user)
        
        report = MedicalReport(
            user_id=current_user.id,
            conversation_id=conversation_id,
            title=f"Medical Report - {conversation.title}",
            type="medical_consultation",
            summary=fallback_content.get("summary", ""),
            key_findings=fallback_content.get("key_findings", []),
            recommendations=fallback_content.get("recommendations", []),
            urgency_level=fallback_content.get("urgency_level", "medium"),
            status="completed"
        )
        
        db.add(report)
        db.commit()
        db.refresh(report)
        
        return {
            "report_id": report.id,
            "title": report.title,
            "content": fallback_content,
            "status": "completed",
            "message": "Medical report generated successfully (fallback mode)"
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
            "message_type": msg.role,  # Use role field which contains user/assistant/system
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


@router.get("/test-medical-report/{conversation_id}")
async def test_medical_report_generation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Test endpoint for debugging medical report generation."""
    try:
        # Test 1: Check conversation exists
        conversation = db.query(Conversation).filter(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id
        ).first()
        
        if not conversation:
            return {"error": "Conversation not found", "step": "conversation_check"}
        
        # Test 2: Get conversation history
        conversation_history = _get_conversation_history(db, conversation_id)
        
        if not conversation_history:
            return {"error": "No conversation history", "step": "history_check"}
        
        # Test 3: Try creating a simple medical report without LLM
        simple_report = MedicalReport(
            user_id=current_user.id,
            conversation_id=conversation_id,
            title=f"Test Report - {conversation.title}",
            type="medical_consultation",
            summary="Test summary",
            key_findings=["Test finding"],
            recommendations=["Test recommendation"],
            urgency_level="medium",
            status="completed"
        )
        
        db.add(simple_report)
        db.commit()
        db.refresh(simple_report)
        
        return {
            "success": True,
            "message": "Test medical report created successfully",
            "report_id": simple_report.id,
            "conversation_history_count": len(conversation_history),
            "conversation_title": conversation.title
        }
        
    except Exception as e:
        db.rollback()
        return {
            "error": str(e),
            "error_type": type(e).__name__,
            "step": "database_operation"
        }


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


async def _generate_diagnosis_llm(
    llm_service: LLMService, conversation_history: List[Dict], user: User
) -> str:
    """Generate diagnosis and treatment recommendations based on conversation history."""
    
    system_prompt = """You are a medical AI assistant providing preliminary analysis and recommendations based on symptom information gathered during consultation.

IMPORTANT DISCLAIMERS:
- You are NOT providing official medical diagnoses
- Your analysis is for informational purposes only  
- Always recommend consulting with healthcare professionals for proper diagnosis and treatment
- For serious or emergency symptoms, always recommend immediate medical attention

Your role is to:
1. Summarize the key symptoms and findings from the conversation
2. Suggest possible common conditions that could explain the symptoms
3. Provide general health recommendations and self-care suggestions
4. Clearly indicate what symptoms require immediate medical attention
5. Recommend appropriate next steps for care

Be thorough but appropriately cautious, and always prioritize patient safety. If you need more information to provide meaningful recommendations, clearly state what additional information would be helpful."""

    # Format conversation history
    history_text = "CONSULTATION SUMMARY:\n\n"
    for msg in conversation_history:
        role = "Patient" if msg.get("message_type") == "user" else "Assistant"
        history_text += f"{role}: {msg.get('content', '')}\n"
    
    # Add user context if available
    if user:
        history_text += f"\nPATIENT CONTEXT:\n"
        if user.age:
            history_text += f"Age: {user.age}\n"
        if user.gender:
            history_text += f"Gender: {user.gender}\n"
        if user.medical_history:
            history_text += f"Medical History: {user.medical_history}\n"
        if user.current_medications:
            history_text += f"Current Medications: {user.current_medications}\n"
        if user.allergies:
            history_text += f"Allergies: {user.allergies}\n"
    
    prompt = f"""{history_text}

Based on this consultation, please provide:

1. **SYMPTOM SUMMARY**: A clear summary of the key symptoms reported
2. **POSSIBLE CONDITIONS**: Common conditions that could explain these symptoms (with confidence levels)
3. **RECOMMENDATIONS**: General health recommendations and self-care suggestions
4. **RED FLAGS**: Any symptoms that require immediate medical attention
5. **NEXT STEPS**: Recommended actions and follow-up care

Please format your response clearly and include appropriate medical disclaimers."""
    
    try:
        result = await llm_service.generate_response(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.3,
            max_tokens=800
        )
        
        if result.get("success"):
            return result.get("response", "I need more information to provide meaningful recommendations. Please provide additional details about your symptoms.")
        else:
            return "I'm unable to generate recommendations at this time. Please consult with a healthcare provider for proper evaluation of your symptoms."
            
    except Exception as e:
        logger.error(f"Error generating diagnosis: {e}")
        return "I'm unable to generate recommendations at this time. Please consult with a healthcare provider for proper evaluation of your symptoms."


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


async def _generate_medical_report_llm(
    llm_service: LLMService, conversation_history: List[Dict], user: User
) -> Dict[str, Any]:
    """Generate medical report using LLM based on conversation history."""
    
    # Format conversation for medical report
    conversation_text = ""
    for msg in conversation_history:
        role = "Patient" if msg["role"] == "user" else "AI Assistant"
        conversation_text += f"{role}: {msg['content']}\n\n"
    
    system_prompt = f"""You are a medical documentation specialist. Generate a formal medical report based on the patient conversation below.

Patient Information:
- Name: {user.full_name or 'Patient'}
- Email: {user.email}
- Age: {user.age or 'Not specified'}
- Gender: {user.gender or 'Not specified'}

Create a structured medical report with the following sections:

1. CHIEF COMPLAINT
2. HISTORY OF PRESENT ILLNESS
3. SYMPTOMS SUMMARY
4. CLINICAL IMPRESSION
5. RECOMMENDATIONS FOR HEALTHCARE PROVIDER
6. URGENCY ASSESSMENT

Format the response as structured text suitable for a medical record. Be professional, objective, and include relevant timeline information. Focus on medical facts and observations.

Conversation:
{conversation_text}

Provide a comprehensive medical report based on this conversation."""

    try:
        report_text = await llm_service.generate_response(conversation_text, system_prompt)
        
        # Extract key information for structured data
        key_findings = []
        recommendations = []
        urgency_level = "medium"
        
        # Simple extraction logic (could be enhanced with more sophisticated parsing)
        if "urgent" in report_text.lower() or "emergency" in report_text.lower():
            urgency_level = "high"
        elif "routine" in report_text.lower() or "stable" in report_text.lower():
            urgency_level = "low"
            
        # Extract symptoms mentioned
        for msg in conversation_history:
            if msg["role"] == "user":
                content_lower = msg["content"].lower()
                if any(symptom in content_lower for symptom in ["pain", "headache", "fever", "nausea", "fatigue", "dizziness"]):
                    key_findings.append(f"Patient reported: {msg['content'][:100]}...")
        
        # Generate basic recommendations
        recommendations = [
            "Recommend follow-up with primary care physician",
            "Consider further diagnostic evaluation as clinically indicated",
            "Patient education provided regarding symptom monitoring"
        ]
        
        return {
            "content": report_text,
            "summary": f"Medical consultation report for {user.full_name or 'patient'} based on symptom discussion",
            "key_findings": key_findings,
            "recommendations": recommendations,
            "urgency_level": urgency_level
        }
        
    except Exception as e:
        logger.error(f"LLM medical report generation failed: {str(e)}")
        raise


def _generate_fallback_medical_report(conversation_history: List[Dict], user: User) -> Dict[str, Any]:
    """Generate fallback medical report when LLM is not available."""
    
    # Count messages and extract basic info
    user_messages = [msg for msg in conversation_history if msg["role"] == "user"]
    ai_messages = [msg for msg in conversation_history if msg["role"] == "assistant"]
    
    # Extract potential symptoms from user messages
    symptoms_mentioned = []
    concerns_mentioned = []
    
    for msg in user_messages:
        content_lower = msg["content"].lower()
        # Simple keyword detection
        if any(word in content_lower for word in ["pain", "hurt", "ache"]):
            symptoms_mentioned.append("Pain symptoms reported")
        if any(word in content_lower for word in ["fever", "temperature", "hot"]):
            symptoms_mentioned.append("Fever/temperature concerns")
        if any(word in content_lower for word in ["headache", "head"]):
            symptoms_mentioned.append("Headache symptoms")
        if any(word in content_lower for word in ["nausea", "sick", "vomit"]):
            symptoms_mentioned.append("Nausea/digestive symptoms")
        if any(word in content_lower for word in ["tired", "fatigue", "exhausted"]):
            symptoms_mentioned.append("Fatigue symptoms")
    
    # Generate basic report content
    report_content = f"""MEDICAL CONSULTATION REPORT

Patient Information:
- Name: {user.full_name or 'Patient'}
- Email: {user.email}
- Age: {user.age or 'Not specified'}
- Gender: {user.gender or 'Not specified'}

CONSULTATION SUMMARY:
This report is based on a digital health consultation with {len(user_messages)} patient messages and {len(ai_messages)} AI assistant responses.

CHIEF COMPLAINT:
{user_messages[0]["content"] if user_messages else "Patient initiated health consultation"}

SYMPTOMS DOCUMENTED:
{chr(10).join([f"- {symptom}" for symptom in symptoms_mentioned]) if symptoms_mentioned else "- General health inquiry"}

CONSULTATION NOTES:
- Interactive health discussion completed
- Symptom information gathered through structured conversation
- Patient provided detailed descriptions of concerns

CLINICAL IMPRESSION:
Based on the consultation, the patient has presented with health concerns requiring professional medical evaluation.

RECOMMENDATIONS:
- Follow-up with primary care physician recommended
- Consider in-person clinical evaluation
- Continue monitoring symptoms as discussed
- Patient educated on when to seek immediate care

URGENCY ASSESSMENT: Routine follow-up recommended

Note: This report is generated from an AI-assisted health consultation and should be reviewed by a qualified healthcare professional."""

    key_findings = symptoms_mentioned if symptoms_mentioned else ["Patient completed health consultation"]
    
    recommendations = [
        "Primary care physician follow-up recommended",
        "Clinical evaluation for reported symptoms",
        "Patient education provided during consultation"
    ]
    
    return {
        "content": report_content,
        "summary": f"Health consultation report for {user.full_name or 'patient'}",
        "key_findings": key_findings,
        "recommendations": recommendations,
        "urgency_level": "medium"
    } 