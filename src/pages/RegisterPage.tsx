import React, { useState } from 'react';
import {
  Box,
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Link,
  CircularProgress,
} from '@mui/material';
import { MedicalServices as MedicalIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';

const RegisterPage: React.FC = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    date_of_birth: '',
    medical_history: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  
  const { register } = useAuth();
  const { showMessage } = useSnackbar();
  const navigate = useNavigate();

  const handleInputChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password || !formData.full_name) {
      showMessage('Please fill in required fields', 'error');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      showMessage('Passwords do not match', 'error');
      return;
    }

    if (formData.password.length < 6) {
      showMessage('Password must be at least 6 characters', 'error');
      return;
    }

    setIsLoading(true);
    try {
      await register({
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
        date_of_birth: formData.date_of_birth || undefined,
        medical_history: formData.medical_history || undefined
      });
      showMessage('Registration successful! Welcome to HealthBot!', 'success');
    } catch (error: any) {
      showMessage(
        error.response?.data?.detail || 'Registration failed',
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: 3
        }}
      >
        <Paper sx={{ p: 4, width: '100%' }}>
          <Box textAlign="center" mb={3}>
            <MedicalIcon sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
            <Typography variant="h4" gutterBottom>
              Join HealthBot
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create your account for AI medical consultation
            </Typography>
          </Box>

          <form onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Full Name *"
              value={formData.full_name}
              onChange={handleInputChange('full_name')}
              margin="normal"
              required
              disabled={isLoading}
            />
            <TextField
              fullWidth
              label="Email *"
              type="email"
              value={formData.email}
              onChange={handleInputChange('email')}
              margin="normal"
              required
              disabled={isLoading}
            />
            <TextField
              fullWidth
              label="Password *"
              type="password"
              value={formData.password}
              onChange={handleInputChange('password')}
              margin="normal"
              required
              disabled={isLoading}
              helperText="At least 6 characters"
            />
            <TextField
              fullWidth
              label="Confirm Password *"
              type="password"
              value={formData.confirmPassword}
              onChange={handleInputChange('confirmPassword')}
              margin="normal"
              required
              disabled={isLoading}
            />
            <TextField
              fullWidth
              label="Date of Birth (Optional)"
              type="date"
              value={formData.date_of_birth}
              onChange={handleInputChange('date_of_birth')}
              margin="normal"
              disabled={isLoading}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              fullWidth
              label="Medical History (Optional)"
              multiline
              rows={3}
              value={formData.medical_history}
              onChange={handleInputChange('medical_history')}
              margin="normal"
              disabled={isLoading}
              placeholder="Any relevant medical history, allergies, medications..."
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={isLoading}
            >
              {isLoading ? <CircularProgress size={24} /> : 'Create Account'}
            </Button>
          </form>

          <Box textAlign="center">
            <Typography variant="body2">
              Already have an account?{' '}
              <Link
                component="button"
                variant="body2"
                onClick={() => navigate('/login')}
                sx={{ textDecoration: 'none' }}
              >
                Sign in here
              </Link>
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default RegisterPage; 