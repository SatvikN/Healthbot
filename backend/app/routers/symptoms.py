from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
import json

from ..database import get_db
from ..models.user import User
from ..models.symptom import SymptomRecord, SymptomCategory, SeverityLevel
from ..models.conversation import Conversation
from ..routers.auth import get_current_user
from ..services.llm_service import llm_service

router = APIRouter()


# Pydantic models for request/response
class SymptomRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=1000)
    severity: int = Field(..., ge=1, le=10)
    location: Optional[str] = Field(None, max_length=100)
    duration_hours: Optional[int] = Field(None, ge=0)
    triggers: Optional[List[str]] = Field(default_factory=list)
    alleviating_factors: Optional[List[str]] = Field(default_factory=list)
    associated_symptoms: Optional[List[str]] = Field(default_factory=list)
    conversation_id: Optional[int] = None


class SymptomResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    severity: int
    location: Optional[str]
    category: str
    duration_hours: Optional[int]
    onset_date: datetime
    recorded_at: datetime
    triggers: List[str]
    alleviating_factors: List[str]
    associated_symptoms: List[str]


class SymptomAnalysisRequest(BaseModel):
    symptom_ids: List[int]
    additional_context: Optional[str] = None


class SymptomPatternResponse(BaseModel):
    pattern_id: str
    symptoms: List[SymptomResponse]
    analysis: str
    urgency_level: str
    recommendations: List[str]
    medical_specialties: List[str]


@router.post("/record", response_model=SymptomResponse)
async def record_symptom(
    request: SymptomRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Record a new symptom for the user."""
    
    try:
        # Categorize symptom using AI if possible
        category = await _categorize_symptom(request.name, request.description)
        
        # Determine severity level
        severity_level = _get_severity_level(request.severity)
        
        # Calculate onset date based on duration
        onset_date = datetime.utcnow()
        if request.duration_hours:
            onset_date = datetime.utcnow() - timedelta(hours=request.duration_hours)
        
        # Create symptom record
        symptom = SymptomRecord(
            user_id=current_user.id,
            conversation_id=request.conversation_id,
            name=request.name,
            description=request.description,
            severity=request.severity,
            severity_level=severity_level,
            location=request.location,
            category=category,
            onset_date=onset_date,
            duration_hours=request.duration_hours,
            triggers=request.triggers,
            alleviating_factors=request.alleviating_factors,
            associated_symptoms=request.associated_symptoms
        )
        
        db.add(symptom)
        db.commit()
        db.refresh(symptom)
        
        return SymptomResponse(
            id=symptom.id,
            name=symptom.name,
            description=symptom.description,
            severity=symptom.severity,
            location=symptom.location,
            category=symptom.category.value,
            duration_hours=symptom.duration_hours,
            onset_date=symptom.onset_date,
            recorded_at=symptom.recorded_at,
            triggers=symptom.triggers or [],
            alleviating_factors=symptom.alleviating_factors or [],
            associated_symptoms=symptom.associated_symptoms or []
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record symptom: {str(e)}"
        )


@router.get("/list", response_model=List[SymptomResponse])
async def get_user_symptoms(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    days_back: int = 30,
    category: Optional[str] = None,
    min_severity: Optional[int] = None,
    limit: int = 50,
    offset: int = 0
):
    """Get user's recorded symptoms with filtering options."""
    
    # Build query with filters
    query = db.query(SymptomRecord).filter(
        SymptomRecord.user_id == current_user.id,
        SymptomRecord.recorded_at >= datetime.utcnow() - timedelta(days=days_back)
    )
    
    if category:
        try:
            category_enum = SymptomCategory(category)
            query = query.filter(SymptomRecord.category == category_enum)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid category: {category}"
            )
    
    if min_severity:
        query = query.filter(SymptomRecord.severity >= min_severity)
    
    symptoms = query.order_by(
        SymptomRecord.recorded_at.desc()
    ).offset(offset).limit(limit).all()
    
    return [
        SymptomResponse(
            id=s.id,
            name=s.name,
            description=s.description,
            severity=s.severity,
            location=s.location,
            category=s.category.value,
            duration_hours=s.duration_hours,
            onset_date=s.onset_date,
            recorded_at=s.recorded_at,
            triggers=s.triggers or [],
            alleviating_factors=s.alleviating_factors or [],
            associated_symptoms=s.associated_symptoms or []
        )
        for s in symptoms
    ]


@router.get("/categories", response_model=List[str])
async def get_symptom_categories():
    """Get all available symptom categories."""
    return [category.value for category in SymptomCategory]


@router.post("/analyze", response_model=SymptomPatternResponse)
async def analyze_symptom_pattern(
    request: SymptomAnalysisRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Analyze a pattern of symptoms and provide medical insights."""
    
    if not request.symptom_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one symptom ID is required"
        )
    
    # Verify all symptoms belong to the user
    symptoms = db.query(SymptomRecord).filter(
        SymptomRecord.id.in_(request.symptom_ids),
        SymptomRecord.user_id == current_user.id
    ).all()
    
    if len(symptoms) != len(request.symptom_ids):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or more symptoms not found"
        )
    
    try:
        # Prepare symptom data for AI analysis
        symptom_data = []
        for symptom in symptoms:
            symptom_data.append({
                "name": symptom.name,
                "description": symptom.description,
                "severity": symptom.severity,
                "location": symptom.location,
                "category": symptom.category.value,
                "onset_date": symptom.onset_date.isoformat(),
                "duration_hours": symptom.duration_hours,
                "triggers": symptom.triggers,
                "alleviating_factors": symptom.alleviating_factors,
                "associated_symptoms": symptom.associated_symptoms
            })
        
        # Generate AI analysis
        async with llm_service:
            analysis_result = await llm_service.analyze_symptoms(
                symptom_data, 
                request.additional_context
            )
        
        if analysis_result.get("success"):
            analysis_data = analysis_result.get("response", {})
            
            # Extract analysis components
            analysis_text = analysis_data.get("analysis", "Analysis not available")
            urgency_level = analysis_data.get("urgency_level", "low")
            recommendations = analysis_data.get("recommendations", [])
            medical_specialties = analysis_data.get("medical_specialties", [])
            
            # Generate pattern ID
            pattern_id = f"pattern_{current_user.id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}"
            
            return SymptomPatternResponse(
                pattern_id=pattern_id,
                symptoms=[
                    SymptomResponse(
                        id=s.id,
                        name=s.name,
                        description=s.description,
                        severity=s.severity,
                        location=s.location,
                        category=s.category.value,
                        duration_hours=s.duration_hours,
                        onset_date=s.onset_date,
                        recorded_at=s.recorded_at,
                        triggers=s.triggers or [],
                        alleviating_factors=s.alleviating_factors or [],
                        associated_symptoms=s.associated_symptoms or []
                    )
                    for s in symptoms
                ],
                analysis=analysis_text,
                urgency_level=urgency_level,
                recommendations=recommendations,
                medical_specialties=medical_specialties
            )
        else:
            # Fallback analysis
            high_severity_symptoms = [s for s in symptoms if s.severity >= 8]
            urgency = "high" if high_severity_symptoms else "moderate"
            
            return SymptomPatternResponse(
                pattern_id=f"fallback_{current_user.id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
                symptoms=[
                    SymptomResponse(
                        id=s.id,
                        name=s.name,
                        description=s.description,
                        severity=s.severity,
                        location=s.location,
                        category=s.category.value,
                        duration_hours=s.duration_hours,
                        onset_date=s.onset_date,
                        recorded_at=s.recorded_at,
                        triggers=s.triggers or [],
                        alleviating_factors=s.alleviating_factors or [],
                        associated_symptoms=s.associated_symptoms or []
                    )
                    for s in symptoms
                ],
                analysis="Symptom analysis is temporarily unavailable. Please consult with a healthcare provider.",
                urgency_level=urgency,
                recommendations=["Consult with a healthcare provider for proper evaluation"],
                medical_specialties=["General Practice"]
            )
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to analyze symptoms: {str(e)}"
        )


@router.put("/update/{symptom_id}", response_model=SymptomResponse)
async def update_symptom(
    symptom_id: int,
    request: SymptomRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update an existing symptom record."""
    
    symptom = db.query(SymptomRecord).filter(
        SymptomRecord.id == symptom_id,
        SymptomRecord.user_id == current_user.id
    ).first()
    
    if not symptom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Symptom not found"
        )
    
    try:
        # Update fields
        symptom.name = request.name
        symptom.description = request.description
        symptom.severity = request.severity
        symptom.severity_level = _get_severity_level(request.severity)
        symptom.location = request.location
        symptom.duration_hours = request.duration_hours
        symptom.triggers = request.triggers
        symptom.alleviating_factors = request.alleviating_factors
        symptom.associated_symptoms = request.associated_symptoms
        
        # Recalculate onset date if duration changed
        if request.duration_hours:
            symptom.onset_date = datetime.utcnow() - timedelta(hours=request.duration_hours)
        
        # Recategorize if name or description changed
        symptom.category = await _categorize_symptom(request.name, request.description)
        
        db.commit()
        db.refresh(symptom)
        
        return SymptomResponse(
            id=symptom.id,
            name=symptom.name,
            description=symptom.description,
            severity=symptom.severity,
            location=symptom.location,
            category=symptom.category.value,
            duration_hours=symptom.duration_hours,
            onset_date=symptom.onset_date,
            recorded_at=symptom.recorded_at,
            triggers=symptom.triggers or [],
            alleviating_factors=symptom.alleviating_factors or [],
            associated_symptoms=symptom.associated_symptoms or []
        )
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update symptom: {str(e)}"
        )


@router.delete("/delete/{symptom_id}")
async def delete_symptom(
    symptom_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a symptom record."""
    
    symptom = db.query(SymptomRecord).filter(
        SymptomRecord.id == symptom_id,
        SymptomRecord.user_id == current_user.id
    ).first()
    
    if not symptom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Symptom not found"
        )
    
    try:
        db.delete(symptom)
        db.commit()
        
        return {
            "status": "success",
            "message": "Symptom deleted successfully",
            "symptom_id": symptom_id
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete symptom: {str(e)}"
        )


@router.get("/stats", response_model=Dict[str, Any])
async def get_symptom_statistics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    days_back: int = 30
):
    """Get symptom statistics for the user."""
    
    start_date = datetime.utcnow() - timedelta(days=days_back)
    
    # Get all symptoms in timeframe
    symptoms = db.query(SymptomRecord).filter(
        SymptomRecord.user_id == current_user.id,
        SymptomRecord.recorded_at >= start_date
    ).all()
    
    if not symptoms:
        return {
            "total_symptoms": 0,
            "average_severity": 0,
            "most_common_category": None,
            "severity_distribution": {},
            "category_distribution": {},
            "trending_symptoms": []
        }
    
    # Calculate statistics
    total_symptoms = len(symptoms)
    average_severity = sum(s.severity for s in symptoms) / total_symptoms
    
    # Category distribution
    category_counts = {}
    for symptom in symptoms:
        category = symptom.category.value
        category_counts[category] = category_counts.get(category, 0) + 1
    
    most_common_category = max(category_counts, key=category_counts.get) if category_counts else None
    
    # Severity distribution
    severity_counts = {}
    for symptom in symptoms:
        severity_counts[symptom.severity] = severity_counts.get(symptom.severity, 0) + 1
    
    # Trending symptoms (most frequent)
    symptom_names = {}
    for symptom in symptoms:
        symptom_names[symptom.name] = symptom_names.get(symptom.name, 0) + 1
    
    trending_symptoms = sorted(symptom_names.items(), key=lambda x: x[1], reverse=True)[:5]
    
    return {
        "total_symptoms": total_symptoms,
        "average_severity": round(average_severity, 2),
        "most_common_category": most_common_category,
        "severity_distribution": severity_counts,
        "category_distribution": category_counts,
        "trending_symptoms": [{"name": name, "count": count} for name, count in trending_symptoms]
    }


# Helper functions
async def _categorize_symptom(name: str, description: Optional[str]) -> SymptomCategory:
    """Categorize symptom using AI or fallback to heuristics."""
    
    try:
        async with llm_service:
            result = await llm_service.categorize_symptom(name, description)
        
        if result.get("success"):
            category_str = result.get("response", {}).get("category", "")
            try:
                return SymptomCategory(category_str)
            except ValueError:
                pass
    except:
        pass
    
    # Fallback categorization
    name_lower = name.lower()
    description_lower = (description or "").lower()
    combined_text = f"{name_lower} {description_lower}"
    
    if any(word in combined_text for word in ["pain", "ache", "hurt", "sore"]):
        return SymptomCategory.PAIN
    elif any(word in combined_text for word in ["nausea", "vomit", "stomach", "digestive"]):
        return SymptomCategory.GASTROINTESTINAL
    elif any(word in combined_text for word in ["cough", "breath", "chest", "lung"]):
        return SymptomCategory.RESPIRATORY
    elif any(word in combined_text for word in ["fever", "temperature", "chills"]):
        return SymptomCategory.CONSTITUTIONAL
    elif any(word in combined_text for word in ["rash", "skin", "itch"]):
        return SymptomCategory.SKIN
    elif any(word in combined_text for word in ["headache", "dizzy", "neurological"]):
        return SymptomCategory.NEUROLOGICAL
    else:
        return SymptomCategory.OTHER


def _get_severity_level(severity: int) -> SeverityLevel:
    """Convert numeric severity to severity level enum."""
    if severity <= 3:
        return SeverityLevel.MILD
    elif severity <= 6:
        return SeverityLevel.MODERATE
    elif severity <= 8:
        return SeverityLevel.SEVERE
    else:
        return SeverityLevel.CRITICAL 