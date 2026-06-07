import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TopBar } from '../components/TopBar';

describe('TopBar.jsx', () => {
  it('debe renderizar el título TPPMAPS', () => {
    render(<TopBar systemStatus="ONLINE" isSystemOk={true} />);
    expect(screen.getByText('TPPMAPS')).toBeInTheDocument();
  });

  it('debe renderizar el subtítulo', () => {
    render(<TopBar systemStatus="ONLINE" isSystemOk={true} />);
    expect(screen.getByText('GEOSPATIAL INTELLIGENCE COMMAND')).toBeInTheDocument();
  });

  it('debe renderizar badge OPEN SOURCE', () => {
    render(<TopBar systemStatus="ONLINE" isSystemOk={true} />);
    expect(screen.getByText('OPEN SOURCE')).toBeInTheDocument();
  });

  it('debe renderizar botones móviles (capas y herramientas)', () => {
    render(<TopBar systemStatus="ONLINE" isSystemOk={true} />);
    expect(screen.getByLabelText('Abrir capas')).toBeInTheDocument();
    expect(screen.getByLabelText('Abrir herramientas')).toBeInTheDocument();
  });

  it('debe renderizar el componente StatusCluster', () => {
    render(<TopBar systemStatus="ONLINE" isSystemOk={true} />);
    expect(screen.getByText('ONLINE')).toBeInTheDocument();
  });

  it('debe renderizar link API / DOCS', () => {
    render(<TopBar systemStatus="ONLINE" isSystemOk={true} />);
    expect(screen.getByText('API / DOCS')).toBeInTheDocument();
    expect(screen.getByText('API / DOCS').closest('a')).toHaveAttribute('href', '/docs');
  });

  it('debe renderizar botón PROYECTO DE APOYO', () => {
    render(<TopBar systemStatus="ONLINE" isSystemOk={true} />);
    expect(screen.getByText('PROYECTO DE APOYO')).toBeInTheDocument();
  });

  it('debe pasar systemStatus a StatusCluster', () => {
    render(<TopBar systemStatus="DEGRADED" isSystemOk={false} />);
    expect(screen.getByText('DEGRADED')).toBeInTheDocument();
  });
});
