import React, { useState } from 'react';
import InicioSesion from './componentes/InicioSesion.jsx';
import VistaOperador from './componentes/VistaOperador.jsx';
import PanelAdmin from './componentes/PanelAdmin.jsx';

export default function App() {
  const [usuarioActual, setUsuarioActual] = useState(null);

  if (!usuarioActual) {
    return <InicioSesion alIniciarSesion={(datos) => setUsuarioActual(datos)} />;
  }

  const cerrarSesion = () => {
    setUsuarioActual(null);
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f1f5f9' }}>
      <header
        style={{
          background: '#0f172a',
          color: 'white',
          padding: '12px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontWeight: 'bold', fontSize: '18px', letterSpacing: '0.5px' }}>
            MULTIMAK 360
          </span>
          <span style={{ fontSize: '13px', color: '#94a3b8' }}>
            {usuarioActual.rol === 'admin' ? 'Panel de Administración' : 'Módulo de Terreno (Operadores)'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '13px', color: '#e2e8f0' }}>
            Usuario: <strong>{usuarioActual.nombre_completo || usuarioActual.username}</strong>
          </span>
          <button
            type="button"
            onClick={cerrarSesion}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #475569',
              background: '#1e293b',
              color: '#e2e8f0',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            Cerrar Sesión
          </button>
        </div>
      </header>

      <main style={{ padding: '24px 16px' }}>
        {usuarioActual.rol === 'admin' ? (
          <PanelAdmin />
        ) : (
          <VistaOperador usuarioActual={usuarioActual} />
        )}
      </main>
    </div>
  );
}