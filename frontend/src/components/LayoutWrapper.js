'use client';

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  Boxes, 
  ArrowLeftRight, 
  FileText, 
  Users, 
  LogOut, 
  Menu, 
  X, 
  User,
  Truck,
  QrCode,
  FlaskConical,
  FolderKanban
} from 'lucide-react';

export default function LayoutWrapper({ children }) {
  const { user, logout, loading } = useAuth();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // If path is login, or still loading user session
  if (pathname === '/login' || pathname === '/login/') {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-slate-500 font-medium">Cargando sistema...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // AuthContext will redirect to /login
  }

  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Inventario', href: '/materials', icon: Boxes },
    { name: 'Movimientos', href: '/transactions', icon: ArrowLeftRight },
    { name: 'Proyectos', href: '/projects', icon: FolderKanban },
    { name: 'Mezclas', href: '/mixtures', icon: FlaskConical },
    { name: 'Proveedores', href: '/suppliers', icon: Truck },
    { name: 'Tickets QR', href: '/tickets', icon: QrCode },
    { name: 'Reportes', href: '/reports', icon: FileText },
  ];

  // Admin-only nav items
  if (user.role === 'admin') {
    navItems.push({ name: 'Usuarios', href: '/users', icon: Users });
  }

  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {/* Desktop Sidebar (Fixed height h-screen flex flex-col) */}
      <aside className="hidden md:flex md:w-64 md:h-screen sticky top-0 bg-slate-950 text-white flex-col border-r border-slate-800 shrink-0">
        {/* Header Branding */}
        <div className="p-6 border-b border-slate-800 shrink-0">
          <h1 className="text-xl font-bold tracking-tight text-blue-400">Constructora</h1>
          <p className="text-xs text-slate-400 mt-1">Control de Inventario</p>
        </div>
        
        {/* Navigation list (Scrollable independently) */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                }`}
              >
                <Icon className="mr-3 h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Fixed Footer: User Info & Logout Button */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 shrink-0">
          <div className="flex items-center mb-3">
            <div className="h-9 w-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold shrink-0">
              <User className="h-4 w-4" />
            </div>
            <div className="ml-3 overflow-hidden">
              <p className="text-sm font-bold text-white truncate">{user.name}</p>
              <p className="text-[11px] text-slate-400 capitalize truncate font-medium">{user.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-rose-400 hover:bg-rose-950/30 hover:border-rose-800/60 hover:text-rose-300 transition-all shadow-sm"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar / Drawer overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-slate-900/80 backdrop-blur-sm">
          <div className="relative flex w-full max-w-xs flex-col bg-slate-950 text-white p-6 animate-slide-in h-full">
            <div className="absolute top-5 right-5">
              <button 
                onClick={toggleMobileMenu}
                className="p-1 rounded-md text-slate-400 hover:text-white focus:outline-none"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="mb-6 shrink-0">
              <h1 className="text-xl font-bold text-blue-400">Constructora</h1>
              <p className="text-xs text-slate-400 mt-1">Control de Inventario</p>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto pr-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={closeMobileMenu}
                    className={`flex items-center px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                      isActive 
                        ? 'bg-blue-600 text-white' 
                        : 'text-slate-300 hover:bg-slate-900 hover:text-white'
                    }`}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-slate-800 pt-4 mt-auto shrink-0">
              <div className="flex items-center mb-4">
                <div className="h-9 w-9 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold shrink-0">
                  <User className="h-4 w-4" />
                </div>
                <div className="ml-3 overflow-hidden">
                  <p className="text-sm font-bold text-white truncate">{user.name}</p>
                  <p className="text-xs text-slate-400 capitalize truncate">{user.role}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  closeMobileMenu();
                  logout();
                }}
                className="w-full flex items-center justify-center px-4 py-2.5 rounded-xl border border-slate-800 bg-slate-900 text-xs font-bold text-rose-400 hover:bg-rose-950/20 hover:border-rose-900/50 transition-colors"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-hidden">
        {/* Top Header Bar for Desktop & Mobile */}
        <header className="bg-slate-950 text-white border-b border-slate-800 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger menu toggle */}
            <button
              onClick={toggleMobileMenu}
              className="md:hidden p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-900 focus:outline-none"
            >
              <Menu className="h-6 w-6" />
            </button>
            <span className="text-sm font-bold text-slate-300 hidden md:inline-block">
              Constructora — Sistema de Control
            </span>
            <span className="text-sm font-bold text-blue-400 md:hidden">
              Constructora
            </span>
          </div>

          {/* User Quick Info & Logout in Top Bar */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
              <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold mr-2 shrink-0">
                <User className="h-3.5 w-3.5" />
              </div>
              <span className="text-xs font-bold text-white truncate max-w-[120px] sm:max-w-[200px]">
                {user.name}
              </span>
              <span className="ml-2 text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-md font-semibold capitalize hidden sm:inline-block">
                {user.role}
              </span>
            </div>

            <button
              onClick={logout}
              className="flex items-center text-xs font-bold text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 px-3 py-1.5 rounded-xl border border-slate-800 transition-colors"
              title="Cerrar Sesión"
            >
              <LogOut className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline-block">Salir</span>
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
