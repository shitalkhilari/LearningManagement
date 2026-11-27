import {
  Alert, Button, List, ListItem, ListItemText, Stack, TextField, Typography,
} from '@mui/material';
import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../api/client';
import { Course, CourseModule, Quiz } from '../types';

export function CourseBuilderPage() {
  const { courseId = '' } = useParams();
  const [course, setCourse] = useState<Course | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [moduleForm, setModuleForm] = useState({ title: '', description: '' });
  const [lessonForm, setLessonForm] = useState({ moduleId: '', title: '', description: '', content: '' });
  const [quizForm, setQuizForm] = useState({ title: '', description: '', passingPercentage: '70', questionText: '', correct: '', wrong: '' });

  async function load() {
    const [courseResponse, quizResponse] = await Promise.all([
      client.get(`/courses/${courseId}`),
      client.get(`/courses/${courseId}/quizzes`),
    ]);
    setCourse(courseResponse.data);
    setQuizzes(quizResponse.data);
  }

  useEffect(() => {
    load().catch((err) => setError(err.displayMessage || 'Could not load the course'));
  }, [courseId]);

  async function run(action: () => Promise<void>, success: string) {
    setError('');
    try {
      await action();
      setMessage(success);
      await load();
    } catch (err) {
      setError((err as { displayMessage?: string }).displayMessage || 'Request failed');
    }
  }

  async function addModule(event: FormEvent) {
    event.preventDefault();
    await run(() => client.post(`/courses/${courseId}/modules`, moduleForm).then(() => undefined), 'Module added');
  }

  async function addLesson(event: FormEvent) {
    event.preventDefault();
    await run(() => client.post(`/modules/${lessonForm.moduleId}/lessons`, {
      title: lessonForm.title,
      description: lessonForm.description,
      content: lessonForm.content,
    }).then(() => undefined), 'Lesson added');
  }

  async function addQuiz(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const { data } = await client.post(`/courses/${courseId}/quizzes`, {
        title: quizForm.title,
        description: quizForm.description,
        passingPercentage: Number(quizForm.passingPercentage),
      });
      await client.post(`/quizzes/${data.id}/questions`, {
        questionText: quizForm.questionText,
        options: [
          { optionText: quizForm.correct, isCorrect: true },
          { optionText: quizForm.wrong, isCorrect: false },
        ],
      });
    }, 'Quiz created');
  }

  if (!course) return <Typography>Loading course...</Typography>;

  return (
    <Stack spacing={3}>
      <Typography variant="h4">{course.title}</Typography>
      <Typography>Status: {course.status}</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="success">{message}</Alert>}
      <Stack direction="row" spacing={2}>
        <Button variant="contained" onClick={() => run(() => client.post(`/courses/${courseId}/publish`).then(() => undefined), 'Published')}>Publish</Button>
        <Button onClick={() => run(() => client.post(`/courses/${courseId}/unpublish`).then(() => undefined), 'Moved to draft')}>Unpublish</Button>
        <Button color="error" onClick={() => run(() => client.delete(`/courses/${courseId}`).then(() => undefined), 'Deleted')}>Delete</Button>
      </Stack>

      {(course.modules || []).map((module: CourseModule) => (
        <div key={module.id}>
          <Typography variant="h6">{module.sequence}. {module.title}</Typography>
          <List>
            {(module.lessons || []).map((lesson) => (
              <ListItem key={lesson.id} secondaryAction={
                <Button color="error" onClick={() => run(() => client.delete(`/lessons/${lesson.id}`).then(() => undefined), 'Lesson deleted')}>Delete</Button>
              }>
                <ListItemText primary={lesson.title} secondary={lesson.description} />
              </ListItem>
            ))}
          </List>
        </div>
      ))}

      <Stack component="form" spacing={2} onSubmit={addModule}>
        <Typography variant="h6">Add module</Typography>
        <TextField label="Title" value={moduleForm.title} onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })} required />
        <TextField label="Description" value={moduleForm.description} onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })} required />
        <Button type="submit" variant="contained">Add module</Button>
      </Stack>

      <Stack component="form" spacing={2} onSubmit={addLesson}>
        <Typography variant="h6">Add lesson</Typography>
        <TextField label="Module id" value={lessonForm.moduleId} onChange={(e) => setLessonForm({ ...lessonForm, moduleId: e.target.value })} required />
        <TextField label="Title" value={lessonForm.title} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} required />
        <TextField label="Description" value={lessonForm.description} onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })} required />
        <TextField label="Content" multiline minRows={3} value={lessonForm.content} onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })} required />
        <Button type="submit" variant="contained">Add lesson</Button>
      </Stack>

      <Stack component="form" spacing={2} onSubmit={addQuiz}>
        <Typography variant="h6">Add quiz with one question</Typography>
        <TextField label="Title" value={quizForm.title} onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })} required />
        <TextField label="Description" value={quizForm.description} onChange={(e) => setQuizForm({ ...quizForm, description: e.target.value })} required />
        <TextField label="Passing percentage" type="number" value={quizForm.passingPercentage} onChange={(e) => setQuizForm({ ...quizForm, passingPercentage: e.target.value })} required />
        <TextField label="Question" value={quizForm.questionText} onChange={(e) => setQuizForm({ ...quizForm, questionText: e.target.value })} required />
        <TextField label="Correct option" value={quizForm.correct} onChange={(e) => setQuizForm({ ...quizForm, correct: e.target.value })} required />
        <TextField label="Incorrect option" value={quizForm.wrong} onChange={(e) => setQuizForm({ ...quizForm, wrong: e.target.value })} required />
        <Button type="submit" variant="contained">Add quiz</Button>
      </Stack>

      <div>
        <Typography variant="h6">Quizzes</Typography>
        {quizzes.map((quiz) => (
          <Typography key={quiz.id}>{quiz.title} — pass at {quiz.passingPercentage}% — {quiz.questions?.length || 0} questions</Typography>
        ))}
      </div>
    </Stack>
  );
}
