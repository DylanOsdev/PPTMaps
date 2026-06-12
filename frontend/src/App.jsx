import React, { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate, useRouteError } from 'react-router-dom';
import { PerformanceProvider } from './hooks/useDevicePerformance.jsx';
import Landing from './pages/Landing.jsx';

const Report = lazy(() => import('./pages/Report.jsx'));
const CommandCenter = lazy(() => import('./pages/CommandCenter.jsx'));
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));

function ErrorFallback() {
  const error = useRouteError();
  return React.createElement('div', { style: { padding: 20, color: '#ef4444', fontFamily: 'monospace', fontSize: 14 } },
    'Error: ' + (error?.message || 'Unknown error'),
    React.createElement('pre', { style: { marginTop: 10, fontSize: 11, color: '#94a3b8' } },
      error?.stack || '(no stack trace)'
    )
  );
}

function SuspenseWrapper({ children }) {
  return <Suspense fallback={<div style={{height:'100vh',background:'#041327'}} />}>{children}</Suspense>;
}

const router = createBrowserRouter([
  { path: "/", element: <Landing />, errorElement: <ErrorFallback /> },
  { path: "/report", element: <SuspenseWrapper><Report /></SuspenseWrapper>, errorElement: <ErrorFallback /> },
  { path: "/map", element: <SuspenseWrapper><CommandCenter /></SuspenseWrapper>, errorElement: <ErrorFallback /> },
  { path: "/dashboard", element: <SuspenseWrapper><Dashboard /></SuspenseWrapper>, errorElement: <ErrorFallback /> },
  { path: "*", element: <Navigate to="/" replace /> },
]);

export default function App() {
  return (
    <PerformanceProvider>
      <RouterProvider router={router} />
    </PerformanceProvider>
  );
}
