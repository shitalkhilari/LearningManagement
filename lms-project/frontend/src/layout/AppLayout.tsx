import MenuBookIcon from '@mui/icons-material/MenuBook';
import { AppBar, Box, Button, Container, Toolbar, Typography } from '@mui/material';
import { NavLink, Outlet } from 'react-router-dom';
import { homeForRole, useAuth } from '../auth/AuthContext';

const linkStyle = { color: 'white', textDecoration: 'none', marginRight: 16 };

export function AppLayout() {
  const { user, logout } = useAuth();
  if (!user) return null;
  const links =
    user.role === 'ADMIN'
      ? [
          ['/admin', 'Dashboard'],
          ['/admin/users', 'Users'],
          ['/admin/courses', 'Courses'],
          ['/admin/enrollments', 'Enrollments'],
          ['/admin/reports', 'Reports'],
        ]
      : user.role === 'INSTRUCTOR'
        ? [
            ['/instructor', 'Dashboard'],
            ['/instructor/courses', 'My courses'],
            ['/instructor/reports', 'Reports'],
          ]
        : [
            ['/learner', 'Dashboard'],
            ['/learner/courses', 'Browse'],
            ['/learner/learning', 'My learning'],
            ['/learner/progress', 'Progress'],
          ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static">
        <Toolbar>
          <MenuBookIcon sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>eLearning LMS</Typography>
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} style={linkStyle}>{label}</NavLink>
          ))}
          <Typography sx={{ mx: 2 }}>{user.firstName} ({user.role})</Typography>
          <Button color="inherit" onClick={logout} href="/login">Logout</Button>
        </Toolbar>
      </AppBar>
      <Container sx={{ py: 4 }}>
        <Outlet />
      </Container>
      <Box component="footer" sx={{ textAlign: 'center', py: 2, color: 'text.secondary' }}>
        <NavLink to={homeForRole(user.role)}>Home</NavLink>
      </Box>
    </Box>
  );
}
