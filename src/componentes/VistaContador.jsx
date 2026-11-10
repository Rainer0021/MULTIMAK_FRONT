import React, { useState, useEffect } from 'react';
import axios from '../api/axios'; 
import '../styles/VistaContador.css';
import { subirArchivoAS3, obtenerUrlLecturaS3 } from '../utils/s3Uploader';

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

// TELÉFONO 
const soloDigitosTelefonoCL = (valor) => {
    let d = String(valor || '').replace(/\D/g, '');
    if (d.length === 11 && d.startsWith('56')) d = d.slice(2);
    return d;
};

const validarTelefonoCL = (valor) => {
    const d = soloDigitosTelefonoCL(valor);
    if (d.length !== 9 || /^(\d)\1+$/.test(d)) return false;
    return /^9\d{8}$/.test(d) || /^[2-7]\d{8}$/.test(d);
};

const formatearTelefonoCL = (valor) => {
    const d = soloDigitosTelefonoCL(valor);
    if (d.length !== 9) return valor;
    if (d.startsWith('9')) return `+56 9 ${d.slice(1, 5)} ${d.slice(5)}`;
    if (d.startsWith('2')) return `+56 2 ${d.slice(1, 5)} ${d.slice(5)}`;
    return `+56 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`;
};

const hoyLocalISO = () => new Date().toLocaleDateString('en-CA');

const aFechaLocal = (iso) => {
    const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    return new Date(a, m - 1, d);
};

const formatoFechaCL = (iso) => {
    if (!iso) return '';
    const [a, m, d] = String(iso).slice(0, 10).split('-');
    return `${d}-${m}-${a}`;
};

const ESTADOS_CONTRATO_VIGENTES = ['ACTIVO', 'PRORROGADO'];
const nombreDeContrato = (c) => c.nombre_contrato || `Contrato #${c.id_contrato}`;

const buscarChoqueMaquina = (contratos, idMaquina, inicio, fin, excluirIdContrato = null) => {
    return (contratos || []).find((c) => {
        if (c.activo === false) return false;
        if (excluirIdContrato !== null && String(c.id_contrato) === String(excluirIdContrato)) return false;
        if (!ESTADOS_CONTRATO_VIGENTES.includes(String(c.estado_contrato || 'ACTIVO').toUpperCase())) return false;
        const laUsa = (c.maquinas_contrato || []).some((r) => String(r.id_maquina) === String(idMaquina));
        if (!laUsa) return false;
        const cIni = c.fecha_inicio || null;
        const cFin = c.fecha_fin || null;
        const empiezaAntesDeQueTermine = !cIni || !fin || cIni <= fin;
        const terminaDespuesDeQueEmpiece = !cFin || !inicio || inicio <= cFin;
        return empiezaAntesDeQueTermine && terminaDespuesDeQueEmpiece;
    }) || null;
};

const extraerErrorApi = (err, defecto) => {
    const d = err && err.response && err.response.data;
    if (!d) return defecto;
    if (typeof d === 'string') return d.length < 200 ? d : defecto;
    const partes = Object.values(d).flat().map((x) => (typeof x === 'string' ? x : JSON.stringify(x)));
    return partes.length ? partes.join(' ') : defecto;
};


export default function VistaContador({ modoNoche }) {
    const fechaHoy = hoyLocalISO();

    const [gastos, setGastos] = useState([]);
    const [reportes, setReportes] = useState([]);
    const [maquinarias, setMaquinarias] = useState([]);
    const [contratos, setContratos] = useState([]);
    const [clientes, setClientes] = useState([]);
    const [hesList, setHesList] = useState([]);
    const [facturas, setFacturas] = useState([]);
    const [docsEmpresa, setDocsEmpresa] = useState([]);

    const [cargando, setCargando] = useState(true);
    const [mensaje, setMensaje] = useState({ texto: '', tipo: '' });

    const [filtroTipo, setFiltroTipo] = useState('todos');
    const [busqueda, setBusqueda] = useState('');
    const [busquedaContratoContador, setBusquedaContratoContador] = useState('');
    const [pestaña, setPestaña] = useState('facturacion_hes');

    const [mostrarFormContrato, setMostrarFormContrato] = useState(false);

    const [formContrato, setFormContrato] = useState({
        nombre_contrato: '',
        id_cliente: '',
        fecha_inicio: fechaHoy,
        fecha_fin: '',
        estado_contrato: 'ACTIVO',
        maquinas_asignadas: [
            { id_maquina: '', tarifa_hora: '' }
        ]
    });

    const [erroresFormContrato, setErroresFormContrato] = useState({});

    // Modales de Trabajo y Formulario Factura / HES (incluyendo archivoHES)
    const [modalHes, setModalHes] = useState({ abierto: false, idContrato: '', numeroHes: '', totalHoras: '', estado: 'APROBADA', archivoHES: null });
    const [modalFactura, setModalFactura] = useState({ abierto: false, idHes: '', folioDTE: '', montoNeto: '', iva: 0, montoTotal: 0 });
    const [modalProrroga, setModalProrroga] = useState({ abierto: false, idContrato: null, nuevaFechaFin: '' });
    const [modalDoc, setModalDoc] = useState({ abierto: false, url: '', titulo: '', subtitulo: '', esPdf: false });

    // Carpeta Tributaria Digital
    const [archivoDocEmpresa, setArchivoDocEmpresa] = useState(null);
    const [nombreDocEmpresa, setNombreDocEmpresa] = useState('');


    const cargarDatosFinancieros = async () => {
        setCargando(true);
        try {
            const [resGas, resRep, resMaq, resCont, resCli, resHes, resFact, resDocs] = await Promise.all([
                axios.get('/gastos/').catch(() => axios.get('/gastos/')).catch(() => ({ data: [] })),
                axios.get('/reports/').catch(() => axios.get('/reports/')).catch(() => ({ data: [] })),
                axios.get('/maquinarias/').catch(() => axios.get('/maquinarias/')).catch(() => ({ data: [] })),
                axios.get('/contratos/').catch(() => axios.get('/contratos/')).catch(() => ({ data: [] })),
                axios.get('/clientes/').catch(() => axios.get('/clientes/')).catch(() => ({ data: [] })),
                axios.get('/hes/').catch(() => axios.get('/hes/')).catch(() => ({ data: [] })),
                axios.get('/facturas/').catch(() => axios.get('/facturas/')).catch(() => ({ data: [] })),
                axios.get('/doc-empresa/').catch(() => axios.get('/doc-empresa/')).catch(() => ({ data: [] }))
            ]);

            setGastos(resGas.data?.results || (Array.isArray(resGas.data) ? resGas.data : []));
            setReportes(resRep.data?.results || (Array.isArray(resRep.data) ? resRep.data : []));
            setMaquinarias(resMaq.data?.results || (Array.isArray(resMaq.data) ? resMaq.data : []));
            setContratos(resCont.data?.results || (Array.isArray(resCont.data) ? resCont.data : []));
            setClientes(resCli.data?.results || (Array.isArray(resCli.data) ? resCli.data : []));
            setHesList(resHes.data?.results || (Array.isArray(resHes.data) ? resHes.data : []));
            setFacturas(resFact.data?.results || (Array.isArray(resFact.data) ? resFact.data : []));
            setDocsEmpresa(resDocs.data?.results || (Array.isArray(resDocs.data) ? resDocs.data : []));
        } catch (err) {
            console.error('No se pudieron cargar los datos contables.', err);
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarDatosFinancieros();
    }, []);

    const mostrarNotificacion = (texto, tipo = 'success') => {
        setMensaje({ texto, tipo });
        setTimeout(() => setMensaje({ texto: '', tipo: '' }), 4000);
    };

    const agregarFilaMaquina = () => {
        setFormContrato(prev => ({
            ...prev,
            maquinas_asignadas: [...prev.maquinas_asignadas, { id_maquina: '', tarifa_hora: '' }]
        }));
    };

    const eliminarFilaMaquina = (index) => {
        if (formContrato.maquinas_asignadas.length === 1) {
            mostrarNotificacion('Agrega al menos una maquinaria al contrato.', 'error');
            return;
        }
        setFormContrato(prev => ({
            ...prev,
            maquinas_asignadas: prev.maquinas_asignadas.filter((_, idx) => idx !== index)
        }));
    };

    const handleCambioMaquinaFila = (index, campo, valor) => {
        const nuevasMaquinas = [...formContrato.maquinas_asignadas];
        nuevasMaquinas[index][campo] = valor;
        setFormContrato(prev => ({ ...prev, maquinas_asignadas: nuevasMaquinas }));
    };

    const handleCrearContrato = async (e) => {
        e.preventDefault();
        const errores = {};

        if (!formContrato.id_cliente) errores.id_cliente = 'Selecciona un cliente';
        if (!formContrato.fecha_inicio) errores.fecha_inicio = 'Ingresa la fecha de inicio.';
        if (!formContrato.fecha_fin) errores.fecha_fin = 'Ingresa la fecha de término.';

        const erroresMaquinas = formContrato.maquinas_asignadas.map((m) => {
            const fila = { id_maquina: '', tarifa_hora: '', detalle: '' };
            if (!m.id_maquina) fila.id_maquina = 'Selecciona equipo';
            if (!m.tarifa_hora) fila.tarifa_hora = 'Ingresa tarifa';
            return fila;
        });

        if (Object.keys(errores).length > 0 || erroresMaquinas.some(m => m.id_maquina || m.tarifa_hora)) {
            setErroresFormContrato({ ...errores, maquinas: erroresMaquinas });
            mostrarNotificacion('Revisa los campos en rojo.', 'error');
            return;
        }

        try {
            const payloadContrato = {
                nombre_contrato: formContrato.nombre_contrato.trim(),
                id_cliente: parseInt(formContrato.id_cliente, 10),
                fecha_inicio: formContrato.fecha_inicio,
                fecha_fin: formContrato.fecha_fin || formContrato.fecha_inicio,
                estado_contrato: formContrato.estado_contrato
            };

            const resContrato = await axios.post('contratos/', payloadContrato).catch(() => axios.post('/contratos/', payloadContrato));
            const idNuevoContrato = resContrato.data?.id_contrato || resContrato.data?.id;

            if (idNuevoContrato) {
                const promesas = formContrato.maquinas_asignadas.map(m => 
                    axios.post('contrato-maquinarias/', {
                        id_contrato: idNuevoContrato,
                        id_maquina: parseInt(m.id_maquina, 10),
                        tarifa_hora: parseInt(m.tarifa_hora, 10)
                    }).catch(() => axios.post('/contrato-maquinarias/', {
                        id_contrato: idNuevoContrato,
                        id_maquina: parseInt(m.id_maquina, 10),
                        tarifa_hora: parseInt(m.tarifa_hora, 10)
                    }))
                );
                await Promise.all(promesas);
            }

            mostrarNotificacion('Contrato registrado correctamente.');
            setMostrarFormContrato(false);
            cargarDatosFinancieros();
        } catch (err) {
            mostrarNotificacion(extraerErrorApi(err, 'No se pudo guardar el contrato.'), 'error');
        }
    };

    const handleProrrogarContrato = async (e) => {
        e.preventDefault();
        if (!modalProrroga.nuevaFechaFin) {
            mostrarNotificacion('Selecciona la nueva fecha de término.', 'error');
            return;
        }
        try {
            const payload = { fecha_fin: modalProrroga.nuevaFechaFin, estado_contrato: 'PRORROGADO' };
            await axios.patch(`/contratos/${modalProrroga.idContrato}/`, payload).catch(() => axios.patch(`/contratos/${modalProrroga.idContrato}/`, payload));
            mostrarNotificacion('Prórroga guardada correctamente.');
            setModalProrroga({ abierto: false, idContrato: null, nuevaFechaFin: '' });
            cargarDatosFinancieros();
        } catch (err) {
            mostrarNotificacion('No se pudo aplicar la prórroga.', 'error');
        }
    };

    // REGISTRAR HES CON ARCHIVO OBLIGATORIO SUBIDO A S3 Y DESACTIVACIÓN AUTOMÁTICA DE REPORTES
    const handleRegistrarHES = async (e) => {
        e.preventDefault();
        if (!modalHes.numeroHes || !modalHes.idContrato) {
            mostrarNotificacion('Selecciona contrato e ingresa el número de HES.', 'error');
            return;
        }
        if (!modalHes.archivoHES) {
            mostrarNotificacion('Es obligatorio adjuntar el documento de la HES.', 'error');
            return;
        }

        try {
            // Sube el documento HES obligatorio a S3
            const urlS3Hes = await subirArchivoAS3(modalHes.archivoHES);

            const payload = {
                id_contrato: parseInt(modalHes.idContrato, 10),
                numero_hes: modalHes.numeroHes.trim(),
                total_horas_aprobadas: parseFloat(modalHes.totalHoras) || 0,
                fecha_emision: fechaHoy,
                estado: modalHes.estado,
                url_archivo: urlS3Hes // Almacena la URL segura de S3
            };

            // 1. Guardar HES en la API
            await axios.post('/hes/', payload).catch(() => axios.post('/hes/', payload));

            // 2. Desactivar automáticamente los reportes contabilizados de este contrato
            const reportesAfectados = reportes.filter(r => String(r.id_contrato) === String(modalHes.idContrato) && r.activo !== false);
            await Promise.all(
                reportesAfectados.map(r => 
                    axios.patch(`/reports/${r.id_report}/`, { activo: false }).catch(() => axios.patch(`/reports/${r.id_report}/`, { activo: false }))
                )
            );

            mostrarNotificacion(`HES N° ${modalHes.numeroHes} registrada en S3 y reportes desactivados.`);
            setModalHes({ abierto: false, idContrato: '', numeroHes: '', totalHoras: '', estado: 'APROBADA', archivoHES: null });
            cargarDatosFinancieros();
        } catch (err) {
            console.error('Error al registrar HES:', err);
            mostrarNotificacion('No se pudo registrar la HES o subir el archivo a S3.', 'error');
        }
    };

    const handleCambioMontoNeto = (valorNeto) => {
        const neto = parseInt(valorNeto, 10) || 0;
        const ivaCalculado = Math.round(neto * 0.19);
        const totalCalculado = neto + ivaCalculado;

        setModalFactura(prev => ({
            ...prev,
            montoNeto: valorNeto,
            iva: ivaCalculado,
            montoTotal: totalCalculado
        }));
    };

    const handleEmitirFactura = async (e) => {
        e.preventDefault();
        if (!modalFactura.folioDTE || !modalFactura.idHes) {
            mostrarNotificacion('Selecciona una HES aprobada e ingresa el folio DTE.', 'error');
            return;
        }

        const hesSeleccionada = hesList.find(h => String(h.id_hes) === String(modalFactura.idHes));
        if (hesSeleccionada && hesSeleccionada.estado.toUpperCase() !== 'APROBADA') {
            mostrarNotificacion(`Bloqueo: La HES N° ${hesSeleccionada.numero_hes} debe estar APROBADA.`, 'error');
            return;
        }

        try {
            const payload = {
                id_hes: parseInt(modalFactura.idHes, 10),
                folio: parseInt(modalFactura.folioDTE, 10),
                fecha_emision: fechaHoy,
                monto_neto: parseInt(modalFactura.montoNeto, 10),
                iva: parseInt(modalFactura.iva, 10),
                monto_total: parseInt(modalFactura.montoTotal, 10),
                estado_pago: 'EMITIDA'
            };
            await axios.post('/facturas/', payload).catch(() => axios.post('/facturas/', payload));
            mostrarNotificacion(`Factura Electrónica DTE N° ${modalFactura.folioDTE} emitida correctamente.`);
            setModalFactura({ abierto: false, idHes: '', folioDTE: '', montoNeto: '', iva: 0, montoTotal: 0 });
            cargarDatosFinancieros();
        } catch (err) {
            mostrarNotificacion('Error al emitir la factura electrónica.', 'error');
        }
    };

    const handleSubirDocEmpresa = async (e) => {
        e.preventDefault();
        if (!archivoDocEmpresa) {
            mostrarNotificacion('Selecciona un archivo PDF o imagen.', 'error');
            return;
        }
        if (!nombreDocEmpresa.trim()) {
            mostrarNotificacion('Ingresa el nombre o título del documento.', 'error');
            return;
        }

        try {
            const urlS3 = await subirArchivoAS3(archivoDocEmpresa);
            const sesionStorage = JSON.parse(localStorage.getItem('usuario_multimak') || '{}');
            const idRealUsuario = sesionStorage.id_usuario || sesionStorage.id;

            const payload = {
                tipo_documento: nombreDocEmpresa.trim(),
                fecha_emision: fechaHoy,
                fecha_carga: fechaHoy,
                url_archivo: urlS3, 
                id_usuario: idRealUsuario,
                activo: true
            };

            await axios.post('doc-empresa/', payload).catch(() => axios.post('/doc-empresa/', payload));
            
            mostrarNotificacion(`Documento [${nombreDocEmpresa}] agregado correctamente.`);
            setArchivoDocEmpresa(null);
            setNombreDocEmpresa('');
            cargarDatosFinancieros();
        } catch (err) {
            mostrarNotificacion('No se pudo subir el documento.', 'error');
        }
    };

    const abrirVisor = async ({ url, titulo, subtitulo }) => {
        if (!url) return;
        const urlSegura = await obtenerUrlLecturaS3(url);
        const urlNorm = normalizarUrl(urlSegura);
        setModalDoc({
            abierto: true,
            url: urlNorm,
            titulo: titulo || 'Documento Contable',
            subtitulo: subtitulo || '',
            esPdf: urlNorm.toLowerCase().includes('.pdf')
        });
    };

    const obtenerPatente = (idMaquina, detalle) => {
        if (detalle && detalle.patente) return detalle.patente;
        const encontrada = maquinarias.find((m) => m.id_maquina === idMaquina || m.id === idMaquina);
        return encontrada ? `${encontrada.patente} (${encontrada.tipo})` : `Equipo #${idMaquina || 'S/I'}`;
    };

    const obtenerMaquinasDeContrato = (cont) => {
        if (Array.isArray(cont.maquinas_contrato) && cont.maquinas_contrato.length > 0) {
            return cont.maquinas_contrato.map(m => ({
                patente: m.maquina_patente || `Equipo #${m.id_maquina}`,
                tipo: m.maquina_tipo || 'Equipo',
                tarifa: m.tarifa_hora || 0
            }));
        }
        return [{ patente: 'Sin equipo asignado', tipo: 'Equipo', tarifa: 0 }];
    };

    const resumenPorContrato = contratos.map((cont) => {
        const reportesAsociados = reportes.filter(
            (r) => String(r.id_contrato) === String(cont.id_contrato)
        );

        const totalHoras = reportesAsociados.reduce((acc, r) => acc + (parseFloat(r.horas_trabajadas) || 0), 0);
        const subtotal = reportesAsociados.reduce((acc, r) => acc + (parseFloat(r.ingreso_estimado) || 0), 0);
        const clienteObj = clientes.find(c => String(c.id_cliente || c.id) === String(cont.id_cliente));
        const clienteNombre = cont.cliente_nombre || clienteObj?.razon_social || clienteObj?.nombre || `Cliente #${cont.id_cliente}`;

        const hesAsociada = hesList.find(h => String(h.id_contrato?.id_contrato || h.id_contrato) === String(cont.id_contrato));

        return {
            id_contrato: cont.id_contrato,
            cliente: clienteNombre,
            listaMaquinas: obtenerMaquinasDeContrato(cont),
            totalHoras,
            subtotal,
            hes: hesAsociada,
            cantidadTurnos: reportesAsociados.length
        };
    });

    const totalGastosAcumulados = gastos.reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0);
    const gastosCombustible = gastos.filter((g) => (g.categoria_gasto || '').toLowerCase().includes('combus')).reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0);
    const gastosMantenimiento = gastos.filter((g) => {
        const t = (g.categoria_gasto || '').toLowerCase();
        return t.includes('mant') || t.includes('repuesto');
    }).reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0);

    const totalIngresosEstimados = resumenPorContrato.reduce((acc, c) => acc + c.subtotal, 0);
    const margenNeto = totalIngresosEstimados - totalGastosAcumulados;
    const margenPct = totalIngresosEstimados > 0 ? ((margenNeto / totalIngresosEstimados) * 100).toFixed(1) : '0.0';

    const gastosFiltrados = gastos.filter((g) => {
        const tipo = g.categoria_gasto || 'General';
        const coincideTipo = filtroTipo === 'todos' || tipo.toLowerCase() === filtroTipo.toLowerCase();
        const textoCompleto = `${g.descripcion || ''} ${tipo} ${g.numero_comprobante || ''}`.toLowerCase();
        return coincideTipo && textoCompleto.includes(busqueda.toLowerCase());
    });

    const contratosContadorFiltrados = contratos.filter(c => {
        const term = busquedaContratoContador.toLowerCase();
        const cliente = (c.cliente_nombre || c.razon_social || '').toLowerCase();
        const nombreCto = (c.nombre_contrato || '').toLowerCase();
        return cliente.includes(term) || nombreCto.includes(term);
    });

    return (
        <div className="cnt-view-container">
            <div className="cnt-top-header">
                <div>
                    <span className="cnt-header-tag">Departamento de finanzas • MULTIMAK 360</span>
                    <h1 className="cnt-header-title">Panel Contable y Liquidación de Faena</h1>
                </div>
                <button onClick={cargarDatosFinancieros} className="cnt-btn-sync">Actualizar</button>
            </div>

            {mensaje.texto && (
                <div className={`cnt-alert-banner ${mensaje.tipo}`}>
                    <span>{mensaje.texto}</span>
                    <button onClick={() => setMensaje({ texto: '', tipo: '' })} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
                </div>
            )}

            <div className="cnt-kpi-grid">
                <div className="cnt-kpi-card ingresos">
                    <span className="cnt-kpi-sub">Ingresos Brutos Faena</span>
                    <div className="cnt-kpi-value">${totalIngresosEstimados.toLocaleString('es-CL')}</div>
                </div>
                <div className="cnt-kpi-card gastos">
                    <span className="cnt-kpi-sub">Gasto Total de la Flota</span>
                    <div className="cnt-kpi-value">${totalGastosAcumulados.toLocaleString('es-CL')}</div>
                </div>
                <div className={`cnt-kpi-card ${margenNeto >= 0 ? 'margen-pos' : 'margen-neg'}`}>
                    <span className="cnt-kpi-sub">Margen Operativo Neto</span>
                    <div className="cnt-kpi-value">${Math.abs(margenNeto).toLocaleString('es-CL')}</div>
                    <span className="cnt-kpi-foot">Rentabilidad: <strong>{margenPct}%</strong></span>
                </div>
                <div className="cnt-kpi-card combustible">
                    <span className="cnt-kpi-sub">Combustible</span>
                    <div className="cnt-kpi-value">${gastosCombustible.toLocaleString('es-CL')}</div>
                </div>
                <div className="cnt-kpi-card mantenimiento">
                    <span className="cnt-kpi-sub">Taller y Repuestos</span>
                    <div className="cnt-kpi-value">${gastosMantenimiento.toLocaleString('es-CL')}</div>
                </div>
            </div>

            {/* NAVEGACIÓN DE PESTAÑAS */}
            <div className="cnt-nav-group">
                <button type="button" onClick={() => setPestaña('Gestion HES')} className={`cnt-nav-btn ${pestaña === 'Gestion HES' ? 'active' : ''}`}>
                    Gestion HES <span className="cnt-nav-badge">{resumenPorContrato.length}</span>
                </button>
                <button type="button" onClick={() => setPestaña('Facturacion')} className={`cnt-nav-btn ${pestaña === 'Facturacion' ? 'active' : ''}`}>
                    Facturacion <span className="cnt-nav-badge">{hesList.length}</span>
                </button>
                <button type="button" onClick={() => setPestaña('contratos')} className={`cnt-nav-btn ${pestaña === 'contratos' ? 'active' : ''}`}>
                    Contratos y Tarifas <span className="cnt-nav-badge">{contratos.length}</span>
                </button>
                <button type="button" onClick={() => setPestaña('carpeta_tributaria')} className={`cnt-nav-btn ${pestaña === 'carpeta_tributaria' ? 'active' : ''}`}>
                    Carpeta Tributaria <span className="cnt-nav-badge">{docsEmpresa.length}</span>
                </button>
                <button type="button" onClick={() => setPestaña('gastos')} className={`cnt-nav-btn ${pestaña === 'gastos' ? 'active' : ''}`}>
                    Egresos <span>({gastos.length})</span>
                </button>
            </div>

            {/* PESTAÑA 1: FACTURACIÓN HES (SOLO CONCILIACIÓN Y ESTADO, SIN EMITIR FACTURA AQUÍ) */}
            {pestaña === 'Gestion HES' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="cnt-panel-box">
                        <div className="cnt-panel-header">
                            <div>
                                <h3 className="cnt-panel-title">Conciliación de Horas y Estado HES por Contrato</h3>
                                <p className="cnt-panel-sub">Control general de turnos ejecutados y registro de HES asociadas.</p>
                            </div>
                        </div>

                        <div className="cnt-table-wrap" style={{ marginTop: '16px' }}>
                            <table className="cnt-table">
                                <thead>
                                    <tr>
                                        <th>Cliente / Mandante</th>
                                        <th>Equipos y tarifas</th>
                                        <th>Turnos</th>
                                        <th className="right">Horas ejecutadas</th>
                                        <th className="right">Total estimado</th>
                                        <th>Estado HES</th>
                                        <th className="right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {resumenPorContrato.length === 0 ? (
                                        <tr><td colSpan="7" className="cnt-no-data">No hay contratos con horas registradas.</td></tr>
                                    ) : (
                                        resumenPorContrato.map((item) => {
                                            const hesExistente = item.hes;
                                            return (
                                                <tr key={item.id_contrato}>
                                                    <td className="bold">{item.cliente}</td>
                                                    <td>
                                                        {item.listaMaquinas.map((m, idx) => (
                                                            <div key={idx} style={{ fontSize: '12px' }}>
                                                                <strong className="mono">{m.patente}</strong> - <span style={{ color: '#16a34a', fontWeight: 'bold' }}>${parseInt(m.tarifa, 10).toLocaleString('es-CL')}/h</span>
                                                            </div>
                                                        ))}
                                                    </td>
                                                    <td className="cnt-panel-sub">{item.cantidadTurnos} turnos</td>
                                                    <td className="horas-val right">{item.totalHoras.toFixed(1)} h</td>
                                                    <td className="monto-ingreso right">${parseInt(item.subtotal, 10).toLocaleString('es-CL')}</td>
                                                    <td>
                                                        {hesExistente ? (
                                                            <span className={`cnt-badge-hes ${hesExistente.estado === 'APROBADA' ? 'aprobada' : 'pendiente'}`}>
                                                                HES N° {hesExistente.numero_hes} ({hesExistente.estado})
                                                            </span>
                                                        ) : (
                                                            <span className="cnt-badge-hes pendiente">HES Pendiente</span>
                                                        )}
                                                    </td>
                                                    <td className="right">
                                                        {!hesExistente ? (
                                                            <button
                                                                className="cnt-btn-row-act hes"
                                                                onClick={() => setModalHes({ abierto: true, idContrato: item.id_contrato, numeroHes: '', totalHoras: item.totalHoras, estado: 'APROBADA', archivoHES: null })}
                                                            >
                                                                + Registrar HES
                                                            </button>
                                                        ) : (
                                                            <span style={{ fontSize: '11px', color: '#64748b' }}>Registrada en Gestión HES</span>
                                                        )}
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

            {/* PESTAÑA 2: GESTIÓN HES & FACTURAS (AQUÍ SÍ ESTÁ EL BOTÓN DE EMITIR FACTURA Y ADJUNTO S3) */}
            {pestaña === 'Facturacion' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="cnt-panel-box">
                        <div className="cnt-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 className="cnt-panel-title">Hojas de entrada de servicio emitidas (HES) y Facturación</h3>
                                <p className="cnt-panel-sub">Visualiza el documento HES respaldado en S3, verifica su estado y emite facturas electrónicas a la API.</p>
                            </div>
                        </div>

                        <div className="cnt-table-wrap" style={{ marginTop: '16px' }}>
                            <table className="cnt-table">
                                <thead>
                                    <tr>
                                        <th>N° HES</th>
                                        <th>Contrato / Cliente</th>
                                        <th>Fecha Emisión</th>
                                        <th className="right">Horas Aprobadas</th>
                                        <th>Documento HES (S3)</th>
                                        <th>Estado</th>
                                        <th className="right">Acción API (Facturación)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {hesList.length === 0 ? (
                                        <tr><td colSpan="7" className="cnt-no-data">No hay HES registradas.</td></tr>
                                    ) : (
                                        hesList.map((hes) => {
                                            const contratoAsociado = contratos.find(c => String(c.id_contrato) === String(hes.id_contrato?.id_contrato || hes.id_contrato));
                                            const facturaEmitida = facturas.find(f => String(f.id_hes?.id_hes || f.id_hes) === String(hes.id_hes));
                                            const urlDocHes = hes.url_archivo || hes.archivo;

                                            return (
                                                <tr key={hes.id_hes}>
                                                    <td className="bold mono">N° {hes.numero_hes}</td>
                                                    <td>{contratoAsociado?.nombre_contrato || contratoAsociado?.cliente_nombre || `Contrato #${hes.id_contrato}`}</td>
                                                    <td className="mono">{hes.fecha_emision}</td>
                                                    <td className="right mono">{hes.total_horas_aprobadas} h</td>
                                                    <td>
                                                        {urlDocHes ? (
                                                            <button
                                                                type="button"
                                                                className="cnt-btn-s3"
                                                                onClick={() => abrirVisor({ url: urlDocHes, titulo: `HES N° ${hes.numero_hes}` })}
                                                            >
                                                                Ver HES (S3)
                                                            </button>
                                                        ) : (
                                                            <span className="cnt-panel-sub">Sin archivo</span>
                                                        )}
                                                    </td>
                                                    <td>
                                                        <span className={`cnt-badge-hes ${hes.estado === 'APROBADA' ? 'aprobada' : 'pendiente'}`}>
                                                            {hes.estado}
                                                        </span>
                                                    </td>
                                                    <td className="right">
                                                        {facturaEmitida ? (
                                                            <span className="cnt-badge-hes aprobada">Facturada (DTE #{facturaEmitida.folio})</span>
                                                        ) : hes.estado === 'APROBADA' ? (
                                                            <button
                                                                className="cnt-btn-row-act facturar"
                                                                onClick={() => {
                                                                    const netoEst = Math.round((hes.total_horas_aprobadas || 0) * 30000);
                                                                    const ivaCalc = Math.round(netoEst * 0.19);
                                                                    setModalFactura({
                                                                        abierto: true,
                                                                        idHes: hes.id_hes,
                                                                        folioDTE: '',
                                                                        montoNeto: netoEst,
                                                                        iva: ivaCalc,
                                                                        montoTotal: netoEst + ivaCalc
                                                                    });
                                                                }}
                                                            >
                                                                Emitir Factura (API) 📄
                                                            </button>
                                                        ) : (
                                                            <span style={{ fontSize: '11px', color: '#dc2626' }}>Requiere HES Aprobada</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* TABLA DE FACTURAS EMITIDAS */}
                    <div className="cnt-panel-box">
                        <h3 className="cnt-panel-title">Facturas Electrónicas Emitidas (DTE)</h3>
                        <div className="cnt-table-wrap" style={{ marginTop: '12px' }}>
                            <table className="cnt-table">
                                <thead>
                                    <tr>
                                        <th>Folio DTE</th>
                                        <th>HES Vinculada</th>
                                        <th>Fecha Emisión</th>
                                        <th className="right">Monto Neto</th>
                                        <th className="right">IVA (19%)</th>
                                        <th className="right">Total ($CLP)</th>
                                        <th>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {facturas.length === 0 ? (
                                        <tr><td colSpan="7" className="cnt-no-data">No se registran facturas electrónicas emitidas.</td></tr>
                                    ) : (
                                        facturas.map((f) => (
                                            <tr key={f.id_factura}>
                                                <td className="bold mono">N° {f.folio}</td>
                                                <td className="mono">HES #{f.id_hes?.numero_hes || f.id_hes}</td>
                                                <td className="mono">{f.fecha_emision}</td>
                                                <td className="right mono">${parseInt(f.monto_neto || 0, 10).toLocaleString('es-CL')}</td>
                                                <td className="right mono">${parseInt(f.iva || 0, 10).toLocaleString('es-CL')}</td>
                                                <td className="monto-ingreso right">${parseInt(f.monto_total || 0, 10).toLocaleString('es-CL')}</td>
                                                <td><span className="cnt-badge-hes aprobada">{f.estado_pago || 'EMITIDA'}</span></td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* PESTAÑA 3: CONTRATOS Y TARIFAS */}
            {pestaña === 'contratos' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="cnt-toolbar-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <input
                            type="text"
                            className="cnt-search-input"
                            placeholder="Filtrar contratos..."
                            value={busquedaContratoContador}
                            onChange={(e) => setBusquedaContratoContador(e.target.value)}
                            style={{ maxWidth: '300px' }}
                        />
                        <button type="button" className="cnt-btn-action primary" onClick={() => setMostrarFormContrato(!mostrarFormContrato)}>
                            {mostrarFormContrato ? 'Cancelar' : '+ Nuevo contrato'}
                        </button>
                    </div>

                    {mostrarFormContrato && (
                        <div className="cnt-form-card">
                            <h3 className="cnt-form-title">Registrar Nuevo Contrato de Arriendo</h3>
                            <form onSubmit={handleCrearContrato} noValidate>
                                <div className="cnt-input-group full-width" style={{ marginBottom: '16px' }}>
                                    <label>Nombre / Sector del Contrato</label>
                                    <input
                                        type="text"
                                        placeholder="Ej: Sector Norte, Planta Central..."
                                        value={formContrato.nombre_contrato}
                                        onChange={(e) => setFormContrato({ ...formContrato, nombre_contrato: e.target.value })}
                                    />
                                </div>
                                <div className="cnt-grid-inputs">
                                    <div className="cnt-input-group">
                                        <label>Cliente / Mandante *</label>
                                        <select
                                            value={formContrato.id_cliente}
                                            onChange={(e) => setFormContrato({ ...formContrato, id_cliente: e.target.value })}
                                        >
                                            <option value="">Selecciona un cliente...</option>
                                            {clientes.map((c) => (
                                                <option key={c.id_cliente || c.id} value={c.id_cliente || c.id}>
                                                    {c.razon_social || c.nombre}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="cnt-input-group">
                                        <label>Fecha Inicio</label>
                                        <input
                                            type="date"
                                            value={formContrato.fecha_inicio}
                                            onChange={(e) => setFormContrato({ ...formContrato, fecha_inicio: e.target.value })}
                                        />
                                    </div>
                                    <div className="cnt-input-group">
                                        <label>Fecha Fin (Pactada)</label>
                                        <input
                                            type="date"
                                            value={formContrato.fecha_fin}
                                            onChange={(e) => setFormContrato({ ...formContrato, fecha_fin: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="cnt-machines-container" style={{ marginTop: '16px' }}>
                                    <div className="cnt-machines-header">
                                        <label className="cnt-section-label">Maquinarias Asignadas y Tarifas ($/Hora)</label>
                                        <button type="button" className="cnt-btn-action primary" onClick={agregarFilaMaquina}>+ Agregar máquina</button>
                                    </div>
                                    {formContrato.maquinas_asignadas.map((item, index) => (
                                        <div className="cnt-machine-row" key={index} style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                            <select
                                                value={item.id_maquina}
                                                onChange={(e) => handleCambioMaquinaFila(index, 'id_maquina', e.target.value)}
                                            >
                                                <option value="">Selecciona equipo...</option>
                                                {maquinarias.map((m) => (
                                                    <option key={m.id_maquina || m.id} value={m.id_maquina || m.id}>
                                                        {m.patente} - {m.tipo}
                                                    </option>
                                                ))}
                                            </select>
                                            <input
                                                type="number"
                                                placeholder="Tarifa $/Hora"
                                                value={item.tarifa_hora}
                                                onChange={(e) => handleCambioMaquinaFila(index, 'tarifa_hora', e.target.value)}
                                            />
                                            <button type="button" onClick={() => eliminarFilaMaquina(index)} className="cnt-btn-delete-small">✕</button>
                                        </div>
                                    ))}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                                    <button type="button" onClick={() => setMostrarFormContrato(false)} className="cnt-btn-action dark">Cancelar</button>
                                    <button type="submit" className="cnt-btn-action primary">Guardar contrato</button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div className="cnt-panel-box">
                        <h3 className="cnt-panel-title">Contratos de Arriendo Registrados</h3>
                        <div className="cnt-table-wrap" style={{ marginTop: '12px' }}>
                            <table className="cnt-table">
                                <thead>
                                    <tr>
                                        <th>ID / Contrato</th>
                                        <th>Cliente</th>
                                        <th>Maquinarias y Tarifas</th>
                                        <th>Inicio</th>
                                        <th>Término</th>
                                        <th>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {contratosContadorFiltrados.length === 0 ? (
                                        <tr><td colSpan="6" className="cnt-no-data">No hay contratos registrados.</td></tr>
                                    ) : (
                                        contratosContadorFiltrados.map((c) => {
                                            const maquinasList = obtenerMaquinasDeContrato(c);
                                            return (
                                                <tr key={c.id_contrato}>
                                                    <td className="bold">#{c.id_contrato} - {c.nombre_contrato || 'Sin nombre'}</td>
                                                    <td>{c.cliente_nombre || c.razon_social || `Cliente #${c.id_cliente}`}</td>
                                                    <td>
                                                        {maquinasList.map((m, idx) => (
                                                            <div key={idx} style={{ fontSize: '12px' }}>
                                                                <strong className="mono">{m.patente}</strong> - <span style={{ color: '#16a34a', fontWeight: 'bold' }}>${parseInt(m.tarifa, 10).toLocaleString('es-CL')}/h</span>
                                                            </div>
                                                        ))}
                                                    </td>
                                                    <td className="mono">{c.fecha_inicio}</td>
                                                    <td className="mono">{c.fecha_fin || 'Indefinido'}</td>
                                                    <td><span className="cnt-badge-hes aprobada">{c.estado_contrato || 'ACTIVO'}</span></td>
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

            {/* PESTAÑA 4: CARPETA TRIBUTARIA (TEXTO LIBRE PARA EL NOMBRE) */}
            {pestaña === 'carpeta_tributaria' && (
                <div className="cnt-panel-box">
                    <h3 className="cnt-panel-title">Carpeta Tributaria y Laboral de la Empresa</h3>
                    <p className="cnt-panel-sub">Repositorio digital para la acreditación laboral exigida en faenas e inspecciones.</p>

                    <form onSubmit={handleSubirDocEmpresa} noValidate className="cnt-form-card" style={{ marginTop: '16px' }}>
                        <div className="cnt-grid-inputs">
                            <div className="cnt-input-group">
                                <label>Nombre o Título del Documento *</label>
                                <input
                                    type="text"
                                    placeholder="Ej: Certificado F30, Póliza de Seguro, etc."
                                    value={nombreDocEmpresa}
                                    onChange={(e) => setNombreDocEmpresa(e.target.value)}
                                />
                            </div>

                            <div className="cnt-input-group">
                                <label>Adjuntar Documento (PDF o Imagen)</label>
                                <input type="file" accept="application/pdf,image/*" onChange={(e) => setArchivoDocEmpresa(e.target.files[0])} />
                            </div>

                            <button type="submit" className="cnt-btn-action primary">Subir documento</button>
                        </div>
                    </form>

                    <div className="cnt-table-wrap" style={{ marginTop: '20px' }}>
                        <table className="cnt-table">
                            <thead>
                                <tr>
                                    <th>Nombre / Tipo de Documento</th>
                                    <th>Fecha de carga</th>
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {docsEmpresa.length === 0 ? (
                                    <tr><td colSpan="4" className="cnt-no-data">No se registran documentos en la carpeta tributaria.</td></tr>
                                ) : (
                                    docsEmpresa.map((doc, idx) => {
                                        const nombreDocMostrado = doc.tipo_documento || doc.nombre || 'Documento Tributario';
                                        const urlDocumentoFinal = doc.url_archivo || doc.archivo;

                                        return (
                                            <tr key={doc.id_doc_empresa || idx}>
                                                <td className="bold">{nombreDocMostrado}</td>
                                                <td className="mono">{doc.fecha_carga || doc.fecha_emision}</td>
                                                <td><span className="cnt-badge-hes aprobada">Vigente</span></td>
                                                <td>
                                                    <button 
                                                        className="cnt-btn-s3" 
                                                        onClick={() => abrirVisor({ url: urlDocumentoFinal, titulo: nombreDocMostrado })}
                                                    >
                                                        Ver Documento
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

            {/* PESTAÑA 5: EGRESOS / GASTOS */}
            {pestaña === 'gastos' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="cnt-filter-row" style={{ display: 'flex', gap: '12px' }}>
                        <input
                            type="text"
                            className="cnt-search-input"
                            placeholder="Buscar por descripción o comprobante..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                        />
                        <select className="cnt-select-filter" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
                            <option value="todos">Todos los conceptos</option>
                            <option value="Combustible">Combustible</option>
                            <option value="Repuesto">Repuesto</option>
                            <option value="Mantención">Mantención</option>
                            <option value="Taller">Taller</option>
                            <option value="Viatico">Viático</option>
                        </select>
                    </div>

                    <div className="cnt-panel-box">
                        <div className="cnt-table-wrap">
                            <table className="cnt-table">
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Concepto</th>
                                        <th>Folio / Ref</th>
                                        <th>Respaldo</th>
                                        <th>Máquina asociada</th>
                                        <th className="right">Monto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {gastosFiltrados.length === 0 ? (
                                        <tr><td colSpan="6" className="cnt-no-data">No hay egresos registrados.</td></tr>
                                    ) : (
                                        gastosFiltrados.map((g) => {
                                            const concepto = g.categoria_gasto || 'Gasto General';
                                            const urlDoc = g.comprobante_url || g.url_comprobante || g.archivo_comprobante;
                                            return (
                                                <tr key={g.id_gasto}>
                                                    <td className="mono">{g.fecha}</td>
                                                    <td><span className="cnt-badge-concepto general">{concepto}</span></td>
                                                    <td className="mono bold">{g.numero_comprobante || 'S/N'}</td>
                                                    <td>
                                                        {urlDoc ? (
                                                            <button type="button" className="cnt-btn-s3" onClick={() => abrirVisor({ url: urlDoc, titulo: `Comprobante ${concepto}` })}>
                                                                Ver documento
                                                            </button>
                                                        ) : <span className="cnt-panel-sub">Sin archivo</span>}
                                                    </td>
                                                    <td className="bold mono">{obtenerPatente(g.id_maquina, g.id_maquina_detalle)}</td>
                                                    <td className="monto-egreso right">${parseFloat(g.monto || 0).toLocaleString('es-CL')}</td>
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

            {/* MODAL REGISTRAR HES (CON ARCHIVO OBLIGATORIO PARA S3) */}
            {modalHes.abierto && (
                <div className="cnt-modal-overlay" onClick={() => setModalHes({ abierto: false, idContrato: '', numeroHes: '', totalHoras: '', estado: 'APROBADA', archivoHES: null })}>
                    <div className="cnt-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="cnt-modal-head">
                            <h3 className="cnt-modal-title">Registrar Hoja de Entrada de Servicio (HES)</h3>
                            <button className="cnt-btn-close" onClick={() => setModalHes({ abierto: false, idContrato: '', numeroHes: '', totalHoras: '', estado: 'APROBADA', archivoHES: null })}>✕</button>
                        </div>
                        <form onSubmit={handleRegistrarHES} noValidate className="cnt-modal-body">
                            <div className="cnt-input-group">
                                <label>Contrato Asociado</label>
                                <select value={modalHes.idContrato} onChange={(e) => setModalHes({ ...modalHes, idContrato: e.target.value })}>
                                    <option value="">Selecciona contrato...</option>
                                    {contratos.map(c => (
                                        <option key={c.id_contrato} value={c.id_contrato}>{c.nombre_contrato || `Contrato #${c.id_contrato}`} - {c.cliente_nombre || 'Cliente'}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="cnt-input-group">
                                <label>Número / Folio HES del Cliente</label>
                                <input type="text" placeholder="Ej: 1001497389" value={modalHes.numeroHes} onChange={(e) => setModalHes({ ...modalHes, numeroHes: e.target.value })} />
                            </div>
                            <div className="cnt-input-group">
                                <label>Horas Aprobadas por Mandante</label>
                                <input type="number" step="0.1" value={modalHes.totalHoras} onChange={(e) => setModalHes({ ...modalHes, totalHoras: e.target.value })} />
                            </div>
                            <div className="cnt-input-group">
                                <label>Estado de Validación</label>
                                <select value={modalHes.estado} onChange={(e) => setModalHes({ ...modalHes, estado: e.target.value })}>
                                    <option value="APROBADA">Aprobada (Habilita Facturación)</option>
                                    <option value="PENDIENTE">Pendiente (En Revisión)</option>
                                </select>
                            </div>
                            <div className="cnt-input-group">
                                <label>Adjuntar Documento HES (Obligatorio - S3)</label>
                                <input 
                                    type="file" 
                                    accept="application/pdf,image/*" 
                                    onChange={(e) => setModalHes({ ...modalHes, archivoHES: e.target.files[0] })} 
                                />
                            </div>
                            <button type="submit" className="cnt-btn-action primary">Guardar HES, Subir a S3 y Desactivar Turnos</button>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL EMITIR FACTURA */}
            {modalFactura.abierto && (
                <div className="cnt-modal-overlay" onClick={() => setModalFactura({ abierto: false, idHes: '', folioDTE: '', montoNeto: '', iva: 0, montoTotal: 0 })}>
                    <div className="cnt-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="cnt-modal-head">
                            <h3 className="cnt-modal-title">Emitir Factura Electrónica (DTE)</h3>
                            <button className="cnt-btn-close" onClick={() => setModalFactura({ abierto: false, idHes: '', folioDTE: '', montoNeto: '', iva: 0, montoTotal: 0 })}>✕</button>
                        </div>
                        <form onSubmit={handleEmitirFactura} noValidate className="cnt-modal-body">
                            <div className="cnt-input-group">
                                <label>Folio DTE Factura</label>
                                <input type="number" placeholder="Ej: 208" value={modalFactura.folioDTE} onChange={(e) => setModalFactura({ ...modalFactura, folioDTE: e.target.value })} />
                            </div>
                            <div className="cnt-input-group">
                                <label>Monto Neto ($CLP)</label>
                                <input
                                    type="number"
                                    placeholder="Ej: 3647512"
                                    value={modalFactura.montoNeto}
                                    onChange={(e) => handleCambioMontoNeto(e.target.value)}
                                />
                            </div>
                            <div className="cnt-input-group">
                                <label>IVA 19%</label>
                                <input type="number" value={modalFactura.iva} readOnly />
                            </div>
                            <div className="cnt-input-group">
                                <label>Monto Total ($CLP)</label>
                                <input type="number" value={modalFactura.montoTotal} readOnly />
                            </div>
                            <button type="submit" className="cnt-btn-action dark">Emitir Factura a API</button>
                        </form>
                    </div>
                </div>
            )}

            {/* VISOR DE DOCUMENTOS S3 */}
            {modalDoc.abierto && (
                <div className="cnt-modal-overlay" onClick={() => setModalDoc({ abierto: false, url: '', titulo: '', subtitulo: '', esPdf: false })}>
                    <div className="cnt-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="cnt-modal-head">
                            <div>
                                <h3 className="cnt-modal-title">{modalDoc.titulo}</h3>
                                <p className="cnt-modal-sub">{modalDoc.subtitulo}</p>
                            </div>
                            <div className="cnt-modal-actions">
                                <a href={modalDoc.url} target="_blank" rel="noopener noreferrer" className="cnt-btn-s3">Abrir en Pestaña Nueva ↗</a>
                                <button onClick={() => setModalDoc({ abierto: false, url: '', titulo: '', subtitulo: '', esPdf: false })} className="cnt-btn-close">✕</button>
                            </div>
                        </div>
                        <div className="cnt-modal-body">
                            {modalDoc.esPdf ? (
                                <iframe src={modalDoc.url} title={modalDoc.titulo} className="cnt-viewer-iframe" style={{ width: '100%', height: '500px', border: 'none' }} />
                            ) : (
                                <img src={modalDoc.url} alt={modalDoc.titulo} className="cnt-viewer-img" style={{ maxWidth: '100%', maxHeight: '500px' }} />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}