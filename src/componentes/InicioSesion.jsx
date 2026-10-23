import React, { useState } from 'react';
import axios from '../api/axios';

// Función para formatear el RUT chileno automáticamente mientras se escribe
function formatearRutInput(valor) {
    // Solo permitir números y la letra K
    const limpio = valor.replace(/[^0-9kK]/g, '').toUpperCase();
    if (limpio.length === 0) return '';
    if (limpio.length === 1) return limpio;

    // Separar cuerpo y dígito verificador
    const cuerpo = limpio.slice(0, -1).slice(0, 8); // máximo 8 dígitos de cuerpo
    const dv = limpio.slice(-1);

    // Formatear con puntos
    const cuerpoFormateado = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${cuerpoFormateado}-${dv}`;
}

export default function InicioSesion({ onLogin }) {
    const [rut, setRut] = useState('');
    const [contraseña, setContraseña] = useState('');
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState('');

    const manejarCambioRut = (e) => {
        const formateado = formatearRutInput(e.target.value);
        setRut(formateado);
    };

    const manejarEnvio = async (e) => {
        e.preventDefault();
        setError('');
        setCargando(true);

        const rutFormateado = rut.trim();
        const rutSinPuntos = rutFormateado.replace(/\./g, '');
        const claveLimpia = contraseña.trim();

        try {
            // Intento 1: con el formato con puntos (ej: 11.111.111-1)
            let res;
            try {
                res = await axios.post('/api/login/', { rut: rutFormateado, contraseña: claveLimpia });
            } catch (err1) {
                // Intento 2: sin puntos (ej: 11111111-1) por si el backend lo guarda directo
                try {
                    res = await axios.post('/api/login/', { rut: rutSinPuntos, contraseña: claveLimpia });
                } catch (err2) {
                    // Intento 3: fallback a login-operador
                    res = await axios.post('/api/login-operador/', { rut: rutFormateado, contraseña: claveLimpia });
                }
            }

            if (res && res.data) {
                onLogin(res.data);
            }
        } catch (errFinal) {
            const msg = errFinal.response?.data?.error || 'RUT o contraseña incorrectos.';
            setError(msg);
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
            backgroundColor: '#f1f5f9',
            padding: '20px',
            boxSizing: 'border-box'
        }}>
            <div style={{
                backgroundColor: '#ffffff',
                borderRadius: '24px',
                padding: '36px 32px',
                width: '100%',
                maxWidth: '400px',
                boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.08)',
                border: '1px solid #e2e8f0',
                boxSizing: 'border-box'
            }}>
                {/* Cabecera */}
                <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                    <div style={{
                        backgroundColor: '#f59e0b',
                        color: '#0f172a',
                        fontWeight: '900',
                        fontSize: '22px',
                        width: '48px',
                        height: '48px',
                        borderRadius: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 12px'
                    }}>
                        M
                    </div>
                    <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#0f172a', margin: 0, letterSpacing: '-0.02em' }}>
                        MULTIMAK <span style={{ color: '#d97706' }}>360</span>
                    </h2>
                    <p style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                        Acceso al Sistema de Gestión de Maquinaria
                    </p>
                </div>

                {error && (
                    <div style={{
                        backgroundColor: '#fee2e2',
                        color: '#991b1b',
                        border: '1px solid #fca5a5',
                        padding: '10px 14px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '700',
                        marginBottom: '18px',
                        textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={manejarEnvio} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                            RUT de Usuario
                        </label>
                        <input
                            type="text"
                            required
                            maxLength={12}
                            placeholder="11.111.111-1"
                            value={rut}
                            onChange={manejarCambioRut}
                            style={{
                                width: '100%',
                                height: '44px',
                                padding: '0 14px',
                                borderRadius: '12px',
                                border: '1px solid #cbd5e1',
                                fontSize: '14px',
                                fontFamily: 'Consolas, monospace',
                                fontWeight: '700',
                                color: '#0f172a',
                                outline: 'none',
                                boxSizing: 'border-box',
                                backgroundColor: '#f8fafc'
                            }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                            Contraseña
                        </label>
                        <input
                            type="password"
                            required
                            maxLength={30}
                            placeholder="••••••••"
                            value={contraseña}
                            onChange={(e) => setContraseña(e.target.value)}
                            style={{
                                width: '100%',
                                height: '44px',
                                padding: '0 14px',
                                borderRadius: '12px',
                                border: '1px solid #cbd5e1',
                                fontSize: '14px',
                                color: '#0f172a',
                                outline: 'none',
                                boxSizing: 'border-box',
                                backgroundColor: '#f8fafc'
                            }}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={cargando}
                        style={{
                            height: '46px',
                            backgroundColor: '#f59e0b',
                            color: '#0f172a',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '13px',
                            fontWeight: '800',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            cursor: cargando ? 'not-allowed' : 'pointer',
                            marginTop: '6px',
                            boxShadow: '0 6px 16px -2px rgba(245, 158, 11, 0.4)'
                        }}
                    >
                        {cargando ? 'Verificando...' : 'Iniciar Sesión'}
                    </button>
                </form>
            </div>
        </div>
    );
}