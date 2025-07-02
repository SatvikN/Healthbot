from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from ..database import get_db
from ..models.user import User
from ..models.symptom import SymptomReport
from ..routers.auth import get_current_user

router = APIRouter()


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


@router.get("/list")
async def get_reports(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's reports."""
    reports = db.query(SymptomReport).filter(SymptomReport.user_id == current_user.id).all()
    return [{"id": r.id, "title": r.title, "status": r.status, "created_at": r.created_at} for r in reports[:10]]


@router.post("/create")
async def create_report(
    title: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new report."""
    report = SymptomReport(
        user_id=current_user.id,
        title=title,
        status="draft"
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return {"id": report.id, "title": report.title, "status": report.status} 