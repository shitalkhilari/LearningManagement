import { Alert, Button, Card, CardContent, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import client from '../api/client';
import { Course } from '../types';

export function CourseDetailPage() {
  const { courseId = '' } = useParams();
  const [course, setCourse] = useState<Course | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    client.get(`/courses/${courseId}`)
      .then((response) => setCourse(response.data))
      .catch((err) => setError(err.displayMessage || 'Could not load the course'));
  }, [courseId]);

  async function enroll() {
    try {
      await client.post('/enrollments', { courseId });
      setMessage('You are enrolled. Open the learning screen to start.');
    } catch (err) {
      setError((err as { displayMessage?: string }).displayMessage || 'Could not enroll');
    }
  }

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!course) return <Typography>Loading course...</Typography>;

  return (
    <Card>
      <CardContent>
        <Typography variant="h4">{course.title}</Typography>
        <Typography sx={{ my: 2 }}>{course.description}</Typography>
        <Typography>Instructor: {course.instructor ? `${course.instructor.firstName} ${course.instructor.lastName}` : course.instructorId}</Typography>
        <Typography sx={{ mt: 1 }}>Modules: {course.modules?.length || 0}</Typography>
        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
          <Button variant="contained" onClick={enroll}>Enroll</Button>
          <Button component={Link} to={`/learner/learning/${course.id}`}>Open learning screen</Button>
        </Stack>
        {message && <Alert severity="success" sx={{ mt: 2 }}>{message}</Alert>}
      </CardContent>
    </Card>
  );
}
