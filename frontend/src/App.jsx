import React from 'react';
import { createBrowserRouter, RouterProvider, Navigate, useRouteError } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import NavigatePage from './pages/Navigate.jsx';
import Report from './pages/Report.jsx';
import CommandCenter from './pages/CommandCenter.jsx';
import Dashboard from './pages/Dashboard.jsx';

function ErrorFallback() {
  const error = useRouteError();
  return React.createElement('div', { style: { padding: 20, color: '#ef4444', fontFamily: 'monospace', fontSize: 14 } },
    'Error: ' + (error?.message || 'Unknown error'),
    React.createElement('pre', { style: { marginTop: 10, fontSize: 11, color: '#94a3b8' } },
      error?.stack || '(no stack trace)'
    )
  );
}

const router = createBrowserRouter([
  { path: "/", element: <Landing />, errorElement: <ErrorFallback /> },
  { path: "/navigate", element: <NavigatePage />, errorElement: <ErrorFallback /> },
  { path: "/report", element: <Report />, errorElement: <ErrorFallback /> },
  { path: "/map", element: <CommandCenter />, errorElement: <ErrorFallback /> },
  { path: "/dashboard", element: <Dashboard />, errorElement: <ErrorFallback /> },
  { path: "*", element: <Navigate to="/" replace /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
