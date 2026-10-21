import React, { useState } from 'react';
import VistaOperador from './componentes/VistaOperador';
import VistaAdmin from './componentes/VistaAdmin';

export default function App() {
  const [rolActual, setRolActual] = useState('operador');

  const operadorSesion = {
    id_operador: 1,
    nombre: 'Operador Terreno'
  };

  return (
    <div>
      {/* Barra de alternancia rápida */}
      <div style={{
        backgroundColor: '#0f172a',
        padding: '8px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #334155'
      }}>
        <span style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>
          MULTIMAK 360
        </span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setRolActual('operador')}
            style={{
              padding: '4px 10px',
              backgroundColor: rolActual === 'operador' ? '#f59e0b' : '#1e293b',
              color: rolActual === 'operador' ? '#0f172a' : '#cbd5e1',
              border: 'none',
              borderRadius: '2px',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '11px'
            }}
          >
            Operador
          </button>
          <button
            onClick={() => setRolActual('admin')}
            style={{
              padding: '4px 10px',
              backgroundColor: rolActual === 'admin' ? '#f59e0b' : '#1e293b',
              color: rolActual === 'admin' ? '#0f172a' : '#cbd5e1',
              border: 'none',
              borderRadius: '2px',
              cursor: 'pointer',
              fontWeight: '700',
              fontSize: '11px'
            }}
          >
            Administrador
          </button>
        </div>
      </div>

      {/* Renderizado de vistas */}
      {rolActual === 'operador' ? (
        <VistaOperador operador={operadorSesion} />
      ) : (
        <VistaAdmin />
      )}
    </div>
  );
}