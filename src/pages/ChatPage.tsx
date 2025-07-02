import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Paper,
  Container,
  Typography,
  Button,
  TextField,
  CircularProgress,
  IconButton,
  Collapse,
  Tooltip,
} from '@mui/material';
import { 
  Add as AddIcon, 
  Send as SendIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Chat as ChatIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from 'react-query';

import { Conversation } from '../services/api';
import { useSnackbar } from '../contexts/SnackbarContext';
import ChatInterface from '../components/Chat/ChatInterface';
import StartConversationDialog from '../components/Chat/StartConversationDialog';

const ChatPage: React.FC = () => {
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [message, setMessage] = useState('');

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [editingConversationId, setEditingConversationId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const queryClient = useQueryClient();
  const { showMessage } = useSnackbar();



  // Fetch conversations from API
  const {
    data: conversations = [],
    isLoading: conversationsLoading,
  } = useQuery('conversations', async () => {
    const { chatAPI } = await import('../services/api');
    return chatAPI.getConversations();
  }, {
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    cacheTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false, // Don't refetch when user focuses window
    refetchOnReconnect: false, // Don't refetch on reconnect
  });

  // Send message to API
  const sendMessageMutation = useMutation(
    async ({ conversationId, message }: { conversationId: number; message: string }) => {
      const { chatAPI } = await import('../services/api');
      return chatAPI.sendMessage(conversationId, message);
    },
    {
      onSuccess: (response: any) => {
        if (selectedConversation) {
          // Handle the new response format that includes both user and AI messages
          const newMessages = [];
          
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
          
          const updatedConversation = {
            ...selectedConversation,
            messages: [...(selectedConversation.messages || []), ...newMessages],
          };
          setSelectedConversation(updatedConversation);
          
        }
        // No need to invalidate conversations - we're updating state directly
      },
      onError: (error: any) => {
        showMessage('Failed to send message. Please try again.', 'error');
        console.error('Error sending message:', error);
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
        // Handle the new response format from start conversation
        const newConversation: Conversation = {
          id: response.conversation_id,
          title: `Medical consultation - ${new Date().toLocaleDateString()}`,
          chief_complaint: variables.chiefComplaint,
          status: 'active',
          started_at: new Date().toISOString(),
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
        
        setSelectedConversation(newConversation);
        setStartDialogOpen(false);
        // Only invalidate conversations list when a new conversation is created
        queryClient.invalidateQueries('conversations');
        showMessage('New consultation started', 'success');
      },
      onError: (error: any) => {
        showMessage('Failed to start conversation. Please try again.', 'error');
        console.error('Error starting conversation:', error);
      },
    }
  );

  // Title update mutation
  const updateTitleMutation = useMutation(
    async ({ conversationId, title }: { conversationId: number; title: string }) => {
      const { chatAPI } = await import('../services/api');
      return chatAPI.updateConversationTitle(conversationId, title);
    },
    {
      onSuccess: (response: any, variables) => {
        // Update selected conversation if it's the one being edited
        if (selectedConversation?.id === variables.conversationId) {
          setSelectedConversation(prev => 
            prev ? { ...prev, title: variables.title } : null
          );
        }
        
        setEditingConversationId(null);
        setEditingTitle('');
        // Optimistic update - only invalidate conversations when necessary
        queryClient.setQueryData('conversations', (oldData: any) => {
          if (!oldData) return oldData;
          return oldData.map((conv: any) => 
            conv.id === variables.conversationId 
              ? { ...conv, title: variables.title }
              : conv
          );
        });
        showMessage('Title updated successfully', 'success');
      },
      onError: () => {
        showMessage('Failed to update title', 'error');
      },
    }
  );

  const sendMessage = (messageText: string) => {
    if (!selectedConversation || !messageText.trim()) return;

    sendMessageMutation.mutate({
      conversationId: selectedConversation.id,
      message: messageText.trim(),
    });
  };

  const handleSendMessage = () => {
    if (!message.trim()) return;
    sendMessage(message);
    setMessage('');
  };

  const handleQuickReply = (replyMessage: string) => {
    sendMessage(replyMessage);
  };

  // Auto-select first conversation if none selected
  useEffect(() => {
    if (!selectedConversation && conversations.length > 0) {
      setSelectedConversation(conversations[0]);
    }
  }, [conversations, selectedConversation]);

  // Memoize filtered conversations to prevent re-renders
  const memoizedConversations = useMemo(() => conversations, [conversations]);

  const handleStartConversation = (chiefComplaint: string) => {
    startConversationMutation.mutate({ chiefComplaint });
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const handleStartEditTitle = (conversation: Conversation) => {
    setEditingConversationId(conversation.id);
    setEditingTitle(conversation.title || conversation.chief_complaint || 'Consultation');
  };

  const handleSaveTitle = () => {
    if (editingConversationId && editingTitle.trim()) {
      updateTitleMutation.mutate({
        conversationId: editingConversationId,
        title: editingTitle.trim(),
      });
    }
  };

  const handleCancelEdit = () => {
    setEditingConversationId(null);
    setEditingTitle('');
  };

  if (conversationsLoading && conversations.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3, height: 'calc(100vh - 140px)' }}>
      <Box sx={{ mb: 2 }}>
        <Paper sx={{ p: 1.5, bgcolor: 'warning.light', borderRadius: 2 }}>
          <Typography variant="caption" color="warning.dark" textAlign="center" display="block">
            ⚠️ <strong>Medical Disclaimer:</strong> This is an AI assistant for informational purposes only. Always consult with healthcare professionals for medical advice.
          </Typography>
        </Paper>
      </Box>

      <Box display="flex" height="100%" gap={2}>
        {/* Collapsible Conversations Sidebar */}
        <Box
          sx={{
            display: 'flex',
            transition: 'all 0.3s ease-in-out',
            position: 'relative',
          }}
        >
          {/* Sidebar Content */}
          <Collapse
            in={!sidebarCollapsed}
            orientation="horizontal"
            timeout={300}
            sx={{
              '& .MuiCollapse-wrapper': {
                width: sidebarCollapsed ? 0 : 300,
              },
            }}
          >
            <Paper
              sx={{
                width: 300,
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                bgcolor: 'background.paper',
                height: '100%',
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
                {memoizedConversations.length === 0 ? (
                  <Box textAlign="center" py={4}>
                    <Typography variant="body2" color="text.secondary">
                      No consultations yet.
                      <br />
                      Start your first consultation!
                    </Typography>
                  </Box>
                ) : (
                  memoizedConversations.map((conv) => (
                    <Paper
                      key={conv.id}
                      sx={{
                        p: 2,
                        mb: 1,
                        cursor: editingConversationId === conv.id ? 'default' : 'pointer',
                        bgcolor:
                          selectedConversation?.id === conv.id
                            ? 'primary.light'
                            : 'background.default',
                        '&:hover': {
                          bgcolor: editingConversationId === conv.id ? (
                            selectedConversation?.id === conv.id ? 'primary.light' : 'background.default'
                          ) : 'primary.light',
                        },
                        transition: 'background-color 0.2s',
                      }}
                      onClick={() => editingConversationId !== conv.id && setSelectedConversation(conv)}
                    >
                      <Box display="flex" alignItems="center" justifyContent="space-between">
                        {editingConversationId === conv.id ? (
                          <Box display="flex" alignItems="center" gap={1} width="100%">
                            <TextField
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              variant="outlined"
                              size="small"
                              fullWidth
                              autoFocus
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveTitle();
                                } else if (e.key === 'Escape') {
                                  handleCancelEdit();
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              sx={{ fontSize: '0.875rem' }}
                            />
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveTitle();
                              }}
                              disabled={updateTitleMutation.isLoading}
                              color="primary"
                            >
                              <CheckIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCancelEdit();
                              }}
                              disabled={updateTitleMutation.isLoading}
                            >
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        ) : (
                          <>
                            <Box flexGrow={1}>
                              <Typography variant="subtitle2" noWrap>
                                {conv.title || conv.chief_complaint || 'Consultation'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {new Date(conv.started_at).toLocaleDateString()}
                              </Typography>
                            </Box>
                            <Tooltip title="Edit title">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEditTitle(conv);
                                }}
                                sx={{
                                  opacity: 0.6,
                                  '&:hover': {
                                    opacity: 1,
                                  },
                                }}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </Box>
                    </Paper>
                  ))
                )}
              </Box>
            </Paper>
          </Collapse>

          {/* Toggle Button */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              position: 'absolute',
              right: -20,
              top: '50%',
              transform: 'translateY(-50%)',
              zIndex: 1000,
            }}
          >
            <Tooltip title={sidebarCollapsed ? 'Show Consultations' : 'Hide Consultations'}>
              <IconButton
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                sx={{
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  '&:hover': {
                    bgcolor: 'primary.light',
                  },
                  transition: 'all 0.2s',
                  boxShadow: 2,
                }}
                size="small"
              >
                {sidebarCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
              </IconButton>
            </Tooltip>
          </Box>

          {/* Mini Sidebar when collapsed */}
          {sidebarCollapsed && (
            <Paper
              sx={{
                width: 60,
                p: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                bgcolor: 'background.paper',
                height: '100%',
                transition: 'all 0.3s ease-in-out',
              }}
            >
              <Tooltip title="New Consultation" placement="right">
                <IconButton
                  onClick={() => setStartDialogOpen(true)}
                  disabled={startConversationMutation.isLoading}
                  sx={{
                    mb: 2,
                    bgcolor: 'primary.main',
                    color: 'white',
                    '&:hover': {
                      bgcolor: 'primary.dark',
                    },
                  }}
                  size="small"
                >
                  <AddIcon />
                </IconButton>
              </Tooltip>

              <Box sx={{ flexGrow: 1, overflowY: 'auto', width: '100%' }}>
                {memoizedConversations.map((conv, index) => (
                  <Tooltip
                    key={conv.id}
                    title={conv.title || conv.chief_complaint || 'Consultation'}
                    placement="right"
                  >
                    <IconButton
                      onClick={() => setSelectedConversation(conv)}
                      sx={{
                        width: '100%',
                        height: 40,
                        mb: 0.5,
                        bgcolor:
                          selectedConversation?.id === conv.id
                            ? 'primary.light'
                            : 'transparent',
                        '&:hover': {
                          bgcolor: 'primary.light',
                        },
                        borderRadius: 1,
                      }}
                      size="small"
                    >
                      <ChatIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                ))}
              </Box>
            </Paper>
          )}
        </Box>

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
                onQuickReply={handleQuickReply}
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
                    variant="outlined"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        '&:hover fieldset': {
                          borderColor: 'primary.main',
                        },
                        '&.Mui-focused fieldset': {
                          borderColor: 'primary.main',
                        },
                      },
                    }}
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