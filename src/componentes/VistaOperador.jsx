import React, { useState, useEffect, useRef } from 'react';
import axios from '../api/axios';

export default function VistaOperador({ operador }) {
    const [maquinarias, setMaquinarias] = useState([]);
    const [reportesPrevios, setReportesPrevios] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [enviando, setEnviando] = useState(false);
    const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

    // Campos de turno
    const [idMaquinaSeleccionada, setIdMaquinaSeleccionada] = useState('');
    const [horaEntrada, setHoraEntrada] = useState('08:00');
    const [horaSalida, setHoraSalida] = useState('18:00');
    const [horometroInicial, setHorometroInicial] = useState('');
    const [horometroFinal, setHorometroFinal] = useState('');

    // Combustible opcional con validación estricta
    const [cargoCombustible, setCargoCombustible] = useState(false);
    const [combustibleLitros, setCombustibleLitros] = useState('');

    const [observaciones, setObservaciones] = useState('');

    // Método de validación: 'firma' o 'foto'
    const [metodoValidacion, setMetodoValidacion] = useState('firma');
    const [archivoComprobante, setArchivoComprobante] = useState(null);

    // Canvas Firma Digital
    const canvasRef = useRef(null);
    const [dibujando, setDibujando] = useState(false);
    const [tieneFirma, setTieneFirma] = useState(false);

    const cargarDatosOperador = async () => {
        setCargando(true);
        try {
            const [resMaq, resRep] = await Promise.all([
                axios.get('/api/maquinarias/'),
                axios.get('/api/reports/')
            ]);
            const listaMaq = resMaq.data || [];
            setMaquinarias(listaMaq);
            setReportesPrevios(resRep.data || []);

            if (listaMaq.length > 0 && !idMaquinaSeleccionada) {
                setIdMaquinaSeleccionada(listaMaq[0].id_maquina);
                setHorometroInicial(listaMaq[0].horometro_actual || 0);
            }
        } catch (err) {
            console.error('Error al cargar datos:', err);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarDatosOperador();
    }, []);

    const obtenerPatente = (idMaquina, detalle) => {
        if (detalle && detalle.patente) return `${detalle.patente} (${detalle.tipo || ''})`;
        const encontrada = maquinarias.find((m) => m.id_maquina === idMaquina || m.id === idMaquina);
        return encontrada ? `${encontrada.patente} (${encontrada.tipo})` : `Equipo #${idMaquina || 'S/I'}`;
    };

    const manejarCambioMaquina = (e) => {
        const id = e.target.value;
        setIdMaquinaSeleccionada(id);
        const seleccionada = maquinarias.find((m) => m.id_maquina === parseInt(id, 10));
        if (seleccionada) {
            setHorometroInicial(seleccionada.horometro_actual || 0);
            setHorometroFinal('');
        }
    };

    // Canvas
    const iniciarDibujo = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
        const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;

        ctx.beginPath();
        ctx.moveTo(x, y);
        setDibujando(true);
        setTieneFirma(true);
    };

    const dibujar = (e) => {
        if (!dibujando) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
        const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;

        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#0f172a';
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const detenerDibujo = () => {
        setDibujando(false);
    };

    const limpiarFirma = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setTieneFirma(false);
    };

    const hIni = parseFloat(horometroInicial) || 0;
    const hFin = parseFloat(horometroFinal) || 0;
    const horasCalculadas = hFin > hIni ? (hFin - hIni).toFixed(1) : '0.0';

    const enviarParteDiario = async (e) => {
        e.preventDefault();
        setMensaje({ tipo: '', texto: '' });

        if (!horaEntrada || !horaSalida) {
            setMensaje({ tipo: 'error', texto: 'Debes indicar la hora de entrada y la hora de salida del turno.' });
            return;
        }

        if (hFin <= hIni) {
            setMensaje({ tipo: 'error', texto: 'El horómetro final debe ser mayor al horómetro inicial.' });
            return;
        }

        // Validación estricta de combustible
        let lts = 0;
        if (cargoCombustible) {
            lts = parseFloat(combustibleLitros);
            if (isNaN(lts) || lts <= 0) {
                setMensaje({ tipo: 'error', texto: 'La cantidad de litros cargados debe ser un número positivo mayor a 0.' });
                return;
            }
        }

        if (metodoValidacion === 'firma' && !tieneFirma) {
            setMensaje({ tipo: 'error', texto: 'Falta la firma en pantalla o sube una foto del papel.' });
            return;
        }

        if (metodoValidacion === 'foto' && !archivoComprobante) {
            setMensaje({ tipo: 'error', texto: 'Falta adjuntar la foto del parte firmado.' });
            return;
        }

        setEnviando(true);

        const idOp = operador?.id_operador || operador?.id_usuario || operador?.id || 1;
        const canvas = canvasRef.current;
        const firmaBase64 = (metodoValidacion === 'firma' && canvas) ? canvas.toDataURL('image/png') : 'VALIDADO_POR_FOTO';

        const payloadReporte = {
            id_maquina: parseInt(idMaquinaSeleccionada, 10),
            id_operador: parseInt(idOp, 10),
            fecha: new Date().toISOString().split('T')[0],
            hora_entrada: horaEntrada,
            hora_salida: horaSalida,
            horometro_inicial: hIni,
            horometro_final: hFin,
            horas_trabajadas: parseFloat(horasCalculadas),
            combustible_litros: lts,
            observaciones: observaciones.trim() || 'Turno finalizado',
            firmado: true,
            estado_firma: true,
            firma: firmaBase64,
            firma_digital: firmaBase64
        };

        try {
            await axios.post('/api/reports/', payloadReporte);

            if (lts > 0) {
                await axios.post('/api/gastos/', {
                    id_maquina: parseInt(idMaquinaSeleccionada, 10),
                    categoria_gasto: 'Combustible',
                    tipo_gasto: 'Combustible',
                    monto: lts * 1050,
                    descripcion: `Carga de combustible: ${lts} Litros (${operador?.nombre || 'Operador'})`,
                    fecha: new Date().toISOString().split('T')[0]
                }).catch((errG) => console.warn('Gasto no registrado:', errG));
            }

            setMensaje({ tipo: 'exito', texto: '¡Turno guardado y firmado correctamente!' });
            setHorometroFinal('');
            setCargoCombustible(false);
            setCombustibleLitros('');
            setObservaciones('');
            setArchivoComprobante(null);
            limpiarFirma();
            cargarDatosOperador();
        } catch (err) {
            const errorData = err.response?.data;
            if (errorData) {
                const detalle = typeof errorData === 'object'
                    ? Object.entries(errorData).map(([campo, msgs]) => `${campo}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`).join(' | ')
                    : JSON.stringify(errorData);
                setMensaje({ tipo: 'error', texto: `Error del servidor: ${detalle}` });
            } else {
                setMensaje({ tipo: 'error', texto: 'No se pudo conectar con el servidor Django. Verifica que runserver siga activo.' });
            }
        } finally {
            setEnviando(false);
        }
    };

    return (
        <div style={{ width: '100%', maxWidth: '960px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '22px' }}>
            {/* Cabecera */}
            <div style={{
                backgroundColor: '#0f172a',
                padding: '24px 28px',
                borderRadius: '18px',
                boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.25)',
                border: '1px solid #1e293b',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '14px'
            }}>
                <div>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        PANEL DE OPERADOR
                    </span>
                    <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#ffffff', margin: '4px 0 0', letterSpacing: '-0.02em' }}>
                        Registro Diario de Turno
                    </h1>
                </div>

                <div style={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    padding: '8px 16px',
                    borderRadius: '12px',
                    color: '#e2e8f0',
                    fontSize: '12px',
                    fontWeight: '700'
                }}>
                    Operador: {operador?.nombre} {operador?.apellido || ''}
                </div>
            </div>

            {mensaje.texto && (
                <div style={{
                    backgroundColor: mensaje.tipo === 'exito' ? '#dcfce7' : '#fee2e2',
                    color: mensaje.tipo === 'exito' ? '#15803d' : '#991b1b',
                    border: `1px solid ${mensaje.tipo === 'exito' ? '#bbf7d0' : '#fca5a5'}`,
                    padding: '12px 18px',
                    borderRadius: '12px',
                    fontSize: '13px',
                    fontWeight: '700',
                    textAlign: 'center'
                }}>
                    {mensaje.texto}
                </div>
            )}

            {/* Formulario */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0', padding: '28px', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)' }}>
                <form onSubmit={enviarParteDiario} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Maquinaria */}
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                            Máquina asignada
                        </label>
                        <select
                            value={idMaquinaSeleccionada}
                            onChange={manejarCambioMaquina}
                            style={{
                                width: '100%',
                                height: '46px',
                                padding: '0 14px',
                                borderRadius: '12px',
                                border: '1px solid #cbd5e1',
                                fontSize: '14px',
                                color: '#0f172a',
                                outline: 'none',
                                backgroundColor: '#f8fafc',
                                cursor: 'pointer'
                            }}
                        >
                            {maquinarias.map((m) => (
                                <option key={m.id_maquina} value={m.id_maquina}>
                                    [{m.patente}] {m.tipo} - {m.marca} {m.modelo} (Horómetro: {m.horometro_actual} hrs)
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Horas del Turno */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                                Hora de Entrada *
                            </label>
                            <input
                                type="time"
                                required
                                value={horaEntrada}
                                onChange={(e) => setHoraEntrada(e.target.value)}
                                style={{
                                    width: '100%',
                                    height: '46px',
                                    padding: '0 14px',
                                    borderRadius: '12px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '15px',
                                    fontFamily: 'Consolas, monospace',
                                    fontWeight: '700',
                                    color: '#0f172a',
                                    backgroundColor: '#f8fafc',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                                Hora de Salida *
                            </label>
                            <input
                                type="time"
                                required
                                value={horaSalida}
                                onChange={(e) => setHoraSalida(e.target.value)}
                                style={{
                                    width: '100%',
                                    height: '46px',
                                    padding: '0 14px',
                                    borderRadius: '12px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '15px',
                                    fontFamily: 'Consolas, monospace',
                                    fontWeight: '700',
                                    color: '#0f172a',
                                    backgroundColor: '#f8fafc',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>
                    </div>

                    {/* Horómetros y Horas calculadas */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                                Horómetro inicial
                            </label>
                            <input
                                type="number"
                                step="0.1"
                                required
                                readOnly
                                value={horometroInicial}
                                style={{
                                    width: '100%',
                                    height: '46px',
                                    padding: '0 14px',
                                    borderRadius: '12px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '15px',
                                    fontFamily: 'Consolas, monospace',
                                    fontWeight: '800',
                                    color: '#64748b',
                                    backgroundColor: '#f1f5f9',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#0f172a', textTransform: 'uppercase', marginBottom: '6px' }}>
                                Horómetro final *
                            </label>
                            <input
                                type="number"
                                step="0.1"
                                required
                                placeholder="ej: 765.0"
                                value={horometroFinal}
                                onChange={(e) => setHorometroFinal(e.target.value)}
                                style={{
                                    width: '100%',
                                    height: '46px',
                                    padding: '0 14px',
                                    borderRadius: '12px',
                                    border: '2px solid #f59e0b',
                                    fontSize: '15px',
                                    fontFamily: 'Consolas, monospace',
                                    fontWeight: '800',
                                    color: '#0f172a',
                                    backgroundColor: '#ffffff',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#15803d', textTransform: 'uppercase', marginBottom: '6px' }}>
                                Horas trabajadas
                            </label>
                            <div style={{
                                height: '46px',
                                borderRadius: '12px',
                                border: '1px solid #bbf7d0',
                                backgroundColor: '#f0fdf4',
                                color: '#166534',
                                fontSize: '16px',
                                fontFamily: 'Consolas, monospace',
                                fontWeight: '900',
                                display: 'flex',
                                alignItems: 'center',
                                padding: '0 14px'
                            }}>
                                {horasCalculadas} hrs
                            </div>
                        </div>
                    </div>

                    {/* Combustible opcional con bloqueo de negativos */}
                    <div style={{
                        backgroundColor: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '14px',
                        padding: '16px 20px'
                    }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', margin: 0 }}>
                            <input
                                type="checkbox"
                                checked={cargoCombustible}
                                onChange={(e) => {
                                    setCargoCombustible(e.target.checked);
                                    if (!e.target.checked) setCombustibleLitros('');
                                }}
                                style={{ width: '18px', height: '18px', accentColor: '#f59e0b', cursor: 'pointer' }}
                            />
                            <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
                                ¿Cargaste combustible en este turno?
                            </span>
                        </label>

                        {cargoCombustible && (
                            <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px dashed #cbd5e1' }}>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                                    Litros cargados (mínimo 1 litro)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    step="1"
                                    required={cargoCombustible}
                                    placeholder="ej: 80"
                                    value={combustibleLitros}
                                    onKeyDown={(e) => {
                                        // Bloquea el signo menos, signo más y la letra 'e'
                                        if (e.key === '-' || e.key === '+' || e.key === 'e' || e.key === 'E') {
                                            e.preventDefault();
                                        }
                                    }}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        // Solo permite guardar números mayores o iguales a 0
                                        if (val === '' || parseFloat(val) >= 0) {
                                            setCombustibleLitros(val);
                                        }
                                    }}
                                    style={{
                                        width: '100%',
                                        maxWidth: '300px',
                                        height: '44px',
                                        padding: '0 14px',
                                        borderRadius: '10px',
                                        border: '1px solid #cbd5e1',
                                        fontSize: '14px',
                                        color: '#0f172a',
                                        backgroundColor: '#ffffff',
                                        outline: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                />
                            </div>
                        )}
                    </div>

                    {/* Observaciones */}
                    <div>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                            Observaciones del turno
                        </label>
                        <textarea
                            rows="3"
                            placeholder="Escribe aquí si hubo algún problema con la máquina o detalles del trabajo..."
                            value={observaciones}
                            onChange={(e) => setObservaciones(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px 14px',
                                borderRadius: '12px',
                                border: '1px solid #cbd5e1',
                                fontSize: '13px',
                                color: '#0f172a',
                                backgroundColor: '#f8fafc',
                                outline: 'none',
                                boxSizing: 'border-box',
                                resize: 'none'
                            }}
                        />
                    </div>

                    {/* Bloque de Confirmación */}
                    <div style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '16px',
                        padding: '20px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '16px'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                            <div>
                                <span style={{ fontSize: '11px', fontWeight: '800', color: '#f59e0b', textTransform: 'uppercase' }}>
                                    Confirmación en terreno
                                </span>
                                <h3 style={{ margin: '2px 0 0', fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                                    Firma o respaldo del supervisor
                                </h3>
                            </div>

                            {/* Botones de selección */}
                            <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '10px', gap: '4px' }}>
                                <button
                                    type="button"
                                    onClick={() => setMetodoValidacion('firma')}
                                    style={{
                                        padding: '8px 14px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        fontSize: '11px',
                                        fontWeight: '800',
                                        cursor: 'pointer',
                                        backgroundColor: metodoValidacion === 'firma' ? '#0f172a' : 'transparent',
                                        color: metodoValidacion === 'firma' ? '#ffffff' : '#64748b'
                                    }}
                                >
                                    Firma en pantalla
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMetodoValidacion('foto')}
                                    style={{
                                        padding: '8px 14px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        fontSize: '11px',
                                        fontWeight: '800',
                                        cursor: 'pointer',
                                        backgroundColor: metodoValidacion === 'foto' ? '#0f172a' : 'transparent',
                                        color: metodoValidacion === 'foto' ? '#ffffff' : '#64748b'
                                    }}
                                >
                                    Subir foto del papel
                                </button>
                            </div>
                        </div>

                        {/* Opción 1: Firma */}
                        {metodoValidacion === 'firma' && (
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                    <label style={{ fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase' }}>
                                        Firma aquí
                                    </label>
                                    <button
                                        type="button"
                                        onClick={limpiarFirma}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: '#dc2626',
                                            fontSize: '11px',
                                            fontWeight: '800',
                                            cursor: 'pointer',
                                            textDecoration: 'underline'
                                        }}
                                    >
                                        Borrar firma
                                    </button>
                                </div>

                                <div style={{
                                    border: tieneFirma ? '2px solid #16a34a' : '2px dashed #cbd5e1',
                                    borderRadius: '12px',
                                    backgroundColor: '#fafafa',
                                    overflow: 'hidden',
                                    touchAction: 'none'
                                }}>
                                    <canvas
                                        ref={canvasRef}
                                        width={860}
                                        height={150}
                                        onMouseDown={iniciarDibujo}
                                        onMouseMove={dibujar}
                                        onMouseUp={detenerDibujo}
                                        onMouseLeave={detenerDibujo}
                                        onTouchStart={iniciarDibujo}
                                        onTouchMove={dibujar}
                                        onTouchEnd={detenerDibujo}
                                        style={{ width: '100%', height: '150px', display: 'block', cursor: 'crosshair' }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Opción 2: Foto */}
                        {metodoValidacion === 'foto' && (
                            <div>
                                <label style={{ display: 'block', fontSize: '11px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                                    Foto del parte firmado
                                </label>
                                <div style={{
                                    border: '2px dashed #cbd5e1',
                                    borderRadius: '12px',
                                    backgroundColor: '#f8fafc',
                                    height: '150px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: '16px',
                                    boxSizing: 'border-box',
                                    textAlign: 'center',
                                    position: 'relative'
                                }}>
                                    <input
                                        type="file"
                                        accept="image/*,application/pdf"
                                        onChange={(e) => setArchivoComprobante(e.target.files[0])}
                                        style={{
                                            position: 'absolute',
                                            top: 0, left: 0, width: '100%', height: '100%',
                                            opacity: 0,
                                            cursor: 'pointer'
                                        }}
                                    />
                                    <span style={{ fontSize: '26px', marginBottom: '6px' }}>📷</span>
                                    <span style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
                                        {archivoComprobante ? archivoComprobante.name : 'Toca aquí para tomar foto o elegir archivo'}
                                    </span>
                                    <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                        {archivoComprobante ? 'Archivo listo para subir' : 'JPG, PNG o PDF'}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Botón de Enviar */}
                    <button
                        type="submit"
                        disabled={enviando}
                        style={{
                            height: '50px',
                            backgroundColor: '#f59e0b',
                            color: '#0f172a',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '13px',
                            fontWeight: '900',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            cursor: enviando ? 'not-allowed' : 'pointer',
                            boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)',
                            marginTop: '4px'
                        }}
                    >
                        {enviando ? 'Guardando...' : 'Enviar parte diario'}
                    </button>
                </form>
            </div>

            {/* Historial */}
            <div style={{ backgroundColor: '#ffffff', borderRadius: '18px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                    Tus turnos recientes
                </h3>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '800' }}>FECHA</th>
                                <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '800' }}>MÁQUINA</th>
                                <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '800' }}>HORÓMETROS</th>
                                <th style={{ padding: '10px 14px', color: '#475569', fontWeight: '800', textAlign: 'right' }}>HORAS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportesPrevios.slice(0, 5).map((r) => (
                                <tr key={r.id_report} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '12px 14px', color: '#475569' }}>{r.fecha}</td>
                                    <td style={{ padding: '12px 14px', fontWeight: '700', color: '#0f172a', fontFamily: 'Consolas, monospace' }}>
                                        {obtenerPatente(r.id_maquina, r.id_maquina_detalle)}
                                    </td>
                                    <td style={{ padding: '12px 14px', color: '#64748b', fontSize: '12px' }}>
                                        {r.horometro_inicial} → {r.horometro_final}
                                    </td>
                                    <td style={{ padding: '12px 14px', fontWeight: '900', color: '#166534', textAlign: 'right', fontFamily: 'Consolas, monospace' }}>
                                        {parseFloat(r.horas_trabajadas || 0).toFixed(1)} hrs
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}