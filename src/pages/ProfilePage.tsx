import React from 'react';
import { Box, Typography } from '@mui/material';

const ProfilePage: React.FC = () => {
  return (
    <Box p={3}>
      <Typography variant="h4">Profile</Typography>
      <Typography>User profile and settings will be displayed here.</Typography>
    </Box>
  );
};

export default ProfilePage; 