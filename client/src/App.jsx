import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { useAuth } from './auth/context';
import CabinetLayout from './components/CabinetLayout';
import SiteLayout from './components/SiteLayout';
import AppointmentsPage from './pages/AppointmentsPage';
import CabinetCardPage from './pages/CabinetCardPage';
import CabinetHistoryPage from './pages/CabinetHistoryPage';
import CabinetTicketsPage from './pages/CabinetTicketsPage';
import DoctorPage from './pages/DoctorPage';
import HomePage from './pages/HomePage';
import RegisterPage from './pages/RegisterPage';
import SettingsPage from './pages/SettingsPage';
import Banner from './ui/Banner';
import { ToastProvider } from './ui/Toast';

// Только для вошедших: гостя отправляем на главную (там окно входа) и запоминаем, куда он шёл
function RequireAuth({ children }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'guest') return <Navigate to="/" replace state={{ from: location.pathname }} />;
  return children;
}

// Только для сотрудников регистратуры (роль staff). Пока роль не получена с сервера — ждём.
function RequireStaff({ children }) {
  const { isStaff, profile } = useAuth();
  if (profile === 'loading') return null;
  if (!isStaff) return <Banner kind="warn" title="Нет доступа">Этот раздел доступен только сотрудникам регистратуры.</Banner>;
  return children;
}

// Только для гостей: вошедшего пользователя сразу уводим на главную
function GuestOnly({ children }) {
  const { status } = useAuth();
  if (status === 'authed') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route element={<SiteLayout />}>
              <Route index element={<HomePage />} />
              <Route path="doctors/:id" element={<DoctorPage />} />
              <Route path="register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
              <Route path="login" element={<Navigate to="/" replace />} />

              <Route path="cabinet" element={<RequireAuth><CabinetLayout /></RequireAuth>}>
                <Route index element={<Navigate to="card" replace />} />
                <Route path="card" element={<CabinetCardPage />} />
                <Route path="tickets" element={<CabinetTicketsPage />} />
                <Route path="history" element={<CabinetHistoryPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>

              <Route path="staff" element={<RequireAuth><RequireStaff><AppointmentsPage /></RequireStaff></RequireAuth>} />
              <Route path="security" element={<Navigate to="/cabinet/settings" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
