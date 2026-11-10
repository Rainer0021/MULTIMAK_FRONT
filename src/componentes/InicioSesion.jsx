import React, { useState } from 'react';
import axios from '../api/axios';
import '../styles/InicioSesion.css';

function formatearRutInput(valor) {
    if (/[a-jl-z]/i.test(valor)) return valor;

    const limpio = valor.replace(/[^0-9kK]/g, '').toUpperCase();
    if (limpio.length === 0) return '';
    if (limpio.length === 1) return limpio;

    const cuerpo = limpio.slice(0, -1).slice(0, 8);
    const dv = limpio.slice(-1);
    const cuerpoFormateado = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${cuerpoFormateado}-${dv}`;
}

const MENSAJE_CLAVE_SEGURA = 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula y un número o símbolo.';

const claveEsSegura = (clave) =>
    clave.length >= 8
    && /[A-ZÁÉÍÓÚÑÜ]/.test(clave)
    && /[a-záéíóúñü]/.test(clave)
    && /[^A-Za-zÁÉÍÓÚÑÜáéíóúñü]/.test(clave);

export default function InicioSesion({ onLogin }) {
    const [rut, setRut] = useState('');
    const [contraseña, setContraseña] = useState('');
    const [mostrarClave, setMostrarClave] = useState(false);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState('');

    // Cambio obligatorio de contraseña 
    const [paso, setPaso] = useState('login'); // 'login' | 'cambiar'
    const [claveActual, setClaveActual] = useState('');
    const [claveNueva, setClaveNueva] = useState('');
    const [claveRepetida, setClaveRepetida] = useState('');

    const manejarCambioRut = (e) => {
        setRut(formatearRutInput(e.target.value));
    };

    const manejarEnvio = async (e) => {
    e.preventDefault();
    if (cargando) return;
    setError('');

    const rutFormateado = rut.trim();
    const claveLimpia = contraseña.trim();

    // Avisos propios (en lugar del globo del navegador)
    if (!rutFormateado && !claveLimpia) {
        setError('Ingresa tu RUT y tu contraseña.');
        return;
    }
    if (!rutFormateado) {
        setError('Ingresa tu RUT.');
        return;
    }
    if (!claveLimpia) {
        setError('Ingresa tu contraseña.');
        return;
    }

    setCargando(true);

    try {
        const res = await axios.post('/login/', { rut: rutFormateado, contraseña: claveLimpia });

        // Superusuario de Django: se redirige al panel /admin/ del backend
        if (res && res.data && res.data.es_superusuario) {
            const base = axios.defaults.baseURL || '';
            const origen = /^https?:/.test(base) ? new URL(base).origin : window.location.origin;
            window.location.href = `${origen}/api/admin-sso/?t=${encodeURIComponent(res.data.admin_sso_token)}`;
            return;
        }

        // Primer ingresodebe elegir una contraseña nueva
        if (res && res.data && res.data.debe_cambiar_clave) {
            setClaveActual(claveLimpia);
            setPaso('cambiar');
            return;
        }

        if (res && res.data && res.data.access) {
            // Guarda el token y los datos de usuario en localStorage
            localStorage.setItem('token_multimak', res.data.access);
            localStorage.setItem('usuario_multimak', JSON.stringify(res.data));

            onLogin(res.data);
        } else {
            setError('Respuesta inesperada del servidor. Intenta nuevamente.');
        }
    } catch (err) {
        if (err.response) {
            const { status, data } = err.response;
                        if (status === 400 || status === 401) {
                setError(data?.error || 'RUT o contraseña incorrectos.');
            } else if (status === 429) {
                setError('Demasiados intentos. Espera un minuto e intenta de nuevo.');
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

    const volverAlLogin = () => {
        setPaso('login');
        setClaveActual('');
        setClaveNueva('');
        setClaveRepetida('');
        setContraseña('');
        setMostrarClave(false);
        setError('');
    };

    const manejarCambioClave = async (e) => {
        e.preventDefault();
        if (cargando) return;
        setError('');

        const nueva = claveNueva.trim();
        const repetida = claveRepetida.trim();

        if (!nueva) {
            setError('Ingresa tu nueva contraseña.');
            return;
        }
        if (!claveEsSegura(nueva)) {
            setError(MENSAJE_CLAVE_SEGURA);
            return;
        }
        if (!repetida) {
            setError('Repite la nueva contraseña para confirmarla.');
            return;
        }
        if (nueva !== repetida) {
            setError('Las contraseñas no coinciden.');
            return;
        }
        if (nueva === claveActual) {
            setError('La nueva contraseña debe ser distinta de la que te entregó el administrador.');
            return;
        }

        setCargando(true);
        try {
            await axios.post('/cambiar-clave-inicial/', {
                rut: rut.trim(),
                contraseña_actual: claveActual,
                contraseña_nueva: nueva,
            });

            // Clave cambiada: se inicia sesión de inmediato con la clave nueva
            const res = await axios.post('/login/', { rut: rut.trim(), contraseña: nueva });

            if (res && res.data && res.data.access) {
                localStorage.setItem('token_multimak', res.data.access);
                localStorage.setItem('usuario_multimak', JSON.stringify(res.data));

                onLogin(res.data);
            } else {
                volverAlLogin();
                setError('Contraseña actualizada. Inicia sesión con tu nueva contraseña.');
            }
        } catch (err) {
            if (err.response) {
                setError(
                    err.response.status === 429
                        ? 'Demasiados intentos. Espera un minuto e intenta de nuevo.'
                        : (err.response.data?.error || 'No se pudo cambiar la contraseña. Intenta nuevamente.')
                );
            } else if (err.request) {
                setError('No hay conexión con el servidor. Revisa tu internet e intenta nuevamente.');
            } else {
                setError('No se pudo cambiar la contraseña. Intenta nuevamente.');
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
                            Arriendo de Maquinaria Pesada y Servicios
                        </div>
                    </div>
                </div>

                <div className="login-hero-content">
                    <h1 className="login-hero-title">
                        Control de Flota y Gestión Operativa
                    </h1>

                    <p className="login-hero-desc">
                        Plataforma para registrar horómetros, gestionar pautas de mantenimiento y controlar faenas en terreno.
                    </p>
                </div>

                <div className="login-hero-footer">
                    <span className="footer-muted">MULTIMAK SpA • Puerto Natales / Punta Arenas</span>
                    <span className="footer-tech">Sistema Interno</span>
                </div>
            </div>

            {/* FORMULARIO */}
            <div className="login-panel">
                <div className="login-box">
                    {paso === 'cambiar' ? (
                        <>
                            <div className="login-box-header">
                                <h2 className="login-box-title">Crea tu nueva contraseña</h2>
                                <p className="login-box-desc">
                                    Por seguridad, debes cambiar la contraseña que te entregó el administrador antes de continuar.
                                </p>
                            </div>

                            {error && <div className="login-error-alert">{error}</div>}

                            <form onSubmit={manejarCambioClave} className="login-form" noValidate>
                                <div className="form-group">
                                    <div className="form-group-header">
                                        <label className="form-group-label">Nueva contraseña</label>
                                        <button
                                            type="button"
                                            onClick={() => setMostrarClave(!mostrarClave)}
                                            className="btn-toggle-pass"
                                        >
                                            {mostrarClave ? 'Ocultar' : 'Mostrar'}
                                        </button>
                                    </div>
                                    <input
                                        type={mostrarClave ? 'text' : 'password'}
                                        maxLength={40}
                                        placeholder="Mínimo 8 caracteres"
                                        value={claveNueva}
                                        onChange={(e) => setClaveNueva(e.target.value)}
                                        className="login-input"
                                        autoComplete="new-password"
                                        autoFocus
                                    />
                                    <p className="login-box-desc" style={{ marginTop: '6px', fontSize: '11px' }}>
                                        Usa al menos 8 caracteres, con mayúscula, minúscula y un número o símbolo.
                                    </p>
                                </div>

                                <div className="form-group">
                                    <label className="form-group-label">Repite la nueva contraseña</label>
                                    <input
                                        type={mostrarClave ? 'text' : 'password'}
                                        maxLength={40}
                                        placeholder="Escríbela otra vez"
                                        value={claveRepetida}
                                        onChange={(e) => setClaveRepetida(e.target.value)}
                                        className="login-input"
                                        autoComplete="new-password"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={cargando}
                                    className="btn-login-submit"
                                >
                                    {cargando ? 'Guardando...' : 'Guardar y entrar'}
                                </button>

                                <button
                                    type="button"
                                    onClick={volverAlLogin}
                                    className="btn-toggle-pass"
                                    style={{ alignSelf: 'center' }}
                                >
                                    Volver al inicio de sesión
                                </button>
                            </form>
                        </>
                    ) : (
                    <>
                    <div className="login-box-header">
                        <h2 className="login-box-title">Iniciar sesión</h2>
                        <p className="login-box-desc">
                            Ingresa tu RUT y contraseña para continuar.
                        </p>
                    </div>

                    {error && <div className="login-error-alert">{error}</div>}

                    <form onSubmit={manejarEnvio} className="login-form" noValidate>
                        <div className="form-group">
                            <label className="form-group-label">RUT</label>
                            <input
                                type="text"
                                maxLength={150}
                                placeholder="12.345.678-5"
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
                                    {mostrarClave ? 'Ocultar' : 'Mostrar'}
                                </button>
                            </div>
                            <input
                                type={mostrarClave ? 'text' : 'password'}
                                maxLength={40}
                                placeholder="Tu contraseña"
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
                            {cargando ? 'Iniciando sesión...' : 'Iniciar sesión'}
                        </button>
                    </form>
                    </>
                    )}
                </div>
            </div>
        </div>
    );
}
