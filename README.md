# HealthBot Medical Diagnosis Assistant

A comprehensive AI-powered medical diagnosis assistant that helps users collect symptoms, analyze health data, and generate structured medical reports. This application combines conversational AI with medical knowledge to provide intelligent health insights.

## 🏥 Features

### Core Functionality
- **Conversational Symptom Collection**: Interactive chat interface for natural symptom reporting
- **AI-Powered Analysis**: Leverages Large Language Models for intelligent symptom analysis
- **Automatic Diagnosis Predictions**: AI generates diagnosis predictions after sufficient conversation context
- **Medical Report Generation**: Automated creation of structured medical reports with PDF download
- **Chat Notifications**: In-chat confirmations when medical reports are generated
- **Conversation Management**: Delete conversations from history with confirmation dialogs
- **Report Management**: View, download, and delete medical reports with comprehensive details
- **Real-time Dashboard**: Health overview with conversation and report tracking
- **Symptom Tracking**: Detailed recording and categorization of patient symptoms

### Technical Features
- **Secure Authentication**: JWT-based user authentication and authorization
- **RESTful API**: Well-documented FastAPI backend with OpenAPI/Swagger docs
- **Database Integration**: SQLite for development with comprehensive error handling
- **PDF Generation**: Professional medical reports using ReportLab library
- **Responsive Design**: Modern React UI with Material-UI components

## 🛠 Technology Stack

### Backend
- **FastAPI**: High-performance Python web framework
- **SQLAlchemy**: SQL toolkit and Object-Relational Mapping
- **Pydantic**: Data validation using Python type annotations
- **Custom LLM Service**: Integrated AI service for medical analysis
- **ReportLab**: PDF generation for medical reports
- **SQLite**: Database for development and production
- **Passlib & Bcrypt**: Secure password hashing
- **Python-Jose**: JWT token handling

### Frontend
- **React 18**: Modern React with hooks and functional components
- **TypeScript**: Type-safe JavaScript development
- **Material-UI (MUI)**: Professional React component library
- **React Router**: Client-side routing and navigation
- **Axios**: HTTP client for API communications
- **React Query**: Server state management and caching

### Development & Deployment
- **Git**: Version control with comprehensive commit history
- **Python Virtual Environments**: Isolated dependency management

## 🚀 Quick Start

This project is fully containerized using Docker, which is the recommended way to run the application.

### Prerequisites
- Docker and Docker Compose (latest versions recommended)
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/SatvikN/healthbot.git
cd healthbot
```

### 2. Docker-Based Setup (Recommended)

This single command will build the container images, download dependencies, and start all the services (Frontend, Backend, Postgres, Redis, and Ollama).

```bash
# From the project root directory
docker-compose up --build
```

- The `--build` flag is only necessary the first time you run it or after making changes to the `Dockerfile`s or application dependencies.
- To run in the background, use `docker-compose up -d`.

Once the containers are running, the application will be available at:
- **Frontend**: http://localhost:3000
- **Backend API Docs**: http://localhost:8000/api/docs
- **Ollama LLM Service**: http://localhost:11434

To stop the application:
```bash
docker-compose down
```

### 3. Manual Local Setup (Without Docker)

If you prefer to run the services manually without Docker, follow these steps.

**Backend Setup**
```bash
# Navigate to the backend directory
cd backend

# Create and activate virtual environment
python -m venv ../healthbot-backend-env
source ../healthbot-backend-env/bin/activate

# Install dependencies from the root directory's requirements.txt
pip install -r ../requirements.txt

# Start the FastAPI server (from project root)
cd ..
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Frontend Setup**
```bash
# Install dependencies
npm install

# Start the development server
npm start
```

### 4. Demo Account
The application automatically creates a demo account on startup:
- **Email**: `demo@healthbot.com`
- **Password**: `demo123`

## 🔧 Development

### Docker Development
For development, you can run the services in detached mode and view logs for a specific service.

```bash
# Start all services in the background
docker-compose up -d

# View logs for the backend
docker-compose logs -f backend

# View logs for the frontend
docker-compose logs -f frontend
```

### Stopping All Services
```bash
docker-compose down
```

### Backend Development
```bash
# Activate virtual environment
source healthbot-backend-env/bin/activate

# Run with auto-reload (from project root)
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload

# Check API health
curl http://localhost:8000/api/health/
```

### Frontend Development
```bash
# Start development server
npm start

# Build for production
npm run build
```

### Database Management
```bash
# Reset database (development only)
rm -f healthbot.db

# Database tables are created automatically on startup
```

### Common Commands
```bash
# Clean restart (remove database and restart backend)
pkill -f uvicorn && rm -f healthbot.db && python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000

# Kill backend process
pkill -f uvicorn
```

### RPI Documentation
For complete API documentation, visit http://localhost:8000/api/docs when the server is running.

---

**⚠️ Medical Disclaimer**: This application is designed for educational and assistance purposes and should not be used as a substitute for professional medical advice, diagnosis, or treatment. Always consult with qualified healthcare providers for medical decisions. 