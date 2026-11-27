import { Alert, Button, Card, CardActions, CardContent, Grid, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { Enrollment } from '../types';

export function MyLearningPage() {
  const [rows, setRows] = useState<Enrollment[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    client.get('/enrollments/me')
      .then((response) => setRows(response.data))
      .catch((err) => setError(err.displayMessage || 'Could not load your courses'));
  }, []);

  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <>
      <Typography variant="h4" gutterBottom>My learning</Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Courses you are enrolled in. Open one to read lessons and take quizzes.
      </Typography>
      {rows.length === 0 && (
        <Alert severity="info" action={<Button color="inherit" component={Link} to="/learner/courses">Browse courses</Button>}>
          You have not enrolled in a course yet.
        </Alert>
      )}
      <Grid container spacing={2}>
        {rows.map((row) => (
          <Grid item xs={12} md={6} key={row.id}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h6">{row.course?.title || 'Course'}</Typography>
                <Typography color="text.secondary" sx={{ mb: 1 }}>{row.status}</Typography>
                <Typography>{row.course?.description}</Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Enrolled {new Date(row.enrolledAt).toLocaleDateString()}
                  {row.course?.instructor ? ` · ${row.course.instructor.firstName} ${row.course.instructor.lastName}` : ''}
                </Typography>
              </CardContent>
              <CardActions>
                <Button component={Link} to={`/learner/learning/${row.courseId}`} variant="contained">Continue</Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </>
  );
}
