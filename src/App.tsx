import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { SchoolProvider, useSchool } from './lib/school';
import Layout from './components/Layout';
import { Spinner, Toaster } from './components/ui';
import Login from './pages/Login';
import SchoolPicker from './pages/SchoolPicker';
import Dashboard from './pages/Dashboard';
import ResourcePage from './pages/ResourcePage';
import Members from './pages/admin/Members';
import Modules from './pages/admin/Modules';
import Lists from './pages/admin/Lists';
import Platform from './pages/Platform';
import Calendar from './pages/Calendar';
import About from './pages/About';
import Centre from './pages/admin/Centre';
import PhotoImport from './pages/admin/PhotoImport';

function Gate() {
  const { session, loading } = useAuth();
  const { school, loading: schoolLoading, isPlatformAdmin } = useSchool();
  if (loading) return <Spinner />;
  if (!session) return <Login />;
  if (schoolLoading && !school) return <Spinner />;
  return (
    <Routes>
      {!school ? (
        <>
          {isPlatformAdmin && <Route path="/plataforma" element={<main className="page"><Platform /></main>} />}
          <Route path="*" element={<SchoolPicker />} />
        </>
      ) : (
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="r/:key" element={<ResourcePage />} />
          <Route path="admin/usuaris" element={<Members />} />
          <Route path="admin/moduls" element={<Modules />} />
          <Route path="admin/llistes" element={<Lists />} />
          <Route path="admin/centre" element={<Centre />} />
          <Route path="admin/fotos" element={<PhotoImport />} />
          <Route path="calendari" element={<Calendar />} />
          <Route path="sobre" element={<About />} />
          {isPlatformAdmin && <Route path="plataforma" element={<Platform />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      )}
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SchoolProvider>
        <HashRouter>
          <Gate />
          <Toaster />
        </HashRouter>
      </SchoolProvider>
    </AuthProvider>
  );
}
