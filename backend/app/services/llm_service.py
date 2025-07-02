import httpx
import json
import asyncio
from typing import Dict, List, Optional, Any
from datetime import datetime
import logging
from ..config import settings

logger = logging.getLogger(__name__)


class LLMService:
    """Service for interacting with Ollama and Llama models."""
    
    def __init__(self):
        self.base_url = settings.ollama_base_url
        self.model = settings.ollama_model
        self.client = httpx.AsyncClient(timeout=30.0)
        
    async def __aenter__(self):
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()
    
    async def is_model_available(self) -> bool:
        """Check if the specified model is available in Ollama."""
        try:
            response = await self.client.get(f"{self.base_url}/api/tags")
            if response.status_code == 200:
                models = response.json().get("models", [])
                return any(model["name"] == self.model for model in models)
            return False
        except Exception as e:
            logger.error(f"Error checking model availability: {e}")
            return False
    
    async def pull_model(self) -> bool:
        """Pull the model if it's not available locally."""
        try:
            response = await self.client.post(
                f"{self.base_url}/api/pull",
                json={"name": self.model},
                timeout=300.0  # Model pulling can take a while
            )
            return response.status_code == 200
        except Exception as e:
            logger.error(f"Error pulling model: {e}")
            return False
    
    async def generate_response(
        self, 
        prompt: str, 
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None
    ) -> Dict[str, Any]:
        """Generate a response from the LLM."""
        try:
            # Check if model is available
            if not await self.is_model_available():
                logger.info(f"Model {self.model} not found locally. Attempting to pull...")
                if not await self.pull_model():
                    raise Exception(f"Failed to pull model {self.model}")
            
            # Prepare the request
            request_data = {
                "model": self.model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": temperature
                }
            }
            
            if system_prompt:
                request_data["system"] = system_prompt
                
            if max_tokens:
                request_data["options"]["num_predict"] = max_tokens
            
            start_time = datetime.now()
            
            response = await self.client.post(
                f"{self.base_url}/api/generate",
                json=request_data
            )
            
            end_time = datetime.now()
            processing_time = int((end_time - start_time).total_seconds() * 1000)
            
            if response.status_code == 200:
                result = response.json()
                return {
                    "success": True,
                    "response": result.get("response", ""),
                    "model": self.model,
                    "processing_time": processing_time,
                    "total_duration": result.get("total_duration", 0),
                    "eval_count": result.get("eval_count", 0),
                    "eval_duration": result.get("eval_duration", 0)
                }
            else:
                logger.error(f"LLM request failed with status {response.status_code}: {response.text}")
                return {
                    "success": False,
                    "error": f"HTTP {response.status_code}: {response.text}",
                    "processing_time": processing_time
                }
                
        except Exception as e:
            logger.error(f"Error generating LLM response: {e}")
            return {
                "success": False,
                "error": str(e),
                "processing_time": 0
            }
    
    async def categorize_symptom(self, symptom_name: str, symptom_description: Optional[str] = None) -> Dict[str, Any]:
        """Categorize a symptom into medical categories."""
        
        system_prompt = """You are a medical classification system. Categorize symptoms into one of these specific categories:

Categories:
- pain
- respiratory 
- gastrointestinal
- neurological
- cardiovascular
- skin
- constitutional
- genitourinary
- musculoskeletal
- other

Respond with ONLY the category name (lowercase). No explanation needed."""

        symptom_text = f"Symptom: {symptom_name}"
        if symptom_description:
            symptom_text += f"\nDescription: {symptom_description}"

        result = await self.generate_response(symptom_text, system_prompt, temperature=0.1)
        
        if result.get("success"):
            category = result.get("response", "").strip().lower()
            return {
                "success": True,
                "response": {"category": category}
            }
        return result
    
    async def analyze_symptoms(self, symptom_data: List[Dict], additional_context: Optional[str] = None) -> Dict[str, Any]:
        """Analyze a list of symptoms and provide comprehensive medical insights."""
        
        system_prompt = """You are a medical analysis AI assistant. Analyze the provided symptoms and return a structured JSON response.

IMPORTANT: 
- You are NOT diagnosing - only providing analysis for healthcare providers
- Always recommend professional medical evaluation
- Be thorough but appropriately cautious

Return your response as valid JSON with this structure:
{
  "analysis": "Detailed analysis of the symptom pattern",
  "urgency_level": "low|moderate|high|critical",
  "recommendations": ["recommendation1", "recommendation2"],
  "medical_specialties": ["specialty1", "specialty2"],
  "potential_conditions": ["condition1", "condition2"],
  "red_flags": ["flag1", "flag2"] or []
}"""

        # Format symptom data
        symptoms_text = "SYMPTOMS ANALYSIS REQUEST:\n\n"
        for i, symptom in enumerate(symptom_data, 1):
            symptoms_text += f"Symptom {i}:\n"
            symptoms_text += f"  Name: {symptom.get('name', 'Unknown')}\n"
            symptoms_text += f"  Severity: {symptom.get('severity', 'Unknown')}/10\n"
            symptoms_text += f"  Category: {symptom.get('category', 'Unknown')}\n"
            symptoms_text += f"  Location: {symptom.get('location', 'Not specified')}\n"
            symptoms_text += f"  Onset: {symptom.get('onset_date', 'Unknown')}\n"
            symptoms_text += f"  Duration: {symptom.get('duration_hours', 'Unknown')} hours\n"
            
            if symptom.get('description'):
                symptoms_text += f"  Description: {symptom['description']}\n"
            if symptom.get('triggers'):
                symptoms_text += f"  Triggers: {', '.join(symptom['triggers'])}\n"
            if symptom.get('alleviating_factors'):
                symptoms_text += f"  Relieving factors: {', '.join(symptom['alleviating_factors'])}\n"
            if symptom.get('associated_symptoms'):
                symptoms_text += f"  Associated symptoms: {', '.join(symptom['associated_symptoms'])}\n"
            symptoms_text += "\n"

        if additional_context:
            symptoms_text += f"Additional Context: {additional_context}\n\n"

        symptoms_text += "Please analyze these symptoms and provide structured insights in JSON format."

        result = await self.generate_response(symptoms_text, system_prompt, temperature=0.3)
        
        if result.get("success"):
            try:
                # Try to parse JSON response
                response_text = result.get("response", "")
                # Extract JSON from response if it's wrapped in other text
                json_start = response_text.find('{')
                json_end = response_text.rfind('}') + 1
                if json_start >= 0 and json_end > json_start:
                    json_str = response_text[json_start:json_end]
                    analysis_data = json.loads(json_str)
                    return {
                        "success": True,
                        "response": analysis_data
                    }
                else:
                    # Fallback if JSON parsing fails
                    return {
                        "success": True,
                        "response": {
                            "analysis": response_text,
                            "urgency_level": "moderate",
                            "recommendations": ["Consult with a healthcare provider for proper evaluation"],
                            "medical_specialties": ["General Practice"],
                            "potential_conditions": [],
                            "red_flags": []
                        }
                    }
            except json.JSONDecodeError:
                # Fallback for malformed JSON
                return {
                    "success": True,
                    "response": {
                        "analysis": result.get("response", "Analysis completed"),
                        "urgency_level": "moderate", 
                        "recommendations": ["Consult with a healthcare provider for proper evaluation"],
                        "medical_specialties": ["General Practice"],
                        "potential_conditions": [],
                        "red_flags": []
                    }
                }
        return result

    async def generate_medical_report(self, report_data: Dict[str, Any], report_type: str) -> Dict[str, Any]:
        """Generate a comprehensive medical report based on patient data."""
        
        system_prompt = f"""You are a medical report generation system creating a {report_type} report.

Generate a structured medical report with appropriate sections. Return as JSON:
{{
  "analysis": "Comprehensive medical analysis",
  "urgency_level": "low|moderate|high|critical", 
  "recommendations": ["recommendation1", "recommendation2"],
  "medical_specialties": ["specialty1", "specialty2"],
  "summary": "Executive summary for healthcare providers",
  "next_steps": ["step1", "step2"]
}}

Focus on:
- Professional medical language
- Objective symptom documentation
- Appropriate urgency assessment
- Clear recommendations for healthcare providers
- Specialist referral suggestions if needed"""

        # Format report data
        report_text = f"MEDICAL REPORT GENERATION - {report_type.upper()}\n\n"
        
        # Patient information
        if report_data.get("patient_info"):
            patient = report_data["patient_info"]
            report_text += "PATIENT INFORMATION:\n"
            report_text += f"Name: {patient.get('name', 'Unknown')}\n"
            report_text += f"Email: {patient.get('email', 'Unknown')}\n"
            if patient.get('date_of_birth'):
                report_text += f"Date of Birth: {patient['date_of_birth']}\n"
            if patient.get('medical_history'):
                report_text += f"Medical History: {patient['medical_history']}\n"
            report_text += "\n"

        # Conversation context
        if report_data.get("conversation"):
            conv = report_data["conversation"]
            report_text += "CONSULTATION CONTEXT:\n"
            report_text += f"Chief Complaint: {conv.get('chief_complaint', 'Not specified')}\n"
            report_text += f"Consultation Date: {conv.get('started_at', 'Unknown')}\n"
            report_text += "\n"

        # Symptoms
        if report_data.get("symptoms"):
            report_text += "SYMPTOM DOCUMENTATION:\n"
            for i, symptom in enumerate(report_data["symptoms"], 1):
                report_text += f"{i}. {symptom.get('name', 'Unknown symptom')}\n"
                report_text += f"   Severity: {symptom.get('severity', 'Unknown')}/10\n"
                report_text += f"   Category: {symptom.get('category', 'Unknown')}\n"
                report_text += f"   Location: {symptom.get('location', 'Not specified')}\n"
                report_text += f"   Onset: {symptom.get('onset_date', 'Unknown')}\n"
                if symptom.get('description'):
                    report_text += f"   Description: {symptom['description']}\n"
                report_text += "\n"

        # Previous AI analysis
        if report_data.get("ai_analysis"):
            report_text += f"PREVIOUS ANALYSIS:\n{report_data['ai_analysis']}\n\n"

        report_text += f"Please generate a comprehensive {report_type} report in JSON format."

        result = await self.generate_response(report_text, system_prompt, temperature=0.2)
        
        if result.get("success"):
            try:
                response_text = result.get("response", "")
                # Extract JSON from response
                json_start = response_text.find('{')
                json_end = response_text.rfind('}') + 1
                if json_start >= 0 and json_end > json_start:
                    json_str = response_text[json_start:json_end]
                    report_analysis = json.loads(json_str)
                    return {
                        "success": True,
                        "response": report_analysis
                    }
                else:
                    # Fallback
                    return {
                        "success": True,
                        "response": {
                            "analysis": response_text,
                            "urgency_level": "moderate",
                            "recommendations": ["Professional medical evaluation recommended"],
                            "medical_specialties": ["General Practice"],
                            "summary": f"{report_type} report generated",
                            "next_steps": ["Schedule healthcare provider consultation"]
                        }
                    }
            except json.JSONDecodeError:
                return {
                    "success": True,
                    "response": {
                        "analysis": result.get("response", "Report generated"),
                        "urgency_level": "moderate",
                        "recommendations": ["Professional medical evaluation recommended"],
                        "medical_specialties": ["General Practice"],
                        "summary": f"{report_type} report completed",
                        "next_steps": ["Schedule healthcare provider consultation"]
                    }
                }
        return result

    async def analyze_symptoms_text(self, symptoms_text: str, patient_context: Dict = None) -> Dict[str, Any]:
        """Analyze symptoms from text and provide medical insights."""
        
        system_prompt = """You are a medical assistant AI designed to help analyze symptoms and provide preliminary insights. 

IMPORTANT DISCLAIMERS:
- You are NOT a doctor and cannot provide official medical diagnoses
- Your analysis is for informational purposes only
- Always recommend consulting with healthcare professionals
- For serious or emergency symptoms, always recommend immediate medical attention

Your role is to:
1. Analyze described symptoms objectively
2. Suggest possible common conditions that might cause these symptoms
3. Recommend appropriate next steps for care
4. Ask clarifying questions if needed
5. Provide helpful self-care suggestions for minor issues

Please be thorough but cautious, and always prioritize patient safety."""

        user_prompt = f"""Please analyze the following symptoms:

Symptoms: {symptoms_text}

Patient Context: {json.dumps(patient_context or {}, indent=2)}

Please provide:
1. A summary of the reported symptoms
2. Possible common conditions that could cause these symptoms (with confidence levels)
3. Questions that would help clarify the diagnosis
4. Recommended next steps
5. Any red flag symptoms that would require immediate medical attention
6. General self-care suggestions if appropriate

Format your response as a structured analysis."""

        return await self.generate_response(user_prompt, system_prompt, temperature=0.3)
    
    async def generate_followup_questions(self, conversation_history: List[Dict]) -> Dict[str, Any]:
        """Generate relevant follow-up questions based on conversation history."""
        
        system_prompt = """You are a medical assistant that helps gather comprehensive symptom information. 
Based on the conversation history, generate 2-3 specific, relevant follow-up questions that would help 
clarify the patient's condition. Focus on:

- Symptom duration, severity, and progression
- Associated symptoms
- Aggravating or alleviating factors
- Impact on daily activities
- Previous treatments tried

Keep questions clear, specific, and medically relevant."""

        # Format conversation history
        conversation_text = "\n".join([
            f"{msg.get('type', 'user')}: {msg.get('content', '')}" 
            for msg in conversation_history[-10:]  # Last 10 messages
        ])

        user_prompt = f"""Based on this conversation history, what follow-up questions should I ask?

Conversation:
{conversation_text}

Please suggest 2-3 specific follow-up questions that would help gather important medical information."""

        return await self.generate_response(user_prompt, system_prompt, temperature=0.5)
    
    async def generate_chat_response(self, user_message: str, conversation_history: List[Dict]) -> Dict[str, Any]:
        """Generate a conversational response to continue the medical consultation."""
        
        system_prompt = """You are a compassionate medical assistant chatbot helping patients describe their symptoms. 

Your approach should be:
- Empathetic and reassuring
- Professional but approachable
- Focused on gathering relevant medical information
- Always emphasize that you're not replacing professional medical care

Guidelines:
- Ask one main question at a time
- Show understanding of patient concerns
- Gather specific details about symptoms
- Recognize when immediate medical care might be needed
- Provide appropriate disclaimers about your limitations"""

        # Format recent conversation
        recent_messages = conversation_history[-6:] if conversation_history else []
        context = "\n".join([
            f"{msg.get('type', 'user')}: {msg.get('content', '')}" 
            for msg in recent_messages
        ])

        user_prompt = f"""Recent conversation:
{context}

New user message: {user_message}

Please respond appropriately to continue gathering symptom information or provide helpful guidance."""

        return await self.generate_response(user_prompt, system_prompt, temperature=0.7)


# Global LLM service instance
llm_service = LLMService() 