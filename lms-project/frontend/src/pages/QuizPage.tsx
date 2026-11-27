import { Alert, Button, FormControlLabel, Radio, RadioGroup, Stack, Typography } from '@mui/material';
import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import client from '../api/client';
import { Quiz, QuizResult } from '../types';

export function QuizPage() {
  const { quizId = '' } = useParams();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    client.get(`/quizzes/${quizId}`)
      .then((response) => setQuiz(response.data))
      .catch((err) => setError(err.displayMessage || 'Could not load the quiz'));
  }, [quizId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const { data } = await client.post(`/quizzes/${quizId}/submit`, {
        answers: Object.entries(answers).map(([questionId, selectedOptionId]) => ({ questionId, selectedOptionId })),
      });
      setResult(data);
    } catch (err) {
      setError((err as { displayMessage?: string }).displayMessage || 'Could not submit the quiz');
    }
  }

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!quiz) return <Typography>Loading quiz...</Typography>;

  return (
    <Stack component="form" spacing={3} onSubmit={submit}>
      <Typography variant="h4">{quiz.title}</Typography>
      <Typography>{quiz.description} Passing mark: {quiz.passingPercentage}%</Typography>
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
      <Button type="submit" variant="contained">Submit quiz</Button>
      {result && (
        <Alert severity={result.status === 'PASS' ? 'success' : 'warning'}>
          {result.status}: {result.correctAnswers} correct, {result.incorrectAnswers} incorrect, score {result.score}/{result.totalQuestions} ({result.percentage}%)
        </Alert>
      )}
    </Stack>
  );
}
