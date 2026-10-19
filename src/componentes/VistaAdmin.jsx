import React, { useState, useEffect } from 'react';
import axios from '../api/axios';

export default function VistaAdmin() {
    const [tabActiva, setTabActiva] = useState('dashboard');
    const [maquinarias, setMaquinarias] = useState([]);
    const [reportes, setReportes] = useState([]);
    const [busqueda, setBusqueda] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('TODOS');
    const [cargando, setCargando] = useState(true);
    const [modalNuevaMaquina, setModalNuevaMaquina] = useState(false);
    const [mensaje, setMensaje] = useState({ tipo: '', texto: '' });

    const [formMaquina, setFormMaquina] = useState({
        patente: '',
        tipo: 'Excavadora',
        marca: '',
        modelo: '',
        horometro_actual: 0,
        estado: 'OPERATIVA'
    });

    useEffect(() => {
        cargarDatos();
    }, []);

    const cargarDatos = async () => {
        setCargando(true);
        setMensaje({ tipo: '', texto: '' });

        try {
            const resMaq = await axios.get('/api/maquinarias/');
            setMaquinarias(resMaq.data || []);

            try {
                const resRep = await axios.get('/api/reports/');
                setReportes(resRep.data || []);
            } catch (errRep) {
                setReportes([]);
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
            setFormMaquina({
                patente: '',
                tipo: 'Excavadora',
                marca: '',
                modelo: '',
                horometro_actual: 0,
                estado: 'OPERATIVA'
            });
            cargarDatos();
        } catch (err) {
            setMensaje({ tipo: 'error', texto: 'Error al registrar la maquinaria en la base de datos.' });
        }
    };

    const calcularMantencion = (horometro) => {
        const h = parseFloat(horometro) || 0;
        const ciclo = h % 1000;
        const meta = ciclo > 500 ? 1000 : 500;
        const base = ciclo > 500 ? 500 : 0;
        const faltan = Math.max(0, Math.round(meta - ciclo));
        const porcentaje = Math.min(Math.round(((ciclo - base) / (meta - base)) * 100), 100);

        if (ciclo >= 950 && ciclo < 1000) {
            return { tag: `Aviso 950h (-${faltan}h)`, color: '#b91c1c', bar: '#dc2626', porcentaje };
        }
        if (ciclo >= 450 && ciclo < 500) {
            return { tag: `Aviso 450h (-${faltan}h)`, color: '#b45309', bar: '#d97706', porcentaje };
        }
        if (ciclo >= 500 && ciclo < 550) {
            return { tag: 'Requiere Mantención', color: '#991b1b', bar: '#dc2626', porcentaje: 100 };
        }
        return { tag: `Próx. ${meta}h`, color: '#15803d', bar: '#16a34a', porcentaje };
    };

    const total = maquinarias.length;
    const operativas = maquinarias.filter((m) => m.estado?.toLowerCase() === 'operativa' || m.estado?.toLowerCase() === 'disponible').length;
    const taller = maquinarias.filter((m) => m.estado?.toLowerCase().includes('mant') || m.estado?.toLowerCase().includes('taller')).length;
    const alertas = maquinarias.filter((m) => {
        const c = (parseFloat(m.horometro_actual) || 0) % 1000;
        return (c >= 450 && c < 500) || (c >= 950 && c < 1000) || (c >= 500 && c < 550);
    }).length;

    const filtradas = maquinarias.filter((m) => {
        const texto = `${m.patente} ${m.tipo} ${m.marca} ${m.modelo}`.toLowerCase();
        const coincideTexto = texto.includes(busqueda.toLowerCase());
        if (filtroEstado === 'TODOS') return coincideTexto;
        return coincideTexto && m.estado?.toUpperCase() === filtroEstado.toUpperCase();
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
                                ADMINISTRACIÓN
                            </span>
                            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', letterSpacing: '0.04em' }}>
                                MULTIMAK 360
                            </span>
                        </div>
                        <h1 style={{ fontSize: '17px', fontWeight: '700', margin: 0, color: '#f8fafc' }}>
                            Panel de Supervisión y Control Operacional
                        </h1>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={() => setModalNuevaMaquina(true)}
                            style={{
                                padding: '6px 12px',
                                backgroundColor: '#d97706',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '700',
                                letterSpacing: '0.02em',
                                cursor: 'pointer'
                            }}
                        >
                            + Nueva Maquinaria
                        </button>
                        <button
                            onClick={cargarDatos}
                            style={{
                                padding: '6px 12px',
                                backgroundColor: '#1e293b',
                                color: '#f8fafc',
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
                        Inventario de Equipos ({total})
                    </button>
                    <button onClick={() => setTabActiva('reportes')} style={estiloTab(tabActiva === 'reportes')}>
                        Reportes de Turno ({reportes.length})
                    </button>
                </div>

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
                    {tabActiva === 'dashboard' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                                {[
                                    { label: 'Flota Total', val: total, color: '#f8fafc', sub: 'Inventario registrado' },
                                    { label: 'Disponibles', val: operativas, color: '#4ade80', sub: 'Listas para faena' },
                                    { label: 'En Taller', val: taller, color: '#f87171', sub: 'Mantención / Taller' },
                                    { label: 'Alertas Pauta', val: alertas, color: '#fbbf24', sub: 'Próximas a 500/1000h' }
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
                                        <span style={{ fontSize: '11px', color: '#e2e8f0', fontWeight: '500', marginTop: '4px' }}>
                                            {k.sub}
                                        </span>
                                    </div>
                                ))}
                            </div>

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
                                    <option value="OPERATIVA">Operativas</option>
                                    <option value="EN MANTENCIÓN">En Mantención</option>
                                </select>
                            </div>

                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#0f172a', color: '#ffffff', textAlign: 'left', fontSize: '10px', textTransform: 'uppercase' }}>
                                            <th style={{ padding: '8px 10px', width: '100px' }}>Patente</th>
                                            <th style={{ padding: '8px 10px' }}>Maquinaria</th>
                                            <th style={{ padding: '8px 10px', width: '120px' }}>Horómetro</th>
                                            <th style={{ padding: '8px 10px', width: '220px' }}>Semáforo Preventivo</th>
                                            <th style={{ padding: '8px 10px', width: '100px', textAlign: 'center' }}>Estado</th>
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
                                                        <td style={{ padding: '8px 10px', fontFamily: 'Consolas, monospace', fontWeight: '700' }}>{m.horometro_actual} hrs</td>
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
                                                            <span style={{
                                                                display: 'inline-block',
                                                                padding: '2px 6px',
                                                                borderRadius: '3px',
                                                                fontSize: '10px',
                                                                fontWeight: '700',
                                                                backgroundColor: m.estado?.toLowerCase() === 'operativa' ? '#dcfce7' : '#fee2e2',
                                                                color: m.estado?.toLowerCase() === 'operativa' ? '#14532d' : '#991b1b',
                                                                textTransform: 'uppercase'
                                                            }}>
                                                                {m.estado}
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
                                            <th style={{ padding: '8px 10px' }}>ID</th>
                                            <th style={{ padding: '8px 10px' }}>Patente</th>
                                            <th style={{ padding: '8px 10px' }}>Tipo</th>
                                            <th style={{ padding: '8px 10px' }}>Marca y Modelo</th>
                                            <th style={{ padding: '8px 10px' }}>Horómetro Actual</th>
                                            <th style={{ padding: '8px 10px', textAlign: 'center' }}>Estado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {maquinarias.map((m) => (
                                            <tr key={m.id_maquina} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                <td style={{ padding: '8px 10px', color: '#64748b' }}>#{m.id_maquina}</td>
                                                <td style={{ padding: '8px 10px', fontWeight: '700', fontFamily: 'Consolas, monospace' }}>{m.patente}</td>
                                                <td style={{ padding: '8px 10px', fontWeight: '600' }}>{m.tipo}</td>
                                                <td style={{ padding: '8px 10px' }}>{m.marca} {m.modelo}</td>
                                                <td style={{ padding: '8px 10px', fontFamily: 'Consolas, monospace', fontWeight: '700' }}>{m.horometro_actual} hrs</td>
                                                <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                                    <span style={{
                                                        display: 'inline-block',
                                                        padding: '2px 6px',
                                                        borderRadius: '3px',
                                                        fontSize: '10px',
                                                        fontWeight: '700',
                                                        backgroundColor: m.estado?.toLowerCase() === 'operativa' ? '#dcfce7' : '#fee2e2',
                                                        color: m.estado?.toLowerCase() === 'operativa' ? '#14532d' : '#991b1b',
                                                        textTransform: 'uppercase'
                                                    }}>
                                                        {m.estado}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {tabActiva === 'reportes' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>Libro de Turnos Recibidos</span>
                                <span style={{ fontSize: '11px', color: '#64748b' }}>Reportes sincronizados: {reportes.length}</span>
                            </div>

                            <div style={{ border: '1px solid #e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#0f172a', color: '#ffffff', textAlign: 'left', fontSize: '10px', textTransform: 'uppercase' }}>
                                            <th style={{ padding: '8px 10px' }}>Fecha</th>
                                            <th style={{ padding: '8px 10px' }}>Máquina (ID)</th>
                                            <th style={{ padding: '8px 10px' }}>Turno</th>
                                            <th style={{ padding: '8px 10px' }}>Horómetros (Ini - Fin)</th>
                                            <th style={{ padding: '8px 10px' }}>Horas Trabajadas</th>
                                            <th style={{ padding: '8px 10px' }}>Combustible</th>
                                            <th style={{ padding: '8px 10px', textAlign: 'center' }}>Firma</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {reportes.length === 0 ? (
                                            <tr><td colSpan="7" style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>No se han sincronizado reportes todavía.</td></tr>
                                        ) : (
                                            reportes.map((r, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '8px 10px', fontWeight: '600' }}>{r.fecha}</td>
                                                    <td style={{ padding: '8px 10px', fontFamily: 'Consolas, monospace' }}>Equipo #{r.id_maquina}</td>
                                                    <td style={{ padding: '8px 10px' }}>{r.hora_entrada} - {r.hora_salida}</td>
                                                    <td style={{ padding: '8px 10px', fontFamily: 'Consolas, monospace' }}>{r.horometro_inicial}h → {r.horometro_final}h</td>
                                                    <td style={{ padding: '8px 10px', fontWeight: '700', color: '#0f172a' }}>{r.horas_trabajadas} hrs</td>
                                                    <td style={{ padding: '8px 10px', fontFamily: 'Consolas, monospace' }}>{r.combustible || 0} L</td>
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
                                                            {r.firmado ? 'FIRMA OK' : 'PENDIENTE'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {modalNuevaMaquina && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(15, 23, 42, 0.6)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 9999
                    }}>
                        <div style={{
                            backgroundColor: '#ffffff',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            width: '100%',
                            maxWidth: '440px',
                            padding: '20px',
                            boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
                        }}>
                            <h2 style={{ fontSize: '15px', fontWeight: '700', margin: '0 0 14px 0', color: '#0f172a' }}>
                                Registrar Nueva Maquinaria
                            </h2>

                            <form onSubmit={crearMaquinaria} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Patente / Código</label>
                                    <input
                                        type="text"
                                        required
                                        value={formMaquina.patente}
                                        onChange={(e) => setFormMaquina({ ...formMaquina, patente: e.target.value.toUpperCase() })}
                                        placeholder="Ej: EX-104"
                                        style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                                    />
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Tipo de Equipo</label>
                                        <input
                                            type="text"
                                            required
                                            value={formMaquina.tipo}
                                            onChange={(e) => setFormMaquina({ ...formMaquina, tipo: e.target.value })}
                                            placeholder="Excavadora..."
                                            style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Marca</label>
                                        <input
                                            type="text"
                                            required
                                            value={formMaquina.marca}
                                            onChange={(e) => setFormMaquina({ ...formMaquina, marca: e.target.value })}
                                            placeholder="Caterpillar..."
                                            style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Modelo</label>
                                        <input
                                            type="text"
                                            required
                                            value={formMaquina.modelo}
                                            onChange={(e) => setFormMaquina({ ...formMaquina, modelo: e.target.value })}
                                            placeholder="320D"
                                            style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', color: '#475569', textTransform: 'uppercase' }}>Horómetro Base</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            required
                                            value={formMaquina.horometro_actual}
                                            onChange={(e) => setFormMaquina({ ...formMaquina, horometro_actual: e.target.value })}
                                            style={{ width: '100%', padding: '6px 8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setModalNuevaMaquina(false)}
                                        style={{ padding: '6px 12px', backgroundColor: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: '600' }}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        style={{ padding: '6px 14px', backgroundColor: '#0f172a', color: '#ffffff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: '700' }}
                                    >
                                        Guardar Equipo
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}