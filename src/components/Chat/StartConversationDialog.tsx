import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Box,
  CircularProgress,
  Divider,
  Chip,
} from '@mui/material';
import { MedicalServices as MedicalIcon } from '@mui/icons-material';

interface StartConversationDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (chiefComplaint: string) => void;
  isLoading?: boolean;
}

const commonComplaints = [
  'Headache',
  'Fever',
  'Cough',
  'Stomach pain',
  'Back pain',
  'Chest pain',
  'Fatigue',
  'Nausea',
  'Dizziness',
  'Shortness of breath',
  'Joint pain',
  'Skin rash',
];

const StartConversationDialog: React.FC<StartConversationDialogProps> = ({
  open,
  onClose,
  onSubmit,
  isLoading = false,
}) => {
  const [selectedConcerns, setSelectedConcerns] = useState<string[]>([]);
  const [additionalInfo, setAdditionalInfo] = useState('');

  const handleConcernToggle = (concern: string) => {
    setSelectedConcerns(prev => 
      prev.includes(concern)
        ? prev.filter(c => c !== concern)
        : [...prev, concern]
    );
  };

  const handleSubmit = () => {
    // Combine selected concerns and additional info into the chief complaint
    const concernsText = selectedConcerns.length > 0 
      ? `I'm experiencing: ${selectedConcerns.join(', ')}`
      : '';
    
    const finalComplaint = [concernsText, additionalInfo]
      .filter(text => text.trim())
      .join('. ');
    
    if (finalComplaint.trim()) {
      onSubmit(finalComplaint);
      // Reset form
      setSelectedConcerns([]);
      setAdditionalInfo('');
    }
  };

  const handleClose = () => {
    setSelectedConcerns([]);
    setAdditionalInfo('');
    onClose();
  };

  const canSubmit = selectedConcerns.length > 0 || additionalInfo.trim();

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <MedicalIcon color="primary" />
          <Typography variant="h6" fontWeight="600">
            Start New Health Consultation
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ py: 1 }}>
          <Typography variant="h6" gutterBottom>
            What brings you here today?
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Select all symptoms or concerns that apply to you:
          </Typography>

          {/* Common Concerns - Chip Selection */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
            {commonComplaints.map((concern) => (
              <Chip
                key={concern}
                label={concern}
                onClick={() => handleConcernToggle(concern)}
                variant={selectedConcerns.includes(concern) ? 'filled' : 'outlined'}
                color={selectedConcerns.includes(concern) ? 'primary' : 'default'}
                sx={{
                  cursor: 'pointer',
                  '&:hover': {
                    backgroundColor: selectedConcerns.includes(concern) 
                      ? 'primary.dark' 
                      : 'action.hover',
                  },
                  transition: 'all 0.2s ease-in-out',
                }}
              />
            ))}
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Additional Information */}
          <Typography variant="body1" fontWeight="500" gutterBottom>
            Additional Details
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Please provide any additional information about your symptoms, when they started, severity, or other relevant details:
          </Typography>

          <TextField
            fullWidth
            multiline
            rows={4}
            value={additionalInfo}
            onChange={(e) => setAdditionalInfo(e.target.value)}
            placeholder="Describe your symptoms in detail..."
            variant="outlined"
            sx={{ mb: 2 }}
          />

          {selectedConcerns.length > 0 && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="body2" color="text.secondary">
                <strong>Selected concerns:</strong> {selectedConcerns.join(', ')}
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button
          onClick={handleClose}
          disabled={isLoading}
          color="inherit"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!canSubmit || isLoading}
          startIcon={isLoading ? <CircularProgress size={20} /> : <MedicalIcon />}
          sx={{ minWidth: 140 }}
        >
          {isLoading ? 'Starting...' : 'Start Consultation'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StartConversationDialog; 