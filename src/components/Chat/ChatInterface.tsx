import React, { useEffect, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  Avatar,
  CircularProgress,
  Chip,
  Divider,
} from '@mui/material';
import {
  Person as PersonIcon,
  SmartToy as BotIcon,
  MedicalServices as MedicalIcon,
} from '@mui/icons-material';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';

import { Conversation, Message } from '../../services/api';

interface ChatInterfaceProps {
  conversation: Conversation;
  isLoading?: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ conversation, isLoading }) => {
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
    const prevMessage = index > 0 ? conversation.messages[index - 1] : null;
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
        {conversation.messages.length === 0 ? (
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
            {conversation.messages.map(renderMessage)}
            
            {/* Loading indicator */}
            {isLoading && (
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
                    }}
                  >
                    <CircularProgress size={16} />
                    <Typography variant="body2" color="text.secondary">
                      Analyzing your message...
                    </Typography>
                  </Paper>
                </Box>
              </Box>
            )}
          </>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </Box>

      {/* Disclaimer */}
      <Divider />
      <Box p={1} bgcolor="warning.light">
        <Typography variant="caption" color="text.secondary" textAlign="center" display="block">
          ⚠️ This is an AI assistant for informational purposes only. Always consult with healthcare professionals for medical advice.
        </Typography>
      </Box>
    </Paper>
  );
};

export default ChatInterface; 