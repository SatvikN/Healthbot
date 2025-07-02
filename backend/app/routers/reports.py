from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel, Field, EmailStr
import json
import uuid
from pathlib import Path
import tempfile
import os

from ..database import get_db
from ..models.user import User
from ..models.conversation import Conversation, Message
from ..models.symptom import SymptomRecord, MedicalReport, ReportStatus, ReportType
from ..models.diagnosis import DiagnosisResult
from ..routers.auth import get_current_user
from ..services.llm_service import llm_service

router = APIRouter()


# Pydantic models for request/response
class ReportGenerationRequest(BaseModel):
    conversation_id: Optional[int] = None
    symptom_ids: Optional[List[int]] = None
    report_type: str = Field(..., regex="^(consultation|summary|referral|emergency)$")
    include_ai_analysis: bool = True
    include_recommendations: bool = True
    additional_notes: Optional[str] = None
    healthcare_provider_email: Optional[EmailStr] = None


class ReportResponse(BaseModel):
    id: int
    title: str
    report_type: str
    status: str
    generated_at: datetime
    conversation_id: Optional[int]
    symptom_count: int
    urgency_level: Optional[str]
    file_path: Optional[str]


class ReportDetailResponse(BaseModel):
    id: int
    title: str
    report_type: str
    status: str
    generated_at: datetime
    conversation_id: Optional[int]
    patient_info: Dict[str, Any]
    symptoms_summary: Dict[str, Any]
    ai_analysis: Optional[Dict[str, Any]]
    recommendations: List[str]
    urgency_level: str
    medical_specialties: List[str]
    additional_notes: Optional[str]
    file_path: Optional[str]


class EmailReportRequest(BaseModel):
    report_id: int
    healthcare_provider_email: EmailStr
    message: Optional[str] = None
    urgent: bool = False


@router.post("/generate", response_model=ReportResponse)
async def generate_medical_report(
    request: ReportGenerationRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate a comprehensive medical report based on conversation and/or symptoms."""
    
    if not request.conversation_id and not request.symptom_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either conversation_id or symptom_ids must be provided"
        )
    
    try:
        # Validate conversation if provided
        conversation = None
        if request.conversation_id:
            conversation = db.query(Conversation).filter(
                Conversation.id == request.conversation_id,
                Conversation.user_id == current_user.id
            ).first()
            
            if not conversation:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Conversation not found"
                )
        
        # Validate symptoms if provided
        symptoms = []
        if request.symptom_ids:
            symptoms = db.query(SymptomRecord).filter(
                SymptomRecord.id.in_(request.symptom_ids),
                SymptomRecord.user_id == current_user.id
            ).all()
            
            if len(symptoms) != len(request.symptom_ids):
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="One or more symptoms not found"
                )
        
        # Get report type enum
        try:
            report_type = ReportType(request.report_type)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid report type: {request.report_type}"
            )
        
        # Create report record
        report_title = f"{report_type.value.title()} Report - {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}"
        
        report = MedicalReport(
            user_id=current_user.id,
            conversation_id=request.conversation_id,
            title=report_title,
            report_type=report_type,
            status=ReportStatus.GENERATING,
            additional_notes=request.additional_notes
        )
        
        db.add(report)
        db.commit()
        db.refresh(report)
        
        # Schedule background report generation
        background_tasks.add_task(
            _generate_report_content,
            report.id,
            conversation,
            symptoms,
            request.include_ai_analysis,
            request.include_recommendations,
            current_user
        )
        
        # Count symptoms
        symptom_count = len(symptoms)
        if conversation:
            # Add symptoms from conversation
            conversation_symptoms = db.query(SymptomRecord).filter(
                SymptomRecord.conversation_id == conversation.id
            ).all()
            symptom_count += len(conversation_symptoms)
        
        return ReportResponse(
            id=report.id,
            title=report.title,
            report_type=report.report_type.value,
            status=report.status.value,
            generated_at=report.generated_at,
            conversation_id=report.conversation_id,
            symptom_count=symptom_count,
            urgency_level=None,  # Will be updated after generation
            file_path=None  # Will be updated after generation
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate report: {str(e)}"
        )


@router.get("/list", response_model=List[ReportResponse])
async def get_user_reports(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    report_type: Optional[str] = None,
    status: Optional[str] = None,
    days_back: int = 90,
    limit: int = 20,
    offset: int = 0
):
    """Get user's medical reports with filtering options."""
    
    # Build query with filters
    query = db.query(MedicalReport).filter(
        MedicalReport.user_id == current_user.id,
        MedicalReport.generated_at >= datetime.utcnow() - timedelta(days=days_back)
    )
    
    if report_type:
        try:
            report_type_enum = ReportType(report_type)
            query = query.filter(MedicalReport.report_type == report_type_enum)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid report type: {report_type}"
            )
    
    if status:
        try:
            status_enum = ReportStatus(status)
            query = query.filter(MedicalReport.status == status_enum)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {status}"
            )
    
    reports = query.order_by(
        MedicalReport.generated_at.desc()
    ).offset(offset).limit(limit).all()
    
    result = []
    for report in reports:
        # Count symptoms
        symptom_count = 0
        if report.conversation_id:
            symptom_count = db.query(SymptomRecord).filter(
                SymptomRecord.conversation_id == report.conversation_id
            ).count()
        
        result.append(ReportResponse(
            id=report.id,
            title=report.title,
            report_type=report.report_type.value,
            status=report.status.value,
            generated_at=report.generated_at,
            conversation_id=report.conversation_id,
            symptom_count=symptom_count,
            urgency_level=report.urgency_level,
            file_path=report.file_path
        ))
    
    return result


@router.get("/detail/{report_id}", response_model=ReportDetailResponse)
async def get_report_details(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed report information."""
    
    report = db.query(MedicalReport).filter(
        MedicalReport.id == report_id,
        MedicalReport.user_id == current_user.id
    ).first()
    
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
    
    # Get patient info
    patient_info = {
        "name": current_user.full_name,
        "email": current_user.email,
        "date_of_birth": current_user.date_of_birth.isoformat() if current_user.date_of_birth else None,
        "medical_history": current_user.medical_history
    }
    
    # Get symptoms summary
    symptoms = []
    if report.conversation_id:
        symptoms = db.query(SymptomRecord).filter(
            SymptomRecord.conversation_id == report.conversation_id
        ).all()
    
    symptoms_summary = {
        "total_symptoms": len(symptoms),
        "severity_range": {
            "min": min(s.severity for s in symptoms) if symptoms else 0,
            "max": max(s.severity for s in symptoms) if symptoms else 0,
            "average": sum(s.severity for s in symptoms) / len(symptoms) if symptoms else 0
        },
        "categories": list(set(s.category.value for s in symptoms)) if symptoms else [],
        "symptoms": [
            {
                "name": s.name,
                "severity": s.severity,
                "category": s.category.value,
                "onset_date": s.onset_date.isoformat(),
                "location": s.location
            }
            for s in symptoms
        ]
    }
    
    return ReportDetailResponse(
        id=report.id,
        title=report.title,
        report_type=report.report_type.value,
        status=report.status.value,
        generated_at=report.generated_at,
        conversation_id=report.conversation_id,
        patient_info=patient_info,
        symptoms_summary=symptoms_summary,
        ai_analysis=report.ai_analysis,
        recommendations=report.recommendations or [],
        urgency_level=report.urgency_level or "low",
        medical_specialties=report.medical_specialties or [],
        additional_notes=report.additional_notes,
        file_path=report.file_path
    )


@router.get("/download/{report_id}")
async def download_report(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download report as PDF file."""
    
    report = db.query(MedicalReport).filter(
        MedicalReport.id == report_id,
        MedicalReport.user_id == current_user.id
    ).first()
    
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
    
    if report.status != ReportStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Report is not ready for download"
        )
    
    if not report.file_path or not os.path.exists(report.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report file not found"
        )
    
    filename = f"medical_report_{report.id}_{datetime.utcnow().strftime('%Y%m%d')}.pdf"
    
    return FileResponse(
        path=report.file_path,
        filename=filename,
        media_type="application/pdf"
    )


@router.post("/email")
async def email_report_to_provider(
    request: EmailReportRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Email a report to a healthcare provider."""
    
    report = db.query(MedicalReport).filter(
        MedicalReport.id == request.report_id,
        MedicalReport.user_id == current_user.id
    ).first()
    
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
    
    if report.status != ReportStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Report is not ready to be sent"
        )
    
    # Schedule background email sending
    background_tasks.add_task(
        _send_report_email,
        report.id,
        request.healthcare_provider_email,
        request.message,
        request.urgent,
        current_user
    )
    
    return {
        "status": "success",
        "message": "Report email scheduled for delivery",
        "recipient": request.healthcare_provider_email,
        "report_id": request.report_id
    }


@router.delete("/delete/{report_id}")
async def delete_report(
    report_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a medical report."""
    
    report = db.query(MedicalReport).filter(
        MedicalReport.id == report_id,
        MedicalReport.user_id == current_user.id
    ).first()
    
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Report not found"
        )
    
    try:
        # Delete file if exists
        if report.file_path and os.path.exists(report.file_path):
            os.remove(report.file_path)
        
        # Delete database record
        db.delete(report)
        db.commit()
        
        return {
            "status": "success",
            "message": "Report deleted successfully",
            "report_id": report_id
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete report: {str(e)}"
        )


@router.get("/templates", response_model=List[Dict[str, Any]])
async def get_report_templates():
    """Get available report templates."""
    
    templates = [
        {
            "type": "consultation",
            "name": "Consultation Report",
            "description": "Comprehensive report for routine medical consultations",
            "sections": ["patient_info", "chief_complaint", "symptoms", "ai_analysis", "recommendations"]
        },
        {
            "type": "summary",
            "name": "Symptom Summary",
            "description": "Concise summary of patient symptoms and patterns",
            "sections": ["patient_info", "symptoms_timeline", "severity_analysis", "patterns"]
        },
        {
            "type": "referral",
            "name": "Referral Report",
            "description": "Detailed report for specialist referrals",
            "sections": ["patient_info", "referring_concern", "detailed_history", "specialist_recommendations"]
        },
        {
            "type": "emergency",
            "name": "Emergency Report",
            "description": "Urgent report for emergency situations",
            "sections": ["patient_info", "urgent_symptoms", "severity_assessment", "immediate_recommendations"]
        }
    ]
    
    return templates


@router.get("/stats", response_model=Dict[str, Any])
async def get_report_statistics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    days_back: int = 90
):
    """Get report generation statistics for the user."""
    
    start_date = datetime.utcnow() - timedelta(days=days_back)
    
    # Get all reports in timeframe
    reports = db.query(MedicalReport).filter(
        MedicalReport.user_id == current_user.id,
        MedicalReport.generated_at >= start_date
    ).all()
    
    if not reports:
        return {
            "total_reports": 0,
            "completed_reports": 0,
            "report_type_distribution": {},
            "urgency_distribution": {},
            "average_generation_time": 0
        }
    
    # Calculate statistics
    total_reports = len(reports)
    completed_reports = len([r for r in reports if r.status == ReportStatus.COMPLETED])
    
    # Type distribution
    type_counts = {}
    for report in reports:
        report_type = report.report_type.value
        type_counts[report_type] = type_counts.get(report_type, 0) + 1
    
    # Urgency distribution
    urgency_counts = {}
    for report in reports:
        urgency = report.urgency_level or "unknown"
        urgency_counts[urgency] = urgency_counts.get(urgency, 0) + 1
    
    # Average generation time (mock calculation)
    avg_generation_time = 120  # 2 minutes average
    
    return {
        "total_reports": total_reports,
        "completed_reports": completed_reports,
        "completion_rate": round((completed_reports / total_reports) * 100, 2) if total_reports > 0 else 0,
        "report_type_distribution": type_counts,
        "urgency_distribution": urgency_counts,
        "average_generation_time": avg_generation_time
    }


# Background task functions
async def _generate_report_content(
    report_id: int,
    conversation: Optional[Conversation],
    symptoms: List[SymptomRecord],
    include_ai_analysis: bool,
    include_recommendations: bool,
    user: User
):
    """Background task to generate report content."""
    
    from ..database import SessionLocal
    db = SessionLocal()
    
    try:
        report = db.query(MedicalReport).filter(MedicalReport.id == report_id).first()
        if not report:
            return
        
        # Collect all data for report
        report_data = {
            "patient_info": {
                "name": user.full_name,
                "email": user.email,
                "date_of_birth": user.date_of_birth.isoformat() if user.date_of_birth else None,
                "medical_history": user.medical_history
            },
            "conversation": None,
            "symptoms": [],
            "ai_analysis": None,
            "recommendations": []
        }
        
        # Add conversation data
        if conversation:
            messages = db.query(Message).filter(
                Message.conversation_id == conversation.id
            ).order_by(Message.created_at.asc()).all()
            
            report_data["conversation"] = {
                "id": conversation.id,
                "title": conversation.title,
                "chief_complaint": conversation.chief_complaint,
                "started_at": conversation.started_at.isoformat(),
                "messages": [
                    {
                        "type": msg.message_type.value,
                        "content": msg.content,
                        "created_at": msg.created_at.isoformat()
                    }
                    for msg in messages
                ]
            }
        
        # Add symptoms data
        all_symptoms = symptoms[:]
        if conversation:
            conversation_symptoms = db.query(SymptomRecord).filter(
                SymptomRecord.conversation_id == conversation.id
            ).all()
            all_symptoms.extend(conversation_symptoms)
        
        report_data["symptoms"] = [
            {
                "name": s.name,
                "description": s.description,
                "severity": s.severity,
                "category": s.category.value,
                "location": s.location,
                "onset_date": s.onset_date.isoformat(),
                "duration_hours": s.duration_hours,
                "triggers": s.triggers,
                "alleviating_factors": s.alleviating_factors,
                "associated_symptoms": s.associated_symptoms
            }
            for s in all_symptoms
        ]
        
        # Generate AI analysis if requested
        if include_ai_analysis and (conversation or symptoms):
            async with llm_service:
                analysis_result = await llm_service.generate_medical_report(
                    report_data,
                    report.report_type.value
                )
            
            if analysis_result.get("success"):
                ai_data = analysis_result.get("response", {})
                report_data["ai_analysis"] = ai_data.get("analysis", {})
                
                if include_recommendations:
                    report_data["recommendations"] = ai_data.get("recommendations", [])
                
                # Update report with AI insights
                report.ai_analysis = ai_data.get("analysis", {})
                report.recommendations = ai_data.get("recommendations", [])
                report.urgency_level = ai_data.get("urgency_level", "low")
                report.medical_specialties = ai_data.get("medical_specialties", [])
        
        # Generate PDF file
        pdf_path = await _generate_pdf_report(report_data, report)
        
        # Update report status
        report.status = ReportStatus.COMPLETED
        report.file_path = pdf_path
        report.completed_at = datetime.utcnow()
        
        db.commit()
        
    except Exception as e:
        # Update report status to failed
        report.status = ReportStatus.FAILED
        report.error_message = str(e)
        db.commit()
        
    finally:
        db.close()


async def _generate_pdf_report(report_data: Dict[str, Any], report: MedicalReport) -> str:
    """Generate PDF report from data."""
    
    # Create temporary PDF file (simplified - would use actual PDF library)
    temp_dir = tempfile.gettempdir()
    pdf_filename = f"report_{report.id}_{uuid.uuid4().hex[:8]}.pdf"
    pdf_path = os.path.join(temp_dir, pdf_filename)
    
    # Mock PDF generation - would use libraries like ReportLab or WeasyPrint
    with open(pdf_path, 'w') as f:
        f.write(f"Medical Report - {report.title}\n")
        f.write(f"Generated: {datetime.utcnow().isoformat()}\n")
        f.write(f"Patient: {report_data['patient_info']['name']}\n")
        f.write(f"Report Type: {report.report_type.value}\n\n")
        
        if report_data['symptoms']:
            f.write("SYMPTOMS:\n")
            for symptom in report_data['symptoms']:
                f.write(f"- {symptom['name']} (Severity: {symptom['severity']}/10)\n")
        
        if report_data['ai_analysis']:
            f.write(f"\nAI ANALYSIS:\n{report_data['ai_analysis']}\n")
        
        if report_data['recommendations']:
            f.write(f"\nRECOMMENDATIONS:\n")
            for rec in report_data['recommendations']:
                f.write(f"- {rec}\n")
    
    return pdf_path


async def _send_report_email(
    report_id: int,
    healthcare_provider_email: str,
    message: Optional[str],
    urgent: bool,
    user: User
):
    """Background task to send report via email."""
    
    # Mock email sending - would integrate with actual email service
    print(f"Sending report {report_id} to {healthcare_provider_email}")
    print(f"From: {user.email}")
    print(f"Urgent: {urgent}")
    print(f"Message: {message}")
    
    # In real implementation, would:
    # 1. Get report file
    # 2. Compose email with attachment
    # 3. Send via SMTP or email service API
    # 4. Log email sending status 