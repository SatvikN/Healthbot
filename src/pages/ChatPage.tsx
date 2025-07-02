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
  Menu,
  MenuItem,
  Alert,
  AlertTitle,
} from '@mui/material';
import { 
  History as HistoryIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  MoreVert as MoreVertIcon,
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

interface AutoDiagnosis {
  content: string;
  generated_at: string;
  confidence_note: string;
}



const ChatPage: React.FC = () => {
  const [activeConversation, setActiveConversation] = useState<ActiveConversation | null>(null);
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [conversationsDrawerOpen, setConversationsDrawerOpen] = useState(false);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [autoDiagnosis, setAutoDiagnosis] = useState<AutoDiagnosis | null>(null);
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

          // Handle automatic diagnosis prediction
          if (response.automatic_diagnosis) {
            setAutoDiagnosis({
              content: response.automatic_diagnosis.content,
              generated_at: response.automatic_diagnosis.generated_at,
              confidence_note: response.automatic_diagnosis.confidence_note,
            });
          }
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
        
        // Add the notification message to the conversation
        if (response && response.notification_message && activeConversation) {
          const notificationMessage = {
            id: response.notification_message.id,
            content: response.notification_message.content,
            message_type: 'assistant' as const,
            created_at: response.notification_message.created_at,
          };
          
          setActiveConversation(prev => prev ? {
            ...prev,
            messages: [...prev.messages, notificationMessage],
          } : null);
        }
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

  // Delete conversation mutation
  const deleteConversationMutation = useMutation(
    async (conversationId: number) => {
      const { chatAPI } = await import('../services/api');
      return chatAPI.deleteConversation(conversationId);
    },
    {
      onSuccess: (response: any, conversationId: number) => {
        showMessage('Conversation deleted successfully', 'success');
        
        // If the deleted conversation was active, clear it
        if (activeConversation?.id === conversationId) {
          setActiveConversation(null);
        }
        
        // Refresh conversations list
        refetchConversations();
        setMenuAnchorEl(null);
      },
      onError: (error: any) => {
        console.error('Error deleting conversation:', error);
        let errorMessage = 'Failed to delete conversation. Please try again.';
        
        if (error.response) {
          const status = error.response.status;
          const detail = error.response.data?.detail || error.response.data?.message;
          
          if (status === 401) {
            errorMessage = 'Authentication failed. Please log in again.';
          } else if (status === 404) {
            errorMessage = 'Conversation not found.';
          } else if (status === 500) {
            errorMessage = `Server error: ${detail || 'Internal server error occurred.'}`;
          } else if (detail) {
            errorMessage = `Error (${status}): ${detail}`;
          }
        } else if (error.request) {
          errorMessage = 'Network error. Please check your connection.';
        }
        
        showMessage(errorMessage, 'error');
        setMenuAnchorEl(null);
      },
    }
  );

  // Download PDF report mutation
  const downloadPDFMutation = useMutation(
    async (conversationId: number) => {
      const { chatAPI } = await import('../services/api');
      return chatAPI.downloadMedicalReportPDF(conversationId);
    },
    {
      onSuccess: (blob: Blob, conversationId: number) => {
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `medical_report_${conversationId}_${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        
        showMessage('PDF report downloaded successfully!', 'success');
        setMenuAnchorEl(null);
      },
      onError: (error: any) => {
        console.error('Error downloading PDF:', error);
        let errorMessage = 'Failed to download PDF report. Please try again.';
        
        if (error.response) {
          const status = error.response.status;
          const detail = error.response.data?.detail || error.response.data?.message;
          
          if (status === 401) {
            errorMessage = 'Authentication failed. Please log in again.';
          } else if (status === 404) {
            errorMessage = 'Report not found. Please generate a medical report first.';
          } else if (status === 500) {
            errorMessage = `Server error: ${detail || 'Internal server error occurred.'}`;
          } else if (detail) {
            errorMessage = `Error (${status}): ${detail}`;
          }
        } else if (error.request) {
          errorMessage = 'Network error. Please check your connection.';
        }
        
        showMessage(errorMessage, 'error');
        setMenuAnchorEl(null);
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

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, conversationId: number) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setSelectedConversationId(conversationId);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setSelectedConversationId(null);
  };

  const handleDeleteConversation = () => {
    if (selectedConversationId) {
      deleteConversationMutation.mutate(selectedConversationId);
    }
  };

  const handleDownloadPDF = () => {
    if (selectedConversationId) {
      downloadPDFMutation.mutate(selectedConversationId);
    }
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

              {/* Automatic Diagnosis Alert */}
              {autoDiagnosis && (
                <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Alert severity="info" onClose={() => setAutoDiagnosis(null)}>
                    <AlertTitle>Automatic AI Diagnosis Prediction</AlertTitle>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {autoDiagnosis.content}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {autoDiagnosis.confidence_note}
                    </Typography>
                  </Alert>
                </Box>
              )}

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
                  onSendMessage={sendMessage}
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
                            {(conversation as any).message_count || conversation.messages?.length || 0} messages
                          </Typography>
                        </Box>
                      }
                    />
                    <IconButton
                      edge="end"
                      onClick={(e) => handleMenuOpen(e, conversation.id)}
                      size="small"
                    >
                      <MoreVertIcon />
                    </IconButton>
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

        {/* Conversation Actions Menu */}
        <Menu
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={handleDownloadPDF} disabled={downloadPDFMutation.isLoading}>
            <DownloadIcon sx={{ mr: 1 }} />
            Download PDF Report
          </MenuItem>
          <MenuItem 
            onClick={handleDeleteConversation} 
            disabled={deleteConversationMutation.isLoading}
            sx={{ color: 'error.main' }}
          >
            <DeleteIcon sx={{ mr: 1 }} />
            Delete Conversation
          </MenuItem>
        </Menu>

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