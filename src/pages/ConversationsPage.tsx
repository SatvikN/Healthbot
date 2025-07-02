import React from 'react';
import { Box, Typography } from '@mui/material';

const ConversationsPage: React.FC = () => {
  return (
    <Box p={3}>
      <Typography variant="h4">Conversations</Typography>
      <Typography>Conversation history will be displayed here.</Typography>
    </Box>
  );
};

export default ConversationsPage; 