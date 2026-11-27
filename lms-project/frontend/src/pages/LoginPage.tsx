import { Alert, Box, Button, Container, Paper, Stack, TextField, Typography } from '@mui/material';
import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { homeForRole, useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('learner1@lms.local');
  const [password, setPassword] = useState('Learner@123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const user = await login(email, password);
      navigate(homeForRole(user.role));
    } catch (err) {
      setError((err as { displayMessage?: string }).displayMessage || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h4" gutterBottom>Sign in</Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          Use a sample account from the README, or register as a learner.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack component="form" spacing={2} onSubmit={onSubmit}>
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <Button type="submit" variant="contained" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</Button>
        </Stack>
        <Box sx={{ mt: 2 }}>
          <Link to="/register">Create a learner account</Link>
        </Box>
      </Paper>
    </Container>
  );
}
