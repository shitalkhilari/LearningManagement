import { Alert, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import client from '../api/client';
import { Enrollment } from '../types';

export function EnrollmentsPage() {
  const [rows, setRows] = useState<Enrollment[]>([]);
  const [error, setError] = useState('');
  const [courseId, setCourseId] = useState('');

  async function load(filter?: string) {
    const { data } = await client.get('/enrollments', { params: { limit: 50, courseId: filter || undefined } });
    setRows(data.data);
  }

  useEffect(() => {
    load().catch((err) => setError(err.displayMessage || 'Could not load enrollments'));
  }, []);

  return (
    <Stack spacing={2}>
      <Typography variant="h4">Enrollments</Typography>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField label="Filter by course id" value={courseId} onChange={(e) => setCourseId(e.target.value)} onBlur={() => load(courseId)} />
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Learner</TableCell><TableCell>Course</TableCell><TableCell>Status</TableCell><TableCell>Enrolled</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>{row.learner ? `${row.learner.firstName} ${row.learner.lastName}` : row.learnerId}</TableCell>
              <TableCell>{row.course?.title || row.courseId}</TableCell>
              <TableCell>{row.status}</TableCell>
              <TableCell>{new Date(row.enrolledAt).toLocaleDateString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Stack>
  );
}
