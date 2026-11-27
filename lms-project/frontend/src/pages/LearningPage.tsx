import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import OndemandVideoOutlinedIcon from '@mui/icons-material/OndemandVideoOutlined';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import QuizOutlinedIcon from '@mui/icons-material/QuizOutlined';
import {
  Alert, Box, Button, Chip, FormControlLabel, LinearProgress, List, ListItemButton, ListItemText,
  Paper, Radio, RadioGroup, Stack, Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import client from '../api/client';
import { useActionLock } from '../hooks/useActionLock';
import { Course, CourseModule, Enrollment, Lesson, ProgressReport, Quiz, QuizResult } from '../types';

type Panel =
  | { kind: 'lesson'; lessonId: string }
  | { kind: 'quiz'; quizId: string };

export function LearningPage() {
  const { courseId = '' } = useParams();
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [progress, setProgress] = useState<ProgressReport | null>(null);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const pending = useRef(new Set<string>());
  const detailRef = useRef<HTMLDivElement>(null);

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
    setReady(false);
    setPanel(null);
    load()
      .catch((err) => setError(err.displayMessage || 'Could not open this course'))
      .finally(() => setReady(true));
  }, [courseId]);

  useEffect(() => {
    if (!panel) return;
    if (window.matchMedia('(max-width: 1199px)').matches) {
      detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [panel]);

  const markComplete = useCallback(async (lessonId: string) => {
    if (pending.current.has(lessonId)) return;
    pending.current.add(lessonId);
    setError('');
    try {
      const { data } = await client.post(`/progress/lessons/${lessonId}/complete`);
      setProgress(data);
    } catch (err) {
      pending.current.delete(lessonId);
      setError((err as { displayMessage?: string }).displayMessage || 'Could not mark the lesson complete');
    }
  }, []);

  const refreshProgress = useCallback(async () => {
    if (!enrollment) return;
    try {
      const { data } = await client.get(`/progress/enrollments/${enrollment.id}`);
      setProgress(data);
    } catch (err) {
      setError((err as { displayMessage?: string }).displayMessage || 'Could not refresh course progress');
    }
  }, [enrollment]);

  const modules = useMemo(() => {
    return [...(course?.modules || [])]
      .sort((a, b) => a.sequence - b.sequence)
      .map((module) => ({
        ...module,
        lessons: [...(module.lessons || [])].sort((a, b) => a.sequence - b.sequence),
      }));
  }, [course]);

  if (!ready) return <Typography>Loading learning screen...</Typography>;
  if (error && !course) return <Alert severity="error">{error}</Alert>;
  if (!enrollment) return <Alert severity="info">Enroll in this published course before opening lessons.</Alert>;
  if (!course || !progress) return <Typography>Loading learning screen...</Typography>;

  const completed = new Set(progress.completedLessonIds || []);
  const passed = new Set(progress.passedQuizIds || []);
  const lessonEntries = modules.flatMap((module) => module.lessons.map((lesson) => ({ lesson, module })));
  const activeLesson = panel?.kind === 'lesson'
    ? lessonEntries.find((entry) => entry.lesson.id === panel.lessonId)
    : undefined;
  const activeQuiz = panel?.kind === 'quiz' ? quizzes.find((quiz) => quiz.id === panel.quizId) : undefined;
  const nextLesson = lessonEntries.find((entry) => !completed.has(entry.lesson.id));

  function openLesson(lessonId: string) {
    setPanel({ kind: 'lesson', lessonId });
  }

  function openQuiz(quizId: string) {
    setPanel({ kind: 'quiz', quizId });
  }

  return (
    <Stack spacing={2.5}>
      <Button component={Link} to="/learner/learning" sx={{ alignSelf: 'flex-start', px: 0 }}>
        Back to my learning
      </Button>
      <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="overline" color="primary.main" sx={{ fontWeight: 700 }}>Course</Typography>
        <Typography variant="h4" sx={{ mt: 0.5 }}>{course.title}</Typography>
        <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 760 }}>{course.description}</Typography>
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 2 }}>
          <Chip
            icon={<OndemandVideoOutlinedIcon />}
            label={`${progress.completedLessons} of ${progress.totalLessons} lessons`}
            variant="outlined"
          />
          <Chip
            icon={<QuizOutlinedIcon />}
            label={progress.totalQuizzes > 0
              ? `${progress.passedQuizzes} of ${progress.totalQuizzes} quizzes passed`
              : 'No quizzes'}
            variant="outlined"
          />
          <Chip label={`${progress.completionPercentage}% complete`} color="primary" />
        </Stack>
        <LinearProgress
          variant="determinate"
          value={progress.completionPercentage}
          sx={{ mt: 2, height: 8, borderRadius: 99 }}
        />
      </Paper>
      {error && <Alert severity="error">{error}</Alert>}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(300px, 380px) minmax(0, 1fr)' },
          gap: 2.5,
          alignItems: 'start',
        }}
      >
        <Stack
          spacing={2}
          sx={{
            position: { lg: 'sticky' },
            top: { lg: 24 },
            maxHeight: { lg: 'calc(100vh - 48px)' },
            overflow: { lg: 'auto' },
          }}
        >
          <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
            <Box sx={{ px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
              <MenuBookOutlinedIcon color="primary" fontSize="small" />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Modules</Typography>
            </Box>
            {modules.length === 0 && (
              <Typography color="text.secondary" sx={{ px: 2, pb: 2 }}>This course has no modules yet.</Typography>
            )}
            {modules.map((module) => {
              const done = module.lessons.filter((lesson) => completed.has(lesson.id)).length;
              const moduleQuizzes = quizzes.filter((quiz) => quiz.moduleId === module.id);
              return (
                <Box key={module.id} sx={{ borderTop: 1, borderColor: 'divider' }}>
                  <Box sx={{ px: 2, pt: 1.75, pb: 1, bgcolor: 'grey.50' }}>
                    <Typography variant="overline" color="primary.main" sx={{ fontWeight: 700, lineHeight: 1.4 }}>
                      Module {module.sequence}
                    </Typography>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                      {module.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {done} of {module.lessons.length} lessons complete
                      {moduleQuizzes.length > 0
                        ? ` · ${moduleQuizzes.filter((quiz) => passed.has(quiz.id)).length} of ${moduleQuizzes.length} quizzes passed`
                        : ''}
                    </Typography>
                  </Box>
                  {module.lessons.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1.5 }}>
                      No lessons in this module yet.
                    </Typography>
                  ) : (
                    <List disablePadding>
                      {module.lessons.map((lesson) => {
                        const selected = panel?.kind === 'lesson' && panel.lessonId === lesson.id;
                        const isDone = completed.has(lesson.id);
                        return (
                          <ListItemButton
                            key={lesson.id}
                            selected={selected}
                            onClick={() => openLesson(lesson.id)}
                            sx={{
                              py: 1.25,
                              alignItems: 'flex-start',
                              borderLeft: '3px solid',
                              borderLeftColor: selected ? 'primary.main' : 'transparent',
                              '&.Mui-selected': {
                                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                                '&:hover': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.18) },
                              },
                            }}
                          >
                            <Box
                              sx={{
                                width: 28,
                                height: 28,
                                mr: 1.5,
                                mt: 0.25,
                                flexShrink: 0,
                                borderRadius: '50%',
                                display: 'grid',
                                placeItems: 'center',
                                fontSize: 13,
                                fontWeight: 700,
                                color: selected || isDone ? 'primary.contrastText' : 'primary.main',
                                bgcolor: selected || isDone ? 'primary.main' : (theme) => alpha(theme.palette.primary.main, 0.12),
                              }}
                            >
                              {lesson.sequence}
                            </Box>
                            <ListItemText
                              primary={lesson.title}
                              secondary={isDone ? 'Completed' : 'Not started'}
                              primaryTypographyProps={{
                                fontWeight: 700,
                                color: selected ? 'primary.dark' : 'text.primary',
                                lineHeight: 1.35,
                              }}
                              secondaryTypographyProps={{ variant: 'caption' }}
                            />
                            {isDone && <CheckCircleIcon color="primary" fontSize="small" sx={{ mt: 0.5 }} />}
                          </ListItemButton>
                        );
                      })}
                    </List>
                  )}
                  {moduleQuizzes.length > 0 && (
                    <List disablePadding>
                      {moduleQuizzes.map((quiz) => {
                        const selected = panel?.kind === 'quiz' && panel.quizId === quiz.id;
                        const isPassed = passed.has(quiz.id);
                        return (
                          <ListItemButton
                            key={quiz.id}
                            selected={selected}
                            onClick={() => openQuiz(quiz.id)}
                            sx={{
                              py: 1.25,
                              alignItems: 'flex-start',
                              borderLeft: '3px solid',
                              borderLeftColor: selected ? 'primary.main' : 'transparent',
                              '&.Mui-selected': {
                                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                                '&:hover': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.18) },
                              },
                            }}
                          >
                            <Box
                              sx={{
                                width: 28,
                                height: 28,
                                mr: 1.5,
                                mt: 0.25,
                                flexShrink: 0,
                                borderRadius: '50%',
                                display: 'grid',
                                placeItems: 'center',
                                color: selected || isPassed ? 'primary.contrastText' : 'primary.main',
                                bgcolor: selected || isPassed ? 'primary.main' : (theme) => alpha(theme.palette.primary.main, 0.12),
                              }}
                            >
                              <QuizOutlinedIcon sx={{ fontSize: 16 }} />
                            </Box>
                            <ListItemText
                              primary={quiz.title}
                              secondary="Quiz"
                              primaryTypographyProps={{
                                fontWeight: 700,
                                color: selected ? 'primary.dark' : 'text.primary',
                                lineHeight: 1.35,
                              }}
                              secondaryTypographyProps={{ variant: 'caption' }}
                            />
                            {isPassed && <Chip label="Passed" color="success" size="small" sx={{ mt: 0.25 }} />}
                          </ListItemButton>
                        );
                      })}
                    </List>
                  )}
                </Box>
              );
            })}
          </Paper>
        </Stack>

        <Paper ref={detailRef} variant="outlined" sx={{ p: { xs: 2, md: 3 }, minHeight: 420 }}>
          {activeLesson && (
            <LessonDetail
              key={activeLesson.lesson.id}
              lesson={activeLesson.lesson}
              module={activeLesson.module}
              completed={completed.has(activeLesson.lesson.id)}
              onVideoEnded={markComplete}
            />
          )}
          {!activeLesson && activeQuiz && (
            <QuizDetail
              key={activeQuiz.id}
              quiz={activeQuiz}
              passed={passed.has(activeQuiz.id)}
              moduleTitle={activeQuiz.moduleId
                ? modules.find((module) => module.id === activeQuiz.moduleId)?.title
                : undefined}
              onPassed={refreshProgress}
            />
          )}
          {!activeLesson && !activeQuiz && (
            <CourseWelcome
              nextTitle={nextLesson?.lesson.title}
              onStart={nextLesson ? () => openLesson(nextLesson.lesson.id) : undefined}
            />
          )}
        </Paper>
      </Box>
    </Stack>
  );
}

function CourseWelcome({
  nextTitle,
  onStart,
}: {
  nextTitle?: string;
  onStart?: () => void;
}) {
  if (!nextTitle) {
    return (
      <Stack spacing={2} sx={{ maxWidth: 560, py: { md: 2 } }}>
        <CheckCircleIcon color="primary" sx={{ fontSize: 48 }} />
        <Typography variant="h5">Lessons complete</Typography>
        <Typography color="text.secondary">
          Open any lesson in a module to watch it again, or open a quiz listed under that module.
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={2} sx={{ maxWidth: 560, py: { md: 2 } }}>
      <PlayCircleOutlineIcon color="primary" sx={{ fontSize: 48 }} />
      <Typography variant="h5">Choose a lesson to begin</Typography>
      <Typography color="text.secondary">
        Each module lists its lessons and quizzes. Open a lesson to watch its video, or open a quiz to answer it here.
      </Typography>
      {onStart && (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Up next: <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>{nextTitle}</Box>
          </Typography>
          <Button variant="contained" onClick={onStart}>Open lesson</Button>
        </Box>
      )}
    </Stack>
  );
}

function LessonDetail({
  lesson,
  module,
  completed,
  onVideoEnded,
}: {
  lesson: Lesson;
  module: CourseModule;
  completed: boolean;
  onVideoEnded: (lessonId: string) => void;
}) {
  const [videoError, setVideoError] = useState('');

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="overline" color="primary.main" sx={{ fontWeight: 700 }}>
          Module {module.sequence} · {module.title}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap" sx={{ mt: 0.5 }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>{lesson.title}</Typography>
          {completed && <Chip label="Completed" color="primary" size="small" />}
        </Stack>
        {lesson.description && (
          <Typography color="text.secondary" sx={{ mt: 1 }}>{lesson.description}</Typography>
        )}
      </Box>
      {lesson.videoUrl ? (
        <Box
          component="video"
          controls
          playsInline
          preload="metadata"
          src={lesson.videoUrl}
          onEnded={() => {
            if (!completed) onVideoEnded(lesson.id);
          }}
          onError={() => setVideoError('This video could not be played. Check the lesson video URL.')}
          sx={{ width: '100%', maxHeight: 420, bgcolor: '#111', borderRadius: 2, display: 'block' }}
        />
      ) : (
        <Alert severity="warning">This lesson does not have a video yet.</Alert>
      )}
      {videoError && <Alert severity="error">{videoError}</Alert>}
      {!completed && lesson.videoUrl && (
        <Typography variant="body2" color="text.secondary">
          Play the video through to the end to complete this lesson.
        </Typography>
      )}
      {lesson.content && (
        <Box sx={{ bgcolor: 'grey.50', borderRadius: 2, p: 2 }}>
          <Typography variant="overline" color="text.secondary">Lesson notes</Typography>
          <Typography sx={{ whiteSpace: 'pre-wrap', mt: 0.5 }}>{lesson.content}</Typography>
        </Box>
      )}
    </Stack>
  );
}

function QuizDetail({
  quiz,
  passed,
  moduleTitle,
  onPassed,
}: {
  quiz: Quiz;
  passed: boolean;
  moduleTitle?: string;
  onPassed: () => Promise<void>;
}) {
  const questions = [...(quiz.questions || [])].sort((a, b) => a.sequence - b.sequence);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState('');
  const { busy, hold, release } = useActionLock();
  const alreadyPassed = passed || result?.status === 'PASS';

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (result || !hold()) return;
    setError('');
    try {
      const { data } = await client.post(`/quizzes/${quiz.id}/submit`, {
        answers: Object.entries(answers).map(([questionId, selectedOptionId]) => ({ questionId, selectedOptionId })),
      });
      setResult(data);
      if (data.status === 'PASS') await onPassed();
    } catch (err) {
      release();
      setError((err as { displayMessage?: string }).displayMessage || 'Could not submit the quiz');
    }
  }

  function tryAgain() {
    setResult(null);
    setAnswers({});
    setError('');
    release();
  }

  return (
    <Stack component="form" spacing={2} onSubmit={submit} sx={{ maxWidth: 640 }}>
      <Stack direction="row" spacing={1} alignItems="center">
        <QuizOutlinedIcon color="primary" />
        <Typography variant="overline" color="primary.main" sx={{ fontWeight: 700 }}>Quiz</Typography>
      </Stack>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>{quiz.title}</Typography>
      {quiz.description && <Typography color="text.secondary">{quiz.description}</Typography>}
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Chip label={`${questions.length} question${questions.length === 1 ? '' : 's'}`} variant="outlined" />
        {moduleTitle && <Chip label={moduleTitle} variant="outlined" />}
        {alreadyPassed && <Chip label="Passed" color="success" />}
      </Stack>
      {error && <Alert severity="error">{error}</Alert>}
      {questions.length === 0 && (
        <Alert severity="info">This quiz has no questions yet.</Alert>
      )}
      {questions.map((question, index) => (
        <Box key={question.id}>
          <Typography variant="h6">{index + 1}. {question.questionText}</Typography>
          <RadioGroup
            value={answers[question.id] || ''}
            onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}
          >
            {(question.options || []).map((option) => (
              <FormControlLabel
                key={option.id}
                value={option.id}
                control={<Radio color="primary" />}
                label={option.optionText}
                disabled={Boolean(result)}
              />
            ))}
          </RadioGroup>
        </Box>
      ))}
      {questions.length > 0 && (
        <Box>
          <Button type="submit" variant="contained" disabled={busy || Boolean(result)}>
            {busy && !result ? 'Submitting...' : 'Submit quiz'}
          </Button>
        </Box>
      )}
      {result && (
        <Alert severity={result.status === 'PASS' ? 'success' : 'warning'}>
          {result.status}: {result.correctAnswers} correct, {result.incorrectAnswers} incorrect, score {result.score}/{result.totalQuestions} ({result.percentage}%).
          {result.status === 'PASS'
            ? ' This pass is now included in the course progress.'
            : ' A failed attempt does not increase course progress.'}
        </Alert>
      )}
      {result && (
        <Box>
          <Button onClick={tryAgain}>Try again</Button>
        </Box>
      )}
    </Stack>
  );
}
