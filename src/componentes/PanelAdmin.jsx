import React, { useState, useEffect } from 'react';
import api from '../api/axios';

export default function PanelAdmin() {
    const [maquinarias, setMaquinarias] = useState([]);
    const [reportes, setReportes] = useState([]);
    const [gastos, setGastos] = useState([]);
    const [operadores, setOperadores] = useState([]);
    const [clientes, setClientes] = useState([]);
    const [contratos, setContratos] = useState([]);
    const [cargando, setCargando] = useState(true);

    // Estados modales
    const [mostrarModalMaquina, setMostrarModalMaquina] = useState(false);
    const [mostrarModalGasto, setMostrarModalGasto] = useState(false);
    const [mostrarModalOperador, setMostrarModalOperador] = useState(false);
    const [mostrarModalContrato, setMostrarModalContrato] = useState(false);

    // Formularios
    const [formMaquina, setFormMaquina] = useState({
        patente: '',
        tipo: 'Minicargador',
        marca: '',
        modelo: '',
        horometro_acumulado: 0,
        estado: 'Operativa'
    });

    const [formGasto, setFormGasto] = useState({
        maquinaria: '',
        tipo_gasto: 'Combustible',
        monto: '',
        fecha: new Date().toISOString().split('T')[0]
    });

    const [formOperador, setFormOperador] = useState({
        rut: '',
        nombre: '',
        apellido: '',
        tipo_licencia: 'Clase D'
    });

    const [formContrato, setFormContrato] = useState({
        cliente: '',
        maquinaria: '',
        fecha_inicio: new Date().toISOString().split('T')[0],
        fecha_termino: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        tarifa_hora: 28000,
        estado: 'Vigente'
    });

    const cargarInformacion = () => {
        setCargando(true);
        Promise.all([
            api.get('/maquinarias/').catch(() => ({ data: [] })),
            api.get('/reports/').catch(() => ({ data: [] })),
            api.get('/gastos/').catch(() => ({ data: [] })),
            api.get('/operadores/').catch(() => ({ data: [] })),
            api.get('/clientes/').catch(() => ({ data: [] })),
            api.get('/contratos/').catch(() => ({ data: [] }))
        ])
            .then(([resMaq, resRep, resGas, resOp, resCli, resCon]) => {
                setMaquinarias(resMaq.data);
                setReportes(resRep.data);
                setGastos(resGas.data);
                setOperadores(resOp.data);
                setClientes(resCli.data);
                setContratos(resCon.data);

                if (resMaq.data.length > 0) {
                    setFormGasto((prev) => ({ ...prev, maquinaria: prev.maquinaria || resMaq.data[0].patente }));
                    setFormContrato((prev) => ({ ...prev, maquinaria: prev.maquinaria || resMaq.data[0].patente }));
                }
                if (resCli.data.length > 0) {
                    setFormContrato((prev) => ({ ...prev, cliente: prev.cliente || resCli.data[0].rut }));
                }
            })
            .catch((err) => console.error('Error al cargar panel:', err))
            .finally(() => setCargando(false));
    };

    useEffect(() => {
        cargarInformacion();
    }, []);

    const calcularAlertaPreventiva = (horometro) => {
        const valor = parseFloat(horometro) || 0;
        const ciclo500 = valor % 500;

        if (ciclo500 >= 450 && ciclo500 < 500) {
            return {
                texto: 'Mantenimiento Próximo',
                color: '#d97706',
                estadoCalculado: 'Operativa'
            };
        }
        if (ciclo500 >= 499 || valor >= 500) {
            return {
                texto: 'Requiere Mantención',
                color: '#dc2626',
                estadoCalculado: 'Requiere Mantención'
            };
        }
        return {
            texto: 'Operativa',
            color: '#16a34a',
            estadoCalculado: 'Operativa'
        };
    };

    const guardarMaquina = async (e) => {
        e.preventDefault();
        try {
            await api.post('/maquinarias/', {
                ...formMaquina,
                horometro_acumulado: parseFloat(formMaquina.horometro_acumulado) || 0
            });
            alert('Maquinaria registrada con éxito.');
            setMostrarModalMaquina(false);
            setFormMaquina({ patente: '', tipo: 'Minicargador', marca: '', modelo: '', horometro_acumulado: 0, estado: 'Operativa' });
            cargarInformacion();
        } catch (err) {
            alert('Error al registrar maquinaria: ' + (err.response?.data ? JSON.stringify(err.response.data) : err.message));
        }
    };

    const guardarOperador = async (e) => {
        e.preventDefault();
        try {
            await api.post('/operadores/', formOperador);
            alert('Operador registrado exitosamente.');
            setMostrarModalOperador(false);
            setFormOperador({ rut: '', nombre: '', apellido: '', tipo_licencia: 'Clase D' });
            cargarInformacion();
        } catch (err) {
            alert('Error al registrar operador: ' + (err.response?.data ? JSON.stringify(err.response.data) : err.message));
        }
    };

    const guardarContrato = async (e) => {
        e.preventDefault();
        try {
            let clienteRut = formContrato.cliente;
            if (!clienteRut) {
                if (clientes.length > 0) {
                    clienteRut = clientes[0].rut;
                } else {
                    const resCliente = await api.post('/clientes/', {
                        rut: '93659000-4',
                        razon_social: 'Constructora Salfa S.A.',
                        giro: 'Construcción',
                        direccion: 'Avda. Pdte. Ibañez 05452',
                        contacto: 'Encargado Obra'
                    });
                    clienteRut = resCliente.data.rut;
                }
            }

            await api.post('/contratos/', {
                cliente: clienteRut,
                maquinaria: formContrato.maquinaria,
                fecha_inicio: formContrato.fecha_inicio,
                fecha_termino: formContrato.fecha_termino,
                tarifa_hora: parseFloat(formContrato.tarifa_hora),
                estado: formContrato.estado
            });
            alert('Contrato creado exitosamente.');
            setMostrarModalContrato(false);
            cargarInformacion();
        } catch (err) {
            alert('Error al crear contrato: ' + (err.response?.data ? JSON.stringify(err.response.data) : err.message));
        }
    };

    const guardarGasto = async (e) => {
        e.preventDefault();
        try {
            await api.post('/gastos/', {
                maquinaria: formGasto.maquinaria,
                tipo_gasto: formGasto.tipo_gasto,
                monto: parseFloat(formGasto.monto),
                fecha: formGasto.fecha
            });
            alert('Gasto operativo registrado con éxito.');
            setMostrarModalGasto(false);
            setFormGasto((prev) => ({ ...prev, monto: '' }));
            cargarInformacion();
        } catch (err) {
            alert('Error al registrar gasto: ' + (err.response?.data ? JSON.stringify(err.response.data) : err.message));
        }
    };

    const totalGastosNum = gastos
        .reduce((total, actual) => total + (parseFloat(actual.monto) || 0), 0);

    const totalIngresosCalculados = reportes.reduce((total, rep) => {
        const contratoRel = contratos.find((c) => String(c.id) === String(rep.contrato));
        const tarifa = contratoRel ? parseFloat(contratoRel.tarifa_hora || 28000) : 28000;
        return total + ((parseFloat(rep.horas_trabajadas) || 0) * tarifa);
    }, 0);

    const margenNetoGlobal = totalIngresosCalculados - totalGastosNum;

    return (
        <div style={{ maxWidth: '1150px', margin: '0 auto', fontFamily: 'sans-serif' }}>

            {/* Barra de Acciones */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h2 style={{ margin: 0, color: '#0f172a', fontSize: '22px' }}>Panel de Control y Flota</h2>
                    <small style={{ color: '#64748b' }}>Seguimiento  de contratos, horómetros y balance operacional</small>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        onClick={() => setMostrarModalContrato(true)}
                        style={{ padding: '8px 12px', background: '#059669', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
                    >
                        + Nuevo Contrato
                    </button>
                    <button
                        type="button"
                        onClick={() => setMostrarModalMaquina(true)}
                        style={{ padding: '8px 12px', background: '#0284c7', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}
                    >
                        + Maquinaria
                    </button>
                    <button
                        type="button"
                        onClick={() => setMostrarModalOperador(true)}
                        style={{ padding: '8px 12px', background: '#475569', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}
                    >
                        + Operador
                    </button>
                    <button
                        type="button"
                        onClick={() => setMostrarModalGasto(true)}
                        style={{ padding: '8px 12px', background: '#d97706', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}
                    >
                        + Gasto
                    </button>
                    <button
                        type="button"
                        onClick={cargarInformacion}
                        style={{ padding: '8px 12px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                    >
                        Actualizar
                    </button>
                </div>
            </div>

            {/* Tarjetas de Métricas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '28px' }}>
                <div style={{ background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', borderLeft: '4px solid #059669' }}>
                    <div style={{ color: '#64748b', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Contratos Activos</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0f172a' }}>{contratos.length}</div>
                </div>
                <div style={{ background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', borderLeft: '4px solid #0284c7' }}>
                    <div style={{ color: '#64748b', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Facturación Estimada</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#0369a1' }}>${totalIngresosCalculados.toLocaleString('es-CL')}</div>
                </div>
                <div style={{ background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', borderLeft: '4px solid #ef4444' }}>
                    <div style={{ color: '#64748b', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Gastos de Terreno</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#dc2626' }}>${totalGastosNum.toLocaleString('es-CL')}</div>
                </div>
                <div style={{ background: '#ffffff', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', borderLeft: '4px solid #10b981' }}>
                    <div style={{ color: '#64748b', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>Margen Operativo Neto</div>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: margenNetoGlobal >= 0 ? '#15803d' : '#dc2626' }}>
                        ${margenNetoGlobal.toLocaleString('es-CL')}
                    </div>
                </div>
            </div>

            {/* Contratos y Rentabilidad */}
            <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '20px', marginBottom: '28px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#0f172a' }}>
                    Contratos de Arriendo y Rentabilidad por Faena
                </h3>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                                <th style={{ padding: '10px 12px' }}>ID</th>
                                <th style={{ padding: '10px 12px' }}>Cliente</th>
                                <th style={{ padding: '10px 12px' }}>Maquinaria</th>
                                <th style={{ padding: '10px 12px' }}>Tarifa / Hora</th>
                                <th style={{ padding: '10px 12px' }}>Horas Trabajadas</th>
                                <th style={{ padding: '10px 12px' }}>Subtotal Cobrable</th>
                                <th style={{ padding: '10px 12px' }}>Gastos Imputados</th>
                                <th style={{ padding: '10px 12px' }}>Margen Faena</th>
                                <th style={{ padding: '10px 12px' }}>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {contratos.length === 0 ? (
                                <tr>
                                    <td colSpan="9" style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>
                                        No hay contratos activos registrados.
                                    </td>
                                </tr>
                            ) : (
                                contratos.map((c) => {
                                    const reportesContrato = reportes.filter((r) => String(r.contrato) === String(c.id));
                                    const horasContrato = reportesContrato.reduce((sum, r) => sum + (parseFloat(r.horas_trabajadas) || 0), 0);
                                    const tarifa = parseFloat(c.tarifa_hora) || 28000;
                                    const totalFacturar = horasContrato * tarifa;

                                    const gastosMaquina = gastos
                                        .filter((g) => g.maquinaria === c.maquinaria)
                                        .reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0);

                                    const margenContrato = totalFacturar - gastosMaquina;

                                    return (
                                        <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '10px 12px', fontWeight: 'bold' }}>#{c.id}</td>
                                            <td style={{ padding: '10px 12px' }}>{c.cliente_detalle?.razon_social || c.cliente}</td>
                                            <td style={{ padding: '10px 12px', fontWeight: '600' }}>{c.maquinaria}</td>
                                            <td style={{ padding: '10px 12px' }}>${tarifa.toLocaleString('es-CL')}/hr</td>
                                            <td style={{ padding: '10px 12px', fontWeight: '600', color: '#0284c7' }}>{horasContrato.toFixed(1)} hrs</td>
                                            <td style={{ padding: '10px 12px', fontWeight: '600' }}>${totalFacturar.toLocaleString('es-CL')}</td>
                                            <td style={{ padding: '10px 12px', color: '#dc2626' }}>${gastosMaquina.toLocaleString('es-CL')}</td>
                                            <td style={{ padding: '10px 12px', fontWeight: '700', color: margenContrato >= 0 ? '#15803d' : '#dc2626' }}>
                                                ${margenContrato.toLocaleString('es-CL')}
                                            </td>
                                            <td style={{ padding: '10px 12px' }}>
                                                <span style={{ background: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                                                    {c.estado || 'Vigente'}
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

            {/* Control Preventivo de Flota */}
            <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '20px', marginBottom: '28px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#0f172a' }}>Control de Flota y Mantenimiento</h3>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                                <th style={{ padding: '10px 12px' }}>Patente</th>
                                <th style={{ padding: '10px 12px' }}>Equipo y Modelo</th>
                                <th style={{ padding: '10px 12px' }}>Horómetro</th>
                                <th style={{ padding: '10px 12px' }}>Alerta</th>
                                <th style={{ padding: '10px 12px' }}>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {maquinarias.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>
                                        No hay maquinarias ingresadas aún.
                                    </td>
                                </tr>
                            ) : (
                                maquinarias.map((m) => {
                                    const alerta = calcularAlertaPreventiva(m.horometro_acumulado);
                                    const estadoFinal = m.estado === 'Requiere Mantención' ? m.estado : alerta.estadoCalculado;
                                    return (
                                        <tr key={m.patente} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '10px 12px', fontWeight: '600' }}>{m.patente}</td>
                                            <td style={{ padding: '10px 12px' }}>{m.tipo} - {m.marca} {m.modelo}</td>
                                            <td style={{ padding: '10px 12px', fontWeight: '600' }}>{m.horometro_acumulado} hrs</td>
                                            <td style={{ padding: '10px 12px' }}>
                                                <span style={{ background: alerta.color, color: 'white', padding: '3px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '500' }}>
                                                    {alerta.texto}
                                                </span>
                                            </td>
                                            <td style={{ padding: '10px 12px' }}>
                                                <span style={{ color: estadoFinal === 'Requiere Mantención' ? '#dc2626' : '#16a34a', fontWeight: '600' }}>
                                                    {estadoFinal}
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

            {/* Historial de Partes Diarios */}
            <div style={{ background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '20px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#0f172a' }}>Historial de Partes Diarios Recibidos</h3>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                                <th style={{ padding: '10px 12px' }}>Fecha</th>
                                <th style={{ padding: '10px 12px' }}>Contrato</th>
                                <th style={{ padding: '10px 12px' }}>Equipo</th>
                                <th style={{ padding: '10px 12px' }}>Operador</th>
                                <th style={{ padding: '10px 12px' }}>Horario</th>
                                <th style={{ padding: '10px 12px' }}>Horómetro</th>
                                <th style={{ padding: '10px 12px' }}>Horas</th>
                                <th style={{ padding: '10px 12px' }}>Firma Obra</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reportes.length === 0 ? (
                                <tr>
                                    <td colSpan="8" style={{ padding: '16px', textAlign: 'center', color: '#64748b' }}>
                                        No se han registrado reportes aún.
                                    </td>
                                </tr>
                            ) : (
                                reportes.map((r) => (
                                    <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '10px 12px' }}>{r.fecha}</td>
                                        <td style={{ padding: '10px 12px', fontWeight: 'bold' }}>#{r.contrato}</td>
                                        <td style={{ padding: '10px 12px', fontWeight: '600' }}>{r.maquinaria_tipo || 'Equipo'} ({r.maquinaria_patente || 'S/P'})</td>
                                        <td style={{ padding: '10px 12px' }}>{r.operador_nombre || r.operador}</td>
                                        <td style={{ padding: '10px 12px', color: '#64748b' }}>{r.hora_entrada?.slice(0, 5)} - {r.hora_salida?.slice(0, 5)}</td>
                                        <td style={{ padding: '10px 12px' }}>{r.horometro_inicio} → {r.horometro_final}</td>
                                        <td style={{ padding: '10px 12px', fontWeight: '700', color: '#0369a1' }}>{r.horas_trabajadas} hrs</td>
                                        <td style={{ padding: '10px 12px' }}>
                                            <span style={{ color: r.firmado ? '#166534' : '#991b1b', background: r.firmado ? '#dcfce7' : '#fee2e2', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '600' }}>
                                                {r.firmado ? 'Conforme' : 'Sin Firma'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL 1: REGISTRAR MAQUINARIA */}
            {mostrarModalMaquina && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                    <div style={{ background: '#ffffff', width: '100%', maxWidth: '420px', padding: '24px', borderRadius: '8px' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#0f172a' }}>Registrar Nueva Maquinaria</h3>
                        <form onSubmit={guardarMaquina} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Patente:</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: GCJH19"
                                    value={formMaquina.patente}
                                    onChange={(e) => setFormMaquina({ ...formMaquina, patente: e.target.value.toUpperCase() })}
                                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Tipo:</label>
                                <input
                                    type="text"
                                    required
                                    value={formMaquina.tipo}
                                    onChange={(e) => setFormMaquina({ ...formMaquina, tipo: e.target.value })}
                                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Marca:</label>
                                    <input
                                        type="text"
                                        required
                                        value={formMaquina.marca}
                                        onChange={(e) => setFormMaquina({ ...formMaquina, marca: e.target.value })}
                                        style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Modelo:</label>
                                    <input
                                        type="text"
                                        required
                                        value={formMaquina.modelo}
                                        onChange={(e) => setFormMaquina({ ...formMaquina, modelo: e.target.value })}
                                        style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                                    />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Horómetro Inicial:</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    required
                                    value={formMaquina.horometro_acumulado}
                                    onChange={(e) => setFormMaquina({ ...formMaquina, horometro_acumulado: e.target.value })}
                                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                                <button type="button" onClick={() => setMostrarModalMaquina(false)} style={{ padding: '8px 14px', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                    Cancelar
                                </button>
                                <button type="submit" style={{ padding: '8px 14px', background: '#0284c7', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}>
                                    Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 2: REGISTRAR OPERADOR */}
            {mostrarModalOperador && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                    <div style={{ background: '#ffffff', width: '100%', maxWidth: '420px', padding: '24px', borderRadius: '8px' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#0f172a' }}>Registrar Nuevo Operador</h3>
                        <form onSubmit={guardarOperador} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>RUT:</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ej: 15482391-2"
                                    value={formOperador.rut}
                                    onChange={(e) => setFormOperador({ ...formOperador, rut: e.target.value })}
                                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Nombre:</label>
                                    <input
                                        type="text"
                                        required
                                        value={formOperador.nombre}
                                        onChange={(e) => setFormOperador({ ...formOperador, nombre: e.target.value })}
                                        style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Apellido:</label>
                                    <input
                                        type="text"
                                        required
                                        value={formOperador.apellido}
                                        onChange={(e) => setFormOperador({ ...formOperador, apellido: e.target.value })}
                                        style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                                    />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Tipo Licencia:</label>
                                <select
                                    value={formOperador.tipo_licencia}
                                    onChange={(e) => setFormOperador({ ...formOperador, tipo_licencia: e.target.value })}
                                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                                >
                                    <option value="Clase D">Clase D</option>
                                    <option value="Clase A4">Clase A4</option>
                                    <option value="Clase A5">Clase A5</option>
                                </select>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                                <button type="button" onClick={() => setMostrarModalOperador(false)} style={{ padding: '8px 14px', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                    Cancelar
                                </button>
                                <button type="submit" style={{ padding: '8px 14px', background: '#475569', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}>
                                    Guardar Operador
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 3: REGISTRAR CONTRATO */}
            {mostrarModalContrato && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                    <div style={{ background: '#ffffff', width: '100%', maxWidth: '420px', padding: '24px', borderRadius: '8px' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#0f172a' }}>Crear Contrato de Faena</h3>
                        <form onSubmit={guardarContrato} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Maquinaria Asignada:</label>
                                <select
                                    value={formContrato.maquinaria}
                                    onChange={(e) => setFormContrato({ ...formContrato, maquinaria: e.target.value })}
                                    required
                                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                                >
                                    {maquinarias.map((m) => (
                                        <option key={m.patente} value={m.patente}>
                                            {m.patente} - {m.tipo}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Fecha Inicio:</label>
                                    <input
                                        type="date"
                                        required
                                        value={formContrato.fecha_inicio}
                                        onChange={(e) => setFormContrato({ ...formContrato, fecha_inicio: e.target.value })}
                                        style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Tarifa / Hora ($):</label>
                                    <input
                                        type="number"
                                        required
                                        value={formContrato.tarifa_hora}
                                        onChange={(e) => setFormContrato({ ...formContrato, tarifa_hora: e.target.value })}
                                        style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                                    />
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                                <button type="button" onClick={() => setMostrarModalContrato(false)} style={{ padding: '8px 14px', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                    Cancelar
                                </button>
                                <button type="submit" style={{ padding: '8px 14px', background: '#059669', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}>
                                    Crear Contrato
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL 4: REGISTRAR GASTO */}
            {mostrarModalGasto && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
                    <div style={{ background: '#ffffff', width: '100%', maxWidth: '420px', padding: '24px', borderRadius: '8px' }}>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#0f172a' }}>Registrar Gasto Operativo</h3>
                        <form onSubmit={guardarGasto} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Maquinaria:</label>
                                <select
                                    value={formGasto.maquinaria}
                                    onChange={(e) => setFormGasto({ ...formGasto, maquinaria: e.target.value })}
                                    required
                                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                                >
                                    {maquinarias.map((m) => (
                                        <option key={m.patente} value={m.patente}>
                                            {m.patente} - {m.tipo}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Tipo de Gasto:</label>
                                <select
                                    value={formGasto.tipo_gasto}
                                    onChange={(e) => setFormGasto({ ...formGasto, tipo_gasto: e.target.value })}
                                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                                >
                                    <option value="Combustible">Combustible</option>
                                    <option value="Repuesto">Repuesto</option>
                                    <option value="Viatico">Viático</option>
                                </select>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Monto ($ CLP):</label>
                                <input
                                    type="number"
                                    required
                                    placeholder="Ej: 45000"
                                    value={formGasto.monto}
                                    onChange={(e) => setFormGasto({ ...formGasto, monto: e.target.value })}
                                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '4px' }}>Fecha:</label>
                                <input
                                    type="date"
                                    required
                                    value={formGasto.fecha}
                                    onChange={(e) => setFormGasto({ ...formGasto, fecha: e.target.value })}
                                    style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '4px', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                                <button type="button" onClick={() => setMostrarModalGasto(false)} style={{ padding: '8px 14px', background: '#e2e8f0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                                    Cancelar
                                </button>
                                <button type="submit" style={{ padding: '8px 14px', background: '#d97706', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '600' }}>
                                    Registrar Gasto
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}