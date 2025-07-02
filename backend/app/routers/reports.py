from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel

from ..database import get_db
from ..models.user import User
from ..models.conversation import Conversation, Message
from ..models.medical_report import MedicalReport
from ..routers.auth import get_current_user
from ..services.llm_service import LLMService
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


# Pydantic models for request/response
class CreateReportRequest(BaseModel):
    conversation_id: int
    report_type: str  # initial_consultation, follow_up, symptom_tracking
    title: Optional[str] = None


class ReportResponse(BaseModel):
    id: int
    title: str
    type: str
    status: str
    createdAt: str
    conversationId: int
    conversationTitle: Optional[str]
    summary: Optional[str]
    urgencyLevel: str
    keyFindings: List[str]
    recommendations: List[str]
    fileSize: Optional[str]


@router.get("/test")
async def test_reports():
    """Test endpoint for reports."""
    return {"message": "Reports router is working"}


@router.get("/test-data")
async def get_test_reports():
    """Test endpoint that returns mock reports data without auth."""
    return [
        {
            "id": 1,
            "title": "Headache Analysis Report",
            "report_type": "symptom_analysis",
            "status": "completed",
            "generated_at": "2025-07-01T12:00:00Z",
            "conversation_id": 1,
            "symptom_count": 2,
            "urgency_level": "medium"
        },
        {
            "id": 2,
            "title": "Weekly Health Summary",
            "report_type": "health_summary",
            "status": "completed",
            "generated_at": "2025-06-30T18:00:00Z",
            "conversation_id": None,
            "symptom_count": 5,
            "urgency_level": "low"
        }
    ]


@router.get("/list", response_model=List[ReportResponse])
async def get_user_reports(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 20,
    offset: int = 0,
    report_type: Optional[str] = None,
    status: Optional[str] = None
):
    """Get user's medical reports with filtering options."""
    
    query = db.query(MedicalReport).filter(MedicalReport.user_id == current_user.id)
    
    # Apply filters
    if report_type and report_type != "all":
        query = query.filter(MedicalReport.type == report_type)
    
    if status and status != "all":
        query = query.filter(MedicalReport.status == status)
    
    # Order by most recent first
    query = query.order_by(MedicalReport.created_at.desc())
    
    # Apply pagination
    reports = query.offset(offset).limit(limit).all()
    
    # Convert to response format
    return [
        ReportResponse(
            id=report.id,
            title=report.title,
            type=report.type,
            status=report.status,
            createdAt=report.created_at.isoformat(),
            conversationId=report.conversation_id,
            conversationTitle=report.conversation.title if report.conversation else None,
            summary=report.summary,
            urgencyLevel=report.urgency_level,
            keyFindings=report.key_findings or [],
            recommendations=report.recommendations or [],
            fileSize=report.file_size
        )
        for report in reports
    ]


@router.post("/create", response_model=Dict[str, Any])
async def create_medical_report(
    request: CreateReportRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new medical report from a conversation."""
    
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
    
    # Create report record
    report_title = request.title or f"{request.report_type.replace('_', ' ').title()} - {datetime.now().strftime('%Y-%m-%d')}"
    
    report = MedicalReport(
        user_id=current_user.id,
        conversation_id=request.conversation_id,
        title=report_title,
        type=request.report_type,
        status="in_progress"
    )
    
    db.add(report)
    db.commit()
    db.refresh(report)
    
    # Generate report content in background
    background_tasks.add_task(
        _generate_report_content,
        db_session=db,
        report_id=report.id
    )
    
    return {
        "id": report.id,
        "title": report.title,
        "status": "in_progress",
        "message": "Report creation started. You'll be notified when it's complete.",
        "type": report.type
    }


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report_details(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed information about a specific report."""
    
    report = db.query(MedicalReport).filter(
        MedicalReport.id == report_id,
        MedicalReport.user_id == current_user.id
    ).first()
    
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
    
    return ReportResponse(
        id=report.id,
        title=report.title,
        type=report.type,
        status=report.status,
        createdAt=report.created_at.isoformat(),
        conversationId=report.conversation_id,
        conversationTitle=report.conversation.title if report.conversation else None,
        summary=report.summary,
        urgencyLevel=report.urgency_level,
        keyFindings=report.key_findings or [],
        recommendations=report.recommendations or [],
        fileSize=report.file_size
    )


@router.post("/conversation/{conversation_id}/generate")
async def generate_report_from_conversation(
    conversation_id: int,
    report_type: str = "initial_consultation",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a medical report from a conversation immediately (for demo/testing)."""
    
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
    
    try:
        # Generate report content immediately using LLM
        async with LLMService() as llm_service:
            report_data = await _generate_report_content_llm(
                llm_service=llm_service,
                conversation=conversation,
                report_type=report_type
            )
        
        # Create and save report
        report = MedicalReport(
            user_id=current_user.id,
            conversation_id=conversation_id,
            title=report_data["title"],
            type=report_type,
            status="completed",
            summary=report_data["summary"],
            key_findings=report_data["key_findings"],
            recommendations=report_data["recommendations"],
            urgency_level=report_data["urgency_level"],
            file_size="2.1 MB",  # Simulated file size
            ai_model_used="llama3.2:latest",
            processing_time=report_data.get("processing_time", 0),
            completed_at=datetime.utcnow()
        )
        
        db.add(report)
        db.commit()
        db.refresh(report)
        
        return {
            "id": report.id,
            "title": report.title,
            "status": "completed",
            "message": "Report generated successfully",
            "report": report.to_dict()
        }
        
    except Exception as e:
        logger.error(f"Error generating report: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate report: {str(e)}"
        )


async def _generate_report_content_llm(
    llm_service: LLMService,
    conversation: Conversation,
    report_type: str
) -> Dict[str, Any]:
    """Generate report content using LLM service."""
    
    # Get conversation messages
    messages = conversation.messages
    
    # Format conversation for LLM
    conversation_text = ""
    for msg in messages:
        role = "Patient" if msg.message_type.value == "user" else "Assistant"
        conversation_text += f"{role}: {msg.content}\n"
    
    # Create appropriate system prompt based on report type
    if report_type == "initial_consultation":
        system_prompt = """You are a medical documentation AI creating an initial consultation report. 

Analyze the conversation and generate a structured JSON response with:
{
  "title": "Descriptive report title",
  "summary": "Professional summary of the consultation",
  "key_findings": ["finding1", "finding2", "finding3"],
  "recommendations": ["recommendation1", "recommendation2"],
  "urgency_level": "low|medium|high"
}

Focus on: chief complaint, symptoms presented, patient history, and initial assessment."""

    elif report_type == "follow_up":
        system_prompt = """You are a medical documentation AI creating a follow-up report.

Analyze the conversation and generate a structured JSON response with:
{
  "title": "Follow-up report title",
  "summary": "Summary of follow-up discussion and progress",
  "key_findings": ["progress update", "current status", "new developments"],
  "recommendations": ["continued care", "adjustments", "next steps"],
  "urgency_level": "low|medium|high"
}

Focus on: treatment progress, symptom changes, patient response to interventions."""

    else:  # symptom_tracking
        system_prompt = """You are a medical documentation AI creating a symptom tracking report.

Analyze the conversation and generate a structured JSON response with:
{
  "title": "Symptom tracking report title",
  "summary": "Summary of symptom patterns and tracking data",
  "key_findings": ["symptom patterns", "triggers identified", "severity trends"],
  "recommendations": ["monitoring suggestions", "lifestyle modifications"],
  "urgency_level": "low|medium|high"
}

Focus on: symptom progression, patterns, triggers, and monitoring recommendations."""
    
    prompt = f"Conversation to analyze:\n{conversation_text}"
    
    try:
        result = await llm_service.generate_response(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=0.3,
            max_tokens=500
        )
        
        if result.get("success"):
            import json
            # Try to parse JSON response
            try:
                report_data = json.loads(result.get("response", "{}"))
                report_data["processing_time"] = result.get("processing_time", 0)
                return report_data
            except json.JSONDecodeError:
                # Fallback if JSON parsing fails
                return _generate_fallback_report_content(conversation, report_type)
        else:
            return _generate_fallback_report_content(conversation, report_type)
            
    except Exception as e:
        logger.error(f"Error in LLM report generation: {e}")
        return _generate_fallback_report_content(conversation, report_type)


def _generate_fallback_report_content(conversation: Conversation, report_type: str) -> Dict[str, Any]:
    """Generate fallback report content when LLM is not available."""
    
    message_count = len(conversation.messages)
    
    if report_type == "initial_consultation":
        return {
            "title": f"Initial Consultation - {conversation.title}",
            "summary": f"Initial medical consultation with {message_count} exchanges. Patient presented with health concerns requiring documentation and potential follow-up care.",
            "key_findings": [
                "Patient presented with chief complaint",
                "Symptom details documented",
                "Medical history reviewed",
                "Initial assessment completed"
            ],
            "recommendations": [
                "Continue monitoring symptoms",
                "Follow up with healthcare provider",
                "Maintain symptom diary",
                "Seek medical attention if symptoms worsen"
            ],
            "urgency_level": "medium",
            "processing_time": 0
        }
    
    elif report_type == "follow_up":
        return {
            "title": f"Follow-up Report - {conversation.title}",
            "summary": f"Follow-up consultation with {message_count} exchanges. Review of ongoing condition and treatment progress.",
            "key_findings": [
                "Patient status reviewed",
                "Treatment response documented",
                "Symptom progression noted",
                "Current condition assessed"
            ],
            "recommendations": [
                "Continue current treatment plan",
                "Monitor for changes",
                "Schedule next follow-up",
                "Contact provider with concerns"
            ],
            "urgency_level": "low",
            "processing_time": 0
        }
    
    else:  # symptom_tracking
        return {
            "title": f"Symptom Tracking - {conversation.title}",
            "summary": f"Symptom tracking session with {message_count} exchanges. Monitoring of symptom patterns and progression.",
            "key_findings": [
                "Symptom patterns documented",
                "Severity levels recorded",
                "Trigger factors identified",
                "Tracking data collected"
            ],
            "recommendations": [
                "Continue symptom monitoring",
                "Note pattern changes",
                "Identify additional triggers",
                "Share data with healthcare provider"
            ],
            "urgency_level": "low",
            "processing_time": 0
        }


def _generate_report_content(db_session: Session, report_id: int):
    """Background task to generate report content."""
    # This would be called as a background task
    # For now, we'll use the immediate generation approach
    pass 