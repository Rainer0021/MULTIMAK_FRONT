import React, { useState } from 'react';
import api from '../api/axios';

export default function InicioSesion({ alIniciarSesion }) {
    const [usuario, setUsuario] = useState('');
    const [password, setPassword] = useState('');
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState(null);

    const manejarEnvio = async (e) => {
        e.preventDefault();
        setError(null);
        setCargando(true);

        try {
            const respuesta = await api.post('/login/', {
                username: usuario,
                password: password
            });

            // Pasamos los datos del usuario logueado al componente principal
            alIniciarSesion(respuesta.data);
        } catch (err) {
            console.error(err);
            if (err.response && err.response.data && err.response.data.error) {
                setError(err.response.data.error);
            } else {
                setError('Error al conectar con el servidor.');
            }
        } finally {
            setCargando(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#0f172a',
            fontFamily: 'sans-serif',
            padding: '16px'
        }}>
            <div style={{
                background: '#ffffff',
                width: '100%',
                maxWidth: '400px',
                padding: '32px 28px',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <h2 style={{ margin: '0 0 6px 0', color: '#0f172a', fontSize: '22px' }}>MULTIMAK 360</h2>
                    <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Control de Flota y Operaciones</p>
                </div>

                {error && (
                    <div style={{
                        background: '#fee2e2',
                        color: '#991b1b',
                        padding: '10px 14px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        marginBottom: '16px',
                        fontWeight: '500'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={manejarEnvio} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                            Nombre de Usuario:
                        </label>
                        <input
                            type="text"
                            value={usuario}
                            onChange={(e) => setUsuario(e.target.value)}
                            required
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                fontSize: '14px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
                            Contraseña:
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                fontSize: '14px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={cargando}
                        style={{
                            marginTop: '8px',
                            padding: '11px',
                            background: '#0284c7',
                            color: 'white',
                            fontSize: '14px',
                            fontWeight: '600',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: cargando ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {cargando ? 'Verificando...' : 'Iniciar Sesión'}
                    </button>
                </form>
            </div>
        </div>
    );
}