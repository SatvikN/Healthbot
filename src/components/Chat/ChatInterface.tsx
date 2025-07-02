import React, { useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Avatar,
  CircularProgress,
  Chip,
  Button,
  Fade,
} from '@mui/material';
import {
  Person as PersonIcon,
  SmartToy as BotIcon,
  MedicalServices as MedicalIcon,
  QuestionAnswer as QuestionIcon,
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';

import { Conversation, Message } from '../../services/api';

interface ChatInterfaceProps {
  conversation: Conversation;
  isLoading?: boolean;
  onQuickReply?: (message: string) => void;
}

// Quick reply suggestions based on conversation context
const getQuickReplySuggestions = (lastMessage?: Message): string[] => {
  if (!lastMessage || lastMessage.message_type === 'user') return [];
  
  const content = lastMessage.content.toLowerCase();
  
  if (content.includes('when did') || content.includes('timeline')) {
    return ['Started yesterday', 'Started a few days ago', 'Started last week', 'About a month ago'];
  }
  
  if (content.includes('scale of 1-10') || content.includes('severity')) {
    return ['Mild (2-3)', 'Moderate (4-6)', 'Severe (7-8)', 'Very severe (9-10)'];
  }
  
  if (content.includes('better or worse') || content.includes('triggers')) {
    return ['Rest helps', 'Movement helps', 'Medication helps', 'Gets worse with activity'];
  }
  
  if (content.includes('other symptoms') || content.includes('additional')) {
    return ['No other symptoms', 'Yes, also have fever', 'Yes, also nauseous', 'Yes, feeling tired'];
  }
  
  if (content.includes('medications') || content.includes('treatment')) {
    return ['Taking ibuprofen', 'Taking acetaminophen', 'No medications', 'Prescription medications'];
  }
  
  return ['Yes', 'No', 'Sometimes', 'Not sure'];
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({ conversation, isLoading, onQuickReply }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation.messages]);

  const formatTime = (dateString: string) => {
    return format(new Date(dateString), 'HH:mm');
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy');
  };

  const renderMessage = (message: Message, index: number) => {
    const isUser = message.message_type === 'user';
    const prevMessage = index > 0 && conversation.messages ? conversation.messages[index - 1] : null;
    const showDateDivider = !prevMessage || 
      formatDate(message.created_at) !== formatDate(prevMessage.created_at);

    return (
      <React.Fragment key={message.id}>
        {/* Date divider */}
        {showDateDivider && (
          <Box display="flex" justifyContent="center" my={2}>
            <Chip
              label={formatDate(message.created_at)}
              size="small"
              variant="outlined"
              sx={{ bgcolor: 'background.paper' }}
            />
          </Box>
        )}

        {/* Message */}
        <Box
          display="flex"
          justifyContent={isUser ? 'flex-end' : 'flex-start'}
          mb={1}
          mx={1}
        >
          <Box
            display="flex"
            alignItems="flex-start"
            maxWidth="70%"
            flexDirection={isUser ? 'row-reverse' : 'row'}
            gap={1}
          >
            {/* Avatar */}
            <Avatar
              sx={{
                width: 32,
                height: 32,
                bgcolor: isUser ? 'primary.main' : 'secondary.main',
              }}
            >
              {isUser ? <PersonIcon fontSize="small" /> : <BotIcon fontSize="small" />}
            </Avatar>

            {/* Message content */}
            <Paper
              sx={{
                p: 2,
                bgcolor: isUser ? 'primary.light' : 'background.paper',
                color: isUser ? 'primary.contrastText' : 'text.primary',
                borderRadius: 2,
                maxWidth: '100%',
                wordBreak: 'break-word',
              }}
            >
              <Box>
                {isUser ? (
                  <Typography variant="body1">{message.content}</Typography>
                ) : (
                  <Box>
                    <ReactMarkdown
                      components={{
                        p: ({ children }) => (
                          <Typography variant="body1" component="span">
                            {children}
                          </Typography>
                        ),
                        strong: ({ children }) => (
                          <Typography component="strong" fontWeight="bold">
                            {children}
                          </Typography>
                        ),
                        ul: ({ children }) => (
                          <Box component="ul" sx={{ mt: 1, mb: 1, pl: 2 }}>
                            {children}
                          </Box>
                        ),
                        li: ({ children }) => (
                          <Typography component="li" variant="body2">
                            {children}
                          </Typography>
                        ),
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>

                    {/* Show metadata if available */}
                    {message.metadata && (
                      <Box mt={1}>
                        {message.metadata.symptoms_detected && (
                          <Box mt={1}>
                            <Typography variant="caption" color="text.secondary">
                              Symptoms detected:
                            </Typography>
                            <Box display="flex" flexWrap="wrap" gap={0.5} mt={0.5}>
                              {message.metadata.symptoms_detected.map((symptom: string, idx: number) => (
                                <Chip
                                  key={idx}
                                  label={symptom}
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                />
                              ))}
                            </Box>
                          </Box>
                        )}

                        {message.metadata.urgency_level && (
                          <Box mt={1} display="flex" alignItems="center" gap={1}>
                            <MedicalIcon fontSize="small" color="warning" />
                            <Typography variant="caption" color="warning.main">
                              Urgency: {message.metadata.urgency_level}
                            </Typography>
                          </Box>
                        )}
                      </Box>
                    )}
                  </Box>
                )}
              </Box>

              {/* Timestamp */}
              <Typography
                variant="caption"
                color={isUser ? 'primary.contrastText' : 'text.secondary'}
                sx={{ opacity: 0.7, mt: 0.5, display: 'block' }}
              >
                {formatTime(message.created_at)}
              </Typography>
            </Paper>
          </Box>
        </Box>
      </React.Fragment>
    );
  };

  return (
    <Paper
      sx={{
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'grey.50',
        position: 'relative',
      }}
    >
      {/* Messages container */}
      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          p: 1,
          minHeight: 400,
          maxHeight: 'calc(100vh - 400px)',
        }}
      >
        {!conversation.messages || conversation.messages.length === 0 ? (
          <Box
            display="flex"
            flexDirection="column"
            justifyContent="center"
            alignItems="center"
            height="100%"
            textAlign="center"
            p={4}
          >
            <BotIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" mb={1}>
              Hello! I'm your medical assistant.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Please describe your symptoms and I'll help gather information for your healthcare provider.
            </Typography>
          </Box>
        ) : (
          <>
            {conversation.messages?.map(renderMessage)}
            
            {/* Loading indicator */}
            {isLoading && (
              <Fade in={true}>
                <Box display="flex" justifyContent="flex-start" mb={1} mx={1}>
                  <Box display="flex" alignItems="flex-start" gap={1}>
                    <Avatar
                      sx={{
                        width: 32,
                        height: 32,
                        bgcolor: 'secondary.main',
                      }}
                    >
                      <BotIcon fontSize="small" />
                    </Avatar>
                    <Paper
                      sx={{
                        p: 2,
                        bgcolor: 'background.paper',
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <CircularProgress size={16} />
                      <Typography variant="body2" color="text.secondary">
                        Analyzing your message...
                      </Typography>
                    </Paper>
                  </Box>
                </Box>
              </Fade>
            )}

            {/* Quick Reply Suggestions */}
            {!isLoading && (() => {
              const lastMessage = conversation.messages && conversation.messages.length > 0 
                ? conversation.messages[conversation.messages.length - 1] 
                : undefined;
              const quickReplies = getQuickReplySuggestions(lastMessage);
              
              return quickReplies.length > 0 && lastMessage?.message_type === 'assistant' && onQuickReply ? (
                <Fade in={true} timeout={500}>
                  <Box mx={1} mb={2}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <QuestionIcon fontSize="small" color="action" />
                      <Typography variant="caption" color="text.secondary">
                        Quick replies:
                      </Typography>
                    </Box>
                    <Box display="flex" flexWrap="wrap" gap={1}>
                      {quickReplies.map((reply, idx) => (
                        <Button
                          key={idx}
                          variant="outlined"
                          size="small"
                          onClick={() => onQuickReply(reply)}
                          sx={{
                            borderRadius: 2,
                            textTransform: 'none',
                            minHeight: 32,
                            fontSize: '0.875rem',
                            '&:hover': {
                              bgcolor: 'primary.light',
                              borderColor: 'primary.main',
                            },
                          }}
                        >
                          {reply}
                        </Button>
                      ))}
                    </Box>
                  </Box>
                </Fade>
              ) : null;
            })()}
          </>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </Box>
    </Paper>
  );
};

export default ChatInterface; 