import React, { useState } from 'react';
import axios from '../api/axios';
import '../styles/InicioSesion.css';

function formatearRutInput(valor) {
    const limpio = valor.replace(/[^0-9kK]/g, '').toUpperCase();
    if (limpio.length === 0) return '';
    if (limpio.length === 1) return limpio;

    const cuerpo = limpio.slice(0, -1).slice(0, 8);
    const dv = limpio.slice(-1);
    const cuerpoFormateado = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${cuerpoFormateado}-${dv}`;
}

export default function InicioSesion({ onLogin }) {
    const [rut, setRut] = useState('');
    const [contraseña, setContraseña] = useState('');
    const [mostrarClave, setMostrarClave] = useState(false);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState('');

    const manejarCambioRut = (e) => {
        setRut(formatearRutInput(e.target.value));
    };

    const manejarEnvio = async (e) => {
        e.preventDefault();
        if (cargando) return; // evita dobles envíos
        setError('');
        setCargando(true);

        const rutFormateado = rut.trim();
        const claveLimpia = contraseña.trim();

        try {
            // Una sola petición: el servidor acepta el RUT con o sin puntos y guion
            // y atiende a todos los roles (administrador, contador y operador).
            const res = await axios.post('/login/', { rut: rutFormateado, contraseña: claveLimpia });

            if (res && res.data && res.data.rol) {
                onLogin(res.data);
            } else {
                setError('Respuesta inesperada del servidor. Intenta nuevamente.');
            }
        } catch (err) {
            if (err.response) {
                const { status, data } = err.response;
                if (status === 400 || status === 401) {
                    setError(data?.error || 'RUT o contraseña incorrectos.');
                } else {
                    setError(data?.error || 'Error del servidor. Intenta nuevamente en unos minutos.');
                }
            } else if (err.request) {
                setError('No hay conexión con el servidor. Revisa tu internet e intenta nuevamente.');
            } else {
                setError('No se pudo iniciar sesión. Intenta nuevamente.');
            }
        } finally {
            setCargando(false);
        }
    };

    return (
        <div className="login-container">
            {/* PANEL LATERAL: IDENTIDAD OPERACIONAL */}
            <div className="login-hero">
                <div className="login-hero-bg" />

                <div className="login-brand">
                    <div className="login-brand-logo">M</div>
                    <div>
                        <div className="login-brand-title">
                            MULTIMAK <span>360</span>
                        </div>
                        <div className="login-brand-subtitle">
                            Arriendo de Maquinaria Pesada & Servicios
                        </div>
                    </div>
                </div>

                <div className="login-hero-content">
                    <h1 className="login-hero-title">
                        Control de Flota y Gestión Operativa
                    </h1>

                    <p className="login-hero-desc">
                        Plataforma centralizada para el seguimiento diario de horómetros, administración de pautas de mantenimiento y control de faenas en terreno.
                    </p>
                </div>

                <div className="login-hero-footer">
                    <span className="footer-muted">MULTIMAK SpA • Puerto Natales / Punta Arenas</span>
                    <span className="footer-tech">Sistema Interno</span>
                </div>
            </div>

            {/* PANEL DERECHO: FORMULARIO */}
            <div className="login-panel">
                <div className="login-box">
                    <div className="login-box-header">
                        <h2 className="login-box-title">Iniciar Sesión</h2>
                        <p className="login-box-desc">
                            Ingresa con tu RUT y contraseña para acceder al sistema.
                        </p>
                    </div>

                    {error && <div className="login-error-alert">{error}</div>}

                    <form onSubmit={manejarEnvio} className="login-form">
                        <div className="form-group">
                            <label className="form-group-label">RUT</label>
                            <input
                                type="text"
                                required
                                maxLength={12}
                                placeholder="11.111.111-1"
                                value={rut}
                                onChange={manejarCambioRut}
                                className="login-input login-input-rut"
                                autoFocus
                            />
                        </div>

                        <div className="form-group">
                            <div className="form-group-header">
                                <label className="form-group-label">Contraseña</label>
                                <button
                                    type="button"
                                    onClick={() => setMostrarClave(!mostrarClave)}
                                    className="btn-toggle-pass"
                                >
                                    {mostrarClave ? 'Ocultar' : 'Ver'}
                                </button>
                            </div>
                            <input
                                type={mostrarClave ? 'text' : 'password'}
                                required
                                maxLength={40}
                                placeholder="••••••••"
                                value={contraseña}
                                onChange={(e) => setContraseña(e.target.value)}
                                className="login-input"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={cargando}
                            className="btn-login-submit"
                        >
                            {cargando ? 'Ingresando...' : 'Entrar'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}