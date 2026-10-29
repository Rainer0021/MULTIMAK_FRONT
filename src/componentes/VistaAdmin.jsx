import React, { useState, useEffect } from 'react';
import axios from '../api/axios';
import '../styles/VistaAdmin.css';

export default function VistaAdmin({ usuario }) {
    const fechaHoy = new Date().toISOString().split('T')[0];

    // Pestañas principales
    const [tabActiva, setTabActiva] = useState('dashboard');
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [mensajeExito, setMensajeExito] = useState('');

    // Colecciones de datos
    const [maquinarias, setMaquinarias] = useState([]);
    const [operadores, setOperadores] = useState([]);
    const [reportes, setReportes] = useState([]);
    const [gastos, setGastos] = useState([]);
    const [contratos, setContratos] = useState([]);
    const [clientes, setClientes] = useState([]);
    const [usuariosDisponibles, setUsuariosDisponibles] = useState([]);

    // Estados de búsqueda y filtrado en tiempo real
    const [busquedaMaq, setBusquedaMaq] = useState('');
    const [busquedaOp, setBusquedaOp] = useState('');
    const [busquedaGasto, setBusquedaGasto] = useState('');

    // Estados CRUD Maquinarias
    const [mostrarModalMaq, setMostrarModalMaq] = useState(false);
    const [editandoMaqId, setEditandoMaqId] = useState(null);
    const [formMaq, setFormMaq] = useState({
        patente: '',
        marca: '',
        modelo: '',
        tipo: 'Excavadora',
        horometro_actual: '',
        estado: 'Disponible'
    });

    // Estados CRUD Operadores
    const [mostrarModalOp, setMostrarModalOp] = useState(false);
    const [editandoOpId, setEditandoOpId] = useState(null);
    const [formOp, setFormOp] = useState({
        id_usuario: '',
        TipoLicencia: 'Clase D',
        fecha_vencimiento_licencia: ''
    });

    // Estados CRUD Gastos
    const [mostrarModalGasto, setMostrarModalGasto] = useState(false);
    const [editandoGastoId, setEditandoGastoId] = useState(null);
    const [formGasto, setFormGasto] = useState({
        categoria_gasto: 'Combustible',
        monto: '',
        fecha: fechaHoy,
        id_maquina: '',
        numero_comprobante: ''
    });

    // Estados CRUD Contratos
    const [mostrarModalContrato, setMostrarModalContrato] = useState(false);
    const [formContrato, setFormContrato] = useState({
        id_cliente: '',
        fecha_inicio: fechaHoy,
        fecha_fin: '',
        tarifa_hora: '28000',
        estado_contrato: 'Activo'
    });

    // Carga global de entidades
    const cargarTodo = async () => {
        setCargando(true);
        setError('');
        try {
            const [resMaq, resOp, resRep, resGas, resCont, resCli, resUsers] = await Promise.all([
                axios.get('/maquinarias/').catch(() => axios.get('/maquinaria/')),
                axios.get('/operadores/').catch(() => axios.get('/operador/')),
                axios.get('/reports/').catch(() => axios.get('/report/')),
                axios.get('/gastos/').catch(() => ({ data: [] })),
                axios.get('/contratos/').catch(() => ({ data: [] })),
                axios.get('/clientes/').catch(() => ({ data: [] })),
                axios.get('/usuarios/').catch(() => ({ data: [] }))
            ]);

            setMaquinarias(resMaq.data?.results || resMaq.data || []);
            setOperadores(resOp.data?.results || resOp.data || []);
            setReportes(resRep.data?.results || resRep.data || []);
            setGastos(resGas.data?.results || resGas.data || []);
            setContratos(resCont.data?.results || resCont.data || []);
            setClientes(resCli.data?.results || resCli.data || []);
            setUsuariosDisponibles(resUsers.data?.results || resUsers.data || []);
        } catch (err) {
            console.error('Error al sincronizar datos administrativos:', err);
            setError('Error al sincronizar la información con el servidor.');
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarTodo();
    }, []);

    // KPIs Operativos
    const totalEquipos = maquinarias.length;
    const enTaller = maquinarias.filter(m => m.estado === 'En Taller' || m.estado === 'Requiere Mantención').length;
    const disponibilidadFlota = totalEquipos > 0
        ? (((totalEquipos - enTaller) / totalEquipos) * 100).toFixed(1)
        : '100.0';

    const totalGastos = gastos.reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0);

    // Lógica técnica de mantenciones preventivas (450h/500h y 950h/1.000h)
    const analisisMantenciones = maquinarias.map((m) => {
        const h = parseFloat(m.horometro_actual ?? m.horometro ?? 0);
        let nivelAlerta = 'OPERATIVA';
        let detalleAlerta = 'Operación normal en terreno';
        let proximaPauta = 500;

        if (h < 500) {
            proximaPauta = 500;
            if (h >= 450) {
                nivelAlerta = 'ALERTA_PREVENTIVA';
                detalleAlerta = 'Alerta preventiva: faltan menos de 50 hrs para pauta de 500 hrs';
            }
        } else if (h >= 500 && h < 1000) {
            proximaPauta = 1000;
            if (h >= 950) {
                nivelAlerta = 'ALERTA_PREVENTIVA';
                detalleAlerta = 'Alerta preventiva: cambio de fluidos hidráulicos a las 1.000 hrs';
            } else if (h >= 900) {
                nivelAlerta = 'ATENCION';
                detalleAlerta = 'Atención: equipo superó las 900 hrs. Planificar insumos de 1.000 hrs';
            }
        } else if (h >= 1000) {
            proximaPauta = 1000;
            nivelAlerta = 'REQUIERE_TALLER';
            detalleAlerta = 'Mantención obligatoria: cumplió 1.000 hrs. Enviar equipo a taller';
        }

        const horasRestantes = Math.max(0, proximaPauta - h);
        const porcentajeUso = Math.min(100, Math.round((h / proximaPauta) * 100));

        return {
            ...m,
            horometroNum: h,
            proximaPauta,
            horasRestantes: horasRestantes.toFixed(1),
            porcentajeUso,
            nivelAlerta,
            detalleAlerta
        };
    });

    const maquinasConAlerta = analisisMantenciones.filter(m => m.nivelAlerta !== 'OPERATIVA');

    // Rendimiento de Operadores
    const hoyDate = new Date();
    const horasPorOperador = operadores.map(op => {
        const reps = reportes.filter(r => r.id_operador === op.id_operador);
        const sumaHoras = reps.reduce((acc, r) => acc + (parseInt(r.horas_trabajadas, 10) || 0), 0);
        return {
            id: op.id_operador,
            nombre: op.id_usuario?.nombre || `Operador #${op.id_operador}`,
            rut: op.id_usuario?.rut || op.rut || 'N/A',
            licencia: op.TipoLicencia || 'Clase D',
            vencimiento: op.fecha_vencimiento_licencia || 'Indefinida',
            horas: sumaHoras,
            turnos: reps.length
        };
    }).sort((a, b) => b.horas - a.horas);

    // Filtrado reactivo en tiempo real
    const maquinariasFiltradas = maquinarias.filter(m => {
        const term = busquedaMaq.toLowerCase();
        const patente = (m.patente || '').toLowerCase();
        const marca = (m.marca || '').toLowerCase();
        const modelo = (m.modelo || '').toLowerCase();
        const tipo = (m.tipo || '').toLowerCase();
        return patente.includes(term) || marca.includes(term) || modelo.includes(term) || tipo.includes(term);
    });

    const operadoresFiltrados = operadores.filter(op => {
        const term = busquedaOp.toLowerCase();
        const nombre = (op.id_usuario?.nombre || `Operador #${op.id_operador}`).toLowerCase();
        const rut = (op.id_usuario?.rut || op.rut || '').toLowerCase();
        const licencia = (op.TipoLicencia || '').toLowerCase();
        return nombre.includes(term) || rut.includes(term) || licencia.includes(term);
    });

    const gastosFiltrados = gastos.filter(g => {
        const term = busquedaGasto.toLowerCase();
        const cat = (g.categoria_gasto || '').toLowerCase();
        const comp = (g.numero_comprobante || '').toLowerCase();
        const maqId = (g.id_maquina || '').toString();
        return cat.includes(term) || comp.includes(term) || maqId.includes(term);
    });

    // Operaciones CRUD
    const abrirFormMaquinaria = (maq = null) => {
        if (maq) {
            setEditandoMaqId(maq.id_maquina);
            setFormMaq({
                patente: maq.patente,
                marca: maq.marca,
                modelo: maq.modelo,
                tipo: maq.tipo,
                horometro_actual: maq.horometro_actual ?? maq.horometro ?? '',
                estado: maq.estado || 'Disponible'
            });
        } else {
            setEditandoMaqId(null);
            setFormMaq({ patente: '', marca: '', modelo: '', tipo: 'Excavadora', horometro_actual: '', estado: 'Disponible' });
        }
        setMostrarModalMaq(true);
    };

    const guardarMaquinaria = async (e) => {
        e.preventDefault();
        const payload = {
            patente: formMaq.patente.toUpperCase(),
            marca: formMaq.marca,
            modelo: formMaq.modelo,
            tipo: formMaq.tipo,
            horometro_actual: parseFloat(formMaq.horometro_actual) || 0,
            estado: formMaq.estado
        };

        try {
            if (editandoMaqId) {
                await axios.put(`/maquinarias/${editandoMaqId}/`, payload);
                setMensajeExito('Ficha técnica de maquinaria actualizada correctamente.');
            } else {
                await axios.post('/maquinarias/', payload);
                setMensajeExito('Maquinaria dada de alta exitosamente en la flota.');
            }
            setMostrarModalMaq(false);
            cargarTodo();
        } catch {
            setError('Error al procesar el registro de maquinaria.');
        }
    };

    const eliminarMaquinaria = async (id) => {
        if (!window.confirm(`Confirme la baja de la maquinaria #${id}:`)) return;
        try {
            await axios.delete(`/maquinarias/${id}/`);
            setMensajeExito('Maquinaria eliminada del inventario de flota.');
            cargarTodo();
        } catch {
            setError('No fue posible eliminar la maquinaria.');
        }
    };

    const abrirFormOperador = (op = null) => {
        if (op) {
            setEditandoOpId(op.id_operador);
            setFormOp({
                id_usuario: op.id_usuario?.id_usuario || op.id_usuario || '',
                TipoLicencia: op.TipoLicencia || 'Clase D',
                fecha_vencimiento_licencia: op.fecha_vencimiento_licencia || ''
            });
        } else {
            setEditandoOpId(null);
            setFormOp({ id_usuario: '', TipoLicencia: 'Clase D', fecha_vencimiento_licencia: '' });
        }
        setMostrarModalOp(true);
    };

    const guardarOperador = async (e) => {
        e.preventDefault();
        if (!formOp.id_usuario) {
            setError('Seleccione una cuenta de usuario para habilitar.');
            return;
        }

        const payload = {
            id_usuario: parseInt(formOp.id_usuario, 10),
            TipoLicencia: formOp.TipoLicencia,
            fecha_vencimiento_licencia: formOp.fecha_vencimiento_licencia || null
        };

        try {
            if (editandoOpId) {
                await axios.put(`/operadores/${editandoOpId}/`, payload);
                setMensajeExito('Registro de operador actualizado correctamente.');
            } else {
                await axios.post('/operadores/', payload);
                setMensajeExito('Operador habilitado exitosamente en la nómina.');
            }
            setMostrarModalOp(false);
            cargarTodo();
        } catch {
            setError('Error al registrar al operador en la base de datos.');
        }
    };

    const eliminarOperador = async (id) => {
        if (!window.confirm(`Confirme la baja del operador #${id}:`)) return;
        try {
            await axios.delete(`/operadores/${id}/`);
            setMensajeExito('Operador eliminado de la nómina.');
            cargarTodo();
        } catch {
            setError('No fue posible desvincular al operador.');
        }
    };

    const abrirFormGasto = (g = null) => {
        if (g) {
            setEditandoGastoId(g.id_gasto);
            setFormGasto({
                categoria_gasto: g.categoria_gasto,
                monto: g.monto,
                fecha: g.fecha,
                id_maquina: g.id_maquina,
                numero_comprobante: g.numero_comprobante || ''
            });
        } else {
            setEditandoGastoId(null);
            setFormGasto({
                categoria_gasto: 'Combustible',
                monto: '',
                fecha: fechaHoy,
                id_maquina: '',
                numero_comprobante: ''
            });
        }
        setMostrarModalGasto(true);
    };

    const guardarGasto = async (e) => {
        e.preventDefault();
        const sesion = JSON.parse(localStorage.getItem('usuario_multimak') || '{}');
        const payload = {
            categoria_gasto: formGasto.categoria_gasto,
            monto: parseInt(formGasto.monto, 10),
            fecha: formGasto.fecha,
            id_maquina: parseInt(formGasto.id_maquina, 10),
            numero_comprobante: formGasto.numero_comprobante.trim() || 'S/N',
            id_usuario: sesion.id_usuario || 1
        };

        try {
            if (editandoGastoId) {
                await axios.put(`/gastos/${editandoGastoId}/`, payload);
                setMensajeExito('Gasto operativo actualizado.');
            } else {
                await axios.post('/gastos/', payload);
                setMensajeExito('Gasto imputado a la maquinaria exitosamente.');
            }
            setMostrarModalGasto(false);
            cargarTodo();
        } catch {
            setError('Error al procesar el gasto operativo.');
        }
    };

    const eliminarGasto = async (id) => {
        if (!window.confirm(`Confirme la anulación del gasto #${id}:`)) return;
        try {
            await axios.delete(`/gastos/${id}/`);
            setMensajeExito('Gasto operativo eliminado.');
            cargarTodo();
        } catch {
            setError('No fue posible eliminar el comprobante de gasto.');
        }
    };

    const guardarContrato = async (e) => {
        e.preventDefault();
        if (!formContrato.id_cliente) {
            setError('Seleccione la empresa mandante del contrato.');
            return;
        }

        const payload = {
            id_cliente: parseInt(formContrato.id_cliente, 10),
            fecha_inicio: formContrato.fecha_inicio,
            fecha_fin: formContrato.fecha_fin || null,
            tarifa_hora: parseInt(formContrato.tarifa_hora, 10),
            estado_contrato: formContrato.estado_contrato
        };

        try {
            await axios.post('/contratos/', payload);
            setMensajeExito('Contrato comercial registrado exitosamente.');
            setMostrarModalContrato(false);
            cargarTodo();
        } catch {
            setError('Error al registrar el contrato comercial.');
        }
    };

    return (
        <div className="adm-view-container">
            {/* Encabezado con contexto operativo y selector de período */}
            <div className="adm-top-header">
                <div className="adm-title-block">
                    <span className="adm-kpi-sub">Sistema Integrado de Control</span>
                    <h1 className="adm-page-title">Administración y Operación Central</h1>
                    <p className="adm-page-desc">
                        Disponibilidad de flota, mantenciones técnicas y conciliación de partes de faena.
                    </p>
                </div>

                <div className="adm-period-controls">
                    <div className="adm-period-selector">
                        <span className="adm-period-label">Período Operativo:</span>
                        <select className="adm-select-period" defaultValue="mes_actual">
                            <option value="mes_actual">Mes Actual (Octubre 2026)</option>
                            <option value="mes_anterior">Mes Anterior (Septiembre 2026)</option>
                            <option value="historico">Histórico Acumulado</option>
                        </select>
                    </div>

                    <button className="adm-btn-refresh" onClick={cargarTodo} title="Sincronizar datos con el servidor">
                        <span style={{ fontSize: '13px' }}>↻</span> Actualizar
                    </button>
                </div>
            </div>

            {mensajeExito && <div className="adm-alert-ok">{mensajeExito}</div>}
            {error && <div className="adm-alert-fail">{error}</div>}

            {/* Navegación por pestañas sobria y continua */}
            <nav className="adm-nav-group">
                <button
                    type="button"
                    className={`adm-nav-btn ${tabActiva === 'dashboard' ? 'active' : ''}`}
                    onClick={() => setTabActiva('dashboard')}
                >
                    Dashboard & KPIs
                </button>
                <button
                    type="button"
                    className={`adm-nav-btn ${tabActiva === 'maquinarias' ? 'active' : ''}`}
                    onClick={() => setTabActiva('maquinarias')}
                >
                    Maquinarias <span className="adm-nav-badge">{totalEquipos}</span>
                </button>
                <button
                    type="button"
                    className={`adm-nav-btn ${tabActiva === 'operadores' ? 'active' : ''}`}
                    onClick={() => setTabActiva('operadores')}
                >
                    Operadores <span className="adm-nav-badge">{operadores.length}</span>
                </button>
                <button
                    type="button"
                    className={`adm-nav-btn ${tabActiva === 'contratos' ? 'active' : ''}`}
                    onClick={() => setTabActiva('contratos')}
                >
                    Contratos <span className="adm-nav-badge">{contratos.length}</span>
                </button>
                <button
                    type="button"
                    className={`adm-nav-btn ${tabActiva === 'gastos' ? 'active' : ''}`}
                    onClick={() => setTabActiva('gastos')}
                >
                    Gastos <span className="adm-nav-badge">{gastos.length}</span>
                </button>
                <button
                    type="button"
                    className={`adm-nav-btn ${tabActiva === 'turnos' ? 'active' : ''}`}
                    onClick={() => setTabActiva('turnos')}
                >
                    Partes Diarios <span className="adm-nav-badge">{reportes.length}</span>
                </button>
            </nav>

            {/* ==============================================================
          TAB 1: DASHBOARD Y KPIS
          ============================================================== */}
            {tabActiva === 'dashboard' && (
                <div className="adm-tab-content">
                    <div className="adm-kpi-grid">
                        <div className="adm-kpi-card highlight">
                            <span className="adm-kpi-sub">Disponibilidad de Flota</span>
                            <div className="adm-kpi-value">{disponibilidadFlota}%</div>
                            <span className="adm-kpi-foot">{totalEquipos - enTaller} de {totalEquipos} máquinas operativas</span>
                        </div>

                        <div className="adm-kpi-card">
                            <span className="adm-kpi-sub">Contratos en Ejecución</span>
                            <div className="adm-kpi-value">{contratos.length}</div>
                            <span className="adm-kpi-foot">Obras y faenas comerciales vigentes</span>
                        </div>

                        <div className="adm-kpi-card">
                            <span className="adm-kpi-sub">Total Gastos Operativos</span>
                            <div className="adm-kpi-value" style={{ color: '#b91c1c' }}>
                                ${totalGastos.toLocaleString('es-CL')}
                            </div>
                            <span className="adm-kpi-foot">Combustible, repuestos y compras de faena</span>
                        </div>

                        <div className={`adm-kpi-card ${maquinasConAlerta.length > 0 ? 'alert-card' : ''}`}>
                            <span className="adm-kpi-sub">Alertas de Mantención</span>
                            <div className="adm-kpi-value">{maquinasConAlerta.length}</div>
                            <span className="adm-kpi-foot">Próximos a servicio técnico</span>
                        </div>
                    </div>

                    <div className="adm-dash-grid">
                        {/* Panel Izquierdo: Rendimiento Humano de Operadores */}
                        <div className="adm-card">
                            <div className="adm-card-head">
                                <div>
                                    <h3 className="adm-card-title">Rendimiento Operativo por Conductor</h3>
                                    <p className="adm-card-sub">Horas computadas en faena según partes diarios firmados.</p>
                                </div>
                                <span className="adm-nav-badge">{horasPorOperador.length} conductores</span>
                            </div>

                            <div className="adm-table-wrap">
                                <table className="adm-table">
                                    <thead>
                                        <tr>
                                            <th>Operador</th>
                                            <th>RUT</th>
                                            <th>Licencia</th>
                                            <th>Turnos</th>
                                            <th style={{ textAlign: 'right' }}>Horas Totales</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {horasPorOperador.map(op => (
                                            <tr key={op.id}>
                                                <td><strong>{op.nombre}</strong></td>
                                                <td><span className="adm-code-tag">{op.rut}</span></td>
                                                <td><span className="adm-tag-amber">{op.licencia}</span></td>
                                                <td>{op.turnos} partes</td>
                                                <td style={{ textAlign: 'right', fontWeight: '800', color: op.horas > 0 ? '#b45309' : '#64748b' }}>
                                                    {op.horas} hrs
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Panel Derecho: Control Preventivo de Equipos */}
                        <div className="adm-card">
                            <div className="adm-card-head">
                                <div>
                                    <h3 className="adm-card-title">Control Preventivo de Equipos (500h / 1.000h)</h3>
                                    <p className="adm-card-sub">Alertas automáticas para coordinar taller antes de fallas en obra.</p>
                                </div>
                                <span className="adm-nav-badge">{totalEquipos} máquinas</span>
                            </div>

                            <div className="adm-fleet-list">
                                {analisisMantenciones.map((m) => (
                                    <div
                                        key={m.id_maquina}
                                        className={`adm-fleet-item ${m.nivelAlerta === 'REQUIERE_TALLER'
                                                ? 'fleet-alert-critical'
                                                : m.nivelAlerta === 'ALERTA_PREVENTIVA' || m.nivelAlerta === 'ATENCION'
                                                    ? 'fleet-alert-warning'
                                                    : ''
                                            }`}
                                    >
                                        <div className="adm-fleet-info" style={{ flex: 1 }}>
                                            <span className="adm-fleet-badge">{m.patente}</span>
                                            <div style={{ flex: 1, paddingRight: '12px' }}>
                                                <strong>{m.marca} {m.modelo}</strong>
                                                <span className="adm-fleet-type">{m.tipo} | {m.detalleAlerta}</span>

                                                <div className="adm-progress-bg">
                                                    <div
                                                        className={`adm-progress-bar ${m.porcentajeUso >= 95 ? 'bar-red' : m.porcentajeUso >= 80 ? 'bar-amber' : 'bar-green'
                                                            }`}
                                                        style={{ width: `${m.porcentajeUso}%` }}
                                                    />
                                                </div>
                                                <span className="adm-progress-text">
                                                    Pauta objetivo: <strong>{m.proximaPauta} hrs</strong> (Faltan {m.horasRestantes} hrs)
                                                </span>
                                            </div>
                                        </div>
                                        <div className="adm-fleet-horo">
                                            <span>Horómetro actual</span>
                                            <strong>{m.horometroNum.toFixed(1)} hrs</strong>
                                            {m.nivelAlerta === 'REQUIERE_TALLER' && <span className="adm-badge-red">INGRESO A TALLER</span>}
                                            {m.nivelAlerta === 'ALERTA_PREVENTIVA' && <span className="adm-badge-red">ALERTA 50h PREVIA</span>}
                                            {m.nivelAlerta === 'ATENCION' && <span className="adm-badge-amber">ATENCIÓN (900h+)</span>}
                                            {m.nivelAlerta === 'OPERATIVA' && <span className="adm-badge-green">OPERATIVA</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ==============================================================
          TAB 2: CRUD DE MAQUINARIAS
          ============================================================== */}
            {tabActiva === 'maquinarias' && (
                <div className="adm-tab-content">
                    <div className="adm-action-bar">
                        <h2>Inventario de Maquinarias</h2>
                        <div className="adm-action-tools">
                            <div className="adm-search-wrap">
                                <input
                                    type="text"
                                    className="adm-search-input"
                                    placeholder="Buscar por patente, marca o modelo..."
                                    value={busquedaMaq}
                                    onChange={(e) => setBusquedaMaq(e.target.value)}
                                />
                                {busquedaMaq && (
                                    <button className="adm-search-clear" onClick={() => setBusquedaMaq('')}>×</button>
                                )}
                            </div>

                            <button className="adm-btn-primary" onClick={() => abrirFormMaquinaria()}>
                                {mostrarModalMaq ? 'Cerrar Formulario' : 'Registrar Maquinaria'}
                            </button>
                        </div>
                    </div>

                    {mostrarModalMaq && (
                        <div className="adm-card adm-form-box">
                            <h3 className="adm-card-title">{editandoMaqId ? `Modificar Equipo #${editandoMaqId}` : 'Alta de Nuevo Equipo'}</h3>
                            <form onSubmit={guardarMaquinaria} className="adm-crud-form">
                                <div className="adm-grid-3">
                                    <div className="adm-field">
                                        <label>Patente / Identificador</label>
                                        <input
                                            type="text"
                                            placeholder="Ej: AB-CD-12"
                                            value={formMaq.patente}
                                            onChange={e => setFormMaq({ ...formMaq, patente: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="adm-field">
                                        <label>Marca</label>
                                        <input
                                            type="text"
                                            placeholder="Ej: Caterpillar"
                                            value={formMaq.marca}
                                            onChange={e => setFormMaq({ ...formMaq, marca: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="adm-field">
                                        <label>Modelo</label>
                                        <input
                                            type="text"
                                            placeholder="Ej: 320D"
                                            value={formMaq.modelo}
                                            onChange={e => setFormMaq({ ...formMaq, modelo: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="adm-grid-3" style={{ marginTop: '14px' }}>
                                    <div className="adm-field">
                                        <label>Tipo de Maquinaria</label>
                                        <select
                                            value={formMaq.tipo}
                                            onChange={e => setFormMaq({ ...formMaq, tipo: e.target.value })}
                                        >
                                            <option value="Excavadora">Excavadora</option>
                                            <option value="Minicargador">Minicargador</option>
                                            <option value="Retroexcavadora">Retroexcavadora</option>
                                            <option value="Cargador Frontal">Cargador Frontal</option>
                                            <option value="Motoniveladora">Motoniveladora</option>
                                            <option value="Camión Tolva">Camión Tolva</option>
                                        </select>
                                    </div>
                                    <div className="adm-field">
                                        <label>Horómetro Actual (hrs)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            placeholder="Ej: 1450.0"
                                            value={formMaq.horometro_actual}
                                            onChange={e => setFormMaq({ ...formMaq, horometro_actual: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="adm-field">
                                        <label>Estado Operativo</label>
                                        <select
                                            value={formMaq.estado}
                                            onChange={e => setFormMaq({ ...formMaq, estado: e.target.value })}
                                        >
                                            <option value="Disponible">Disponible</option>
                                            <option value="En Faena">En Faena</option>
                                            <option value="En Taller">En Taller</option>
                                            <option value="Requiere Mantención">Requiere Mantención</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="adm-form-actions">
                                    <button type="submit" className="adm-btn-submit">
                                        {editandoMaqId ? 'Guardar Modificaciones' : 'Registrar Equipo en BD'}
                                    </button>
                                    <button type="button" className="adm-btn-secondary" onClick={() => setMostrarModalMaq(false)}>
                                        Cancelar
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div className="adm-card">
                        <div className="adm-table-wrap">
                            <table className="adm-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Patente</th>
                                        <th>Marca y Modelo</th>
                                        <th>Tipo</th>
                                        <th>Horómetro Registrado</th>
                                        <th>Estado</th>
                                        <th style={{ textAlign: 'center', width: '90px' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {maquinariasFiltradas.map(m => (
                                        <tr key={m.id_maquina}>
                                            <td>#{m.id_maquina}</td>
                                            <td><strong>{m.patente}</strong></td>
                                            <td>{m.marca} {m.modelo}</td>
                                            <td><span className="adm-tag">{m.tipo}</span></td>
                                            <td style={{ fontWeight: '800' }}>{(m.horometro_actual ?? m.horometro ?? 0)} hrs</td>
                                            <td>
                                                <span className={m.estado === 'En Faena' ? 'adm-tag-amber' : 'adm-tag'}>
                                                    {m.estado || 'Disponible'}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                <button
                                                    className="adm-action-btn edit"
                                                    onClick={() => abrirFormMaquinaria(m)}
                                                    title="Editar maquinaria"
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M12 20h9" />
                                                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    className="adm-action-btn delete"
                                                    onClick={() => eliminarMaquinaria(m.id_maquina)}
                                                    title="Eliminar de la flota"
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="3 6 5 6 21 6" />
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                        <line x1="10" y1="11" x2="10" y2="17" />
                                                        <line x1="14" y1="11" x2="14" y2="17" />
                                                    </svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {maquinariasFiltradas.length === 0 && (
                                        <tr>
                                            <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                                                {busquedaMaq ? `No se encontraron maquinarias para "${busquedaMaq}".` : 'No hay maquinarias registradas.'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ==============================================================
          TAB 3: CRUD DE OPERADORES
          ============================================================== */}
            {tabActiva === 'operadores' && (
                <div className="adm-tab-content">
                    <div className="adm-action-bar">
                        <h2>Nómina de Operadores Acreditados</h2>
                        <div className="adm-action-tools">
                            <div className="adm-search-wrap">
                                <input
                                    type="text"
                                    className="adm-search-input"
                                    placeholder="Buscar por nombre, RUT o licencia..."
                                    value={busquedaOp}
                                    onChange={(e) => setBusquedaOp(e.target.value)}
                                />
                                {busquedaOp && (
                                    <button className="adm-search-clear" onClick={() => setBusquedaOp('')}>×</button>
                                )}
                            </div>

                            <button className="adm-btn-primary" onClick={() => abrirFormOperador()}>
                                {mostrarModalOp ? 'Cerrar Formulario' : 'Registrar Operador'}
                            </button>
                        </div>
                    </div>

                    {mostrarModalOp && (
                        <div className="adm-card adm-form-box">
                            <h3 className="adm-card-title">{editandoOpId ? `Modificar Operador #${editandoOpId}` : 'Ficha de Operador'}</h3>
                            <form onSubmit={guardarOperador} className="adm-crud-form">
                                <div className="adm-grid-3">
                                    <div className="adm-field">
                                        <label>Usuario del Sistema</label>
                                        <select
                                            value={formOp.id_usuario}
                                            onChange={e => setFormOp({ ...formOp, id_usuario: e.target.value })}
                                            disabled={Boolean(editandoOpId)}
                                            required
                                        >
                                            <option value="">Seleccione cuenta...</option>
                                            {usuariosDisponibles.map(u => (
                                                <option key={u.id_usuario} value={u.id_usuario}>
                                                    {u.nombre} ({u.rut})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="adm-field">
                                        <label>Tipo de Licencia</label>
                                        <select
                                            value={formOp.TipoLicencia}
                                            onChange={e => setFormOp({ ...formOp, TipoLicencia: e.target.value })}
                                        >
                                            <option value="Clase D">Clase D (Maquinaria Pesada)</option>
                                            <option value="Clase A4">Clase A4 (Carga Simple)</option>
                                            <option value="Clase A5">Clase A5 (Articulados)</option>
                                            <option value="Clase B">Clase B (Vehículos Menores)</option>
                                        </select>
                                    </div>
                                    <div className="adm-field">
                                        <label>Fecha de Vencimiento</label>
                                        <input
                                            type="date"
                                            value={formOp.fecha_vencimiento_licencia}
                                            onChange={e => setFormOp({ ...formOp, fecha_vencimiento_licencia: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="adm-form-actions">
                                    <button type="submit" className="adm-btn-submit">
                                        {editandoOpId ? 'Actualizar Operador' : 'Habilitar Operador'}
                                    </button>
                                    <button type="button" className="adm-btn-secondary" onClick={() => setMostrarModalOp(false)}>
                                        Cancelar
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div className="adm-card">
                        <div className="adm-table-wrap">
                            <table className="adm-table">
                                <thead>
                                    <tr>
                                        <th>ID</th>
                                        <th>Nombre Operador</th>
                                        <th>RUT</th>
                                        <th>Tipo Licencia</th>
                                        <th>Vencimiento</th>
                                        <th>Condición Operativa</th>
                                        <th style={{ textAlign: 'center', width: '90px' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {operadoresFiltrados.map(op => {
                                        const fVenc = op.fecha_vencimiento_licencia ? new Date(op.fecha_vencimiento_licencia) : null;
                                        const vencida = fVenc && fVenc < hoyDate;
                                        return (
                                            <tr key={op.id_operador}>
                                                <td>#{op.id_operador}</td>
                                                <td><strong>{op.id_usuario?.nombre || 'Operador'}</strong></td>
                                                <td><span className="adm-code-tag">{op.id_usuario?.rut || op.rut || 'N/A'}</span></td>
                                                <td><span className="adm-tag-amber">{op.TipoLicencia || 'Clase D'}</span></td>
                                                <td>{op.fecha_vencimiento_licencia || 'Indefinida'}</td>
                                                <td>
                                                    {vencida ? (
                                                        <span className="adm-badge-red">Licencia Vencida</span>
                                                    ) : (
                                                        <span className="adm-badge-green">Habilitado para Faena</span>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                    <button
                                                        className="adm-action-btn edit"
                                                        onClick={() => abrirFormOperador(op)}
                                                        title="Editar operador"
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M12 20h9" />
                                                            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        className="adm-action-btn delete"
                                                        onClick={() => eliminarOperador(op.id_operador)}
                                                        title="Eliminar operador"
                                                    >
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="3 6 5 6 21 6" />
                                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                            <line x1="10" y1="11" x2="10" y2="17" />
                                                            <line x1="14" y1="11" x2="14" y2="17" />
                                                        </svg>
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {operadoresFiltrados.length === 0 && (
                                        <tr>
                                            <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                                                {busquedaOp ? `No se encontraron operadores para "${busquedaOp}".` : 'No hay operadores registrados.'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ==============================================================
          TAB 4: CRUD DE CONTRATOS
          ============================================================== */}
            {tabActiva === 'contratos' && (
                <div className="adm-tab-content">
                    <div className="adm-action-bar">
                        <h2>Contratos Comerciales de Arriendo</h2>
                        <button className="adm-btn-primary" onClick={() => setMostrarModalContrato(!mostrarModalContrato)}>
                            {mostrarModalContrato ? 'Cerrar Formulario' : 'Nuevo Contrato de Obra'}
                        </button>
                    </div>

                    {mostrarModalContrato && (
                        <div className="adm-card adm-form-box">
                            <h3 className="adm-card-title">Apertura de Contrato de Arriendo</h3>
                            <form onSubmit={guardarContrato} className="adm-crud-form">
                                <div className="adm-grid-3">
                                    <div className="adm-field">
                                        <label>Empresa Mandante / Cliente</label>
                                        <select
                                            value={formContrato.id_cliente}
                                            onChange={e => setFormContrato({ ...formContrato, id_cliente: e.target.value })}
                                            required
                                        >
                                            <option value="">Seleccione cliente...</option>
                                            {clientes.map(c => (
                                                <option key={c.id_cliente} value={c.id_cliente}>
                                                    {c.razon_social} ({c.rut})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="adm-field">
                                        <label>Tarifa por Hora ($CLP / hr)</label>
                                        <input
                                            type="number"
                                            value={formContrato.tarifa_hora}
                                            onChange={e => setFormContrato({ ...formContrato, tarifa_hora: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div className="adm-field">
                                        <label>Estado del Contrato</label>
                                        <select
                                            value={formContrato.estado_contrato}
                                            onChange={e => setFormContrato({ ...formContrato, estado_contrato: e.target.value })}
                                        >
                                            <option value="Activo">Activo / En Ejecución</option>
                                            <option value="Finalizado">Finalizado</option>
                                            <option value="Suspendido">Suspendido</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="adm-grid-3" style={{ marginTop: '14px' }}>
                                    <div className="adm-field">
                                        <label>Fecha de Inicio de Faena</label>
                                        <input
                                            type="date"
                                            value={formContrato.fecha_inicio}
                                            onChange={e => setFormContrato({ ...formContrato, fecha_inicio: e.target.value })}
                                            required
                                        />
                                    </div>

                                    <div className="adm-field">
                                        <label>Fecha Estimada de Término</label>
                                        <input
                                            type="date"
                                            value={formContrato.fecha_fin}
                                            onChange={e => setFormContrato({ ...formContrato, fecha_fin: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="adm-form-actions">
                                    <button type="submit" className="adm-btn-submit">Registrar Contrato</button>
                                    <button type="button" className="adm-btn-secondary" onClick={() => setMostrarModalContrato(false)}>
                                        Cancelar
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div className="adm-card">
                        <div className="adm-table-wrap">
                            <table className="adm-table">
                                <thead>
                                    <tr>
                                        <th>ID Contrato</th>
                                        <th>Cliente Mandante</th>
                                        <th>Tarifa por Hora</th>
                                        <th>Fecha Inicio</th>
                                        <th>Fecha Término</th>
                                        <th>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {contratos.map(c => (
                                        <tr key={c.id_contrato}>
                                            <td>#{c.id_contrato}</td>
                                            <td><strong>{c.id_cliente?.razon_social || `Cliente #${c.id_cliente}`}</strong></td>
                                            <td style={{ fontWeight: '800', color: '#b45309' }}>
                                                ${parseInt(c.tarifa_hora, 10).toLocaleString('es-CL')} / hr
                                            </td>
                                            <td>{c.fecha_inicio}</td>
                                            <td>{c.fecha_fin || 'Vigente'}</td>
                                            <td>
                                                <span className={c.estado_contrato === 'Activo' ? 'adm-badge-green' : 'adm-tag'}>
                                                    {c.estado_contrato || 'Activo'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                    {contratos.length === 0 && (
                                        <tr>
                                            <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                                                No se registran contratos comerciales activos en el sistema.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ==============================================================
          TAB 5: CRUD DE GASTOS
          ============================================================== */}
            {tabActiva === 'gastos' && (
                <div className="adm-tab-content">
                    <div className="adm-action-bar">
                        <h2>Control y Rendición de Gastos en Faena</h2>
                        <div className="adm-action-tools">
                            <div className="adm-search-wrap">
                                <input
                                    type="text"
                                    className="adm-search-input"
                                    placeholder="Buscar por categoría, comprobante o máquina..."
                                    value={busquedaGasto}
                                    onChange={(e) => setBusquedaGasto(e.target.value)}
                                />
                                {busquedaGasto && (
                                    <button className="adm-search-clear" onClick={() => setBusquedaGasto('')}>×</button>
                                )}
                            </div>

                            <button className="adm-btn-primary" onClick={() => abrirFormGasto()}>
                                {mostrarModalGasto ? 'Cerrar Formulario' : 'Imputar Nuevo Gasto'}
                            </button>
                        </div>
                    </div>

                    {mostrarModalGasto && (
                        <div className="adm-card adm-form-box">
                            <h3 className="adm-card-title">{editandoGastoId ? `Modificar Gasto #${editandoGastoId}` : 'Registro de Desembolso Operativo'}</h3>
                            <form onSubmit={guardarGasto} className="adm-crud-form">
                                <div className="adm-grid-3">
                                    <div className="adm-field">
                                        <label>Categoría del Gasto</label>
                                        <select
                                            value={formGasto.categoria_gasto}
                                            onChange={e => setFormGasto({ ...formGasto, categoria_gasto: e.target.value })}
                                        >
                                            <option value="Combustible">Combustible / Diesel</option>
                                            <option value="Repuesto">Repuestos y Componentes</option>
                                            <option value="Viatico">Viáticos de Operación</option>
                                            <option value="Lubricante">Lubricantes y Filtros</option>
                                        </select>
                                    </div>
                                    <div className="adm-field">
                                        <label>Monto Total ($CLP)</label>
                                        <input
                                            type="number"
                                            placeholder="Ej: 65000"
                                            value={formGasto.monto}
                                            onChange={e => setFormGasto({ ...formGasto, monto: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="adm-field">
                                        <label>Equipo Imputado</label>
                                        <select
                                            value={formGasto.id_maquina}
                                            onChange={e => setFormGasto({ ...formGasto, id_maquina: e.target.value })}
                                            required
                                        >
                                            <option value="">Seleccione equipo...</option>
                                            {maquinarias.map(m => (
                                                <option key={m.id_maquina} value={m.id_maquina}>
                                                    {m.patente} — {m.marca} {m.modelo}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="adm-grid-3" style={{ marginTop: '14px' }}>
                                    <div className="adm-field">
                                        <label>Fecha de Emisión</label>
                                        <input
                                            type="date"
                                            value={formGasto.fecha}
                                            onChange={e => setFormGasto({ ...formGasto, fecha: e.target.value })}
                                        />
                                    </div>
                                    <div className="adm-field">
                                        <label>N° Folio Comprobante / Factura</label>
                                        <input
                                            type="text"
                                            placeholder="Ej: B-12940"
                                            value={formGasto.numero_comprobante}
                                            onChange={e => setFormGasto({ ...formGasto, numero_comprobante: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="adm-form-actions">
                                    <button type="submit" className="adm-btn-submit">
                                        {editandoGastoId ? 'Guardar Cambios' : 'Imputar Gasto'}
                                    </button>
                                    <button type="button" className="adm-btn-secondary" onClick={() => setMostrarModalGasto(false)}>
                                        Cancelar
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div className="adm-card">
                        <div className="adm-table-wrap">
                            <table className="adm-table">
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Categoría</th>
                                        <th>Comprobante</th>
                                        <th>Equipo Imputado</th>
                                        <th style={{ textAlign: 'right' }}>Monto ($CLP)</th>
                                        <th style={{ textAlign: 'center', width: '90px' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {gastosFiltrados.map(g => (
                                        <tr key={g.id_gasto}>
                                            <td>{g.fecha}</td>
                                            <td><span className="adm-tag">{g.categoria_gasto}</span></td>
                                            <td><span className="adm-code-tag">{g.numero_comprobante || 'S/N'}</span></td>
                                            <td>Máquina ID #{g.id_maquina}</td>
                                            <td style={{ textAlign: 'right', fontWeight: '800', color: '#991b1b' }}>
                                                ${parseInt(g.monto, 10).toLocaleString('es-CL')}
                                            </td>
                                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                <button
                                                    className="adm-action-btn edit"
                                                    onClick={() => abrirFormGasto(g)}
                                                    title="Editar gasto"
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M12 20h9" />
                                                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    className="adm-action-btn delete"
                                                    onClick={() => eliminarGasto(g.id_gasto)}
                                                    title="Eliminar comprobante"
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <polyline points="3 6 5 6 21 6" />
                                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                                        <line x1="10" y1="11" x2="10" y2="17" />
                                                        <line x1="14" y1="11" x2="14" y2="17" />
                                                    </svg>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {gastosFiltrados.length === 0 && (
                                        <tr>
                                            <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                                                {busquedaGasto ? `No se encontraron gastos para "${busquedaGasto}".` : 'No hay gastos registrados.'}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* ==============================================================
          TAB 6: PARTES DIARIOS
          ============================================================== */}
            {tabActiva === 'turnos' && (
                <div className="adm-tab-content">
                    <div className="adm-action-bar">
                        <h2>Auditoría y Conciliación de Partes Diarios</h2>
                    </div>

                    <div className="adm-card">
                        <div className="adm-table-wrap">
                            <table className="adm-table">
                                <thead>
                                    <tr>
                                        <th>ID Parte</th>
                                        <th>Fecha</th>
                                        <th>Horario Faena</th>
                                        <th>Horómetros (Inicial - Final)</th>
                                        <th>Horas Computadas</th>
                                        <th>Diesel (Litros)</th>
                                        <th>Certificación en Obra</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportes.map(r => (
                                        <tr key={r.id_report}>
                                            <td>#{r.id_report}</td>
                                            <td>{r.fecha}</td>
                                            <td>{r.hora_entrada} - {r.hora_salida}</td>
                                            <td>{r.horometro_inicial} hrs - {r.horometro_final} hrs</td>
                                            <td style={{ fontWeight: '800', color: '#b45309' }}>{r.horas_trabajadas} hrs</td>
                                            <td>{r.combustible_litros ? `${r.combustible_litros} L` : '0 L'}</td>
                                            <td>
                                                {r.firmado ? (
                                                    <span className="adm-badge-green">Certificado</span>
                                                ) : (
                                                    <span className="adm-badge-red">Pendiente</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {reportes.length === 0 && (
                                        <tr>
                                            <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                                                No se registran partes diarios en la base de datos.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}