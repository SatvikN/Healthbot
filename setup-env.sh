#!/bin/bash

# HealthBot Project Environment Setup Script
echo "🏥 HealthBot Project Environment Setup"
echo "======================================"

# Check if virtual environment exists
if [ ! -d "healthbot-backend-env" ]; then
    echo "❌ Virtual environment not found. Creating one..."
    python3 -m venv healthbot-backend-env
    echo "✅ Virtual environment created!"
fi

# Activate virtual environment
echo "🐍 Activating Python virtual environment..."
source healthbot-backend-env/bin/activate

# Check if requirements are installed
if [ ! -f "healthbot-backend-env/pyvenv.cfg" ]; then
    echo "📦 Installing Python dependencies..."
    pip install --upgrade pip
    pip install -r requirements.txt
fi

echo ""
echo "🎉 Environment Setup Complete!"
echo ""
echo "📋 Usage Instructions:"
echo "======================"
echo ""
echo "🐍 Backend (Python):"
echo "   • Activate: source healthbot-backend-env/bin/activate"
echo "   • Run API:  cd backend && python -m uvicorn app.main:app --reload"
echo "   • Deactivate: deactivate"
echo ""
echo "⚛️  Frontend (React):"
echo "   • Install deps: npm install (already done)"
echo "   • Run dev:      npm start"
echo "   • Build:        npm run build"
echo ""
echo "🐳 Full Stack:"
echo "   • Run all:      docker-compose up"
echo ""
echo "📁 Project Structure:"
echo "   • backend/         - FastAPI Python backend"
echo "   • src/            - React TypeScript frontend"
echo "   • healthbot-backend-env/ - Python virtual environment"
echo "   • node_modules/   - Node.js dependencies"
echo ""
echo "🔧 Current Environment Status:"
echo "   • Python: $(python --version)"
echo "   • Pip: $(pip --version)"
echo "   • Virtual Env: $VIRTUAL_ENV" 