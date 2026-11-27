import {
  Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, Table,
  TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { FormEvent, useEffect, useState } from 'react';
import client from '../api/client';
import { AuthUser, Role } from '../types';

export function UsersPage() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: 'Instructor@123', role: 'INSTRUCTOR' as Role });

  async function load() {
    const { data } = await client.get('/users', { params: { limit: 50 } });
    setUsers(data.data);
  }

  useEffect(() => {
    load().catch((err) => setError(err.displayMessage || 'Could not load users'));
  }, []);

  async function createUser(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      await client.post('/users', form);
      setMessage('User created');
      setOpen(false);
      await load();
    } catch (err) {
      setError((err as { displayMessage?: string }).displayMessage || 'Could not create user');
    }
  }

  async function toggleActive(user: AuthUser) {
    await client.patch(`/users/${user.id}`, { isActive: !user.isActive });
    await load();
  }

  return (
    <>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography variant="h4">Users</Typography>
        <Button variant="contained" onClick={() => setOpen(true)}>Create user</Button>
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell><TableCell>Email</TableCell><TableCell>Role</TableCell><TableCell>Active</TableCell><TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>{user.firstName} {user.lastName}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.role}</TableCell>
              <TableCell>{user.isActive ? 'Yes' : 'No'}</TableCell>
              <TableCell><Button onClick={() => toggleActive(user)}>{user.isActive ? 'Deactivate' : 'Activate'}</Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Create user</DialogTitle>
        <DialogContent>
          <Stack component="form" id="create-user" spacing={2} sx={{ mt: 1 }} onSubmit={createUser}>
            <TextField label="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
            <TextField label="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
            <TextField label="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <TextField label="Password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            <TextField select label="Role" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              <MenuItem value="INSTRUCTOR">Instructor</MenuItem>
              <MenuItem value="LEARNER">Learner</MenuItem>
              <MenuItem value="ADMIN">Admin</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="submit" form="create-user" variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
