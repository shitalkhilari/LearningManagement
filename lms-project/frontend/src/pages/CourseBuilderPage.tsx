import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, Divider, MenuItem, Paper, Radio, Stack, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { useActionLock } from '../hooks/useActionLock';
import { AuthUser, Course, CourseModule, Lesson, Quiz, QuizQuestion } from '../types';

interface QuestionDraft {
  questionText: string;
  options: string[];
  correctIndex: number;
}

function blankQuestion(): QuestionDraft {
  return { questionText: '', options: ['', '', '', ''], correctIndex: 0 };
}

function draftFromQuestion(question: QuizQuestion): QuestionDraft {
  const source = question.options ?? [];
  const correctIndex = source.findIndex((option) => option.isCorrect);
  return {
    questionText: question.questionText,
    options: [0, 1, 2, 3].map((index) => source[index]?.optionText ?? ''),
    correctIndex: correctIndex >= 0 && correctIndex < 4 ? correctIndex : 0,
  };
}

const outlineAccordionSx = {
  border: 1,
  borderColor: 'divider',
  borderRadius: '10px !important',
  '&:before': { display: 'none' },
  overflow: 'hidden',
  '&.Mui-expanded': { margin: 0 },
};

function questionPayload(question: QuestionDraft) {
  return {
    questionText: question.questionText,
    options: question.options.map((optionText, index) => ({
      optionText,
      isCorrect: index === question.correctIndex,
    })),
  };
}

export function CourseBuilderPage() {
  const { user } = useAuth();
  const { courseId = '' } = useParams();
  const [course, setCourse] = useState<Course | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [instructors, setInstructors] = useState<AuthUser[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [details, setDetails] = useState({ title: '', description: '', thumbnail: '', instructorId: '' });
  const [moduleForm, setModuleForm] = useState({ title: '', description: '' });
  const [editingModule, setEditingModule] = useState<CourseModule | null>(null);
  const [lessonForm, setLessonForm] = useState({ moduleId: '', title: '', description: '', content: '', videoUrl: '' });
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [quizForm, setQuizForm] = useState({ moduleId: '', title: '', description: '', questions: [blankQuestion()] });
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [questionQuizId, setQuestionQuizId] = useState<string | null>(null);
  const [extraQuestion, setExtraQuestion] = useState<QuestionDraft>(blankQuestion());
  const [editingQuestion, setEditingQuestion] = useState<{ id: string; draft: QuestionDraft } | null>(null);
  const [openModuleId, setOpenModuleId] = useState<string | null>(null);
  const [openLessonId, setOpenLessonId] = useState<string | null>(null);
  const outlineStarted = useRef(false);
  const [tab, setTab] = useState('outline');
  const { busy, run: lockedRun } = useActionLock();
  const isAdmin = user?.role === 'ADMIN';

  async function load() {
    const [courseResponse, quizResponse] = await Promise.all([
      client.get(`/courses/${courseId}`),
      client.get(`/courses/${courseId}/quizzes`),
    ]);
    const next = courseResponse.data as Course;
    const modules = next.modules ?? [];
    setCourse(next);
    setQuizzes(quizResponse.data);
    if (!outlineStarted.current) {
      outlineStarted.current = true;
      setOpenModuleId(modules[0]?.id ?? null);
    } else {
      setOpenModuleId((current) => {
        if (!current) return current;
        return modules.some((module) => module.id === current) ? current : modules[0]?.id ?? null;
      });
    }
    setDetails({
      title: next.title,
      description: next.description,
      thumbnail: next.thumbnail || '',
      instructorId: next.instructorId,
    });
  }

  useEffect(() => {
    outlineStarted.current = false;
    setOpenModuleId(null);
    setOpenLessonId(null);
    load().catch((err) => setError(err.displayMessage || 'Could not load the course'));
  }, [courseId]);

  useEffect(() => {
    if (!isAdmin) return;
    client.get('/users', { params: { role: 'INSTRUCTOR', limit: 100 } })
      .then(({ data }) => setInstructors(data.data))
      .catch(() => setInstructors([]));
  }, [isAdmin]);

  async function run(action: () => Promise<void>, success: string) {
    await lockedRun(async () => {
      setError('');
      try {
        await action();
        setMessage(success);
        await load();
      } catch (err) {
        setError((err as { displayMessage?: string }).displayMessage || 'Request failed');
      }
    });
  }

  async function saveDetails(event: FormEvent) {
    event.preventDefault();
    const payload: Record<string, string> = {
      title: details.title,
      description: details.description,
    };
    if (details.thumbnail.trim()) payload.thumbnail = details.thumbnail.trim();
    if (isAdmin) payload.instructorId = details.instructorId;
    await run(() => client.patch(`/courses/${courseId}`, payload).then(() => undefined), 'Course updated');
  }

  async function addModule(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      await client.post(`/courses/${courseId}/modules`, moduleForm);
      setModuleForm({ title: '', description: '' });
      setTab('outline');
    }, 'Module added');
  }

  async function saveModule(event: FormEvent) {
    event.preventDefault();
    if (!editingModule) return;
    await run(async () => {
      await client.patch(`/modules/${editingModule.id}`, {
        title: editingModule.title,
        description: editingModule.description,
      });
      setEditingModule(null);
    }, 'Module updated');
  }

  async function addLesson(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      await client.post(`/modules/${lessonForm.moduleId}/lessons`, {
        title: lessonForm.title,
        description: lessonForm.description,
        content: lessonForm.content,
        videoUrl: lessonForm.videoUrl,
      });
      setLessonForm({ moduleId: '', title: '', description: '', content: '', videoUrl: '' });
      setTab('outline');
    }, 'Lesson added');
  }

  async function saveLesson(event: FormEvent) {
    event.preventDefault();
    if (!editingLesson) return;
    await run(async () => {
      await client.patch(`/lessons/${editingLesson.id}`, {
        title: editingLesson.title,
        description: editingLesson.description,
        content: editingLesson.content,
        videoUrl: editingLesson.videoUrl,
      });
      setEditingLesson(null);
    }, 'Lesson updated');
  }

  async function addQuiz(event: FormEvent) {
    event.preventDefault();
    if (quizForm.questions.length === 0) return;
    await run(async () => {
      const { data } = await client.post(`/courses/${courseId}/quizzes`, {
        title: quizForm.title,
        description: quizForm.description,
        moduleId: quizForm.moduleId,
      });
      for (const question of quizForm.questions) {
        await client.post(`/quizzes/${data.id}/questions`, questionPayload(question));
      }
      setQuizForm({ moduleId: '', title: '', description: '', questions: [blankQuestion()] });
      setTab('outline');
    }, 'Quiz created');
  }

  function beginAddQuestion(quizId: string) {
    setEditingQuestion(null);
    setQuestionQuizId(quizId);
    setExtraQuestion(blankQuestion());
  }

  function beginEditQuestion(question: QuizQuestion) {
    setQuestionQuizId(null);
    setEditingQuestion({ id: question.id, draft: draftFromQuestion(question) });
  }

  async function addQuestion(event: FormEvent) {
    event.preventDefault();
    if (!questionQuizId) return;
    await run(async () => {
      await client.post(`/quizzes/${questionQuizId}/questions`, questionPayload(extraQuestion));
      setQuestionQuizId(null);
      setExtraQuestion(blankQuestion());
    }, 'Question added');
  }

  async function saveQuestion(event: FormEvent) {
    event.preventDefault();
    if (!editingQuestion) return;
    await run(async () => {
      await client.patch(`/questions/${editingQuestion.id}`, questionPayload(editingQuestion.draft));
      setEditingQuestion(null);
    }, 'Question updated');
  }

  async function saveQuiz(event: FormEvent) {
    event.preventDefault();
    if (!editingQuiz?.moduleId) return;
    await run(async () => {
      await client.patch(`/quizzes/${editingQuiz.id}`, {
        title: editingQuiz.title,
        description: editingQuiz.description,
        moduleId: editingQuiz.moduleId,
      });
      setEditingQuiz(null);
    }, 'Quiz updated');
  }

  if (!course) return <Typography>Loading course...</Typography>;

  const published = course.status === 'PUBLISHED';
  const outlineModules = course.modules ?? [];

  function renderQuiz(quiz: Quiz) {
    if (editingQuiz?.id === quiz.id) {
      return (
        <Paper key={quiz.id} component="form" variant="outlined" sx={{ p: 2 }} onSubmit={saveQuiz}>
          <Stack spacing={1.5}>
          <TextField label="Quiz title" value={editingQuiz.title} onChange={(e) => setEditingQuiz({ ...editingQuiz, title: e.target.value })} required />
          <TextField label="Description" value={editingQuiz.description} onChange={(e) => setEditingQuiz({ ...editingQuiz, description: e.target.value })} required />
          <TextField
            select
            label="Module"
            value={editingQuiz.moduleId || ''}
            onChange={(e) => setEditingQuiz({ ...editingQuiz, moduleId: e.target.value })}
            required
            helperText="Learners see this quiz under the selected module."
          >
            {outlineModules.map((module) => (
              <MenuItem key={module.id} value={module.id}>{module.sequence}. {module.title}</MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={1}>
            <Button type="submit" variant="contained" disabled={busy || !editingQuiz.moduleId}>Save quiz</Button>
            <Button onClick={() => setEditingQuiz(null)}>Cancel</Button>
          </Stack>
          </Stack>
        </Paper>
      );
    }

    const questions = quiz.questions || [];
    return (
      <Paper key={quiz.id} variant="outlined" sx={{ p: 2 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ sm: 'flex-start' }}
          justifyContent="space-between"
        >
          <Typography sx={{ fontWeight: 700, minWidth: 0 }}>{quiz.title}</Typography>
          <Stack direction="row" spacing={0.5} flexShrink={0}>
            <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => setEditingQuiz({ ...quiz })}>Edit</Button>
            <Button size="small" onClick={() => beginAddQuestion(quiz.id)}>Add question</Button>
          </Stack>
        </Stack>
        {questions.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>No questions yet.</Typography>
        ) : (
          <Stack spacing={1} sx={{ mt: 1.5 }}>
            {questions.map((question, index) => (
              editingQuestion?.id === question.id ? (
                <Stack key={question.id} component="form" spacing={1.5} onSubmit={saveQuestion}>
                  <QuestionFields
                    question={editingQuestion.draft}
                    label={`Question ${index + 1}`}
                    onChange={(draft) => setEditingQuestion({ id: question.id, draft })}
                  />
                  <Stack direction="row" spacing={1}>
                    <Button type="submit" variant="contained" disabled={busy}>Save question</Button>
                    <Button onClick={() => setEditingQuestion(null)}>Cancel</Button>
                  </Stack>
                </Stack>
              ) : (
                <Stack key={question.id} direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                  <Typography variant="body2" sx={{ minWidth: 0 }}>
                    {index + 1}. {question.questionText}
                  </Typography>
                  <Stack direction="row" spacing={0.5} flexShrink={0}>
                    <Button size="small" onClick={() => beginEditQuestion(question)}>Edit</Button>
                    <Button
                      size="small"
                      color="error"
                      disabled={busy}
                      onClick={() => run(() => client.delete(`/questions/${question.id}`).then(() => undefined), 'Question deleted')}
                    >
                      Delete
                    </Button>
                  </Stack>
                </Stack>
              )
            ))}
          </Stack>
        )}
        {questionQuizId === quiz.id && (
          <Stack component="form" spacing={1.5} onSubmit={addQuestion} sx={{ mt: 2 }}>
            <QuestionFields question={extraQuestion} label="New question" onChange={setExtraQuestion} />
            <Stack direction="row" spacing={1}>
              <Button type="submit" variant="contained" disabled={busy}>Save question</Button>
              <Button onClick={() => setQuestionQuizId(null)}>Cancel</Button>
            </Stack>
          </Stack>
        )}
      </Paper>
    );
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h4">{course.title}</Typography>
      <Stack direction="row" spacing={1} alignItems="center">
        <Typography>Status:</Typography>
        <Chip
          label={published ? 'Published' : 'Unpublished'}
          color={published ? 'primary' : 'default'}
          variant={published ? 'filled' : 'outlined'}
          size="small"
        />
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="success">{message}</Alert>}
      <Stack direction="row" spacing={2}>
        <Button
          variant={published ? 'contained' : 'outlined'}
          disabled={busy}
          onClick={() => run(() => client.post(`/courses/${courseId}/publish`).then(() => undefined), 'Published')}
        >
          Publish
        </Button>
        <Button
          variant={published ? 'outlined' : 'contained'}
          disabled={busy}
          onClick={() => run(() => client.post(`/courses/${courseId}/unpublish`).then(() => undefined), 'Moved to draft')}
        >
          Unpublish
        </Button>
        <Button color="error" disabled={busy} onClick={() => run(() => client.delete(`/courses/${courseId}`).then(() => undefined), 'Deleted')}>Delete</Button>
      </Stack>

      <Tabs
        value={tab}
        onChange={(_, value) => setTab(value)}
        variant="scrollable"
        scrollButtons="auto"
        aria-label="Course builder sections"
      >
        <Tab value="outline" label={`Outline (${course.modules?.length || 0})`} />
        <Tab value="module" label="Add module" />
        <Tab value="lesson" label="Add lesson" />
        <Tab value="quizzes" label={`Quizzes (${quizzes.length})`} />
        <Tab value="details" label="Course details" />
      </Tabs>

      {tab === 'details' && (
        <Stack component="form" spacing={2} onSubmit={saveDetails} sx={{ maxWidth: 720 }}>
          <Typography variant="h6">Edit course</Typography>
          <TextField label="Title" value={details.title} onChange={(e) => setDetails({ ...details, title: e.target.value })} required />
          <TextField label="Description" multiline minRows={3} value={details.description} onChange={(e) => setDetails({ ...details, description: e.target.value })} required />
          <TextField label="Thumbnail URL" value={details.thumbnail} onChange={(e) => setDetails({ ...details, thumbnail: e.target.value })} helperText="Leave blank to keep the current image." />
          {isAdmin && (
            <TextField select label="Instructor" value={details.instructorId} onChange={(e) => setDetails({ ...details, instructorId: e.target.value })} required>
              {instructors.map((instructor) => (
                <MenuItem key={instructor.id} value={instructor.id}>
                  {instructor.firstName} {instructor.lastName} ({instructor.email})
                </MenuItem>
              ))}
            </TextField>
          )}
          <Button type="submit" variant="contained" disabled={busy}>Save course</Button>
        </Stack>
      )}

      {tab === 'outline' && (
        <Stack spacing={2}>
          {(course.modules || []).length === 0 && (
            <Paper variant="outlined" sx={{ p: 3 }}>
              <Typography sx={{ fontWeight: 700, mb: 2 }}>No modules yet</Typography>
              <Button variant="contained" onClick={() => setTab('module')}>Add the first module</Button>
            </Paper>
          )}
          {(course.modules || []).map((module: CourseModule) => {
            const lessons = [...(module.lessons || [])].sort((a, b) => a.sequence - b.sequence);
            const moduleQuizzes = quizzes.filter((quiz) => quiz.moduleId === module.id);
            return (
              <Accordion
                key={module.id}
                disableGutters
                elevation={0}
                expanded={openModuleId === module.id}
                onChange={(_, expanded) => {
                  setOpenModuleId(expanded ? module.id : null);
                  setOpenLessonId(null);
                }}
                sx={outlineAccordionSx}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{ bgcolor: (theme) => alpha(theme.palette.primary.main, 0.06) }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        flexShrink: 0,
                        borderRadius: '50%',
                        display: 'grid',
                        placeItems: 'center',
                        fontWeight: 700,
                        color: 'primary.contrastText',
                        bgcolor: 'primary.main',
                      }}
                    >
                      {module.sequence}
                    </Box>
                    <Typography variant="h6">{module.title}</Typography>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  {editingModule?.id === module.id ? (
                    <Stack component="form" spacing={1.5} sx={{ mb: 2 }} onSubmit={saveModule}>
                      <TextField label="Module title" value={editingModule.title} onChange={(e) => setEditingModule({ ...editingModule, title: e.target.value })} required />
                      <TextField label="Module description" value={editingModule.description} onChange={(e) => setEditingModule({ ...editingModule, description: e.target.value })} required />
                      <Stack direction="row" spacing={1}>
                        <Button type="submit" variant="contained" disabled={busy}>Save module</Button>
                        <Button onClick={() => setEditingModule(null)}>Cancel</Button>
                      </Stack>
                    </Stack>
                  ) : (
                    <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
                      <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => setEditingModule({ ...module })}>
                        Edit module
                      </Button>
                    </Stack>
                  )}

                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                    <Typography variant="overline" color="text.secondary">Lessons</Typography>
                    <Button
                      size="small"
                      onClick={() => {
                        setLessonForm((current) => ({ ...current, moduleId: module.id }));
                        setTab('lesson');
                      }}
                    >
                      Add lesson
                    </Button>
                  </Stack>
                  {lessons.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>No lessons in this module yet.</Typography>
                  )}
                  <Stack spacing={1} sx={{ mb: 2 }}>
                    {lessons.map((lesson) => (
                      <Accordion
                        key={lesson.id}
                        disableGutters
                        elevation={0}
                        expanded={openLessonId === lesson.id}
                        onChange={(_, expanded) => setOpenLessonId(expanded ? lesson.id : null)}
                        sx={outlineAccordionSx}
                      >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Typography sx={{ fontWeight: 700 }}>{lesson.sequence}. {lesson.title}</Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                          {editingLesson?.id === lesson.id ? (
                            <Stack component="form" spacing={1.5} onSubmit={saveLesson}>
                              <TextField label="Lesson title" value={editingLesson.title} onChange={(e) => setEditingLesson({ ...editingLesson, title: e.target.value })} required />
                              <TextField label="Description" value={editingLesson.description} onChange={(e) => setEditingLesson({ ...editingLesson, description: e.target.value })} required />
                              <TextField
                                label="Video URL"
                                value={editingLesson.videoUrl || ''}
                                onChange={(e) => setEditingLesson({ ...editingLesson, videoUrl: e.target.value })}
                                required
                                helperText="Public video address, for example a sample MP4."
                              />
                              <TextField label="Content" multiline minRows={2} value={editingLesson.content} onChange={(e) => setEditingLesson({ ...editingLesson, content: e.target.value })} required />
                              <Stack direction="row" spacing={1}>
                                <Button type="submit" variant="contained" disabled={busy}>Save lesson</Button>
                                <Button onClick={() => setEditingLesson(null)}>Cancel</Button>
                              </Stack>
                            </Stack>
                          ) : (
                            <Stack spacing={1}>
                              {lesson.description && (
                                <Typography variant="body2" color="text.secondary">{lesson.description}</Typography>
                              )}
                              <Stack direction="row" spacing={0.5}>
                                <Button size="small" onClick={() => setEditingLesson({ ...lesson })}>Edit</Button>
                                <Button size="small" color="error" disabled={busy} onClick={() => run(() => client.delete(`/lessons/${lesson.id}`).then(() => undefined), 'Lesson deleted')}>Delete</Button>
                              </Stack>
                            </Stack>
                          )}
                        </AccordionDetails>
                      </Accordion>
                    ))}
                  </Stack>

                  <Divider sx={{ mb: 2 }} />
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                    <Typography variant="overline" color="text.secondary">Quizzes</Typography>
                    <Button
                      size="small"
                      onClick={() => {
                        setQuizForm((current) => ({ ...current, moduleId: module.id }));
                        setTab('quizzes');
                      }}
                    >
                      Add quiz
                    </Button>
                  </Stack>
                  <Stack spacing={1.5}>
                    {moduleQuizzes.length === 0 && (
                      <Typography variant="body2" color="text.secondary">No quizzes in this module yet.</Typography>
                    )}
                    {moduleQuizzes.map((quiz) => renderQuiz(quiz))}
                  </Stack>
                </AccordionDetails>
              </Accordion>
            );
          })}
          {quizzes.some((quiz) => !quiz.moduleId) && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography sx={{ fontWeight: 700, mb: 1.5 }}>Quizzes not in a module</Typography>
              <Stack spacing={1.5}>
                {quizzes.filter((quiz) => !quiz.moduleId).map((quiz) => renderQuiz(quiz))}
              </Stack>
            </Paper>
          )}
        </Stack>
      )}

      {tab === 'module' && (
        <Stack component="form" spacing={2} onSubmit={addModule} sx={{ maxWidth: 720 }}>
          <Typography variant="h6">Add module</Typography>
          <TextField label="Title" value={moduleForm.title} onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })} required />
          <TextField label="Description" value={moduleForm.description} onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })} required />
          <Button type="submit" variant="contained" disabled={busy}>Add module</Button>
        </Stack>
      )}

      {tab === 'lesson' && (
        <Stack component="form" spacing={2} onSubmit={addLesson} sx={{ maxWidth: 720 }}>
          <Typography variant="h6">Add lesson</Typography>
          <TextField
            select
            label="Module"
            value={lessonForm.moduleId}
            onChange={(e) => setLessonForm({ ...lessonForm, moduleId: e.target.value })}
            required
            helperText="Choose the module this lesson belongs to."
          >
            {(course.modules || []).length === 0 && <MenuItem value="" disabled>Add a module first</MenuItem>}
            {(course.modules || []).map((module) => (
              <MenuItem key={module.id} value={module.id}>{module.sequence}. {module.title}</MenuItem>
            ))}
          </TextField>
          <TextField label="Title" value={lessonForm.title} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} required />
          <TextField label="Description" value={lessonForm.description} onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })} required />
          <TextField
            label="Video URL"
            value={lessonForm.videoUrl}
            onChange={(e) => setLessonForm({ ...lessonForm, videoUrl: e.target.value })}
            required
            helperText="Public video address, for example a sample MP4."
          />
          <TextField label="Content" multiline minRows={3} value={lessonForm.content} onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })} required />
          <Button type="submit" variant="contained" disabled={busy || (course.modules || []).length === 0}>Add lesson</Button>
        </Stack>
      )}

      {tab === 'quizzes' && (
        <Stack spacing={3} sx={{ maxWidth: 720 }}>
          <Box>
            <Typography variant="h6">Quizzes by module</Typography>
            {(course.modules || []).length === 0 && (
              <Typography color="text.secondary">Add a module before creating a quiz.</Typography>
            )}
            {(course.modules || []).map((module) => {
              const moduleQuizzes = quizzes.filter((quiz) => quiz.moduleId === module.id);
              return (
                <Box key={module.id} sx={{ mt: 1.5 }}>
                  <Typography sx={{ fontWeight: 700 }}>{module.sequence}. {module.title}</Typography>
                  {moduleQuizzes.length === 0 && (
                    <Typography color="text.secondary" sx={{ mt: 0.5 }}>No quizzes in this module. A module can have more than one.</Typography>
                  )}
                  <Stack spacing={1.5} sx={{ mt: moduleQuizzes.length ? 1 : 0 }}>
                    {moduleQuizzes.map((quiz) => renderQuiz(quiz))}
                  </Stack>
                </Box>
              );
            })}
            {quizzes.some((quiz) => !quiz.moduleId) && (
              <Box sx={{ mt: 1.5 }}>
                <Typography sx={{ fontWeight: 700 }}>Not in a module</Typography>
                <Stack spacing={1.5} sx={{ mt: 1 }}>
                  {quizzes.filter((quiz) => !quiz.moduleId).map((quiz) => renderQuiz(quiz))}
                </Stack>
              </Box>
            )}
          </Box>
          <Stack component="form" spacing={2} onSubmit={addQuiz}>
            <Typography variant="h6">Add quiz</Typography>
            <TextField
              select
              label="Module"
              value={quizForm.moduleId}
              onChange={(e) => setQuizForm({ ...quizForm, moduleId: e.target.value })}
              required
              helperText="Choose the module this quiz belongs to. A module can have more than one quiz."
            >
              {(course.modules || []).length === 0 && <MenuItem value="" disabled>Add a module first</MenuItem>}
              {(course.modules || []).map((module) => (
                <MenuItem key={module.id} value={module.id}>{module.sequence}. {module.title}</MenuItem>
              ))}
            </TextField>
            <TextField label="Title" value={quizForm.title} onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })} required />
            <TextField label="Description" value={quizForm.description} onChange={(e) => setQuizForm({ ...quizForm, description: e.target.value })} required />
            {quizForm.questions.map((question, index) => (
              <QuestionFields
                key={index}
                question={question}
                label={`Question ${index + 1}`}
                onChange={(next) => setQuizForm({
                  ...quizForm,
                  questions: quizForm.questions.map((item, itemIndex) => (itemIndex === index ? next : item)),
                })}
                onRemove={quizForm.questions.length > 1
                  ? () => setQuizForm({
                    ...quizForm,
                    questions: quizForm.questions.filter((_, itemIndex) => itemIndex !== index),
                  })
                  : undefined}
              />
            ))}
            <Button onClick={() => setQuizForm({ ...quizForm, questions: [...quizForm.questions, blankQuestion()] })}>
              Add another question
            </Button>
            <Button type="submit" variant="contained" disabled={busy || (course.modules || []).length === 0 || quizForm.questions.length === 0}>Add quiz</Button>
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}

function QuestionFields({
  question,
  label,
  onChange,
  onRemove,
}: {
  question: QuestionDraft;
  label: string;
  onChange: (question: QuestionDraft) => void;
  onRemove?: () => void;
}) {
  return (
    <Stack spacing={1.5} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
        <Typography sx={{ fontWeight: 700 }}>{label}</Typography>
        {onRemove && <Button onClick={onRemove}>Remove question</Button>}
      </Stack>
      <TextField
        label="Question"
        value={question.questionText}
        onChange={(e) => onChange({ ...question, questionText: e.target.value })}
        required
      />
      <Typography variant="body2" color="text.secondary">Mark the correct option. Each question has four choices.</Typography>
      {question.options.map((option, optionIndex) => (
        <Stack key={optionIndex} direction="row" spacing={1} alignItems="center">
          <Radio
            name={label}
            checked={question.correctIndex === optionIndex}
            onChange={() => onChange({ ...question, correctIndex: optionIndex })}
            inputProps={{ 'aria-label': `Option ${optionIndex + 1} is correct` }}
          />
          <TextField
            label={`Option ${optionIndex + 1}`}
            value={option}
            onChange={(e) => {
              const options = [...question.options];
              options[optionIndex] = e.target.value;
              onChange({ ...question, options });
            }}
            required
            fullWidth
          />
        </Stack>
      ))}
    </Stack>
  );
}
