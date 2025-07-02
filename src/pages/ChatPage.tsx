import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Container,
  Typography,
  Button,
  TextField,
  CircularProgress,
} from '@mui/material';
import { Add as AddIcon, Send as SendIcon } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';

import { chatAPI, Conversation } from '../services/api';
import { useSnackbar } from '../contexts/SnackbarContext';
import ChatInterface from '../components/Chat/ChatInterface';
import StartConversationDialog from '../components/Chat/StartConversationDialog';

const ChatPage: React.FC = () => {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [message, setMessage] = useState('');
  const queryClient = useQueryClient();
  const { showMessage } = useSnackbar();

  // Fetch conversations
  const {
    data: conversations = [],
    isLoading: conversationsLoading,
  } = useQuery('conversations', chatAPI.getConversations);

  // Start new conversation mutation
  const startConversationMutation = useMutation(
    (chiefComplaint: string) => chatAPI.startConversation(chiefComplaint),
    {
      onSuccess: (newConversation) => {
        setSelectedConversation(newConversation);
        setStartDialogOpen(false);
        queryClient.invalidateQueries('conversations');
        showMessage('New consultation started', 'success');
      },
      onError: (error: any) => {
        showMessage(
          error.response?.data?.detail || 'Failed to start conversation',
          'error'
        );
      },
    }
  );

  // Send message mutation
  const sendMessageMutation = useMutation(
    ({ conversationId, message }: { conversationId: number; message: string }) =>
      chatAPI.sendMessage(conversationId, message),
    {
      onSuccess: (newMessage) => {
        if (selectedConversation) {
          const updatedConversation = {
            ...selectedConversation,
            messages: [...selectedConversation.messages, newMessage],
          };
          setSelectedConversation(updatedConversation);
        }
        setMessage('');
        queryClient.invalidateQueries('conversations');
      },
      onError: (error: any) => {
        showMessage(
          error.response?.data?.detail || 'Failed to send message',
          'error'
        );
      },
    }
  );

  // Auto-select first conversation if none selected
  useEffect(() => {
    if (!selectedConversation && conversations.length > 0) {
      setSelectedConversation(conversations[0]);
    }
  }, [conversations, selectedConversation]);

  const handleStartConversation = (chiefComplaint: string) => {
    startConversationMutation.mutate(chiefComplaint);
  };

  const handleSendMessage = () => {
    if (!selectedConversation || !message.trim()) return;

    sendMessageMutation.mutate({
      conversationId: selectedConversation.id,
      message: message.trim(),
    });
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  if (conversationsLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3, height: 'calc(100vh - 140px)' }}>
      <Box display="flex" height="100%" gap={2}>
        {/* Conversations Sidebar */}
        <Paper
          sx={{
            width: 300,
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.paper',
          }}
        >
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Consultations</Typography>
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setStartDialogOpen(true)}
              disabled={startConversationMutation.isLoading}
            >
              New
            </Button>
          </Box>

          <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
            {conversations.length === 0 ? (
              <Box textAlign="center" py={4}>
                <Typography variant="body2" color="text.secondary">
                  No consultations yet.
                  <br />
                  Start your first consultation!
                </Typography>
              </Box>
            ) : (
              conversations.map((conv) => (
                <Paper
                  key={conv.id}
                  sx={{
                    p: 2,
                    mb: 1,
                    cursor: 'pointer',
                    bgcolor:
                      selectedConversation?.id === conv.id
                        ? 'primary.light'
                        : 'background.default',
                    '&:hover': {
                      bgcolor: 'primary.light',
                    },
                  }}
                  onClick={() => setSelectedConversation(conv)}
                >
                  <Typography variant="subtitle2" noWrap>
                    {conv.title || conv.chief_complaint || 'Consultation'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(conv.started_at).toLocaleDateString()}
                  </Typography>
                </Paper>
              ))
            )}
          </Box>
        </Paper>

        {/* Chat Interface */}
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <Paper sx={{ p: 2, mb: 2 }}>
                <Typography variant="h6">
                  {selectedConversation.title ||
                    selectedConversation.chief_complaint ||
                    'Medical Consultation'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Started: {new Date(selectedConversation.started_at).toLocaleString()}
                </Typography>
              </Paper>

              {/* Messages Area */}
              <ChatInterface
                conversation={selectedConversation}
                isLoading={sendMessageMutation.isLoading}
              />

              {/* Message Input */}
              <Paper sx={{ p: 2, mt: 2 }}>
                <Box display="flex" gap={1}>
                  <TextField
                    fullWidth
                    multiline
                    maxRows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Describe your symptoms or ask a question..."
                    disabled={sendMessageMutation.isLoading}
                  />
                  <Button
                    variant="contained"
                    onClick={handleSendMessage}
                    disabled={!message.trim() || sendMessageMutation.isLoading}
                    sx={{ minWidth: 60 }}
                  >
                    {sendMessageMutation.isLoading ? (
                      <CircularProgress size={20} />
                    ) : (
                      <SendIcon />
                    )}
                  </Button>
                </Box>
              </Paper>
            </>
          ) : (
            <Box
              display="flex"
              flexDirection="column"
              justifyContent="center"
              alignItems="center"
              height="100%"
              textAlign="center"
            >
              <Typography variant="h5" color="text.secondary" mb={2}>
                Welcome to HealthBot
              </Typography>
              <Typography variant="body1" color="text.secondary" mb={4}>
                Start a new consultation to describe your symptoms and get medical insights.
              </Typography>
              <Button
                variant="contained"
                size="large"
                startIcon={<AddIcon />}
                onClick={() => setStartDialogOpen(true)}
                disabled={startConversationMutation.isLoading}
              >
                Start New Consultation
              </Button>
            </Box>
          )}
        </Box>
      </Box>

      {/* Start Conversation Dialog */}
      <StartConversationDialog
        open={startDialogOpen}
        onClose={() => setStartDialogOpen(false)}
        onSubmit={handleStartConversation}
        isLoading={startConversationMutation.isLoading}
      />
    </Container>
  );
};

export default ChatPage; 