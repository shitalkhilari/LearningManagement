import { Alert, Button, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useActionLock } from '../hooks/useActionLock';
import { AuthUser } from '../types';

export function CourseCreatePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'ADMIN';
  const listPath = isAdmin ? '/admin/courses' : '/instructor/courses';
  const [instructors, setInstructors] = useState<AuthUser[]>([]);
  const [error, setError] = useState('');
  const { busy, run } = useActionLock();
  const [form, setForm] = useState({ title: '', description: '', thumbnail: '', instructorId: '' });

  useEffect(() => {
    if (!isAdmin) return;
    client.get('/users', { params: { role: 'INSTRUCTOR', limit: 100 } })
      .then(({ data }) => setInstructors(data.data))
      .catch(() => setInstructors([]));
  }, [isAdmin]);

  async function createCourse(event: FormEvent) {
    event.preventDefault();
    const payload: Record<string, string> = {
      title: form.title,
      description: form.description,
    };
    if (form.thumbnail.trim()) payload.thumbnail = form.thumbnail.trim();
    if (isAdmin) payload.instructorId = form.instructorId;
    await run(async () => {
      setError('');
      try {
        await client.post('/courses', payload);
        navigate(listPath, { state: { message: 'Draft course created' } });
      } catch (err) {
        setError((err as { displayMessage?: string }).displayMessage || 'Could not create course');
      }
    });
  }

  return (
    <Stack component="form" spacing={2} sx={{ maxWidth: 640 }} onSubmit={createCourse}>
      <Typography variant="h4">Create draft</Typography>
      <Typography color="text.secondary">The course stays unpublished until you publish it from Manage.</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
      <TextField label="Description" multiline minRows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
      <TextField label="Thumbnail URL" value={form.thumbnail} onChange={(e) => setForm({ ...form, thumbnail: e.target.value })} />
      {isAdmin && (
        <TextField
          select
          label="Instructor"
          value={form.instructorId}
          onChange={(e) => setForm({ ...form, instructorId: e.target.value })}
          required
          helperText="Choose the instructor who will own this course."
        >
          {instructors.length === 0 && <MenuItem value="" disabled>No instructors yet</MenuItem>}
          {instructors.map((instructor) => (
            <MenuItem key={instructor.id} value={instructor.id}>
              {instructor.firstName} {instructor.lastName} ({instructor.email})
            </MenuItem>
          ))}
        </TextField>
      )}
      <Stack direction="row" spacing={1}>
        <Button type="submit" variant="contained" disabled={busy}>{busy ? 'Creating...' : 'Create draft'}</Button>
        <Button component={Link} to={listPath}>Back to courses</Button>
      </Stack>
    </Stack>
  );
}
