import React, { useState, useEffect } from 'react';
import axios from '../api/axios';
import '../styles/VistaAdmin.css';

const normalizarUrlDocumento = (url) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
        return url;
    }
    const baseUrl = import.meta.env.VITE_API_URL
        ? import.meta.env.VITE_API_URL.replace('/api', '')
        : 'https://multimakspa.duckdns.org';
    return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
};

const validarRutChileno = (rut) => {
    if (!rut) return false;
    const cleanRut = rut.replace(/[^0-9kK]/g, '');
    if (cleanRut.length < 8) return false;

    const cuerpo = cleanRut.slice(0, -1);
    let dv = cleanRut.slice(-1).toUpperCase();

    let suma = 0;
    let multiplo = 2;

    for (let i = cuerpo.length - 1; i >= 0; i--) {
        suma += multiplo * parseInt(cuerpo.charAt(i), 10);
        multiplo = multiplo < 7 ? multiplo + 1 : 2;
    }

    const dvEsperado = 11 - (suma % 11);
    let dvCalc = dvEsperado === 11 ? '0' : dvEsperado === 10 ? 'K' : String(dvEsperado);

    return dv === dvCalc;
};

const formatearRut = (val) => {
    let clean = val.replace(/[^0-9kK]/g, '');
    if (clean.length > 9) clean = clean.slice(0, 9);
    if (clean.length <= 1) return clean;

    const cuerpo = clean.slice(0, -1);
    const dv = clean.slice(-1).toUpperCase();
    const cuerpoFormateado = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

    return `${cuerpoFormateado}-${dv}`;
};

const validarPatenteChilena = (patente) => {
    if (!patente) return false;
    const clean = patente.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const regexPatente = /^([A-Z]{4}\d{2}|[A-Z]{2}\d{4}|[A-Z]{1,3}\d{3,4})$/;
    return regexPatente.test(clean);
};

const formatearPatente = (val) => {
    let clean = val.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (clean.length > 6) clean = clean.slice(0, 6);

    if (clean.length <= 2) return clean;
    if (clean.length <= 4) return `${clean.slice(0, 2)}-${clean.slice(2)}`;
    return `${clean.slice(0, 2)}-${clean.slice(2, 4)}-${clean.slice(4)}`;
};

const obtenerIdsMaquinasDeContrato = (c, listaMaquinarias = [], listaReportes = []) => {
    if (!c) return [];

    const idsMaquinas = new Set();
    const idContratoStr = String(c.id_contrato || c.id || '');

    if (Array.isArray(c.maquinas_contrato) && c.maquinas_contrato.length > 0) {
        c.maquinas_contrato.forEach(item => {
            const idMaq = typeof item.id_maquina === 'object'
                ? (item.id_maquina?.id_maquina || item.id_maquina?.id)
                : item.id_maquina;
            if (idMaq) idsMaquinas.add(String(idMaq));
        });
    }

    if (Array.isArray(listaReportes)) {
        listaReportes.forEach(r => {
            const idContratoReporte = typeof r.id_contrato === 'object'
                ? (r.id_contrato?.id_contrato || r.id_contrato?.id)
                : r.id_contrato;

            if (String(idContratoReporte) === idContratoStr) {
                const idMaq = typeof r.id_maquina === 'object'
                    ? (r.id_maquina?.id_maquina || r.id_maquina?.id)
                    : r.id_maquina;

                if (idMaq) idsMaquinas.add(String(idMaq));
            }
        });
    }

    return Array.from(idsMaquinas);
};

const obtenerDocMaquina = (idMaquina, tipoDoc, listaDocs = []) => {
    if (!idMaquina || !Array.isArray(listaDocs)) return null;

    const buscarNorm = tipoDoc.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    return listaDocs.find(d => {
        const idMaqDoc = typeof d.id_maquina === 'object'
            ? (d.id_maquina?.id_maquina || d.id_maquina?.id)
            : d.id_maquina;

        if (String(idMaqDoc) !== String(idMaquina)) return false;

        const tipoGuardadoNorm = (d.tipo_documento || '')
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

        return tipoGuardadoNorm.includes(buscarNorm);
    });
};

// ===================== AYUDAS: TELÉFONO CHILENO Y FECHAS =====================
const soloDigitosTelefonoCL = (valor) => {
    let d = String(valor || '').replace(/\D/g, '');
    if (d.length === 11 && d.startsWith('56')) d = d.slice(2);
    return d;
};

// Móvil: 9 dígitos que empiezan con 9. Fijo: 9 dígitos (código de zona + número) que empiezan con 2 a 7.
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

// Fecha de hoy en hora local (YYYY-MM-DD). toISOString() usa UTC y de noche en Chile marca "mañana".
const hoyLocalISO = () => new Date().toLocaleDateString('en-CA');
const sumarDiasISO = (dias) => {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    return d.toLocaleDateString('en-CA');
};
const mesActualISO = () => hoyLocalISO().slice(0, 7);

// Estados de máquina: antes el front guardaba "En Taller" y el back "EN TALLER". Ahora se compara sin importar el formato.
const estadoMaquinaNorm = (e) => String(e || '').trim().toUpperCase();
const maquinaEnTallerOMantencion = (e) => {
    const x = estadoMaquinaNorm(e);
    return x.includes('TALLER') || x.includes('REQUIERE');
};
const nombreEstadoMaquina = (e) => {
    const x = estadoMaquinaNorm(e);
    if (!x || x === 'OPERATIVA' || x === 'DISPONIBLE') return 'Operativa';
    if (x === 'EN FAENA') return 'En faena';
    if (x.includes('TALLER')) return 'En taller';
    if (x.includes('REQUIERE')) return 'Requiere mantención';
    return e;
};

// En pantalla el administrador ve el NOMBRE del contrato, no su número interno.
const nombreContrato = (c) => (c ? (c.nombre_contrato || c.nombre || `Contrato #${c.id_contrato ?? c.id}`) : 'Sin contrato');

const formatoCLP = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CL')}`;

// Convierte la respuesta de error de la API en { campo: mensaje, general: mensaje }.
const extraerErroresApi = (err, defecto, camposMostrados = []) => {
    const d = err && err.response && err.response.data;
    if (!d) {
        return { general: err && err.request ? 'No hay conexión con el servidor. Intenta nuevamente.' : defecto };
    }
    if (typeof d === 'string') return { general: d.length < 200 ? d : defecto };
    const out = {};
    const sueltos = [];
    Object.entries(d).forEach(([campo, v]) => {
        const msg = Array.isArray(v) ? v.join(' ') : (typeof v === 'string' ? v : JSON.stringify(v));
        out[campo] = msg;
        if (!camposMostrados.includes(campo)) sueltos.push(msg);
    });
    out.general = sueltos.length ? sueltos.join(' ') : (Object.keys(out).length ? 'Revisa los campos marcados en rojo.' : defecto);
    return out;
};

const aFechaLocal = (iso) => {
    const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    return new Date(a, m - 1, d);
};

const formatoFechaCL = (iso) => {
    if (!iso) return '';
    const [a, m, d] = String(iso).slice(0, 10).split('-');
    return `${d}-${m}-${a}`;
};

const diasHasta = (iso) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return Math.round((aFechaLocal(iso) - hoy) / 86400000);
};

const textoDias = (n) => `${n} ${n === 1 ? 'día' : 'días'}`;
// ============================================================================

export default function VistaAdmin({ usuario, modoNoche }) {
    const fechaHoy = hoyLocalISO();

    const calcularFechaFutura = (dias) => sumarDiasISO(dias);

    // La consulta de disponibilidad parte HOY (antes partía en 21 días).
    const [diasProyeccion, setDiasProyeccion] = useState(0);
    const [fechaProyeccion, setFechaProyeccion] = useState(fechaHoy);

    const [mesSeleccionado, setMesSeleccionado] = useState(mesActualISO());
    // Período de los indicadores del dashboard ('' = todo el historial).
    const [mesKpi, setMesKpi] = useState(mesActualISO());

    const [tabActiva, setTabActiva] = useState('dashboard');
    const [verMasAlertas, setVerMasAlertas] = useState(false);

    // Al entrar al resumen, la disponibilidad siempre parte en "Hoy".
    useEffect(() => {
        if (tabActiva === 'dashboard') {
            setDiasProyeccion(0);
            setFechaProyeccion(hoyLocalISO());
        }
    }, [tabActiva]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState('');
    const [mensajeExito, setMensajeExito] = useState('');

    const [modalEliminar, setModalEliminar] = useState({
        abierto: false,
        titulo: '',
        mensaje: '',
        onConfirmar: null
    });

    const abrirModalEliminar = (titulo, mensaje, accion) => {
        setModalEliminar({
            abierto: true,
            titulo,
            mensaje,
            onConfirmar: () => {
                setModalEliminar(prev => ({ ...prev, abierto: false }));
                accion();
            }
        });
    };

    const cerrarModalEliminar = () => {
        setModalEliminar({ abierto: false, titulo: '', mensaje: '', onConfirmar: null });
    };

    useEffect(() => {
        if (mensajeExito) {
            const timer = setTimeout(() => setMensajeExito(''), 4000);
            return () => clearTimeout(timer);
        }
    }, [mensajeExito]);

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(''), 6000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    const [clientes, setClientes] = useState([]);
    const [maquinarias, setMaquinarias] = useState([]);
    const [operadores, setOperadores] = useState([]);
    const [reportes, setReportes] = useState([]);
    const [gastos, setGastos] = useState([]);
    const [contratos, setContratos] = useState([]);

    const [busquedaCli, setBusquedaCli] = useState('');
    const [busquedaMaq, setBusquedaMaq] = useState('');
    const [busquedaOp, setBusquedaOp] = useState('');
    const [busquedaGasto, setBusquedaGasto] = useState('');
    const [busquedaContrato, setBusquedaContrato] = useState('');
    const [filtroDisponibilidadTabla, setFiltroDisponibilidadTabla] = useState('todos');

    const [filtroGastoMaquina, setFiltroGastoMaquina] = useState('todos');
    const [filtroGastoOperador, setFiltroGastoOperador] = useState('todos');
    const [filtroGastoContrato, setFiltroGastoContrato] = useState('todos');
    const [documentosMaq, setDocumentosMaq] = useState([]);

    // FORMULARIO CLIENTES
    const [mostrarModalCli, setMostrarModalCli] = useState(false);
    const [editandoCliId, setEditandoCliId] = useState(null);
    const [formCli, setFormCli] = useState({
        razon_social: '',
        rut: '',
        giro: '',
        direccion: '',
        telefono: '',
        email_contacto: ''
    });
    const [erroresCli, setErroresCli] = useState({});

    // FORMULARIO MAQUINARIAS
    const [mostrarModalMaq, setMostrarModalMaq] = useState(false);
    const [editandoMaqId, setEditandoMaqId] = useState(null);
    const [archivosMaq, setArchivosMaq] = useState({ soap: null, rev_tecnica: null, permiso: null });
    const [formMaq, setFormMaq] = useState({
        patente: '',
        marca: '',
        modelo: '',
        tipo: 'Excavadora',
        horometro_actual: '',
        estado: 'OPERATIVA',
        fecha_venc_soap: '',
        fecha_venc_rev_tecnica: '',
        fecha_venc_permiso: ''
    });
    const [erroresMaq, setErroresMaq] = useState({});

    // FORMULARIO OPERADORES
    const [mostrarModalOp, setMostrarModalOp] = useState(false);
    const [editandoOpId, setEditandoOpId] = useState(null);
    const [archivoLicencia, setArchivoLicencia] = useState(null);
    const [formOp, setFormOp] = useState({
        nombre: '',
        apellido: '',
        rut: '',
        password: '',
        TipoLicencia: ['Clase D'],
        fecha_vencimiento_licencia: ''
    });
    const [erroresOp, setErroresOp] = useState({});

    // FORMULARIO GASTOS
    const [mostrarModalGasto, setMostrarModalGasto] = useState(false);
    const [editandoGastoId, setEditandoGastoId] = useState(null);
    const [archivoGasto, setArchivoGasto] = useState(null);
    const [formGasto, setFormGasto] = useState({
        categoria_gasto: 'Combustible',
        monto: '',
        fecha: fechaHoy,
        id_maquina: '',
        id_contrato: '',
        numero_comprobante: '',
        url_comprobante: ''
    });
    const [erroresGasto, setErroresGasto] = useState({});

    // Visor de documentos
    const [modalDoc, setModalDoc] = useState({
        abierto: false,
        url: '',
        titulo: '',
        subtitulo: '',
        folio: '',
        esPdf: false
    });

    const abrirVisorDoc = ({ url, titulo, subtitulo, folio }) => {
        if (!url) return;
        const urlNorm = normalizarUrlDocumento(url);
        setModalDoc({
            abierto: true,
            url: urlNorm,
            titulo: titulo || 'Documento Adjunto',
            subtitulo: subtitulo || '',
            folio: folio || '',
            esPdf: urlNorm.toLowerCase().includes('.pdf')
        });
    };

    const cerrarVisorDoc = () => setModalDoc(prev => ({ ...prev, abierto: false, url: '' }));

    const evaluarVencimiento = (fechaStr) => {
        if (!fechaStr) {
            return { estado: 'SIN_FECHA', clase: 'adm-tag-muted', texto: 'Sin registro', detalle: 'No hay fecha de vencimiento registrada' };
        }
        const dif = diasHasta(fechaStr);
        const fecha = formatoFechaCL(fechaStr);

        if (dif < 0) {
            const hace = Math.abs(dif);
            return {
                estado: 'VENCIDO',
                clase: 'adm-badge-red',
                texto: hace <= 30 ? `Venció hace ${textoDias(hace)}` : `Venció el ${fecha}`,
                detalle: `Venció el ${fecha}`
            };
        }
        if (dif === 0) return { estado: 'ALERTA', clase: 'adm-badge-amber', texto: 'Vence hoy', detalle: `Vence hoy (${fecha})` };
        if (dif === 1) return { estado: 'ALERTA', clase: 'adm-badge-amber', texto: 'Vence mañana', detalle: `Vence el ${fecha}` };
        if (dif <= 30) return { estado: 'ALERTA', clase: 'adm-badge-amber', texto: `Vence en ${textoDias(dif)}`, detalle: `Vence el ${fecha}` };
        return { estado: 'AL_DIA', clase: 'adm-badge-green', texto: `Vigente hasta ${fecha}`, detalle: `Faltan ${textoDias(dif)}` };
    };

    const cargarTodo = async () => {
        setCargando(true);
        setError('');
        try {
            const [resCli, resMaq, resOp, resRep, resGas, resCont, resDocs, resKpis] = await Promise.all([
                axios.get('clientes/').catch(() => axios.get('/clientes/')).catch(() => ({ data: [] })),
                axios.get('maquinarias/').catch(() => axios.get('/maquinarias/')).catch(() => ({ data: [] })),
                axios.get('operadores/').catch(() => axios.get('/operadores/')).catch(() => ({ data: [] })),
                axios.get('reports/').catch(() => axios.get('/reports/')).catch(() => ({ data: [] })),
                axios.get('gastos/').catch(() => axios.get('/gastos/')).catch(() => ({ data: [] })),
                axios.get('/contratos/').catch(() => axios.get('contratos/')).catch(() => ({ data: [] })),
                axios.get('doc-maquinaria/').catch(() => axios.get('/doc-maquinaria/')).catch(() => ({ data: [] })),
                axios.get('resumen-kpis/').catch(() => axios.get('/resumen-kpis/')).catch(() => ({ data: {} })) // <--- AGREGAR ESTE ENDPOINT
            ]);

            // ...resto del código

            setDocumentosMaq(resDocs.data?.results || (Array.isArray(resDocs.data) ? resDocs.data : []));
            setClientes(resCli.data?.results || (Array.isArray(resCli.data) ? resCli.data : []));
            setMaquinarias(resMaq.data?.results || (Array.isArray(resMaq.data) ? resMaq.data : []));
            setOperadores(resOp.data?.results || (Array.isArray(resOp.data) ? resOp.data : []));
            setReportes(resRep.data?.results || (Array.isArray(resRep.data) ? resRep.data : []));
            setGastos(resGas.data?.results || (Array.isArray(resGas.data) ? resGas.data : []));
            setContratos(resCont.data?.results || (Array.isArray(resCont.data) ? resCont.data : []));
        } catch (err) {
            setError('Error al sincronizar los datos con el servidor.');
        } finally {
            setCargando(false);
        }
    };

    useEffect(() => {
        cargarTodo();
    }, []);

    const handleCambioRango = (dias) => {
        const dNum = parseInt(dias, 10);
        setDiasProyeccion(dNum);
        setFechaProyeccion(calcularFechaFutura(dNum));
    };

    const analisisMantenciones = maquinarias.map((m) => {
        const h = parseFloat(m.horometro_actual ?? m.horometro ?? 0);
        const proximaPauta = h === 0 ? 500 : Math.ceil(h / 500) * 500;
        const horasRestantes = proximaPauta - h;

        let nivelAlerta = 'OPERATIVA';
        let detalleAlerta = 'Operación normal';

        if (horasRestantes <= 50 && horasRestantes > 0) {
            nivelAlerta = 'PRÓXIMA_MANTENCIÓN';
            detalleAlerta = `Faltan ${horasRestantes.toFixed(1)} hrs para mantención de ${proximaPauta} hrs`;
        } else if (horasRestantes <= 0) {
            nivelAlerta = 'MANTENCIÓN_PENDIENTE';
            detalleAlerta = `Alcanzó pauta de ${proximaPauta} hrs. Ingreso requerido a taller`;
        }

        if (maquinaEnTallerOMantencion(m.estado)) {
            nivelAlerta = 'MANTENCIÓN_PENDIENTE';
            detalleAlerta = 'Equipo en taller o fuera de servicio';
        }

        return {
            ...m,
            horometroNum: h,
            proximaPauta,
            horasRestantes: Math.max(0, horasRestantes).toFixed(1),
            porcentajeUso: Math.min(100, Math.round((h / proximaPauta) * 100)),
            nivelAlerta,
            detalleAlerta
        };
    });

    const maquinasConAlerta = analisisMantenciones.filter(m => m.nivelAlerta !== 'OPERATIVA');

    const estadoFlotaProyectada = maquinarias.map((m) => {
        const idMaqStr = String(m.id_maquina !== undefined ? m.id_maquina : m.id);

        const contratosMaq = contratos.filter(c => {
            const idsMaquinas = obtenerIdsMaquinasDeContrato(c, maquinarias, reportes);
            const est = String(c.estado_contrato || c.estado || 'ACTIVO').toUpperCase();
            return idsMaquinas.includes(idMaqStr) && (est === 'ACTIVO' || est === 'PRORROGADO');
        });

        const fechaEvaluar = fechaProyeccion || fechaHoy;
        const contratoActivoEnFecha = contratosMaq.find(c => {
            const inicio = c.fecha_inicio;
            const fin = c.fecha_fin || '2099-12-31';
            return fechaEvaluar >= inicio && fechaEvaluar <= fin;
        });

        const ocupadaPorContrato = Boolean(contratoActivoEnFecha);
        const enMantencionOTaller = maquinaEnTallerOMantencion(m.estado);
        const disponibleTotal = !ocupadaPorContrato && !enMantencionOTaller;

        const idClienteCont = typeof contratoActivoEnFecha?.id_cliente === 'object'
            ? (contratoActivoEnFecha?.id_cliente?.id_cliente || contratoActivoEnFecha?.id_cliente?.id)
            : (contratoActivoEnFecha?.id_cliente || contratoActivoEnFecha?.cliente);
        const clienteObj = clientes.find(cli => String(cli.id_cliente || cli.id) === String(idClienteCont));

        const clienteMandante = contratoActivoEnFecha?.cliente_nombre || contratoActivoEnFecha?.cliente || clienteObj?.razon_social || clienteObj?.nombre || 'Cliente Mandante';
        const fechaFin = contratoActivoEnFecha?.fecha_fin || 'Indefinida';

        const primerMaqRel = contratoActivoEnFecha?.maquinas_contrato?.find(
            item => String(item.id_maquina?.id_maquina || item.id_maquina) === idMaqStr
        );
        const tarifaHora = primerMaqRel?.tarifa_hora || parseInt(contratoActivoEnFecha?.tarifa_hora, 10) || 28000;

        return {
            ...m,
            ocupadaPorContrato,
            enMantencionOTaller,
            disponibleTotal,
            contratoActivoEnFecha,
            clienteMandante,
            fechaFin,
            tarifaHora
        };
    });

    const maquinasLibres = estadoFlotaProyectada.filter(m => m.disponibleTotal);
    const pctDisponibilidad = maquinarias.length > 0
        ? Math.round((maquinasLibres.length / maquinarias.length) * 100)
        : 100;

    // ---- Indicadores del dashboard (período seleccionado; vacío = todo el historial) ----
    const enPeriodoKpi = (iso) => !mesKpi || String(iso || '').slice(0, 7) === mesKpi;
    const reportesPeriodo = reportes.filter(r => enPeriodoKpi(r.fecha));
    const gastosPeriodo = gastos.filter(g => enPeriodoKpi(g.fecha));

    // El ingreso de cada parte lo calcula el servidor con la tarifa real de la máquina en ese contrato.
    const totalIngresos = reportesPeriodo.reduce((acc, r) => acc + (parseFloat(r.ingreso_estimado) || 0), 0);
    const totalGastos = gastosPeriodo.reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0);
    const margenGlobal = totalIngresos - totalGastos;
    const margenPct = totalIngresos > 0 ? Math.round((margenGlobal / totalIngresos) * 100) : null;
    const totalHorasFaenaGlobal = reportesPeriodo.reduce((acc, r) => acc + (parseFloat(r.horas_trabajadas) || 0), 0);
    const costoPorHora = totalHorasFaenaGlobal > 0 ? totalGastos / totalHorasFaenaGlobal : 0;
    const ingresoPorHora = totalHorasFaenaGlobal > 0 ? totalIngresos / totalHorasFaenaGlobal : 0;
    const partesSinContrato = reportesPeriodo.filter(r => !r.id_contrato).length;

    const gastosPorCategoria = Object.entries(
        gastosPeriodo.reduce((acc, g) => {
            const k = g.categoria_gasto || 'Otros';
            acc[k] = (acc[k] || 0) + (parseFloat(g.monto) || 0);
            return acc;
        }, {})
    ).sort((x, y) => y[1] - x[1]);

    const ingresosPorContrato = Object.values(
        reportesPeriodo.reduce((acc, r) => {
            if (!r.id_contrato) return acc;
            const k = r.id_contrato;
            if (!acc[k]) acc[k] = { nombre: r.contrato_nombre || `Contrato #${k}`, cliente: r.cliente_nombre || '', horas: 0, ingreso: 0 };
            acc[k].horas += parseFloat(r.horas_trabajadas) || 0;
            acc[k].ingreso += parseFloat(r.ingreso_estimado) || 0;
            return acc;
        }, {})
    ).sort((x, y) => y.ingreso - x.ingreso).slice(0, 5);

    const contratosVigentesHoy = contratos.filter(c => {
        const est = String(c.estado_contrato || 'ACTIVO').toUpperCase();
        return (est === 'ACTIVO' || est === 'PRORROGADO')
            && (!c.fecha_inicio || c.fecha_inicio <= fechaHoy)
            && (!c.fecha_fin || c.fecha_fin >= fechaHoy);
    });
    const contratosPorVencer = contratosVigentesHoy
        .filter(c => c.fecha_fin && diasHasta(c.fecha_fin) <= 30)
        .sort((x, y) => String(x.fecha_fin).localeCompare(String(y.fecha_fin)));

    const alertasDocumentos = [
        ...documentosMaq.map(d => {
            const idM = d.id_maquina?.id_maquina || d.id_maquina;
            const maqDoc = maquinarias.find(m => String(m.id_maquina) === String(idM));
            return { etiqueta: `${d.tipo_documento} ${maqDoc?.patente || ''}`.trim(), ...evaluarVencimiento(d.fecha_vencimiento) };
        }),
        ...operadores.map(op => ({
            etiqueta: `Licencia ${op.nombre || ''} ${op.apellido || ''}`.trim(),
            ...evaluarVencimiento(op.fecha_vencimiento_licencia)
        }))
    ].filter(x => x.estado === 'VENCIDO' || x.estado === 'ALERTA');
    const documentosVencidos = alertasDocumentos.filter(x => x.estado === 'VENCIDO').length;

    const flotaFiltrada = estadoFlotaProyectada.filter(m => {
        if (filtroDisponibilidadTabla === 'todos') return true;
        if (filtroDisponibilidadTabla === 'libres') return m.disponibleTotal;
        if (filtroDisponibilidadTabla === 'ocupadas') return m.ocupadaPorContrato;
        if (filtroDisponibilidadTabla === 'taller') return m.enMantencionOTaller;
        return true;
    });

    const obtenerDiasDelMes = (yearMonthStr) => {
        const [year, month] = yearMonthStr.split('-').map(Number);
        const cantidadDias = new Date(year, month, 0).getDate();
        return Array.from({ length: cantidadDias }, (_, i) => {
            const diaNum = String(i + 1).padStart(2, '0');
            return `${yearMonthStr}-${diaNum}`;
        });
    };

    const diasGantt = obtenerDiasDelMes(mesSeleccionado);

    const clientesFiltrados = clientes.filter(c => {
        const t = busquedaCli.toLowerCase();
        return (c.razon_social || c.nombre || '').toLowerCase().includes(t) || (c.rut || '').toLowerCase().includes(t);
    });

    const maquinariasFiltradas = maquinarias.filter(m => {
        const t = busquedaMaq.toLowerCase();
        return (m.patente || '').toLowerCase().includes(t) || (m.marca || '').toLowerCase().includes(t) || (m.modelo || '').toLowerCase().includes(t);
    });

    const operadoresFiltrados = operadores.filter(op => {
        const t = busquedaOp.toLowerCase();
        const nom = (op.id_usuario?.nombre || op.nombre || '').toLowerCase();
        const ape = (op.id_usuario?.apellido || op.apellido || '').toLowerCase();
        const rut = (op.id_usuario?.rut || op.rut || '').toLowerCase();
        return nom.includes(t) || ape.includes(t) || rut.includes(t);
    });

    const contratosFiltrados = contratos.filter(c => {
        const term = busquedaContrato.toLowerCase();
        const cliente = (c.cliente_nombre || '').toLowerCase();
        const nombreCto = (c.nombre_contrato || '').toLowerCase();
        const idCto = String(c.id_contrato || c.id || '');
        return cliente.includes(term) || nombreCto.includes(term) || idCto.includes(term);
    });

    const gastosFiltrados = gastos.filter(g => {
        const t = busquedaGasto.toLowerCase();
        const cat = (g.categoria_gasto || '').toLowerCase();
        const comp = (g.numero_comprobante || '').toLowerCase();
        const coincideTexto = cat.includes(t) || comp.includes(t);

        const maqId = g.id_maquina?.id_maquina || g.id_maquina;
        const coincideMaquina = filtroGastoMaquina === 'todos' || String(maqId) === String(filtroGastoMaquina);

        const opId = g.id_usuario?.id_usuario || g.id_usuario;
        const coincideOperador = filtroGastoOperador === 'todos' || String(opId) === String(filtroGastoOperador);

        const contId = g.id_contrato?.id_contrato || g.id_contrato;
        const coincideContrato = filtroGastoContrato === 'todos' || String(contId) === String(filtroGastoContrato);

        return coincideTexto && coincideMaquina && coincideOperador && coincideContrato;
    });

    const validarCampoCliente = (nombre, valor) => {
        let msg = null;
        if (nombre === 'razon_social' && !valor.trim()) msg = 'Ingrese la Razón Social o Nombre de la empresa.';
        if (nombre === 'rut') {
            if (!valor.trim()) msg = 'Ingrese el RUT de la empresa.';
            else if (!validarRutChileno(valor)) msg = 'RUT inválido (verifique los dígitos ingresados).';
        }
        if (nombre === 'giro' && !valor.trim()) msg = 'Ingrese el Giro comercial.';
        if (nombre === 'telefono') {
            if (!valor.trim()) msg = 'Ingrese un número de teléfono de contacto.';
            else if (!validarTelefonoCL(valor)) msg = 'Teléfono chileno inválido. Ej: +56 9 8765 4321 (móvil) o +56 61 224 1234 (fijo).';
        }
        if (nombre === 'email_contacto') {
            if (!valor.trim()) msg = 'Ingrese un correo electrónico de contacto.';
            else if (!/\S+@\S+\.\S+/.test(valor)) msg = 'Formato de correo inválido (ej: contacto@empresa.cl).';
        }
        return msg;
    };

    const handleCambioCli = (campo, valor) => {
        const valFormateado = campo === 'rut' ? formatearRut(valor) : valor;
        const nuevoForm = { ...formCli, [campo]: valFormateado };
        setFormCli(nuevoForm);
        const error = validarCampoCliente(campo, valFormateado);
        setErroresCli(prev => ({ ...prev, [campo]: error }));
    };

    const toggleFormCliente = () => {
        if (mostrarModalCli) {
            setMostrarModalCli(false);
            setEditandoCliId(null);
        } else {
            setEditandoCliId(null);
            setFormCli({ razon_social: '', rut: '', giro: '', direccion: '', telefono: '', email_contacto: '' });
            setErroresCli({});
            setMostrarModalCli(true);
        }
    };

    const abrirEdicionCliente = (cli) => {
        setEditandoCliId(cli.id_cliente || cli.id);

        let telExtraido = cli.telefono || '';
        let emailExtraido = cli.email_contacto || cli.email || '';

        if (cli.contacto && cli.contacto.includes('|')) {
            const partes = cli.contacto.split('|');
            telExtraido = partes[0].replace('Tel:', '').trim();
            emailExtraido = partes[1].replace('Email:', '').trim();
        } else if (cli.contacto) {
            if (cli.contacto.includes('@')) emailExtraido = cli.contacto;
            else telExtraido = cli.contacto;
        }

        setFormCli({
            razon_social: cli.razon_social || cli.nombre || '',
            rut: cli.rut || '',
            giro: cli.giro || '',
            direccion: cli.direccion || '',
            telefono: telExtraido,
            email_contacto: emailExtraido
        });
        setErroresCli({});
        setMostrarModalCli(true);
    };

    const guardarCliente = async (e) => {
        e.preventDefault();
        setMensajeExito('');

        const nuevosErrores = {
            razon_social: validarCampoCliente('razon_social', formCli.razon_social),
            rut: validarCampoCliente('rut', formCli.rut),
            giro: validarCampoCliente('giro', formCli.giro),
            telefono: validarCampoCliente('telefono', formCli.telefono),
            email_contacto: validarCampoCliente('email_contacto', formCli.email_contacto)
        };

        if (Object.values(nuevosErrores).some(msg => msg !== null)) {
            setErroresCli(nuevosErrores);
            return;
        }

        setErroresCli({});
        const contactoUnificado = `Tel: ${formCli.telefono.trim()} | Email: ${formCli.email_contacto.trim()}`;

        const payload = {
            rut: formCli.rut.trim(),
            razon_social: formCli.razon_social.trim(),
            giro: formCli.giro.trim(),
            direccion: formCli.direccion.trim() || 'Sin Dirección Registrada',
            contacto: contactoUnificado
        };

        try {
            if (editandoCliId) {
                await axios.put(`clientes/${editandoCliId}/`, payload);
                setMensajeExito('Cliente actualizado correctamente.');
            } else {
                await axios.post('clientes/', payload);
                setMensajeExito('Cliente registrado correctamente.');
            }

            setMostrarModalCli(false);
            setEditandoCliId(null);
            setFormCli({ razon_social: '', rut: '', giro: '', direccion: '', telefono: '', email_contacto: '' });
            setErroresCli({});
            cargarTodo();
        } catch (err) {
            if (err.response?.data) {
                const resData = err.response.data;
                if (typeof resData === 'object') {
                    const erroresServidor = {};
                    Object.entries(resData).forEach(([campo, msgs]) => {
                        erroresServidor[campo] = Array.isArray(msgs) ? msgs.join(', ') : msgs;
                    });
                    setErroresCli({ ...erroresServidor, general: erroresServidor.general || 'No se pudo guardar el cliente. Revisa los campos marcados.' });
                } else {
                    setErroresCli({ general: `Error del servidor (${err.response.status}).` });
                }
            } else {
                setErroresCli({ general: 'Error de conexión con el servidor.' });
            }
        }
    };

    const confirmarEliminarCliente = (cli) => {
        const nombreMostrar = cli.razon_social || cli.nombre || `ID #${cli.id_cliente || cli.id}`;
        abrirModalEliminar(
            'Eliminar Cliente',
            `¿Está seguro de que desea eliminar al cliente "${nombreMostrar}"?`,
            async () => {
                try {
                    await axios.delete(`clientes/${cli.id_cliente || cli.id}/`);
                    setMensajeExito(`Cliente "${nombreMostrar}" eliminado correctamente.`);
                    cargarTodo();
                } catch (err) {
                    if (err.response && (err.response.status === 400 || err.response.status === 500 || err.response.status === 409)) {
                        setError(`No se puede eliminar el cliente "${nombreMostrar}" porque posee contratos o registros asociados en el sistema.`);
                    } else {
                        setError(`No fue posible eliminar al cliente "${nombreMostrar}".`);
                    }
                }
            }
        );
    };

    const validarCampoMaquinaria = (nombre, valor) => {
        let msg = null;
        if (nombre === 'patente') {
            if (!valor.trim()) {
                msg = 'Ingrese la patente del equipo.';
            } else if (!validarPatenteChilena(valor)) {
                msg = 'Formato inválido (Ej: AB-CD-12, AB-12-34 o ABC-123).';
            }
        }
        if (nombre === 'marca' && !valor.trim()) msg = 'Ingrese la marca del equipo.';
        if (nombre === 'modelo' && !valor.trim()) msg = 'Ingrese el modelo del equipo.';
        if (nombre === 'horometro_actual') {
            if (valor === '' || valor === null) msg = 'Ingrese el horómetro actual.';
            else if (parseFloat(valor) < 0) msg = 'El horómetro no puede ser negativo.';
        }
        return msg;
    };

    const handleCambioMaq = (campo, valor) => {
        const valFormateado = campo === 'patente' ? formatearPatente(valor) : valor;
        const nuevoForm = { ...formMaq, [campo]: valFormateado };
        setFormMaq(nuevoForm);
        const error = validarCampoMaquinaria(campo, valFormateado);
        setErroresMaq(prev => ({ ...prev, [campo]: error }));
    };

    const toggleFormMaquinaria = () => {
        if (mostrarModalMaq) {
            setMostrarModalMaq(false);
            setEditandoMaqId(null);
        } else {
            setEditandoMaqId(null);
            setFormMaq({ patente: '', marca: '', modelo: '', tipo: 'Excavadora', horometro_actual: '', estado: 'OPERATIVA', fecha_venc_soap: '', fecha_venc_rev_tecnica: '', fecha_venc_permiso: '' });
            setArchivosMaq({ soap: null, rev_tecnica: null, permiso: null });
            setErroresMaq({});
            setMostrarModalMaq(true);
        }
    };

    const abrirEdicionMaquinaria = (maq) => {
        setEditandoMaqId(maq.id_maquina);

        const docSoapObj = obtenerDocMaquina(maq.id_maquina, 'SOAP', documentosMaq);
        const docRevObj = obtenerDocMaquina(maq.id_maquina, 'REVISI', documentosMaq);
        const docPermisoObj = obtenerDocMaquina(maq.id_maquina, 'PERMISO', documentosMaq);

        setFormMaq({
            patente: maq.patente || '',
            marca: maq.marca || '',
            modelo: maq.modelo || '',
            tipo: maq.tipo || 'Excavadora',
            horometro_actual: maq.horometro_actual ?? maq.horometro ?? '',
            estado: estadoMaquinaNorm(maq.estado) === 'DISPONIBLE' ? 'OPERATIVA' : (estadoMaquinaNorm(maq.estado) || 'OPERATIVA'),
            fecha_venc_soap: docSoapObj?.fecha_vencimiento || '',
            fecha_venc_rev_tecnica: docRevObj?.fecha_vencimiento || '',
            fecha_venc_permiso: docPermisoObj?.fecha_vencimiento || ''
        });

        setArchivosMaq({ soap: null, rev_tecnica: null, permiso: null });
        setErroresMaq({});
        setMostrarModalMaq(true);
    };

    const guardarMaquinaria = async (e) => {
        e.preventDefault();

        const nuevosErrores = {
            patente: validarCampoMaquinaria('patente', formMaq.patente),
            marca: validarCampoMaquinaria('marca', formMaq.marca),
            modelo: validarCampoMaquinaria('modelo', formMaq.modelo),
            horometro_actual: validarCampoMaquinaria('horometro_actual', String(formMaq.horometro_actual ?? ''))
        };
        if (Object.values(nuevosErrores).some(msg => msg !== null)) {
            setErroresMaq({ ...nuevosErrores, general: 'Revisa los campos marcados en rojo.' });
            return;
        }
        setErroresMaq({});

        try {
            let idMaqCreada = editandoMaqId;

            // 1. Guardar o actualizar la máquina
            if (editandoMaqId) {
                await axios.put(`maquinarias/${editandoMaqId}/`, formMaq);
                setMensajeExito('Maquinaria actualizada correctamente.');
            } else {
                const res = await axios.post('maquinarias/', formMaq);
                idMaqCreada = res.data.id_maquina;
                setMensajeExito('Maquinaria registrada correctamente.');
            }

            // 2. Auxiliar: PUT si el doc ya existe, POST si es nuevo
            const guardarOActualizarDoc = async (idMaq, tipoDoc, numDoc, fechaVenc) => {
                if (!fechaVenc) return;
                const docExistente = obtenerDocMaquina(idMaq, tipoDoc, documentosMaq);
                const payload = {
                    id_maquina: idMaq,
                    tipo_documento: tipoDoc,
                    numero_documento: numDoc,
                    fecha_emision: fechaHoy,
                    fecha_vencimiento: fechaVenc,
                    url_archivo: docExistente?.url_archivo || ''
                };

                if (docExistente?.id_doc_maquina) {
                    return axios.put(`doc-maquinaria/${docExistente.id_doc_maquina}/`, payload);
                } else {
                    return axios.post('doc-maquinaria/', payload);
                }
            };

            // 3. Procesar documentos sin duplicar
            if (idMaqCreada) {
                const promesasDocs = [];
                if (formMaq.fecha_venc_soap) {
                    promesasDocs.push(guardarOActualizarDoc(idMaqCreada, 'SOAP', `SOAP-${formMaq.patente.replace(/[^A-Z0-9]/g, '')}`, formMaq.fecha_venc_soap));
                }
                if (formMaq.fecha_venc_rev_tecnica) {
                    promesasDocs.push(guardarOActualizarDoc(idMaqCreada, 'REVISIÓN TÉCNICA', `REV-${formMaq.patente.replace(/[^A-Z0-9]/g, '')}`, formMaq.fecha_venc_rev_tecnica));
                }
                if (formMaq.fecha_venc_permiso) {
                    promesasDocs.push(guardarOActualizarDoc(idMaqCreada, 'PERMISO DE CIRCULACIÓN', `PERM-${formMaq.patente.replace(/[^A-Z0-9]/g, '')}`, formMaq.fecha_venc_permiso));
                }
                if (promesasDocs.length > 0) await Promise.all(promesasDocs);
            }

            setMostrarModalMaq(false);
            setEditandoMaqId(null);
            setErroresMaq({});
            cargarTodo();
        } catch (error) {
            console.error('Error al guardar maquinaria o documentos:', error);
            setErroresMaq(extraerErroresApi(error, 'Ocurrió un error al guardar los datos de la maquinaria.', ['patente', 'marca', 'modelo', 'horometro_actual']));
        }
    };

    const confirmarEliminarMaquinaria = (maq) => {
        const identificador = `${maq.patente} (${maq.marca} ${maq.modelo})`;
        abrirModalEliminar(
            'Eliminar Maquinaria',
            `¿Está seguro de que desea eliminar la maquinaria "${identificador}"?`,
            async () => {
                try {
                    await axios.delete(`maquinarias/${maq.id_maquina}/`);
                    setMensajeExito(`Maquinaria "${identificador}" eliminada correctamente.`);
                    cargarTodo();
                } catch (err) {
                    if (err.response && (err.response.status === 400 || err.response.status === 500 || err.response.status === 409)) {
                        setError(`No se puede eliminar la maquinaria "${identificador}" porque posee partes diarios, contratos o gastos asociados.`);
                    } else {
                        setError(`No fue posible eliminar la maquinaria "${identificador}".`);
                    }
                }
            }
        );
    };

    const validarCampoOperador = (nombre, valor) => {
        let msg = null;
        if (nombre === 'nombre' && !valor.trim()) msg = 'Ingrese el nombre del operador.';
        if (nombre === 'apellido' && !valor.trim()) msg = 'Ingrese el apellido del operador.';
        if (nombre === 'password' && valor && valor.length < 6) msg = 'La contraseña debe tener al menos 6 caracteres.';
        if (nombre === 'rut') {
            if (!valor.trim()) msg = 'Ingrese el RUT del operador.';
            else if (!validarRutChileno(valor)) msg = 'RUT inválido.';
        }
        return msg;
    };

    const handleCambioOp = (campo, valor) => {
        const valFormateado = campo === 'rut' ? formatearRut(valor) : valor;
        const nuevoForm = { ...formOp, [campo]: valFormateado };
        setFormOp(nuevoForm);
        const error = validarCampoOperador(campo, valFormateado);
        setErroresOp(prev => ({ ...prev, [campo]: error }));
    };

    const toggleFormOperador = () => {
        if (mostrarModalOp) {
            setMostrarModalOp(false);
            setEditandoOpId(null);
        } else {
            setEditandoOpId(null);
            setFormOp({
                nombre: '',
                apellido: '',
                rut: '',
                password: '',
                TipoLicencia: ['Clase D'],
                fecha_vencimiento_licencia: ''
            });
            setArchivoLicencia(null);
            setErroresOp({});
            setMostrarModalOp(true);
        }
    };

    const abrirEdicionOperador = (op) => {
        setEditandoOpId(op.id_operador);

        const licenciasArray = Array.isArray(op.TipoLicencia)
            ? op.TipoLicencia
            : (op.TipoLicencia ? op.TipoLicencia.split(',').map(l => l.trim()) : ['Clase D']);

        setFormOp({
            nombre: op.id_usuario?.nombre || op.nombre || '',
            apellido: op.id_usuario?.apellido || op.apellido || '',
            rut: op.id_usuario?.rut || op.rut || '',
            password: '',
            TipoLicencia: licenciasArray,
            fecha_vencimiento_licencia: op.fecha_vencimiento_licencia || ''
        });
        setArchivoLicencia(null);
        setErroresOp({});
        setMostrarModalOp(true);
    };

    const guardarOperador = async (e) => {
        e.preventDefault();

        const listaLicencias = Array.isArray(formOp.TipoLicencia)
            ? formOp.TipoLicencia
            : [formOp.TipoLicencia].filter(Boolean);

        const nuevosErrores = {
            nombre: validarCampoOperador('nombre', formOp.nombre),
            apellido: validarCampoOperador('apellido', formOp.apellido),
            rut: validarCampoOperador('rut', formOp.rut)
        };
        if (!editandoOpId && !formOp.password) nuevosErrores.password = 'Defina una contraseña para que el operador pueda ingresar.';
        else if (formOp.password) nuevosErrores.password = validarCampoOperador('password', formOp.password);

        if (listaLicencias.length === 0) nuevosErrores.TipoLicencia = 'Debe seleccionar al menos una licencia.';

        const licenciaGuardada = editandoOpId
            ? (operadores.find(o => o.id_operador === editandoOpId)?.fecha_vencimiento_licencia || '')
            : '';
        if (formOp.fecha_vencimiento_licencia
            && formOp.fecha_vencimiento_licencia < fechaHoy
            && formOp.fecha_vencimiento_licencia !== licenciaGuardada) {
            nuevosErrores.fecha_vencimiento_licencia = 'La licencia debe vencer a partir de hoy.';
        }

        if (Object.values(nuevosErrores).some(msg => msg)) {
            setErroresOp({ ...nuevosErrores, general: 'Revisa los campos marcados en rojo.' });
            return;
        }
        setErroresOp({});

        const formData = new FormData();
        formData.append('nombre', formOp.nombre.trim());
        formData.append('apellido', formOp.apellido.trim());
        formData.append('rut', formOp.rut);
        if (formOp.password) formData.append('password', formOp.password);
        formData.append('TipoLicencia', listaLicencias.join(', '));

        if (formOp.fecha_vencimiento_licencia) {
            formData.append('fecha_vencimiento_licencia', formOp.fecha_vencimiento_licencia);
        }
        if (archivoLicencia) {
            formData.append('archivo_licencia', archivoLicencia);
        }

        try {
            if (editandoOpId) {
                await axios.put(`operadores/${editandoOpId}/`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                setMensajeExito('Operador actualizado correctamente.');
            } else {
                await axios.post('operadores/', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                setMensajeExito('Operador registrado correctamente.');
            }
            setMostrarModalOp(false);
            setEditandoOpId(null);
            setArchivoLicencia(null);
            setErroresOp({});
            cargarTodo();
        } catch (err) {
            // El servidor explica qué falló (RUT repetido, contraseña corta, etc.) y se muestra dentro del formulario.
            setErroresOp(extraerErroresApi(err, 'No se pudo guardar al operador. Intenta nuevamente.',
                ['nombre', 'apellido', 'rut', 'password', 'TipoLicencia', 'fecha_vencimiento_licencia']));
        }
    };

    const confirmarEliminarOperador = (op) => {
        const nombreOp = `${op.id_usuario?.nombre || op.nombre || ''} ${op.id_usuario?.apellido || op.apellido || ''}`.trim() || `ID #${op.id_operador}`;
        abrirModalEliminar(
            'Eliminar Operador',
            `¿Está seguro de que desea eliminar al operador "${nombreOp}"?`,
            async () => {
                try {
                    await axios.delete(`operadores/${op.id_operador}/`);
                    setMensajeExito(`Operador "${nombreOp}" eliminado correctamente.`);
                    cargarTodo();
                } catch (err) {
                    if (err.response && (err.response.status === 400 || err.response.status === 500 || err.response.status === 409)) {
                        setError(`No se puede eliminar al operador "${nombreOp}" porque registra partes diarios u operaciones asociadas.`);
                    } else {
                        setError(`No fue posible eliminar al operador "${nombreOp}".`);
                    }
                }
            }
        );
    };

    const validarCampoGasto = (nombre, valor) => {
        let msg = null;
        if (nombre === 'monto') {
            if (!valor) msg = 'Ingrese el monto del gasto.';
            else if (parseInt(valor, 10) <= 0) msg = 'El monto debe ser mayor a 0.';
        }
        if (nombre === 'id_maquina' && !valor) {
            msg = 'Seleccione la maquinaria asociada.';
        }
        return msg;
    };

    const handleCambioGasto = (campo, valor) => {
        const nuevoForm = { ...formGasto, [campo]: valor };
        setFormGasto(nuevoForm);
        const error = validarCampoGasto(campo, valor);
        setErroresGasto(prev => ({ ...prev, [campo]: error }));
    };

    const toggleFormGasto = () => {
        if (mostrarModalGasto) {
            setMostrarModalGasto(false);
            setEditandoGastoId(null);
        } else {
            setEditandoGastoId(null);
            setFormGasto({
                categoria_gasto: 'Combustible',
                monto: '',
                fecha: fechaHoy,
                id_maquina: '',
                id_contrato: '',
                numero_comprobante: '',
                url_comprobante: ''
            });
            setArchivoGasto(null);
            setErroresGasto({});
            setMostrarModalGasto(true);
        }
    };

    const abrirEdicionGasto = (g) => {
        setEditandoGastoId(g.id_gasto);
        setFormGasto({
            categoria_gasto: g.categoria_gasto,
            monto: g.monto,
            fecha: g.fecha,
            id_maquina: g.id_maquina?.id_maquina || g.id_maquina || '',
            id_contrato: g.id_contrato?.id_contrato || g.id_contrato || '',
            numero_comprobante: g.numero_comprobante || '',
            url_comprobante: g.comprobante_url || g.url_comprobante || ''
        });
        setArchivoGasto(null);
        setErroresGasto({});
        setMostrarModalGasto(true);
    };

    const guardarGasto = async (e) => {
        e.preventDefault();
        const nuevosErrores = {
            monto: validarCampoGasto('monto', formGasto.monto),
            id_maquina: validarCampoGasto('id_maquina', formGasto.id_maquina)
        };

        if (Object.values(nuevosErrores).some(msg => msg !== null)) {
            setErroresGasto(nuevosErrores);
            return;
        }

        if (formGasto.fecha && formGasto.fecha > fechaHoy) {
            setErroresGasto({ general: 'La fecha del gasto no puede ser posterior a hoy.' });
            return;
        }

        setErroresGasto({});
        const sesion = JSON.parse(localStorage.getItem('usuario_multimak') || '{}');
        const formData = new FormData();
        formData.append('categoria_gasto', formGasto.categoria_gasto);
        formData.append('monto', parseInt(formGasto.monto, 10));
        formData.append('fecha', formGasto.fecha);
        formData.append('id_maquina', parseInt(formGasto.id_maquina, 10));
        if (formGasto.id_contrato) formData.append('id_contrato', parseInt(formGasto.id_contrato, 10));
        formData.append('numero_comprobante', formGasto.numero_comprobante.trim() || 'S/N');
        const idReal = sesion.id_usuario || sesion.id;
        formData.append('id_usuario', idReal);
        if (archivoGasto) formData.append('archivo_comprobante', archivoGasto);

        try {
            if (editandoGastoId) {
                await axios.put(`gastos/${editandoGastoId}/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                setMensajeExito('Gasto actualizado correctamente.');
            } else {
                await axios.post('gastos/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                setMensajeExito('Gasto registrado correctamente.');
            }
            setMostrarModalGasto(false);
            setEditandoGastoId(null);
            setArchivoGasto(null);
            cargarTodo();
        } catch (err) {
            setErroresGasto(extraerErroresApi(err, 'No se pudo registrar el gasto. Intenta nuevamente.', ['monto', 'id_maquina']));
        }
    };

    const confirmarEliminarGasto = (g) => {
        const refGasto = `Gasto de ${g.categoria_gasto} ($${parseInt(g.monto, 10).toLocaleString('es-CL')})`;
        abrirModalEliminar(
            'Eliminar Registro de Gasto',
            `¿Está seguro de que desea eliminar el registro "${refGasto}"?`,
            async () => {
                try {
                    await axios.delete(`gastos/${g.id_gasto}/`);
                    setMensajeExito(`Registro de gasto eliminado correctamente.`);
                    cargarTodo();
                } catch {
                    setError('No fue posible eliminar el registro de gasto.');
                }
            }
        );
    };

    return (
        <div className="adm-view-container">
            <div className="adm-top-header">
                <div className="adm-title-block">
                    <span className="adm-kpi-sub">Administración</span>
                    <h1 className="adm-page-title">Panel de administración</h1>
                    <p className="adm-page-desc">
                        Gestión de disponibilidad de flota, contratos comerciales, clientes y operadores.
                    </p>
                </div>

                <div className="adm-period-controls">
                    <button className="adm-btn-refresh" onClick={cargarTodo}>
                        Actualizar
                    </button>
                </div>
            </div>

            {mensajeExito && <div className="adm-alert-ok">{mensajeExito}</div>}
            {error && <div className="adm-alert-fail">{error}</div>}

            <nav className="adm-nav-group">
                <button
                    type="button"
                    className={`adm-nav-btn ${tabActiva === 'dashboard' ? 'active' : ''}`}
                    onClick={() => setTabActiva('dashboard')}
                >
                    Disponibilidad & Resumen
                </button>
                <button
                    type="button"
                    className={`adm-nav-btn ${tabActiva === 'clientes' ? 'active' : ''}`}
                    onClick={() => setTabActiva('clientes')}
                >
                    Clientes <span className="adm-nav-badge">{clientes.length}</span>
                </button>
                <button
                    type="button"
                    className={`adm-nav-btn ${tabActiva === 'maquinarias' ? 'active' : ''}`}
                    onClick={() => setTabActiva('maquinarias')}
                >
                    Maquinarias <span className="adm-nav-badge">{maquinarias.length}</span>
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
                    onClick={() => {
                        setTabActiva('contratos');
                        cargarTodo();
                    }}
                >
                    Contratos<span className="adm-nav-badge">{contratos.length}</span>
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

            {tabActiva === 'dashboard' && (
                <div className="adm-tab-content">
                    <div className="adm-action-bar" style={{ marginBottom: '20px' }}>
                        <div>
                            <span className="adm-kpi-sub" style={{ color: '#0284c7', fontWeight: '800' }}></span>
                            <h2 style={{ margin: '2px 0 0', fontSize: '20px', fontWeight: '900', color: 'var(--ink)' }}>Resumen operativo</h2>
                        </div>
                        <div className="adm-action-tools">
                            <button type="button" className="adm-btn-secondary" onClick={() => { setTabActiva('clientes'); toggleFormCliente(); }}>
                                + Registrar Cliente
                            </button>
                            <button type="button" className="adm-btn-secondary" onClick={() => { setTabActiva('maquinarias'); toggleFormMaquinaria(); }}>
                                + Registrar Maquinaria
                            </button>
                            <button type="button" className="adm-btn-primary" onClick={() => { setTabActiva('gastos'); toggleFormGasto(); }}>
                                + Registrar Gasto
                            </button>
                        </div>
                    </div>

                    <div className="adm-period-controls" style={{ marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                        <span className="adm-period-label">Período de los indicadores</span>
                        <div style={{ display: 'inline-flex', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', background: modoNoche ? '#0f172a' : '#fff' }}>
                            {[
                                [true, 'Mes'],
                                [false, 'Todo el historial'],
                            ].map(([esMes, texto]) => {
                                const activo = esMes ? Boolean(mesKpi) : !mesKpi;
                                return (
                                    <button
                                        key={texto}
                                        type="button"
                                        onClick={() => setMesKpi(esMes ? (mesKpi || mesActualISO()) : '')}
                                        style={{
                                            padding: '8px 16px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: '13px',
                                            fontWeight: '700',
                                            background: activo ? '#0f172a' : 'transparent',
                                            color: activo ? '#fff' : (modoNoche ? '#cbd5e1' : '#475569')
                                        }}
                                    >
                                        {texto}
                                    </button>
                                );
                            })}
                        </div>
                        {mesKpi && (
                            <input
                                type="month"
                                className="adm-select-period"
                                max={mesActualISO()}
                                value={mesKpi}
                                onChange={(e) => setMesKpi(e.target.value || mesActualISO())}
                            />
                        )}
                    </div>

                    <div className="adm-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                        <div
                            className="adm-kpi-card highlight"
                            onClick={() => setTabActiva('maquinarias')}
                            style={{ cursor: 'pointer' }}
                            title="Ver inventario de maquinarias"
                        >
                            <span className="adm-kpi-sub">Disponibilidad al {formatoFechaCL(fechaProyeccion)}</span>
                            <div className="adm-kpi-value">{pctDisponibilidad}%</div>
                            <span className="adm-kpi-foot">
                                {maquinasLibres.length} de {maquinarias.length} equipos disponibles
                            </span>
                        </div>

                        <div
                            className={`adm-kpi-card ${maquinasConAlerta.length > 0 ? 'alert-card' : ''}`}
                            onClick={() => document.getElementById('seccion-mantenciones')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                            style={{ cursor: 'pointer' }}
                            title="Ir a la tabla de mantenciones"
                        >
                            <span className="adm-kpi-sub">Alertas de mantención</span>
                            <div className="adm-kpi-value">{maquinasConAlerta.length}</div>
                            <span className="adm-kpi-foot">Equipos cerca de su pauta de 500 h o en taller</span>
                        </div>

                        <div className="adm-kpi-card" onClick={() => setTabActiva('gastos')} style={{ cursor: 'pointer' }} title="Ver detalle de gastos">
                            <span className="adm-kpi-sub">Gastos del período</span>
                            <div className="adm-kpi-value" style={{ color: '#dc2626' }}>{formatoCLP(totalGastos)}</div>
                            <span className="adm-kpi-foot">
                                {gastosPorCategoria.length > 0
                                    ? `Mayor gasto: ${gastosPorCategoria[0][0]} (${formatoCLP(gastosPorCategoria[0][1])})`
                                    : 'Sin gastos en el período'}
                            </span>
                        </div>

                        <div className="adm-kpi-card" onClick={() => setTabActiva('turnos')} style={{ cursor: 'pointer' }} title="Ver partes diarios">
                            <span className="adm-kpi-sub">Ingresos estimados</span>
                            <div className="adm-kpi-value" style={{ color: '#16a34a' }}>{formatoCLP(totalIngresos)}</div>
                            <span className="adm-kpi-foot">
                                {margenPct !== null
                                    ? `Margen: ${margenGlobal < 0 ? '-' : ''}${formatoCLP(Math.abs(margenGlobal))} (${margenPct}%)`
                                    : 'Sin ingresos en el período'}
                            </span>
                        </div>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <button
                            type="button"
                            className="adm-btn-secondary"
                            onClick={() => setVerMasAlertas(!verMasAlertas)}
                        >
                            {verMasAlertas ? '▲ Ocultar' : '▼ Ver'} contratos por vencer ({contratosPorVencer.length}) y documentos ({alertasDocumentos.length})
                        </button>

                        {verMasAlertas && (
                            <div className="adm-kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginTop: '16px' }}>
                                <div
                                    className={`adm-kpi-card ${contratosPorVencer.length > 0 ? 'alert-card' : ''}`}
                                    onClick={() => setTabActiva('contratos')}
                                    style={{ cursor: 'pointer' }}
                                    title="Ver contratos"
                                >
                                    <span className="adm-kpi-sub">Contratos por vencer (30 días)</span>
                                    <div className="adm-kpi-value">{contratosPorVencer.length}</div>
                                    <span className="adm-kpi-foot">
                                        {contratosPorVencer.length > 0
                                            ? `Próximo: ${nombreContrato(contratosPorVencer[0])} (${formatoFechaCL(contratosPorVencer[0].fecha_fin)})`
                                            : `${contratosVigentesHoy.length} contratos vigentes hoy`}
                                    </span>
                                </div>

                                <div
                                    className={`adm-kpi-card ${alertasDocumentos.length > 0 ? 'alert-card' : ''}`}
                                    onClick={() => setTabActiva('maquinarias')}
                                    style={{ cursor: 'pointer' }}
                                    title="Ver documentos"
                                >
                                    <span className="adm-kpi-sub">Documentos y licencias</span>
                                    <div className="adm-kpi-value">{alertasDocumentos.length}</div>
                                    <span className="adm-kpi-foot">
                                        {alertasDocumentos.length > 0
                                            ? `${documentosVencidos} vencido(s) · el resto vence en 30 días`
                                            : 'Todo al día'}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="adm-grid-2" style={{ marginBottom: '24px', alignItems: 'stretch', ...(gastosPorCategoria.length === 0 ? { gridTemplateColumns: '1fr' } : {}) }}>
                        {/* COLUMNA 1: GASTOS (solo si hay gastos en el período) */}
                        {gastosPorCategoria.length > 0 && (
                            <div className="adm-profit-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                <div>
                                    <div className="adm-profit-header">
                                        <div className="adm-profit-title-box">
                                            <h3>Distribución de costos</h3>
                                            <p>Principales categorías de egreso en el período.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setTabActiva('gastos')}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                color: '#0284c7',
                                                fontWeight: '700',
                                                cursor: 'pointer',
                                                fontSize: '12px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px'
                                            }}
                                        >
                                            Ver detalle →
                                        </button>
                                    </div>

                                    {gastosPorCategoria.length === 0 ? (
                                        /* ESTADO NEUTRO (EMPTY STATE) PROFESIONAL */
                                        <div style={{
                                            padding: '32px 16px',
                                            textAlign: 'center',
                                            color: '#64748b',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px'
                                        }}>
                                            <div style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '50%',
                                                backgroundColor: modoNoche ? '#1e293b' : '#f1f5f9',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '18px',
                                                marginBottom: '4px'
                                            }}>
                                                💳
                                            </div>
                                            <strong style={{ fontSize: '13px', color: modoNoche ? '#f8fafc' : '#0f172a' }}>
                                                Sin egresos en este período
                                            </strong>
                                            <span style={{ fontSize: '12px', maxWidth: '280px', lineHeight: '1.4' }}>
                                                No se registran gastos de combustible ni taller asignados durante el mes seleccionado.
                                            </span>
                                        </div>
                                    ) : (
                                        /* BARRAS DE PROGRESO DE DISTRIBUCIÓN */
                                        <div style={{ padding: '8px 16px 16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                            {gastosPorCategoria.slice(0, 3).map(([cat, monto]) => {
                                                const pct = totalGastos > 0 ? Math.round((monto / totalGastos) * 100) : 0;
                                                return (
                                                    <div key={cat}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '700' }}>
                                                            <span>{cat}</span>
                                                            <span>{formatoCLP(monto)} · {pct}%</span>
                                                        </div>
                                                        <div style={{ height: '8px', borderRadius: '4px', background: modoNoche ? '#1e293b' : '#e2e8f0', marginTop: '6px' }}>
                                                            <div style={{ width: `${pct}%`, height: '100%', borderRadius: '4px', background: '#dc2626' }} />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                {gastosPorCategoria.length > 3 && (
                                    <div style={{ padding: '0 16px 12px', fontSize: '12px', color: '#64748b' }}>
                                        + {gastosPorCategoria.length - 3} categoría(s) más registradas.
                                    </div>
                                )}
                            </div>
                        )}

                        {/* COLUMNA 2: INGRESOS POR CONTRATO */}
                        <div className="adm-profit-card">
                            <div className="adm-profit-header">
                                <div className="adm-profit-title-box">
                                    <h3>Ingresos por contrato</h3>
                                    <p>Los 5 contratos que más facturan en el período.</p>
                                </div>
                            </div>
                            {ingresosPorContrato.length === 0 ? (
                                <div style={{
                                    padding: '32px 16px',
                                    textAlign: 'center',
                                    color: '#64748b',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px'
                                }}>
                                    <strong style={{ fontSize: '13px', color: modoNoche ? '#f8fafc' : '#0f172a' }}>
                                        Sin partes valorizados
                                    </strong>
                                    <span style={{ fontSize: '12px' }}>No hay facturación proyectada para este período.</span>
                                </div>
                            ) : (
                                <div className="adm-table-wrap" style={{ overflowX: 'visible', margin: '0 16px 16px' }}>
                                    <table className="adm-table" style={{ minWidth: 0 }}>
                                        <thead>
                                            <tr>
                                                <th>Contrato</th>
                                                <th style={{ textAlign: 'right' }}>Horas</th>
                                                <th style={{ textAlign: 'right' }}>Ingreso</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ingresosPorContrato.map((c) => (
                                                <tr key={c.nombre}>
                                                    <td>
                                                        <strong>{c.nombre}</strong>
                                                        <div className="adm-fleet-type">{c.cliente}</div>
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>{c.horas.toFixed(1)} h</td>
                                                    <td style={{ textAlign: 'right', fontWeight: '800', color: '#16a34a' }}>{formatoCLP(c.ingreso)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="adm-profit-card" style={{ marginBottom: '24px' }}>
                        <div className="adm-profit-header">
                            <div className="adm-profit-title-box">
                                <h3>Disponibilidad proyectada de la flota</h3>
                                <p>{maquinasLibres.length} de {maquinarias.length} equipos disponibles al {formatoFechaCL(fechaProyeccion)}.</p>
                            </div>

                            <div className="adm-period-controls">
                                <span className="adm-period-label">Fecha de consulta</span>
                                <select
                                    value={diasProyeccion}
                                    onChange={(e) => handleCambioRango(e.target.value)}
                                    className="adm-select-period"
                                >
                                    <option value={0}>Hoy ({formatoFechaCL(fechaHoy)})</option>
                                    <option value={7}>En 7 días ({formatoFechaCL(calcularFechaFutura(7))})</option>
                                    <option value={14}>En 14 días ({formatoFechaCL(calcularFechaFutura(14))})</option>
                                    <option value={21}>En 21 días ({formatoFechaCL(calcularFechaFutura(21))})</option>
                                    <option value={30}>En 30 días ({formatoFechaCL(calcularFechaFutura(30))})</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '0 16px 12px' }}>
                            {[
                                ['todos', 'Todas', estadoFlotaProyectada.length],
                                ['libres', 'Disponibles', maquinasLibres.length],
                                ['ocupadas', 'En contrato', estadoFlotaProyectada.filter(m => m.ocupadaPorContrato).length],
                                ['taller', 'En taller', estadoFlotaProyectada.filter(m => m.enMantencionOTaller).length],
                            ].map(([clave, texto, n]) => (
                                <button
                                    key={clave}
                                    type="button"
                                    className={filtroDisponibilidadTabla === clave ? 'adm-btn-primary' : 'adm-btn-secondary'}
                                    style={{ padding: '5px 12px', fontSize: '12px' }}
                                    onClick={() => setFiltroDisponibilidadTabla(clave)}
                                >
                                    {texto} ({n})
                                </button>
                            ))}
                        </div>

                        <div className="adm-table-wrap">
                            <table className="adm-table">
                                <thead>
                                    <tr>
                                        <th>Maquinaria</th>
                                        <th style={{ textAlign: 'center' }}>Condición al {formatoFechaCL(fechaProyeccion)}</th>
                                        <th>Asignación Actual</th>
                                        <th style={{ textAlign: 'right' }}>Tarifa</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {flotaFiltrada.map((m) => (
                                        <tr key={m.id_maquina}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span className="adm-fleet-badge">{m.patente}</span>
                                                    <div>
                                                        <strong style={{ textTransform: 'capitalize' }}>
                                                            {m.marca} {m.modelo}
                                                        </strong>
                                                        <div className="adm-fleet-type">{m.tipo}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                {m.enMantencionOTaller ? (
                                                    <span className="adm-badge-red">En Taller / Mantención</span>
                                                ) : m.ocupadaPorContrato ? (
                                                    <span className="adm-badge-amber">Asignada a Contrato</span>
                                                ) : (
                                                    <span className="adm-badge-green">Disponible</span>
                                                )}
                                            </td>
                                            <td>
                                                {(() => {
                                                    const c = m.contratoActivoEnFecha;
                                                    if (!c) {
                                                        return <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '12px' }}>Sin asignación</span>;
                                                    }

                                                    const nombreCto = nombreContrato(c);
                                                    const clienteNombre = m.clienteMandante || c.cliente_nombre || c.cliente || '';

                                                    return (
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                            <span style={{ fontWeight: '800', color: '#0284c7', fontSize: '13px', textTransform: 'uppercase' }}>
                                                                {nombreCto}
                                                            </span>
                                                            {clienteNombre && (
                                                                <span style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>
                                                                    {clienteNombre}
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </td>
                                            <td style={{ textAlign: 'right', fontWeight: '700', fontFamily: 'monospace' }}>
                                                {m.contratoActivoEnFecha ? `$${parseInt(m.tarifaHora, 10).toLocaleString('es-CL')}/h` : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                    {flotaFiltrada.length === 0 && (
                                        <tr>
                                            <td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                                                No hay maquinarias en esta categoría.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                    </div>

                    <div className="adm-card" id="seccion-mantenciones" style={{ scrollMarginTop: '16px' }}>
                        <div className="adm-card-head">
                            <div>
                                <h3 className="adm-card-title">Mantenciones pendientes y próximas</h3>
                                <p className="adm-card-sub">Solo equipos que requieren mantención o están cerca de su pauta (500h / 1.000h).</p>
                            </div>
                            <span className="adm-nav-badge">{maquinasConAlerta.length} de {maquinarias.length} máquinas</span>
                        </div>

                        {maquinasConAlerta.length === 0 ? (
                            <p className="adm-card-sub" style={{ padding: '8px 16px 16px' }}>
                                Ningún equipo requiere mantención ni está cerca de su pauta.
                            </p>
                        ) : (
                            <div className="adm-table-wrap">
                                <table className="adm-table">
                                    <thead>
                                        <tr>
                                            <th>Máquina</th>
                                            <th>Horómetro Acumulado</th>
                                            <th>Próxima Pauta</th>
                                            <th>Horas Restantes</th>
                                            <th style={{ textAlign: 'center' }}>Condición Técnica</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...maquinasConAlerta]
                                            .sort((x, y) => (y.nivelAlerta === 'MANTENCIÓN_PENDIENTE') - (x.nivelAlerta === 'MANTENCIÓN_PENDIENTE'))
                                            .slice(0, 5)
                                            .map((m) => (
                                                <tr key={m.id_maquina}>
                                                    <td>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <span className="adm-fleet-badge">{m.patente}</span>
                                                            <div>
                                                                <strong style={{ textTransform: 'capitalize' }}>
                                                                    {m.marca} {m.modelo}
                                                                </strong>
                                                                <div className="adm-fleet-type">{m.tipo}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td style={{ fontFamily: 'Consolas, monospace', fontWeight: '800' }}>
                                                        {m.horometroNum.toFixed(1)} hrs
                                                    </td>
                                                    <td style={{ fontWeight: '700' }}>
                                                        Pauta de {m.proximaPauta} hrs
                                                    </td>
                                                    <td style={{ fontFamily: 'Consolas, monospace', fontWeight: '800', color: m.horasRestantes <= 50 ? '#dc2626' : '#16a34a' }}>
                                                        Faltan {m.horasRestantes} hrs
                                                    </td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        {m.nivelAlerta === 'MANTENCIÓN_PENDIENTE' ? (
                                                            <span className="adm-badge-red">MANTENCIÓN PENDIENTE</span>
                                                        ) : (
                                                            <span className="adm-badge-amber">PRÓXIMA MANTENCIÓN</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div style={{ textAlign: 'center', padding: '12px 16px 16px' }}>
                            <button
                                type="button"
                                onClick={() => setTabActiva('maquinarias')}
                                style={{ background: 'none', border: 'none', color: '#0284c7', fontWeight: '700', cursor: 'pointer', fontSize: '13px' }}
                            >
                                {maquinasConAlerta.length > 5
                                    ? `Ver más detalles (+${maquinasConAlerta.length - 5} con alerta, ${maquinarias.length} en total) →`
                                    : `Ver más detalles de las ${maquinarias.length} máquinas →`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {tabActiva === 'clientes' && (
                <div className="adm-tab-content">
                    <div className="adm-action-bar">
                        <h2>Gestión de Clientes</h2>
                        <div className="adm-action-tools">
                            <div className="adm-search-wrap">
                                <input
                                    type="text"
                                    className="adm-search-input"
                                    placeholder="Buscar por razón social o RUT..."
                                    value={busquedaCli}
                                    onChange={(e) => setBusquedaCli(e.target.value)}
                                />
                                {busquedaCli && (
                                    <button className="adm-search-clear" onClick={() => setBusquedaCli('')}>✕</button>
                                )}
                            </div>
                            <button className="adm-btn-primary" onClick={toggleFormCliente}>
                                {mostrarModalCli ? 'Cerrar Formulario' : '+ Registrar Cliente'}
                            </button>
                        </div>
                    </div>

                    {mostrarModalCli && (
                        <div className="adm-card adm-form-box">
                            <h3 className="adm-card-title">
                                {editandoCliId ? `Modificar Cliente #${editandoCliId}` : 'Registro de Cliente'}
                            </h3>

                            <form onSubmit={guardarCliente} className="adm-crud-form" noValidate>
                                <div className="adm-grid-3">
                                    <div className="adm-field">
                                        <label>Razón Social / Nombre *</label>
                                        <input
                                            type="text"
                                            placeholder="Ej: Salfa Gestión S.A."
                                            value={formCli.razon_social}
                                            onChange={e => handleCambioCli('razon_social', e.target.value)}
                                            onBlur={e => handleCambioCli('razon_social', e.target.value)}
                                            style={{ borderColor: erroresCli.razon_social ? '#dc2626' : '' }}
                                        />
                                        {erroresCli.razon_social && (
                                            <span style={{ color: '#dc2626', fontSize: '11px', fontWeight: '700', marginTop: '4px', display: 'block' }}>
                                                {erroresCli.razon_social}
                                            </span>
                                        )}
                                    </div>

                                    <div className="adm-field">
                                        <label>RUT Empresa *</label>
                                        <input
                                            type="text"
                                            placeholder="Ej: 78.827.280-4"
                                            value={formCli.rut}
                                            onChange={e => handleCambioCli('rut', e.target.value)}
                                            onBlur={e => handleCambioCli('rut', e.target.value)}
                                            maxLength={12}
                                            style={{ borderColor: erroresCli.rut ? '#dc2626' : '' }}
                                        />
                                        {erroresCli.rut && (
                                            <span style={{ color: '#dc2626', fontSize: '11px', fontWeight: '700', marginTop: '4px', display: 'block' }}>
                                                {erroresCli.rut}
                                            </span>
                                        )}
                                    </div>

                                    <div className="adm-field">
                                        <label>Giro Comercial *</label>
                                        <input
                                            type="text"
                                            placeholder="Ej: Construcción de Obras Civiles"
                                            value={formCli.giro}
                                            onChange={e => handleCambioCli('giro', e.target.value)}
                                            onBlur={e => handleCambioCli('giro', e.target.value)}
                                            style={{ borderColor: erroresCli.giro ? '#dc2626' : '' }}
                                        />
                                        {erroresCli.giro && (
                                            <span style={{ color: '#dc2626', fontSize: '11px', fontWeight: '700', marginTop: '4px', display: 'block' }}>
                                                {erroresCli.giro}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="adm-grid-3" style={{ marginTop: '14px' }}>
                                    <div className="adm-field">
                                        <label>Teléfono de Contacto *</label>
                                        <input
                                            type="text"
                                            placeholder="Ej: +56 9 8765 4321"
                                            inputMode="tel"
                                            maxLength={16}
                                            value={formCli.telefono}
                                            onChange={e => handleCambioCli('telefono', e.target.value)}
                                            onBlur={e => handleCambioCli('telefono', formatearTelefonoCL(e.target.value))}
                                            style={{ borderColor: erroresCli.telefono ? '#dc2626' : '' }}
                                        />
                                        {erroresCli.telefono && (
                                            <span style={{ color: '#dc2626', fontSize: '11px', fontWeight: '700', marginTop: '4px', display: 'block' }}>
                                                {erroresCli.telefono}
                                            </span>
                                        )}
                                    </div>

                                    <div className="adm-field">
                                        <label>Email de Contacto *</label>
                                        <input
                                            type="email"
                                            placeholder="Ej: contacto@empresa.cl"
                                            value={formCli.email_contacto}
                                            onChange={e => handleCambioCli('email_contacto', e.target.value)}
                                            onBlur={e => handleCambioCli('email_contacto', e.target.value)}
                                            style={{ borderColor: erroresCli.email_contacto ? '#dc2626' : '' }}
                                        />
                                        {erroresCli.email_contacto && (
                                            <span style={{ color: '#dc2626', fontSize: '11px', fontWeight: '700', marginTop: '4px', display: 'block' }}>
                                                {erroresCli.email_contacto}
                                            </span>
                                        )}
                                    </div>

                                    <div className="adm-field">
                                        <label>Dirección</label>
                                        <input
                                            type="text"
                                            placeholder="Ej: Av. Alemania 90, Temuco"
                                            value={formCli.direccion}
                                            onChange={e => setFormCli({ ...formCli, direccion: e.target.value })}
                                        />
                                    </div>
                                </div>

                                {erroresCli.general && (
                                    <div className="adm-alert-fail" style={{ marginTop: '16px' }}>{erroresCli.general}</div>
                                )}
                                <div className="adm-form-actions" style={{ marginTop: '20px' }}>
                                    <button type="submit" className="adm-btn-submit">
                                        {editandoCliId ? 'Guardar Cambios' : 'Guardar Cliente'}
                                    </button>
                                    <button type="button" className="adm-btn-secondary" onClick={toggleFormCliente}>
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
                                        <th>Razón Social</th>
                                        <th>RUT</th>
                                        <th>Giro</th>
                                        <th>Dirección</th>
                                        <th>Contacto</th>
                                        <th style={{ textAlign: 'center', width: '130px' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {clientesFiltrados.map(c => {
                                        let contactoMostrar = c.contacto || 'Sin contacto';
                                        if (c.telefono && c.email_contacto) {
                                            contactoMostrar = `Tel: ${c.telefono} | Email: ${c.email_contacto}`;
                                        }

                                        return (
                                            <tr key={c.id_cliente || c.id}>
                                                <td>#{c.id_cliente || c.id}</td>
                                                <td><strong>{c.razon_social || c.nombre}</strong></td>
                                                <td><span className="adm-code-tag">{c.rut}</span></td>
                                                <td><span className="adm-tag">{c.giro || 'N/A'}</span></td>
                                                <td>{c.direccion || 'Sin Dirección'}</td>
                                                <td>{contactoMostrar}</td>
                                                <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                    <button
                                                        type="button"
                                                        className="adm-action-btn edit"
                                                        onClick={() => abrirEdicionCliente(c)}
                                                    >
                                                        Editar
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="adm-action-btn delete"
                                                        onClick={() => confirmarEliminarCliente(c)}
                                                    >
                                                        Borrar
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {clientesFiltrados.length === 0 && (
                                        <tr>
                                            <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                                                No hay clientes registrados.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {tabActiva === 'contratos' && (
                <div className="adm-tab-content">
                    <div className="adm-action-bar">
                        <div>
                            <h2>Consulta de Contratos</h2>
                            <p className="adm-card-sub">
                                Programación diaria de contratos y asignación de equipos.
                            </p>
                        </div>
                        <div className="adm-action-tools">
                            <div className="adm-search-wrap">
                                <input
                                    type="text"
                                    className="adm-search-input"
                                    placeholder="Filtrar por Cliente / Empresa o RUT..."
                                    value={busquedaContrato}
                                    onChange={(e) => setBusquedaContrato(e.target.value)}
                                />
                                {busquedaContrato && (
                                    <button className="adm-search-clear" onClick={() => setBusquedaContrato('')}>✕</button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="adm-card" style={{ marginBottom: '24px' }}>
                        <div className="adm-card-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 className="adm-card-title">Programación de Flota (Gantt)</h3>
                                <p className="adm-card-sub">
                                    Línea de tiempo de asignación según contratos vigentes.
                                </p>
                            </div>

                            <div className="adm-period-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="adm-period-label" style={{ fontWeight: '700' }}>Visualizar Mes:</span>
                                <select
                                    value={mesSeleccionado}
                                    onChange={(e) => setMesSeleccionado(e.target.value)}
                                    className="adm-select-period"
                                    style={{ padding: '6px 12px', borderRadius: '6px', fontWeight: '700', cursor: 'pointer' }}
                                >
                                    <option value="2026-10">Octubre 2026</option>
                                    <option value="2026-11">Noviembre 2026</option>
                                    <option value="2026-12">Diciembre 2026</option>
                                    <option value="2027-01">Enero 2027</option>
                                    <option value="2027-02">Febrero 2027</option>
                                    <option value="2027-03">Marzo 2027</option>
                                </select>
                            </div>
                        </div>

                        <div className="adm-table-wrap">
                            <table className="adm-table">
                                <thead>
                                    <tr>
                                        <th style={{ minWidth: '180px', sticky: 'left', zIndex: 2 }}>Equipo / Patente</th>
                                        {diasGantt.map((dia) => (
                                            <th key={dia} style={{ textAlign: 'center', padding: '6px 4px', fontSize: '10px', minWidth: '28px' }}>
                                                {dia.split('-')[2]}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {maquinarias.map((m) => {
                                        const idMaqStr = String(m.id_maquina !== undefined ? m.id_maquina : m.id);

                                        return (
                                            <tr key={idMaqStr}>
                                                <td style={{ fontWeight: '700', whiteSpace: 'nowrap' }}>
                                                    <span className="adm-fleet-badge">{m.patente}</span>{' '}
                                                    <span style={{ fontSize: '11px', color: '#64748b' }}>({m.tipo})</span>
                                                </td>
                                                {diasGantt.map((dia) => {
                                                    const contratoActivo = contratos.find((c) => {
                                                        const idsMaquinas = obtenerIdsMaquinasDeContrato(c, maquinarias, reportes);
                                                        const inicio = c.fecha_inicio;
                                                        const fin = c.fecha_fin || '2099-12-31';
                                                        return idsMaquinas.includes(idMaqStr) && dia >= inicio && dia <= fin;
                                                    });

                                                    return (
                                                        <td
                                                            key={dia}
                                                            style={{
                                                                textAlign: 'center',
                                                                padding: '4px',
                                                                backgroundColor: contratoActivo ? '#fef3c7' : '#f0fdf4',
                                                                border: '1px solid #e2e8f0'
                                                            }}
                                                            title={
                                                                contratoActivo
                                                                    ? `Asignada a ${contratoActivo.cliente_nombre || 'Cliente'} (${nombreContrato(contratoActivo)})`
                                                                    : 'Disponible'
                                                            }
                                                        >
                                                            <span
                                                                style={{
                                                                    width: '10px',
                                                                    height: '10px',
                                                                    borderRadius: '50%',
                                                                    display: 'inline-block',
                                                                    backgroundColor: contratoActivo ? '#f59e0b' : '#22c55e'
                                                                }}
                                                            />
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="adm-period-controls" style={{ marginTop: '16px', padding: '0 4px', display: 'flex', gap: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ width: '12px', height: '12px', backgroundColor: '#22c55e', borderRadius: '50%', display: 'inline-block' }} />
                                <span className="adm-card-sub" style={{ fontWeight: '700' }}>Disponible</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ width: '12px', height: '12px', backgroundColor: '#f59e0b', borderRadius: '50%', display: 'inline-block' }} />
                                <span className="adm-card-sub" style={{ fontWeight: '700' }}>Asignada a contrato</span>
                            </div>
                        </div>
                    </div>

                    <div className="adm-card">
                        <h3 className="adm-card-title" style={{ marginBottom: '16px' }}>Listado General de Contratos</h3>
                        <div className="adm-table-wrap">
                            <table className="adm-table">
                                <thead>
                                    <tr>
                                        <th>ID / Nombre Contrato</th>
                                        <th>Cliente</th>
                                        <th>Maquinaria Asignada</th>
                                        <th>Tarifa / Hora</th>
                                        <th>Fecha Inicio</th>
                                        <th>Fecha Término</th>
                                        <th>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {contratosFiltrados.map((c) => {
                                        const listaMaquinas = c.maquinas_contrato || [];

                                        return (
                                            <tr key={c.id_contrato || c.id}>
                                                <td>
                                                    <div className="contrato-cell-flex">
                                                        <span className="contrato-nombre-texto">{nombreContrato(c)}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <strong style={{ color: 'var(--ink)' }}>{c.cliente_nombre || 'Sin Cliente'}</strong>
                                                </td>
                                                <td>
                                                    {listaMaquinas.length > 0 ? (
                                                        listaMaquinas.map((item, idx) => {
                                                            const idM = typeof item.id_maquina === 'object' ? (item.id_maquina?.id_maquina || item.id_maquina?.id) : item.id_maquina;
                                                            const maqEncontrada = maquinarias.find(m => String(m.id_maquina || m.id) === String(idM));
                                                            return (
                                                                <div key={idx} style={{ marginBottom: '4px' }}>
                                                                    <span className="adm-fleet-badge">
                                                                        {maqEncontrada ? maqEncontrada.patente : `Equipo #${idM}`}
                                                                    </span>
                                                                    <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>
                                                                        {maqEncontrada?.tipo || ''}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })
                                                    ) : (
                                                        <span style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '12px' }}>
                                                            Sin asignación
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    {listaMaquinas.length > 0 ? (
                                                        listaMaquinas.map((item, idx) => (
                                                            <div key={idx} style={{ marginBottom: '3px' }}>
                                                                <span className="tarifa-chip-corp">
                                                                    ${parseInt(item.tarifa_hora || 0, 10).toLocaleString('es-CL')}/h
                                                                </span>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <span style={{ color: '#94a3b8', fontSize: '12px' }}>$0/h</span>
                                                    )}
                                                </td>
                                                <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{c.fecha_inicio}</td>
                                                <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{c.fecha_fin || 'Vigente'}</td>
                                                <td>
                                                    <span className="adm-badge-green">{c.estado_contrato || 'ACTIVO'}</span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    {contratosFiltrados.length === 0 && (
                                        <tr>
                                            <td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                                                No hay contratos registrados.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

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
                                    <button className="adm-search-clear" onClick={() => setBusquedaMaq('')}>✕</button>
                                )}
                            </div>
                            <button className="adm-btn-primary" onClick={toggleFormMaquinaria}>
                                {mostrarModalMaq ? 'Cerrar Formulario' : '+ Registrar Maquinaria'}
                            </button>
                        </div>
                    </div>

                    {mostrarModalMaq && (
                        <div className="adm-card adm-form-box">
                            <h3 className="adm-card-title">
                                {editandoMaqId ? `Modificar Maquinaria #${editandoMaqId}` : 'Registro de Maquinaria y Acreditación de Faena'}
                            </h3>
                            <form onSubmit={guardarMaquinaria} className="adm-crud-form" noValidate>
                                <div className="adm-grid-3">
                                    <div className="adm-field">
                                        <label>Patente / Identificador *</label>
                                        <input
                                            type="text"
                                            placeholder="Ej: AB-CD-12 o ABC-123"
                                            value={formMaq.patente}
                                            onChange={e => handleCambioMaq('patente', e.target.value)}
                                            onBlur={e => handleCambioMaq('patente', e.target.value)}
                                            maxLength={8}
                                            style={{ borderColor: erroresMaq.patente ? '#dc2626' : '' }}
                                        />
                                        {erroresMaq.patente ? (
                                            <span style={{ color: '#dc2626', fontSize: '11px', fontWeight: '700', marginTop: '4px', display: 'block' }}>
                                                {erroresMaq.patente}
                                            </span>
                                        ) : (
                                            <span style={{ color: '#64748b', fontSize: '10px', marginTop: '2px', display: 'block' }}>
                                                Formatos válidos: AB-CD-12, AB-12-34 o ABC-123
                                            </span>
                                        )}
                                    </div>

                                    <div className="adm-field">
                                        <label>Marca *</label>
                                        <input
                                            type="text"
                                            placeholder="Ej: Caterpillar"
                                            value={formMaq.marca}
                                            onChange={e => handleCambioMaq('marca', e.target.value)}
                                            onBlur={e => handleCambioMaq('marca', e.target.value)}
                                            style={{ borderColor: erroresMaq.marca ? '#dc2626' : '' }}
                                        />
                                        {erroresMaq.marca && (
                                            <span style={{ color: '#dc2626', fontSize: '11px', fontWeight: '700', marginTop: '4px', display: 'block' }}>
                                                {erroresMaq.marca}
                                            </span>
                                        )}
                                    </div>

                                    <div className="adm-field">
                                        <label>Modelo *</label>
                                        <input
                                            type="text"
                                            placeholder="Ej: 320D"
                                            value={formMaq.modelo}
                                            onChange={e => handleCambioMaq('modelo', e.target.value)}
                                            onBlur={e => handleCambioMaq('modelo', e.target.value)}
                                            style={{ borderColor: erroresMaq.modelo ? '#dc2626' : '' }}
                                        />
                                        {erroresMaq.modelo && (
                                            <span style={{ color: '#dc2626', fontSize: '11px', fontWeight: '700', marginTop: '4px', display: 'block' }}>
                                                {erroresMaq.modelo}
                                            </span>
                                        )}
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
                                            <option value="Camión Aljibe">Camión Aljibe</option>
                                        </select>
                                    </div>
                                    <div className="adm-field">
                                        <label>Horómetro Actual (hrs) *</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            placeholder="Ej: 1450.0"
                                            value={formMaq.horometro_actual}
                                            onChange={e => handleCambioMaq('horometro_actual', e.target.value)}
                                            onBlur={e => handleCambioMaq('horometro_actual', e.target.value)}
                                            style={{ borderColor: erroresMaq.horometro_actual ? '#dc2626' : '' }}
                                        />
                                        {erroresMaq.horometro_actual && (
                                            <span style={{ color: '#dc2626', fontSize: '11px', fontWeight: '700', marginTop: '4px', display: 'block' }}>
                                                {erroresMaq.horometro_actual}
                                            </span>
                                        )}
                                    </div>
                                    <div className="adm-field">
                                        <label>Estado Operativo</label>
                                        <select
                                            value={formMaq.estado}
                                            onChange={e => setFormMaq({ ...formMaq, estado: e.target.value })}
                                        >
                                            <option value="OPERATIVA">Operativa (disponible)</option>
                                            <option value="EN FAENA">En faena</option>
                                            <option value="EN TALLER">En taller</option>
                                            <option value="REQUIERE MANTENCIÓN">Requiere mantención</option>
                                        </select>
                                    </div>
                                </div>

                                <h4 style={{ marginTop: '20px', fontSize: '14px', color: 'var(--ink)' }}>Documentación de Acreditación de Faena (Patente)</h4>
                                <div className="adm-grid-3" style={{ marginTop: '10px' }}>
                                    <div className="adm-field">
                                        <label>SOAP (Seguro Obligatorio)</label>
                                        <input type="date" min={fechaHoy} value={formMaq.fecha_venc_soap} onChange={e => setFormMaq({ ...formMaq, fecha_venc_soap: e.target.value })} />
                                        <input type="file" accept="application/pdf,image/*" onChange={e => setArchivosMaq({ ...archivosMaq, soap: e.target.files[0] })} style={{ marginTop: '6px' }} />
                                    </div>
                                    <div className="adm-field">
                                        <label>Revisión Técnica</label>
                                        <input type="date" min={fechaHoy} value={formMaq.fecha_venc_rev_tecnica} onChange={e => setFormMaq({ ...formMaq, fecha_venc_rev_tecnica: e.target.value })} />
                                        <input type="file" accept="application/pdf,image/*" onChange={e => setArchivosMaq({ ...archivosMaq, rev_tecnica: e.target.files[0] })} style={{ marginTop: '6px' }} />
                                    </div>
                                    <div className="adm-field">
                                        <label>Permiso de Circulación</label>
                                        <input type="date" min={fechaHoy} value={formMaq.fecha_venc_permiso} onChange={e => setFormMaq({ ...formMaq, fecha_venc_permiso: e.target.value })} />
                                        <input type="file" accept="application/pdf,image/*" onChange={e => setArchivosMaq({ ...archivosMaq, permiso: e.target.files[0] })} style={{ marginTop: '6px' }} />
                                    </div>
                                </div>

                                {erroresMaq.general && (
                                    <div className="adm-alert-fail" style={{ marginTop: '16px' }}>{erroresMaq.general}</div>
                                )}
                                <div className="adm-form-actions" style={{ marginTop: '20px' }}>
                                    <button type="submit" className="adm-btn-submit">
                                        {editandoMaqId ? 'Guardar Cambios' : 'Guardar Maquinaria'}
                                    </button>
                                    <button type="button" className="adm-btn-secondary" onClick={toggleFormMaquinaria}>
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
                                        <th>Horómetro</th>
                                        <th>Estado SOAP</th>
                                        <th>Estado Rev. Técnica</th>
                                        <th>ESTADO PERMISO</th>
                                        <th>Documentos S3</th>
                                        <th style={{ textAlign: 'center', width: '130px' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {maquinariasFiltradas.map(m => {
                                        const docSoapObj = obtenerDocMaquina(m.id_maquina, 'SOAP', documentosMaq);
                                        const docRevObj = obtenerDocMaquina(m.id_maquina, 'REVISI', documentosMaq);
                                        const docPermisoObj = obtenerDocMaquina(m.id_maquina, 'PERMISO', documentosMaq);

                                        const stSoap = evaluarVencimiento(docSoapObj?.fecha_vencimiento || m.fecha_venc_soap);
                                        const stRev = evaluarVencimiento(docRevObj?.fecha_vencimiento || m.fecha_venc_rev_tecnica);
                                        const stPermiso = evaluarVencimiento(docPermisoObj?.fecha_vencimiento || m.fecha_venc_permiso);

                                        const urlSoap = docSoapObj?.url_archivo || m.doc_soap;
                                        const urlRev = docRevObj?.url_archivo || m.doc_rev_tecnica;
                                        const urlPermiso = docPermisoObj?.url_archivo || m.doc_permiso;

                                        return (
                                            <tr key={m.id_maquina}>
                                                <td>#{m.id_maquina}</td>
                                                <td><strong>{m.patente}</strong></td>
                                                <td>{m.marca} {m.modelo} <span className="adm-tag" style={{ marginLeft: '4px' }}>{m.tipo}</span></td>
                                                <td style={{ fontWeight: '800', fontFamily: 'Consolas, monospace' }}>
                                                    {(m.horometro_actual ?? m.horometro ?? 0)} hrs
                                                </td>
                                                <td><span className={stSoap.clase} title={stSoap.detalle}>{stSoap.texto}</span></td>
                                                <td><span className={stRev.clase} title={stRev.detalle}>{stRev.texto}</span></td>
                                                <td><span className={stPermiso.clase} title={stPermiso.detalle}>{stPermiso.texto}</span></td>

                                                <td>
                                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                        {urlSoap && (
                                                            <button type="button" className="adm-btn-file-view s3-ready" onClick={() => abrirVisorDoc({ url: urlSoap, titulo: `SOAP - ${m.patente}` })}>
                                                                SOAP
                                                            </button>
                                                        )}
                                                        {urlRev && (
                                                            <button type="button" className="adm-btn-file-view s3-ready" onClick={() => abrirVisorDoc({ url: urlRev, titulo: `Rev. Técnica - ${m.patente}` })}>
                                                                Rev. Téc
                                                            </button>
                                                        )}
                                                        {urlPermiso && (
                                                            <button type="button" className="adm-btn-file-view s3-ready" onClick={() => abrirVisorDoc({ url: urlPermiso, titulo: `Permiso Circ. - ${m.patente}` })}>
                                                                Permiso
                                                            </button>
                                                        )}
                                                        {!urlSoap && !urlRev && !urlPermiso && <span style={{ fontSize: '11px', color: '#94a3b8' }}>Sin adjuntos</span>}
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                    <button type="button" className="adm-action-btn edit" onClick={() => abrirEdicionMaquinaria(m)}>Editar</button>
                                                    <button type="button" className="adm-action-btn delete" onClick={() => confirmarEliminarMaquinaria(m)}>Borrar</button>
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

            {tabActiva === 'operadores' && (
                <div className="adm-tab-content">
                    <div className="adm-action-bar">
                        <h2>Nómina de Operadores</h2>
                        <div className="adm-action-tools">
                            <div className="adm-search-wrap">
                                <input
                                    type="text"
                                    className="adm-search-input"
                                    placeholder="Buscar por nombre, apellido o RUT..."
                                    value={busquedaOp}
                                    onChange={(e) => setBusquedaOp(e.target.value)}
                                />
                                {busquedaOp && (
                                    <button className="adm-search-clear" onClick={() => setBusquedaOp('')}>✕</button>
                                )}
                            </div>

                            <button className="adm-btn-primary" onClick={toggleFormOperador}>
                                {mostrarModalOp ? 'Cerrar Formulario' : '+ Registrar Operador'}
                            </button>
                        </div>
                    </div>

                    {mostrarModalOp && (
                        <div className="adm-card adm-form-box">
                            <h3 className="adm-card-title">{editandoOpId ? `Modificar Operador #${editandoOpId}` : 'Registro de Operador'}</h3>
                            <form onSubmit={guardarOperador} className="adm-crud-form" noValidate>
                                <div className="adm-grid-3">
                                    <div className="adm-field">
                                        <label>Nombre *</label>
                                        <input
                                            type="text"
                                            placeholder="Ej: Juan"
                                            value={formOp.nombre}
                                            onChange={e => handleCambioOp('nombre', e.target.value)}
                                            onBlur={e => handleCambioOp('nombre', e.target.value)}
                                            style={{ borderColor: erroresOp.nombre ? '#dc2626' : '' }}
                                        />
                                        {erroresOp.nombre && (
                                            <span style={{ color: '#dc2626', fontSize: '11px', fontWeight: '700', marginTop: '4px', display: 'block' }}>
                                                {erroresOp.nombre}
                                            </span>
                                        )}
                                    </div>
                                    <div className="adm-field">
                                        <label>Apellido *</label>
                                        <input
                                            type="text"
                                            placeholder="Ej: Pérez"
                                            value={formOp.apellido}
                                            onChange={e => handleCambioOp('apellido', e.target.value)}
                                            onBlur={e => handleCambioOp('apellido', e.target.value)}
                                            style={{ borderColor: erroresOp.apellido ? '#dc2626' : '' }}
                                        />
                                        {erroresOp.apellido && (
                                            <span style={{ color: '#dc2626', fontSize: '11px', fontWeight: '700', marginTop: '4px', display: 'block' }}>
                                                {erroresOp.apellido}
                                            </span>
                                        )}
                                    </div>
                                    <div className="adm-field">
                                        <label>RUT Operador *</label>
                                        <input
                                            type="text"
                                            placeholder="Ej: 12.345.678-9"
                                            value={formOp.rut}
                                            onChange={e => handleCambioOp('rut', e.target.value)}
                                            onBlur={e => handleCambioOp('rut', e.target.value)}
                                            style={{ borderColor: erroresOp.rut ? '#dc2626' : '' }}
                                        />
                                        {erroresOp.rut && (
                                            <span style={{ color: '#dc2626', fontSize: '11px', fontWeight: '700', marginTop: '4px', display: 'block' }}>
                                                {erroresOp.rut}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="adm-grid-2" style={{ marginTop: '14px' }}>
                                    <div className="adm-field">
                                        <label>{editandoOpId ? 'Nueva contraseña (opcional)' : 'Contraseña de acceso *'}</label>
                                        <input
                                            type="text"
                                            autoComplete="off"
                                            placeholder={editandoOpId ? 'Dejar vacío para no cambiarla' : 'Mínimo 6 caracteres'}
                                            value={formOp.password}
                                            onChange={e => handleCambioOp('password', e.target.value)}
                                            style={{ borderColor: erroresOp.password ? '#dc2626' : '' }}
                                        />
                                        {erroresOp.password ? (
                                            <span style={{ color: '#dc2626', fontSize: '11px', fontWeight: '700', marginTop: '4px', display: 'block' }}>
                                                {erroresOp.password}
                                            </span>
                                        ) : (
                                            <span style={{ color: '#64748b', fontSize: '10px', marginTop: '2px', display: 'block' }}>
                                                El operador ingresa al sistema con su RUT y esta contraseña.
                                            </span>
                                        )}
                                    </div>
                                    <div className="adm-field">
                                        <label>Fecha Vencimiento Licencia</label>
                                        <input
                                            type="date"
                                            min={fechaHoy}
                                            value={formOp.fecha_vencimiento_licencia}
                                            onChange={e => { setFormOp({ ...formOp, fecha_vencimiento_licencia: e.target.value }); setErroresOp(prev => ({ ...prev, fecha_vencimiento_licencia: null })); }}
                                            style={{ borderColor: erroresOp.fecha_vencimiento_licencia ? '#dc2626' : '' }}
                                        />
                                        {erroresOp.fecha_vencimiento_licencia && (
                                            <span style={{ color: '#dc2626', fontSize: '11px', fontWeight: '700', marginTop: '4px', display: 'block' }}>
                                                {erroresOp.fecha_vencimiento_licencia}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="adm-field" style={{ marginTop: '14px' }}>
                                    <label>Tipos de Licencia</label>
                                    <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginTop: '8px' }}>
                                        {['Clase D', 'Clase A4', 'Clase A5', 'Clase B'].map((lic) => {
                                            const listadoActual = Array.isArray(formOp.TipoLicencia)
                                                ? formOp.TipoLicencia
                                                : (formOp.TipoLicencia || '').split(',').map(l => l.trim());
                                            const checked = listadoActual.includes(lic);

                                            return (
                                                <label key={lic} className="adm-period-controls" style={{ cursor: 'pointer' }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setFormOp({ ...formOp, TipoLicencia: [...listadoActual, lic] });
                                                            } else {
                                                                setFormOp({ ...formOp, TipoLicencia: listadoActual.filter(l => l !== lic) });
                                                            }
                                                        }}
                                                    />
                                                    <span style={{ fontSize: '13px', fontWeight: '700' }}>{lic}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                    {erroresOp.TipoLicencia && (
                                        <span style={{ color: '#dc2626', fontSize: '11px', fontWeight: '700', marginTop: '4px', display: 'block' }}>
                                            {erroresOp.TipoLicencia}
                                        </span>
                                    )}
                                </div>

                                <div className="adm-uploader-box" style={{ marginTop: '14px' }}>
                                    <label className="adm-uploader-label">
                                        <span className="adm-uploader-title">
                                            {archivoLicencia ? 'Licencia Seleccionada' : 'Adjuntar Documento de Licencia'}
                                        </span>
                                        <input
                                            type="file"
                                            accept="application/pdf,image/*"
                                            style={{ display: 'none' }}
                                            onChange={(e) => e.target.files?.[0] && setArchivoLicencia(e.target.files[0])}
                                        />
                                    </label>
                                </div>

                                {erroresOp.general && (
                                    <div className="adm-alert-fail" style={{ marginTop: '16px' }}>{erroresOp.general}</div>
                                )}
                                <div className="adm-form-actions" style={{ marginTop: '20px' }}>
                                    <button type="submit" className="adm-btn-submit">
                                        {editandoOpId ? 'Guardar Cambios' : 'Guardar Operador'}
                                    </button>
                                    <button type="button" className="adm-btn-secondary" onClick={toggleFormOperador}>
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
                                        <th>NOMBRE Y APELLIDO</th>
                                        <th>RUT</th>
                                        <th>LICENCIAS</th>
                                        <th>ESTADO LICENCIA</th>
                                        <th>DOCUMENTOS S3</th>
                                        <th style={{ textAlign: 'center', width: '130px' }}>ACCIONES</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {operadoresFiltrados.map(op => {
                                        const stLic = evaluarVencimiento(op.fecha_vencimiento_licencia);
                                        const urlLic = op.licencia_url || op.url_licencia || op.archivo_licencia;

                                        const listaLicencias = Array.isArray(op.TipoLicencia)
                                            ? op.TipoLicencia
                                            : (op.TipoLicencia ? op.TipoLicencia.split(',').map(l => l.trim()) : ['Clase D']);

                                        return (
                                            <tr key={op.id_operador}>
                                                <td style={{ fontWeight: '800', color: '#64748b' }}>#{op.id_operador}</td>
                                                <td>
                                                    <strong style={{ color: 'var(--ink)', fontSize: '13px' }}>
                                                        {op.id_usuario?.nombre || op.nombre || 'Operador'} {op.id_usuario?.apellido || op.apellido || ''}
                                                    </strong>
                                                </td>
                                                <td>
                                                    <span className="adm-code-tag">
                                                        {op.id_usuario?.rut || op.rut || 'N/A'}
                                                    </span>
                                                </td>

                                                <td>
                                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                                        {listaLicencias.map((lic, idx) => (
                                                            <span key={idx} className="adm-tag-amber">
                                                                {lic}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </td>

                                                <td><span className={stLic.clase} title={stLic.detalle}>{stLic.texto}</span></td>

                                                <td>
                                                    {urlLic ? (
                                                        <button
                                                            type="button"
                                                            className="adm-btn-file-view s3-ready"
                                                            onClick={() => abrirVisorDoc({
                                                                url: urlLic,
                                                                titulo: `Licencia - ${op.id_usuario?.nombre || op.nombre}`,
                                                                subtitulo: `Licencias: ${listaLicencias.join(', ')}`
                                                            })}
                                                        >
                                                            Ver Documento
                                                        </button>
                                                    ) : (
                                                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>Sin documento</span>
                                                    )}
                                                </td>

                                                <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                    <button type="button" className="adm-action-btn edit" onClick={() => abrirEdicionOperador(op)}>Editar</button>
                                                    <button type="button" className="adm-action-btn delete" onClick={() => confirmarEliminarOperador(op)}>Borrar</button>
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

            {tabActiva === 'gastos' && (
                <div className="adm-tab-content">
                    <div className="adm-action-bar">
                        <h2>Registro y Control de Gastos</h2>
                        <button className="adm-btn-primary" onClick={toggleFormGasto}>
                            {mostrarModalGasto ? 'Cerrar Formulario' : '+ Registrar Gasto'}
                        </button>
                    </div>

                    <div className="adm-period-controls" style={{ marginBottom: '14px' }}>
                        <div className="adm-search-wrap" style={{ flex: 1, minWidth: '220px' }}>
                            <input
                                type="text"
                                className="adm-search-input"
                                placeholder="Buscar por categoría o comprobante..."
                                value={busquedaGasto}
                                onChange={(e) => setBusquedaGasto(e.target.value)}
                            />
                            {busquedaGasto && (
                                <button className="adm-search-clear" onClick={() => setBusquedaGasto('')}>✕</button>
                            )}
                        </div>

                        <select
                            value={filtroGastoMaquina}
                            onChange={(e) => setFiltroGastoMaquina(e.target.value)}
                            className="adm-select-period"
                        >
                            <option value="todos">Todas las máquinas</option>
                            {maquinarias.map(m => (
                                <option key={m.id_maquina} value={m.id_maquina}>
                                    {m.patente} ({m.modelo})
                                </option>
                            ))}
                        </select>

                        <select
                            value={filtroGastoContrato}
                            onChange={(e) => setFiltroGastoContrato(e.target.value)}
                            className="adm-select-period"
                        >
                            <option value="todos">Todos los contratos</option>
                            {contratos.map(c => (
                                <option key={c.id_contrato} value={c.id_contrato}>
                                    {nombreContrato(c)} - {c.cliente_nombre || c.cliente || c.id_cliente?.razon_social || 'Cliente'}
                                </option>
                            ))}
                        </select>

                    </div>

                    {mostrarModalGasto && (
                        <div className="adm-card adm-form-box">
                            <h3 className="adm-card-title">{editandoGastoId ? `Modificar Gasto #${editandoGastoId}` : 'Registro de Gasto Operativo'}</h3>
                            <form onSubmit={guardarGasto} className="adm-crud-form" noValidate>
                                <div className="adm-grid-3">
                                    <div className="adm-field">
                                        <label>Categoría del Gasto</label>
                                        <select
                                            value={formGasto.categoria_gasto}
                                            onChange={e => setFormGasto({ ...formGasto, categoria_gasto: e.target.value })}
                                        >
                                            <option value="Combustible">Combustible / Diesel</option>
                                            <option value="Repuesto">Repuestos y Componentes</option>
                                            <option value="Viatico">Viáticos</option>
                                            <option value="Lubricante">Lubricantes y Filtros</option>
                                            <option value="Taller">Servicio Técnico / Taller</option>
                                            <option value="Traslado">Traslado / Flete</option>
                                        </select>
                                    </div>
                                    <div className="adm-field">
                                        <label>Monto ($CLP) *</label>
                                        <input
                                            type="number"
                                            placeholder="Ej: 65000"
                                            value={formGasto.monto}
                                            onChange={e => handleCambioGasto('monto', e.target.value)}
                                            onBlur={e => handleCambioGasto('monto', e.target.value)}
                                            style={{ borderColor: erroresGasto.monto ? '#dc2626' : '' }}
                                        />
                                        {erroresGasto.monto && (
                                            <span style={{ color: '#dc2626', fontSize: '11px', fontWeight: '700', marginTop: '4px', display: 'block' }}>
                                                {erroresGasto.monto}
                                            </span>
                                        )}
                                    </div>
                                    <div className="adm-field">
                                        <label>Maquinaria Asignada *</label>
                                        <select
                                            value={formGasto.id_maquina}
                                            onChange={e => handleCambioGasto('id_maquina', e.target.value)}
                                            style={{ borderColor: erroresGasto.id_maquina ? '#dc2626' : '' }}
                                        >
                                            <option value="">Seleccione maquinaria...</option>
                                            {maquinarias.map(m => (
                                                <option key={m.id_maquina} value={m.id_maquina}>
                                                    {m.patente} - {m.marca} {m.modelo}
                                                </option>
                                            ))}
                                        </select>
                                        {erroresGasto.id_maquina && (
                                            <span style={{ color: '#dc2626', fontSize: '11px', fontWeight: '700', marginTop: '4px', display: 'block' }}>
                                                {erroresGasto.id_maquina}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="adm-grid-3" style={{ marginTop: '14px' }}>
                                    <div className="adm-field">
                                        <label>Contrato Asociado (Opcional)</label>
                                        <select
                                            value={formGasto.id_contrato}
                                            onChange={e => setFormGasto({ ...formGasto, id_contrato: e.target.value })}
                                        >
                                            <option value="">Sin Contrato Asociado</option>
                                            {contratos.map(c => (
                                                <option key={c.id_contrato} value={c.id_contrato}>
                                                    {nombreContrato(c)} ({c.cliente_nombre || c.cliente || c.id_cliente?.razon_social || 'Cliente'})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="adm-field">
                                        <label>Fecha</label>
                                        <input
                                            type="date"
                                            max={fechaHoy}
                                            value={formGasto.fecha}
                                            onChange={e => setFormGasto({ ...formGasto, fecha: e.target.value })}
                                        />
                                    </div>
                                    <div className="adm-field">
                                        <label>N° Comprobante / Documento</label>
                                        <input
                                            type="text"
                                            placeholder="Ej: FACT-9821 / TICKET-441"
                                            value={formGasto.numero_comprobante}
                                            onChange={e => setFormGasto({ ...formGasto, numero_comprobante: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="adm-uploader-box" style={{ marginTop: '14px' }}>
                                    <label className="adm-uploader-label">
                                        <span className="adm-uploader-title">
                                            {archivoGasto ? 'Comprobante Seleccionado' : 'Adjuntar Comprobante'}
                                        </span>
                                        <span className="adm-uploader-sub">
                                            Tickets, facturas o guías (PDF o Imagen)
                                        </span>
                                        <input
                                            type="file"
                                            accept="application/pdf,image/*"
                                            style={{ display: 'none' }}
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files[0]) {
                                                    setArchivoGasto(e.target.files[0]);
                                                }
                                            }}
                                        />
                                    </label>
                                    {archivoGasto && (
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--surface-2)', padding: '10px 14px', borderRadius: '8px', marginTop: '10px' }}>
                                            <span className="adm-file-chip">
                                                {archivoGasto.name} ({(archivoGasto.size / 1024).toFixed(1)} KB)
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setArchivoGasto(null)}
                                                style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontWeight: '800' }}
                                            >
                                                Quitar archivo
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {erroresGasto.general && (
                                    <div className="adm-alert-fail" style={{ marginTop: '16px' }}>{erroresGasto.general}</div>
                                )}
                                <div className="adm-form-actions" style={{ marginTop: '20px' }}>
                                    <button type="submit" className="adm-btn-submit">
                                        {editandoGastoId ? 'Guardar Cambios' : 'Guardar Gasto'}
                                    </button>
                                    <button type="button" className="adm-btn-secondary" onClick={toggleFormGasto}>
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
                                        <th>Documento</th>
                                        <th>Maquinaria</th>
                                        <th>Contrato</th>
                                        <th style={{ textAlign: 'right' }}>Monto ($CLP)</th>
                                        <th style={{ textAlign: 'center', width: '130px' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {gastosFiltrados.map(g => {
                                        const maqGasto = maquinarias.find(m => m.id_maquina === g.id_maquina || m.id_maquina === g.id_maquina?.id_maquina);
                                        const urlComp = g.comprobante_url || g.url_comprobante || g.archivo_comprobante;

                                        return (
                                            <tr key={g.id_gasto}>
                                                <td>{formatoFechaCL(g.fecha)}</td>
                                                <td><span className="adm-tag">{g.categoria_gasto}</span></td>
                                                <td><span className="adm-code-tag">{g.numero_comprobante || 'S/N'}</span></td>
                                                <td>
                                                    {urlComp ? (
                                                        <button
                                                            type="button"
                                                            className="adm-btn-file-view s3-ready"
                                                            onClick={() => abrirVisorDoc({
                                                                url: urlComp,
                                                                titulo: `Comprobante ${g.categoria_gasto} - N° ${g.numero_comprobante || 'S/N'}`,
                                                                subtitulo: `Monto: $${parseInt(g.monto, 10).toLocaleString('es-CL')} - Fecha: ${g.fecha}`,
                                                                folio: g.numero_comprobante || 'S/N'
                                                            })}
                                                        >
                                                            Ver Documento
                                                        </button>
                                                    ) : (
                                                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>Sin documento</span>
                                                    )}
                                                </td>
                                                <td>
                                                    {maqGasto ? (
                                                        <span className="adm-fleet-badge">
                                                            {maqGasto.patente}
                                                        </span>
                                                    ) : (
                                                        `Maquinaria ID #${g.id_maquina}`
                                                    )}
                                                </td>
                                                <td>
                                                    {g.contrato_nombre
                                                        ? <strong>{g.contrato_nombre}</strong>
                                                        : <span style={{ fontSize: '11px', color: '#94a3b8' }}>Gasto general</span>}
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: '900', color: '#dc2626' }}>
                                                    ${parseInt(g.monto, 10).toLocaleString('es-CL')}
                                                </td>
                                                <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                    <button
                                                        type="button"
                                                        className="adm-action-btn edit"
                                                        onClick={() => abrirEdicionGasto(g)}
                                                    >
                                                        Editar
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="adm-action-btn delete"
                                                        onClick={() => confirmarEliminarGasto(g)}
                                                    >
                                                        Borrar
                                                    </button>
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

            {tabActiva === 'turnos' && (
                <div className="adm-tab-content">
                    <div className="adm-action-bar">
                        <div>
                            <h2>Control de Partes Diarios</h2>
                            <p className="adm-card-sub">
                                Registro de horas trabajadas y cálculo de facturación por máquina.
                            </p>
                        </div>
                    </div>

                    <div className="adm-card">
                        <div className="adm-table-wrap">
                            <table className="adm-table">
                                <thead>
                                    <tr>
                                        <th>ID Parte</th>
                                        <th style={{ minWidth: '110px' }}>Fecha</th>
                                        <th>Maquinaria</th>
                                        <th>Cliente / Contrato</th>
                                        <th style={{ textAlign: 'right' }}>Tarifa Hora</th>
                                        <th>Horómetro (Ini - Fin)</th>
                                        <th style={{ textAlign: 'right' }}>Horas Trabajadas</th>
                                        <th style={{ textAlign: 'right' }}>Monto Estimado</th>
                                        <th>Combustible</th>
                                        <th>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reportes.map(r => {
                                        const maq = maquinarias.find(m => m.id_maquina === r.id_maquina || m.id === r.id_maquina);
                                        const tieneContrato = Boolean(r.id_contrato);
                                        const horas = parseFloat(r.horas_trabajadas) || 0;
                                        const tarifa = parseFloat(r.tarifa_hora) || 0;
                                        const ingresoTurno = parseFloat(r.ingreso_estimado) || 0;
                                        const litros = parseFloat(r.combustible_litros) || 0;

                                        return (
                                            <tr key={r.id_report}>
                                                <td>#{r.id_report}</td>
                                                <td style={{ whiteSpace: 'nowrap', fontWeight: '700', fontFamily: 'Consolas, monospace' }}>
                                                    {formatoFechaCL(r.fecha)}
                                                </td>
                                                <td>
                                                    <span className="adm-fleet-badge">
                                                        {maq ? maq.patente : (r.maquina_patente || `ID #${r.id_maquina}`)}
                                                    </span>
                                                    <div className="adm-fleet-type">{maq?.tipo || ''}</div>
                                                </td>
                                                <td>
                                                    {tieneContrato ? (
                                                        <>
                                                            <strong>{r.contrato_nombre || 'Contrato'}</strong>
                                                            <div className="adm-fleet-type">{r.cliente_nombre || ''}</div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <strong style={{ color: '#94a3b8' }}>Sin contrato</strong>
                                                            <div className="adm-fleet-type">Parte anterior al control por contrato</div>
                                                        </>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: '700' }}>
                                                    {tarifa > 0 ? `${formatoCLP(tarifa)}/h` : '—'}
                                                </td>
                                                <td>{r.horometro_inicial} hrs - {r.horometro_final} hrs</td>
                                                <td style={{ textAlign: 'right', fontWeight: '800', color: '#b45309' }}>
                                                    {horas.toFixed(1)} hrs
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: '900', color: tieneContrato ? '#16a34a' : '#94a3b8' }}>
                                                    {tieneContrato ? formatoCLP(ingresoTurno) : '—'}
                                                </td>
                                                <td>{litros > 0 ? `${litros} L` : 'Sin carga'}</td>
                                                <td>
                                                    {r.firmado ? (
                                                        <span className="adm-badge-green">Firmado</span>
                                                    ) : (
                                                        <span className="adm-badge-red">Pendiente</span>
                                                    )}
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

            {modalEliminar.abierto && (
                <div className="adm-modal-overlay" onClick={cerrarModalEliminar}>
                    <div className="adm-modal-content" style={{ maxWidth: '480px' }} onClick={e => e.stopPropagation()}>
                        <div className="adm-modal-header">
                            <div className="adm-modal-title-group">
                                <h3>{modalEliminar.titulo}</h3>
                            </div>
                            <button
                                onClick={cerrarModalEliminar}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '18px',
                                    fontWeight: '800',
                                    cursor: 'pointer',
                                    color: modoNoche ? '#cbd5e1' : '#64748b'
                                }}
                            >
                                ✕
                            </button>
                        </div>

                        <div className="adm-modal-body" style={{ padding: '20px 24px', display: 'block' }}>
                            <p style={{ margin: 0, fontSize: '14px', color: modoNoche ? '#cbd5e1' : '#334155', lineHeight: '1.5' }}>
                                {modalEliminar.mensaje}
                            </p>
                        </div>

                        <div className="adm-modal-footer" style={{ justifyContent: 'flex-end', gap: '12px' }}>
                            <button
                                type="button"
                                className="adm-btn-secondary"
                                onClick={cerrarModalEliminar}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className="adm-btn-submit"
                                style={{ backgroundColor: '#dc2626' }}
                                onClick={modalEliminar.onConfirmar}
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {modalDoc.abierto && (
                <div className="adm-modal-overlay" onClick={cerrarVisorDoc}>
                    <div className="adm-modal-content" onClick={e => e.stopPropagation()}>
                        <div className="adm-modal-header">
                            <div className="adm-modal-title-group">
                                <h3>{modalDoc.titulo}</h3>
                                <p>{modalDoc.subtitulo} {modalDoc.folio && `- Referencia: ${modalDoc.folio}`}</p>
                            </div>
                            <div className="adm-modal-actions">
                                <a
                                    href={modalDoc.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="adm-btn-file-view s3-ready"
                                    style={{ textDecoration: 'none' }}
                                >
                                    Abrir en Pestaña Nueva
                                </a>
                                <button
                                    onClick={cerrarVisorDoc}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        fontSize: '18px',
                                        fontWeight: '800',
                                        cursor: 'pointer',
                                        color: modoNoche ? '#cbd5e1' : '#64748b',
                                        padding: '4px 8px'
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div className="adm-modal-body">
                            {modalDoc.esPdf ? (
                                <iframe
                                    src={modalDoc.url}
                                    title={modalDoc.titulo}
                                    style={{ width: '100%', height: '520px', border: 'none', borderRadius: '8px' }}
                                />
                            ) : (
                                <img
                                    src={modalDoc.url}
                                    alt={modalDoc.titulo}
                                    style={{
                                        maxWidth: '100%',
                                        maxHeight: '520px',
                                        objectFit: 'contain',
                                        borderRadius: '8px',
                                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                                    }}
                                />
                            )}
                        </div>

                        <div className="adm-modal-footer">
                            <span>Visualizador de Documentos</span>
                            <button
                                type="button"
                                className="adm-btn-secondary"
                                onClick={cerrarVisorDoc}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}