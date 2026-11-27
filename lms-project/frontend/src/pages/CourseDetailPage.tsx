import { Alert, Box, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import client from '../api/client';
import { useActionLock } from '../hooks/useActionLock';
import { Course, Enrollment, Quiz } from '../types';

export function CourseDetailPage() {
  const { courseId = '' } = useParams();
  const [course, setCourse] = useState<Course | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [enrolled, setEnrolled] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const { busy, run } = useActionLock();

  async function loadQuizzes() {
    try {
      const { data } = await client.get(`/courses/${courseId}/quizzes`);
      setQuizzes(data);
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      if (status === 403) {
        setQuizzes([]);
        return;
      }
      throw err;
    }
  }

  useEffect(() => {
    Promise.all([
      client.get(`/courses/${courseId}`),
      client.get('/enrollments/me'),
    ])
      .then(async ([courseResponse, enrollmentResponse]) => {
        setCourse(courseResponse.data);
        const mine = enrollmentResponse.data as Enrollment[];
        const isEnrolled = mine.some((row) => row.courseId === courseId);
        setEnrolled(isEnrolled);
        if (isEnrolled) await loadQuizzes();
      })
      .catch((err) => setError(err.displayMessage || 'Could not load the course'));
  }, [courseId]);

  async function enroll() {
    await run(async () => {
      setError('');
      try {
        await client.post('/enrollments', { courseId });
        setEnrolled(true);
        await loadQuizzes();
        setMessage('You are enrolled. Open the learning screen to start.');
      } catch (err) {
        setError((err as { displayMessage?: string }).displayMessage || 'Could not enroll');
      }
    });
  }

  if (error && !course) return <Alert severity="error">{error}</Alert>;
  if (!course) return <Typography>Loading course...</Typography>;

  const modules = [...(course.modules || [])].sort((a, b) => a.sequence - b.sequence);

  return (
    <Card>
      <CardContent>
        <Typography variant="h4">{course.title}</Typography>
        <Typography sx={{ my: 2 }}>{course.description}</Typography>
        <Typography>Instructor: {course.instructor ? `${course.instructor.firstName} ${course.instructor.lastName}` : course.instructorId}</Typography>
        <Typography sx={{ mt: 2, mb: 1, fontWeight: 700 }}>Modules</Typography>
        {modules.length === 0 && (
          <Typography color="text.secondary">This course has no modules yet.</Typography>
        )}
        <Stack spacing={2}>
          {modules.map((module) => {
            const lessons = [...(module.lessons || [])].sort((a, b) => a.sequence - b.sequence);
            const moduleQuizzes = quizzes.filter((quiz) => quiz.moduleId === module.id);
            return (
              <Box key={module.id}>
                <Typography sx={{ fontWeight: 700 }}>{module.sequence}. {module.title}</Typography>
                {module.description && (
                  <Typography color="text.secondary" sx={{ mb: 0.5 }}>{module.description}</Typography>
                )}
                {lessons.map((lesson) => (
                  <Typography key={lesson.id} sx={{ pl: 2 }}>{lesson.sequence}. {lesson.title}</Typography>
                ))}
                {moduleQuizzes.map((quiz) => (
                  <Typography key={quiz.id} sx={{ pl: 2 }}>Quiz: {quiz.title}</Typography>
                ))}
                {lessons.length === 0 && moduleQuizzes.length === 0 && (
                  <Typography color="text.secondary" sx={{ pl: 2 }}>No lessons in this module yet.</Typography>
                )}
              </Box>
            );
          })}
        </Stack>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 2 }}>
          {enrolled ? <Chip label="Enrolled" color="primary" /> : <Button variant="contained" disabled={busy} onClick={enroll}>Enroll</Button>}
          {enrolled && <Button variant="contained" component={Link} to={`/learner/learning/${course.id}`}>Continue learning</Button>}
        </Stack>
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {message && <Alert severity="success" sx={{ mt: 2 }}>{message}</Alert>}
      </CardContent>
    </Card>
  );
}
