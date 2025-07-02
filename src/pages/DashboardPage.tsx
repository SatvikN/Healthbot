import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Paper,
  Card,
  CardContent,
  Button,
  Avatar,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  MedicalServices as MedicalIcon,
  Chat as ChatIcon,
  Assessment as ReportsIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  TrendingUp as TrendingIcon,
  LocalHospital as HospitalIcon,
  Favorite as HeartIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { chatAPI, symptomsAPI, reportsAPI } from '../services/api';

interface DashboardData {
  healthStats: {
    totalConsultations: number;
    activeSymptoms: number;
    completedReports: number;
    lastActivity: string;
  };
  recentActivity: any[];
  currentSymptoms: any[];
}

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUsingRealAPI, setIsUsingRealAPI] = useState(false);

  // Helper functions
  const formatTimeAgo = useCallback((dateString: string): string => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return date.toLocaleDateString();
  }, []);

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch data from real API endpoints
      const [conversations, symptoms, reports] = await Promise.all([
        chatAPI.getConversations().catch(() => []),
        symptomsAPI.getSymptoms().catch(() => []),
        reportsAPI.getReports().catch(() => []),
      ]);

      console.log('🚀 Real API Data:', { conversations, symptoms, reports });

      // Process the data
      const activeSymptoms = symptoms.filter((s: any) => 
        new Date(s.onset_date).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000 // Last 7 days
      );

      const recentActivity = [
        ...conversations.slice(0, 3).map((conv: any) => ({
          id: `conv-${conv.id}`,
          type: 'consultation',
          title: conv.title || conv.chief_complaint || 'Medical consultation',
          timestamp: formatTimeAgo(conv.started_at || conv.created_at),
          status: conv.status,
          urgency: conv.status === 'active' ? 'high' : 'medium',
        })),
        ...symptoms.slice(0, 2).map((symptom: any) => ({
          id: `symptom-${symptom.id}`,
          type: 'symptom',
          title: `Recorded ${symptom.name}`,
          timestamp: formatTimeAgo(symptom.recorded_at || symptom.onset_date),
          status: 'active',
          urgency: symptom.severity >= 7 ? 'high' : symptom.severity >= 4 ? 'medium' : 'low',
        })),
        ...reports.slice(0, 2).map((report: any) => ({
          id: `report-${report.id}`,
          type: 'report',
          title: report.title,
          timestamp: formatTimeAgo(report.generated_at || report.created_at),
          status: report.status,
          urgency: report.urgency_level || 'low',
        }))
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 5);

      const dashboardData: DashboardData = {
        healthStats: {
          totalConsultations: conversations.length,
          activeSymptoms: activeSymptoms.length,
          completedReports: reports.filter((r: any) => r.status === 'completed').length,
          lastActivity: recentActivity.length > 0 ? recentActivity[0].timestamp : 'No recent activity',
        },
        recentActivity,
        currentSymptoms: activeSymptoms.slice(0, 5),
      };

      setDashboardData(dashboardData);
      setIsUsingRealAPI(true);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError('Failed to load dashboard data from API. Please check your connection and try again.');
      setIsUsingRealAPI(false);
      setDashboardData(null);
    } finally {
      setLoading(false);
    }
  }, [formatTimeAgo]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'error' as const;
      case 'medium': return 'warning' as const;
      case 'low': return 'success' as const;
      default: return 'default' as const;
    }
  };

  const getSeverityColor = (severity: number) => {
    if (severity >= 7) return 'error' as const;
    if (severity >= 4) return 'warning' as const;
    return 'success' as const;
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

  if (!dashboardData) {
    return (
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <Alert severity="error" action={
          <Button color="inherit" size="small" onClick={loadDashboardData}>
            Retry
          </Button>
        }>
          Failed to load dashboard data
        </Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* Header */}
      <Box mb={4} display="flex" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h4" gutterBottom>
            Health Dashboard
          </Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="body1" color="text.secondary">
              Welcome back! Here's your health overview and recent activity.
            </Typography>
            <Chip 
              label={isUsingRealAPI ? "Live API" : "Mock Data"} 
              color={isUsingRealAPI ? "success" : "warning"}
              size="small"
              variant="outlined"
            />
          </Box>
        </Box>
        <Tooltip title="Refresh data">
          <IconButton onClick={loadDashboardData} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {error && (
        <Alert severity="warning" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Health Stats Cards */}
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                  <ChatIcon />
                </Avatar>
                <Box>
                  <Typography variant="h4">{dashboardData.healthStats.totalConsultations}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Consultations
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <Avatar sx={{ bgcolor: 'warning.main', mr: 2 }}>
                  <WarningIcon />
                </Avatar>
                <Box>
                  <Typography variant="h4">{dashboardData.healthStats.activeSymptoms}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Active Symptoms
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <Avatar sx={{ bgcolor: 'success.main', mr: 2 }}>
                  <ReportsIcon />
                </Avatar>
                <Box>
                  <Typography variant="h4">{dashboardData.healthStats.completedReports}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Medical Reports
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <Avatar sx={{ bgcolor: 'info.main', mr: 2 }}>
                  <HospitalIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6">{dashboardData.healthStats.lastActivity}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Last Activity
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Current Symptoms */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Box display="flex" alignItems="center" mb={2}>
              <HeartIcon color="error" sx={{ mr: 1 }} />
              <Typography variant="h6">Current Symptoms</Typography>
            </Box>
            {dashboardData.currentSymptoms.length > 0 ? (
              <List>
                {dashboardData.currentSymptoms.map((symptom: any, index: number) => (
                  <React.Fragment key={symptom.id}>
                    <ListItem>
                      <ListItemIcon>
                        <MedicalIcon color={getSeverityColor(symptom.severity)} />
                      </ListItemIcon>
                      <ListItemText
                        primary={symptom.name}
                        secondary={
                          <Box>
                            <Typography variant="caption" color="text.secondary">
                              {symptom.category} • Severity: {symptom.severity}/10
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={(symptom.severity / 10) * 100}
                              color={getSeverityColor(symptom.severity)}
                              sx={{ mt: 1 }}
                            />
                          </Box>
                        }
                      />
                    </ListItem>
                    {index < dashboardData.currentSymptoms.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            ) : (
              <Box textAlign="center" py={3}>
                <CheckIcon color="success" sx={{ fontSize: 48, mb: 1 }} />
                <Typography variant="body1" color="text.secondary">
                  No active symptoms recorded
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  You're doing great! Keep monitoring your health.
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Box display="flex" alignItems="center" mb={2}>
              <TrendingIcon color="primary" sx={{ mr: 1 }} />
              <Typography variant="h6">Recent Activity</Typography>
            </Box>
            <List>
              {dashboardData.recentActivity.map((activity: any, index: number) => (
                <React.Fragment key={activity.id}>
                  <ListItem>
                    <ListItemIcon>
                      {activity.type === 'consultation' && <ChatIcon />}
                      {activity.type === 'symptom' && <MedicalIcon />}
                      {activity.type === 'report' && <ReportsIcon />}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          <Typography variant="body1">{activity.title}</Typography>
                          <Chip
                            size="small"
                            label={activity.urgency}
                            color={getUrgencyColor(activity.urgency)}
                            variant="outlined"
                          />
                        </Box>
                      }
                      secondary={activity.timestamp}
                    />
                  </ListItem>
                  {index < dashboardData.recentActivity.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
            <Box textAlign="center" mt={2}>
              <Button 
                variant="outlined" 
                onClick={() => navigate('/chat')}
              >
                View Chat History
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default DashboardPage; 