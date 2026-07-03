import './globals.css';
import { AuthProvider } from '../context/AuthContext';
import LayoutWrapper from '../components/LayoutWrapper';

export const metadata = {
  title: 'Inventario de Obra - Constructora',
  description: 'Sistema de control de materiales y consumos para supervisores de obra',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0F172A" />
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js').then(function(reg) {
                console.log('Service Worker registrado con éxito:', reg.scope);
              }, function(err) {
                console.log('Error al registrar Service Worker:', err);
              });
            });
          }
        ` }} />
      </head>
      <body className="bg-slate-50 text-slate-900 min-h-screen">
        <AuthProvider>
          <LayoutWrapper>
            {children}
          </LayoutWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}
