import { Alert, Button, Card, CardContent, LinearProgress, List, ListItemButton, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import client from '../api/client';
import { Course, Enrollment, Lesson, ProgressReport, Quiz } from '../types';

export function LearningPage() {
  const { courseId = '' } = useParams();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [progress, setProgress] = useState<ProgressReport | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [error, setError] = useState('');

  async function load() {
    const { data: mine } = await client.get('/enrollments/me');
    const current = (mine as Enrollment[]).find((item) => item.courseId === courseId) || null;
    setEnrollment(current);
    if (!current) return;
    const [courseResponse, progressResponse, quizResponse] = await Promise.all([
      client.get(`/courses/${courseId}`),
      client.get(`/progress/enrollments/${current.id}`),
      client.get(`/courses/${courseId}/quizzes`),
    ]);
    setCourse(courseResponse.data);
    setProgress(progressResponse.data);
    setQuizzes(quizResponse.data);
  }

  useEffect(() => {
    load().catch((err) => setError(err.displayMessage || 'Could not open this course'));
  }, [courseId]);

  async function openLesson(lessonId: string) {
    const { data } = await client.get(`/lessons/${lessonId}`);
    setLesson(data);
  }

  async function complete() {
    if (!lesson) return;
    const { data } = await client.post(`/progress/lessons/${lesson.id}/complete`);
    setProgress(data);
  }

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!enrollment) return <Alert severity="info">Enroll in this published course before opening lessons.</Alert>;
  if (!course || !progress) return <Typography>Loading learning screen...</Typography>;

  return (
    <Stack spacing={2}>
      <Typography variant="h4">{course.title}</Typography>
      <Typography>{progress.completedLessons} of {progress.totalLessons} lessons complete ({progress.completionPercentage}%)</Typography>
      <LinearProgress variant="determinate" value={progress.completionPercentage} />
      <Typography>Status: {progress.enrollmentStatus}. Pending lessons: {progress.pendingLessons}</Typography>
      {(course.modules || []).map((module) => (
        <div key={module.id}>
          <Typography variant="h6">{module.title}</Typography>
          <List>
            {(module.lessons || []).map((item) => (
              <ListItemButton key={item.id} onClick={() => openLesson(item.id)}>{item.title}</ListItemButton>
            ))}
          </List>
        </div>
      ))}
      {lesson && (
        <Card>
          <CardContent>
            <Typography variant="h5">{lesson.title}</Typography>
            <Typography sx={{ my: 1 }}>{lesson.content}</Typography>
            <Button variant="contained" onClick={complete}>Mark lesson completed</Button>
          </CardContent>
        </Card>
      )}
      <Typography variant="h6">Quizzes</Typography>
      {quizzes.map((quiz) => (
        <Button key={quiz.id} component={Link} to={`/learner/quizzes/${quiz.id}`}>{quiz.title}</Button>
      ))}
    </Stack>
  );
}
