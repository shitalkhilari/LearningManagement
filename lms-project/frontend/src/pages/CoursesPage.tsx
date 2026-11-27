import {
  Alert, Button, Card, CardActions, CardContent, CardMedia, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, Grid, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useActionLock } from '../hooks/useActionLock';
import { AuthUser, Course, Enrollment } from '../types';

interface CourseForm {
  title: string;
  description: string;
  thumbnail: string;
  instructorId: string;
}

const emptyForm: CourseForm = { title: '', description: '', thumbnail: '', instructorId: '' };

function coursePayload(form: CourseForm, includeInstructor: boolean) {
  const payload: Record<string, string> = {
    title: form.title,
    description: form.description,
  };
  if (form.thumbnail.trim()) payload.thumbnail = form.thumbnail.trim();
  if (includeInstructor) payload.instructorId = form.instructorId;
  return payload;
}

export function CoursesPage() {
  const { user } = useAuth();
  const location = useLocation();
  const notice = (location.state as { message?: string } | null)?.message || '';
  const [courses, setCourses] = useState<Course[]>([]);
  const [coursesLoaded, setCoursesLoaded] = useState(false);
  const [instructors, setInstructors] = useState<AuthUser[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<Course | null>(null);
  const [editForm, setEditForm] = useState<CourseForm>(emptyForm);
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [enrollmentsLoaded, setEnrollmentsLoaded] = useState(user?.role !== 'LEARNER');
  const { busy, run } = useActionLock();
  const canManage = user?.role === 'ADMIN' || user?.role === 'INSTRUCTOR';
  const isAdmin = user?.role === 'ADMIN';

  async function load() {
    const params = user?.role === 'INSTRUCTOR' ? { instructorId: user.id, limit: 100 } : { limit: 100 };
    const { data } = await client.get('/courses', { params });
    setCourses(data.data);
  }

  useEffect(() => {
    setCoursesLoaded(false);
    load()
      .catch((err) => setError(err.displayMessage || 'Could not load courses'))
      .finally(() => setCoursesLoaded(true));
  }, [user]);

  useEffect(() => {
    if (user?.role !== 'LEARNER') {
      setEnrollmentsLoaded(true);
      return;
    }
    setEnrollmentsLoaded(false);
    client.get('/enrollments/me')
      .then(({ data }) => setEnrolledIds(new Set((data as Enrollment[]).map((row) => row.courseId))))
      .catch(() => setEnrolledIds(new Set()))
      .finally(() => setEnrollmentsLoaded(true));
  }, [user]);

  useEffect(() => {
    if (!isAdmin) return;
    client.get('/users', { params: { role: 'INSTRUCTOR', limit: 100 } })
      .then(({ data }) => setInstructors(data.data))
      .catch(() => setInstructors([]));
  }, [isAdmin]);

  function openEdit(course: Course) {
    setError('');
    setMessage('');
    setEditing(course);
    setEditForm({
      title: course.title,
      description: course.description,
      thumbnail: course.thumbnail || '',
      instructorId: course.instructorId,
    });
  }

  async function saveCourse(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const courseId = editing.id;
    await run(async () => {
      setError('');
      try {
        await client.patch(`/courses/${courseId}`, coursePayload(editForm, isAdmin));
        setMessage('Course updated');
        setEditing(null);
        await load();
      } catch (err) {
        setError((err as { displayMessage?: string }).displayMessage || 'Could not update course');
      }
    });
  }

  async function enroll(courseId: string) {
    await run(async () => {
      setError('');
      try {
        await client.post('/enrollments', { courseId });
        setEnrolledIds((current) => new Set(current).add(courseId));
        setMessage('Enrolled');
      } catch (err) {
        setError((err as { displayMessage?: string }).displayMessage || 'Could not enroll');
      }
    });
  }

  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h4">{user?.role === 'LEARNER' ? 'Published courses' : 'Courses'}</Typography>
        {canManage && (
          <Button component={Link} to={isAdmin ? '/admin/courses/new' : '/instructor/courses/new'} variant="contained">
            Create draft
          </Button>
        )}
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {(message || notice) && <Alert severity="success" sx={{ mb: 2 }}>{message || notice}</Alert>}
      {!coursesLoaded && <Typography color="text.secondary">Loading courses...</Typography>}
      {coursesLoaded && courses.length === 0 && <Typography color="text.secondary">No courses yet.</Typography>}
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
                {user?.role === 'LEARNER' && enrollmentsLoaded && enrolledIds.has(course.id) && <Chip label="Enrolled" color="primary" size="small" />}
                {user?.role === 'LEARNER' && enrollmentsLoaded && enrolledIds.has(course.id) && (
                  <Button component={Link} to={`/learner/learning/${course.id}`}>Continue</Button>
                )}
                {user?.role === 'LEARNER' && enrollmentsLoaded && !enrolledIds.has(course.id) && <Button disabled={busy} onClick={() => enroll(course.id)}>Enroll</Button>}
                {canManage && <Button onClick={() => openEdit(course)}>Edit</Button>}
                {canManage && <Button component={Link} to={`/courses/${course.id}/builder`}>Manage</Button>}
                {user?.role === 'LEARNER' && <Button component={Link} to={`/learner/courses/${course.id}`}>Details</Button>}
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} fullWidth>
        <DialogTitle>Edit course</DialogTitle>
        <DialogContent>
          <Stack component="form" id="edit-course" spacing={2} sx={{ mt: 1 }} onSubmit={saveCourse}>
            <TextField label="Title" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} required />
            <TextField label="Description" multiline minRows={3} value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} required />
            <TextField label="Thumbnail URL" value={editForm.thumbnail} onChange={(e) => setEditForm({ ...editForm, thumbnail: e.target.value })} helperText="Leave blank to keep the current image." />
            {isAdmin && (
              <TextField select label="Instructor" value={editForm.instructorId} onChange={(e) => setEditForm({ ...editForm, instructorId: e.target.value })} required>
                {instructors.map((instructor) => (
                  <MenuItem key={instructor.id} value={instructor.id}>
                    {instructor.firstName} {instructor.lastName} ({instructor.email})
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button type="submit" form="edit-course" variant="contained" disabled={busy}>Save changes</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
