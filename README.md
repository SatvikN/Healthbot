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

### Prerequisites
- Python 3.11+
- Node.js 18+
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/SatvikN/healthbot.git
cd healthbot
```

### 2. Backend Setup

**Important**: Run all backend commands from the project root directory.

```bash
# Create and activate virtual environment
python -m venv healthbot-backend-env
source healthbot-backend-env/bin/activate  # On Windows: healthbot-backend-env\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI server (from project root)
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --log-level info

# For auto-reload during development
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
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

### 4. Demo Account
The application automatically creates a demo account:
- **Email**: demo@healthbot.com
- **Password**: demo123

## 🔧 Development

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
# No manual setup required
```

### Common Commands
```bash
# Clean restart (remove database and restart backend)
pkill -f uvicorn && rm -f healthbot.db && python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000

# Kill backend process
pkill -f uvicorn
```

## 📊 API Endpoints

### Authentication
- `POST /api/auth/token` - Login and get access token
- `POST /api/auth/register` - Register new user
- `GET /api/auth/me` - Get current user info
- `PUT /api/auth/profile` - Update user profile

### Chat & Conversations
- `POST /api/chat/start` - Start new conversation
- `POST /api/chat/send-message` - Send message in conversation
- `GET /api/chat/conversations` - Get user's conversations
- `GET /api/chat/conversation/{id}` - Get conversation details
- `DELETE /api/chat/conversation/{id}` - Delete conversation
- `PUT /api/chat/conversation/{id}/title` - Update conversation title
- `POST /api/chat/conversation/{id}/diagnosis` - Generate diagnosis
- `POST /api/chat/conversation/{id}/medical-report` - Generate medical report
- `GET /api/chat/conversation/{id}/medical-report/download` - Download PDF report

### Reports & Health Data
- `GET /api/reports/list` - Get user's medical reports
- `DELETE /api/reports/{id}` - Delete medical report
- `POST /api/reports/generate-summary` - Generate health summary
- `GET /api/symptoms/list` - Get symptom data

For complete API documentation, visit http://localhost:8000/api/docs when the server is running.

## 🆕 New Features Implemented

### Conversation Management
- **Delete Conversations**: Three-dot menu (⋮) next to each conversation with delete confirmation
- **Automatic Cleanup**: Active conversation state cleared when deleted

### Medical Reports
- **PDF Downloads**: Professional medical reports downloaded as PDF files
- **In-Chat Notifications**: Success messages displayed in chat when reports are generated
- **Report Deletion**: Delete reports with comprehensive confirmation dialogs
- **Detailed Information**: Report cards show patient info, date, and medical details

### AI Enhancements
- **Automatic Diagnosis**: AI generates diagnosis predictions after 3+ message exchanges
- **Enhanced Error Handling**: Defensive programming prevents crashes from malformed data
- **Fallback Mechanisms**: Graceful degradation when AI services are unavailable

## 🐛 Troubleshooting

### Common Issues

#### Backend won't start
```bash
# Check if port is in use
lsof -i :8000

# Kill existing processes
pkill -f uvicorn

# Start fresh
rm -f healthbot.db && python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

#### Frontend can't connect to backend
- Ensure backend is running on http://localhost:8000
- Check browser console for CORS errors
- Verify API endpoints in browser developer tools

#### Database errors
```bash
# Reset database completely
rm -f healthbot.db
# Database will be recreated on next backend startup
```

#### bcrypt warnings
The `(trapped) error reading bcrypt version` warning is non-critical and doesn't affect functionality.

## 📋 Project Structure

```
healthbot/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI application entry point
│   │   ├── config.py            # Configuration settings
│   │   ├── database.py          # Database setup and models
│   │   ├── models/              # SQLAlchemy models
│   │   ├── routers/             # API route handlers
│   │   └── services/            # Business logic services
│   └── requirements.txt         # Python dependencies
├── src/
│   ├── components/              # React components
│   ├── pages/                   # Application pages
│   ├── services/                # API service functions
│   └── contexts/                # React context providers
├── public/                      # Static assets
├── package.json                 # Node.js dependencies
└── README.md                    # This file
```

---

**⚠️ Medical Disclaimer**: This application is designed for educational and assistance purposes and should not be used as a substitute for professional medical advice, diagnosis, or treatment. Always consult with qualified healthcare providers for medical decisions. 