import React, { useState } from 'react';
import InicioSesion from './componentes/InicioSesion';
import VistaOperador from './componentes/VistaOperador';
import VistaAdmin from './componentes/VistaAdmin';
import VistaContador from './componentes/VistaContador';

export default function App() {
  const [usuario, setUsuario] = useState(() => {
    try {
      const sesionGuardada = localStorage.getItem('usuario_multimak');
      return sesionGuardada ? JSON.parse(sesionGuardada) : null;
    } catch (e) {
      return null;
    }
  });

  const iniciarSesion = (datos) => {
    const infoUsuario = datos?.usuario ? datos.usuario : datos;
    setUsuario(infoUsuario);
    localStorage.setItem('usuario_multimak', JSON.stringify(infoUsuario));
  };

  const cerrarSesion = () => {
    setUsuario(null);
    localStorage.removeItem('usuario_multimak');
    localStorage.clear();
  };

  // Detección de roles
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
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      {/* Barra superior de navegación */}
      <header style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '0 32px',
        height: '68px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            backgroundColor: '#f59e0b',
            color: '#0f172a',
            fontWeight: '900',
            fontSize: '18px',
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            M
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '900', color: '#0f172a', lineHeight: 1.1 }}>
              MULTIMAK <span style={{ color: '#d97706' }}>360</span>
            </div>
            <div style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>
              {esAdmin && 'Panel de Supervisión General'}
              {esOperador && 'Terminal de Faena'}
              {esContador && 'Módulo de Finanzas y Contabilidad'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#f1f5f9',
            padding: '6px 14px',
            borderRadius: '20px'
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#0f172a' }}>
              {usuario.nombre} {usuario.apellido || ''}
            </span>
            <span style={{
              fontSize: '10px',
              fontWeight: '800',
              textTransform: 'uppercase',
              backgroundColor: '#fef3c7',
              color: '#92400e',
              padding: '2px 8px',
              borderRadius: '6px'
            }}>
              {usuario.rol || 'Contador'}
            </span>
          </div>

          <button
            onClick={cerrarSesion}
            style={{
              backgroundColor: 'transparent',
              border: '1px solid #cbd5e1',
              color: '#64748b',
              padding: '6px 14px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Cerrar Sesión ✕
          </button>
        </div>
      </header>

      {/* Vistas según el rol */}
      <main style={{ flex: 1, width: '100%', padding: '32px', boxSizing: 'border-box' }}>
        {esAdmin && <VistaAdmin />}
        {esOperador && <VistaOperador operador={usuario} />}
        {esContador && <VistaContador />}
      </main>
    </div>
  );
}