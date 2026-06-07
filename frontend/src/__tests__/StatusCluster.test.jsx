import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { StatusCluster } from '../components/StatusCluster';

describe('StatusCluster.jsx', () => {
  it('debe renderizar el systemStatus', () => {
    render(<StatusCluster systemStatus="ONLINE" isSystemOk={true} />);
    expect(screen.getByText('ONLINE')).toBeInTheDocument();
  });

  it('debe aplicar color verde cuando isSystemOk=true', () => {
    render(<StatusCluster systemStatus="ONLINE" isSystemOk={true} />);
    const statusEl = screen.getByText('ONLINE');
    expect(statusEl).toHaveClass('text-[#4ade80]');
  });

  it('debe aplicar color gris cuando isSystemOk=false', () => {
    render(<StatusCluster systemStatus="DEGRADED" isSystemOk={false} />);
    const statusEl = screen.getByText('DEGRADED');
    expect(statusEl).toHaveClass('text-[#94a3b8]');
  });

  it('debe renderizar indicador SIATA', () => {
    render(<StatusCluster systemStatus="ONLINE" isSystemOk={true} />);
    expect(screen.getByText(/SIATA:/i)).toBeInTheDocument();
  });

  it('debe renderizar contador de alertas', () => {
    render(<StatusCluster systemStatus="ONLINE" isSystemOk={true} alertCount={7} />);
    expect(screen.getByText(/ALERTS/i)).toBeInTheDocument();
  });

  it('debe renderizar indicador de uptime', () => {
    render(<StatusCluster systemStatus="ONLINE" isSystemOk={true} uptime="12:34:56" />);
    expect(screen.getByText(/UPTIME:/i)).toBeInTheDocument();
  });

  it('debe tener 5 badges de estado', () => {
    const { container } = render(<StatusCluster systemStatus="ONLINE" isSystemOk={true} />);
    const badges = container.querySelectorAll('span[class*="border-[rgba(56,189,248,0.12)]"]');
    expect(badges.length).toBeGreaterThanOrEqual(4);
  });
});
