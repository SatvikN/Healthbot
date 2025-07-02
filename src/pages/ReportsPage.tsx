import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Container,
  Grid,
  TextField,
  Button,
  IconButton,
  Chip,
  Card,
  CardContent,
  CardActions,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Avatar,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon,
  Description as ReportIcon,
  DateRange as DateIcon,
  Chat as ChatIcon,
  Assessment as AssessmentIcon,
  MedicalServices as MedicalIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  Summarize as SummarizeIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useSnackbar } from '../contexts/SnackbarContext';
import { reportsAPI } from '../services/api';

interface MedicalReport {
  id: number;
  title: string;
  type: 'initial_consultation' | 'follow_up' | 'symptom_tracking' | 'summary_report';
  status: 'completed' | 'pending' | 'in_progress';
  createdAt: string;
  conversationId: number;
  conversationTitle: string;
  summary: string;
  urgencyLevel: 'low' | 'medium' | 'high';
  keyFindings: string[];
  recommendations: string[];
  fileSize?: string;
}

const ReportsPage: React.FC = () => {
  const { showMessage } = useSnackbar();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<MedicalReport | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);

  // Reports data - now fetched from backend
  const [reports, setReports] = useState<MedicalReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingSummary, setGeneratingSummary] = useState(false);

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<MedicalReport | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Load reports from backend
  const loadReports = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Try to fetch from real API first
      const backendReports = await reportsAPI.getReports({
        report_type: typeFilter === 'all' ? undefined : typeFilter,
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: 20,
        offset: 0
      });
      
      // Transform backend reports to frontend format
      const transformedReports: MedicalReport[] = backendReports.map(report => ({
        id: report.id,
        title: report.title,
        type: (report as any).report_type || 'initial_consultation',
        status: report.status as any,
        createdAt: (report as any).generated_at || new Date().toISOString(),
        conversationId: (report as any).conversation_id || 0,
        conversationTitle: `Conversation ${(report as any).conversation_id || 'Unknown'}`,
        summary: `Report generated with ${(report as any).symptom_count || 0} symptoms documented.`,
        urgencyLevel: (report as any).urgency_level || 'low',
        keyFindings: ['Report generated from conversation', 'Symptoms documented', 'Analysis completed'],
        recommendations: ['Review with healthcare provider', 'Follow up if needed', 'Monitor symptoms'],
        fileSize: '2.1 MB'
      }));
      
      setReports(transformedReports);
    } catch (err) {
      console.error('Failed to load reports from backend:', err);
      
      // Set empty reports if API fails
      setReports([]);
      setError('Failed to load reports from API. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  // Load reports on component mount and when filters change
  React.useEffect(() => {
    loadReports();
  }, [loadReports]);

  const filteredReports = reports.filter(report => {
    const matchesSearch = report.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         report.conversationTitle.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || report.status === statusFilter;
    const matchesType = typeFilter === 'all' || report.type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'warning';
      case 'pending': return 'error';
      default: return 'default';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'initial_consultation': return <MedicalIcon />;
      case 'follow_up': return <ScheduleIcon />;
      case 'symptom_tracking': return <AssessmentIcon />;
      case 'summary_report': return <SummarizeIcon />;
      default: return <ReportIcon />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'initial_consultation': return 'Initial Consultation';
      case 'follow_up': return 'Follow-up Report';
      case 'symptom_tracking': return 'Symptom Tracking';
      case 'summary_report': return 'Summary Report';
      default: return 'Medical Report';
    }
  };

  const handleViewReport = (report: MedicalReport) => {
    setSelectedReport(report);
    setDetailsDialogOpen(true);
  };

  const handleDownloadReport = (report: MedicalReport) => {
    showMessage(`Downloading ${report.title} (${report.fileSize})`, 'info');
  };

  const handleViewConversation = (conversationId: number) => {
    showMessage(`Opening conversation #${conversationId} in Chat section`, 'info');
  };

  const handleDeleteReport = (report: MedicalReport) => {
    setReportToDelete(report);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteReport = async () => {
    if (!reportToDelete) return;

    try {
      setDeleting(true);
      await reportsAPI.deleteReport(reportToDelete.id);
      showMessage(`Report "${reportToDelete.title}" has been deleted successfully`, 'success');
      
      // Remove the deleted report from the local state
      setReports(prevReports => prevReports.filter(report => report.id !== reportToDelete.id));
      
      setDeleteDialogOpen(false);
      setReportToDelete(null);
    } catch (error) {
      console.error('Error deleting report:', error);
      showMessage('Failed to delete report. Please try again.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const cancelDeleteReport = () => {
    setDeleteDialogOpen(false);
    setReportToDelete(null);
  };

  const handleGenerateSummaryReport = async () => {
    try {
      setGeneratingSummary(true);
      const result = await reportsAPI.generateSummaryReport();
      showMessage(`Summary report "${result.title}" generated successfully! Analyzed ${result.conversations_analyzed} conversations.`, 'success');
      loadReports(); // Refresh the reports list
    } catch (error) {
      console.error('Error generating summary report:', error);
      showMessage('Failed to generate summary report. Please try again.', 'error');
    } finally {
      setGeneratingSummary(false);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3 }}>
      {/* Status Banner */}
      {error ? (
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'error.light', borderRadius: 2 }}>
          <Typography variant="body2" color="error.dark" textAlign="center">
            ❌ <strong>Connection Error:</strong> {error}
          </Typography>
        </Paper>
      ) : (
        <Paper sx={{ p: 2, mb: 3, bgcolor: 'success.light', borderRadius: 2 }}>
          <Typography variant="body2" color="success.dark" textAlign="center">
            ✅ <strong>Connected:</strong> Loading reports from backend API.
          </Typography>
        </Paper>
      )}

      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Medical Reports
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Reports generated from your medical consultations
          </Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={2}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<SummarizeIcon />}
            onClick={handleGenerateSummaryReport}
            disabled={generatingSummary || loading}
            sx={{ minWidth: 200 }}
          >
            {generatingSummary ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                Generating...
              </>
            ) : (
              'Generate Summary Report'
            )}
          </Button>
          <Chip
            label={`${filteredReports.length} Report${filteredReports.length !== 1 ? 's' : ''}`}
            variant="outlined"
            color="primary"
          />
        </Box>
      </Box>

      {/* Search and Filters */}
      <Paper sx={{ p: 3, mb: 3, borderRadius: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              placeholder="Search reports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              }}
              variant="outlined"
              size="small"
            />
          </Grid>
          
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status"
              >
                <MenuItem value="all">All Status</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
                <MenuItem value="in_progress">In Progress</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                label="Type"
              >
                <MenuItem value="all">All Types</MenuItem>
                <MenuItem value="initial_consultation">Initial Consultation</MenuItem>
                <MenuItem value="follow_up">Follow-up Report</MenuItem>
                <MenuItem value="symptom_tracking">Symptom Tracking</MenuItem>
                <MenuItem value="summary_report">Summary Report</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={2}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<FilterIcon />}
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setTypeFilter('all');
              }}
            >
              Clear
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Reports List */}
      {loading ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 2 }}>
          <CircularProgress size={60} sx={{ mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            Loading Reports...
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Fetching your medical reports from the server
          </Typography>
        </Paper>
      ) : filteredReports.length === 0 ? (
        <Paper sx={{ p: 6, textAlign: 'center', borderRadius: 2 }}>
          <ReportIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No reports found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Try adjusting your search terms or filters
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {filteredReports.map((report) => (
            <Grid item xs={12} md={6} lg={4} key={report.id}>
              <Card 
                sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  flexDirection: 'column',
                  borderRadius: 2,
                  '&:hover': {
                    boxShadow: 3,
                  },
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={2}>
                    <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                      {getTypeIcon(report.type)}
                    </Avatar>
                    <Box display="flex" gap={1}>
                      <Chip
                        size="small"
                        label={report.status.replace('_', ' ')}
                        color={getStatusColor(report.status) as any}
                        variant="outlined"
                      />
                      <Chip
                        size="small"
                        label={report.urgencyLevel}
                        color={getUrgencyColor(report.urgencyLevel) as any}
                        variant="filled"
                      />
                    </Box>
                  </Box>
                  
                  <Typography variant="h6" gutterBottom noWrap>
                    {report.title}
                  </Typography>
                  
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    {getTypeLabel(report.type)}
                  </Typography>
                  
                  <Typography 
                    variant="body2" 
                    color="text.secondary" 
                    sx={{ 
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 3,
                      overflow: 'hidden',
                      mb: 2
                    }}
                  >
                    {report.summary}
                  </Typography>
                  
                  <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <DateIcon fontSize="small" color="action" />
                    <Typography variant="caption" color="text.secondary">
                      {new Date(report.createdAt).toLocaleDateString()} at{' '}
                      {new Date(report.createdAt).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </Typography>
                  </Box>
                  
                  <Box display="flex" alignItems="center" gap={1}>
                    <ChatIcon fontSize="small" color="action" />
                    <Typography 
                      variant="caption" 
                      color="primary"
                      sx={{ cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => handleViewConversation(report.conversationId)}
                    >
                      {report.conversationTitle}
                    </Typography>
                  </Box>
                </CardContent>
                
                <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                  <Button
                    size="small"
                    startIcon={<ViewIcon />}
                    onClick={() => handleViewReport(report)}
                  >
                    View Details
                  </Button>
                  <Box display="flex" gap={1}>
                    <IconButton
                      size="small"
                      onClick={() => handleDownloadReport(report)}
                      color="primary"
                      title="Download Report"
                    >
                      <DownloadIcon />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteReport(report)}
                      color="error"
                      title="Delete Report"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Report Details Dialog */}
      <Dialog 
        open={detailsDialogOpen} 
        onClose={() => setDetailsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedReport && (
          <>
            <DialogTitle>
              <Box display="flex" alignItems="center" gap={2}>
                <Avatar sx={{ bgcolor: 'primary.main' }}>
                  {getTypeIcon(selectedReport.type)}
                </Avatar>
                <Box>
                  <Typography variant="h6">{selectedReport.title}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {getTypeLabel(selectedReport.type)} • {selectedReport.fileSize}
                  </Typography>
                </Box>
              </Box>
            </DialogTitle>
            
            <DialogContent>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>Report Summary</Typography>
                  <Typography variant="body2" paragraph>
                    {selectedReport.summary}
                  </Typography>
                  
                  <Typography variant="subtitle2" gutterBottom>Status & Priority</Typography>
                  <Box display="flex" gap={1} mb={2}>
                    <Chip
                      size="small"
                      label={selectedReport.status.replace('_', ' ')}
                      color={getStatusColor(selectedReport.status) as any}
                      variant="outlined"
                    />
                    <Chip
                      size="small"
                      label={`${selectedReport.urgencyLevel} priority`}
                      color={getUrgencyColor(selectedReport.urgencyLevel) as any}
                      variant="filled"
                    />
                  </Box>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" gutterBottom>Key Findings</Typography>
                  <List dense>
                    {selectedReport.keyFindings.map((finding, index) => (
                      <ListItem key={index} sx={{ py: 0.5 }}>
                        <ListItemAvatar sx={{ minWidth: 32 }}>
                          <CheckCircleIcon fontSize="small" color="success" />
                        </ListItemAvatar>
                        <ListItemText 
                          primary={finding}
                          primaryTypographyProps={{ variant: 'body2' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Grid>
                
                <Grid item xs={12}>
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle2" gutterBottom>Recommendations</Typography>
                  <List dense>
                    {selectedReport.recommendations.map((recommendation, index) => (
                      <ListItem key={index} sx={{ py: 0.5 }}>
                        <ListItemAvatar sx={{ minWidth: 32 }}>
                          <MedicalIcon fontSize="small" color="primary" />
                        </ListItemAvatar>
                        <ListItemText 
                          primary={recommendation}
                          primaryTypographyProps={{ variant: 'body2' }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Grid>
              </Grid>
            </DialogContent>
            
            <DialogActions sx={{ p: 3 }}>
              <Button onClick={() => setDetailsDialogOpen(false)}>
                Close
              </Button>
              <Button 
                variant="outlined"
                startIcon={<ChatIcon />}
                onClick={() => handleViewConversation(selectedReport.conversationId)}
              >
                View Conversation
              </Button>
              <Button 
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={() => handleDownloadReport(selectedReport)}
              >
                Download Report
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={cancelDeleteReport}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={2}>
            <DeleteIcon color="error" />
            <Typography variant="h6">Delete Report</Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent>
          {reportToDelete && (
            <Box>
              <Typography variant="body1" gutterBottom>
                Are you sure you want to delete this report? This action cannot be undone.
              </Typography>
              
              <Paper sx={{ p: 2, mt: 2, bgcolor: 'grey.50' }}>
                <Typography variant="subtitle2" gutterBottom>
                  Report to be deleted:
                </Typography>
                <Typography variant="body2" fontWeight="bold">
                  {reportToDelete.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {getTypeLabel(reportToDelete.type)} • Created on {new Date(reportToDelete.createdAt).toLocaleDateString()}
                </Typography>
              </Paper>
              
              <Box sx={{ mt: 2, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
                <Typography variant="body2" color="error.dark">
                  ⚠️ <strong>Warning:</strong> This will permanently delete the report and all its associated data. You will not be able to recover it.
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ p: 3 }}>
          <Button 
            onClick={cancelDeleteReport}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button 
            variant="contained"
            color="error"
            onClick={confirmDeleteReport}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={20} /> : <DeleteIcon />}
          >
            {deleting ? 'Deleting...' : 'Delete Report'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ReportsPage; 