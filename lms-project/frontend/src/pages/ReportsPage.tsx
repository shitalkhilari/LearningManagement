import {
  Alert, Button, MenuItem, Stack, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography,
} from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { AuthUser, Course, CourseModule, Enrollment, ProgressReport, Quiz } from '../types';

interface CompletionReport {
  enrolled: number;
  completed: number;
  active: number;
  averageCompletion: number;
  learners: ProgressReport[];
}

interface EnrollmentReport {
  course: { title: string; status: string };
  total: number;
  enrollments: Enrollment[];
}

interface QuizRecord {
  id: string;
  learnerId: string;
  learner?: AuthUser;
  score: number;
  totalQuestions: number;
  percentage: number | string;
  status: string;
  submittedAt: string;
}

interface QuizReport {
  quiz: { title: string };
  attempts: number;
  passed: number;
  failed: number;
  averagePercentage: number;
  records: QuizRecord[];
}

type ReportResult =
  | { kind: 'progress'; rows: ProgressReport[] }
  | { kind: 'enrollments'; data: EnrollmentReport }
  | { kind: 'completion'; data: CompletionReport }
  | { kind: 'quiz'; data: QuizReport };

function personName(person?: { firstName: string; lastName: string; email?: string }, fallback?: string) {
  if (!person) return fallback || 'Unknown';
  return person.email ? `${person.firstName} ${person.lastName} (${person.email})` : `${person.firstName} ${person.lastName}`;
}

export function ReportsPage() {
  const { user } = useAuth();
  const [learners, setLearners] = useState<AuthUser[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [learnerId, setLearnerId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [quizId, setQuizId] = useState('');
  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const loadingLock = useRef(false);
  const [tab, setTab] = useState('learner');

  useEffect(() => {
    if (!user) return;
    const courseParams = user.role === 'INSTRUCTOR' ? { instructorId: user.id, limit: 100 } : { limit: 100 };
    client.get('/courses', { params: courseParams })
      .then(({ data }) => setCourses(data.data))
      .catch((err) => setError(err.displayMessage || 'Could not load courses'));

    if (user.role === 'ADMIN') {
      client.get('/users', { params: { role: 'LEARNER', limit: 100 } })
        .then(({ data }) => setLearners(data.data))
        .catch((err) => setError(err.displayMessage || 'Could not load learners'));
      return;
    }

    client.get('/enrollments', { params: { limit: 100 } })
      .then(({ data }) => {
        const byId = new Map<string, AuthUser>();
        for (const row of data.data as Enrollment[]) {
          if (row.learner) byId.set(row.learner.id, row.learner);
        }
        setLearners([...byId.values()]);
      })
      .catch((err) => setError(err.displayMessage || 'Could not load learners'));
  }, [user]);

  useEffect(() => {
    if (!courseId) {
      setQuizzes([]);
      setModules([]);
      setQuizId('');
      return;
    }
    Promise.all([
      client.get(`/courses/${courseId}/quizzes`),
      client.get(`/courses/${courseId}`),
    ])
      .then(([quizResponse, courseResponse]) => {
        setQuizzes(quizResponse.data);
        setModules(courseResponse.data.modules || []);
        setQuizId('');
      })
      .catch((err) => setError(err.displayMessage || 'Could not load quizzes'));
  }, [courseId]);

  async function load(path: string, kind: ReportResult['kind']) {
    if (loadingLock.current) return;
    loadingLock.current = true;
    setError('');
    setLoading(true);
    try {
      const { data } = await client.get(path);
      if (kind === 'progress') setResult({ kind, rows: data });
      else setResult({ kind, data } as ReportResult);
    } catch (err) {
      setResult(null);
      setError((err as { displayMessage?: string }).displayMessage || 'Could not load the report');
    } finally {
      loadingLock.current = false;
      setLoading(false);
    }
  }

  const learnerHelp = user?.role === 'INSTRUCTOR'
    ? 'Learners are listed by name after they enroll in one of your courses.'
    : 'Every learner account is listed by name.';

  function openTab(value: string) {
    setTab(value);
    setResult(null);
    setError('');
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h4">Reports</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <Tabs value={tab} onChange={(_, value) => openTab(value)} aria-label="Report types">
        <Tab value="learner" label="Learner" />
        <Tab value="course" label="Course" />
        <Tab value="quiz" label="Quiz" />
      </Tabs>

      {tab === 'learner' && (
        <Stack spacing={2} sx={{ maxWidth: 560 }}>
          <TextField
            select
            label="Learner"
            value={learnerId}
            onChange={(e) => { setLearnerId(e.target.value); setResult(null); }}
            helperText={learners.length ? learnerHelp : 'No learners are available yet.'}
          >
            <MenuItem value="">Select a learner</MenuItem>
            {learners.map((learner) => (
              <MenuItem key={learner.id} value={learner.id}>{personName(learner)}</MenuItem>
            ))}
          </TextField>
          <Button variant="contained" disabled={!learnerId || loading} onClick={() => load(`/reports/learners/${learnerId}/progress`, 'progress')} sx={{ alignSelf: 'flex-start' }}>
            Show progress
          </Button>
        </Stack>
      )}

      {tab === 'course' && (
        <Stack spacing={2} sx={{ maxWidth: 560 }}>
          <TextField
            select
            label="Course"
            value={courseId}
            onChange={(e) => { setCourseId(e.target.value); setResult(null); }}
            helperText={courses.length ? 'Courses you can report on are listed by title.' : 'No courses are available yet.'}
          >
            <MenuItem value="">Select a course</MenuItem>
            {courses.map((course) => (
              <MenuItem key={course.id} value={course.id}>{course.title} ({course.status})</MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={1}>
            <Button variant="contained" disabled={!courseId || loading} onClick={() => load(`/reports/courses/${courseId}/enrollments`, 'enrollments')}>Enrollments</Button>
            <Button variant="contained" disabled={!courseId || loading} onClick={() => load(`/reports/courses/${courseId}/completion`, 'completion')}>Completion</Button>
          </Stack>
        </Stack>
      )}

      {tab === 'quiz' && (
        <Stack spacing={2} sx={{ maxWidth: 560 }}>
          <TextField
            select
            label="Course"
            value={courseId}
            onChange={(e) => { setCourseId(e.target.value); setResult(null); }}
            helperText="Choose the course, then the quiz."
          >
            <MenuItem value="">Select a course</MenuItem>
            {courses.map((course) => (
              <MenuItem key={course.id} value={course.id}>{course.title}</MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Quiz"
            value={quizId}
            onChange={(e) => { setQuizId(e.target.value); setResult(null); }}
            helperText={courseId ? 'Quizzes for the selected course.' : 'Pick a course first.'}
            disabled={!courseId}
          >
            <MenuItem value="">Select a quiz</MenuItem>
            {quizzes.map((quiz) => {
              const moduleTitle = modules.find((module) => module.id === quiz.moduleId)?.title;
              return (
                <MenuItem key={quiz.id} value={quiz.id}>
                  {moduleTitle ? `${quiz.title} · ${moduleTitle}` : quiz.title}
                </MenuItem>
              );
            })}
          </TextField>
          <Button variant="contained" disabled={!quizId || loading} onClick={() => load(`/reports/quizzes/${quizId}/performance`, 'quiz')} sx={{ alignSelf: 'flex-start' }}>
            Show performance
          </Button>
        </Stack>
      )}

      {loading && <Typography color="text.secondary">Loading report...</Typography>}

      {result?.kind === 'progress' && (
        <>
          <Typography variant="h6">Learner progress</Typography>
          {result.rows.length === 0 ? <Typography>This learner has no progress in the courses you can see.</Typography> : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Course</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Lessons</TableCell>
                  <TableCell>Completion</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {result.rows.map((row) => (
                  <TableRow key={row.enrollmentId}>
                    <TableCell>{row.course.title}</TableCell>
                    <TableCell>{row.enrollmentStatus}</TableCell>
                    <TableCell>
                      {row.completedLessons} / {row.totalLessons} lessons
                      {row.totalQuizzes > 0 ? ` · ${row.passedQuizzes} / ${row.totalQuizzes} quizzes` : ''}
                    </TableCell>
                    <TableCell>{row.completionPercentage}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}

      {result?.kind === 'enrollments' && (
        <>
          <Typography variant="h6">{result.data.course.title} enrollments ({result.data.total})</Typography>
          {result.data.enrollments.length === 0 ? <Typography>No one is enrolled in this course.</Typography> : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Learner</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Enrolled</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {result.data.enrollments.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{personName(row.learner, row.learnerId)}</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell>{new Date(row.enrolledAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}

      {result?.kind === 'completion' && (
        <>
          <Typography variant="h6">Completion</Typography>
          <Typography>
            Enrolled {result.data.enrolled} · Completed {result.data.completed} · Active {result.data.active} · Average {result.data.averageCompletion}%
          </Typography>
          {result.data.learners.length > 0 && (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Learner</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Completion</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {result.data.learners.map((row) => (
                  <TableRow key={row.enrollmentId}>
                    <TableCell>{personName(row.learner)}</TableCell>
                    <TableCell>{row.enrollmentStatus}</TableCell>
                    <TableCell>{row.completionPercentage}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}

      {result?.kind === 'quiz' && (
        <>
          <Typography variant="h6">{result.data.quiz.title}</Typography>
          <Typography>
            Attempts {result.data.attempts} · Passed {result.data.passed} · Failed {result.data.failed} · Average {result.data.averagePercentage}%
          </Typography>
          {result.data.records.length > 0 && (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Learner</TableCell>
                  <TableCell>Score</TableCell>
                  <TableCell>Result</TableCell>
                  <TableCell>Submitted</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {result.data.records.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{personName(row.learner, row.learnerId)}</TableCell>
                    <TableCell>{row.score} / {row.totalQuestions} ({row.percentage}%)</TableCell>
                    <TableCell>{row.status}</TableCell>
                    <TableCell>{new Date(row.submittedAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
    </Stack>
  );
}
