import React, { useState, useEffect, useRef } from 'react';
import axios from '../api/axios';
import '../styles/VistaOperador.css';

export default function VistaOperador({ usuario }) {
    const [maquinarias, setMaquinarias] = useState([]);
    const [cargando, setCargando] = useState(false);
    const [mensajeExito, setMensajeExito] = useState('');
    const [errores, setErrores] = useState({});

    const fechaHoy = new Date().toISOString().split('T')[0];

    // Campos de la base de datos (Modelo Report)
    const [idMaquina, setIdMaquina] = useState('');
    const [horaEntrada, setHoraEntrada] = useState('08:00');
    const [horaSalida, setHoraSalida] = useState('18:00');
    const [horometroInicial, setHorometroInicial] = useState('');
    const [horometroFinal, setHorometroFinal] = useState('');
    const [cargoCombustible, setCargoCombustible] = useState(false);
    const [combustible, setCombustible] = useState('');

    // Certificación y firma en terreno
    const [metodoCertificacion, setMetodoCertificacion] = useState('digital');
    const [firmaDibujada, setFirmaDibujada] = useState(false);
    const [archivoFoto, setArchivoFoto] = useState(null);
    const [declaracionSupervisor, setDeclaracionSupervisor] = useState(false);

    const canvasRef = useRef(null);
    const [dibujando, setDibujando] = useState(false);

    // Cálculos de horas
    const hInicialNum = parseFloat(horometroInicial) || 0;
    const hFinalNum = parseFloat(horometroFinal) || 0;
    const diferenciaHoras = hFinalNum - hInicialNum;
    const horasTrabajadasCalculadas = hFinalNum > hInicialNum && hInicialNum > 0
        ? diferenciaHoras.toFixed(1)
        : '0.0';

    // 1. Cargar lista de maquinarias
    useEffect(() => {
        const cargarMaquinas = async () => {
            try {
                let res;
                try {
                    res = await axios.get('/maquinarias/');
                } catch {
                    res = await axios.get('/maquinaria/');
                }

                const data = res.data?.results || res.data || [];
                setMaquinarias(data);

                if (data.length > 0) {
                    const primera = data[0];
                    setIdMaquina(primera.id_maquina);
                    const valorHorometro = primera.horometro_actual ?? primera.horometro ?? 0;
                    setHorometroInicial(valorHorometro.toString());
                }
            } catch (err) {
                console.error('Error al cargar maquinarias:', err);
                setErrores((prev) => ({
                    ...prev,
                    general: 'No se pudo cargar el listado de maquinarias.'
                }));
            }
        };

        cargarMaquinas();
    }, []);

    // 2. Al cambiar máquina, actualiza el horómetro inicial
    const handleCambioMaquina = (e) => {
        const nuevoId = e.target.value;
        setIdMaquina(nuevoId);
        setHorometroFinal('');
        setErrores((prev) => ({ ...prev, idMaquina: null, horometroFinal: null }));

        const maquinaSeleccionada = maquinarias.find((m) => m.id_maquina === parseInt(nuevoId, 10));
        if (maquinaSeleccionada) {
            const valorHorometro = maquinaSeleccionada.horometro_actual ?? maquinaSeleccionada.horometro ?? 0;
            setHorometroInicial(valorHorometro.toString());
        }
    };

    // 3. Validación en tiempo real del horómetro final
    const handleCambioHorometroFinal = (e) => {
        const valor = e.target.value;
        setHorometroFinal(valor);

        if (!valor || valor.trim() === '') {
            setErrores((prev) => ({ ...prev, horometroFinal: null }));
            return;
        }

        const finalNum = parseFloat(valor);
        if (isNaN(finalNum)) {
            setErrores((prev) => ({ ...prev, horometroFinal: 'Ingresa un valor numérico.' }));
            return;
        }

        if (finalNum <= hInicialNum) {
            setErrores((prev) => ({
                ...prev,
                horometroFinal: `Debe ser mayor al inicial (${hInicialNum} hrs).`
            }));
            return;
        }

        const dif = finalNum - hInicialNum;
        if (dif > 24) {
            setErrores((prev) => ({
                ...prev,
                horometroFinal: `El turno no puede superar las 24 hrs continuas (${dif.toFixed(1)} hrs).`
            }));
            return;
        }

        setErrores((prev) => ({ ...prev, horometroFinal: null }));
    };

    const handleCambioCombustible = (e) => {
        const val = e.target.value;
        setCombustible(val);
        const num = parseFloat(val);
        if (cargoCombustible && (!val || isNaN(num) || num <= 0)) {
            setErrores((prev) => ({ ...prev, combustible: 'Ingresa una cantidad mayor a 0.' }));
        } else {
            setErrores((prev) => ({ ...prev, combustible: null }));
        }
    };

    // Métodos del lienzo para firma en pantalla
    const iniciarDibujo = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const clienteX = e.touches ? e.touches[0].clientX : e.clientX;
        const clienteY = e.touches ? e.touches[0].clientY : e.clientY;

        ctx.beginPath();
        ctx.moveTo(clienteX - rect.left, clienteY - rect.top);
        setDibujando(true);
        setFirmaDibujada(true);
        if (errores.firma) setErrores((prev) => ({ ...prev, firma: null }));
    };

    const dibujar = (e) => {
        if (!dibujando) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const clienteX = e.touches ? e.touches[0].clientX : e.clientX;
        const clienteY = e.touches ? e.touches[0].clientY : e.clientY;

        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#0f172a';
        ctx.lineTo(clienteX - rect.left, clienteY - rect.top);
        ctx.stroke();
    };

    const detenerDibujo = () => setDibujando(false);

    const limpiarFirma = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setFirmaDibujada(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMensajeExito('');

        // Validaciones de formulario
        const nuevosErrores = {};
        if (!idMaquina) nuevosErrores.idMaquina = 'Selecciona una máquina.';
        if (!horometroFinal) {
            nuevosErrores.horometroFinal = 'Ingresa el horómetro final.';
        } else if (hFinalNum <= hInicialNum) {
            nuevosErrores.horometroFinal = `Debe ser mayor al horómetro inicial (${hInicialNum}).`;
        } else if (diferenciaHoras > 24) {
            nuevosErrores.horometroFinal = 'Excede el límite de 24 horas.';
        }

        if (cargoCombustible && (!combustible || parseFloat(combustible) <= 0)) {
            nuevosErrores.combustible = 'Indica los litros cargados.';
        }

        if (!declaracionSupervisor) {
            nuevosErrores.declaracion = 'El supervisor debe certificar la conformidad del turno.';
        }

        if (metodoCertificacion === 'digital' && !firmaDibujada) {
            nuevosErrores.firma = 'Se requiere estampar la firma digital en pantalla.';
        }

        if (metodoCertificacion === 'foto' && !archivoFoto) {
            nuevosErrores.firma = 'Debes adjuntar la fotografía del comprobante de terreno.';
        }

        if (Object.keys(nuevosErrores).length > 0) {
            setErrores(nuevosErrores);
            return;
        }

        setCargando(true);

        // Rescatar los datos desde 'usuario_multimak' en localStorage
        let sesionData = null;
        try {
            const raw = localStorage.getItem('usuario_multimak');
            sesionData = raw ? JSON.parse(raw) : null;
        } catch {
            sesionData = null;
        }

        let idOpNumero = parseInt(
            sesionData?.id_operador ||
            usuario?.id_operador ||
            sesionData?.id_usuario ||
            usuario?.id_usuario ||
            1,
            10
        );

        // Payload idéntico a las columnas del modelo Report
        const payload = {
            id_operador: idOpNumero,
            id_maquina: parseInt(idMaquina, 10),
            id_contrato: null,
            id_hes: null,
            fecha: fechaHoy,
            hora_entrada: horaEntrada.length === 5 ? `${horaEntrada}:00` : horaEntrada,
            hora_salida: horaSalida.length === 5 ? `${horaSalida}:00` : horaSalida,
            horometro_inicial: parseFloat(hInicialNum),
            horometro_final: parseFloat(hFinalNum),
            horas_trabajadas: Math.round(parseFloat(horasTrabajadasCalculadas)),
            combustible_litros: cargoCombustible ? (parseFloat(combustible) || 0) : 0,
            firmado: true,
        };

        try {
            await axios.post('/reports/', payload);
            setMensajeExito('¡Parte diario guardado y certificado exitosamente!');
            setErrores({});

            // Reiniciar campos para el siguiente registro
            setHorometroInicial(horometroFinal);
            setHorometroFinal('');
            setCargoCombustible(false);
            setCombustible('');
            setDeclaracionSupervisor(false);
            setArchivoFoto(null);
            limpiarFirma();
        } catch (err) {
            console.error('Error Django:', err.response?.data);
            const dataError = err.response?.data;
            let msg = 'Error al registrar el reporte en el servidor.';
            if (typeof dataError === 'string') {
                msg = dataError;
            } else if (typeof dataError === 'object') {
                msg = Object.entries(dataError)
                    .map(([campo, det]) => `${campo}: ${Array.isArray(det) ? det.join(', ') : det}`)
                    .join(' | ');
            }
            setErrores({ general: msg });
        } finally {
            setCargando(false);
        }
    };

    return (
        <div className="op-view-container">
            <div className="op-top-banner">
                <div>
                    <span className="op-pill-tag">Módulo Terreno</span>
                    <h1 className="op-main-title">Registro de Parte Diario</h1>
                    <p className="op-main-desc">Ingresa las horas de faena y solicita la validación del supervisor.</p>
                </div>
                <div className="op-date-box">
                    <span className="op-date-label">Fecha de operación</span>
                    <span className="op-date-val">{fechaHoy}</span>
                </div>
            </div>

            {mensajeExito && <div className="op-alert-ok">{mensajeExito}</div>}
            {errores.general && <div className="op-alert-fail">{errores.general}</div>}

            <div className="op-card">
                <form onSubmit={handleSubmit} className="op-form" noValidate>
                    {/* id_maquina */}
                    <div className="op-form-section">
                        <label className="op-label">Equipo / Maquinaria asignada</label>
                        <select
                            className={`op-input op-select ${errores.idMaquina ? 'op-input-error' : ''}`}
                            value={idMaquina}
                            onChange={handleCambioMaquina}
                        >
                            {maquinarias.length === 0 ? (
                                <option value="">Cargando maquinarias...</option>
                            ) : (
                                maquinarias.map((m) => (
                                    <option key={m.id_maquina} value={m.id_maquina}>
                                        {m.patente} — {m.marca} {m.modelo} ({m.tipo})
                                    </option>
                                ))
                            )}
                        </select>
                        {errores.idMaquina && <span className="op-field-error">{errores.idMaquina}</span>}
                    </div>

                    {/* Horas */}
                    <div className="op-grid-2">
                        <div className="op-form-section">
                            <label className="op-label">Hora inicio faena</label>
                            <input
                                type="time"
                                className="op-input"
                                value={horaEntrada}
                                onChange={(e) => setHoraEntrada(e.target.value)}
                            />
                        </div>
                        <div className="op-form-section">
                            <label className="op-label">Hora término faena</label>
                            <input
                                type="time"
                                className="op-input"
                                value={horaSalida}
                                onChange={(e) => setHoraSalida(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Horómetros */}
                    <div className="op-grid-2">
                        <div className="op-form-section">
                            <label className="op-label">
                                Horómetro Inicial (hrs) <span style={{ color: '#94a3b8', textTransform: 'none' }}>(Base de máquina)</span>
                            </label>
                            <input
                                type="number"
                                step="0.1"
                                readOnly
                                className="op-input op-input-num op-input-readonly"
                                value={horometroInicial}
                            />
                        </div>

                        <div className="op-form-section">
                            <label className="op-label">Horómetro Final (hrs)</label>
                            <input
                                type="number"
                                step="0.1"
                                className={`op-input op-input-num ${errores.horometroFinal ? 'op-input-error' : ''}`}
                                placeholder={`Mayor a ${horometroInicial || 0}`}
                                value={horometroFinal}
                                onChange={handleCambioHorometroFinal}
                            />
                            {errores.horometroFinal && <span className="op-field-error">{errores.horometroFinal}</span>}
                        </div>
                    </div>

                    {/* Cálculo de horas */}
                    <div className="op-summary-box">
                        <span className="op-summary-label">Total horas calculadas:</span>
                        <span className="op-summary-num">{horasTrabajadasCalculadas} hrs</span>
                    </div>

                    {/* Combustible condicional */}
                    <div className="op-fuel-wrapper">
                        <label className="op-toggle-container">
                            <input
                                type="checkbox"
                                className="op-checkbox"
                                checked={cargoCombustible}
                                onChange={(e) => {
                                    setCargoCombustible(e.target.checked);
                                    if (!e.target.checked) {
                                        setCombustible('');
                                        setErrores((prev) => ({ ...prev, combustible: null }));
                                    }
                                }}
                            />
                            <span className="op-toggle-text">¿Se abasteció combustible durante el turno?</span>
                        </label>

                        {cargoCombustible && (
                            <div className="op-fuel-expand">
                                <label className="op-label">Cantidad de Diesel cargado (Litros)</label>
                                <input
                                    type="number"
                                    step="0.5"
                                    min="1"
                                    className={`op-input op-input-num ${errores.combustible ? 'op-input-error' : ''}`}
                                    placeholder="Ej: 45.0"
                                    value={combustible}
                                    onChange={handleCambioCombustible}
                                    autoFocus
                                />
                                {errores.combustible && <span className="op-field-error">{errores.combustible}</span>}
                            </div>
                        )}
                    </div>

                    {/* Sección de certificación del supervisor */}
                    <div className="op-supervisor-card">
                        <div className="op-supervisor-header">
                            <span className="op-sub-badge">Certificación en Faena</span>
                            <h3 className="op-sub-title">Validación por Supervisor de Obra</h3>
                        </div>

                        <div className="op-declaracion-box">
                            <p className="op-declaracion-texto">
                                <strong>DECLARACIÓN JURADA OPERATIVA:</strong> En calidad de supervisor de faena, certifico que los horómetros, horarios y consumos reflejan de manera verídica el trabajo efectivo de la máquina en obra para cómputo y estado de pago.
                            </p>
                            <label className="op-check-label op-check-declaracion">
                                <input
                                    type="checkbox"
                                    className="op-checkbox"
                                    checked={declaracionSupervisor}
                                    onChange={(e) => {
                                        setDeclaracionSupervisor(e.target.checked);
                                        if (errores.declaracion) setErrores({ ...errores, declaracion: null });
                                    }}
                                />
                                <span>El supervisor aprueba la conformidad del turno operado.</span>
                            </label>
                            {errores.declaracion && <span className="op-field-error">{errores.declaracion}</span>}
                        </div>

                        <div className="op-signature-tabs">
                            <button
                                type="button"
                                className={`op-tab-btn ${metodoCertificacion === 'digital' ? 'active' : ''}`}
                                onClick={() => setMetodoCertificacion('digital')}
                            >
                                Firma Digital en Pantalla
                            </button>
                            <button
                                type="button"
                                className={`op-tab-btn ${metodoCertificacion === 'foto' ? 'active' : ''}`}
                                onClick={() => setMetodoCertificacion('foto')}
                            >
                                Subir Respaldo Físico / Foto
                            </button>
                        </div>

                        {metodoCertificacion === 'digital' ? (
                            <div className="op-canvas-container">
                                <div className="op-canvas-instructions">
                                    <span>Dibuje la firma usando el dedo o puntero:</span>
                                    <button type="button" onClick={limpiarFirma} className="op-btn-clear">
                                        Limpiar firma
                                    </button>
                                </div>
                                <div className="op-canvas-frame">
                                    <canvas
                                        ref={canvasRef}
                                        width={480}
                                        height={160}
                                        className="op-signature-canvas"
                                        onMouseDown={iniciarDibujo}
                                        onMouseMove={dibujar}
                                        onMouseUp={detenerDibujo}
                                        onMouseLeave={detenerDibujo}
                                        onTouchStart={iniciarDibujo}
                                        onTouchMove={dibujar}
                                        onTouchEnd={detenerDibujo}
                                    />
                                </div>
                                {errores.firma && <span className="op-field-error">{errores.firma}</span>}
                            </div>
                        ) : (
                            <div className="op-upload-container">
                                <label className="op-upload-box">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        capture="environment"
                                        className="op-file-input"
                                        onChange={(e) => {
                                            if (e.target.files && e.target.files[0]) {
                                                setArchivoFoto(e.target.files[0]);
                                                if (errores.firma) setErrores({ ...errores, firma: null });
                                            }
                                        }}
                                    />
                                    <div className="op-upload-content">
                                        <span className="op-upload-icon">📷</span>
                                        <span className="op-upload-title">
                                            {archivoFoto ? archivoFoto.name : 'Tomar foto o subir comprobante firmado'}
                                        </span>
                                        <span className="op-upload-hint">Formatos: JPG, PNG • Máx 10 MB</span>
                                    </div>
                                </label>
                                {errores.firma && <span className="op-field-error">{errores.firma}</span>}
                            </div>
                        )}
                    </div>

                    <button
                        type="submit"
                        disabled={cargando || Boolean(errores.horometroFinal)}
                        className="op-btn-submit"
                    >
                        {cargando ? 'Transmitiendo Parte...' : 'Registrar Parte Diario'}
                    </button>
                </form>
            </div>
        </div>
    );
}