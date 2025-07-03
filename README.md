# HealthBot Medical Diagnosis Assistant

![HealthBot Logo](https://img.shields.io/badge/HealthBot-Medical%20AI-blue?style=for-the-badge&logo=medical-cross)

A comprehensive AI-powered medical diagnosis assistant designed to help healthcare professionals collect symptoms, analyze patient data, and generate structured medical reports. This application combines conversational AI with medical knowledge to streamline the diagnostic process.

## 🏥 Features

### Core Functionality
- **Conversational Symptom Collection**: Interactive chat interface for natural symptom reporting
- **AI-Powered Analysis**: Leverages Large Language Models for intelligent symptom analysis
- **Medical Report Generation**: Automated creation of structured medical reports
- **Real-time Dashboard**: Comprehensive health overview with activity tracking
- **Symptom Tracking**: Detailed recording and categorization of patient symptoms
- **Healthcare Provider Integration**: Secure sharing of reports with medical professionals

### Technical Features
- **Secure Authentication**: JWT-based user authentication and authorization
- **RESTful API**: Well-documented FastAPI backend with OpenAPI/Swagger docs
- **Real-time Updates**: WebSocket support for live chat functionality
- **Database Integration**: SQLite for development, PostgreSQL-ready for production
- **Error Handling**: Comprehensive error handling with graceful fallbacks
- **Responsive Design**: Modern React UI with Material-UI components

## 🛠 Technology Stack

### Backend
- **FastAPI**: High-performance Python web framework
- **SQLAlchemy**: SQL toolkit and Object-Relational Mapping
- **Pydantic**: Data validation using Python type annotations
- **Ollama**: Local LLM integration for AI-powered responses
- **Redis**: Caching and session management
- **SQLite/PostgreSQL**: Database options for different environments

### Frontend
- **React 18**: Modern React with hooks and functional components
- **TypeScript**: Type-safe JavaScript development
- **Material-UI (MUI)**: Professional React component library
- **React Router**: Client-side routing and navigation
- **Axios**: HTTP client for API communications
- **React Hook Form**: Form handling and validation

### Development & Deployment
- **Docker**: Containerization for consistent development environments
- **Docker Compose**: Multi-service application orchestration
- **Git**: Version control with comprehensive commit history
- **ESLint**: Code quality and style enforcement

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker & Docker Compose (optional)
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/SatvikN/healthbot.git
cd healthbot
```

### 2. Backend Setup

#### Option A: Using Virtual Environment
```bash
# Create and activate virtual environment
python -m venv healthbot-backend-env
source healthbot-backend-env/bin/activate  # On Windows: healthbot-backend-env\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Navigate to backend directory
cd backend

# Start the FastAPI server
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

#### Option B: Using Docker
```bash
# Build and start all services
docker-compose up --build

# Or start in detached mode
docker-compose up -d
```

### 3. Frontend Setup
```bash
# Install dependencies
npm install

# Start the development server
npm start
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/api/docs

## 🔧 Development

### Backend Development
```bash
# Activate virtual environment
source healthbot-backend-env/bin/activate

# Run with auto-reload
cd backend
python -m uvicorn app.main:app --reload

# Run tests
pytest

# Check code quality
flake8 app/
black app/
```

### Frontend Development
```bash
# Start development server
npm start

# Run tests
npm test

# Lint code
npm run lint
npm run lint:fix

# Build for production
npm run build
```

### Database Management
```bash
# Create database tables (automatic on startup)
python -c "from app.database import engine, Base; Base.metadata.create_all(bind=engine)"

# Reset database (development only)
rm healthbot.db  # SQLite database file
```

## 📊 API Documentation
For complete API documentation, visit http://localhost:8000/api/docs when the server is running.

## 🐳 Docker Deployment

### Development Environment
```bash
# Start all services
docker-compose up

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production Environment
```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy to production
docker-compose -f docker-compose.prod.yml up -d
```

## 🧪 Testing

### Backend Tests
```bash
# Run all tests
cd backend
pytest

# Run with coverage
pytest --cov=app tests/

# Run specific test file
pytest tests/test_auth.py
```

### Frontend Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Generate coverage report
npm test -- --coverage
```

---

**⚠️ Medical Disclaimer**: This application is designed to assist healthcare professionals and should not be used as a substitute for professional medical advice, diagnosis, or treatment. Always consult with qualified healthcare providers for medical decisions. 