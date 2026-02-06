import { Navigate, Route, Routes } from 'react-router-dom';
import KioskPage from './pages/KioskPage';
import AdminLoginPage from './pages/AdminLoginPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminTvPage from './pages/AdminTvPage';
import RequireAdmin from './routes/RequireAdmin';

function App() {
  return (
    <Routes>
      <Route path="/" element={<KioskPage />} />
      <Route path="/admin_rocha" element={<AdminLoginPage />} />
      <Route
        path="/admin_rocha/dashboard"
        element={
          <RequireAdmin>
            <AdminDashboardPage />
          </RequireAdmin>
        }
      />
      <Route
        path="/admin_rocha/tv"
        element={
          <RequireAdmin>
            <AdminTvPage />
          </RequireAdmin>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
