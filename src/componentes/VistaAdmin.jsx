import React, { useState, useEffect, useRef } from 'react';
import axios from '../api/axios';

export default function VistaAdmin() {
    const [tabActiva, setTabActiva] = useState('dashboard');
    const [maquinarias, setMaquinarias] = useState([]);
    const [reportes, setReportes] = useState([]);
    const [operadores, setOperadores] = useState([]);
    const [gastos, setGastos] = useState([]);
    const [busqueda, setBusqueda] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('TODOS');
    const [cargando, setCargando] = useState(true);

    // Estado para el menú desplegable
    const [menuAccionesAbierto, setMenuAccionesAbierto] = useState(false);
    const dropdownRef = useRef(null);

    // Modales
    const [modalNuevaMaquina, setModalNuevaMaquina] = useState(false);
    const [modalNuevoOperador, setModalNuevoOperador] = useState(false);
    const [modalNuevoGasto, setModalNuevoGasto] = useState(false);
    const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

    // Formularios
    const [formMaquina, setFormMaquina] = useState({
        patente: '',
        tipo: 'Excavadora',
        marca: '',
        modelo: '',
        horometro_actual: 0,
        estado: 'OPERATIVA'
    });

    const [formOperador, setFormOperador] = useState({
        nombre: '',
        apellido: '',
        rut: '',
        TipoLicencia: 'Clase D',
        fecha_vencimiento_licencia: ''
    });

    const [formGasto, setFormGasto] = useState({
        id_maquina: '',
        tipoGasto: 'Repuesto',
        monto: '',
        fecha: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        cargarDatos();

        // Cerrar el menú desplegable si se hace clic afuera
        const handleClickAfuera = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setMenuAccionesAbierto(false);
            }
        };
        document.addEventListener('mousedown', handleClickAfuera);
        return () => document.removeEventListener('mousedown', handleClickAfuera);
    }, []);

    const cargarDatos = async () => {
        setCargando(true);
        setMensaje({ tipo: '', texto: '' });

        try {
            const resMaq = await axios.get('/api/maquinarias/');
            setMaquinarias(resMaq.data || []);

            try {
                const resRep = await axios.get('/api/reports/');
                const dataRep = resRep.data || [];
                const reportesOrdenados = [...dataRep].sort((a, b) => {
                    const idA = a.id_report || a.id || 0;
                    const idB = b.id_report || b.id || 0;
                    if (idA && idB) return idB - idA;
                    return new Date(b.fecha || 0) - new Date(a.fecha || 0);
                });
                setReportes(reportesOrdenados);
            } catch (errRep) {
                setReportes([]);
            }

            try {
                const resOp = await axios.get('/api/operadores/');
                setOperadores(resOp.data || []);
            } catch (errOp) {
                setOperadores([]);
            }

            try {
                const resGas = await axios.get('/api/gastos/');
                setGastos(resGas.data || []);
            } catch (errGas) {
                setGastos([]);
            }

        } catch (err) {
            console.error(err);
            setMensaje({ tipo: 'error', texto: 'No se pudo conectar con el servidor backend.' });
        } finally {
            setCargando(false);
        }
    };

    const crearMaquinaria = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/maquinarias/', {
                ...formMaquina,
                horometro_actual: parseFloat(formMaquina.horometro_actual) || 0
            });
            setMensaje({ tipo: 'exito', texto: `Maquinaria ${formMaquina.patente} registrada correctamente.` });
            setModalNuevaMaquina(false);
            setFormMaquina({ patente: '', tipo: 'Excavadora', marca: '', modelo: '', horometro_actual: 0, estado: 'OPERATIVA' });
            cargarDatos();
        } catch (err) {
            setMensaje({ tipo: 'error', texto: 'Error al registrar la maquinaria en la base de datos.' });
        }
    };

    const crearOperador = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/operadores/', formOperador);
            setMensaje({ tipo: 'exito', texto: `Operador ${formOperador.nombre} ${formOperador.apellido} registrado.` });
            setModalNuevoOperador(false);
            setFormOperador({ nombre: '', apellido: '', rut: '', TipoLicencia: 'Clase D', fecha_vencimiento_licencia: '' });
            cargarDatos();
        } catch (err) {
            setMensaje({ tipo: 'error', texto: 'Error al registrar el operador.' });
        }
    };

    const crearGasto = async (e) => {
        e.preventDefault();
        try {
            await axios.post('/api/gastos/', {
                ...formGasto,
                id_maquina: parseInt(formGasto.id_maquina) || null,
                monto: parseFloat(formGasto.monto) || 0
            });
            setMensaje({ tipo: 'exito', texto: 'Gasto operativo registrado con éxito.' });
            setModalNuevoGasto(false);
            setFormGasto({ id_maquina: '', tipoGasto: 'Repuesto', monto: '', fecha: new Date().toISOString().split('T')[0] });
            cargarDatos();
        } catch (err) {
            setMensaje({ tipo: 'error', texto: 'Error al registrar el gasto.' });
        }
    };

    const cambiarEstadoRapido = async (idMaquina, nuevoEstado) => {
        try {
            await axios.patch(`/api/maquinarias/${idMaquina}/`, { estado: nuevoEstado });
            setMaquinarias((prev) =>
                prev.map((m) => (m.id_maquina === idMaquina ? { ...m, estado: nuevoEstado } : m))
            );
            setMensaje({ tipo: 'exito', texto: `Estado actualizado a ${nuevoEstado}.` });
        } catch (err) {
            setMensaje({ tipo: 'error', texto: 'No se pudo actualizar el estado de la máquina.' });
        }
    };

    const calcularMantencion = (horometro) => {
        const h = parseFloat(horometro) || 0;
        const ciclo = h % 1000;

        if (ciclo >= 950) {
            const faltan = Math.round((1000 - ciclo) * 10) / 10;
            const porcentaje = Math.min(100, Math.round(((ciclo - 500) / 500) * 100));
            return {
                tag: `Pauta 1.000h: faltan ${faltan} hrs`,
                color: '#b45309',
                bar: '#d97706',
                porcentaje,
                esAlerta: true
            };
        }

        if (ciclo >= 500 && ciclo < 550) {
            const exceso = Math.round((ciclo - 500) * 10) / 10;
            return {
                tag: `Pauta 500h vencida (+${exceso} hrs)`,
                color: '#991b1b',
                bar: '#dc2626',
                porcentaje: 100,
                esAlerta: true
            };
        }

        if (ciclo >= 450 && ciclo < 500) {
            const faltan = Math.round((500 - ciclo) * 10) / 10;
            const porcentaje = Math.min(100, Math.round((ciclo / 500) * 100));
            return {
                tag: `Pauta 500h: faltan ${faltan} hrs`,
                color: '#b45309',
                bar: '#d97706',
                porcentaje,
                esAlerta: true
            };
        }

        const proximaMeta = ciclo < 450 ? 500 : 1000;
        const base = ciclo < 450 ? 0 : 500;
        const faltan = Math.round((proximaMeta - ciclo) * 10) / 10;
        const porcentaje = Math.min(100, Math.max(0, Math.round(((ciclo - base) / 500) * 100)));

        return {
            tag: `Próx. ${proximaMeta}h (en ${faltan} hrs)`,
            color: '#15803d',
            bar: '#16a34a',
            porcentaje,
            esAlerta: false
        };
    };

    const verificarLicencia = (fechaVenc) => {
        if (!fechaVenc) return { estado: 'SIN FECHA', color: '#64748b', bg: '#f1f5f9' };
        const hoy = new Date();
        const venc = new Date(fechaVenc);
        const diffDias = Math.ceil((venc - hoy) / (1000 * 60 * 60 * 24));

        if (diffDias < 0) {
            return { estado: 'LICENCIA VENCIDA', color: '#991b1b', bg: '#fee2e2' };
        }
        if (diffDias <= 30) {
            return { estado: `POR VENCER (${diffDias} DÍAS)`, color: '#b45309', bg: '#fef3c7' };
        }
        return { estado: 'AL DÍA', color: '#15803d', bg: '#dcfce7' };
    };

    const renderBadgeEstado = (estadoRaw) => {
        const est = (estadoRaw || 'OPERATIVA').trim().toUpperCase();
        let bg = '#dcfce7';
        let color = '#15803d';

        if (est.includes('MANT') || est.includes('REQUIERE') || est.includes('TALLER')) {
            bg = '#fee2e2';
            color = '#b91c1c';
        }

        const textoMostrar = est.includes('MANT') ? 'REQUIERE MANTENCIÓN' : est;

        return (
            <span style={{
                display: 'inline-block',
                padding: '2px 8px',
                borderRadius: '3px',
                fontSize: '10px',
                fontWeight: '700',
                backgroundColor: bg,
                color: color,
                letterSpacing: '0.02em',
                textTransform: 'uppercase'
            }}>
                {textoMostrar}
            </span>
        );
    };

    const total = maquinarias.length;
    const operativas = maquinarias.filter((m) => {
        const st = (m.estado || '').toLowerCase();
        return st.includes('operativa') || st.includes('disponible');
    }).length;

    const requierenMantencion = maquinarias.filter((m) => {
        const st = (m.estado || '').toLowerCase();
        return st.includes('mant') || st.includes('taller') || st.includes('requiere');
    }).length;

    const alertas = maquinarias.filter((m) => {
        const mant = calcularMantencion(m.horometro_actual);
        return mant.esAlerta;
    }).length;

    const licenciasPorVencer = operadores.filter((op) => {
        const check = verificarLicencia(op.fecha_vencimiento_licencia);
        return check.estado !== 'AL DÍA';
    }).length;

    const totalGastosMonto = gastos.reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0);

    const filtradas = maquinarias.filter((m) => {
        const texto = `${m.patente} ${m.tipo} ${m.marca} ${m.modelo}`.toLowerCase();
        const coincideTexto = texto.includes(busqueda.toLowerCase());
        if (filtroEstado === 'TODOS') return coincideTexto;
        const estadoNorm = (m.estado || 'OPERATIVA').toUpperCase();
        return coincideTexto && estadoNorm.includes(filtroEstado.toUpperCase());
    });

    const estiloTab = (activa) => ({
        padding: '9px 16px',
        backgroundColor: activa ? '#ffffff' : '#e2e8f0',
        color: activa ? '#0f172a' : '#475569',
        fontWeight: '700',
        fontSize: '11px',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        border: 'none',
        borderBottom: activa ? '2px solid #d97706' : '2px solid transparent',
        cursor: 'pointer'
    });

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#e2e8f0',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            padding: '28px 16px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            boxSizing: 'border-box'
        }}>
            <div style={{
                width: '100%',
                maxWidth: '1060px',
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
                                ADMINISTRACIÓN GENERAL
                            </span>
                            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', letterSpacing: '0.04em' }}>
                                MULTIMAK 360
                            </span>
                        </div>
                        <h1 style={{ fontSize: '17px', fontWeight: '700', margin: 0, color: '#f8fafc' }}>
                            Panel de Supervisión y Control Operacional
                        </h1>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {/* Menú Desplegable de Nuevo Registro */}
                        <div ref={dropdownRef} style={{ position: 'relative' }}>
                            <button
                                type="button"
                                onClick={() => setMenuAccionesAbierto(!menuAccionesAbierto)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '7px',
                                    padding: '7px 14px',
                                    backgroundColor: '#d97706',
                                    color: '#ffffff',
                                    border: 'none',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: '700',
                                    letterSpacing: '0.02em',
                                    cursor: 'pointer',
                                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                }}
                            >
                                <span>+ Nuevo Registro</span>
                                <span style={{ fontSize: '9px', transform: menuAccionesAbierto ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                                    ▼
                                </span>
                            </button>

                            {/* Dropdown flotante */}
                            {menuAccionesAbierto && (
                                <div style={{
                                    position: 'absolute',
                                    right: 0,
                                    top: '100%',
                                    marginTop: '6px',
                                    backgroundColor: '#ffffff',
                                    borderRadius: '6px',
                                    boxShadow: '0 8px 20px rgba(15, 23, 42, 0.15)',
                                    border: '1px solid #cbd5e1',
                                    width: '190px',
                                    overflow: 'hidden',
                                    zIndex: 50,
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setModalNuevaMaquina(true);
                                            setMenuAccionesAbierto(false);
                                        }}
                                        style={{
                                            padding: '10px 14px',
                                            backgroundColor: 'transparent',
                                            border: 'none',
                                            textAlign: 'left',
                                            fontSize: '12px',
                                            fontWeight: '600',
                                            color: '#0f172a',
                                            cursor: 'pointer',
                                            borderBottom: '1px solid #f1f5f9',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}
                                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f8fafc'}
                                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                                    >
                                        <span></span>
                                        <span>Nueva Maquinaria</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setModalNuevoOperador(true);
                                            setMenuAccionesAbierto(false);
                                        }}
                                        style={{
                                            padding: '10px 14px',
                                            backgroundColor: 'transparent',
                                            border: 'none',
                                            textAlign: 'left',
                                            fontSize: '12px',
                                            fontWeight: '600',
                                            color: '#0f172a',
                                            cursor: 'pointer',
                                            borderBottom: '1px solid #f1f5f9',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}
                                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f8fafc'}
                                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                                    >
                                        <span></span>
                                        <span>Nuevo Operador</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setModalNuevoGasto(true);
                                            setMenuAccionesAbierto(false);
                                        }}
                                        style={{
                                            padding: '10px 14px',
                                            backgroundColor: 'transparent',
                                            border: 'none',
                                            textAlign: 'left',
                                            fontSize: '12px',
                                            fontWeight: '600',
                                            color: '#0f172a',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px'
                                        }}
                                        onMouseEnter={(e) => e.target.style.backgroundColor = '#f8fafc'}
                                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                                    >
                                        <span></span>
                                        <span>Registrar Gasto</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Botón Sincronizar discreto */}
                        <button
                            type="button"
                            onClick={cargarDatos}
                            style={{
                                padding: '7px 12px',
                                backgroundColor: '#1e293b',
                                color: '#94a3b8',
                                border: '1px solid #334155',
                                borderRadius: '4px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                fontWeight: '600'
                            }}
                        >
                            Sincronizar
                        </button>
                    </div>
                </div>

                {/* Navegación por pestañas */}
                <div style={{
                    backgroundColor: '#f1f5f9',
                    borderBottom: '1px solid #cbd5e1',
                    display: 'flex',
                    padding: '0 12px',
                    gap: '4px'
                }}>
                    <button onClick={() => setTabActiva('dashboard')} style={estiloTab(tabActiva === 'dashboard')}>
                        Dashboard / Semáforo
                    </button>
                    <button onClick={() => setTabActiva('maquinarias')} style={estiloTab(tabActiva === 'maquinarias')}>
                        Equipos ({total})
                    </button>
                    <button onClick={() => setTabActiva('operadores')} style={estiloTab(tabActiva === 'operadores')}>
                        Operadores ({operadores.length})
                    </button>
                    <button onClick={() => setTabActiva('reportes')} style={estiloTab(tabActiva === 'reportes')}>
                        Turnos Recibidos ({reportes.length})
                    </button>
                    <button onClick={() => setTabActiva('gastos')} style={estiloTab(tabActiva === 'gastos')}>
                        Gastos Operativos (${totalGastosMonto.toLocaleString('es-CL')})
                    </button>
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

                <div style={{ padding: '20px 22px' }}>
                    {/* TAB 1: DASHBOARD / KPIS / SEMÁFORO */}
                    {tabActiva === 'dashboard' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Tarjetas KPI */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                                {[
                                    { label: 'Flota Total', val: total, color: '#f8fafc', sub: 'Inventario registrado' },
                                    { label: 'Operativas', val: operativas, color: '#4ade80', sub: 'En faena o listas' },
                                    { label: 'Requiere Mant.', val: requierenMantencion, color: '#f87171', sub: 'Pendientes de taller' },
                                    { label: 'Alertas Pauta', val: alertas, color: '#fbbf24', sub: 'Ventana 450h / 950h' }
                                ].map((k, i) => (
                                    <div key={i} style={{
                                        backgroundColor: '#0f172a',
                                        border: '1px solid #1e293b',
                                        borderRadius: '4px',
                                        padding: '10px 14px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                            <span style={{ fontSize: '10px', fontWeight: '800', color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                {k.label}
                                            </span>
                                            <span style={{ fontSize: '18px', fontWeight: '800', color: k.color, fontFamily: 'Consolas, monospace' }}>
                                                {k.val}
                                            </span>
                                        </div>
                                        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '500', marginTop: '4px' }}>
                                            {k.sub}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Alerta de Licencias de Conducir (BPMN 1.3.1.4) */}
                            {licenciasPorVencer > 0 && (
                                <div style={{
                                    backgroundColor: '#fffbeb',
                                    border: '1px solid #fde68a',
                                    borderRadius: '4px',
                                    padding: '10px 14px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '16px' }}>⚠️</span>
                                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#92400e' }}>
                                            Hay {licenciasPorVencer} operador(es) con licencia por vencer o vencida. Revisa la pestaña de Operadores.
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setTabActiva('operadores')}
                                        style={{
                                            backgroundColor: '#d97706',
                                            color: '#ffffff',
                                            border: 'none',
                                            padding: '4px 10px',
                                            borderRadius: '3px',
                                            fontSize: '11px',
                                            fontWeight: '700',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Revisar
                                    </button>
                                </div>
                            )}

                            {/* Barra de Filtros */}
                            <div style={{
                                backgroundColor: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                borderRadius: '4px',
                                padding: '9px 12px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: '12px'
                            }}>
                                <input
                                    type="text"
                                    placeholder="Filtrar por patente, equipo o modelo..."
                                    value={busqueda}
                                    onChange={(e) => setBusqueda(e.target.value)}
                                    style={{
                                        flex: 1,
                                        maxWidth: '320px',
                                        padding: '6px 10px',
                                        backgroundColor: '#ffffff',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        outline: 'none'
                                    }}
                                />
                                <select
                                    value={filtroEstado}
                                    onChange={(e) => setFiltroEstado(e.target.value)}
                                    style={{
                                        padding: '6px 10px',
                                        backgroundColor: '#ffffff',
                                        border: '1px solid #cbd5e1',
                                        borderRadius: '4px',
                                        fontSize: '12px',
                                        fontWeight: '600'
                                    }}
                                >
                                    <option value="TODOS">Todos los estados</option>
                                    <option value="OPERATIVA">Operativas / Disponibles</option>
                                    <option value="MANTENCIÓN">Requiere Mantención</option>
                                </select>
                            </div>

                            {/* Tabla Semáforo */}
                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#0f172a', color: '#ffffff', textAlign: 'left', fontSize: '10px', textTransform: 'uppercase' }}>
                                            <th style={{ padding: '8px 10px', width: '90px' }}>Patente</th>
                                            <th style={{ padding: '8px 10px' }}>Maquinaria</th>
                                            <th style={{ padding: '8px 10px', width: '110px' }}>Horómetro</th>
                                            <th style={{ padding: '8px 10px', width: '250px' }}>Semáforo Preventivo</th>
                                            <th style={{ padding: '8px 10px', width: '150px', textAlign: 'center' }}>Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {cargando ? (
                                            <tr><td colSpan="5" style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>Cargando registros...</td></tr>
                                        ) : filtradas.length === 0 ? (
                                            <tr><td colSpan="5" style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>No hay maquinarias registradas.</td></tr>
                                        ) : (
                                            filtradas.map((m) => {
                                                const mant = calcularMantencion(m.horometro_actual);
                                                return (
                                                    <tr key={m.id_maquina} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                        <td style={{ padding: '8px 10px', fontWeight: '700', fontFamily: 'Consolas, monospace' }}>{m.patente}</td>
                                                        <td style={{ padding: '8px 10px' }}>
                                                            <span style={{ fontWeight: '600', color: '#0f172a' }}>{m.tipo}</span>
                                                            <span style={{ color: '#64748b', marginLeft: '6px', fontSize: '11px' }}>{m.marca} {m.modelo}</span>
                                                        </td>
                                                        <td style={{ padding: '8px 10px', fontFamily: 'Consolas, monospace', fontWeight: '700' }}>
                                                            {parseFloat(m.horometro_actual || 0).toFixed(1)} hrs
                                                        </td>
                                                        <td style={{ padding: '8px 10px' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '2px' }}>
                                                                <span style={{ fontWeight: '700', color: mant.color }}>{mant.tag}</span>
                                                                <span style={{ color: '#64748b' }}>{mant.porcentaje}%</span>
                                                            </div>
                                                            <div style={{ width: '100%', height: '4px', backgroundColor: '#e2e8f0', borderRadius: '2px', overflow: 'hidden' }}>
                                                                <div style={{ width: `${mant.porcentaje}%`, height: '100%', backgroundColor: mant.bar }} />
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                                            {renderBadgeEstado(m.estado)}
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

                    {/* TAB 2: INVENTARIO DE EQUIPOS */}
                    {tabActiva === 'maquinarias' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>Catálogo Oficial de Equipos</span>
                                <span style={{ fontSize: '11px', color: '#64748b' }}>Total registrados: {maquinarias.length}</span>
                            </div>

                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#0f172a', color: '#ffffff', textAlign: 'left', fontSize: '10px', textTransform: 'uppercase' }}>
                                            <th style={{ padding: '8px 10px', width: '50px' }}>ID</th>
                                            <th style={{ padding: '8px 10px', width: '100px' }}>Patente</th>
                                            <th style={{ padding: '8px 10px' }}>Tipo</th>
                                            <th style={{ padding: '8px 10px' }}>Marca y Modelo</th>
                                            <th style={{ padding: '8px 10px', width: '120px' }}>Horómetro Actual</th>
                                            <th style={{ padding: '8px 10px', width: '160px', textAlign: 'center' }}>Condición Operativa</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {maquinarias.map((m) => (
                                            <tr key={m.id_maquina} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '8px 10px', color: '#64748b' }}>#{m.id_maquina}</td>
                                                <td style={{ padding: '8px 10px', fontWeight: '700', fontFamily: 'Consolas, monospace' }}>{m.patente}</td>
                                                <td style={{ padding: '8px 10px', fontWeight: '600' }}>{m.tipo}</td>
                                                <td style={{ padding: '8px 10px' }}>{m.marca} {m.modelo}</td>
                                                <td style={{ padding: '8px 10px', fontFamily: 'Consolas, monospace', fontWeight: '700' }}>
                                                    {parseFloat(m.horometro_actual || 0).toFixed(1)} hrs
                                                </td>
                                                <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                                    <select
                                                        value={(m.estado || 'OPERATIVA').toUpperCase().includes('MANT') ? 'REQUIERE MANTENCIÓN' : 'OPERATIVA'}
                                                        onChange={(e) => cambiarEstadoRapido(m.id_maquina, e.target.value)}
                                                        style={{
                                                            padding: '3px 6px',
                                                            borderRadius: '3px',
                                                            fontSize: '11px',
                                                            fontWeight: '700',
                                                            border: '1px solid #cbd5e1',
                                                            backgroundColor: (m.estado || '').toUpperCase().includes('MANT') ? '#fee2e2' : '#dcfce7',
                                                            color: (m.estado || '').toUpperCase().includes('MANT') ? '#b91c1c' : '#15803d',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        <option value="OPERATIVA">OPERATIVA</option>
                                                        <option value="REQUIERE MANTENCIÓN">REQUIERE MANTENCIÓN</option>
                                                    </select>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* TAB 3: OPERADORES Y LICENCIAS (BPMN 1.3.1.4) */}
                    {tabActiva === 'operadores' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>Padrón de Operadores y Licencias de Conducir</span>
                                <span style={{ fontSize: '11px', color: '#64748b' }}>Registrados: {operadores.length}</span>
                            </div>

                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#0f172a', color: '#ffffff', textAlign: 'left', fontSize: '10px', textTransform: 'uppercase' }}>
                                            <th style={{ padding: '8px 10px' }}>Nombre y Apellido</th>
                                            <th style={{ padding: '8px 10px', width: '120px' }}>RUT</th>
                                            <th style={{ padding: '8px 10px', width: '110px' }}>Clase Licencia</th>
                                            <th style={{ padding: '8px 10px', width: '130px' }}>Vencimiento</th>
                                            <th style={{ padding: '8px 10px', width: '160px', textAlign: 'center' }}>Vigencia para Faena</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {operadores.length === 0 ? (
                                            <tr><td colSpan="5" style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>No hay operadores registrados aún.</td></tr>
                                        ) : (
                                            operadores.map((op) => {
                                                const lic = verificarLicencia(op.fecha_vencimiento_licencia);
                                                return (
                                                    <tr key={op.id_operador} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                        <td style={{ padding: '8px 10px', fontWeight: '600', color: '#0f172a' }}>
                                                            {op.nombre} {op.apellido}
                                                        </td>
                                                        <td style={{ padding: '8px 10px', fontFamily: 'Consolas, monospace' }}>{op.rut || '—'}</td>
                                                        <td style={{ padding: '8px 10px', fontWeight: '600' }}>{op.TipoLicencia || 'Clase D'}</td>
                                                        <td style={{ padding: '8px 10px' }}>{op.fecha_vencimiento_licencia || 'No asignada'}</td>
                                                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                                            <span style={{
                                                                display: 'inline-block',
                                                                padding: '2px 8px',
                                                                borderRadius: '3px',
                                                                fontSize: '10px',
                                                                fontWeight: '700',
                                                                backgroundColor: lic.bg,
                                                                color: lic.color
                                                            }}>
                                                                {lic.estado}
                                                            </span>
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

                    {/* TAB 4: TURNOS RECIBIDOS (CONCILIACIÓN) */}
                    {tabActiva === 'reportes' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>Libro de Turnos Recibidos desde Terreno</span>
                                <span style={{ fontSize: '11px', color: '#64748b' }}>Total sincronizados: {reportes.length}</span>
                            </div>

                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#0f172a', color: '#ffffff', textAlign: 'left', fontSize: '10px', textTransform: 'uppercase' }}>
                                            <th style={{ padding: '8px 10px', width: '90px' }}>Fecha</th>
                                            <th style={{ padding: '8px 10px' }}>Equipo / Patente</th>
                                            <th style={{ padding: '8px 10px' }}>Turno</th>
                                            <th style={{ padding: '8px 10px' }}>Horómetros (Ini → Fin)</th>
                                            <th style={{ padding: '8px 10px' }}>Horas Trabajadas</th>
                                            <th style={{ padding: '8px 10px' }}>Combustible</th>
                                            <th style={{ padding: '8px 10px', textAlign: 'center' }}>V°B° Terreno</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportes.length === 0 ? (
                                            <tr><td colSpan="7" style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>No se han sincronizado reportes todavía.</td></tr>
                                        ) : (
                                            reportes.map((r, idx) => {
                                                const maqEncontrada = maquinarias.find((m) => m.id_maquina === r.id_maquina);
                                                return (
                                                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                        <td style={{ padding: '8px 10px', fontWeight: '600' }}>{r.fecha}</td>
                                                        <td style={{ padding: '8px 10px', fontFamily: 'Consolas, monospace' }}>
                                                            {maqEncontrada ? `[${maqEncontrada.patente}] ${maqEncontrada.tipo}` : `Equipo #${r.id_maquina}`}
                                                        </td>
                                                        <td style={{ padding: '8px 10px' }}>{r.hora_entrada} a {r.hora_salida}</td>
                                                        <td style={{ padding: '8px 10px', fontFamily: 'Consolas, monospace' }}>
                                                            {r.horometro_inicial}h → {r.horometro_final}h
                                                        </td>
                                                        <td style={{ padding: '8px 10px', fontWeight: '700', color: '#0f172a' }}>{r.horas_trabajadas} hrs</td>
                                                        <td style={{ padding: '8px 10px', fontFamily: 'Consolas, monospace' }}>
                                                            {r.combustible_litros || r.combustible || 0} L
                                                        </td>
                                                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                                            <span style={{
                                                                display: 'inline-block',
                                                                padding: '2px 6px',
                                                                borderRadius: '3px',
                                                                fontSize: '10px',
                                                                fontWeight: '700',
                                                                backgroundColor: r.firmado ? '#dcfce7' : '#fee2e2',
                                                                color: r.firmado ? '#14532d' : '#991b1b'
                                                            }}>
                                                                {r.firmado ? 'CONFORME' : 'PENDIENTE'}
                                                            </span>
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

                    {/* TAB 5: GASTOS OPERATIVOS (BPMN 1.3.1.6) */}
                    {tabActiva === 'gastos' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>Gastos Operativos e Imputaciones a Maquinaria</span>
                                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>
                                        Total acumulado: ${totalGastosMonto.toLocaleString('es-CL')}
                                    </span>
                                </div>
                                <span style={{ fontSize: '11px', color: '#64748b' }}>Registros: {gastos.length}</span>
                            </div>

                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#0f172a', color: '#ffffff', textAlign: 'left', fontSize: '10px', textTransform: 'uppercase' }}>
                                            <th style={{ padding: '8px 10px', width: '90px' }}>Fecha</th>
                                            <th style={{ padding: '8px 10px' }}>Maquinaria Imputada</th>
                                            <th style={{ padding: '8px 10px' }}>Concepto / Tipo</th>
                                            <th style={{ padding: '8px 10px', textAlign: 'right', width: '130px' }}>Monto ($)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {gastos.length === 0 ? (
                                            <tr><td colSpan="4" style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>No hay gastos operativos registrados aún.</td></tr>
                                        ) : (
                                            gastos.map((g, idx) => {
                                                const maq = maquinarias.find((m) => m.id_maquina === g.id_maquina);
                                                return (
                                                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                        <td style={{ padding: '8px 10px', fontWeight: '600' }}>{g.fecha}</td>
                                                        <td style={{ padding: '8px 10px', fontFamily: 'Consolas, monospace' }}>
                                                            {maq ? `[${maq.patente}] ${maq.tipo}` : 'Gasto General'}
                                                        </td>
                                                        <td style={{ padding: '8px 10px' }}>{g.tipoGasto || 'Insumo'}</td>
                                                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700', fontFamily: 'Consolas, monospace' }}>
                                                            ${(parseFloat(g.monto) || 0).toLocaleString('es-CL')}
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
                </div>

                {/* MODAL 1: REGISTRAR MAQUINARIA */}
                {modalNuevaMaquina && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex',
                        justifyContent: 'center', alignItems: 'center', zIndex: 9999
                    }}>
                        <div style={{ backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid #cbd5e1', width: '100%', maxWidth: '440px', padding: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                            <h2 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 14px 0', color: '#0f172a' }}>Registrar Nueva Maquinaria</h2>
                            <form onSubmit={crearMaquinaria} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Patente / Código</label>
                                    <input type="text" required value={formMaquina.patente} onChange={(e) => setFormMaquina({ ...formMaquina, patente: e.target.value.toUpperCase() })} placeholder="Ej: EX-104" style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Tipo de Equipo</label>
                                        <input type="text" required value={formMaquina.tipo} onChange={(e) => setFormMaquina({ ...formMaquina, tipo: e.target.value })} placeholder="Excavadora..." style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Marca</label>
                                        <input type="text" required value={formMaquina.marca} onChange={(e) => setFormMaquina({ ...formMaquina, marca: e.target.value })} placeholder="Caterpillar..." style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }} />
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Modelo</label>
                                        <input type="text" required value={formMaquina.modelo} onChange={(e) => setFormMaquina({ ...formMaquina, modelo: e.target.value })} placeholder="320D" style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Horómetro Base</label>
                                        <input type="number" step="0.1" required value={formMaquina.horometro_actual} onChange={(e) => setFormMaquina({ ...formMaquina, horometro_actual: e.target.value })} style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }} />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                                    <button type="button" onClick={() => setModalNuevaMaquina(false)} style={{ padding: '6px 12px', backgroundColor: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}>Cancelar</button>
                                    <button type="submit" style={{ padding: '6px 14px', backgroundColor: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}>Guardar Equipo</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* MODAL 2: REGISTRAR OPERADOR Y LICENCIA */}
                {modalNuevoOperador && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex',
                        justifyContent: 'center', alignItems: 'center', zIndex: 9999
                    }}>
                        <div style={{ backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid #cbd5e1', width: '100%', maxWidth: '400px', padding: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                            <h2 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 14px 0', color: '#0f172a' }}>Registrar Operador</h2>
                            <form onSubmit={crearOperador} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Nombre</label>
                                        <input type="text" required value={formOperador.nombre} onChange={(e) => setFormOperador({ ...formOperador, nombre: e.target.value })} style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }} />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Apellido</label>
                                        <input type="text" required value={formOperador.apellido} onChange={(e) => setFormOperador({ ...formOperador, apellido: e.target.value })} style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }} />
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>RUT</label>
                                    <input type="text" required value={formOperador.rut} onChange={(e) => setFormOperador({ ...formOperador, rut: e.target.value })} placeholder="12.345.678-9" style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }} />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Tipo Licencia</label>
                                        <select value={formOperador.TipoLicencia} onChange={(e) => setFormOperador({ ...formOperador, TipoLicencia: e.target.value })} style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}>
                                            <option value="Clase D">Clase D (Maquinaria)</option>
                                            <option value="Clase A4">Clase A4 (Cargas)</option>
                                            <option value="Clase B">Clase B</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Vencimiento Licencia</label>
                                        <input type="date" required value={formOperador.fecha_vencimiento_licencia} onChange={(e) => setFormOperador({ ...formOperador, fecha_vencimiento_licencia: e.target.value })} style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }} />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                                    <button type="button" onClick={() => setModalNuevoOperador(false)} style={{ padding: '6px 12px', backgroundColor: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}>Cancelar</button>
                                    <button type="submit" style={{ padding: '6px 14px', backgroundColor: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}>Guardar Operador</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* MODAL 3: REGISTRAR GASTO OPERATIVO */}
                {modalNuevoGasto && (
                    <div style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(15, 23, 42, 0.6)', display: 'flex',
                        justifyContent: 'center', alignItems: 'center', zIndex: 9999
                    }}>
                        <div style={{ backgroundColor: '#ffffff', borderRadius: '6px', border: '1px solid #cbd5e1', width: '100%', maxWidth: '400px', padding: '20px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
                            <h2 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 14px 0', color: '#0f172a' }}>Registrar Gasto Operativo</h2>
                            <form onSubmit={crearGasto} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Maquinaria Asociada</label>
                                    <select value={formGasto.id_maquina} onChange={(e) => setFormGasto({ ...formGasto, id_maquina: e.target.value })} style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}>
                                        <option value="">Gasto General / No imputado</option>
                                        {maquinarias.map((m) => (
                                            <option key={m.id_maquina} value={m.id_maquina}>[{m.patente}] {m.tipo}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Concepto</label>
                                        <select value={formGasto.tipoGasto} onChange={(e) => setFormGasto({ ...formGasto, tipoGasto: e.target.value })} style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}>
                                            <option value="Repuesto">Repuesto</option>
                                            <option value="Lubricante / Filtro">Lubricante / Filtro</option>
                                            <option value="Taller Externo">Taller Externo</option>
                                            <option value="Combustible">Combustible</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Monto ($CLP)</label>
                                        <input type="number" required value={formGasto.monto} onChange={(e) => setFormGasto({ ...formGasto, monto: e.target.value })} placeholder="Ej: 85000" style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }} />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                                    <button type="button" onClick={() => setModalNuevoGasto(false)} style={{ padding: '6px 12px', backgroundColor: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}>Cancelar</button>
                                    <button type="submit" style={{ padding: '6px 14px', backgroundColor: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}>Guardar Gasto</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}