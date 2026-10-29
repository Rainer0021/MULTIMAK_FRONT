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
        setError('');
        setCargando(true);

        const rutFormateado = rut.trim();
        const rutSinPuntos = rutFormateado.replace(/\./g, '');
        const claveLimpia = contraseña.trim();

        try {
            let res;
            try {
                res = await axios.post('/login/', { rut: rutFormateado, contraseña: claveLimpia });
            } catch (err1) {
                try {
                    res = await axios.post('/login/', { rut: rutSinPuntos, contraseña: claveLimpia });
                } catch (err2) {
                    res = await axios.post('/login-operador/', { rut: rutFormateado, contraseña: claveLimpia });
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
                    <div className="login-badge">
                        <span className="login-badge-text">Terminal Operativo de Faena</span>
                    </div>

                    <h1 className="login-hero-title">
                        Control de flota, partes diarios y liquidación.
                    </h1>

                    <p className="login-hero-desc">
                        Registro diario de horómetros con validación en terreno, control de pautas de taller preventivo y emisión de facturación vinculada a HES aprobada.
                    </p>

                    <div className="login-metrics">
                        <div className="metric-card">
                            <div className="metric-label">Módulo Faena</div>
                            <div className="metric-value">Partes Diarios</div>
                            <div className="metric-sub">Firma de supervisor</div>
                        </div>

                        <div className="metric-card">
                            <div className="metric-label">Mantenimiento</div>
                            <div className="metric-value">500h / 1.000h</div>
                            <div className="metric-sub">Pautas de servicio</div>
                        </div>

                        <div className="metric-card">
                            <div className="metric-label">Administración</div>
                            <div className="metric-value">HES & DTE</div>
                            <div className="metric-sub">Conciliación mensual</div>
                        </div>
                    </div>
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
                        <span className="login-tag">Acceso al Sistema</span>
                        <h2 className="login-box-title">Iniciar Sesión</h2>
                        <p className="login-box-desc">
                            Ingresa con tu RUT y contraseña.
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