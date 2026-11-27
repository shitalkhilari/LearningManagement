import { Alert, Card, CardContent, Grid, LinearProgress, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { ProgressReport } from '../types';

export function ProgressPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<ProgressReport[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    client.get(`/reports/learners/${user.id}/progress`)
      .then((response) => setReports(response.data))
      .catch((err) => setError(err.displayMessage || 'Could not load progress'));
  }, [user]);

  if (error) return <Alert severity="error">{error}</Alert>;

  const completed = reports.filter((report) => report.enrollmentStatus === 'COMPLETED').length;
  const average = reports.length
    ? Math.round((reports.reduce((sum, report) => sum + report.completionPercentage, 0) / reports.length) * 100) / 100
    : 0;

  return (
    <Stack spacing={2}>
      <Typography variant="h4">Progress</Typography>
      <Typography color="text.secondary">
        Completion for each enrolled course. Open My learning when you want to continue a lesson.
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} sm={4}>
          <Card><CardContent><Typography color="text.secondary">Enrolled courses</Typography><Typography variant="h4">{reports.length}</Typography></CardContent></Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card><CardContent><Typography color="text.secondary">Completed</Typography><Typography variant="h4">{completed}</Typography></CardContent></Card>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Card><CardContent><Typography color="text.secondary">Average completion</Typography><Typography variant="h4">{average}%</Typography></CardContent></Card>
        </Grid>
      </Grid>
      {reports.length === 0 && <Alert severity="info">You have not enrolled in a course yet.</Alert>}
      {reports.map((report) => (
        <Card key={report.enrollmentId}>
          <CardContent>
            <Typography variant="h6">{report.course.title}</Typography>
            <Typography color="text.secondary" sx={{ mb: 1 }}>
              {report.enrollmentStatus} · Enrolled {new Date(report.enrolledAt).toLocaleDateString()}
            </Typography>
            <Typography sx={{ mb: 1 }}>
              {report.completedLessons} of {report.totalLessons} lessons complete · {report.pendingLessons} lessons pending
              {report.totalQuizzes > 0 ? ` · ${report.passedQuizzes} of ${report.totalQuizzes} quizzes passed` : ''}
              {' '}· {report.completionPercentage}%
            </Typography>
            <LinearProgress variant="determinate" value={report.completionPercentage} />
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
