import React, { useState, useEffect } from 'react';
import axios from '../api/axios';

const normalizarUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
        return url;
    }
    const baseUrl = import.meta.env.VITE_API_URL 
        ? import.meta.env.VITE_API_URL.replace('/api', '')
        : 'https://multimakspa.duckdns.org';
    return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
};

export default function VistaContador({ modoNoche }) {
    const [gastos, setGastos] = useState([]);
    const [reportes, setReportes] = useState([]);
    const [maquinarias, setMaquinarias] = useState([]);
    const [contratos, setContratos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [filtroTipo, setFiltroTipo] = useState('todos');
    const [busqueda, setBusqueda] = useState('');
    const [pestaña, setPestaña] = useState('gastos');

    // Visor modal de comprobantes
    const [modalDoc, setModalDoc] = useState({
        abierto: false,
        url: '',
        titulo: '',
        subtitulo: '',
        folio: '',
        esPdf: false
    });

    const abrirVisor = ({ url, titulo, subtitulo, folio }) => {
        if (!url) return;
        const urlNorm = normalizarUrl(url);
        const esPdf = urlNorm.toLowerCase().includes('.pdf');
        setModalDoc({
            abierto: true,
            url: urlNorm,
            titulo: titulo || 'Comprobante Operativo',
            subtitulo: subtitulo || '',
            folio: folio || '',
            esPdf
        });
    };

    const cerrarVisor = () => {
        setModalDoc(prev => ({ ...prev, abierto: false, url: '' }));
    };

    const cargarDatosFinancieros = async () => {
        setCargando(true);
        try {
            const [resGas, resRep, resMaq, resCont] = await Promise.all([
                axios.get('/gastos/').catch(() => axios.get('/api/gastos/')).catch(() => ({ data: [] })),
                axios.get('/reports/').catch(() => axios.get('/api/reports/')).catch(() => ({ data: [] })),
                axios.get('/maquinarias/').catch(() => axios.get('/api/maquinarias/')).catch(() => ({ data: [] })),
                axios.get('/contratos/').catch(() => axios.get('/api/contratos/')).catch(() => ({ data: [] }))
            ]);
            setGastos(resGas.data?.results || resGas.data || []);
            setReportes(resRep.data?.results || resRep.data || []);
            setMaquinarias(resMaq.data?.results || resMaq.data || []);
            setContratos(resCont.data?.results || resCont.data || []);
        } catch (err) {
            console.error('Error al cargar datos contables:', err);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarDatosFinancieros();
    }, []);

    const obtenerPatente = (idMaquina, detalle) => {
        if (detalle && detalle.patente) return detalle.patente;
        const encontrada = maquinarias.find((m) => m.id_maquina === idMaquina || m.id === idMaquina);
        return encontrada ? `${encontrada.patente} (${encontrada.tipo})` : `Equipo #${idMaquina || 'S/I'}`;
    };

    // Cálculos Contables y Financieros
    const totalGastosAcumulados = gastos.reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0);

    const gastosCombustible = gastos
        .filter((g) => {
            const t = (g.categoria_gasto || g.tipo_gasto || '').toLowerCase();
            return t.includes('combus');
        })
        .reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0);

    const gastosMantenimiento = gastos
        .filter((g) => {
            const t = (g.categoria_gasto || g.tipo_gasto || '').toLowerCase();
            return t.includes('mant') || t.includes('repuesto') || t.includes('taller');
        })
        .reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0);

    const totalHorasFacturables = reportes.reduce((acc, r) => acc + (parseFloat(r.horas_trabajadas) || 0), 0);

    const totalIngresosEstimados = reportes.reduce((acc, r) => {
        const cont = contratos.find(c => c.id_contrato === r.id_contrato || c.id_maquina === r.id_maquina);
        const tarifa = r.contrato_tarifa || r.tarifa_aplicada || cont?.tarifa_hora || 28000;
        const horas = parseFloat(r.horas_trabajadas) || 0;
        return acc + (horas * tarifa);
    }, 0);

    const margenNeto = totalIngresosEstimados - totalGastosAcumulados;
    const margenPct = totalIngresosEstimados > 0 
        ? ((margenNeto / totalIngresosEstimados) * 100).toFixed(1)
        : '0.0';

    const gastosFiltrados = gastos.filter((g) => {
        const tipo = g.categoria_gasto || g.tipo_gasto || 'General';
        const coincideTipo = filtroTipo === 'todos' || tipo.toLowerCase() === filtroTipo.toLowerCase();
        const patenteTexto = obtenerPatente(g.id_maquina, g.id_maquina_detalle);
        const folioTexto = g.numero_comprobante || '';
        const textoCompleto = `${g.descripcion || ''} ${tipo} ${patenteTexto} ${folioTexto}`.toLowerCase();
        return coincideTipo && textoCompleto.includes(busqueda.toLowerCase());
    });

    // Colores dinámicos para modo noche
    const cCardBg = modoNoche ? '#151e2e' : '#ffffff';
    const cCardBorder = modoNoche ? '#283548' : '#e2e8f0';
    const cTextPrimary = modoNoche ? '#f8fafc' : '#0f172a';
    const cTextSecondary = modoNoche ? '#94a3b8' : '#64748b';
    const cThBg = modoNoche ? '#1a2436' : '#f8fafc';
    const cBorderRow = modoNoche ? '#1e293b' : '#f1f5f9';

    return (
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '22px' }}>
            {/* Header del Panel Contable */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
                backgroundColor: modoNoche ? '#111827' : '#0f172a',
                padding: '22px 28px',
                borderRadius: '18px',
                boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.25)',
                border: modoNoche ? '1px solid #1f2937' : '1px solid #1e293b'
            }}>
                <div>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        DEPARTAMENTO DE FINANZAS • MULTIMAK 360
                    </span>
                    <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#ffffff', margin: '4px 0 0', letterSpacing: '-0.02em' }}>
                        Panel Contable y Liquidación de Faena
                    </h1>
                </div>

                <button
                    onClick={cargarDatosFinancieros}
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
                    Sincronizar Balance ⟳
                </button>
            </div>

            {/* Grid de KPIs Financieros y Rentabilidad */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                <div style={{ backgroundColor: cCardBg, padding: '18px 22px', borderRadius: '16px', border: `1px solid ${cCardBorder}`, borderTop: '4px solid #16a34a', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)' }}>
                    <span style={{ fontSize: '10px', fontWeight: '800', color: '#16a34a', textTransform: 'uppercase' }}>Ingresos Brutos Faena</span>
                    <div style={{ fontSize: '24px', fontWeight: '900', color: '#16a34a', fontFamily: 'Consolas, monospace', marginTop: '2px' }}>
                        ${totalIngresosEstimados.toLocaleString('es-CL')}
                    </div>
                    <span style={{ fontSize: '11px', color: cTextSecondary }}>{totalHorasFacturables.toFixed(1)} hrs computadas</span>
                </div>

                <div style={{ backgroundColor: cCardBg, padding: '18px 22px', borderRadius: '16px', border: `1px solid ${cCardBorder}`, borderTop: '4px solid #dc2626', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)' }}>
                    <span style={{ fontSize: '10px', fontWeight: '800', color: '#dc2626', textTransform: 'uppercase' }}>Gasto Total Flota</span>
                    <div style={{ fontSize: '24px', fontWeight: '900', color: '#dc2626', fontFamily: 'Consolas, monospace', marginTop: '2px' }}>
                        ${totalGastosAcumulados.toLocaleString('es-CL')}
                    </div>
                    <span style={{ fontSize: '11px', color: cTextSecondary }}>Egresos respaldados</span>
                </div>

                <div style={{ backgroundColor: cCardBg, padding: '18px 22px', borderRadius: '16px', border: `1px solid ${cCardBorder}`, borderTop: `4px solid ${margenNeto >= 0 ? '#0284c7' : '#dc2626'}`, boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)' }}>
                    <span style={{ fontSize: '10px', fontWeight: '800', color: margenNeto >= 0 ? '#0284c7' : '#dc2626', textTransform: 'uppercase' }}>
                        Margen Operativo Neto
                    </span>
                    <div style={{ fontSize: '24px', fontWeight: '900', color: margenNeto >= 0 ? (modoNoche ? '#38bdf8' : '#0284c7') : '#dc2626', fontFamily: 'Consolas, monospace', marginTop: '2px' }}>
                        {margenNeto < 0 ? '-' : ''}${Math.abs(margenNeto).toLocaleString('es-CL')}
                    </div>
                    <span style={{ fontSize: '11px', color: cTextSecondary }}>Rentabilidad: <strong>{margenPct}%</strong></span>
                </div>

                <div style={{ backgroundColor: cCardBg, padding: '18px 22px', borderRadius: '16px', border: `1px solid ${cCardBorder}`, borderTop: '4px solid #f59e0b', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)' }}>
                    <span style={{ fontSize: '10px', fontWeight: '800', color: '#d97706', textTransform: 'uppercase' }}>Combustible</span>
                    <div style={{ fontSize: '24px', fontWeight: '900', color: '#b45309', fontFamily: 'Consolas, monospace', marginTop: '2px' }}>
                        ${gastosCombustible.toLocaleString('es-CL')}
                    </div>
                    <span style={{ fontSize: '11px', color: cTextSecondary }}>Diesel cargado</span>
                </div>

                <div style={{ backgroundColor: cCardBg, padding: '18px 22px', borderRadius: '16px', border: `1px solid ${cCardBorder}`, borderTop: '4px solid #6366f1', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)' }}>
                    <span style={{ fontSize: '10px', fontWeight: '800', color: '#6366f1', textTransform: 'uppercase' }}>Taller y Repuestos</span>
                    <div style={{ fontSize: '24px', fontWeight: '900', color: '#4f46e5', fontFamily: 'Consolas, monospace', marginTop: '2px' }}>
                        ${gastosMantenimiento.toLocaleString('es-CL')}
                    </div>
                    <span style={{ fontSize: '11px', color: cTextSecondary }}>Mantenciones</span>
                </div>
            </div>

            {/* Pestañas de Navegación */}
            <div style={{ display: 'flex', gap: '8px' }}>
                <button
                    onClick={() => setPestaña('gastos')}
                    style={{
                        backgroundColor: pestaña === 'gastos' ? (modoNoche ? '#334155' : '#0f172a') : cCardBg,
                        color: pestaña === 'gastos' ? '#ffffff' : cTextSecondary,
                        border: `1px solid ${cCardBorder}`,
                        borderRadius: '10px',
                        padding: '10px 20px',
                        fontWeight: '800',
                        fontSize: '12px',
                        cursor: 'pointer'
                    }}
                >
                    Libro de Egresos y Comprobantes ({gastos.length})
                </button>

                <button
                    onClick={() => setPestaña('turnos_facturacion')}
                    style={{
                        backgroundColor: pestaña === 'turnos_facturacion' ? (modoNoche ? '#334155' : '#0f172a') : cCardBg,
                        color: pestaña === 'turnos_facturacion' ? '#ffffff' : cTextSecondary,
                        border: `1px solid ${cCardBorder}`,
                        borderRadius: '10px',
                        padding: '10px 20px',
                        fontWeight: '800',
                        fontSize: '12px',
                        cursor: 'pointer'
                    }}
                >
                    Conciliación de Horas y Facturación ({reportes.length})
                </button>
            </div>

            {/* TAB: LIBRO DE EGRESOS CON DOCUMENTOS S3 */}
            {pestaña === 'gastos' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <input
                            type="text"
                            placeholder="Buscar por descripción, comprobante, tipo o patente..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                            style={{
                                flex: 1,
                                minWidth: '260px',
                                height: '42px',
                                backgroundColor: modoNoche ? '#0f172a' : '#ffffff',
                                border: modoNoche ? '1px solid #334155' : '1px solid #cbd5e1',
                                borderRadius: '10px',
                                padding: '0 16px',
                                fontSize: '13px',
                                color: cTextPrimary,
                                outline: 'none'
                            }}
                        />

                        <select
                            value={filtroTipo}
                            onChange={(e) => setFiltroTipo(e.target.value)}
                            style={{
                                height: '42px',
                                backgroundColor: modoNoche ? '#0f172a' : '#ffffff',
                                border: modoNoche ? '1px solid #334155' : '1px solid #cbd5e1',
                                borderRadius: '10px',
                                padding: '0 16px',
                                fontSize: '13px',
                                color: cTextPrimary,
                                outline: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            <option value="todos">Todos los conceptos</option>
                            <option value="Combustible">Combustible</option>
                            <option value="Repuesto">Repuesto</option>
                            <option value="Mantención">Mantención</option>
                            <option value="Taller">Taller</option>
                            <option value="Viatico">Viático</option>
                        </select>
                    </div>

                    <div style={{ backgroundColor: cCardBg, borderRadius: '16px', border: `1px solid ${cCardBorder}`, padding: '24px', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: cThBg, borderBottom: `2px solid ${cCardBorder}` }}>
                                        <th style={{ padding: '12px 16px', color: cTextSecondary, fontWeight: '800' }}>FECHA</th>
                                        <th style={{ padding: '12px 16px', color: cTextSecondary, fontWeight: '800' }}>CONCEPTO</th>
                                        <th style={{ padding: '12px 16px', color: cTextSecondary, fontWeight: '800' }}>FOLIO / REF</th>
                                        <th style={{ padding: '12px 16px', color: cTextSecondary, fontWeight: '800' }}>RESPALDO S3</th>
                                        <th style={{ padding: '12px 16px', color: cTextSecondary, fontWeight: '800' }}>MÁQUINA ASOCIADA</th>
                                        <th style={{ padding: '12px 16px', color: cTextSecondary, fontWeight: '800', textAlign: 'right' }}>MONTO</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {gastosFiltrados.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: cTextSecondary }}>
                                                No hay egresos registrados que coincidan con la búsqueda.
                                            </td>
                                        </tr>
                                    ) : (
                                        gastosFiltrados.map((g) => {
                                            const concepto = g.categoria_gasto || g.tipo_gasto || 'Gasto General';
                                            const esCombustible = concepto.toLowerCase().includes('combus');
                                            const urlDoc = g.comprobante_url || g.url_comprobante || g.archivo_comprobante;

                                            return (
                                                <tr key={g.id_gasto} style={{ borderBottom: `1px solid ${cBorderRow}` }}>
                                                    <td style={{ padding: '14px 16px', color: cTextSecondary, fontFamily: 'Consolas, monospace' }}>
                                                        {g.fecha}
                                                    </td>
                                                    <td style={{ padding: '14px 16px' }}>
                                                        <span style={{
                                                            padding: '4px 10px',
                                                            borderRadius: '6px',
                                                            fontSize: '11px',
                                                            fontWeight: '800',
                                                            backgroundColor: esCombustible ? '#fef3c7' : (modoNoche ? '#1e293b' : '#e0e7ff'),
                                                            color: esCombustible ? '#92400e' : (modoNoche ? '#a5b4fc' : '#3730a3')
                                                        }}>
                                                            {concepto}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '14px 16px', fontFamily: 'Consolas, monospace', fontWeight: '700', color: cTextPrimary }}>
                                                        {g.numero_comprobante || 'S/N'}
                                                    </td>
                                                    <td style={{ padding: '14px 16px' }}>
                                                        {urlDoc ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => abrirVisor({
                                                                    url: urlDoc,
                                                                    titulo: `Comprobante ${concepto} - Folio ${g.numero_comprobante || 'S/N'}`,
                                                                    subtitulo: `Monto: $${parseFloat(g.monto || 0).toLocaleString('es-CL')} • Fecha: ${g.fecha}`,
                                                                    folio: g.numero_comprobante || 'S/N'
                                                                })}
                                                                style={{
                                                                    display: 'inline-flex',
                                                                    alignItems: 'center',
                                                                    gap: '5px',
                                                                    padding: '4px 10px',
                                                                    borderRadius: '6px',
                                                                    fontSize: '11px',
                                                                    fontWeight: '700',
                                                                    backgroundColor: '#ecfdf5',
                                                                    color: '#047857',
                                                                    border: '1px solid #a7f3d0',
                                                                    cursor: 'pointer'
                                                                }}
                                                            >
                                                                <span>📎</span> Ver S3
                                                            </button>
                                                        ) : (
                                                            <span style={{ fontSize: '11px', color: cTextSecondary }}>Sin archivo</span>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '14px 16px', fontWeight: '700', color: cTextPrimary, fontFamily: 'Consolas, monospace' }}>
                                                        {obtenerPatente(g.id_maquina, g.id_maquina_detalle)}
                                                    </td>
                                                    <td style={{ padding: '14px 16px', fontWeight: '900', color: '#dc2626', fontFamily: 'Consolas, monospace', textAlign: 'right' }}>
                                                        ${parseFloat(g.monto || 0).toLocaleString('es-CL')}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: HORAS DE FAENA Y FACTURACIÓN */}
            {pestaña === 'turnos_facturacion' && (
                <div style={{ backgroundColor: cCardBg, borderRadius: '16px', border: `1px solid ${cCardBorder}`, padding: '24px', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)' }}>
                    <div style={{ marginBottom: '16px' }}>
                        <h3 style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: '800', color: cTextPrimary }}>
                            Registro de Horas Ejecutadas para Facturación a Clientes
                        </h3>
                        <p style={{ margin: 0, fontSize: '12px', color: cTextSecondary }}>
                            Cómputo en base a tarifas contratadas e informes de terreno firmados.
                        </p>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ backgroundColor: cThBg, borderBottom: `2px solid ${cCardBorder}` }}>
                                    <th style={{ padding: '12px 16px', color: cTextSecondary, fontWeight: '800' }}>FECHA</th>
                                    <th style={{ padding: '12px 16px', color: cTextSecondary, fontWeight: '800' }}>MÁQUINA</th>
                                    <th style={{ padding: '12px 16px', color: cTextSecondary, fontWeight: '800' }}>HORÓMETROS</th>
                                    <th style={{ padding: '12px 16px', color: cTextSecondary, fontWeight: '800', textAlign: 'right' }}>TARIFA HORA</th>
                                    <th style={{ padding: '12px 16px', color: cTextSecondary, fontWeight: '800', textAlign: 'right' }}>HORAS FACTURABLES</th>
                                    <th style={{ padding: '12px 16px', color: cTextSecondary, fontWeight: '800', textAlign: 'right' }}>TOTAL A FACTURAR</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportes.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: cTextSecondary }}>
                                            No hay turnos registrados en terreno.
                                        </td>
                                    </tr>
                                ) : (
                                    reportes.map((r) => {
                                        const cont = contratos.find(c => c.id_contrato === r.id_contrato || c.id_maquina === r.id_maquina);
                                        const tarifa = r.contrato_tarifa || r.tarifa_aplicada || cont?.tarifa_hora || 28000;
                                        const horas = parseFloat(r.horas_trabajadas || 0);
                                        const totalFacturar = r.ingreso_estimado || (horas * tarifa);

                                        return (
                                            <tr key={r.id_report} style={{ borderBottom: `1px solid ${cBorderRow}` }}>
                                                <td style={{ padding: '14px 16px', fontWeight: '700', color: cTextPrimary }}>{r.fecha}</td>
                                                <td style={{ padding: '14px 16px', fontFamily: 'Consolas, monospace', fontWeight: '700', color: cTextPrimary }}>
                                                    {obtenerPatente(r.id_maquina, r.id_maquina_detalle)}
                                                </td>
                                                <td style={{ padding: '14px 16px', color: cTextSecondary }}>
                                                    {r.horometro_inicial} hrs → {r.horometro_final} hrs
                                                </td>
                                                <td style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'Consolas, monospace', fontWeight: '700', color: cTextPrimary }}>
                                                    ${parseInt(tarifa, 10).toLocaleString('es-CL')}/h
                                                </td>
                                                <td style={{ padding: '14px 16px', fontWeight: '800', color: '#b45309', fontFamily: 'Consolas, monospace', textAlign: 'right' }}>
                                                    {horas.toFixed(1)} hrs
                                                </td>
                                                <td style={{ padding: '14px 16px', fontWeight: '900', color: '#16a34a', fontFamily: 'Consolas, monospace', textAlign: 'right' }}>
                                                    ${parseInt(totalFacturar, 10).toLocaleString('es-CL')}
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

            {/* Modal Visor de Documentos */}
            {modalDoc.abierto && (
                <div
                    onClick={cerrarVisor}
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(15, 23, 42, 0.75)',
                        backdropFilter: 'blur(4px)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                        padding: '20px'
                    }}
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            backgroundColor: cCardBg,
                            borderRadius: '16px',
                            width: '100%',
                            maxWidth: '780px',
                            maxHeight: '90vh',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
                            overflow: 'hidden',
                            border: `1px solid ${cCardBorder}`
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: `1px solid ${cCardBorder}` }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: cTextPrimary }}>
                                    {modalDoc.titulo}
                                </h3>
                                <p style={{ margin: '4px 0 0', fontSize: '12px', color: cTextSecondary }}>
                                    {modalDoc.subtitulo}
                                </p>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <a
                                    href={modalDoc.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{
                                        textDecoration: 'none',
                                        backgroundColor: '#ecfdf5',
                                        color: '#047857',
                                        border: '1px solid #a7f3d0',
                                        padding: '5px 10px',
                                        borderRadius: '6px',
                                        fontSize: '11px',
                                        fontWeight: '700'
                                    }}
                                >
                                    Abrir en S3 ↗
                                </a>
                                <button
                                    onClick={cerrarVisor}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        fontSize: '18px',
                                        fontWeight: '800',
                                        color: cTextSecondary,
                                        cursor: 'pointer'
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div style={{ padding: '20px', flex: 1, overflowY: 'auto', backgroundColor: modoNoche ? '#0b0f19' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {modalDoc.esPdf ? (
                                <iframe
                                    src={modalDoc.url}
                                    title={modalDoc.titulo}
                                    style={{ width: '100%', height: '500px', border: 'none', borderRadius: '8px' }}
                                />
                            ) : (
                                <img
                                    src={modalDoc.url}
                                    alt={modalDoc.titulo}
                                    style={{ maxWidth: '100%', maxHeight: '500px', objectFit: 'contain', borderRadius: '8px' }}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}