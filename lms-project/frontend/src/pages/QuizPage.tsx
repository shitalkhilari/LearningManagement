import { Alert, Button, FormControlLabel, Radio, RadioGroup, Stack, Typography } from '@mui/material';
import { FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import client from '../api/client';
import { useActionLock } from '../hooks/useActionLock';
import { Quiz, QuizResult } from '../types';

export function QuizPage() {
  const { quizId = '' } = useParams();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const { busy, hold, release } = useActionLock();

  useEffect(() => {
    client.get(`/quizzes/${quizId}`)
      .then((response) => setQuiz(response.data))
      .catch((err) => setLoadError(err.displayMessage || 'Could not load the quiz'));
  }, [quizId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (result || !hold()) return;
    setError('');
    try {
      const { data } = await client.post(`/quizzes/${quizId}/submit`, {
        answers: Object.entries(answers).map(([questionId, selectedOptionId]) => ({ questionId, selectedOptionId })),
      });
      setResult(data);
    } catch (err) {
      release();
      setError((err as { displayMessage?: string }).displayMessage || 'Could not submit the quiz');
    }
  }

  if (loadError) return <Alert severity="error">{loadError}</Alert>;
  if (!quiz) return <Typography>Loading quiz...</Typography>;

  return (
    <Stack component="form" spacing={3} onSubmit={submit}>
      {error && <Alert severity="error">{error}</Alert>}
      <Typography variant="h4">{quiz.title}</Typography>
      <Typography>{quiz.description}</Typography>
      {(quiz.questions || []).map((question) => (
        <div key={question.id}>
          <Typography variant="h6">{question.questionText}</Typography>
          <RadioGroup value={answers[question.id] || ''} onChange={(e) => setAnswers({ ...answers, [question.id]: e.target.value })}>
            {question.options.map((option) => (
              <FormControlLabel key={option.id} value={option.id} control={<Radio />} label={option.optionText} />
            ))}
          </RadioGroup>
        </div>
      ))}
      <Button type="submit" variant="contained" disabled={busy || Boolean(result)}>
        {busy && !result ? 'Submitting...' : 'Submit quiz'}
      </Button>
      {result && (
        <Alert severity={result.status === 'PASS' ? 'success' : 'warning'}>
          {result.status}: {result.correctAnswers} correct, {result.incorrectAnswers} incorrect, score {result.score}/{result.totalQuestions} ({result.percentage}%).
          {result.status === 'PASS'
            ? ' This pass is now included in the course progress.'
            : ' A failed attempt does not increase course progress.'}
        </Alert>
      )}
      {result?.status === 'PASS' && quiz && (
        <Button component={Link} to={`/learner/learning/${quiz.courseId}`}>Back to the course</Button>
      )}
    </Stack>
  );
}
