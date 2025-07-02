from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from ..database import get_db
from ..models.user import User
from ..models.symptom import Symptom, SymptomReport, SymptomEntry
from ..routers.auth import get_current_user

router = APIRouter()


@router.get("/test")
async def test_symptoms():
    """Test endpoint for symptoms."""
    return {"message": "Symptoms router is working"}





@router.get("/list")
async def get_symptoms(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all symptoms."""
    symptoms = db.query(Symptom).all()
    return [{"id": s.id, "name": s.name, "description": s.description} for s in symptoms[:10]]


@router.get("/reports")
async def get_reports(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user's symptom reports."""
    reports = db.query(SymptomReport).filter(SymptomReport.user_id == current_user.id).all()
    return [{"id": r.id, "title": r.title, "status": r.status} for r in reports[:10]] 