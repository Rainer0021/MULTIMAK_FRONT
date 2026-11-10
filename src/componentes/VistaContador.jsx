import React, { useState, useEffect } from 'react';
import axios from '../api/axios'; // Importa la instancia centralizada que inyecta el token
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

// telefono 9 digitos
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

// Fecha de hoy en hora local 
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

const diasHasta = (iso) => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return Math.round((aFechaLocal(iso) - hoy) / 86400000);
};

const textoDias = (n) => `${n} ${n === 1 ? 'día' : 'días'}`;

// CONTRATOS Y MÁQUINAS OCUPADAS 
const ESTADOS_CONTRATO_VIGENTES = ['ACTIVO', 'PRORROGADO'];

const nombreDeContrato = (c) => c.nombre_contrato || `Contrato #${c.id_contrato}`;

// Devuelve el contrato vigente que ya usa esa máquina en el período indicado 
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

    // Estados de Datos de la API
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

    // Filtros y Pestañas
    const [filtroTipo, setFiltroTipo] = useState('todos');
    const [busqueda, setBusqueda] = useState('');
    const [busquedaContratoContador, setBusquedaContratoContador] = useState('');
    const [pestaña, setPestaña] = useState('facturacion_hes');

    const [mostrarFormContrato, setMostrarFormContrato] = useState(false);

    // FORMULARIO NUEVO CONTRATO
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

    // Modales de Trabajo y Formulario Factura / HES
    const [modalHes, setModalHes] = useState({ abierto: false, idContrato: '', numeroHes: '', totalHoras: '', estado: 'APROBADA' });
    const [modalFactura, setModalFactura] = useState({ abierto: false, idHes: '', folioDTE: '', montoNeto: '', iva: 0, montoTotal: 0 });
    const [modalProrroga, setModalProrroga] = useState({ abierto: false, idContrato: null, nuevaFechaFin: '' });
    const [modalDoc, setModalDoc] = useState({ abierto: false, url: '', titulo: '', subtitulo: '', esPdf: false });

    // Carpeta Tributaria Digital
    const [archivoDocEmpresa, setArchivoDocEmpresa] = useState(null);
    const [tipoDocEmpresa, setTipoDocEmpresa] = useState('F30');


    const cargarDatosFinancieros = async () => {
        setCargando(true);
        try {
            const [resGas, resRep, resMaq, resCont, resCli, resHes, resFact, resDocs] = await Promise.all([
                axios.get('/gastos/').catch(() => axios.get('/api/gastos/')).catch(() => ({ data: [] })),
                axios.get('/reports/').catch(() => axios.get('/api/reports/')).catch(() => ({ data: [] })),
                axios.get('/maquinarias/').catch(() => axios.get('/api/maquinarias/')).catch(() => ({ data: [] })),
                axios.get('/contratos/').catch(() => axios.get('/api/contratos/')).catch(() => ({ data: [] })),
                axios.get('/clientes/').catch(() => axios.get('/api/clientes/')).catch(() => ({ data: [] })),
                axios.get('/hes/').catch(() => axios.get('/api/hes/')).catch(() => ({ data: [] })),
                axios.get('/facturas/').catch(() => axios.get('/api/facturas/')).catch(() => ({ data: [] })),
                axios.get('/doc-empresa/').catch(() => axios.get('/api/doc-empresa/')).catch(() => ({ data: [] }))
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
            console.error('No se pudieron cargar los datos contables. Recarga la página.', err);
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

    // FUNCIONES DEL FORMULARIO DE MAQUINARIAS 
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

        if (!formContrato.id_cliente) {
            errores.id_cliente = 'Selecciona un cliente';
        }

        if (!formContrato.fecha_inicio) {
            errores.fecha_inicio = 'Ingresa la fecha de inicio.';
        } else if (formContrato.fecha_inicio < fechaHoy) {
            errores.fecha_inicio = 'La fecha de inicio no puede ser anterior a hoy.';
        }
        if (!formContrato.fecha_fin) {
            errores.fecha_fin = 'Ingresa la fecha de término pactada.';
        } else if (formContrato.fecha_inicio && formContrato.fecha_fin < formContrato.fecha_inicio) {
            errores.fecha_fin = 'La fecha de término no puede ser anterior a la de inicio.';
        }

        const erroresMaquinas = formContrato.maquinas_asignadas.map((m, i) => {
            const fila = { id_maquina: '', tarifa_hora: '', detalle: '' };
            if (!m.id_maquina) {
                fila.id_maquina = 'Selecciona un equipo';
            } else {
                const repetida = formContrato.maquinas_asignadas.some((o, j) => j !== i && String(o.id_maquina) === String(m.id_maquina));
                const choque = buscarChoqueMaquina(contratos, m.id_maquina, formContrato.fecha_inicio, formContrato.fecha_fin || formContrato.fecha_inicio);
                const maq = maquinarias.find(x => String(x.id_maquina || x.id) === String(m.id_maquina));
                const patente = maq ? maq.patente : `#${m.id_maquina}`;
                if (repetida) {
                    fila.id_maquina = 'Repetida';
                    fila.detalle = `La máquina ${patente} está repetida en este contrato.`;
                } else if (choque) {
                    const hasta = choque.fecha_fin ? formatoFechaCL(choque.fecha_fin) : 'sin término';
                    fila.id_maquina = 'Ocupada';
                    fila.detalle = `La máquina ${patente} ya está asignada a «${nombreDeContrato(choque)}» (hasta ${hasta}). Elige otra o cambie las fechas.`;
                }
            }
            if (!m.tarifa_hora) fila.tarifa_hora = 'Ingresa tarifa';
            else if (parseInt(m.tarifa_hora, 10) <= 0) fila.tarifa_hora = 'La tarifa debe ser mayor a $0';
            return fila;
        });

        const hayErrorMaquina = erroresMaquinas.some(m => m.id_maquina || m.tarifa_hora);

        if (Object.keys(errores).length > 0 || hayErrorMaquina) {
            setErroresFormContrato({ ...errores, maquinas: erroresMaquinas });
            mostrarNotificacion('Revisa los campos marcado en rojo.', 'error');
            return;
        }

        setErroresFormContrato({});

        try {
            const payloadContrato = {
                nombre_contrato: formContrato.nombre_contrato.trim(),
                id_cliente: parseInt(formContrato.id_cliente, 10),
                fecha_inicio: formContrato.fecha_inicio,
                fecha_fin: formContrato.fecha_fin || formContrato.fecha_inicio,
                estado_contrato: formContrato.estado_contrato
            };

            const resContrato = await axios.post('contratos/', payloadContrato)
                .catch(() => axios.post('/contratos/', payloadContrato));

            const idNuevoContrato = resContrato.data?.id_contrato || resContrato.data?.id;

            if (idNuevoContrato) {
                const promesas = formContrato.maquinas_asignadas.map(m => {
                    const payloadIntermedia = {
                        id_contrato: idNuevoContrato,
                        id_maquina: parseInt(m.id_maquina, 10),
                        tarifa_hora: parseInt(m.tarifa_hora, 10)
                    };
                    return axios.post('contrato-maquinarias/', payloadIntermedia)
                        .catch(() => axios.post('/contrato-maquinarias/', payloadIntermedia));
                });

                try {
                    await Promise.all(promesas);
                } catch (errMaq) {
                    // Revierte: no se deja un contrato sin sus máquinas.
                    await axios.delete(`contratos/${idNuevoContrato}/`).catch(() => {});
                    throw errMaq;
                }
            }

            mostrarNotificacion('Contrato registrado correctamente.');
            setMostrarFormContrato(false);
            cargarDatosFinancieros();
        } catch (err) {
            console.error("Error guardando contrato:", err);
            mostrarNotificacion(extraerErrorApi(err, 'No se pudo guardar el contrato. Intenta nuevamente.'), 'error');
        }
    };

    const contratoEnProrroga = () =>
        contratos.find(c => String(c.id_contrato) === String(modalProrroga.idContrato)) || null;

    // validaciones fecha
    const fechaMinProrroga = () => {
        const c = contratoEnProrroga();
        if (c && c.fecha_fin) {
            const d = aFechaLocal(c.fecha_fin);
            d.setDate(d.getDate() + 1);
            const siguiente = d.toLocaleDateString('en-CA');
            return siguiente > fechaHoy ? siguiente : fechaHoy;
        }
        return fechaHoy;
    };

    const handleProrrogarContrato = async (e) => {
        e.preventDefault();
        if (!modalProrroga.nuevaFechaFin) {
            mostrarNotificacion('Selecciona la nueva fecha de término.', 'error');
            return;
        }
        const c = contratoEnProrroga();
        if (modalProrroga.nuevaFechaFin < fechaMinProrroga()) {
            const actual = c && c.fecha_fin ? ` (término actual: ${formatoFechaCL(c.fecha_fin)})` : '';
            mostrarNotificacion(`La nueva fecha debe ser posterior al término actual${actual}.`, 'error');
            return;
        }
        if (c) {
            const desdeExtension = c.fecha_fin || c.fecha_inicio;
            for (const r of (c.maquinas_contrato || [])) {
                const choque = buscarChoqueMaquina(contratos, r.id_maquina, desdeExtension, modalProrroga.nuevaFechaFin, c.id_contrato);
                if (choque) {
                    mostrarNotificacion(`No se puede prorrogar: la máquina ${r.maquina_patente || '#' + r.id_maquina} ya está asignada a «${nombreDeContrato(choque)}» en ese período.`, 'error');
                    return;
                }
            }
        }
        try {
            const payload = { fecha_fin: modalProrroga.nuevaFechaFin, estado_contrato: 'PRORROGADO' };
            await axios.patch(`/contratos/${modalProrroga.idContrato}/`, payload).catch(() => axios.patch(`/api/contratos/${modalProrroga.idContrato}/`, payload));
            mostrarNotificacion('Prórroga guardada correctamente.');
            setModalProrroga({ abierto: false, idContrato: null, nuevaFechaFin: '' });
            cargarDatosFinancieros();
        } catch (err) {
            mostrarNotificacion(extraerErrorApi(err, 'No se pudo aplicar la prórroga. Intenta nuevamente.'), 'error');
        }
    };

    const handleRegistrarHES = async (e) => {
        e.preventDefault();
        if (!modalHes.numeroHes || !modalHes.idContrato) {
            mostrarNotificacion('Selecciona contrato e ingresa el número de HES.', 'error');
            return;
        }
        try {
            const payload = {
                id_contrato: parseInt(modalHes.idContrato, 10),
                numero_hes: modalHes.numeroHes.trim(),
                total_horas_aprobadas: parseFloat(modalHes.totalHoras) || 0,
                fecha_emision: fechaHoy,
                estado: modalHes.estado
            };
            await axios.post('/hes/', payload).catch(() => axios.post('/api/hes/', payload));
            mostrarNotificacion(`HES N° ${modalHes.numeroHes} registrada en estado [${modalHes.estado}].`);
            setModalHes({ abierto: false, idContrato: '', numeroHes: '', totalHoras: '', estado: 'APROBADA' });
            cargarDatosFinancieros();
        } catch (err) {
            mostrarNotificacion('No se pudo registrar la HES. Intenta nuevamente.', 'error');
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
            mostrarNotificacion(`Bloqueo de Facturación: La HES N° ${hesSeleccionada.numero_hes} está '${hesSeleccionada.estado}'. Debe estar APROBADA.`, 'error');
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
            await axios.post('/facturas/', payload).catch(() => axios.post('/api/facturas/', payload));
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
            mostrarNotificacion('Selecciona un archivo PDF o una imagen.', 'error');
            return;
        }

        try {
            const urlS3 = await subirArchivoAS3(archivoDocEmpresa);
            
            const sesionStorage = JSON.parse(localStorage.getItem('usuario_multimak') || '{}');
            const idRealUsuario = sesionStorage.id_usuario || sesionStorage.id;

            const payload = {
                tipo_documento: tipoDocEmpresa,
                fecha_emision: fechaHoy,
                fecha_carga: fechaHoy,
                url_archivo: urlS3, // URL directa de S3
                id_usuario: idRealUsuario,
                activo: true
            };

            await axios.post('doc-empresa/', payload);
            
            mostrarNotificacion(`Documento [${tipoDocEmpresa}] agregado a la Carpeta Tributaria.`);
            setArchivoDocEmpresa(null);
            cargarDatosFinancieros();
        } catch (err) {
            console.error('Error al subir documento de empresa:', err);
            mostrarNotificacion('No se pudo subir el documento. Intenta nuevamente.', 'error');
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

        if (Array.isArray(cont.detalle_maquinas) && cont.detalle_maquinas.length > 0) {
            return cont.detalle_maquinas.map(d => {
                const idBuscado = String(d.id_maquina || d.id || d);
                const maq = maquinarias.find(m => String(m.id_maquina || m.id) === idBuscado);
                return {
                    patente: maq ? `${maq.patente}` : `Equipo #${idBuscado}`,
                    tipo: maq?.tipo || 'Equipo',
                    tarifa: d.tarifa_hora || cont.tarifa_hora || 0
                };
            });
        }

        const reportesAsociados = reportes.filter(r =>
            String(r.id_contrato?.id_contrato || r.id_contrato) === String(cont.id_contrato || cont.id)
        );
        const idsUnicos = [...new Set(reportesAsociados.map(r => String(r.id_maquina?.id_maquina || r.id_maquina)))].filter(Boolean);

        if (idsUnicos.length > 0) {
            return idsUnicos.map(id => {
                const maq = maquinarias.find(m => String(m.id_maquina || m.id) === id);
                return {
                    patente: maq ? `${maq.patente}` : `Equipo #${id}`,
                    tipo: maq?.tipo || 'Equipo',
                    tarifa: cont.tarifa_hora || 0
                };
            });
        }

        return [{
            patente: 'Sin equipo asignado',
            tipo: 'Equipo',
            tarifa: 0
        }];
    };

    const resumenPorContrato = contratos.map((cont) => {
        const reportesAsociados = reportes.filter(
            (r) => String(r.id_contrato) === String(cont.id_contrato)
        );

        const totalHoras = reportesAsociados.reduce(
            (acc, r) => acc + (parseFloat(r.horas_trabajadas) || 0), 0
        );

        // El servidor valoriza cada parte con la tarifa real de la máquina en el contrato (antes se usaba $28.000 fijo).
        const subtotal = reportesAsociados.reduce((acc, r) => acc + (parseFloat(r.ingreso_estimado) || 0), 0);
        const tarifaBase = totalHoras > 0 ? Math.round(subtotal / totalHoras) : 0;
        const clienteObj = clientes.find(c => String(c.id_cliente || c.id) === String(cont.id_cliente));
        const clienteNombre = cont.cliente_nombre || clienteObj?.razon_social || clienteObj?.nombre || `Cliente #${cont.id_cliente}`;

        const hesAsociada = hesList.find(h => String(h.id_contrato?.id_contrato || h.id_contrato) === String(cont.id_contrato));

        return {
            id_contrato: cont.id_contrato,
            cliente: clienteNombre,
            listaMaquinas: obtenerMaquinasDeContrato(cont),
            totalHoras,
            tarifaBase,
            subtotal,
            hes: hesAsociada,
            cantidadTurnos: reportesAsociados.length
        };
    });

    const totalGastosAcumulados = gastos.reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0);
    const gastosCombustible = gastos
        .filter((g) => (g.categoria_gasto || g.tipo_gasto || '').toLowerCase().includes('combus'))
        .reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0);
    const gastosMantenimiento = gastos
        .filter((g) => {
            const t = (g.categoria_gasto || g.tipo_gasto || '').toLowerCase();
            return t.includes('mant') || t.includes('repuesto') || t.includes('taller');
        })
        .reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0);

    const totalHorasFacturables = reportes.reduce((acc, r) => acc + (parseFloat(r.horas_trabajadas) || 0), 0);
    const totalIngresosEstimados = resumenPorContrato.reduce((acc, c) => acc + c.subtotal, 0);

    const margenNeto = totalIngresosEstimados - totalGastosAcumulados;
    const margenPct = totalIngresosEstimados > 0 ? ((margenNeto / totalIngresosEstimados) * 100).toFixed(1) : '0.0';

    const gastosFiltrados = gastos.filter((g) => {
        const tipo = g.categoria_gasto || g.tipo_gasto || 'General';
        const coincideTipo = filtroTipo === 'todos' || tipo.toLowerCase() === filtroTipo.toLowerCase();
        const patenteTexto = obtenerPatente(g.id_maquina, g.id_maquina_detalle);
        const folioTexto = g.numero_comprobante || '';
        const textoCompleto = `${g.descripcion || ''} ${tipo} ${patenteTexto} ${folioTexto}`.toLowerCase();
        return coincideTipo && textoCompleto.includes(busqueda.toLowerCase());
    });

    const contratosContadorFiltrados = contratos.filter(c => {
        const term = busquedaContratoContador.toLowerCase();
        const cliente = (c.cliente_nombre || c.razon_social || '').toLowerCase();
        const nombreCto = (c.nombre_contrato || '').toLowerCase();
        const idCto = String(c.id_contrato || c.id || '').toLowerCase();
        return cliente.includes(term) || nombreCto.includes(term) || idCto.includes(term);
    });

    return (
        <div className="cnt-view-container">
            <div className="cnt-top-header">
                <div>
                    <span className="cnt-header-tag">Departamento de finanzas • MULTIMAK 360</span>
                    <h1 className="cnt-header-title">Panel Contable y Liquidación de Faena</h1>
                </div>
                <button onClick={cargarDatosFinancieros} className="cnt-btn-sync">
                    Actualizar
                </button>
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
                    <span className="cnt-kpi-foot">{totalHorasFacturables.toFixed(1)} hrs computadas</span>
                </div>

                <div className="cnt-kpi-card gastos">
                    <span className="cnt-kpi-sub">Gasto Total de la Flota</span>
                    <div className="cnt-kpi-value">${totalGastosAcumulados.toLocaleString('es-CL')}</div>
                    <span className="cnt-kpi-foot">Egresos respaldados</span>
                </div>

                <div className={`cnt-kpi-card ${margenNeto >= 0 ? 'margen-pos' : 'margen-neg'}`}>
                    <span className="cnt-kpi-sub">Margen Operativo Neto</span>
                    <div className="cnt-kpi-value">
                        {margenNeto < 0 ? '-' : ''}${Math.abs(margenNeto).toLocaleString('es-CL')}
                    </div>
                    <span className="cnt-kpi-foot">Rentabilidad: <strong>{margenPct}%</strong></span>
                </div>

                <div className="cnt-kpi-card combustible">
                    <span className="cnt-kpi-sub">Combustible</span>
                    <div className="cnt-kpi-value">${gastosCombustible.toLocaleString('es-CL')}</div>
                    <span className="cnt-kpi-foot">Diésel cargado</span>
                </div>

                <div className="cnt-kpi-card mantenimiento">
                    <span className="cnt-kpi-sub">Taller y Repuestos</span>
                    <div className="cnt-kpi-value">${gastosMantenimiento.toLocaleString('es-CL')}</div>
                    <span className="cnt-kpi-foot">Mantenciones</span>
                </div>
            </div>

            <div className="cnt-nav-group">
                <button
                    type="button"
                    onClick={() => setPestaña('facturacion_hes')}
                    className={`cnt-nav-btn ${pestaña === 'facturacion_hes' ? 'active' : ''}`}
                >
                    Facturación HES
                    <span className="cnt-nav-badge">{resumenPorContrato.length}</span>
                </button>

                <button
                    type="button"
                    onClick={() => setPestaña('contratos')}
                    className={`cnt-nav-btn ${pestaña === 'contratos' ? 'active' : ''}`}
                >
                    Contratos y tarifas
                    <span className="cnt-nav-badge">{contratos.length}</span>
                </button>

                <button
                    type="button"
                    onClick={() => setPestaña('carpeta_tributaria')}
                    className={`cnt-nav-btn ${pestaña === 'carpeta_tributaria' ? 'active' : ''}`}
                >
                    Carpeta Tributaria
                    <span className="cnt-nav-badge">{docsEmpresa.length}</span>
                </button>

                <button
                    type="button"
                    onClick={() => setPestaña('gastos')}
                    className={`cnt-nav-btn ${pestaña === 'gastos' ? 'active' : ''}`}
                >
                    Egresos <span>({gastos.length})</span>
                </button>
            </div>

            {pestaña === 'facturacion_hes' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="cnt-panel-box">
                        <div className="cnt-panel-header">
                            <div>
                                <h3 className="cnt-panel-title">Conciliación de Horas y Facturación por Contrato</h3>
                                <p className="cnt-panel-sub">
                                    Acumula los turnos diarios por contrato/equipo para asociar la HES y emitir la factura electrónica DTE.
                                </p>
                            </div>
                        </div>

                        <div className="cnt-table-wrap">
                            <table className="cnt-table">
                                <thead>
                                    <tr>
                                        <th>Cliente / Mandante</th>
                                        <th>Equipos y tarifas asignadas</th>
                                        <th>Turnos</th>
                                        <th className="right">Horas ejecutadas</th>
                                        <th className="right">Total estimado</th>
                                        <th>Estado HES</th>
                                        <th className="right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {resumenPorContrato.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="cnt-no-data">No hay contratos con horas registradas.</td>
                                        </tr>
                                    ) : (
                                        resumenPorContrato.map((item) => {
                                            const hesExistente = item.hes;
                                            const tieneFactura = facturas.some(f => f.id_hes === hesExistente?.id_hes || f.id_hes?.id_hes === hesExistente?.id_hes);

                                            return (
                                                <tr key={item.id_contrato}>
                                                    <td className="bold">{item.cliente}</td>
                                                    <td>
                                                        <div className="cnt-contrato-cell">
                                                            {item.listaMaquinas.map((m, idx) => (
                                                                <div key={idx} style={{ fontSize: '12px' }}>
                                                                    <strong className="mono">{m.patente}</strong> ({m.tipo}) - <span style={{ color: '#16a34a', fontWeight: 'bold' }}>${parseInt(m.tarifa, 10).toLocaleString('es-CL')}/h</span>
                                                                </div>
                                                            ))}
                                                        </div>
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
                                                            <span className="cnt-badge-hes pendiente"> HES Pendiente</span>
                                                        )}
                                                    </td>
                                                    <td className="right">
                                                        {!hesExistente ? (
                                                            <button
                                                                className="cnt-btn-row-act hes"
                                                                onClick={() => setModalHes({ abierto: true, idContrato: item.id_contrato, numeroHes: '', totalHoras: item.totalHoras, estado: 'APROBADA' })}
                                                            >
                                                                + Registrar HES
                                                            </button>
                                                        ) : tieneFactura ? (
                                                            <span className="cnt-badge-hes aprobada">Facturada</span>
                                                        ) : hesExistente.estado === 'APROBADA' ? (
                                                            <button
                                                                className="cnt-btn-row-act facturar"
                                                                onClick={() => {
                                                                    const neto = item.subtotal;
                                                                    const iva = Math.round(neto * 0.19);
                                                                    setModalFactura({
                                                                        abierto: true,
                                                                        idHes: hesExistente.id_hes,
                                                                        folioDTE: '',
                                                                        montoNeto: neto,
                                                                        iva: iva,
                                                                        montoTotal: neto + iva
                                                                    });
                                                                }}
                                                            >
                                                                Emitir Factura 📄
                                                            </button>
                                                        ) : (
                                                            <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 'bold' }}>HES Pendiente Aprobación</span>
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

                    <div className="cnt-panel-box">
                        <h3 className="cnt-panel-title">Facturas Electrónicas Emitidas (DTE)</h3>
                        <div className="cnt-table-wrap">
                            <table className="cnt-table">
                                <thead>
                                    <tr>
                                        <th>Folio DTE</th>
                                        <th>HES vinculada</th>
                                        <th>Fecha emisión</th>
                                        <th className="right">Monto neto</th>
                                        <th className="right">IVA (19%)</th>
                                        <th className="right">Total ($CLP)</th>
                                        <th>Estado de pago</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {facturas.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="cnt-no-data">No se registran facturas electrónicas emitidas.</td>
                                        </tr>
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

            {pestaña === 'contratos' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    <div className="cnt-toolbar-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div className="cnt-filter-row" style={{ flex: '1 1 260px' }}>
                            <input
                                type="text"
                                className="cnt-search-input"
                                placeholder="Filtrar por Cliente / Empresa, RUT o Nombre de Contrato..."
                                value={busquedaContratoContador}
                                onChange={(e) => setBusquedaContratoContador(e.target.value)}
                            />
                        </div>
                        <button
                            type="button"
                            className="cnt-btn-action primary"
                            onClick={() => setMostrarFormContrato(!mostrarFormContrato)}
                        >
                            {mostrarFormContrato ? 'Cancelar' : '+ Nuevo contrato'}
                        </button>
                    </div>

                    {mostrarFormContrato && (
                        <div className="cnt-form-card">
                            <h3 className="cnt-form-title">Registrar Nuevo Contrato de Arriendo</h3>
                            <form onSubmit={handleCrearContrato} noValidate>

                                {/* CAMPOS GENERALES DEL CONTRATO */}
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
                                                    {c.razon_social || c.nombre} {c.rut ? `(RUT: ${c.rut})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                        {erroresFormContrato.id_cliente && (
                                            <span className="cnt-error-msg">! {erroresFormContrato.id_cliente}</span>
                                        )}
                                    </div>

                                    <div className="cnt-input-group">
                                        <label>Fecha Inicio</label>
                                        <input
                                            type="date"
                                            min={fechaHoy}
                                            value={formContrato.fecha_inicio}
                                            onChange={(e) => {
                                                const nuevoInicio = e.target.value;
                                                const finActual = formContrato.fecha_fin;
                                                setFormContrato({
                                                    ...formContrato,
                                                    fecha_inicio: nuevoInicio,
                                                    fecha_fin: finActual && nuevoInicio && finActual < nuevoInicio ? '' : finActual
                                                });
                                            }}
                                        />
                                        {erroresFormContrato.fecha_inicio && (
                                            <span className="cnt-error-msg">! {erroresFormContrato.fecha_inicio}</span>
                                        )}
                                    </div>

                                    <div className="cnt-input-group">
                                        <label>Fecha Fin (Pactada)</label>
                                        <input
                                            type="date"
                                            min={formContrato.fecha_inicio || fechaHoy}
                                            value={formContrato.fecha_fin}
                                            onChange={(e) => setFormContrato({ ...formContrato, fecha_fin: e.target.value })}
                                        />
                                        {erroresFormContrato.fecha_fin && (
                                            <span className="cnt-error-msg">! {erroresFormContrato.fecha_fin}</span>
                                        )}
                                    </div>
                                </div>

                                {/* MAQUINARIAS Y TARIFAS */}
                                <div className="cnt-machines-container">
                                    <div className="cnt-machines-header">
                                        <label className="cnt-section-label">
                                            Maquinarias Asignadas y Tarifas Individuales ($/Hora)
                                        </label>
                                        <button
                                            type="button"
                                            className="cnt-btn-action primary"
                                            onClick={agregarFilaMaquina}
                                        >
                                            + Agregar máquina
                                        </button>
                                    </div>

                                    <div className="cnt-machines-section">
                                        {formContrato.maquinas_asignadas.map((item, index) => {
                                            const errorFila = erroresFormContrato.maquinas?.[index] || {};
                                            return (
                                                <React.Fragment key={index}>
                                                    <div className="cnt-machine-row">
                                                        <select
                                                            value={item.id_maquina}
                                                            onChange={(e) => handleCambioMaquinaFila(index, 'id_maquina', e.target.value)}
                                                        >
                                                            <option value="">Selecciona un equipo...</option>
                                                            {maquinarias.map((m) => {
                                                                const idM = m.id_maquina || m.id;
                                                                const choque = buscarChoqueMaquina(
                                                                    contratos, idM,
                                                                    formContrato.fecha_inicio,
                                                                    formContrato.fecha_fin || formContrato.fecha_inicio
                                                                );
                                                                const yaElegida = formContrato.maquinas_asignadas.some(
                                                                    (f, i) => i !== index && String(f.id_maquina) === String(idM)
                                                                );
                                                                let aviso = '';
                                                                if (choque) {
                                                                    const hasta = choque.fecha_fin ? formatoFechaCL(choque.fecha_fin) : 'sin término';
                                                                    aviso = ` — OCUPADA: ${nombreDeContrato(choque)} (hasta ${hasta})`;
                                                                } else if (yaElegida) {
                                                                    aviso = ' — ya elegida en este contrato';
                                                                }
                                                                return (
                                                                    <option key={idM} value={idM} disabled={Boolean(choque) || yaElegida}>
                                                                        {m.patente} - {m.tipo} ({m.marca || 'S/M'}){aviso}
                                                                    </option>
                                                                );
                                                            })}
                                                        </select>

                                                        <input
                                                            type="number"
                                                            placeholder="Tarifa $/Hora (Ej: 32000)"
                                                            value={item.tarifa_hora}
                                                            onChange={(e) => handleCambioMaquinaFila(index, 'tarifa_hora', e.target.value)}
                                                        />

                                                        <button
                                                            type="button"
                                                            onClick={() => eliminarFilaMaquina(index)}
                                                            className="cnt-btn-delete-small"
                                                            title="Eliminar fila"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                    {(errorFila.id_maquina || errorFila.tarifa_hora) && (
                                                        <span className="cnt-error-msg" style={{ marginTop: '-4px', marginBottom: '8px' }}>
                                                            ! {errorFila.detalle || 'Selecciona el equipo e ingresar la tarifa.'}
                                                        </span>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* 3. BOTONES DE ACCIÓN DEL FORMULARIO */}
                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '24px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setMostrarFormContrato(false)}
                                        className="cnt-btn-action dark"
                                    >
                                        Cancelar
                                    </button>
                                    <button type="submit" className="cnt-btn-action primary">
                                        Guardar contrato
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    <div className="cnt-panel-box">
                        <h3 className="cnt-panel-title">Contratos de Arriendo Registrados</h3>
                        <div className="cnt-table-wrap">
                            <table className="cnt-table">
                                <thead>
                                    <tr>
                                        <th>ID / nombre del contrato</th>
                                        <th>Cliente / mandante</th>
                                        <th>Equipos y tarifas vinculadas</th>
                                        <th>Inicio</th>
                                        <th>Término pactado</th>
                                        <th>Estado</th>
                                        <th className="right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {contratosContadorFiltrados.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="cnt-no-data">No hay contratos registrados.</td>
                                        </tr>
                                    ) : (
                                        contratosContadorFiltrados.map((c) => {
                                            const maquinasList = obtenerMaquinasDeContrato(c);

                                            return (
                                                <tr key={c.id_contrato}>
                                                    <td>
                                                        <div className="cnt-contrato-cell">
                                                            {c.nombre_contrato ? (
                                                                <>
                                                                    <span className="cnt-nombre-texto">{c.nombre_contrato}</span>
                                                                    <span className="cnt-id-code">#CTO-{c.id_contrato}</span>
                                                                </>
                                                            ) : (
                                                                <strong className="cnt-nombre-texto">#CTO-{c.id_contrato}</strong>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="bold">{c.cliente_nombre || c.razon_social || `Cliente #${c.id_cliente}`}</td>
                                                    <td>
                                                        <div className="cnt-contrato-cell">
                                                            {maquinasList.map((m, idx) => (
                                                                <div key={idx} style={{ fontSize: '12px' }}>
                                                                    <strong className="mono">{m.patente}</strong> ({m.tipo}) - <span style={{ color: '#16a34a', fontWeight: 'bold' }}>${parseInt(m.tarifa, 10).toLocaleString('es-CL')}/h</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </td>
                                                    <td className="mono">{c.fecha_inicio || 'S/F'}</td>
                                                    <td className="mono">{c.fecha_fin || 'Indefinido'}</td>
                                                    <td>
                                                        <span className={`cnt-badge-hes ${c.estado_contrato === 'PRORROGADO' ? 'prorrogado' : 'aprobada'}`}>
                                                            {c.estado_contrato || 'ACTIVO'}
                                                        </span>
                                                    </td>
                                                    <td className="right">
                                                        <button
                                                            className="cnt-btn-row-act prorrogar"
                                                            onClick={() => setModalProrroga({ abierto: true, idContrato: c.id_contrato, nuevaFechaFin: c.fecha_fin || '' })}
                                                        >
                                                            Prorrogar
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
                </div>
            )}

            {pestaña === 'carpeta_tributaria' && (
                <div className="cnt-panel-box">
                    <h3 className="cnt-panel-title">Carpeta Tributaria y Laboral de la Empresa (F30, F30-1, Pólizas)</h3>
                    <p className="cnt-panel-sub">Repositorio digital para la acreditación laboral exigida en faenas e inspecciones.</p>

                    <form onSubmit={handleSubirDocEmpresa} noValidate className="cnt-form-card" style={{ marginTop: '16px' }}>
                        <div className="cnt-grid-inputs">
                            <div className="cnt-input-group">
                                <label>Tipo de Documento Legal</label>
                                <select value={tipoDocEmpresa} onChange={(e) => setTipoDocEmpresa(e.target.value)}>
                                    <option value="F30">Certificado F30 (Antecedentes Laborales)</option>
                                    <option value="F30-1">Certificado F30-1 (Cumplimiento de Obligaciones)</option>
                                    <option value="Carpeta Tributaria">Carpeta Tributaria SII</option>
                                    <option value="Poliza">Póliza de Seguro de Responsabilidad Civil</option>
                                </select>
                            </div>

                            <div className="cnt-input-group">
                                <label>Adjuntar Documento (PDF o Imagen)</label>
                                <input type="file" accept="application/pdf,image/*" onChange={(e) => setArchivoDocEmpresa(e.target.files[0])} />
                            </div>

                            <button type="submit" className="cnt-btn-action primary">
                                Subir documento
                            </button>
                        </div>
                    </form>

                    <div className="cnt-table-wrap">
                        <table className="cnt-table">
                            <thead>
                                <tr>
                                    <th>Documento</th>
                                    <th>Fecha de carga</th>
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {docsEmpresa.length === 0 ? (
                                    <tr>
                                        <td colSpan="4" className="cnt-no-data">No se registran documentos en la carpeta tributaria.</td>
                                    </tr>
                                ) : (
                                    docsEmpresa.map((doc, idx) => {
                                        // Evaluamos de forma segura la propiedad de la URL
                                        const urlDocumentoFinal = doc.url_archivo || doc.archivo;

                                        return (
                                            <tr key={doc.id_doc_empresa || idx}>
                                                <td className="bold">{doc.tipo_documento}</td>
                                                <td className="mono">{doc.fecha_carga || doc.fecha_emision}</td>
                                                <td><span className="cnt-badge-hes aprobada">Vigente</span></td>
                                                <td>
                                                    <button 
                                                        className="cnt-btn-s3" 
                                                        onClick={() => abrirVisor({ 
                                                            url: urlDocumentoFinal, 
                                                            titulo: doc.tipo_documento 
                                                        })}
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

            {pestaña === 'gastos' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div className="cnt-filter-row">
                        <input
                            type="text"
                            className="cnt-search-input"
                            placeholder="Buscar por descripción, comprobante, tipo o patente..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                        />

                        <select
                            className="cnt-select-filter"
                            value={filtroTipo}
                            onChange={(e) => setFiltroTipo(e.target.value)}
                        >
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
                                        <tr>
                                            <td colSpan="6" className="cnt-no-data">
                                                No hay egresos registrados que coincidan con la búsqueda.
                                            </td>
                                        </tr>
                                    ) : (
                                        gastosFiltrados.map((g) => {
                                            const concepto = g.categoria_gasto || g.tipo_gasto || 'Gasto General';
                                            const esCombustible = concepto.toLowerCase().includes('combus');
                                            const urlDoc = g.comprobante_url || g.url_comprobante || g.archivo_comprobante;

                                            return (
                                                <tr key={g.id_gasto}>
                                                    <td className="mono">{g.fecha}</td>
                                                    <td>
                                                        <span className={`cnt-badge-concepto ${esCombustible ? 'combustible' : 'general'}`}>
                                                            {concepto}
                                                        </span>
                                                    </td>
                                                    <td className="mono bold">{g.numero_comprobante || 'S/N'}</td>
                                                    <td>
                                                        {urlDoc ? (
                                                            <button
                                                                type="button"
                                                                className="cnt-btn-s3"
                                                                onClick={() => abrirVisor({
                                                                    url: urlDoc,
                                                                    titulo: `Comprobante ${concepto} - Folio ${g.numero_comprobante || 'S/N'}`,
                                                                    subtitulo: `Monto: $${parseFloat(g.monto || 0).toLocaleString('es-CL')} • Fecha: ${g.fecha}`
                                                                })}
                                                            >
                                                                <span></span> Ver documento
                                                            </button>
                                                        ) : (
                                                            <span className="cnt-panel-sub">Sin archivo</span>
                                                        )}
                                                    </td>
                                                    <td className="bold mono">{obtenerPatente(g.id_maquina, g.id_maquina_detalle)}</td>
                                                    <td className="monto-egreso right">
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

            {modalProrroga.abierto && (
                <div className="cnt-modal-overlay" onClick={() => setModalProrroga({ abierto: false, idContrato: null, nuevaFechaFin: '' })}>
                    <div className="cnt-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="cnt-modal-head">
                            <h3 className="cnt-modal-title">Prorrogar contrato de arriendo</h3>
                            <button className="cnt-btn-close" onClick={() => setModalProrroga({ abierto: false, idContrato: null, nuevaFechaFin: '' })}>✕</button>
                        </div>
                        <form onSubmit={handleProrrogarContrato} noValidate className="cnt-modal-body">
                            <div className="cnt-input-group">
                                <label>Nueva Fecha de Término (Anexo / Prórroga)</label>
                                <input
                                    type="date"
                                    min={fechaMinProrroga()}
                                    value={modalProrroga.nuevaFechaFin}
                                    onChange={(e) => setModalProrroga({ ...modalProrroga, nuevaFechaFin: e.target.value })}
                                />
                            </div>

                            <button type="submit" className="cnt-btn-action primary">
                                Prorrogar
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {modalHes.abierto && (
                <div className="cnt-modal-overlay" onClick={() => setModalHes({ abierto: false, idContrato: '', numeroHes: '', totalHoras: '', estado: 'APROBADA' })}>
                    <div className="cnt-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="cnt-modal-head">
                            <h3 className="cnt-modal-title">Registrar Hoja de Entrada de Servicio (HES)</h3>
                            <button className="cnt-btn-close" onClick={() => setModalHes({ abierto: false, idContrato: '', numeroHes: '', totalHoras: '', estado: 'APROBADA' })}>✕</button>
                        </div>
                        <form onSubmit={handleRegistrarHES} noValidate className="cnt-modal-body">
                            <div className="cnt-input-group">
                                <label>Contrato Asociado</label>
                                <select
                                    value={modalHes.idContrato}
                                    onChange={(e) => setModalHes({ ...modalHes, idContrato: e.target.value })}
                                >
                                    <option value="">Selecciona contrato...</option>
                                    {contratos.map(c => (
                                        <option key={c.id_contrato} value={c.id_contrato}>
                                            {nombreDeContrato(c)} - {c.cliente_nombre || 'Cliente'}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="cnt-input-group">
                                <label>Número / Folio HES del Cliente</label>
                                <input
                                    type="text"
                                    placeholder="Ej: 1001497389"
                                    value={modalHes.numeroHes}
                                    onChange={(e) => setModalHes({ ...modalHes, numeroHes: e.target.value })}
                                />
                            </div>

                            <div className="cnt-input-group">
                                <label>Horas Aprobadas por Mandante</label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={modalHes.totalHoras}
                                    onChange={(e) => setModalHes({ ...modalHes, totalHoras: e.target.value })}
                                />
                            </div>

                            <div className="cnt-input-group">
                                <label>Estado de Validación</label>
                                <select
                                    value={modalHes.estado}
                                    onChange={(e) => setModalHes({ ...modalHes, estado: e.target.value })}
                                >
                                    <option value="APROBADA">Aprobada (Habilita Facturación)</option>
                                    <option value="PENDIENTE">Pendiente (En Revisión)</option>
                                    <option value="RECHAZADA">Rechazada</option>
                                </select>
                            </div>

                            <button type="submit" className="cnt-btn-action primary">
                                Guardar HES
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {modalFactura.abierto && (
                <div className="cnt-modal-overlay" onClick={() => setModalFactura({ abierto: false, idHes: '', folioDTE: '', montoNeto: '', iva: 0, montoTotal: 0 })}>
                    <div className="cnt-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="cnt-modal-head">
                            <h3 className="cnt-modal-title">Emitir Factura Electrónica (DTE)</h3>
                            <button className="cnt-btn-close" onClick={() => setModalFactura({ abierto: false, idHes: '', folioDTE: '', montoNeto: '', iva: 0, montoTotal: 0 })}>✕</button>
                        </div>
                        <form onSubmit={handleEmitirFactura} noValidate className="cnt-modal-body">
                            <div className="cnt-input-group">
                                <label>HES Aprobada para vincular</label>
                                <select
                                    value={modalFactura.idHes}
                                    onChange={(e) => setModalFactura({ ...modalFactura, idHes: e.target.value })}
                                >
                                    <option value="">Selecciona HES autorizada...</option>
                                    {hesList.map(h => (
                                        <option key={h.id_hes} value={h.id_hes} disabled={h.estado !== 'APROBADA'}>
                                            HES N° {h.numero_hes} - ({h.total_horas_aprobadas} hrs) [{h.estado}]
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="cnt-input-group">
                                <label>Folio DTE Factura</label>
                                <input
                                    type="number"
                                    placeholder="Ej: 208"
                                    value={modalFactura.folioDTE}
                                    onChange={(e) => setModalFactura({ ...modalFactura, folioDTE: e.target.value })}
                                />
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
                                <label>IVA 19% (Automático)</label>
                                <input
                                    type="number"
                                    value={modalFactura.iva}
                                    readOnly
                                />
                            </div>

                            <div className="cnt-input-group">
                                <label>Monto Total ($CLP)</label>
                                <input
                                    type="number"
                                    value={modalFactura.montoTotal}
                                    readOnly
                                />
                            </div>

                            <button type="submit" className="cnt-btn-action dark">
                                Emitir Factura
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {modalDoc.abierto && (
                <div className="cnt-modal-overlay" onClick={() => setModalDoc({ abierto: false, url: '', titulo: '', subtitulo: '', esPdf: false })}>
                    <div className="cnt-modal-card" onClick={(e) => e.stopPropagation()}>
                        <div className="cnt-modal-head">
                            <div>
                                <h3 className="cnt-modal-title">{modalDoc.titulo}</h3>
                                <p className="cnt-modal-sub">{modalDoc.subtitulo}</p>
                            </div>
                            <div className="cnt-modal-actions">
                                <a href={modalDoc.url} target="_blank" rel="noopener noreferrer" className="cnt-btn-s3">
                                    Abrir en Pestaña Nueva ↗
                                </a>
                                <button onClick={() => setModalDoc({ abierto: false, url: '', titulo: '', subtitulo: '', esPdf: false })} className="cnt-btn-close">
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div className="cnt-modal-body">
                            {modalDoc.esPdf ? (
                                <iframe src={modalDoc.url} title={modalDoc.titulo} className="cnt-viewer-iframe" />
                            ) : (
                                <img src={modalDoc.url} alt={modalDoc.titulo} className="cnt-viewer-img" />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
