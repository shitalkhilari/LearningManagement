import {
  Alert, Button, Card, CardActions, CardContent, CardMedia, Grid, Stack, TextField, Typography,
} from '@mui/material';
import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { Course } from '../types';

export function CoursesPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ title: '', description: '', thumbnail: '', instructorId: '' });
  const canManage = user?.role === 'ADMIN' || user?.role === 'INSTRUCTOR';

  async function load() {
    const params = user?.role === 'INSTRUCTOR' ? { instructorId: user.id, limit: 50 } : { limit: 50 };
    const { data } = await client.get('/courses', { params });
    setCourses(data.data);
  }

  useEffect(() => {
    load().catch((err) => setError(err.displayMessage || 'Could not load courses'));
  }, [user]);

  async function createCourse(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const payload: Record<string, string> = { title: form.title, description: form.description };
      if (form.thumbnail) payload.thumbnail = form.thumbnail;
      if (user?.role === 'ADMIN') payload.instructorId = form.instructorId;
      await client.post('/courses', payload);
      setMessage('Draft course created');
      setForm({ title: '', description: '', thumbnail: '', instructorId: '' });
      await load();
    } catch (err) {
      setError((err as { displayMessage?: string }).displayMessage || 'Could not create course');
    }
  }

  async function enroll(courseId: string) {
    setError('');
    try {
      await client.post('/enrollments', { courseId });
      setMessage('Enrolled');
    } catch (err) {
      setError((err as { displayMessage?: string }).displayMessage || 'Could not enroll');
    }
  }

  return (
    <>
      <Typography variant="h4" gutterBottom>{user?.role === 'LEARNER' ? 'Published courses' : 'Courses'}</Typography>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      {canManage && (
        <Stack component="form" spacing={2} sx={{ mb: 3, maxWidth: 640 }} onSubmit={createCourse}>
          <Typography variant="h6">New course</Typography>
          <TextField label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <TextField label="Description" multiline minRows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
          <TextField label="Thumbnail URL" value={form.thumbnail} onChange={(e) => setForm({ ...form, thumbnail: e.target.value })} />
          {user?.role === 'ADMIN' && (
            <TextField label="Instructor id" value={form.instructorId} onChange={(e) => setForm({ ...form, instructorId: e.target.value })} required />
          )}
          <Button type="submit" variant="contained">Create draft</Button>
        </Stack>
      )}
      <Grid container spacing={2}>
        {courses.map((course) => (
          <Grid item xs={12} md={4} key={course.id}>
            <Card>
              {course.thumbnail && <CardMedia component="img" height="140" image={course.thumbnail} alt="" />}
              <CardContent>
                <Typography variant="h6">{course.title}</Typography>
                <Typography color="text.secondary" sx={{ mb: 1 }}>{course.status}</Typography>
                <Typography>{course.description}</Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Instructor: {course.instructor ? `${course.instructor.firstName} ${course.instructor.lastName}` : course.instructorId}
                </Typography>
              </CardContent>
              <CardActions>
                {user?.role === 'LEARNER' && <Button onClick={() => enroll(course.id)}>Enroll</Button>}
                {canManage && <Button component={Link} to={`/courses/${course.id}/builder`}>Manage</Button>}
                {user?.role === 'LEARNER' && <Button component={Link} to={`/learner/courses/${course.id}`}>Details</Button>}
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </>
  );
}
