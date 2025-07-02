import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Container,
  Avatar,
  Grid,
  TextField,
  Button,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  Edit as EditIcon,
  PhotoCamera as PhotoCameraIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Person as PersonIcon,
  MedicalServices as MedicalIcon,
  CalendarMonth as CalendarIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { useSnackbar } from '../contexts/SnackbarContext';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';

interface UserProfile {
  fullName: string;
  email: string;
  dateOfBirth: string;
  phone: string;
  address: string;
  emergencyContact: string;
  medicalHistory: string;
  allergies: string[];
  currentMedications: string[];
  bloodType: string;
  height: string;
  weight: string;
  profileImage: string;
}

const ProfilePage: React.FC = () => {
  const { showMessage } = useSnackbar();
  const { logout } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  
  // User profile state
  const [profile, setProfile] = useState<UserProfile>({
    fullName: '',
    email: '',
    dateOfBirth: '',
    phone: '',
    address: '',
    emergencyContact: '',
    medicalHistory: '',
    allergies: [],
    currentMedications: [],
    bloodType: '',
    height: '',
    weight: '',
    profileImage: '',
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editedProfile, setEditedProfile] = useState<UserProfile>(profile);

  // Load user profile data from API
  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const user = await authAPI.getCurrentUser();
        
        // Transform API user data to profile format
        const userProfile: UserProfile = {
          fullName: user.full_name || '',
          email: user.email || '',
          dateOfBirth: user.date_of_birth || '',
          phone: user.phone || '',
          address: user.address || '',
          emergencyContact: user.emergency_contact || '',
          medicalHistory: user.medical_history || '',
          allergies: user.allergies ? user.allergies.split(', ').filter(a => a.trim()) : [],
          currentMedications: user.current_medications ? user.current_medications.split(', ').filter(m => m.trim()) : [],
          bloodType: user.blood_type || '',
          height: user.height || '',
          weight: user.weight || '',
          profileImage: '', // Profile images not implemented yet
        };
        
        setProfile(userProfile);
        setEditedProfile(userProfile);
      } catch (err) {
        console.error('Failed to load user profile:', err);
        setError('Failed to load profile data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleStartEdit = () => {
    setEditedProfile(profile);
    setIsEditing(true);
  };

  const handleSaveProfile = async () => {
    try {
      // Prepare data for API - convert arrays to proper format
      const profileUpdateData = {
        full_name: editedProfile.fullName,
        date_of_birth: editedProfile.dateOfBirth,
        phone: editedProfile.phone,
        address: editedProfile.address,
        emergency_contact: editedProfile.emergencyContact,
        medical_history: editedProfile.medicalHistory,
        allergies: editedProfile.allergies, // API expects array
        current_medications: editedProfile.currentMedications, // API expects array
        blood_type: editedProfile.bloodType,
        height: editedProfile.height,
        weight: editedProfile.weight,
      };

      // Call the real API to update profile
      const updatedUser = await authAPI.updateProfile(profileUpdateData);
      
      // Transform the updated user data back to profile format
      const updatedProfile: UserProfile = {
        fullName: updatedUser.full_name || '',
        email: updatedUser.email || '',
        dateOfBirth: updatedUser.date_of_birth || '',
        phone: updatedUser.phone || '',
        address: updatedUser.address || '',
        emergencyContact: updatedUser.emergency_contact || '',
        medicalHistory: updatedUser.medical_history || '',
        allergies: updatedUser.allergies ? updatedUser.allergies.split(', ').filter(a => a.trim()) : [],
        currentMedications: updatedUser.current_medications ? updatedUser.current_medications.split(', ').filter(m => m.trim()) : [],
        bloodType: updatedUser.blood_type || '',
        height: updatedUser.height || '',
        weight: updatedUser.weight || '',
        profileImage: '',
      };

      setProfile(updatedProfile);
      setEditedProfile(updatedProfile);
      setIsEditing(false);
      showMessage('Profile updated successfully!', 'success');
    } catch (err) {
      console.error('Failed to save profile:', err);
      showMessage('Failed to save profile changes. Please try again.', 'error');
    }
  };

  const handleCancelEdit = () => {
    setEditedProfile(profile);
    setIsEditing(false);
  };

  const handleInputChange = (field: keyof UserProfile, value: string) => {
    setEditedProfile(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleArrayInputChange = (field: 'allergies' | 'currentMedications', value: string) => {
    const items = value.split(',').map(item => item.trim()).filter(item => item.length > 0);
    setEditedProfile(prev => ({
      ...prev,
      [field]: items,
    }));
  };

  const removeChip = (field: 'allergies' | 'currentMedications', index: number) => {
    if (!isEditing) return;
    
    setEditedProfile(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index),
    }));
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const handleLogout = () => {
    logout();
    showMessage('Logged out successfully', 'success');
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress size={60} />
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* Error Banner */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Profile Header */}
      <Paper sx={{ p: 4, mb: 3, borderRadius: 3 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item>
            <Box position="relative">
              <Avatar
                sx={{
                  width: 120,
                  height: 120,
                  fontSize: '2rem',
                  bgcolor: 'primary.main',
                  cursor: 'pointer',
                }}
                src={profile.profileImage}
                onClick={() => setPhotoDialogOpen(true)}
              >
                {profile.profileImage ? '' : getInitials(profile.fullName)}
              </Avatar>
              <IconButton
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  bgcolor: 'background.paper',
                  border: '2px solid',
                  borderColor: 'divider',
                  '&:hover': {
                    bgcolor: 'primary.light',
                  },
                }}
                size="small"
                onClick={() => setPhotoDialogOpen(true)}
              >
                <PhotoCameraIcon fontSize="small" />
              </IconButton>
            </Box>
          </Grid>
          
          <Grid item xs>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="h4" gutterBottom>
                  {profile.fullName}
                </Typography>
                <Typography variant="body1" color="text.secondary" gutterBottom>
                  {profile.email}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Member since January 2024
                </Typography>
              </Box>
              
              <Box>
                {!isEditing ? (
                  <Button
                    variant="contained"
                    startIcon={<EditIcon />}
                    onClick={handleStartEdit}
                  >
                    Edit Profile
                  </Button>
                ) : (
                  <Box display="flex" gap={1}>
                    <Button
                      variant="contained"
                      startIcon={<SaveIcon />}
                      onClick={handleSaveProfile}
                      color="primary"
                    >
                      Save
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<CancelIcon />}
                      onClick={handleCancelEdit}
                    >
                      Cancel
                    </Button>
                  </Box>
                )}
              </Box>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={3}>
        {/* Personal Information */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 3, height: 'fit-content' }}>
            <Box display="flex" alignItems="center" gap={1} mb={3}>
              <PersonIcon color="primary" />
              <Typography variant="h6">Personal Information</Typography>
            </Box>
            
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <PersonIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">Full Name</Typography>
                </Box>
                {isEditing ? (
                  <TextField
                    fullWidth
                    value={editedProfile.fullName}
                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                    variant="outlined"
                    size="small"
                  />
                ) : (
                  <Typography variant="body1">{profile.fullName}</Typography>
                )}
              </Grid>
              
              <Grid item xs={12}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <EmailIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">Email</Typography>
                </Box>
                {isEditing ? (
                  <TextField
                    fullWidth
                    value={editedProfile.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    variant="outlined"
                    size="small"
                    type="email"
                  />
                ) : (
                  <Typography variant="body1">{profile.email}</Typography>
                )}
              </Grid>
              
              <Grid item xs={12}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <CalendarIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">Date of Birth</Typography>
                </Box>
                {isEditing ? (
                  <TextField
                    fullWidth
                    value={editedProfile.dateOfBirth}
                    onChange={(e) => handleInputChange('dateOfBirth', e.target.value)}
                    variant="outlined"
                    size="small"
                    type="date"
                  />
                ) : (
                  <Typography variant="body1">
                    {new Date(profile.dateOfBirth).toLocaleDateString()}
                  </Typography>
                )}
              </Grid>
              
              <Grid item xs={12}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <PhoneIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">Phone</Typography>
                </Box>
                {isEditing ? (
                  <TextField
                    fullWidth
                    value={editedProfile.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    variant="outlined"
                    size="small"
                  />
                ) : (
                  <Typography variant="body1">{profile.phone}</Typography>
                )}
              </Grid>
              
              <Grid item xs={12}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <LocationIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">Address</Typography>
                </Box>
                {isEditing ? (
                  <TextField
                    fullWidth
                    value={editedProfile.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    variant="outlined"
                    size="small"
                    multiline
                    rows={2}
                  />
                ) : (
                  <Typography variant="body1">{profile.address}</Typography>
                )}
              </Grid>
              
              <Grid item xs={12}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <PersonIcon fontSize="small" color="action" />
                  <Typography variant="body2" color="text.secondary">Emergency Contact</Typography>
                </Box>
                {isEditing ? (
                  <TextField
                    fullWidth
                    value={editedProfile.emergencyContact}
                    onChange={(e) => handleInputChange('emergencyContact', e.target.value)}
                    variant="outlined"
                    size="small"
                    placeholder="Name - Phone Number"
                  />
                ) : (
                  <Typography variant="body1">{profile.emergencyContact}</Typography>
                )}
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Medical Information */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 3, height: 'fit-content' }}>
            <Box display="flex" alignItems="center" gap={1} mb={3}>
              <MedicalIcon color="primary" />
              <Typography variant="h6">Medical Information</Typography>
            </Box>
            
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary" gutterBottom>Blood Type</Typography>
                {isEditing ? (
                  <TextField
                    fullWidth
                    value={editedProfile.bloodType}
                    onChange={(e) => handleInputChange('bloodType', e.target.value)}
                    variant="outlined"
                    size="small"
                  />
                ) : (
                  <Typography variant="body1">{profile.bloodType}</Typography>
                )}
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary" gutterBottom>Height</Typography>
                {isEditing ? (
                  <TextField
                    fullWidth
                    value={editedProfile.height}
                    onChange={(e) => handleInputChange('height', e.target.value)}
                    variant="outlined"
                    size="small"
                  />
                ) : (
                  <Typography variant="body1">{profile.height}</Typography>
                )}
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="body2" color="text.secondary" gutterBottom>Weight</Typography>
                {isEditing ? (
                  <TextField
                    fullWidth
                    value={editedProfile.weight}
                    onChange={(e) => handleInputChange('weight', e.target.value)}
                    variant="outlined"
                    size="small"
                  />
                ) : (
                  <Typography variant="body1">{profile.weight}</Typography>
                )}
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary" gutterBottom>Medical History</Typography>
                {isEditing ? (
                  <TextField
                    fullWidth
                    value={editedProfile.medicalHistory}
                    onChange={(e) => handleInputChange('medicalHistory', e.target.value)}
                    variant="outlined"
                    size="small"
                    multiline
                    rows={3}
                    placeholder="Previous conditions, surgeries, etc."
                  />
                ) : (
                  <Typography variant="body1">{profile.medicalHistory}</Typography>
                )}
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary" gutterBottom>Allergies</Typography>
                {isEditing ? (
                  <TextField
                    fullWidth
                    value={editedProfile.allergies.join(', ')}
                    onChange={(e) => handleArrayInputChange('allergies', e.target.value)}
                    variant="outlined"
                    size="small"
                    placeholder="Separate allergies with commas"
                    helperText="Separate multiple allergies with commas"
                  />
                ) : (
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {profile.allergies.map((allergy, index) => (
                      <Chip
                        key={index}
                        label={allergy}
                        size="small"
                        color="warning"
                        variant="outlined"
                        onDelete={isEditing ? () => removeChip('allergies', index) : undefined}
                      />
                    ))}
                    {profile.allergies.length === 0 && (
                      <Typography variant="body2" color="text.secondary">None reported</Typography>
                    )}
                  </Box>
                )}
              </Grid>
              
              <Grid item xs={12}>
                <Typography variant="body2" color="text.secondary" gutterBottom>Current Medications</Typography>
                {isEditing ? (
                  <TextField
                    fullWidth
                    value={editedProfile.currentMedications.join(', ')}
                    onChange={(e) => handleArrayInputChange('currentMedications', e.target.value)}
                    variant="outlined"
                    size="small"
                    placeholder="Separate medications with commas"
                    helperText="Separate multiple medications with commas"
                  />
                ) : (
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {profile.currentMedications.map((medication, index) => (
                      <Chip
                        key={index}
                        label={medication}
                        size="small"
                        color="primary"
                        variant="outlined"
                        onDelete={isEditing ? () => removeChip('currentMedications', index) : undefined}
                      />
                    ))}
                    {profile.currentMedications.length === 0 && (
                      <Typography variant="body2" color="text.secondary">None reported</Typography>
                    )}
                  </Box>
                )}
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>

      {/* Account Actions */}
      <Paper sx={{ p: 3, mt: 3, borderRadius: 3, borderColor: 'error.light', border: '1px solid' }}>
        <Typography variant="h6" gutterBottom color="error.main">
          Account Actions
        </Typography>
        <Button
          variant="outlined"
          color="error"
          startIcon={<LogoutIcon />}
          onClick={handleLogout}
          sx={{ minWidth: 120 }}
        >
          Log Out
        </Button>
      </Paper>

      {/* Photo Upload Dialog */}
      <Dialog open={photoDialogOpen} onClose={() => setPhotoDialogOpen(false)}>
        <DialogTitle>Update Profile Photo</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" paragraph>
            In demo mode, profile photo upload is simulated. In a real application, 
            you would be able to upload and crop your profile image here.
          </Typography>
          <Box display="flex" justifyContent="center" p={2}>
            <Avatar
              sx={{
                width: 120,
                height: 120,
                fontSize: '2rem',
                bgcolor: 'primary.main',
              }}
              src={profile.profileImage}
            >
              {profile.profileImage ? '' : getInitials(profile.fullName)}
            </Avatar>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPhotoDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={() => {
              setPhotoDialogOpen(false);
              showMessage('Photo upload simulated in demo mode', 'info');
            }}
          >
            Upload Photo
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ProfilePage; 