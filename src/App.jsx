import React, { useState, useEffect } from 'react';
import InicioSesion from './componentes/InicioSesion';
import VistaOperador from './componentes/VistaOperador';
import VistaAdmin from './componentes/VistaAdmin';
import VistaContador from './componentes/VistaContador';
import './App.css';
import './styles/erp-theme.css';

export default function App() {
  const [usuario, setUsuario] = useState(() => {
    try {
      const sesionGuardada = localStorage.getItem('usuario_multimak');
      return sesionGuardada ? JSON.parse(sesionGuardada) : null;
    } catch (e) {
      return null;
    }
  });

  const [modoNoche, setModoNoche] = useState(() => {
    try {
      const temaGuardado = localStorage.getItem('multimak_tema');
      if (temaGuardado !== null) return temaGuardado === 'dark';
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    localStorage.setItem('multimak_tema', modoNoche ? 'dark' : 'light');
    if (modoNoche) {
      document.documentElement.classList.add('dark-mode');
      document.body.classList.add('dark-mode');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark-mode');
      document.body.classList.remove('dark-mode');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, [modoNoche]);

  const alternarModoNoche = () => {
    setModoNoche(prev => !prev);
  };

  const iniciarSesion = (datos) => {
    const infoUsuario = datos?.usuario ? datos.usuario : datos;
    setUsuario(infoUsuario);
    localStorage.setItem('usuario_multimak', JSON.stringify(infoUsuario));
  };

  const cerrarSesion = () => {
    setUsuario(null);
    localStorage.removeItem('usuario_multimak');   // solo la sesión: se conserva el modo día/noche
  };

  const rolCrudo = (
    usuario?.rol || 
    usuario?.id_rol?.rol || 
    usuario?.id_rol || 
    usuario?.tipo || 
    ''
  ).toString().toLowerCase();

  const esAdmin = rolCrudo.includes('admin');
  const esOperador = rolCrudo.includes('operador') || rolCrudo.includes('chofer');
  const esContador = rolCrudo.includes('contador') || rolCrudo.includes('contab') || rolCrudo.includes('finan');

  if (!usuario) {
    return <InicioSesion onLogin={iniciarSesion} />;
  }

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      backgroundColor: modoNoche ? '#0b0f19' : '#f8fafc',
      color: modoNoche ? '#f8fafc' : '#0f172a',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      overflowX: 'hidden'
    }}>
      {/* BARRA DE NAVEGACIÓN SUPERIOR UNIFICADA */}
      <header style={{
        backgroundColor: modoNoche ? '#111827' : '#ffffff',
        borderBottom: modoNoche ? '1px solid #1f2937' : '1px solid #e2e8f0',
        padding: '0 24px',
        height: '64px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: modoNoche ? '0 4px 20px rgba(0,0,0,0.4)' : '0 2px 10px rgba(15,23,42,0.03)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            backgroundColor: '#f59e0b',
            color: '#0f172a',
            fontWeight: '900',
            fontSize: '18px',
            width: '36px',
            height: '36px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.35)'
          }}>
            M
          </div>
          <div>
            <div style={{
              fontSize: '15px',
              fontWeight: '900',
              color: modoNoche ? '#f8fafc' : '#0f172a',
              lineHeight: 1.1
            }}>
              MULTIMAK <span style={{ color: '#d97706' }}>360</span>
            </div>
            <div style={{
              fontSize: '10px',
              fontWeight: '800',
              color: modoNoche ? '#94a3b8' : '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.04em'
            }}>
              {esAdmin && 'Panel de Administrador'}
              {esOperador && 'Terminal de Faena'}
              {esContador && 'Módulo Contable'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* ÚNICO BOTÓN MODO NOCHE / DÍA DE LA APLICACIÓN */}
          <button
            onClick={alternarModoNoche}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: modoNoche ? '#1e293b' : '#f1f5f9',
              border: modoNoche ? '1px solid #334155' : '1px solid #cbd5e1',
              color: modoNoche ? '#f8fafc' : '#334155',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            <span>{modoNoche ? '☀️' : '🌙'}</span>
            <span>{modoNoche ? 'Día' : 'Noche'}</span>
          </button>

          {/* FICHA DE USUARIO UNIFICADA (SIN REPETIR ROL) */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: modoNoche ? '#1e293b' : '#f1f5f9',
            padding: '6px 14px',
            borderRadius: '20px'
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
            <span style={{
              fontSize: '12px',
              fontWeight: '700',
              color: modoNoche ? '#f8fafc' : '#0f172a'
            }}>
              {usuario.nombre || 'Usuario'} {usuario.apellido || ''}
            </span>
          </div>

          <button
            onClick={cerrarSesion}
            style={{
              backgroundColor: 'transparent',
              border: modoNoche ? '1px solid #475569' : '1px solid #cbd5e1',
              color: modoNoche ? '#cbd5e1' : '#64748b',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      {/* CONTENEDOR PRINCIPAL FLUIDO A ANCHO COMPLETO */}
      <main style={{ flex: 1, width: '100%', padding: '0', boxSizing: 'border-box' }}>
        {esAdmin && <VistaAdmin modoNoche={modoNoche} />}
        {esOperador && <VistaOperador operador={usuario} modoNoche={modoNoche} />}
        {esContador && <VistaContador modoNoche={modoNoche} />}
      </main>
    </div>
  );
}