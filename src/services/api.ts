import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Base API configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Type definitions
export interface User {
  id: number;
  email: string;
  full_name: string;
  date_of_birth?: string;
  phone?: string;
  address?: string;
  emergency_contact?: string;
  medical_history?: string;
  allergies?: string;
  current_medications?: string;
  blood_type?: string;
  height?: string;
  weight?: string;
  age?: number;
  gender?: string;
  is_verified?: boolean;
  created_at?: string;
  last_login?: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface RegisterData {
  email: string;
  password: string;
  full_name: string;
  date_of_birth?: string;
  medical_history?: string;
}

export interface Message {
  id: number;
  content: string;
  message_type: 'user' | 'assistant';
  created_at: string;
  metadata?: any;
}

export interface Conversation {
  id: number;
  title?: string;
  chief_complaint?: string;
  status: string;
  started_at: string;
  completed_at?: string;
  messages?: Message[];
}

export interface SymptomRecord {
  id: number;
  name: string;
  description?: string;
  severity: number;
  location?: string;
  category: string;
  duration_hours?: number;
  onset_date: string;
  recorded_at: string;
  triggers: string[];
  alleviating_factors: string[];
  associated_symptoms: string[];
}

export interface Report {
  id: number;
  title: string;
  report_type: string;
  status: string;
  generated_at: string;
  conversation_id?: number;
  symptom_count: number;
  urgency_level?: string;
  file_path?: string;
}

// API Services
export const authAPI = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);
    
    const response: AxiosResponse<LoginResponse> = await api.post('/api/auth/token', formData, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.data;
  },

  register: async (userData: RegisterData): Promise<User> => {
    const response: AxiosResponse<User> = await api.post('/api/auth/register', userData);
    return response.data;
  },

  getCurrentUser: async (): Promise<User> => {
    const response: AxiosResponse<User> = await api.get('/api/auth/me');
    return response.data;
  },

  updateProfile: async (profileData: any): Promise<User> => {
    const response: AxiosResponse<any> = await api.put('/api/auth/profile', profileData);
    return response.data.user;
  },
};

export const chatAPI = {
  startConversation: async (chiefComplaint: string): Promise<any> => {
    const response: AxiosResponse<any> = await api.post('/api/chat/start', {
      initial_message: chiefComplaint,
      chief_complaint: chiefComplaint,
    });
    return response.data;
  },

  sendMessage: async (conversationId: number, message: string): Promise<any> => {
    const response: AxiosResponse<any> = await api.post('/api/chat/send-message', {
      conversation_id: conversationId,
      content: message,
    });
    return response.data;
  },

  getConversations: async (): Promise<Conversation[]> => {
    const response: AxiosResponse<Conversation[]> = await api.get('/api/chat/conversations');
    return response.data;
  },

  getConversation: async (conversationId: number): Promise<Conversation> => {
    const response: AxiosResponse<Conversation> = await api.get(`/api/chat/conversation/${conversationId}`);
    return response.data;
  },

  completeConversation: async (conversationId: number): Promise<void> => {
    await api.put(`/api/chat/conversation/${conversationId}/complete`);
  },

  updateConversationTitle: async (conversationId: number, title: string): Promise<any> => {
    const response: AxiosResponse<any> = await api.put(`/api/chat/conversation/${conversationId}/title`, {
      title,
    });
    return response.data;
  },

  generateDiagnosisRecommendations: async (conversationId: number): Promise<any> => {
    const response: AxiosResponse<any> = await api.post(`/api/chat/conversation/${conversationId}/diagnosis`);
    return response.data;
  },

  generateMedicalReport: async (conversationId: number): Promise<any> => {
    const response: AxiosResponse<any> = await api.post(`/api/chat/conversation/${conversationId}/medical-report`);
    return response.data;
  },

  deleteConversation: async (conversationId: number): Promise<any> => {
    const response: AxiosResponse<any> = await api.delete(`/api/chat/conversation/${conversationId}`);
    return response.data;
  },

  downloadMedicalReportPDF: async (conversationId: number): Promise<Blob> => {
    const response: AxiosResponse<Blob> = await api.get(`/api/chat/conversation/${conversationId}/medical-report/download`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

export const symptomsAPI = {
  recordSymptom: async (symptomData: any): Promise<SymptomRecord> => {
    const response: AxiosResponse<SymptomRecord> = await api.post('/api/symptoms/record', symptomData);
    return response.data;
  },

  getSymptoms: async (params?: any): Promise<SymptomRecord[]> => {
    const response: AxiosResponse<SymptomRecord[]> = await api.get('/api/symptoms/list', { params });
    return response.data;
  },

  analyzeSymptoms: async (symptomIds: number[], additionalContext?: string): Promise<any> => {
    const response = await api.post('/api/symptoms/analyze', {
      symptom_ids: symptomIds,
      additional_context: additionalContext,
    });
    return response.data;
  },

  getCategories: async (): Promise<string[]> => {
    const response: AxiosResponse<string[]> = await api.get('/api/symptoms/categories');
    return response.data;
  },

  getStats: async (): Promise<any> => {
    const response = await api.get('/api/symptoms/stats');
    return response.data;
  },
};

export const reportsAPI = {
  generateReport: async (reportData: any): Promise<Report> => {
    const response: AxiosResponse<Report> = await api.post('/api/reports/generate', reportData);
    return response.data;
  },

  getReports: async (params?: any): Promise<Report[]> => {
    const response: AxiosResponse<Report[]> = await api.get('/api/reports/list', { params });
    return response.data;
  },

  getReportDetail: async (reportId: number): Promise<any> => {
    const response = await api.get(`/api/reports/detail/${reportId}`);
    return response.data;
  },

  downloadReport: async (reportId: number): Promise<Blob> => {
    const response = await api.get(`/api/reports/download/${reportId}`, {
      responseType: 'blob',
    });
    return response.data;
  },

  deleteReport: async (reportId: number): Promise<any> => {
    const response: AxiosResponse<any> = await api.delete(`/api/reports/${reportId}`);
    return response.data;
  },

  emailReport: async (reportId: number, email: string, message?: string): Promise<void> => {
    await api.post('/api/reports/email', {
      report_id: reportId,
      healthcare_provider_email: email,
      message,
    });
  },

  generateSummaryReport: async (): Promise<any> => {
    const response: AxiosResponse<any> = await api.post('/api/reports/generate-summary');
    return response.data;
  },
};

export const healthAPI = {
  checkHealth: async (): Promise<any> => {
    const response = await api.get('/api/health/');
    return response.data;
  },
};

export default api; 