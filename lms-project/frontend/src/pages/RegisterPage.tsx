import { Alert, Button, Container, Paper, Stack, TextField, Typography } from '@mui/material';
import { FormEvent, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submitting = useRef(false);

  function setField(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    setError('');
    try {
      await register(form);
      navigate('/login');
    } catch (err) {
      setError((err as { displayMessage?: string }).displayMessage || 'Registration failed');
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  }

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>Create a learner account</Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Public registration always creates a learner. Instructors are created by an admin.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack component="form" spacing={2} onSubmit={onSubmit}>
          <TextField label="First name" value={form.firstName} onChange={(e) => setField('firstName', e.target.value)} required />
          <TextField label="Last name" value={form.lastName} onChange={(e) => setField('lastName', e.target.value)} required />
          <TextField label="Email" type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} required />
          <TextField label="Password" type="password" value={form.password} onChange={(e) => setField('password', e.target.value)} required inputProps={{ minLength: 8 }} />
          <Button type="submit" variant="contained" disabled={loading}>{loading ? 'Creating...' : 'Register'}</Button>
        </Stack>
        <Typography sx={{ mt: 2 }}><Link to="/login">Back to sign in</Link></Typography>
      </Paper>
    </Container>
  );
}
