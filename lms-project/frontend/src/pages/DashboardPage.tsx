import AutoStoriesOutlinedIcon from '@mui/icons-material/AutoStoriesOutlined';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import HowToRegOutlinedIcon from '@mui/icons-material/HowToRegOutlined';
import LibraryAddOutlinedIcon from '@mui/icons-material/LibraryAddOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import { Alert, Box, Card, CardContent, CircularProgress, Grid, Typography } from '@mui/material';
import { ReactNode, useEffect, useState } from 'react';
import client from '../api/client';
import { useAuth } from '../auth/AuthContext';

interface Stat {
  label: string;
  value: number;
  icon: ReactNode;
  detail?: string;
  suffix?: string;
}

const roleAccent: Record<string, string> = {
  ADMIN: 'primary.main',
  INSTRUCTOR: 'secondary.main',
  LEARNER: '#1d4ed8',
};

function StatCard({ label, value, icon, detail, suffix, accent }: Stat & { accent: string }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            bgcolor: accent,
            color: 'common.white',
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography variant="body2" color="text.secondary">{label}</Typography>
          <Typography variant="h4">{value}{suffix}</Typography>
          {detail && (
            <Typography variant="caption" color="text.secondary">{detail}</Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

function statsForRole(role: string, data: Record<string, number>): Stat[] {
  if (role === 'ADMIN') {
    const drafts = data.draftCourses ?? 0;
    return [
      { label: 'Learners', value: data.totalLearners ?? 0, icon: <PeopleOutlinedIcon /> },
      { label: 'Instructors', value: data.totalInstructors ?? 0, icon: <SchoolOutlinedIcon /> },
      {
        label: 'Published courses',
        value: data.publishedCourses ?? 0,
        icon: <MenuBookOutlinedIcon />,
        detail: drafts === 1 ? '1 draft' : `${drafts} drafts`,
      },
      { label: 'Enrollments', value: data.totalEnrollments ?? 0, icon: <HowToRegOutlinedIcon /> },
    ];
  }

  if (role === 'INSTRUCTOR') {
    return [
      { label: 'Courses created', value: data.coursesCreated ?? 0, icon: <LibraryAddOutlinedIcon /> },
      { label: 'Published', value: data.publishedCourses ?? 0, icon: <PublicOutlinedIcon /> },
      { label: 'Drafts', value: data.draftCourses ?? 0, icon: <EditNoteOutlinedIcon /> },
      { label: 'Enrollments', value: data.totalEnrollments ?? 0, icon: <GroupsOutlinedIcon /> },
    ];
  }

  return [
    { label: 'Enrolled courses', value: data.enrolledCourses ?? 0, icon: <AutoStoriesOutlinedIcon /> },
    { label: 'Completed', value: data.completedCourses ?? 0, icon: <EmojiEventsOutlinedIcon /> },
    { label: 'Average completion', value: data.averageCompletion ?? 0, icon: <TrendingUpOutlinedIcon />, suffix: '%' },
  ];
}

export function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    client.get('/reports/overview')
      .then((response) => setData(response.data))
      .catch((err) => setError(err.displayMessage || 'Could not load the dashboard'));
  }, []);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data || !user) return <CircularProgress />;

  const stats = statsForRole(user.role, data);
  const accent = roleAccent[user.role] ?? 'primary.main';
  const columns = stats.length === 4 ? 3 : 4;

  return (
    <>
      <Typography variant="h4" gutterBottom>Dashboard</Typography>
      <Grid container spacing={2}>
        {stats.map((stat) => (
          <Grid item xs={12} sm={6} md={columns} key={stat.label}>
            <StatCard {...stat} accent={accent} />
          </Grid>
        ))}
      </Grid>
    </>
  );
}
