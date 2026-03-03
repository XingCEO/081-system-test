import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/useAuthStore';
import Header from './Header';
import Sidebar from './Sidebar';

export default function AppShell() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
