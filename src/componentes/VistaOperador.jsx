import React, { useState, useEffect, useRef } from 'react';
import axios from '../api/axios'; // Importa la instancia centralizada que inyecta el token
import '../styles/VistaOperador.css';
import { subirArchivoAS3 } from '../utils/s3Uploader';

const formatoFechaCL = (iso) => {
    if (!iso) return '';
    const [a, m, d] = String(iso).slice(0, 10).split('-');
    return `${d}-${m}-${a}`;
};

const extraerErrorApi = (err, defecto) => {
    const d = err && err.response && err.response.data;
    if (!d) return defecto;
    if (typeof d === 'string') return d.length < 200 ? d : defecto;
    const partes = Object.values(d).flat().map((x) => (typeof x === 'string' ? x : JSON.stringify(x)));
    return partes.length ? partes.join(' ') : defecto;
};

const enTaller = (m) => String(m?.estado || '').toUpperCase().includes('TALLER');

export default function VistaOperador({ operador, usuario, modoNoche }) {
    const [contratos, setContratos] = useState([]);
    const [reportesRecientes, setReportesRecientes] = useState([]);
    const [cargando, setCargando] = useState(false);
    const [mensajeExito, setMensajeExito] = useState('');
    const [errores, setErrores] = useState({});

    const fechaHoy = new Date().toLocaleDateString('en-CA'); // fecha local YYYY-MM-DD

    // Formulario
    const [idContrato, setIdContrato] = useState('');
    const [idMaquina, setIdMaquina] = useState('');
    const [horaEntrada, setHoraEntrada] = useState('08:00');
    const [horaSalida, setHoraSalida] = useState('18:00');
    const [horometroInicial, setHorometroInicial] = useState('');
    const [horometroFinal, setHorometroFinal] = useState('');
    const [cargoCombustible, setCargoCombustible] = useState(false);
    const [combustible, setCombustible] = useState('');

    // Certificación
    const [metodoCertificacion, setMetodoCertificacion] = useState('digital');
    const [firmaDibujada, setFirmaDibujada] = useState(false);
    const [archivoFoto, setArchivoFoto] = useState(null);
    const [declaracionSupervisor, setDeclaracionSupervisor] = useState(false);

    const canvasRef = useRef(null);
    const avisoRef = useRef(null);
    const [dibujando, setDibujando] = useState(false);

    // Cálculos
    const hInicialNum = parseFloat(horometroInicial) || 0;
    const hFinalNum = parseFloat(horometroFinal) || 0;
    const diferenciaHoras = hFinalNum - hInicialNum;
    const horasTrabajadasCalculadas = idMaquina && hFinalNum > hInicialNum
        ? diferenciaHoras.toFixed(1)
        : '0.0';

    const contratoActual = contratos.find((c) => String(c.id_contrato) === String(idContrato));
    const maquinasDelContrato = contratoActual ? contratoActual.maquinas : [];

    const seleccionarMaquina = (m) => {
        setIdMaquina(String(m.id_maquina));
        setHorometroInicial(String(m.horometro_actual ?? 0));
    };

    const cargarDatos = async () => {
        try {
            const [resCon, resRep] = await Promise.all([
                axios.get('/contratos-operador/').catch(() => ({ data: [] })),
                axios.get('/reports/', { params: { id_operador: operador?.id_operador || 0 } }).catch(() => ({ data: [] }))
            ]);

            const dataCon = Array.isArray(resCon.data) ? resCon.data : [];
            const dataRep = resRep.data?.results || (Array.isArray(resRep.data) ? resRep.data : []);

            setContratos(dataCon);

            // Solo los partes de este operador
            const idOp = operador?.id_operador;
            const propios = idOp ? dataRep.filter((r) => String(r.id_operador) === String(idOp)) : [];
            setReportesRecientes(propios.slice(0, 6));

            if (idContrato) {
                const c = dataCon.find((x) => String(x.id_contrato) === String(idContrato));
                const m = c && c.maquinas.find((x) => String(x.id_maquina) === String(idMaquina));
                if (m) setHorometroInicial(String(m.horometro_actual ?? 0));
            } else if (dataCon.length === 1) {
                setIdContrato(String(dataCon[0].id_contrato));
                if (dataCon[0].maquinas.length === 1) seleccionarMaquina(dataCon[0].maquinas[0]);
            }
        } catch (err) {
            console.error('No se pudieron cargar tus datos. Recarga la página.', err);
        }
    };

    useEffect(() => {
        cargarDatos();
    }, []);

    const handleCambioContrato = (e) => {
        const nuevoId = e.target.value;
        setIdContrato(nuevoId);
        setHorometroFinal('');
        setErrores((prev) => ({ ...prev, idContrato: null, idMaquina: null, horometroFinal: null }));

        const c = contratos.find((x) => String(x.id_contrato) === String(nuevoId));
        const disponibles = c ? c.maquinas.filter((m) => !enTaller(m)) : [];
        if (disponibles.length === 1) {
            seleccionarMaquina(disponibles[0]);   // una sola máquina: queda elegida
        } else {
            setIdMaquina('');                     // varias: el operador elige la correcta
            setHorometroInicial('');
        }
    };

    const handleCambioMaquina = (e) => {
        const nuevoId = e.target.value;
        setHorometroFinal('');
        setErrores((prev) => ({ ...prev, idMaquina: null, horometroFinal: null }));

        const m = maquinasDelContrato.find((x) => String(x.id_maquina) === String(nuevoId));
        if (m) {
            seleccionarMaquina(m);
        } else {
            setIdMaquina('');
            setHorometroInicial('');
        }
    };

    const handleCambioHorometroFinal = (e) => {
        const valor = e.target.value;
        setHorometroFinal(valor);

        if (!valor || valor.trim() === '') {
            setErrores((prev) => ({ ...prev, horometroFinal: null }));
            return;
        }

        const finalNum = parseFloat(valor);
        if (isNaN(finalNum)) {
            setErrores((prev) => ({ ...prev, horometroFinal: 'Ingresa un número válido.' }));
            return;
        }

        if (finalNum <= hInicialNum) {
            setErrores((prev) => ({
                ...prev,
                horometroFinal: `Debe ser mayor a ${hInicialNum} hrs.`
            }));
            return;
        }

        const dif = finalNum - hInicialNum;
        if (dif > 24) {
            setErrores((prev) => ({
                ...prev,
                horometroFinal: `No puede superar 24 hrs de trabajo (${dif.toFixed(1)} hrs).`
            }));
            return;
        }

        setErrores((prev) => ({ ...prev, horometroFinal: null }));
    };

    // Canvas Firma
    const obtenerPuntoCanvas = (e, canvas) => {
        const rect = canvas.getBoundingClientRect();
        const clienteX = e.touches ? e.touches[0].clientX : e.clientX;
        const clienteY = e.touches ? e.touches[0].clientY : e.clientY;
        const scaleX = rect.width > 0 ? canvas.width / rect.width : 1;
        const scaleY = rect.height > 0 ? canvas.height / rect.height : 1;
        return {
            x: (clienteX - rect.left) * scaleX,
            y: (clienteY - rect.top) * scaleY,
        };
    };

    const iniciarDibujo = (e) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const { x, y } = obtenerPuntoCanvas(e, canvas);

        ctx.beginPath();
        ctx.moveTo(x, y);
        setDibujando(true);
        setFirmaDibujada(true);
        if (errores.firma) setErrores((prev) => ({ ...prev, firma: null }));
    };

    const dibujar = (e) => {
        if (!dibujando) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const { x, y } = obtenerPuntoCanvas(e, canvas);

        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.strokeStyle = modoNoche ? '#38bdf8' : '#0f172a';
        ctx.lineTo(x, y);
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

    const irAlAviso = () => {
        setTimeout(() => avisoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMensajeExito('');
        setErrores({});

        const nuevosErrores = {};
        if (!operador?.id_operador) {
            setErrores({ general: 'Tu cuenta no está asociada a un operador. Avisa al administrador.' });
            irAlAviso();
            return;
        }
        if (!idContrato) nuevosErrores.idContrato = 'Selecciona un contrato.';
        if (idContrato && !idMaquina) nuevosErrores.idMaquina = 'Selecciona una máquina.';
        if (!horometroFinal) {
            nuevosErrores.horometroFinal = 'Ingresa el horómetro final.';
        } else if (hFinalNum <= hInicialNum) {
            nuevosErrores.horometroFinal = `Debe ser mayor al horómetro inicial (${hInicialNum}).`;
        }

        if (cargoCombustible) {
            const litros = parseFloat(combustible);
            if (!combustible || isNaN(litros) || litros <= 0) {
                nuevosErrores.combustible = 'Indica los litros cargados (mas de 0).';
            } else if (litros > 2000) {
                nuevosErrores.combustible = 'Revisa los litros: el valor parece excesivo.';
            }
        }
        if (horaEntrada && horaSalida && horaSalida <= horaEntrada) {
            nuevosErrores.horario = 'La hora de término debe ser posterior a la de inicio.';
        }

        if (!declaracionSupervisor) {
            nuevosErrores.declaracion = 'Falta la conformidad del supervisor.';
        }

        if (metodoCertificacion === 'digital' && !firmaDibujada) {
            nuevosErrores.firma = 'Falta la firma del supervisor.';
        }

        if (metodoCertificacion === 'foto' && !archivoFoto) {
            nuevosErrores.firma = 'Adjunta la foto del comprobante.';
        }

        if (Object.keys(nuevosErrores).length > 0) {
            const { general, ...porCampo } = nuevosErrores;
            setErrores({ ...porCampo, general: 'Revisa los campos marcados en rojo.' });
            irAlAviso();
            return;
        }

        setCargando(true);

        try {
            let urlFirmaS3 = '';
            
            if (metodoCertificacion === 'foto' && archivoFoto) {
                urlFirmaS3 = await subirArchivoAS3(archivoFoto);
            } 
            else if (metodoCertificacion === 'digital' && firmaDibujada && canvasRef.current) {
                const blobFirma = await new Promise(resolve => canvasRef.current.toBlob(resolve, 'image/png'));
                const archivoCanvas = new File([blobFirma], `firma_${Date.now()}.png`, { type: 'image/png' });
                urlFirmaS3 = await subirArchivoAS3(archivoCanvas);
            }

            const payload = {
                id_operador: operador.id_operador,
                id_contrato: parseInt(idContrato, 10),
                id_maquina: parseInt(idMaquina, 10),
                fecha: fechaHoy,
                hora_entrada: horaEntrada.length === 5 ? `${horaEntrada}:00` : horaEntrada,
                hora_salida: horaSalida.length === 5 ? `${horaSalida}:00` : horaSalida,
                horometro_inicial: parseFloat(hInicialNum),
                horometro_final: parseFloat(hFinalNum),
                combustible_litros: cargoCombustible ? (parseFloat(combustible) || 0) : 0,
                firmado: true,
                firma_supervisor: urlFirmaS3 // Guardamos la URL en la BD
            };

            await axios.post('/reports/', payload);
            setMensajeExito('Parte diario registrado correctamente.');
            setErrores({});
            irAlAviso();
            setHorometroInicial(horometroFinal);
            setHorometroFinal('');
            setCargoCombustible(false);
            setCombustible('');
            setDeclaracionSupervisor(false);
            limpiarFirma();
            setArchivoFoto(null);
            cargarDatos();
        } catch (err) {
            setErrores({ general: extraerErrorApi(err, 'No se pudo registrar el parte. Intenta de nuevo.') });
            irAlAviso();
        } finally {
            setCargando(false);
        }
    };
    
    return (
        <div className={`op-view-container ${modoNoche ? 'dark-mode' : ''}`}>
            {/* ENCABEZADO SUPERIOR */}
            <div className="op-top-banner">
                <div>
                    <span className="op-pill-tag">Parte diario de operaciones • MULTIMAK 360</span>
                    <h1 className="op-main-title">Registro de Turno y Horómetro</h1>
                    <p className="op-main-desc">Ingresa las horas trabajadas, carga de combustible y firma digital del supervisor en faena.</p>
                </div>
                
                <div className="op-date-box">
                    <span className="op-date-label">Fecha actual</span>
                    <span className="op-date-val">{formatoFechaCL(fechaHoy)}</span>
                </div>
            </div>

            <div className="op-layout-grid">
                {/*FORMULARIO DIARIO */}
                <div className="op-card">
                    <form onSubmit={handleSubmit} className="op-form" noValidate>
                        
                        <div className="op-form-section">
                            <label className="op-label">Contrato</label>
                            <select
                                className={`op-input op-select ${errores.idContrato ? 'op-input-error' : ''}`}
                                value={idContrato}
                                onChange={handleCambioContrato}
                            >
                                {contratos.length === 0 ? (
                                    <option value="">No hay contratos vigentes con máquinas</option>
                                ) : (
                                    <>
                                        <option value="">Selecciona un contrato...</option>
                                        {contratos.map((c) => (
                                            <option key={c.id_contrato} value={c.id_contrato}>
                                                {c.nombre} — {c.cliente}
                                            </option>
                                        ))}
                                    </>
                                )}
                            </select>
                            {errores.idContrato && <span className="op-field-error">{errores.idContrato}</span>}
                        </div>

                        <div className="op-form-section">
                            <label className="op-label">Máquina del contrato</label>
                            <select
                                className={`op-input op-select ${errores.idMaquina ? 'op-input-error' : ''}`}
                                value={idMaquina}
                                onChange={handleCambioMaquina}
                                disabled={!idContrato}
                            >
                                {!idContrato ? (
                                    <option value="">Primero selecciona el contrato</option>
                                ) : (
                                    <>
                                        {maquinasDelContrato.length > 1 && <option value="">Selecciona la máquina...</option>}
                                        {maquinasDelContrato.map((m) => (
                                            <option
                                                key={m.id_maquina}
                                                value={m.id_maquina}
                                                disabled={enTaller(m)}
                                            >
                                                {m.patente} — {m.marca} {m.modelo} ({m.tipo}){enTaller(m) ? ' — en taller' : ''}
                                            </option>
                                        ))}
                                    </>
                                )}
                            </select>
                            {maquinasDelContrato.length > 1 && !idMaquina && (
                                <span className="op-sub-txt">Este contrato tiene {maquinasDelContrato.length} máquinas: elige la que operó hoy.</span>
                            )}
                            {errores.idMaquina && <span className="op-field-error">{errores.idMaquina}</span>}
                        </div>

                        <div className="op-grid-2">
                            <div className="op-form-section">
                                <label className="op-label">Hora Inicio</label>
                                <input
                                    type="time"
                                    className="op-input"
                                    value={horaEntrada}
                                    onChange={(e) => { setHoraEntrada(e.target.value); setErrores((p) => ({ ...p, horario: null })); }}
                                />
                            </div>
                            <div className="op-form-section">
                                <label className="op-label">Hora Término</label>
                                <input
                                    type="time"
                                    className="op-input"
                                    value={horaSalida}
                                    onChange={(e) => { setHoraSalida(e.target.value); setErrores((p) => ({ ...p, horario: null })); }}
                                />
                            </div>
                        </div>
                        {errores.horario && <span className="op-field-error">{errores.horario}</span>}

                        <div className="op-grid-2">
                            <div className="op-form-section">
                                <label className="op-label">
                                    Horómetro Inicial (hrs) <span className="op-sub-txt">(Base)</span>
                                </label>
                                <input
                                    type="number"
                                    step="0.1"
                                    readOnly
                                    className="op-input op-input-readonly"
                                    value={horometroInicial}
                                />
                            </div>

                            <div className="op-form-section">
                                <label className="op-label">Horómetro Final (hrs)</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    className={`op-input ${errores.horometroFinal ? 'op-input-error' : ''}`}
                                    placeholder={`Mayor a ${horometroInicial || 0}`}
                                    value={horometroFinal}
                                    onChange={handleCambioHorometroFinal}
                                />
                                {errores.horometroFinal && <span className="op-field-error">{errores.horometroFinal}</span>}
                            </div>
                        </div>

                        <div className="op-summary-box">
                            <span className="op-summary-label">Horas trabajadas en faena:</span>
                            <span className="op-summary-num">{horasTrabajadasCalculadas} hrs</span>
                        </div>

                        <div className="op-fuel-wrapper">
                            <label className="op-toggle-container">
                                <input
                                    type="checkbox"
                                    className="op-checkbox"
                                    checked={cargoCombustible}
                                    onChange={(e) => setCargoCombustible(e.target.checked)}
                                />
                                <span className="op-toggle-text">¿Se abasteció combustible en el turno?</span>
                            </label>

                            {cargoCombustible && (
                                <div className="op-fuel-expand">
                                    <label className="op-label">Litros de Diésel Cargados</label>
                                    <input
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        className={`op-input ${errores.combustible ? 'op-input-error' : ''}`}
                                        placeholder="Ej: 45.0"
                                        value={combustible}
                                        onChange={(e) => setCombustible(e.target.value)}
                                    />
                                    {errores.combustible && <span className="op-field-error">{errores.combustible}</span>}
                                </div>
                            )}
                        </div>

                        {/* CERTIFICACIÓN SUPERVISOR */}
                        <div className="op-supervisor-card">
                            <div className="op-supervisor-header">
                                <span className="op-sub-badge">Certificación en Faena</span>
                                <h3 className="op-sub-title">Validación por Supervisor de Obra</h3>
                            </div>

                            <div className="op-declaracion-box">
                                <p className="op-declaracion-texto">
                                    <strong>Declaración operativa:</strong> Certifico que los horómetros e informes reflejan el trabajo efectivo en obra.
                                </p>
                                <label className="op-check-label">
                                    <input
                                        type="checkbox"
                                        className="op-checkbox"
                                        checked={declaracionSupervisor}
                                        onChange={(e) => setDeclaracionSupervisor(e.target.checked)}
                                    />
                                    <span>El supervisor aprueba la conformidad del turno.</span>
                                </label>
                                {errores.declaracion && <span className="op-field-error">{errores.declaracion}</span>}
                            </div>

                            <div className="op-signature-tabs">
                                <button
                                    type="button"
                                    className={`op-tab-btn ${metodoCertificacion === 'digital' ? 'active' : ''}`}
                                    onClick={() => setMetodoCertificacion('digital')}
                                >
                                    Firma
                                </button>
                                <button
                                    type="button"
                                    className={`op-tab-btn ${metodoCertificacion === 'foto' ? 'active' : ''}`}
                                    onClick={() => setMetodoCertificacion('foto')}
                                >
                                    Adjuntar foto de respaldo
                                </button>
                            </div>

                            {metodoCertificacion === 'digital' ? (
                                <div className="op-canvas-container">
                                    <div className="op-canvas-instructions">
                                        <span>Firma dentro del recuadro usando el dedo o puntero:</span>
                                        <button type="button" onClick={limpiarFirma} className="op-btn-clear">
                                            Eliminar firma
                                        </button>
                                    </div>
                                    <div className="op-canvas-frame">
                                        <canvas
                                            ref={canvasRef}
                                            width={440}
                                            height={140}
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
                                            className="op-file-input"
                                            onChange={(e) => e.target.files && setArchivoFoto(e.target.files[0])}
                                        />
                                        <div className="op-upload-content">
                                            <span className="op-upload-icon"></span>
                                            <span className="op-upload-title">
                                                {archivoFoto ? archivoFoto.name : 'Tomar foto del comprobante'}
                                            </span>
                                        </div>
                                    </label>
                                    {errores.firma && <span className="op-field-error">{errores.firma}</span>}
                                </div>
                            )}
                        </div>

                        <button
                            type="submit"
                            disabled={cargando}
                            className="op-btn-submit"
                        >
                            {cargando ? 'Guardando...' : 'Registrar parte diario'}
                        </button>

                        <div ref={avisoRef}>
                            {errores.general && <div className="op-alert-fail">{errores.general}</div>}
                            {mensajeExito && <div className="op-alert-ok">{mensajeExito}</div>}
                        </div>
                    </form>
                </div>

                {/* COLUMNA DERECHA: HISTORIAL ÚNICO */}
                <div className="op-sidebar">
                    <div className="op-side-card">
                        <div className="op-side-header">
                            <h3 className="op-side-title">Mis últimos Partes</h3>
                        </div>

                        <div className="op-history-list">
                            {reportesRecientes.map((r, i) => {
                                const patenteStr = r.maquina_patente || `Máquina #${r.id_maquina}`;

                                return (
                                    <div key={i} className="op-history-card">
                                        <div className="op-history-head">
                                            <span className="op-history-date">{formatoFechaCL(r.fecha)}</span>
                                            <span className="op-history-badge">+{r.horas_trabajadas} hrs</span>
                                        </div>
                                        <div className="op-history-details">
                                            <span className="op-history-patente">{patenteStr}</span>
                                            {r.combustible_litros > 0 && (
                                                <span className="op-history-fuel"> {r.combustible_litros}L Combustible</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {reportesRecientes.length === 0 && (
                                <p className="op-sub-txt">Sin registros de partes previos.</p>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
