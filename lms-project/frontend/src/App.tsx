import { CssBaseline, ThemeProvider } from '@mui/material';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './auth/ProtectedRoute';
import { useAuth, homeForRole } from './auth/AuthContext';
import { AppLayout } from './layout/AppLayout';
import theme from './theme';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { UsersPage } from './pages/UsersPage';
import { CoursesPage } from './pages/CoursesPage';
import { CourseCreatePage } from './pages/CourseCreatePage';
import { CourseBuilderPage } from './pages/CourseBuilderPage';
import { EnrollmentsPage } from './pages/EnrollmentsPage';
import { ReportsPage } from './pages/ReportsPage';
import { LearningPage } from './pages/LearningPage';
import { MyLearningPage } from './pages/MyLearningPage';
import { QuizPage } from './pages/QuizPage';
import { ProgressPage } from './pages/ProgressPage';
import { CourseDetailPage } from './pages/CourseDetailPage';

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? homeForRole(user.role) : '/login'} replace />;
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route path="/admin" element={<ProtectedRoute roles={['ADMIN']}><DashboardPage /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute roles={['ADMIN']}><UsersPage /></ProtectedRoute>} />
          <Route path="/admin/courses" element={<ProtectedRoute roles={['ADMIN']}><CoursesPage /></ProtectedRoute>} />
          <Route path="/admin/courses/new" element={<ProtectedRoute roles={['ADMIN']}><CourseCreatePage /></ProtectedRoute>} />
          <Route path="/admin/enrollments" element={<ProtectedRoute roles={['ADMIN']}><EnrollmentsPage /></ProtectedRoute>} />
          <Route path="/admin/reports" element={<ProtectedRoute roles={['ADMIN']}><ReportsPage /></ProtectedRoute>} />
          <Route path="/instructor" element={<ProtectedRoute roles={['INSTRUCTOR']}><DashboardPage /></ProtectedRoute>} />
          <Route path="/instructor/courses" element={<ProtectedRoute roles={['INSTRUCTOR']}><CoursesPage /></ProtectedRoute>} />
          <Route path="/instructor/courses/new" element={<ProtectedRoute roles={['INSTRUCTOR']}><CourseCreatePage /></ProtectedRoute>} />
          <Route path="/instructor/reports" element={<ProtectedRoute roles={['INSTRUCTOR']}><ReportsPage /></ProtectedRoute>} />
          <Route path="/courses/:courseId/builder" element={<ProtectedRoute roles={['ADMIN', 'INSTRUCTOR']}><CourseBuilderPage /></ProtectedRoute>} />
          <Route path="/learner" element={<ProtectedRoute roles={['LEARNER']}><DashboardPage /></ProtectedRoute>} />
          <Route path="/learner/courses" element={<ProtectedRoute roles={['LEARNER']}><CoursesPage /></ProtectedRoute>} />
          <Route path="/learner/courses/:courseId" element={<ProtectedRoute roles={['LEARNER']}><CourseDetailPage /></ProtectedRoute>} />
          <Route path="/learner/learning" element={<ProtectedRoute roles={['LEARNER']}><MyLearningPage /></ProtectedRoute>} />
          <Route path="/learner/learning/:courseId" element={<ProtectedRoute roles={['LEARNER']}><LearningPage /></ProtectedRoute>} />
          <Route path="/learner/quizzes/:quizId" element={<ProtectedRoute roles={['LEARNER']}><QuizPage /></ProtectedRoute>} />
          <Route path="/learner/progress" element={<ProtectedRoute roles={['LEARNER']}><ProgressPage /></ProtectedRoute>} />
        </Route>
      </Routes>
    </ThemeProvider>
  );
}
