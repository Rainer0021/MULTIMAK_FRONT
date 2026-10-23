import React, { useState, useEffect, useRef } from 'react';
import axios from '../api/axios';

function validarRutChileno(rutCompleto) {
    if (!rutCompleto || typeof rutCompleto !== 'string') return false;
    const valorLimpio = rutCompleto.replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();
    if (valorLimpio.length < 8 || valorLimpio.length > 9) return false;

    const cuerpo = valorLimpio.slice(0, -1);
    const dv = valorLimpio.slice(-1);

    if (!/^\d+$/.test(cuerpo)) return false;

    let suma = 0;
    let multiplo = 2;

    for (let i = cuerpo.length - 1; i >= 0; i--) {
        suma += multiplo * parseInt(cuerpo.charAt(i), 10);
        multiplo = multiplo < 7 ? multiplo + 1 : 2;
    }

    const dvEsperado = 11 - (suma % 11);
    let dvCalculado = '';
    if (dvEsperado === 11) dvCalculado = '0';
    else if (dvEsperado === 10) dvCalculado = 'K';
    else dvCalculado = dvEsperado.toString();

    return dv === dvCalculado;
}

function formatearRut(rut) {
    const limpio = rut.replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();
    if (limpio.length <= 1) return limpio;
    const cuerpo = limpio.slice(0, -1);
    const dv = limpio.slice(-1);
    return `${cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`;
}

export default function VistaAdmin() {
    const [pestañaActiva, setPestañaActiva] = useState('dashboard');
    const [maquinarias, setMaquinarias] = useState([]);
    const [operadores, setOperadores] = useState([]);
    const [reportes, setReportes] = useState([]);
    const [gastos, setGastos] = useState([]);
    const [cargando, setCargando] = useState(true);

    const [filtroTexto, setFiltroTexto] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('todos');

    const [menuDesplegableAbierto, setMenuDesplegableAbierto] = useState(false);
    const dropdownRef = useRef(null);

    const [modalActivo, setModalActivo] = useState(null);
    const [guardando, setGuardando] = useState(false);
    const [mensajeError, setMensajeError] = useState('');

    const [formMaq, setFormMaq] = useState({
        patente: '',
        tipo: 'Retroexcavadora',
        marca: 'Caterpillar',
        modelo: '416E',
        horometro_actual: '0',
        estado: 'Operativa'
    });

    const [formOp, setFormOp] = useState({
        nombre: '',
        apellido: '',
        rut: '',
        contraseña: 'changeme123',
        TipoLicencia: 'Clase D',
        fecha_vencimiento_licencia: ''
    });

    const [formGasto, setFormGasto] = useState({
        id_maquina: '',
        tipo_gasto: 'Combustible',
        monto: '',
        descripcion: '',
        fecha: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        const clickAfuera = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setMenuDesplegableAbierto(false);
            }
        };
        document.addEventListener('mousedown', clickAfuera);
        return () => document.removeEventListener('mousedown', clickAfuera);
    }, []);

    const cargarDatos = async () => {
        setCargando(true);
        try {
            const [resMaq, resRep, resGas, resOp] = await Promise.all([
                axios.get('/api/maquinarias/'),
                axios.get('/api/reports/'),
                axios.get('/api/gastos/'),
                axios.get('/api/operadores/')
            ]);
            setMaquinarias(resMaq.data || []);
            setReportes(resRep.data || []);
            setGastos(resGas.data || []);
            setOperadores(resOp.data || []);
            if (resMaq.data && resMaq.data.length > 0 && !formGasto.id_maquina) {
                setFormGasto((prev) => ({ ...prev, id_maquina: resMaq.data[0].id_maquina }));
            }
        } catch (err) {
            console.error('Error al sincronizar datos de flota:', err);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarDatos();
    }, []);

    const resolverDetalleMaquina = (idMaquina, detalleBackend) => {
        if (detalleBackend && detalleBackend.patente) {
            return `${detalleBackend.patente} (${detalleBackend.tipo || 'Equipo'})`;
        }
        const encontrada = maquinarias.find((m) => m.id_maquina === idMaquina || m.id === idMaquina);
        if (encontrada) {
            return `${encontrada.patente} (${encontrada.tipo})`;
        }
        return `Máquina #${idMaquina || 'S/I'}`;
    };

    const totalEquipos = maquinarias.length;
    const equiposOperativos = maquinarias.filter((m) => {
        const est = (m.estado || '').toLowerCase();
        return est.includes('oper') || est.includes('faena') || est.includes('disp');
    }).length;

    const equiposRequierenMant = maquinarias.filter((m) => {
        const h = parseFloat(m.horometro_actual) || 0;
        return (h % 250) >= 230;
    }).length;

    const alertasPauta = maquinarias.filter((m) => {
        const h = parseFloat(m.horometro_actual) || 0;
        const ciclo = h % 250;
        return ciclo >= 180 && ciclo < 230;
    }).length;

    const totalGastos = gastos.reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0);

    const hoy = new Date();
    const operadoresConAlertaLicencia = operadores.filter((op) => {
        if (!op.fecha_vencimiento_licencia) return false;
        const fVenc = new Date(op.fecha_vencimiento_licencia);
        const difDias = Math.ceil((fVenc - hoy) / (1000 * 60 * 60 * 24));
        return difDias <= 30;
    });

    const maquinariasFiltradas = maquinarias.filter((m) => {
        const coincide = (m.patente || '').toLowerCase().includes(filtroTexto.toLowerCase()) ||
            (m.tipo || '').toLowerCase().includes(filtroTexto.toLowerCase()) ||
            (m.marca || '').toLowerCase().includes(filtroTexto.toLowerCase()) ||
            (m.modelo || '').toLowerCase().includes(filtroTexto.toLowerCase());
        if (filtroEstado === 'todos') return coincide;
        const est = (m.estado || '').toLowerCase();
        if (filtroEstado === 'operativa') return coincide && (est.includes('oper') || est.includes('faena'));
        if (filtroEstado === 'taller') return coincide && est.includes('mant');
        return coincide;
    });

    const abrirModalEspecifico = (tipo) => {
        setMenuDesplegableAbierto(false);
        setMensajeError('');
        if (tipo === 'gasto' && maquinarias.length > 0 && !formGasto.id_maquina) {
            setFormGasto((prev) => ({ ...prev, id_maquina: maquinarias[0].id_maquina }));
        }
        setModalActivo(tipo);
    };

    const eliminarElemento = async (endpoint, id, nombre) => {
        if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente: ${nombre}?`)) {
            return;
        }
        try {
            await axios.delete(`/api/${endpoint}/${id}/`);
            cargarDatos();
        } catch (err) {
            alert(`No se pudo eliminar el registro. Puede estar asociado a turnos o gastos activos.`);
        }
    };

    const enviarRegistro = async (e) => {
        e.preventDefault();
        setGuardando(true);
        setMensajeError('');

        try {
            if (modalActivo === 'maquinaria') {
                const patenteLimpia = formMaq.patente.trim().toUpperCase();
                if (patenteLimpia.length < 5) {
                    setMensajeError('La patente debe tener un formato válido (mínimo 5 caracteres).');
                    setGuardando(false);
                    return;
                }

                await axios.post('/api/maquinarias/', {
                    ...formMaq,
                    patente: patenteLimpia,
                    horometro_actual: parseFloat(formMaq.horometro_actual) || 0
                });
            } else if (modalActivo === 'operador') {
                if (!validarRutChileno(formOp.rut)) {
                    setMensajeError('El RUT ingresado no es válido. Verifica el número y el dígito verificador.');
                    setGuardando(false);
                    return;
                }

                if (!formOp.fecha_vencimiento_licencia) {
                    setMensajeError('Debes indicar la fecha de vencimiento de la licencia municipal.');
                    setGuardando(false);
                    return;
                }

                await axios.post('/api/operadores/', {
                    ...formOp,
                    rut: formatearRut(formOp.rut),
                    nombre_input: formOp.nombre.trim(),
                    apellido_input: formOp.apellido.trim(),
                    rut_input: formatearRut(formOp.rut)
                });
            } else if (modalActivo === 'gasto') {
                const maquinaSeleccionada = formGasto.id_maquina || (maquinarias.length > 0 ? maquinarias[0].id_maquina : null);

                if (!maquinaSeleccionada) {
                    setMensajeError('Debes seleccionar una maquinaria.');
                    setGuardando(false);
                    return;
                }

                const montoNum = parseFloat(formGasto.monto);
                if (isNaN(montoNum) || montoNum <= 0) {
                    setMensajeError('El monto del gasto debe ser un número mayor a 0.');
                    setGuardando(false);
                    return;
                }

                const payloadGasto = {
                    id_maquina: parseInt(maquinaSeleccionada, 10),
                    categoria_gasto: formGasto.tipo_gasto,
                    tipo_gasto: formGasto.tipo_gasto,
                    monto: montoNum,
                    descripcion: formGasto.descripcion || '',
                    fecha: formGasto.fecha || new Date().toISOString().split('T')[0]
                };

                await axios.post('/api/gastos/', payloadGasto);
            }

            setModalActivo(null);
            cargarDatos();
        } catch (err) {
            const respuestaServidor = err.response?.data;
            if (respuestaServidor) {
                const detalle = typeof respuestaServidor === 'object'
                    ? Object.entries(respuestaServidor).map(([k, v]) => `${k}: ${v}`).join(' | ')
                    : JSON.stringify(respuestaServidor);
                setMensajeError(`Error del servidor: ${detalle}`);
            } else {
                setMensajeError('Error al guardar. Revisa que no existan datos duplicados.');
            }
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '22px' }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
                backgroundColor: '#0f172a',
                padding: '22px 28px',
                borderRadius: '18px',
                boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.25)',
                border: '1px solid #1e293b'
            }}>
                <div>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        ADMINISTRACIÓN GENERAL • MULTIMAK 360
                    </span>
                    <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#ffffff', margin: '4px 0 0', letterSpacing: '-0.02em' }}>
                        Panel de Supervisión y Control Operacional
                    </h1>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button
                        onClick={cargarDatos}
                        style={{
                            backgroundColor: '#1e293b',
                            border: '1px solid #334155',
                            color: '#e2e8f0',
                            padding: '10px 18px',
                            borderRadius: '10px',
                            fontWeight: '700',
                            fontSize: '12px',
                            cursor: 'pointer'
                        }}
                    >
                        Sincronizar ⟳
                    </button>

                    <div ref={dropdownRef} style={{ position: 'relative' }}>
                        <button
                            onClick={() => setMenuDesplegableAbierto(!menuDesplegableAbierto)}
                            style={{
                                backgroundColor: '#f59e0b',
                                border: 'none',
                                color: '#0f172a',
                                padding: '10px 18px',
                                borderRadius: '10px',
                                fontWeight: '800',
                                fontSize: '12px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.4)'
                            }}
                        >
                            <span>+ Nuevo Registro</span>
                            <span style={{ fontSize: '10px', transform: menuDesplegableAbierto ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                        </button>

                        {menuDesplegableAbierto && (
                            <div style={{
                                position: 'absolute',
                                top: 'calc(100% + 8px)',
                                right: 0,
                                backgroundColor: '#ffffff',
                                borderRadius: '12px',
                                boxShadow: '0 12px 30px rgba(15, 23, 42, 0.25)',
                                border: '1px solid #e2e8f0',
                                width: '210px',
                                zIndex: 60,
                                overflow: 'hidden',
                                display: 'flex',
                                flexDirection: 'column'
                            }}>
                                <button
                                    onClick={() => abrirModalEspecifico('maquinaria')}
                                    style={{
                                        padding: '12px 16px',
                                        textAlign: 'left',
                                        background: 'none',
                                        border: 'none',
                                        fontSize: '13px',
                                        fontWeight: '700',
                                        color: '#0f172a',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        borderBottom: '1px solid #f1f5f9'
                                    }}
                                >
                                    <span style={{ fontSize: '16px' }}>🚜</span> Nueva Maquinaria
                                </button>

                                <button
                                    onClick={() => abrirModalEspecifico('operador')}
                                    style={{
                                        padding: '12px 16px',
                                        textAlign: 'left',
                                        background: 'none',
                                        border: 'none',
                                        fontSize: '13px',
                                        fontWeight: '700',
                                        color: '#0f172a',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        borderBottom: '1px solid #f1f5f9'
                                    }}
                                >
                                    <span style={{ fontSize: '16px' }}>👷</span> Nuevo Operador
                                </button>

                                <button
                                    onClick={() => abrirModalEspecifico('gasto')}
                                    style={{
                                        padding: '12px 16px',
                                        textAlign: 'left',
                                        background: 'none',
                                        border: 'none',
                                        fontSize: '13px',
                                        fontWeight: '700',
                                        color: '#0f172a',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px'
                                    }}
                                >
                                    <span style={{ fontSize: '16px' }}>⛽</span> Registrar Gasto
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div style={{
                backgroundColor: '#1e293b',
                borderRadius: '14px',
                padding: '6px',
                display: 'flex',
                gap: '6px',
                overflowX: 'auto',
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)'
            }}>
                {[
                    { id: 'dashboard', label: 'DASHBOARD / SEMÁFORO' },
                    { id: 'equipos', label: `EQUIPOS (${totalEquipos})` },
                    { id: 'operadores', label: `OPERADORES (${operadores.length})` },
                    { id: 'turnos', label: `TURNOS RECIBIDOS (${reportes.length})` },
                    { id: 'gastos', label: `GASTOS ($${totalGastos.toLocaleString('es-CL')})` }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setPestañaActiva(tab.id)}
                        style={{
                            backgroundColor: pestañaActiva === tab.id ? '#0f172a' : 'transparent',
                            color: pestañaActiva === tab.id ? '#f59e0b' : '#94a3b8',
                            border: pestañaActiva === tab.id ? '1px solid #334155' : '1px solid transparent',
                            borderRadius: '10px',
                            padding: '10px 18px',
                            fontSize: '11px',
                            fontWeight: '800',
                            letterSpacing: '0.04em',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                <div style={{ backgroundColor: '#ffffff', padding: '18px 22px', borderRadius: '16px', border: '1px solid #e2e8f0', borderTop: '4px solid #0f172a', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)' }}>
                    <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Flota Total</span>
                    <div style={{ fontSize: '28px', fontWeight: '900', color: '#0f172a', fontFamily: 'Consolas, monospace', marginTop: '2px' }}>
                        {totalEquipos}
                    </div>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>Inventario registrado</span>
                </div>

                <div style={{ backgroundColor: '#ffffff', padding: '18px 22px', borderRadius: '16px', border: '1px solid #e2e8f0', borderTop: '4px solid #16a34a', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)' }}>
                    <span style={{ fontSize: '10px', fontWeight: '800', color: '#16a34a', textTransform: 'uppercase' }}>Operativas</span>
                    <div style={{ fontSize: '28px', fontWeight: '900', color: '#15803d', fontFamily: 'Consolas, monospace', marginTop: '2px' }}>
                        {equiposOperativos}
                    </div>
                    <span style={{ fontSize: '11px', color: '#86efac' }}>En faena o listas</span>
                </div>

                <div style={{ backgroundColor: '#ffffff', padding: '18px 22px', borderRadius: '16px', border: '1px solid #e2e8f0', borderTop: '4px solid #dc2626', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)' }}>
                    <span style={{ fontSize: '10px', fontWeight: '800', color: '#dc2626', textTransform: 'uppercase' }}>Requiere Mant.</span>
                    <div style={{ fontSize: '28px', fontWeight: '900', color: '#b91c1c', fontFamily: 'Consolas, monospace', marginTop: '2px' }}>
                        {equiposRequierenMant}
                    </div>
                    <span style={{ fontSize: '11px', color: '#fca5a5' }}>Pendientes de taller</span>
                </div>

                <div style={{ backgroundColor: '#ffffff', padding: '18px 22px', borderRadius: '16px', border: '1px solid #e2e8f0', borderTop: '4px solid #2563eb', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)' }}>
                    <span style={{ fontSize: '10px', fontWeight: '800', color: '#2563eb', textTransform: 'uppercase' }}>Alertas Pauta</span>
                    <div style={{ fontSize: '28px', fontWeight: '900', color: '#1d4ed8', fontFamily: 'Consolas, monospace', marginTop: '2px' }}>
                        {alertasPauta}
                    </div>
                    <span style={{ fontSize: '11px', color: '#93c5fd' }}>Ventana 450h / 950h</span>
                </div>
            </div>

            {operadoresConAlertaLicencia.length > 0 && (
                <div style={{
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fef3c7',
                    borderLeft: '4px solid #f59e0b',
                    borderRadius: '12px',
                    padding: '14px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div style={{ fontSize: '12px', color: '#92400e', fontWeight: '600' }}>
                        ⚠️ Hay {operadoresConAlertaLicencia.length} operador(es) con licencia por vencer o vencida.
                    </div>
                    <button
                        onClick={() => setPestañaActiva('operadores')}
                        style={{ backgroundColor: '#f59e0b', color: '#0f172a', border: 'none', padding: '6px 14px', borderRadius: '8px', fontSize: '11px', fontWeight: '800', cursor: 'pointer' }}
                    >
                        Revisar
                    </button>
                </div>
            )}

            {pestañaActiva === 'dashboard' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <input
                            type="text"
                            placeholder="Filtrar por patente (ej: BK-PT-45), equipo o modelo..."
                            value={filtroTexto}
                            onChange={(e) => setFiltroTexto(e.target.value)}
                            style={{
                                flex: 1,
                                minWidth: '260px',
                                height: '42px',
                                backgroundColor: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '10px',
                                padding: '0 16px',
                                fontSize: '13px',
                                color: '#0f172a',
                                outline: 'none'
                            }}
                        />
                        <select
                            value={filtroEstado}
                            onChange={(e) => setFiltroEstado(e.target.value)}
                            style={{
                                height: '42px',
                                backgroundColor: '#ffffff',
                                border: '1px solid #cbd5e1',
                                borderRadius: '10px',
                                padding: '0 16px',
                                fontSize: '13px',
                                color: '#0f172a',
                                outline: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="todos">Todos los estados</option>
                            <option value="operativa">Operativas</option>
                            <option value="taller">En Mantenimiento</option>
                        </select>
                    </div>

                    <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                                        <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase' }}>Patente</th>
                                        <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase' }}>Maquinaria</th>
                                        <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase' }}>Horómetro</th>
                                        <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase' }}>Semáforo Preventivo</th>
                                        <th style={{ padding: '14px 20px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase' }}>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {maquinariasFiltradas.map((m) => {
                                        const horom = parseFloat(m.horometro_actual) || 0;
                                        const ciclo = horom % 250;
                                        const faltan = Math.max(0, (250 - ciclo).toFixed(0));
                                        const porcentaje = Math.min(100, Math.round((ciclo / 250) * 100));
                                        const critico = ciclo >= 230;
                                        const alerta = ciclo >= 180 && ciclo < 230;

                                        return (
                                            <tr key={m.id_maquina} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '14px 20px', fontWeight: '800', color: '#0f172a', fontFamily: 'Consolas, monospace' }}>
                                                    {m.patente}
                                                </td>
                                                <td style={{ padding: '14px 20px' }}>
                                                    <span style={{ fontWeight: '700', color: '#0f172a' }}>{m.tipo}</span>
                                                    <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>{m.marca} {m.modelo}</span>
                                                </td>
                                                <td style={{ padding: '14px 20px', fontFamily: 'Consolas, monospace', fontWeight: '800', color: '#0f172a' }}>
                                                    {horom.toFixed(1)} hrs
                                                </td>
                                                <td style={{ padding: '14px 20px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <span style={{
                                                            fontSize: '11px',
                                                            fontWeight: '700',
                                                            color: critico ? '#dc2626' : alerta ? '#d97706' : '#16a34a',
                                                            minWidth: '140px'
                                                        }}>
                                                            {critico ? `¡Taller! (en ${faltan} hrs)` : `Próx. 1000h (en ${faltan} hrs)`}
                                                        </span>
                                                        <div style={{ width: '120px', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                                            <div style={{
                                                                width: `${porcentaje}%`,
                                                                height: '100%',
                                                                backgroundColor: critico ? '#ef4444' : alerta ? '#f59e0b' : '#22c55e'
                                                            }} />
                                                        </div>
                                                        <span style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'Consolas, monospace' }}>{porcentaje}%</span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '14px 20px' }}>
                                                    <span style={{
                                                        display: 'inline-block',
                                                        padding: '4px 10px',
                                                        borderRadius: '6px',
                                                        fontSize: '10px',
                                                        fontWeight: '800',
                                                        backgroundColor: '#dcfce7',
                                                        color: '#15803d'
                                                    }}>
                                                        {m.estado || 'OPERATIVA'}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {pestañaActiva === 'equipos' && (
                <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>Catálogo de Maquinarias</h3>
                        <button
                            onClick={() => abrirModalEspecifico('maquinaria')}
                            style={{ backgroundColor: '#0f172a', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                        >
                            + Agregar Equipo
                        </button>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800' }}>PATENTE</th>
                                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800' }}>TIPO</th>
                                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800' }}>MARCA</th>
                                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800' }}>MODELO</th>
                                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800' }}>HORÓMETRO BASE</th>
                                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800' }}>ESTADO</th>
                                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800', textAlign: 'center' }}>ACCIONES</th>
                                </tr>
                            </thead>
                            <tbody>
                                {maquinarias.map((m) => (
                                    <tr key={m.id_maquina} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '14px 16px', fontWeight: '800', fontFamily: 'Consolas, monospace', color: '#0f172a' }}>{m.patente}</td>
                                        <td style={{ padding: '14px 16px', fontWeight: '700', color: '#1e293b' }}>{m.tipo}</td>
                                        <td style={{ padding: '14px 16px', color: '#475569' }}>{m.marca}</td>
                                        <td style={{ padding: '14px 16px', color: '#475569' }}>{m.modelo}</td>
                                        <td style={{ padding: '14px 16px', fontFamily: 'Consolas, monospace', fontWeight: '700', color: '#0f172a' }}>{parseFloat(m.horometro_actual || 0).toFixed(1)} hrs</td>
                                        <td style={{ padding: '14px 16px' }}>
                                            <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '700', backgroundColor: '#f1f5f9', color: '#334155' }}>
                                                {m.estado || 'Disponible'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                            <button
                                                onClick={() => eliminarElemento('maquinarias', m.id_maquina, `Maquinaria [${m.patente}] ${m.tipo}`)}
                                                title="Eliminar maquinaria"
                                                style={{
                                                    backgroundColor: '#fee2e2',
                                                    color: '#dc2626',
                                                    border: 'none',
                                                    padding: '6px 12px',
                                                    borderRadius: '8px',
                                                    fontSize: '12px',
                                                    fontWeight: '800',
                                                    cursor: 'pointer'
                                                }}
                                            >
                                                Eliminar ✕
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {pestañaActiva === 'operadores' && (
                <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>Nómina de Operadores y Licencias</h3>
                        <button
                            onClick={() => abrirModalEspecifico('operador')}
                            style={{ backgroundColor: '#0f172a', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                        >
                            + Registrar Operador
                        </button>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800' }}>RUT</th>
                                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800' }}>NOMBRE</th>
                                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800' }}>CLASE LICENCIA</th>
                                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800' }}>VENCIMIENTO</th>
                                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800' }}>ESTADO LICENCIA</th>
                                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800', textAlign: 'center' }}>ACCIONES</th>
                                </tr>
                            </thead>
                            <tbody>
                                {operadores.map((op) => {
                                    const venc = op.fecha_vencimiento_licencia ? new Date(op.fecha_vencimiento_licencia) : null;
                                    const vencida = venc && venc < hoy;
                                    const rutMostrado = op.rut || op.id_usuario_detalle?.rut || '—';
                                    const nombreCompleto = op.nombre ? `${op.nombre} ${op.apellido || ''}` : (op.id_usuario_detalle ? `${op.id_usuario_detalle.nombre} ${op.id_usuario_detalle.apellido}` : 'Operador');

                                    return (
                                        <tr key={op.id_operador} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '14px 16px', fontFamily: 'Consolas, monospace', fontWeight: '700', color: '#0f172a' }}>
                                                {rutMostrado}
                                            </td>
                                            <td style={{ padding: '14px 16px', fontWeight: '700', color: '#0f172a' }}>
                                                {nombreCompleto}
                                            </td>
                                            <td style={{ padding: '14px 16px', color: '#475569' }}>{op.TipoLicencia || 'Clase D'}</td>
                                            <td style={{ padding: '14px 16px', color: '#475569' }}>{op.fecha_vencimiento_licencia || 'Sin registrar'}</td>
                                            <td style={{ padding: '14px 16px' }}>
                                                <span style={{
                                                    padding: '4px 10px',
                                                    borderRadius: '6px',
                                                    fontSize: '11px',
                                                    fontWeight: '800',
                                                    backgroundColor: vencida ? '#fee2e2' : '#dcfce7',
                                                    color: vencida ? '#991b1b' : '#166534'
                                                }}>
                                                    {vencida ? 'VENCIDA' : 'AL DÍA'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                                <button
                                                    onClick={() => eliminarElemento('operadores', op.id_operador, `Operador ${nombreCompleto}`)}
                                                    title="Eliminar operador"
                                                    style={{
                                                        backgroundColor: '#fee2e2',
                                                        color: '#dc2626',
                                                        border: 'none',
                                                        padding: '6px 12px',
                                                        borderRadius: '8px',
                                                        fontSize: '12px',
                                                        fontWeight: '800',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Eliminar ✕
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {pestañaActiva === 'turnos' && (
                <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>Partes Diarios Enviados desde Faena</h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800' }}>FECHA</th>
                                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800' }}>MÁQUINA</th>
                                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800' }}>HORAS TURNO</th>
                                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800' }}>HORÓMETROS</th>
                                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800' }}>COMBUSTIBLE</th>
                                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800' }}>ESTADO FIRMA</th>
                                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800', textAlign: 'center' }}>ACCIONES</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportes.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                                            No se han recibido turnos todavía.
                                        </td>
                                    </tr>
                                ) : (
                                    reportes.map((r) => (
                                        <tr key={r.id_report} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '14px 16px', fontWeight: '700', color: '#0f172a' }}>{r.fecha}</td>
                                            <td style={{ padding: '14px 16px', color: '#334155' }}>
                                                {resolverDetalleMaquina(r.id_maquina, r.id_maquina_detalle)}
                                            </td>
                                            <td style={{ padding: '14px 16px', fontWeight: '800', color: '#0f172a', fontFamily: 'Consolas, monospace' }}>
                                                {r.horas_trabajadas} hrs
                                            </td>
                                            <td style={{ padding: '14px 16px', color: '#64748b', fontSize: '12px' }}>
                                                {r.horometro_inicial} → {r.horometro_final}
                                            </td>
                                            <td style={{ padding: '14px 16px', color: '#334155' }}>{r.combustible_litros || 0} Lts</td>
                                            <td style={{ padding: '14px 16px' }}>
                                                <span style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: '800', backgroundColor: '#dcfce7', color: '#166534' }}>
                                                    VISADO EN FAENA
                                                </span>
                                            </td>
                                            <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                                <button
                                                    onClick={() => eliminarElemento('reports', r.id_report, `Parte Diario ID #${r.id_report}`)}
                                                    title="Eliminar reporte de turno"
                                                    style={{
                                                        backgroundColor: '#fee2e2',
                                                        color: '#dc2626',
                                                        border: 'none',
                                                        padding: '6px 12px',
                                                        borderRadius: '8px',
                                                        fontSize: '12px',
                                                        fontWeight: '800',
                                                        cursor: 'pointer'
                                                    }}
                                                >
                                                    Eliminar ✕
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {pestañaActiva === 'gastos' && (
                <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>Registro de Gastos Operativos y Combustible</h3>
                        <button
                            onClick={() => abrirModalEspecifico('gasto')}
                            style={{ backgroundColor: '#0f172a', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                        >
                            + Registrar Gasto
                        </button>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800' }}>FECHA</th>
                                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800' }}>CATEGORÍA</th>
                                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800' }}>MÁQUINA ASOCIADA</th>
                                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800' }}>MONTO</th>
                                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800' }}>DETALLE</th>
                                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800', textAlign: 'center' }}>ACCIONES</th>
                                </tr>
                            </thead>
                            <tbody>
                                {gastos.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                                            No hay gastos registrados.
                                        </td>
                                    </tr>
                                ) : (
                                    gastos.map((g) => {
                                        const cat = g.categoria_gasto || g.tipo_gasto || 'General';
                                        const nombreMaquina = resolverDetalleMaquina(g.id_maquina, g.id_maquina_detalle);
                                        return (
                                            <tr key={g.id_gasto} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '14px 16px', color: '#475569' }}>{g.fecha}</td>
                                                <td style={{ padding: '14px 16px', fontWeight: '700', color: '#0f172a' }}>{cat}</td>
                                                <td style={{ padding: '14px 16px', fontWeight: '700', color: '#0f172a', fontFamily: 'Consolas, monospace' }}>
                                                    {nombreMaquina}
                                                </td>
                                                <td style={{ padding: '14px 16px', fontWeight: '900', color: '#0f172a', fontFamily: 'Consolas, monospace' }}>
                                                    ${parseFloat(g.monto || 0).toLocaleString('es-CL')}
                                                </td>
                                                <td style={{ padding: '14px 16px', color: '#64748b' }}>{g.descripcion || '—'}</td>
                                                <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                                    <button
                                                        onClick={() => eliminarElemento('gastos', g.id_gasto, `Gasto $${parseFloat(g.monto || 0).toLocaleString('es-CL')} de ${cat}`)}
                                                        title="Eliminar gasto"
                                                        style={{
                                                            backgroundColor: '#fee2e2',
                                                            color: '#dc2626',
                                                            border: 'none',
                                                            padding: '6px 12px',
                                                            borderRadius: '8px',
                                                            fontSize: '12px',
                                                            fontWeight: '800',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        Eliminar ✕
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {modalActivo && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    backdropFilter: 'blur(3px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 100,
                    padding: '16px'
                }}>
                    <div style={{
                        backgroundColor: '#ffffff',
                        borderRadius: '20px',
                        width: '100%',
                        maxWidth: '480px',
                        padding: '28px',
                        boxShadow: '0 20px 40px rgba(15, 23, 42, 0.3)',
                        boxSizing: 'border-box'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                                {modalActivo === 'maquinaria' && '🚜 Alta de Nueva Maquinaria'}
                                {modalActivo === 'operador' && '👷 Registrar Nuevo Operador'}
                                {modalActivo === 'gasto' && '⛽ Registro de Gasto Operativo'}
                            </h3>
                            <button
                                onClick={() => setModalActivo(null)}
                                style={{ background: 'none', border: 'none', fontSize: '18px', color: '#94a3b8', cursor: 'pointer', fontWeight: '700' }}
                            >
                                ✕
                            </button>
                        </div>

                        {mensajeError && (
                            <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: '10px', fontSize: '12px', marginBottom: '14px', fontWeight: '700' }}>
                                {mensajeError}
                            </div>
                        )}

                        <form onSubmit={enviarRegistro} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {modalActivo === 'maquinaria' && (
                                <>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>Patente</label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="HN-ZW-53"
                                            value={formMaq.patente}
                                            onChange={(e) => setFormMaq({ ...formMaq, patente: e.target.value.toUpperCase() })}
                                            style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>Tipo</label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="Excavadora"
                                                value={formMaq.tipo}
                                                onChange={(e) => setFormMaq({ ...formMaq, tipo: e.target.value })}
                                                style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>Modelo</label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="CAT 320D"
                                                value={formMaq.modelo}
                                                onChange={(e) => setFormMaq({ ...formMaq, modelo: e.target.value })}
                                                style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>Horómetro Base</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            required
                                            placeholder="0.0"
                                            value={formMaq.horometro_actual}
                                            onChange={(e) => setFormMaq({ ...formMaq, horometro_actual: e.target.value })}
                                            style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                </>
                            )}

                            {modalActivo === 'operador' && (
                                <>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>Nombre</label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="Juan"
                                                value={formOp.nombre}
                                                onChange={(e) => setFormOp({ ...formOp, nombre: e.target.value })}
                                                style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>Apellido</label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="Pérez"
                                                value={formOp.apellido}
                                                onChange={(e) => setFormOp({ ...formOp, apellido: e.target.value })}
                                                style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>
                                            RUT del Chofer (Chileno Válido)
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="18.111.222-3"
                                            value={formOp.rut}
                                            onChange={(e) => setFormOp({ ...formOp, rut: e.target.value })}
                                            style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>Licencia</label>
                                            <select
                                                value={formOp.TipoLicencia}
                                                onChange={(e) => setFormOp({ ...formOp, TipoLicencia: e.target.value })}
                                                style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '10px', border: '1px solid #cbd5e1', backgroundColor: '#fff', boxSizing: 'border-box' }}
                                            >
                                                <option value="Clase D">Clase D (Maquinaria)</option>
                                                <option value="Clase A4">Clase A4 (Cargas)</option>
                                                <option value="Clase B">Clase B (Vehículos)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>Vencimiento</label>
                                            <input
                                                type="date"
                                                required
                                                value={formOp.fecha_vencimiento_licencia}
                                                onChange={(e) => setFormOp({ ...formOp, fecha_vencimiento_licencia: e.target.value })}
                                                style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}

                            {modalActivo === 'gasto' && (
                                <>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>Maquinaria</label>
                                        <select
                                            value={formGasto.id_maquina}
                                            onChange={(e) => setFormGasto({ ...formGasto, id_maquina: e.target.value })}
                                            style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box', backgroundColor: '#fff' }}
                                        >
                                            {maquinarias.map((m) => (
                                                <option key={m.id_maquina} value={m.id_maquina}>
                                                    [{m.patente}] {m.tipo} - {m.modelo}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>Categoría de Gasto</label>
                                            <select
                                                value={formGasto.tipo_gasto}
                                                onChange={(e) => setFormGasto({ ...formGasto, tipo_gasto: e.target.value })}
                                                style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box', backgroundColor: '#fff' }}
                                            >
                                                <option value="Combustible">Combustible</option>
                                                <option value="Repuesto">Repuesto</option>
                                                <option value="Mantención">Mantención</option>
                                                <option value="Traslado">Traslado</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>Monto ($)</label>
                                            <input
                                                type="number"
                                                required
                                                placeholder="50000"
                                                value={formGasto.monto}
                                                onChange={(e) => setFormGasto({ ...formGasto, monto: e.target.value })}
                                                style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '4px' }}>Descripción</label>
                                        <input
                                            type="text"
                                            placeholder="Carga de 80 Lts de petróleo en Copec..."
                                            value={formGasto.descripcion}
                                            onChange={(e) => setFormGasto({ ...formGasto, descripcion: e.target.value })}
                                            style={{ width: '100%', height: '42px', padding: '0 12px', borderRadius: '10px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                </>
                            )}

                            <button
                                type="submit"
                                disabled={guardando}
                                style={{
                                    marginTop: '10px',
                                    height: '46px',
                                    backgroundColor: '#f59e0b',
                                    color: '#0f172a',
                                    border: 'none',
                                    borderRadius: '10px',
                                    fontSize: '12px',
                                    fontWeight: '800',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                    cursor: guardando ? 'not-allowed' : 'pointer',
                                    boxShadow: '0 4px 12px rgba(245, 158, 11, 0.3)'
                                }}
                            >
                                {guardando ? 'Guardando Registro...' : 'Confirmar y Guardar'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}