import React, { useState, useEffect } from 'react';
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
  const [demoConversations, setDemoConversations] = useState<Conversation[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [editingConversationId, setEditingConversationId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const queryClient = useQueryClient();
  const { showMessage } = useSnackbar();

  // Initialize demo conversations for development
  useEffect(() => {
    const initDemoData = () => {
      const demoConvs: Conversation[] = [
        {
          id: 1,
          title: "Headache Consultation",
          chief_complaint: "Persistent headache for 3 days", 
          status: "active",
          started_at: new Date().toISOString(),
          messages: [
            {
              id: 1,
              content: "I've been having a persistent headache for 3 days",
              message_type: 'user' as const,
              created_at: new Date(Date.now() - 60000).toISOString(),
            },
            {
              id: 2,
              content: "Hello! I understand you're experiencing headache pain. I'm here to help you describe your symptoms in detail so we can create a comprehensive report for your healthcare provider.\n\nLet me ask a few questions to better understand your situation:\n\n• When did your headache start?\n• How would you rate the pain intensity on a scale of 1-10?\n• Can you describe the type of pain (throbbing, sharp, dull, pressure)?\n• What makes it better or worse?\n\nPlease remember, I'm not a doctor and cannot provide medical diagnoses. My role is to help organize your symptoms for your healthcare provider.",
              message_type: 'assistant' as const,
              created_at: new Date().toISOString(),
            }
          ]
        }
      ];
      setDemoConversations(demoConvs);
      setSelectedConversation(demoConvs[0]);
    };

    initDemoData();
  }, []);

  // Fetch conversations - using test data for development
  const {
    data: conversations = demoConversations,
    isLoading: conversationsLoading,
  } = useQuery('conversations', () => Promise.resolve(demoConversations), {
    enabled: demoConversations.length > 0
  });

  // Demo message sending for development
  const sendMessageMutation = useMutation(
    ({ conversationId, message }: { conversationId: number; message: string }) => {
      // Simulate API call with demo response
      return new Promise<any>((resolve) => {
        setTimeout(() => {
          resolve({
            user_message: {
              id: Date.now(),
              content: message,
              created_at: new Date().toISOString(),
            },
            ai_message: {
              id: Date.now() + 1,
              content: generateDemoResponse(message),
              created_at: new Date().toISOString(),
            }
          });
        }, 1000);
      });
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
            messages: [...selectedConversation.messages, ...newMessages],
          };
          setSelectedConversation(updatedConversation);
          
          // Update the demo conversations
          setDemoConversations(prev => 
            prev.map(conv => 
              conv.id === selectedConversation.id ? updatedConversation : conv
            )
          );
        }
        queryClient.invalidateQueries('conversations');
      },
      onError: (error: any) => {
        showMessage('Demo mode: Message sent successfully!', 'success');
      },
    }
  );

  // Demo conversation creation
  const startConversationMutation = useMutation(
    ({ chiefComplaint }: { chiefComplaint: string }) => {
      return new Promise<any>((resolve) => {
        setTimeout(() => {
          resolve({
            conversation_id: Date.now(),
            user_message: {
              id: Date.now(),
              content: chiefComplaint,
              created_at: new Date().toISOString(),
            },
            ai_message: {
              id: Date.now() + 1,
              content: generateWelcomeResponse(chiefComplaint),
              created_at: new Date().toISOString(),
            }
          });
        }, 1000);
      });
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
        
        setDemoConversations(prev => [newConversation, ...prev]);
        setSelectedConversation(newConversation);
        setStartDialogOpen(false);
        queryClient.invalidateQueries('conversations');
        showMessage('New consultation started', 'success');
      },
      onError: (error: any) => {
        showMessage('Demo mode: Conversation started!', 'success');
      },
    }
  );

  // Title update mutation for demo mode
  const updateTitleMutation = useMutation(
    ({ conversationId, title }: { conversationId: number; title: string }) => {
      // For demo mode, just update local state
      return new Promise<any>((resolve) => {
        setTimeout(() => {
          resolve({ status: 'success', new_title: title });
        }, 500);
      });
    },
    {
      onSuccess: (response: any, variables) => {
        // Update the demo conversations
        setDemoConversations(prev => 
          prev.map(conv => 
            conv.id === variables.conversationId 
              ? { ...conv, title: variables.title }
              : conv
          )
        );
        
        // Update selected conversation if it's the one being edited
        if (selectedConversation?.id === variables.conversationId) {
          setSelectedConversation(prev => 
            prev ? { ...prev, title: variables.title } : null
          );
        }
        
        setEditingConversationId(null);
        setEditingTitle('');
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
      {/* Demo Mode Banner & Disclaimer */}
      <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Paper sx={{ p: 2, bgcolor: 'info.light', borderRadius: 2 }}>
          <Typography variant="body2" color="info.dark" textAlign="center">
            🚀 <strong>Demo Mode:</strong> You're experiencing the enhanced chat interface in development mode. All conversations are simulated.
          </Typography>
        </Paper>
        
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
                {conversations.map((conv, index) => (
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

// Demo response generators
function generateDemoResponse(userMessage: string): string {
  const message = userMessage.toLowerCase();
  
  if (message.includes('started') || message.includes('ago') || message.includes('yesterday')) {
    return "Thank you for that timeline information. That's very helpful. Now, could you describe the severity or intensity of your symptoms? How would you rate them on a scale of 1-10?";
  }
  
  if (message.match(/\b[1-9]|10\b/) || message.includes('mild') || message.includes('severe')) {
    return "Thank you for rating your symptoms. That helps me understand the severity. Are there any specific triggers or activities that make your symptoms better or worse?";
  }
  
  if (message.includes('better') || message.includes('worse') || message.includes('rest') || message.includes('movement')) {
    return "That's important information about what affects your symptoms. Are you currently taking any medications or treatments for these symptoms? Also, have you noticed any other symptoms occurring along with your main concern?";
  }
  
  if (message.includes('medication') || message.includes('ibuprofen') || message.includes('acetaminophen')) {
    return "Thank you for sharing that medication information. It's important to include current treatments in your medical record. Is there anything else about your symptoms that you think would be important for your healthcare provider to know?";
  }
  
  if (message.includes('no') || message.includes('none')) {
    return "I understand. Let's explore other aspects of your symptoms. Are there any other symptoms or concerns you'd like to discuss?";
  }
  
  if (message.includes('yes') || message.includes('also')) {
    return "Thank you for providing that additional information. Could you tell me more about these other symptoms? When did they start and how severe are they?";
  }
  
  // Default response
  return "Thank you for sharing that information. To help create a complete picture for your healthcare provider, could you tell me more about when these symptoms started and how you would rate their severity on a scale of 1-10?";
}

function generateWelcomeResponse(chiefComplaint: string): string {
  const complaint = chiefComplaint.toLowerCase();
  
  if (complaint.includes('headache') || complaint.includes('head')) {
    return "Hello! I understand you're experiencing headache pain. I'm here to help you describe your symptoms in detail so we can create a comprehensive report for your healthcare provider.\n\nLet me ask a few questions to better understand your situation:\n\n• When did your headache start?\n• How would you rate the pain intensity on a scale of 1-10?\n• Can you describe the type of pain (throbbing, sharp, dull, pressure)?\n• What makes it better or worse?\n\nPlease remember, I'm not a doctor and cannot provide medical diagnoses. My role is to help organize your symptoms for your healthcare provider.";
  }
  
  if (complaint.includes('back') || complaint.includes('spine')) {
    return "Hello! I see you're experiencing back pain. I'm here to help gather detailed information about your symptoms for your healthcare provider.\n\nTo better understand your back pain, could you tell me:\n\n• Where exactly is the pain located (lower back, upper back, between shoulder blades)?\n• When did it start and what were you doing when it began?\n• How would you rate the pain on a scale of 1-10?\n• Does the pain radiate to other areas (legs, arms, etc.)?\n\nI'll help you organize this information into a clear report, but please remember that I cannot provide medical diagnoses.";
  }
  
  if (complaint.includes('fever') || complaint.includes('temperature')) {
    return "Hello! I understand you're dealing with fever symptoms. I'm here to help document your symptoms for your healthcare provider.\n\nLet's gather some important details:\n\n• What is your current temperature if you've measured it?\n• When did the fever start?\n• Are you experiencing any other symptoms along with the fever (headache, body aches, nausea)?\n• Have you taken any medications for the fever?\n\nPlease note: If your fever is very high (over 103°F/39.4°C) or you're having difficulty breathing, please seek immediate medical attention.";
  }
  
  return `Hello! I'm your medical assistant and I'm here to help you describe your symptoms and gather information for your healthcare provider.\n\nI see you mentioned: "${chiefComplaint}"\n\nPlease note that I'm not a doctor and cannot provide medical diagnoses. My role is to help you organize your symptoms into a clear, comprehensive report that you can share with your healthcare provider.\n\nCould you tell me more about:\n• When did these symptoms start?\n• How severe are they on a scale of 1-10?\n• What makes them better or worse?\n• Any other symptoms you're experiencing?\n\nLet's work together to document everything properly.`;
}

export default ChatPage; 