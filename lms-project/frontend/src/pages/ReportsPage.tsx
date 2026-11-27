import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import client from '../api/client';

export function ReportsPage() {
  const [learnerId, setLearnerId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [quizId, setQuizId] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');

  async function load(path: string) {
    setError('');
    try {
      const { data } = await client.get(path);
      setOutput(JSON.stringify(data, null, 2));
    } catch (err) {
      setError((err as { displayMessage?: string }).displayMessage || 'Could not load the report');
    }
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h4">Reports</Typography>
      <Typography color="text.secondary">Reports use live backend calculations. The backend enforces who can see each report.</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField label="Learner id" value={learnerId} onChange={(e) => setLearnerId(e.target.value)} />
      <Button variant="contained" onClick={() => load(`/reports/learners/${learnerId}/progress`)}>Learner progress</Button>
      <TextField label="Course id" value={courseId} onChange={(e) => setCourseId(e.target.value)} />
      <Stack direction="row" spacing={1}>
        <Button variant="contained" onClick={() => load(`/reports/courses/${courseId}/enrollments`)}>Enrollments</Button>
        <Button variant="contained" onClick={() => load(`/reports/courses/${courseId}/completion`)}>Completion</Button>
      </Stack>
      <TextField label="Quiz id" value={quizId} onChange={(e) => setQuizId(e.target.value)} />
      <Button variant="contained" onClick={() => load(`/reports/quizzes/${quizId}/performance`)}>Quiz performance</Button>
      {output && <pre>{output}</pre>}
    </Stack>
  );
}
