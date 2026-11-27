import {
  Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel,
  MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { FormEvent, useEffect, useState } from 'react';
import client from '../api/client';
import { useActionLock } from '../hooks/useActionLock';
import { AuthUser, Role } from '../types';

const emptyCreate = {
  firstName: '',
  lastName: '',
  email: '',
  password: 'Instructor@123',
  role: 'INSTRUCTOR' as Role,
};

interface EditForm {
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  isActive: boolean;
}

export function UsersPage() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyCreate);
  const [editing, setEditing] = useState<AuthUser | null>(null);
  const { busy, run } = useActionLock();
  const [editForm, setEditForm] = useState<EditForm>({
    firstName: '',
    lastName: '',
    email: '',
    role: 'LEARNER',
    isActive: true,
  });

  async function load() {
    const { data } = await client.get('/users', { params: { limit: 100 } });
    setUsers(data.data);
  }

  useEffect(() => {
    load().catch((err) => setError(err.displayMessage || 'Could not load users'));
  }, []);

  function openEdit(user: AuthUser) {
    setError('');
    setMessage('');
    setEditing(user);
    setEditForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    });
  }

  async function createUser(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      setError('');
      try {
        await client.post('/users', form);
        setMessage('User created');
        setOpen(false);
        setForm(emptyCreate);
        await load();
      } catch (err) {
        setError((err as { displayMessage?: string }).displayMessage || 'Could not create user');
      }
    });
  }

  async function saveUser(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const userId = editing.id;
    await run(async () => {
      setError('');
      try {
        await client.patch(`/users/${userId}`, editForm);
        setMessage('User updated');
        setEditing(null);
        await load();
      } catch (err) {
        setError((err as { displayMessage?: string }).displayMessage || 'Could not update user');
      }
    });
  }

  async function toggleActive(user: AuthUser) {
    await run(async () => {
      setError('');
      try {
        await client.patch(`/users/${user.id}`, { isActive: !user.isActive });
        setMessage(user.isActive ? 'User deactivated' : 'User activated');
        await load();
      } catch (err) {
        setError((err as { displayMessage?: string }).displayMessage || 'Could not update user');
      }
    });
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
            <TableCell>Name</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>Role</TableCell>
            <TableCell>Active</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id}>
              <TableCell>{user.firstName} {user.lastName}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.role}</TableCell>
              <TableCell>{user.isActive ? 'Yes' : 'No'}</TableCell>
              <TableCell>
                <Button onClick={() => openEdit(user)}>Edit</Button>
                <Button disabled={busy} onClick={() => toggleActive(user)}>{user.isActive ? 'Deactivate' : 'Activate'}</Button>
              </TableCell>
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
          <Button type="submit" form="create-user" variant="contained" disabled={busy}>Save</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} fullWidth>
        <DialogTitle>Edit user</DialogTitle>
        <DialogContent>
          <Stack component="form" id="edit-user" spacing={2} sx={{ mt: 1 }} onSubmit={saveUser}>
            <TextField label="First name" value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} required />
            <TextField label="Last name" value={editForm.lastName} onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })} required />
            <TextField label="Email" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} required />
            <TextField select label="Role" value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value as Role })}>
              <MenuItem value="INSTRUCTOR">Instructor</MenuItem>
              <MenuItem value="LEARNER">Learner</MenuItem>
              <MenuItem value="ADMIN">Admin</MenuItem>
            </TextField>
            <FormControlLabel
              control={<Checkbox checked={editForm.isActive} onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })} />}
              label="Active"
            />
            <Typography variant="body2" color="text.secondary">Password stays the same. Create a new account if a different password is needed.</Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button type="submit" form="edit-user" variant="contained" disabled={busy}>Save changes</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
