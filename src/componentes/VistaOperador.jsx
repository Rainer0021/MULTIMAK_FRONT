import React, { useState, useEffect } from 'react';
import axios from '../api/axios';

export default function VistaOperador({ operador }) {
    const [maquinarias, setMaquinarias] = useState([]);
    const [idMaquina, setIdMaquina] = useState('');
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [horaEntrada, setHoraEntrada] = useState('08:00');
    const [horaSalida, setHoraSalida] = useState('18:00');
    const [horometroInicial, setHorometroInicial] = useState('0.0');
    const [horometroFinal, setHorometroFinal] = useState('');
    const [combustible, setCombustible] = useState('0');
    const [firmado, setFirmado] = useState(false);
    const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        axios.get('/api/maquinarias/')
            .then((res) => {
                setMaquinarias(res.data);
                if (res.data.length > 0) {
                    seleccionarMaquina(res.data[0]);
                }
            })
            .catch((err) => console.error(err));
    }, []);

    const seleccionarMaquina = (maq) => {
        setIdMaquina(maq.id_maquina);
        if (maq.horometro_actual !== undefined) {
            setHorometroInicial(maq.horometro_actual.toString());
        }
    };

    const ini = parseFloat(horometroInicial) || 0;
    const fin = parseFloat(horometroFinal) || 0;
    const litComb = parseFloat(combustible) || 0;

    const horasCalculadas = (fin > ini && ini >= 0 && fin >= 0)
        ? Math.round((fin - ini) * 10) / 10
        : 0;

    const validarTurno = () => {
        if (!horaEntrada || !horaSalida) return 'Ingresa las horas de entrada y salida.';
        const [hE, mE] = horaEntrada.split(':').map(Number);
        const [hS, mS] = horaSalida.split(':').map(Number);
        const minEntrada = hE * 60 + mE;
        const minSalida = hS * 60 + mS;

        if (minSalida <= minEntrada) return 'La hora de salida debe ser posterior a la de entrada.';
        if ((minSalida - minEntrada) / 60 > 24) return 'El turno de reloj no puede superar las 24 horas.';
        return null;
    };

    const guardarReport = async (e) => {
        e.preventDefault();
        setMensaje({ tipo: '', texto: '' });

        const errTurno = validarTurno();
        if (errTurno) {
            setMensaje({ tipo: 'error', texto: errTurno });
            return;
        }

        if (ini < 0 || fin < 0) {
            setMensaje({ tipo: 'error', texto: 'Los horómetros no pueden contener valores negativos.' });
            return;
        }

        if (fin <= ini) {
            setMensaje({ tipo: 'error', texto: 'El horómetro final debe ser mayor al inicial.' });
            return;
        }

        if (horasCalculadas > 24) {
            setMensaje({
                tipo: 'error',
                texto: `La jornada (${horasCalculadas} hrs) excede el máximo de 24 horas permitidas por turno.`
            });
            return;
        }

        if (litComb < 0) {
            setMensaje({ tipo: 'error', texto: 'El combustible no puede ser negativo.' });
            return;
        }

        if (!firmado) {
            setMensaje({ tipo: 'error', texto: 'Confirma la firma del supervisor para continuar.' });
            return;
        }

        setGuardando(true);
        const payload = {
            id_contrato: 1,
            id_operador: operador.id_operador,
            id_maquina: parseInt(idMaquina),
            id_hes: null,
            fecha: fecha,
            hora_entrada: horaEntrada,
            hora_salida: horaSalida,
            horometro_inicial: ini,
            horometro_final: fin,
            horas_trabajadas: Math.round(horasCalculadas),
            combustible: litComb,
            firmado: firmado
        };

        try {
            await axios.post('/api/reports/', payload);
            setMensaje({ tipo: 'exito', texto: 'Reporte registrado y enviado con éxito.' });
            setHorometroInicial(fin.toString());
            setHorometroFinal('');
            setCombustible('0');
            setFirmado(false);
        } catch (err) {
            setMensaje({ tipo: 'error', texto: 'Error al conectar con el servidor.' });
        } finally {
            setGuardando(false);
        }
    };

    const inputStyle = {
        width: '100%',
        height: '38px',
        padding: '0 11px',
        backgroundColor: '#ffffff',
        color: '#0f172a',
        border: '1px solid #cbd5e1',
        borderRadius: '4px',
        fontSize: '13px',
        fontWeight: '500',
        outline: 'none',
        boxSizing: 'border-box'
    };

    const labelStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        height: '18px',
        fontSize: '11px',
        fontWeight: '700',
        color: '#334155',
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
        marginBottom: '6px'
    };

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#e2e8f0',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            padding: '32px 16px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            boxSizing: 'border-box'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '820px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
                overflow: 'hidden'
            }}>

                {/* Cabecera Técnica */}
                <div style={{
                    padding: '14px 22px',
                    backgroundColor: '#0f172a',
                    color: '#ffffff',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '3px solid #d97706'
                }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                            <span style={{
                                backgroundColor: '#d97706',
                                color: '#ffffff',
                                fontSize: '10px',
                                fontWeight: '800',
                                padding: '2px 6px',
                                borderRadius: '3px',
                                letterSpacing: '0.04em'
                            }}>
                                FAENA
                            </span>
                            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', letterSpacing: '0.04em' }}>
                                MULTIMAK 360
                            </span>
                        </div>
                        <h1 style={{ fontSize: '17px', fontWeight: '700', margin: 0, color: '#f8fafc' }}>
                            Reporte Diario de Operación
                        </h1>
                    </div>

                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        padding: '5px 12px',
                        borderRadius: '4px'
                    }}>
                        <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#22c55e' }} />
                        <span style={{ fontSize: '12px', color: '#f1f5f9', fontWeight: '600' }}>
                            {operador.nombre}
                        </span>
                    </div>
                </div>

                {/* Notificaciones */}
                {mensaje.texto && (
                    <div style={{
                        margin: '14px 22px 0 22px',
                        padding: '9px 13px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '600',
                        backgroundColor: mensaje.tipo === 'exito' ? '#dcfce7' : '#fee2e2',
                        color: mensaje.tipo === 'exito' ? '#14532d' : '#991b1b',
                        border: `1px solid ${mensaje.tipo === 'exito' ? '#86efac' : '#fca5a5'}`
                    }}>
                        {mensaje.texto}
                    </div>
                )}

                {/* Formulario */}
                <form onSubmit={guardarReport} style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>

                        {/* Bloque Izquierdo */}
                        <div style={{
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '4px',
                            padding: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px'
                        }}>
                            <div>
                                <label style={labelStyle}>Maquinaria Asignada</label>
                                <select
                                    value={idMaquina}
                                    onChange={(e) => {
                                        const found = maquinarias.find((m) => m.id_maquina === parseInt(e.target.value));
                                        if (found) seleccionarMaquina(found);
                                    }}
                                    style={{ ...inputStyle, cursor: 'pointer' }}
                                >
                                    {maquinarias.map((m) => (
                                        <option key={m.id_maquina} value={m.id_maquina}>
                                            [{m.patente}] {m.tipo} — {m.marca} {m.modelo} ({m.horometro_actual}h)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={labelStyle}>Fecha de Registro</label>
                                <input
                                    type="date"
                                    value={fecha}
                                    onChange={(e) => setFecha(e.target.value)}
                                    style={inputStyle}
                                    required
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                    <label style={labelStyle}>Hora Entrada</label>
                                    <input
                                        type="time"
                                        value={horaEntrada}
                                        onChange={(e) => setHoraEntrada(e.target.value)}
                                        style={inputStyle}
                                        required
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Hora Salida</label>
                                    <input
                                        type="time"
                                        value={horaSalida}
                                        onChange={(e) => setHoraSalida(e.target.value)}
                                        style={inputStyle}
                                        required
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Bloque Derecho */}
                        <div style={{
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '4px',
                            padding: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px'
                        }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                    <label style={labelStyle}>
                                        Horómetro Inicial
                                        <span title="Dato de la base de datos" style={{ fontSize: '11px', color: '#94a3b8' }}></span>
                                    </label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={horometroInicial}
                                        readOnly
                                        tabIndex="-1"
                                        style={{
                                            ...inputStyle,
                                            backgroundColor: '#f1f5f9',
                                            color: '#475569',
                                            cursor: 'not-allowed',
                                            fontFamily: 'Consolas, monospace',
                                            fontWeight: '700'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Horómetro Final</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        min="0"
                                        value={horometroFinal}
                                        onChange={(e) => setHorometroFinal(e.target.value)}
                                        placeholder="0.0"
                                        style={{ ...inputStyle, fontFamily: 'Consolas, monospace', fontWeight: '600' }}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={labelStyle}>Combustible Cargado (Litros)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    value={combustible}
                                    onChange={(e) => setCombustible(e.target.value)}
                                    style={{ ...inputStyle, fontFamily: 'Consolas, monospace' }}
                                    required
                                />
                            </div>

                            {/* Indicador de Horas */}
                            <div style={{
                                height: '48px',
                                backgroundColor: '#0f172a',
                                border: '1px solid #1e293b',
                                borderRadius: '4px',
                                padding: '0 14px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                boxSizing: 'border-box'
                            }}>
                                <div>
                                    <span style={{
                                        display: 'block',
                                        fontSize: '10px',
                                        fontWeight: '800',
                                        color: '#ffffff',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em'
                                    }}>
                                        HORAS CALCULADAS
                                    </span>
                                    <span style={{
                                        fontSize: '11px',
                                        color: '#94a3b8',
                                        fontWeight: '500'
                                    }}>
                                        Jornada de faena
                                    </span>
                                </div>
                                <span style={{
                                    fontSize: '20px',
                                    fontWeight: '700',
                                    color: horasCalculadas > 24 ? '#f87171' : '#fbbf24',
                                    fontFamily: 'Consolas, monospace'
                                }}>
                                    {horasCalculadas} <span style={{ fontSize: '12px', fontWeight: '600', color: '#ffffff' }}>HRS</span>
                                </span>
                            </div>
                        </div>

                    </div>

                    {/* Barra de Firma y Botón */}
                    <div style={{
                        marginTop: '2px',
                        paddingTop: '14px',
                        borderTop: '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '9px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: '600',
                            color: '#1e293b'
                        }}>
                            <input
                                type="checkbox"
                                checked={firmado}
                                onChange={(e) => setFirmado(e.target.checked)}
                                style={{
                                    width: '17px',
                                    height: '17px',
                                    accentColor: '#0f172a',
                                    cursor: 'pointer'
                                }}
                                required
                            />
                            Firma y conformidad del supervisor
                        </label>

                        <button
                            type="submit"
                            disabled={guardando}
                            style={{
                                padding: '9px 22px',
                                backgroundColor: guardando ? '#64748b' : '#0f172a',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: '700',
                                letterSpacing: '0.03em',
                                textTransform: 'uppercase',
                                cursor: guardando ? 'not-allowed' : 'pointer'
                            }}
                        >
                            {guardando ? 'Guardando...' : 'Guardar Reporte'}
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}