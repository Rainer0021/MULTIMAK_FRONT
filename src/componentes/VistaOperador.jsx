import React, { useState, useEffect, useRef } from 'react';
import axios from '../api/axios';

export default function VistaOperador({ operador }) {
    const [maquinarias, setMaquinarias] = useState([]);
    const [idMaquina, setIdMaquina] = useState('');
    const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
    const [horaEntrada, setHoraEntrada] = useState('08:00');
    const [horaSalida, setHoraSalida] = useState('18:00');
    const [horometroInicial, setHorometroInicial] = useState('0.0');
    const [horometroFinal, setHorometroFinal] = useState('');
    
    // Extensión combustible
    const [cargoCombustible, setCargoCombustible] = useState(false);
    const [combustible, setCombustible] = useState('0');
    
    // Validación: firma en pantalla o foto del papel
    const [modoFirma, setModoFirma] = useState('digital');
    const [archivoFoto, setArchivoFoto] = useState(null);
    const [firmadoCanvas, setFirmadoCanvas] = useState(false);

    // Mensaje global y errores en tiempo real por campo
    const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });
    const [errores, setErrores] = useState({});
    const [guardando, setGuardando] = useState(false);

    const canvasRef = useRef(null);
    const dibujandoRef = useRef(false);

    const estaValidado = modoFirma === 'digital' ? firmadoCanvas : Boolean(archivoFoto);

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
    const litComb = cargoCombustible ? (parseFloat(combustible) || 0) : 0;

    const horasCalculadas = (fin > ini && ini >= 0 && fin >= 0)
        ? Math.round((fin - ini) * 10) / 10
        : 0;

    // Cálculo de la duración del turno de reloj (en horas)
    const getHorasTurnoReloj = () => {
        if (!horaEntrada || !horaSalida) return 0;
        const [hE, mE] = horaEntrada.split(':').map(Number);
        const [hS, mS] = horaSalida.split(':').map(Number);
        const minEntrada = hE * 60 + mE;
        const minSalida = hS * 60 + mS;
        if (minSalida <= minEntrada) return 0;
        return (minSalida - minEntrada) / 60;
    };

    const horasTurnoReloj = getHorasTurnoReloj();

    // Validación inline inmediata
    const validarCampos = () => {
        const nuevosErrores = {};

        if (!horaEntrada || !horaSalida) {
            nuevosErrores.horario = 'Completa ambas horas de la jornada.';
        } else {
            const [hE, mE] = horaEntrada.split(':').map(Number);
            const [hS, mS] = horaSalida.split(':').map(Number);
            const minEntrada = hE * 60 + mE;
            const minSalida = hS * 60 + mS;

            if (minSalida <= minEntrada) {
                nuevosErrores.horario = 'La salida debe ser posterior a la entrada.';
            } else if ((minSalida - minEntrada) / 60 > 24) {
                nuevosErrores.horario = 'El turno no puede exceder las 24 hrs.';
            }
        }

        if (horometroFinal !== '') {
            if (fin < 0) {
                nuevosErrores.horometroFinal = 'No puedes poner valores negativos.';
            } else if (fin <= ini) {
                nuevosErrores.horometroFinal = `El horómetro final debe ser mayor a ${ini}.`
            } else if (horasCalculadas > 24) {
                nuevosErrores.horometroFinal = 'El turno no puede pasar de 24 horas continuas.';
            } else if (horasTurnoReloj > 0 && horasCalculadas > horasTurnoReloj) {
                nuevosErrores.horometroFinal = `Las horas de máquina (${horasCalculadas} hrs) superan el tiempo del turno (${horasTurnoReloj.toFixed(1)} hrs).`;
            }
        } else {
            nuevosErrores.horometroFinal = 'Ingresa el horómetro de cierre.';
        }

        if (cargoCombustible && litComb < 0) {
            nuevosErrores.combustible = 'Los litros no pueden ser negativos.';
        }

        if (!estaValidado) {
            nuevosErrores.firma = modoFirma === 'digital'
                ? 'Falta firma del supervisor en el recuadro.'
                : 'Falta adjuntar la foto del reporte en papel.';
        }

        setErrores(nuevosErrores);
        return Object.keys(nuevosErrores).length === 0;
    };

    // Funciones de dibujo precisas
    const getCoordenadas = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const iniciarDibujo = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const { x, y } = getCoordenadas(e);
        
        ctx.beginPath();
        ctx.moveTo(x, y);
        dibujandoRef.current = true;
    };

    const terminarDibujo = () => {
        if (!dibujandoRef.current) return;
        dibujandoRef.current = false;
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.closePath();
            setFirmadoCanvas(true);
            setErrores((prev) => ({ ...prev, firma: null }));
        }
    };

    const dibujar = (e) => {
        if (!dibujandoRef.current) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const { x, y } = getCoordenadas(e);

        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '#0f172a';

        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const limpiarFirma = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.beginPath();
            setFirmadoCanvas(false);
        }
    };

    const cambiarModo = (modo) => {
        setModoFirma(modo);
        setFirmadoCanvas(false);
        setArchivoFoto(null);
        setErrores((prev) => ({ ...prev, firma: null }));
        if (modo === 'digital') {
            setTimeout(() => limpiarFirma(), 50);
        }
    };

    const guardarReport = async (e) => {
        e.preventDefault();
        setMensaje({ tipo: '', texto: '' });

        if (!validarCampos()) {
            setMensaje({ tipo: 'error', texto: 'Revisa los campos destacados antes de guardar.' });
            return;
        }

        setGuardando(true);
        const payload = {
            id_contrato: 1,
            id_operador: operador?.id_operador || 1,
            id_maquina: parseInt(idMaquina),
            id_hes: null,
            fecha: fecha,
            hora_entrada: horaEntrada,
            hora_salida: horaSalida,
            horometro_inicial: ini,
            horometro_final: fin,
            horas_trabajadas: Math.round(horasCalculadas),
            combustible_litros: litComb,
            firmado: true
        };

        try {
            await axios.post('/api/reports/', payload);
            setMensaje({ tipo: 'exito', texto: 'Reporte de turno registrado con éxito.' });
            setHorometroInicial(fin.toString());
            setHorometroFinal('');
            setCombustible('0');
            setCargoCombustible(false);
            setArchivoFoto(null);
            setErrores({});
            if (modoFirma === 'digital') limpiarFirma();
        } catch (err) {
            setMensaje({ tipo: 'error', texto: 'Error al conectar con el servidor.' });
        } finally {
            setGuardando(false);
        }
    };

    const getInputStyle = (error) => ({
        width: '100%',
        height: '38px',
        padding: '0 11px',
        backgroundColor: '#ffffff',
        color: '#0f172a',
        border: `1px solid ${error ? '#ef4444' : '#cbd5e1'}`,
        borderRadius: '4px',
        fontSize: '13px',
        fontWeight: '500',
        outline: 'none',
        boxSizing: 'border-box',
        transition: 'border-color 0.15s ease'
    });

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
                            {operador?.nombre || 'Operador Terreno'}
                        </span>
                    </div>
                </div>

                {/* Banner de Notificación Integrado */}
                {mensaje.texto && (
                    <div style={{
                        margin: '14px 22px 0 22px',
                        padding: '10px 14px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        backgroundColor: mensaje.tipo === 'exito' ? '#dcfce7' : '#fef2f2',
                        color: mensaje.tipo === 'exito' ? '#15803d' : '#b91c1c',
                        border: `1px solid ${mensaje.tipo === 'exito' ? '#86efac' : '#fca5a5'}`
                    }}>
                        <span>{mensaje.tipo === 'exito' ? '✓' : '⚠'}</span>
                        <span>{mensaje.texto}</span>
                    </div>
                )}

                {/* Formulario */}
                <form
                    onSubmit={guardarReport}
                    noValidate
                    style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}
                >
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px', alignItems: 'stretch' }}>

                        {/* Bloque Izquierdo */}
                        <div style={{
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '4px',
                            padding: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
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
                                    style={{ ...getInputStyle(false), cursor: 'pointer' }}
                                >
                                    {maquinarias.map((m) => (
                                        <option key={m.id_maquina} value={m.id_maquina}>
                                            [{m.patente}] {m.tipo} — {m.marca} {m.modelo}
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
                                    style={getInputStyle(false)}
                                />
                            </div>

                            <div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                    <label style={labelStyle}>Hora Entrada</label>
                                    <input
                                        type="time"
                                        value={horaEntrada}
                                        onChange={(e) => {
                                            setHoraEntrada(e.target.value);
                                            setErrores((prev) => ({ ...prev, horario: null }));
                                        }}
                                        style={getInputStyle(errores.horario)}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Hora Salida</label>
                                    <input
                                        type="time"
                                        value={horaSalida}
                                        onChange={(e) => {
                                            setHoraSalida(e.target.value);
                                            setErrores((prev) => ({ ...prev, horario: null }));
                                        }}
                                        style={getInputStyle(errores.horario)}
                                    />
                                </div>
                            </div>
                            {errores.horario && (
                                <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: '600', marginTop: '4px', display: 'block' }}>
                                    {errores.horario}
                                </span>
                            )}
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
                        justifyContent: 'space-between',
                        gap: '12px'
                    }}>
                        <div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                    <label style={labelStyle}>Horómetro Inicial</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={horometroInicial}
                                        readOnly
                                        tabIndex="-1"
                                        style={{
                                            ...getInputStyle(false),
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
                                        value={horometroFinal}
                                        onChange={(e) => {
                                            setHorometroFinal(e.target.value);
                                            setErrores((prev) => ({ ...prev, horometroFinal: null }));
                                        }}
                                        placeholder="0.0"
                                        style={{
                                            ...getInputStyle(errores.horometroFinal),
                                            fontFamily: 'Consolas, monospace',
                                            fontWeight: '600'
                                        }}
                                    />
                                </div>
                            </div>
                            {errores.horometroFinal && (
                                <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: '600', marginTop: '4px', display: 'block' }}>
                                    {errores.horometroFinal}
                                </span>
                            )}
                        </div>

                        {/* Carga de Combustible */}
                        <div style={{
                            borderTop: '1px solid #e2e8f0',
                            paddingTop: '8px'
                        }}>
                            <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                cursor: 'pointer',
                                fontSize: '11px',
                                fontWeight: '700',
                                color: '#334155',
                                letterSpacing: '0.03em',
                                textTransform: 'uppercase'
                            }}>
                                <input
                                    type="checkbox"
                                    checked={cargoCombustible}
                                    onChange={(e) => {
                                        setCargoCombustible(e.target.checked);
                                        if (!e.target.checked) setCombustible('0');
                                        setErrores((prev) => ({ ...prev, combustible: null }));
                                    }}
                                    style={{
                                        width: '15px',
                                        height: '15px',
                                        accentColor: '#0f172a',
                                        cursor: 'pointer'
                                    }}
                                />
                                Registrar Combustible
                            </label>

                            {cargoCombustible && (
                                <div style={{ marginTop: '8px' }}>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={combustible}
                                        onChange={(e) => {
                                            setCombustible(e.target.value);
                                            setErrores((prev) => ({ ...prev, combustible: null }));
                                        }}
                                        placeholder="Litros cargados"
                                        style={{
                                            ...getInputStyle(errores.combustible),
                                            fontFamily: 'Consolas, monospace'
                                        }}
                                    />
                                    {errores.combustible && (
                                        <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: '600', marginTop: '4px', display: 'block' }}>
                                            {errores.combustible}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Resumen de Horas */}
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
                                    Total del turno
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

                {/* Visto Bueno y Conformidad */}
                <div style={{
                    marginTop: '4px',
                    paddingTop: '14px',
                    borderTop: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ ...labelStyle, marginBottom: 0 }}>
                            V°B° SUPERVISOR EN TERRENO
                        </label>

                        <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                                type="button"
                                onClick={() => cambiarModo('digital')}
                                style={{
                                    background: modoFirma === 'digital' ? '#0f172a' : '#f1f5f9',
                                    color: modoFirma === 'digital' ? '#ffffff' : '#475569',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '3px',
                                    padding: '4px 9px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    cursor: 'pointer'
                                }}
                            >
                                Firma en Pantalla
                            </button>
                            <button
                                type="button"
                                onClick={() => cambiarModo('fisico')}
                                style={{
                                    background: modoFirma === 'fisico' ? '#0f172a' : '#f1f5f9',
                                    color: modoFirma === 'fisico' ? '#ffffff' : '#475569',
                                    border: '1px solid #cbd5e1',
                                    borderRadius: '3px',
                                    padding: '4px 9px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    cursor: 'pointer'
                                }}
                            >
                                Foto de Hoja Física
                            </button>
                        </div>
                    </div>

                    {/* MODO DIGITAL */}
                    {modoFirma === 'digital' ? (
                        <div style={{
                            backgroundColor: '#f8fafc',
                            border: `1px solid ${errores.firma ? '#fca5a5' : '#e2e8f0'}`,
                            borderRadius: '4px',
                            padding: '14px 16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '14px' }}>
                                <span style={{ fontSize: '11px', color: '#475569', lineHeight: '1.4', fontWeight: '500' }}>
                                    Certifico la conformidad de las horas de operación, horómetros y trabajos ejecutados en este turno conforme a la faena realizada.
                                </span>
                                <button
                                    type="button"
                                    onClick={limpiarFirma}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#ef4444',
                                        fontSize: '10px',
                                        fontWeight: '700',
                                        cursor: 'pointer',
                                        letterSpacing: '0.03em',
                                        textTransform: 'uppercase',
                                        padding: 0,
                                        flexShrink: 0
                                    }}
                                >
                                    Borrar firma
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{
                                    width: '100%',
                                    maxWidth: '440px',
                                    border: firmadoCanvas ? '1px solid #16a34a' : (errores.firma ? '1px solid #ef4444' : '1px dashed #cbd5e1'),
                                    borderRadius: '4px',
                                    backgroundColor: '#ffffff',
                                    overflow: 'hidden',
                                    position: 'relative'
                                }}>
                                    <canvas
                                        ref={canvasRef}
                                        width={440}
                                        height={90}
                                        onMouseDown={iniciarDibujo}
                                        onMouseUp={terminarDibujo}
                                        onMouseLeave={terminarDibujo}
                                        onMouseMove={dibujar}
                                        onTouchStart={iniciarDibujo}
                                        onTouchEnd={terminarDibujo}
                                        onTouchCancel={terminarDibujo}
                                        onTouchMove={dibujar}
                                        style={{
                                            width: '100%',
                                            height: '90px',
                                            display: 'block',
                                            touchAction: 'none',
                                            cursor: 'crosshair',
                                            backgroundColor: '#ffffff'
                                        }}
                                    />
                                    <div style={{
                                        position: 'absolute',
                                        bottom: '5px',
                                        left: '10px',
                                        right: '10px',
                                        borderTop: '1px dashed #e2e8f0',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        pointerEvents: 'none'
                                    }}>
                                        <span style={{ fontSize: '9px', color: '#94a3b8' }}>Línea de firma</span>
                                    </div>
                                </div>
                                {errores.firma && (
                                    <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: '600', marginTop: '6px' }}>
                                        {errores.firma}
                                    </span>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* MODO FÍSICO */
                        <div style={{
                            border: archivoFoto ? '1px solid #16a34a' : (errores.firma ? '1px solid #ef4444' : '1px dashed #cbd5e1'),
                            borderRadius: '4px',
                            backgroundColor: '#f8fafc',
                            padding: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            minHeight: '80px',
                            boxSizing: 'border-box'
                        }}>
                            <div>
                                <span style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b', display: 'block' }}>
                                    {archivoFoto ? `Archivo listo: ${archivoFoto.name}` : 'Adjuntar foto del parte diario firmado'}
                                </span>
                                <span style={{ fontSize: '11px', color: '#64748b' }}>
                                    {archivoFoto ? 'Foto cargada correctamente como respaldo legal.' : 'Toma una foto con el teléfono o adjunta el comprobante firmado a mano.'}
                                </span>
                                {errores.firma && (
                                    <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: '600', marginTop: '4px', display: 'block' }}>
                                        {errores.firma}
                                    </span>
                                )}
                            </div>
                            <label style={{
                                backgroundColor: '#0f172a',
                                color: '#ffffff',
                                padding: '7px 16px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '700',
                                cursor: 'pointer'
                            }}>
                                {archivoFoto ? 'Cambiar Foto' : 'Tomar / Subir Foto'}
                                <input
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) {
                                            setArchivoFoto(e.target.files[0]);
                                            setErrores((prev) => ({ ...prev, firma: null }));
                                        }
                                    }}
                                    style={{ display: 'none' }}
                                />
                            </label>
                        </div>
                    )}

                    {/* Barra de Guardado */}
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '2px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                backgroundColor: estaValidado ? '#16a34a' : '#f59e0b'
                            }} />
                            <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '600' }}>
                                {estaValidado
                                    ? (modoFirma === 'digital' ? 'Firma registrada' : 'Foto adjuntada correctamente')
                                    : (modoFirma === 'digital' ? 'Falta la firma del supervisor' : 'Falta adjuntar la foto del papel')
                                }
                            </span>
                        </div>

                        <button
                            type="submit"
                            disabled={guardando}
                            style={{
                                padding: '9px 24px',
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
                </div>

            </form>
        </div>
    </div>
);
}