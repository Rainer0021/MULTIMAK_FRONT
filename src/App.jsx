import React, { useState, useEffect } from 'react';
import InicioSesion from './componentes/InicioSesion';
import VistaOperador from './componentes/VistaOperador';
import VistaAdmin from './componentes/VistaAdmin';
import VistaContador from './componentes/VistaContador';
import './App.css';
import './styles/erp-theme.css';
import axios from './api/axios';

export default function App() {
  const [usuario, setUsuario] = useState(() => {
    try {
      const token = localStorage.getItem('token_multimak');
      const sesionGuardada = localStorage.getItem('usuario_multimak');
      // Si no existe el token, cerramos sesión de inmediato
      if (!token) return null;
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

  // ESCUCHADOR EN TIEMPO REAL: Detecta si el token se elimina o expira
  useEffect(() => {
    const verificarSesion = () => {
      const token = localStorage.getItem('token_multimak');
      if (!token) {
        setUsuario(null);
        localStorage.removeItem('usuario_multimak');
      }
    };

    // 1. Escucha borrados en el LocalStorage entre ventanas/pestañas
    const handleStorageChange = (e) => {
      if (e.key === 'token_multimak' && !e.newValue) {
        verificarSesion();
      }
    };

    // 2. Verifica la sesión cada vez que el usuario hace clic o vuelve a la ventana
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', verificarSesion);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', verificarSesion);
    };
  }, []);

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
    setUsuario(datos);
    localStorage.setItem('usuario_multimak', JSON.stringify(datos));
  };

  const cerrarSesion = () => {
    setUsuario(null);
    localStorage.removeItem('token_multimak');
    localStorage.removeItem('usuario_multimak');
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

  // Si no hay sesión o no hay token, renderiza la pantalla de Login directamente
  if (!usuario || !localStorage.getItem('token_multimak')) {
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
      <header className="app-top-header" style={{
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
        <div className="app-header-brand" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="app-header-logo" style={{
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
            boxShadow: '0 4px 12px rgba(245, 158, 11, 0.35)',
            flexShrink: 0
          }}>
            M
          </div>
          <div>
            <div className="app-header-title" style={{
              fontSize: '15px',
              fontWeight: '900',
              color: modoNoche ? '#f8fafc' : '#0f172a',
              lineHeight: 1.1
            }}>
              MULTIMAK <span style={{ color: '#d97706' }}>360</span>
            </div>
            <div className="app-header-subtitle" style={{
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

        <div className="app-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            className="app-btn-theme"
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
            <span className="app-btn-theme-label">{modoNoche ? 'Día' : 'Noche'}</span>
          </button>

          <div className="app-user-chip" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: modoNoche ? '#1e293b' : '#f1f5f9',
            padding: '6px 14px',
            borderRadius: '20px'
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e', flexShrink: 0 }} />
            <span className="app-user-name" style={{
              fontSize: '12px',
              fontWeight: '700',
              color: modoNoche ? '#f8fafc' : '#0f172a'
            }}>
              {usuario.nombre || 'Usuario'} {usuario.apellido || ''}
            </span>
          </div>

          <button
            className="app-btn-logout"
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

      <main style={{ flex: 1, width: '100%', padding: '0', boxSizing: 'border-box' }}>
        {esAdmin && <VistaAdmin modoNoche={modoNoche} />}
        {esOperador && <VistaOperador operador={usuario} modoNoche={modoNoche} />}
        {esContador && <VistaContador modoNoche={modoNoche} />}
      </main>
    </div>
  );
}