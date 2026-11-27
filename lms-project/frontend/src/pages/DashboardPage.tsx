import { Alert, Card, CardContent, CircularProgress, Grid, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../auth/AuthContext';

export function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    client.get('/reports/overview')
      .then((response) => setData(response.data))
      .catch((err) => setError(err.displayMessage || 'Could not load the dashboard'));
  }, []);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <CircularProgress />;

  const labels: Record<string, string> = {
    totalUsers: 'Total users',
    totalLearners: 'Learners',
    totalInstructors: 'Instructors',
    totalAdmins: 'Admins',
    totalCourses: 'Courses',
    publishedCourses: 'Published courses',
    draftCourses: 'Draft courses',
    totalEnrollments: 'Enrollments',
    coursesCreated: 'Courses created',
    enrolledCourses: 'Enrolled courses',
    completedCourses: 'Completed courses',
    averageCompletion: 'Average completion %',
  };

  return (
    <>
      <Typography variant="h4" gutterBottom>{user?.role} dashboard</Typography>
      <Grid container spacing={2}>
        {Object.entries(data).map(([key, value]) => (
          <Grid item xs={12} sm={6} md={4} key={key}>
            <Card>
              <CardContent>
                <Typography color="text.secondary">{labels[key] || key}</Typography>
                <Typography variant="h4">{value}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </>
  );
}
