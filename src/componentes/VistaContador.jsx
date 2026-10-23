import React, { useState, useEffect } from 'react';
import axios from '../api/axios';

export default function VistaContador() {
    const [gastos, setGastos] = useState([]);
    const [reportes, setReportes] = useState([]);
    const [maquinarias, setMaquinarias] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [filtroTipo, setFiltroTipo] = useState('todos');
    const [busqueda, setBusqueda] = useState('');
    const [pestaña, setPestaña] = useState('gastos');

    const cargarDatosFinancieros = async () => {
        setCargando(true);
        try {
            const [resGas, resRep, resMaq] = await Promise.all([
                axios.get('/api/gastos/'),
                axios.get('/api/reports/'),
                axios.get('/api/maquinarias/')
            ]);
            setGastos(resGas.data || []);
            setReportes(resRep.data || []);
            setMaquinarias(resMaq.data || []);
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

    const gastosFiltrados = gastos.filter((g) => {
        const tipo = g.categoria_gasto || g.tipo_gasto || 'General';
        const coincideTipo = filtroTipo === 'todos' || tipo.toLowerCase() === filtroTipo.toLowerCase();
        const patenteTexto = obtenerPatente(g.id_maquina, g.id_maquina_detalle);
        const textoCompleto = `${g.descripcion || ''} ${tipo} ${patenteTexto}`.toLowerCase();
        return coincideTipo && textoCompleto.includes(busqueda.toLowerCase());
    });

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
                        DEPARTAMENTO DE FINANZAS • MULTIMAK 360
                    </span>
                    <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#ffffff', margin: '4px 0 0', letterSpacing: '-0.02em' }}>
                        Panel Contable y Liquidación Operativa
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <div style={{ backgroundColor: '#ffffff', padding: '18px 22px', borderRadius: '16px', border: '1px solid #e2e8f0', borderTop: '4px solid #0f172a', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)' }}>
                    <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase' }}>Gasto Total Flota</span>
                    <div style={{ fontSize: '26px', fontWeight: '900', color: '#0f172a', fontFamily: 'Consolas, monospace', marginTop: '2px' }}>
                        ${totalGastosAcumulados.toLocaleString('es-CL')}
                    </div>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>Egresos consolidados</span>
                </div>

                <div style={{ backgroundColor: '#ffffff', padding: '18px 22px', borderRadius: '16px', border: '1px solid #e2e8f0', borderTop: '4px solid #f59e0b', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)' }}>
                    <span style={{ fontSize: '10px', fontWeight: '800', color: '#d97706', textTransform: 'uppercase' }}>Combustible</span>
                    <div style={{ fontSize: '26px', fontWeight: '900', color: '#b45309', fontFamily: 'Consolas, monospace', marginTop: '2px' }}>
                        ${gastosCombustible.toLocaleString('es-CL')}
                    </div>
                    <span style={{ fontSize: '11px', color: '#fde68a' }}>Petróleo diésel cargado</span>
                </div>

                <div style={{ backgroundColor: '#ffffff', padding: '18px 22px', borderRadius: '16px', border: '1px solid #e2e8f0', borderTop: '4px solid #dc2626', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)' }}>
                    <span style={{ fontSize: '10px', fontWeight: '800', color: '#dc2626', textTransform: 'uppercase' }}>Taller y Repuestos</span>
                    <div style={{ fontSize: '26px', fontWeight: '900', color: '#b91c1c', fontFamily: 'Consolas, monospace', marginTop: '2px' }}>
                        ${gastosMantenimiento.toLocaleString('es-CL')}
                    </div>
                    <span style={{ fontSize: '11px', color: '#fca5a5' }}>Mantenciones y piezas</span>
                </div>

                <div style={{ backgroundColor: '#ffffff', padding: '18px 22px', borderRadius: '16px', border: '1px solid #e2e8f0', borderTop: '4px solid #16a34a', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)' }}>
                    <span style={{ fontSize: '10px', fontWeight: '800', color: '#16a34a', textTransform: 'uppercase' }}>Horas en Faena</span>
                    <div style={{ fontSize: '26px', fontWeight: '900', color: '#15803d', fontFamily: 'Consolas, monospace', marginTop: '2px' }}>
                        {totalHorasFacturables.toFixed(1)} hrs
                    </div>
                    <span style={{ fontSize: '11px', color: '#86efac' }}>Base para facturación</span>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
                <button
                    onClick={() => setPestaña('gastos')}
                    style={{
                        backgroundColor: pestaña === 'gastos' ? '#0f172a' : '#ffffff',
                        color: pestaña === 'gastos' ? '#ffffff' : '#64748b',
                        border: '1px solid #cbd5e1',
                        borderRadius: '10px',
                        padding: '10px 20px',
                        fontWeight: '800',
                        fontSize: '12px',
                        cursor: 'pointer'
                    }}
                >
                    Libro de Egresos ({gastos.length})
                </button>

                <button
                    onClick={() => setPestaña('turnos_facturacion')}
                    style={{
                        backgroundColor: pestaña === 'turnos_facturacion' ? '#0f172a' : '#ffffff',
                        color: pestaña === 'turnos_facturacion' ? '#ffffff' : '#64748b',
                        border: '1px solid #cbd5e1',
                        borderRadius: '10px',
                        padding: '10px 20px',
                        fontWeight: '800',
                        fontSize: '12px',
                        cursor: 'pointer'
                    }}
                >
                    Horas de Faena para Facturación ({reportes.length})
                </button>
            </div>

            {pestaña === 'gastos' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <input
                            type="text"
                            placeholder="Buscar por descripción, tipo o patente..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
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
                            value={filtroTipo}
                            onChange={(e) => setFiltroTipo(e.target.value)}
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
                            <option value="todos">Todos los conceptos</option>
                            <option value="Combustible">Combustible</option>
                            <option value="Repuesto">Repuesto</option>
                            <option value="Mantención">Mantención</option>
                            <option value="Traslado">Traslado</option>
                        </select>
                    </div>

                    <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)' }}>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                        <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800' }}>FECHA</th>
                                        <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800' }}>CONCEPTO</th>
                                        <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800' }}>MÁQUINA ASOCIADA</th>
                                        <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800' }}>GLOSA / DETALLE</th>
                                        <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800', textAlign: 'right' }}>MONTO</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {gastosFiltrados.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                                                No hay egresos registrados.
                                            </td>
                                        </tr>
                                    ) : (
                                        gastosFiltrados.map((g) => {
                                            const concepto = g.categoria_gasto || g.tipo_gasto || 'Gasto General';
                                            const esCombustible = concepto.toLowerCase().includes('combus');
                                            return (
                                                <tr key={g.id_gasto} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                    <td style={{ padding: '14px 16px', color: '#475569', fontFamily: 'Consolas, monospace' }}>
                                                        {g.fecha}
                                                    </td>
                                                    <td style={{ padding: '14px 16px' }}>
                                                        <span style={{
                                                            padding: '4px 10px',
                                                            borderRadius: '6px',
                                                            fontSize: '11px',
                                                            fontWeight: '800',
                                                            backgroundColor: esCombustible ? '#fef3c7' : '#e0e7ff',
                                                            color: esCombustible ? '#92400e' : '#3730a3'
                                                        }}>
                                                            {concepto}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '14px 16px', fontWeight: '700', color: '#0f172a', fontFamily: 'Consolas, monospace' }}>
                                                        {obtenerPatente(g.id_maquina, g.id_maquina_detalle)}
                                                    </td>
                                                    <td style={{ padding: '14px 16px', color: '#64748b' }}>
                                                        {g.descripcion || 'Comprobante operativo'}
                                                    </td>
                                                    <td style={{ padding: '14px 16px', fontWeight: '900', color: '#0f172a', fontFamily: 'Consolas, monospace', textAlign: 'right' }}>
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

            {pestaña === 'turnos_facturacion' && (
                <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '24px', boxShadow: '0 4px 14px rgba(15, 23, 42, 0.04)' }}>
                    <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '800', color: '#0f172a' }}>
                        Registro de Horas Ejecutadas para Facturación a Clientes
                    </h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800' }}>FECHA</th>
                                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800' }}>MÁQUINA</th>
                                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800' }}>HORÓMETROS</th>
                                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800' }}>COMBUSTIBLE CARGADO</th>
                                    <th style={{ padding: '12px 16px', color: '#475569', fontWeight: '800', textAlign: 'right' }}>HORAS FACTURABLES</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reportes.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                                            No hay turnos registrados en terreno.
                                        </td>
                                    </tr>
                                ) : (
                                    reportes.map((r) => (
                                        <tr key={r.id_report} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '14px 16px', fontWeight: '700', color: '#0f172a' }}>{r.fecha}</td>
                                            <td style={{ padding: '14px 16px', fontFamily: 'Consolas, monospace', fontWeight: '700' }}>
                                                {obtenerPatente(r.id_maquina, r.id_maquina_detalle)}
                                            </td>
                                            <td style={{ padding: '14px 16px', color: '#64748b' }}>
                                                {r.horometro_inicial} hrs → {r.horometro_final} hrs
                                            </td>
                                            <td style={{ padding: '14px 16px' }}>{r.combustible_litros || 0} Lts</td>
                                            <td style={{ padding: '14px 16px', fontWeight: '900', color: '#15803d', fontFamily: 'Consolas, monospace', textAlign: 'right' }}>
                                                {parseFloat(r.horas_trabajadas || 0).toFixed(1)} hrs
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
    );
}