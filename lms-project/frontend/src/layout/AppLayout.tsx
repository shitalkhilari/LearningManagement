import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import {
  AppBar, Avatar, Box, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText,
  Toolbar, Typography,
} from '@mui/material';
import { ReactNode, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const drawerWidth = 260;

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  match: (path: string) => boolean;
}

function exact(to: string) {
  return (path: string) => path === to;
}

function prefix(to: string) {
  return (path: string) => path === to || path.startsWith(`${to}/`);
}

function navForRole(role: string): NavItem[] {
  if (role === 'ADMIN') {
    return [
      { to: '/admin', label: 'Dashboard', icon: <DashboardOutlinedIcon />, match: exact('/admin') },
      { to: '/admin/users', label: 'Users', icon: <PeopleOutlinedIcon />, match: prefix('/admin/users') },
      {
        to: '/admin/courses',
        label: 'Courses',
        icon: <MenuBookOutlinedIcon />,
        match: (path) => prefix('/admin/courses')(path) || path.startsWith('/courses/'),
      },
      { to: '/admin/enrollments', label: 'Enrollments', icon: <HowToRegOutlinedIcon />, match: prefix('/admin/enrollments') },
      { to: '/admin/reports', label: 'Reports', icon: <AssessmentOutlinedIcon />, match: prefix('/admin/reports') },
    ];
  }
  if (role === 'INSTRUCTOR') {
    return [
      { to: '/instructor', label: 'Dashboard', icon: <DashboardOutlinedIcon />, match: exact('/instructor') },
      {
        to: '/instructor/courses',
        label: 'My courses',
        icon: <MenuBookOutlinedIcon />,
        match: (path) => prefix('/instructor/courses')(path) || path.startsWith('/courses/'),
      },
      { to: '/instructor/reports', label: 'Reports', icon: <AssessmentOutlinedIcon />, match: prefix('/instructor/reports') },
    ];
  }
  return [
    { to: '/learner', label: 'Dashboard', icon: <DashboardOutlinedIcon />, match: exact('/learner') },
    { to: '/learner/courses', label: 'Browse', icon: <AutoStoriesOutlinedIcon />, match: prefix('/learner/courses') },
    {
      to: '/learner/learning',
      label: 'My learning',
      icon: <SchoolOutlinedIcon />,
      match: (path) => prefix('/learner/learning')(path) || path.startsWith('/learner/quizzes'),
    },
    { to: '/learner/progress', label: 'Progress', icon: <TrendingUpOutlinedIcon />, match: prefix('/learner/progress') },
  ];
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  if (!user) return null;

  const items = navForRole(user.role);
  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ px: 2, pt: 2.5, pb: 1 }}>
        <Typography variant="h6" color="primary.main">eLearning LMS</Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5 }}>
        <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>{initials}</Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography fontWeight={700} noWrap>{user.firstName} {user.lastName}</Typography>
          <Typography variant="body2" color="text.secondary">{user.role}</Typography>
        </Box>
      </Box>
      <Typography variant="overline" sx={{ px: 2, pt: 1, color: 'text.secondary' }}>Menu</Typography>
      <List sx={{ px: 1 }}>
        {items.map((item) => {
          const selected = item.match(location.pathname);
          return (
            <ListItemButton
              key={item.to}
              component={Link}
              to={item.to}
              selected={selected}
              onClick={() => setMobileOpen(false)}
              sx={{
                mb: 0.5,
                borderRadius: 1,
                borderLeft: '4px solid transparent',
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: 'common.white',
                  borderLeftColor: 'secondary.main',
                  '&:hover': { bgcolor: 'primary.dark' },
                  '& .MuiListItemIcon-root': { color: 'common.white' },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40, color: selected ? 'inherit' : 'text.secondary' }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} primaryTypographyProps={{ fontWeight: 600 }} />
            </ListItemButton>
          );
        })}
      </List>
      <Box sx={{ flexGrow: 1 }} />
      <ListItemButton onClick={logout} sx={{ m: 1, borderRadius: 1 }}>
        <ListItemIcon sx={{ minWidth: 40 }}><LogoutOutlinedIcon /></ListItemIcon>
        <ListItemText primary="Log out" primaryTypographyProps={{ fontWeight: 600 }} />
      </ListItemButton>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="fixed" sx={{ display: { md: 'none' } }}>
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={() => setMobileOpen(true)} sx={{ mr: 1 }} aria-label="Open menu">
            <MenuIcon />
          </IconButton>
          <Typography variant="h6">eLearning LMS</Typography>
        </Toolbar>
      </AppBar>
      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: 0 }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box' },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { width: drawerWidth, boxSizing: 'border-box', borderRight: '1px solid', borderColor: 'divider' },
          }}
        >
          {drawer}
        </Drawer>
      </Box>
      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, md: 4 }, pt: { xs: 10, md: 4 }, minWidth: 0 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
