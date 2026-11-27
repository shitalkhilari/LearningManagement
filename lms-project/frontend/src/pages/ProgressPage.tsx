import { Alert, LinearProgress, Stack, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { ProgressReport } from '../types';

export function ProgressPage() {
  const { user } = useAuth();
  const [reports, setReports] = useState<ProgressReport[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    client.get(`/reports/learners/${user.id}/progress`)
      .then((response) => setReports(response.data))
      .catch((err) => setError(err.displayMessage || 'Could not load progress'));
  }, [user]);

  if (error) return <Alert severity="error">{error}</Alert>;

  return (
    <Stack spacing={2}>
      <Typography variant="h4">My progress</Typography>
      {reports.length === 0 && <Alert severity="info">You have not enrolled in a course yet.</Alert>}
      {reports.map((report) => (
        <div key={report.enrollmentId}>
          <Typography variant="h6">{report.course.title}</Typography>
          <Typography>
            Enrolled {new Date(report.enrolledAt).toLocaleDateString()} — {report.completedLessons}/{report.totalLessons} lessons — {report.pendingLessons} pending — {report.enrollmentStatus}
          </Typography>
          <LinearProgress variant="determinate" value={report.completionPercentage} />
          <ButtonLink courseId={report.course.id} />
        </div>
      ))}
    </Stack>
  );
}

function ButtonLink({ courseId }: { courseId: string }) {
  return <Typography><Link to={`/learner/learning/${courseId}`}>Continue learning</Link></Typography>;
}
