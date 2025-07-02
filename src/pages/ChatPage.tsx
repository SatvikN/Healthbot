import React, { useState } from 'react';
import {
  Box,
  Paper,
  Container,
  Typography,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Drawer,
  IconButton,
  Divider,
} from '@mui/material';
import { 
  History as HistoryIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useMutation, useQuery } from 'react-query';

import { useSnackbar } from '../contexts/SnackbarContext';
import ChatInterface from '../components/Chat/ChatInterface';
import StartConversationDialog from '../components/Chat/StartConversationDialog';

interface Message {
  id: number;
  content: string;
  message_type: 'user' | 'assistant';
  created_at: string;
}

interface ActiveConversation {
  id: number;
  title: string;
  messages: Message[];
}



const ChatPage: React.FC = () => {
  const [activeConversation, setActiveConversation] = useState<ActiveConversation | null>(null);
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [conversationsDrawerOpen, setConversationsDrawerOpen] = useState(false);
  const [message, setMessage] = useState('');
  const { showMessage } = useSnackbar();

  // Load conversations list
  const { data: conversations, refetch: refetchConversations } = useQuery(
    'conversations',
    async () => {
      const { chatAPI } = await import('../services/api');
      return chatAPI.getConversations();
    },
    {
      onError: (error: any) => {
        console.error('Error loading conversations:', error);
      },
    }
  );

  // Load specific conversation
  const loadConversation = async (conversationId: number) => {
    try {
      const { chatAPI } = await import('../services/api');
      const conversation = await chatAPI.getConversation(conversationId);
      
      setActiveConversation({
        id: conversation.id,
        title: conversation.title || `Conversation ${conversation.id}`,
        messages: conversation.messages || [],
      });
      setConversationsDrawerOpen(false);
    } catch (error: any) {
      console.error('Error loading conversation:', error);
      showMessage('Failed to load conversation', 'error');
    }
  };

  // Send message to API
  const sendMessageMutation = useMutation(
    async ({ conversationId, message }: { conversationId: number; message: string }) => {
      const { chatAPI } = await import('../services/api');
      return chatAPI.sendMessage(conversationId, message);
    },
    {
      onSuccess: (response: any) => {
        if (activeConversation) {
          // Handle the response format that includes both user and AI messages
          const newMessages: Message[] = [];
          
          if (response.user_message) {
            newMessages.push({
              id: response.user_message.id,
              content: response.user_message.content,
              message_type: 'user' as const,
              created_at: response.user_message.created_at,
            });
          }
          
          if (response.ai_message) {
            newMessages.push({
              id: response.ai_message.id,
              content: response.ai_message.content,
              message_type: 'assistant' as const,
              created_at: response.ai_message.created_at,
            });
          }
          
          setActiveConversation(prev => prev ? {
            ...prev,
            messages: [...prev.messages, ...newMessages],
          } : null);
        }
        // Refresh conversations list to update message count
        refetchConversations();
      },
      onError: (error: any) => {
        console.error('Error sending message:', error);
        let errorMessage = 'Failed to send message. Please try again.';
        
        if (error.response) {
          const status = error.response.status;
          const detail = error.response.data?.detail || error.response.data?.message;
          
          if (status === 401) {
            errorMessage = 'Authentication failed. Please log in again.';
          } else if (status === 500) {
            errorMessage = `Server error: ${detail || 'Internal server error occurred.'}`;
          } else if (detail) {
            errorMessage = `Error (${status}): ${detail}`;
          }
        } else if (error.request) {
          errorMessage = 'Network error. Please check your connection.';
        }
        
        showMessage(errorMessage, 'error');
      },
    }
  );

  // Start conversation via API
  const startConversationMutation = useMutation(
    async ({ chiefComplaint }: { chiefComplaint: string }) => {
      const { chatAPI } = await import('../services/api');
      return chatAPI.startConversation(chiefComplaint);
    },
    {
      onSuccess: (response: any, variables) => {
        // Handle the response format from start conversation
        const newConversation: ActiveConversation = {
          id: response.conversation_id,
          title: `Medical consultation - ${new Date().toLocaleDateString()}`,
          messages: [
            {
              id: response.user_message.id,
              content: response.user_message.content,
              message_type: 'user' as const,
              created_at: response.user_message.created_at,
            },
            {
              id: response.ai_message.id,
              content: response.ai_message.content,
              message_type: 'assistant' as const,
              created_at: response.ai_message.created_at,
            },
          ],
        };
        
        setActiveConversation(newConversation);
        setStartDialogOpen(false);
        showMessage('New consultation started', 'success');
        // Refresh conversations list
        refetchConversations();
      },
      onError: (error: any) => {
        console.error('Error starting conversation:', error);
        let errorMessage = 'Failed to start conversation. Please try again.';
        
        if (error.response) {
          const status = error.response.status;
          const detail = error.response.data?.detail || error.response.data?.message;
          
          if (status === 401) {
            errorMessage = 'Authentication failed. Please log in again.';
          } else if (status === 403) {
            errorMessage = 'Access denied. Please check your permissions.';
          } else if (status === 500) {
            errorMessage = `Server error: ${detail || 'Internal server error occurred.'}`;
          } else if (detail) {
            errorMessage = `Error (${status}): ${detail}`;
          } else {
            errorMessage = `Server error (${status}). Please try again.`;
          }
        } else if (error.request) {
          errorMessage = 'Network error. Please check your connection and ensure the server is running.';
        } else if (error.message) {
          errorMessage = `Error: ${error.message}`;
        }
        
        showMessage(errorMessage, 'error');
      },
    }
  );

  // Diagnosis generation mutation
  const generateDiagnosisMutation = useMutation(
    async (conversationId: number) => {
      const { chatAPI } = await import('../services/api');
      return chatAPI.generateDiagnosisRecommendations(conversationId);
    },
    {
      onSuccess: (response: any) => {
        showMessage('Diagnosis and treatment recommendations generated successfully!', 'success');
        
        // Add the diagnosis message to the conversation
        if (response && response.diagnosis_message && activeConversation) {
          const diagnosisMessage = {
            id: response.diagnosis_message.id,
            content: response.diagnosis_message.content,
            message_type: 'assistant' as const,
            created_at: response.diagnosis_message.created_at,
          };
          
          setActiveConversation(prev => prev ? {
            ...prev,
            messages: [...prev.messages, diagnosisMessage],
          } : null);
        }
      },
      onError: (error: any) => {
        console.error('Error generating diagnosis:', error);
        let errorMessage = 'Failed to generate diagnosis recommendations. Please try again.';
        
        if (error.response) {
          const status = error.response.status;
          const detail = error.response.data?.detail || error.response.data?.message;
          
          if (status === 401) {
            errorMessage = 'Authentication failed. Please log in again.';
          } else if (status === 500) {
            errorMessage = `Server error: ${detail || 'Internal server error occurred.'}`;
          } else if (detail) {
            errorMessage = `Error (${status}): ${detail}`;
          }
        } else if (error.request) {
          errorMessage = 'Network error. Please check your connection.';
        }
        
        showMessage(errorMessage, 'error');
      },
    }
  );

  // Medical report generation mutation
  const generateMedicalReportMutation = useMutation(
    async (conversationId: number) => {
      const { chatAPI } = await import('../services/api');
      return chatAPI.generateMedicalReport(conversationId);
    },
    {
      onSuccess: (response: any) => {
        showMessage('✅ Medical report generated successfully and saved to your Reports section!', 'success');
      },
      onError: (error: any) => {
        console.error('Error generating medical report:', error);
        let errorMessage = 'Failed to generate medical report. Please try again.';
        
        if (error.response) {
          const status = error.response.status;
          const detail = error.response.data?.detail || error.response.data?.message;
          
          if (status === 401) {
            errorMessage = 'Authentication failed. Please log in again.';
          } else if (status === 500) {
            errorMessage = `Server error: ${detail || 'Internal server error occurred.'}`;
          } else if (detail) {
            errorMessage = `Error (${status}): ${detail}`;
          }
        } else if (error.request) {
          errorMessage = 'Network error. Please check your connection.';
        }
        
        showMessage(errorMessage, 'error');
      },
    }
  );

  const sendMessage = (messageText: string) => {
    if (activeConversation) {
      sendMessageMutation.mutate({
        conversationId: activeConversation.id,
        message: messageText,
      });
    }
  };

  const handleSendMessage = () => {
    if (message.trim() && activeConversation) {
      sendMessage(message.trim());
      setMessage('');
    }
  };

  const handleQuickReply = (replyMessage: string) => {
    sendMessage(replyMessage);
  };

  const handleRequestDiagnosis = () => {
    if (activeConversation) {
      generateDiagnosisMutation.mutate(activeConversation.id);
    }
  };

  const handleGenerateReport = () => {
    if (activeConversation) {
      generateMedicalReportMutation.mutate(activeConversation.id);
    }
  };

  const handleStartConversation = (chiefComplaint: string) => {
    startConversationMutation.mutate({ chiefComplaint });
  };



  const handleNewConversation = () => {
    setStartDialogOpen(true);
  };

  const handleSelectConversation = (conversationId: number) => {
    loadConversation(conversationId);
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
        {/* Header with controls */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" component="h1">
            Medical Chat Assistant
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<HistoryIcon />}
              onClick={() => setConversationsDrawerOpen(true)}
            >
              Previous Chats
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleNewConversation}
            >
              New Chat
            </Button>
          </Box>
        </Box>

        {/* Main chat area */}
        <Paper sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {activeConversation ? (
            <>
              {/* Chat header */}
              <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="h6" noWrap>
                  {activeConversation.title}
                </Typography>
              </Box>

              {/* Chat interface */}
              <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
                <ChatInterface
                  conversation={{
                    id: activeConversation.id,
                    title: activeConversation.title,
                    chief_complaint: '',
                    status: 'active',
                    started_at: new Date().toISOString(),
                    messages: activeConversation.messages,
                  }}
                  isLoading={sendMessageMutation.isLoading}
                  onQuickReply={handleQuickReply}
                  onRequestDiagnosis={handleRequestDiagnosis}
                  isDiagnosisLoading={generateDiagnosisMutation.isLoading}
                  onGenerateReport={handleGenerateReport}
                  isReportLoading={generateMedicalReportMutation.isLoading}
                />
              </Box>
            </>
          ) : (
            // Welcome screen
            <Box
              sx={{
                flexGrow: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                p: 4,
                textAlign: 'center',
              }}
            >
              <Typography variant="h5" gutterBottom>
                Welcome to your Medical Chat Assistant
              </Typography>
              <Typography variant="body1" color="text.secondary" gutterBottom sx={{ mb: 4 }}>
                Start a new conversation to get medical guidance, or view your previous consultations.
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<AddIcon />}
                  onClick={handleNewConversation}
                >
                  Start New Consultation
                </Button>
                {conversations && conversations.length > 0 && (
                  <Button
                    variant="outlined"
                    size="large"
                    startIcon={<HistoryIcon />}
                    onClick={() => setConversationsDrawerOpen(true)}
                  >
                    View Previous Chats ({conversations.length})
                  </Button>
                )}
              </Box>
            </Box>
          )}
        </Paper>

        {/* Conversations Drawer */}
        <Drawer
          anchor="right"
          open={conversationsDrawerOpen}
          onClose={() => setConversationsDrawerOpen(false)}
          PaperProps={{
            sx: { width: 400 }
          }}
        >
          <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">Previous Conversations</Typography>
            <IconButton
              edge="end"
              onClick={() => setConversationsDrawerOpen(false)}
            >
              ✕
            </IconButton>
          </Box>
          <Divider />
          
          {conversations && conversations.length > 0 ? (
            <List>
              {conversations.map((conversation) => (
                <ListItem key={conversation.id} disablePadding>
                  <ListItemButton
                    onClick={() => handleSelectConversation(conversation.id)}
                    selected={activeConversation?.id === conversation.id}
                  >
                    <ListItemText
                      primary={conversation.title}
                      secondary={
                        <Box>
                          <Typography variant="caption" display="block">
                            {new Date(conversation.started_at).toLocaleDateString()} at{' '}
                            {new Date(conversation.started_at).toLocaleTimeString()}
                          </Typography>
                                                     <Typography variant="caption" color="text.secondary">
                             {conversation.messages?.length || 0} messages
                           </Typography>
                        </Box>
                      }
                    />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          ) : (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary">
                No previous conversations found.
              </Typography>
              <Button
                variant="contained"
                sx={{ mt: 2 }}
                onClick={() => {
                  setConversationsDrawerOpen(false);
                  handleNewConversation();
                }}
              >
                Start Your First Chat
              </Button>
            </Box>
          )}
        </Drawer>

        {/* Start Conversation Dialog */}
        <StartConversationDialog
          open={startDialogOpen}
          onClose={() => setStartDialogOpen(false)}
          onSubmit={handleStartConversation}
          isLoading={startConversationMutation.isLoading}
        />
      </Box>
    </Container>
  );
};

export default ChatPage; 