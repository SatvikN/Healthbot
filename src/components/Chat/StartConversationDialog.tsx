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
  Chip,
  CircularProgress,
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
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!chiefComplaint.trim()) {
      setError('Please describe your main concern');
      return;
    }

    if (chiefComplaint.trim().length < 5) {
      setError('Please provide more details about your concern');
      return;
    }

    setError('');
    onSubmit(chiefComplaint.trim());
  };

  const handleClose = () => {
    if (!isLoading) {
      setChiefComplaint('');
      setError('');
      onClose();
    }
  };

  const handleComplaintClick = (complaint: string) => {
    setChiefComplaint(complaint);
    setError('');
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { borderRadius: 2 },
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <MedicalIcon color="primary" />
          <Typography variant="h6">Start New Medical Consultation</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Please describe your main health concern or symptoms. This will help me provide 
          better assistance during our consultation.
        </Typography>

        <TextField
          fullWidth
          multiline
          rows={4}
          label="What brings you here today?"
          placeholder="Describe your main symptoms or health concern..."
          value={chiefComplaint}
          onChange={(e) => {
            setChiefComplaint(e.target.value);
            setError('');
          }}
          onKeyPress={handleKeyPress}
          error={!!error}
          helperText={error}
          disabled={isLoading}
          sx={{ mb: 3 }}
        />

        <Typography variant="subtitle2" color="text.secondary" mb={1}>
          Common concerns (click to select):
        </Typography>

        <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
          {commonComplaints.map((complaint) => (
            <Chip
              key={complaint}
              label={complaint}
              onClick={() => handleComplaintClick(complaint)}
              variant={chiefComplaint === complaint ? 'filled' : 'outlined'}
              color={chiefComplaint === complaint ? 'primary' : 'default'}
              size="small"
              disabled={isLoading}
              sx={{
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: 'primary.light',
                },
              }}
            />
          ))}
        </Box>

        <Box
          sx={{
            bgcolor: 'info.light',
            p: 2,
            borderRadius: 1,
            mt: 2,
          }}
        >
          <Typography variant="caption" color="info.dark">
            💡 <strong>Tip:</strong> Be as specific as possible about your symptoms, 
            including when they started, severity, and any factors that make them better or worse.
          </Typography>
        </Box>

        <Box
          sx={{
            bgcolor: 'warning.light',
            p: 2,
            borderRadius: 1,
            mt: 1,
          }}
        >
          <Typography variant="caption" color="warning.dark">
            ⚠️ <strong>Emergency:</strong> If you're experiencing a medical emergency, 
            please call emergency services immediately instead of using this service.
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 1 }}>
        <Button
          onClick={handleClose}
          disabled={isLoading}
          sx={{ mr: 1 }}
        >
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!chiefComplaint.trim() || isLoading}
          startIcon={isLoading ? <CircularProgress size={16} /> : <MedicalIcon />}
          sx={{ minWidth: 140 }}
        >
          {isLoading ? 'Starting...' : 'Start Consultation'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default StartConversationDialog; 