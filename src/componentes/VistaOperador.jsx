import React, { useState, useEffect } from 'react';
import api from '../api/axios';

export default function VistaOperador({ usuarioActual }) {
    const [contratos, setContratos] = useState([]);
    const [operadores, setOperadores] = useState([]);
    const [cargando, setCargando] = useState(false);
    const [mensaje, setMensaje] = useState(null);

    const [formulario, setFormulario] = useState({
        contratoId: '',
        fecha: new Date().toISOString().split('T')[0],
        hora_entrada: '08:00',
        hora_salida: '18:00',
        horometro_inicio: '',
        horometro_final: '',
        combustible_litros: 0,
        firmado: false,
        tarea_observacion: ''
    });

    useEffect(() => {
        Promise.all([
            api.get('/contratos/').catch(() => ({ data: [] })),
            api.get('/operadores/').catch(() => ({ data: [] }))
        ])
            .then(([resContratos, resOperadores]) => {
                setContratos(resContratos.data);
                setOperadores(resOperadores.data);

                if (resContratos.data.length > 0) {
                    const primerContrato = resContratos.data[0];
                    setFormulario((prev) => ({
                        ...prev,
                        contratoId: primerContrato.id,
                        horometro_inicio: primerContrato.maquinaria_detalle?.horometro_acumulado || ''
                    }));
                }
            })
            .catch((err) => console.error('Error al cargar datos:', err));
    }, []);

    const alCambiarContratoMaquina = (contratoId) => {
        const contratoEncontrado = contratos.find((c) => String(c.id) === String(contratoId));
        setFormulario((prev) => ({
            ...prev,
            contratoId: contratoId,
            horometro_inicio: contratoEncontrado?.maquinaria_detalle?.horometro_acumulado || ''
        }));
    };

    const horasCalculadas =
        formulario.horometro_final && formulario.horometro_inicio
            ? Math.max(0, parseFloat(formulario.horometro_final) - parseFloat(formulario.horometro_inicio)).toFixed(2)
            : '0.00';

    const manejarCambio = (e) => {
        const { name, value, type, checked } = e.target;
        setFormulario((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const enviarReport = async (e) => {
        e.preventDefault();
        setMensaje(null);

        if (!formulario.contratoId) {
            alert('No hay maquinarias asignadas a faenas activas en este momento.');
            return;
        }

        if (!formulario.firmado) {
            alert('Debe confirmar la firma del supervisor en obra para poder registrar la jornada.');
            return;
        }

        if (parseFloat(formulario.horometro_final) < parseFloat(formulario.horometro_inicio)) {
            alert('Error: El horómetro final no puede ser inferior al horómetro inicial.');
            return;
        }

        // Resolver RUT del operador automáticamente:
        // Si existe un operador creado en la BD usamos ese RUT; si no, usamos el username
        let rutOperador = operadores.length > 0 ? operadores[0].rut : (usuarioActual?.username || '11111111-1');

        setCargando(true);
        try {
            const cuerpo = {
                contrato: formulario.contratoId,
                operador: rutOperador,
                fecha: formulario.fecha,
                hora_entrada: formulario.hora_entrada,
                hora_salida: formulario.hora_salida,
                horometro_inicio: parseFloat(formulario.horometro_inicio),
                horometro_final: parseFloat(formulario.horometro_final),
                combustible_litros: parseFloat(formulario.combustible_litros) || 0,
                firmado: formulario.firmado,
                metadata_auditoria: {
                    tarea_realizada: formulario.tarea_observacion,
                    usuario_login: usuarioActual?.username
                }
            };

            await api.post('/reports/', cuerpo);
            setMensaje({ tipo: 'exito', texto: 'Parte diario ingresado con éxito al sistema.' });

            setFormulario((prev) => ({
                ...prev,
                horometro_inicio: formulario.horometro_final,
                horometro_final: '',
                firmado: false,
                tarea_observacion: ''
            }));
        } catch (err) {
            console.error(err);
            const detalle = err.response?.data ? JSON.stringify(err.response.data) : 'Error de comunicación';
            setMensaje({ tipo: 'error', texto: `Error al enviar: ${detalle}` });
        } finally {
            setCargando(false);
        }
    };

    return (
        <div style={{ maxWidth: '540px', margin: '0 auto', background: '#ffffff', padding: '24px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>

            {/* Encabezado con Operador Fijo */}
            <div style={{ background: '#0f172a', color: 'white', padding: '16px', borderRadius: '6px', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, fontSize: '18px' }}>Registro Diario de Terreno</h2>
                <div style={{ marginTop: '6px', fontSize: '13px', color: '#94a3b8' }}>
                    Operador en turno: <strong style={{ color: '#38bdf8' }}>{usuarioActual?.nombre_completo || usuarioActual?.username}</strong>
                </div>
            </div>

            {mensaje && (
                <div style={{
                    padding: '12px',
                    marginBottom: '16px',
                    borderRadius: '6px',
                    background: mensaje.tipo === 'exito' ? '#dcfce7' : '#fee2e2',
                    color: mensaje.tipo === 'exito' ? '#166534' : '#991b1b',
                    fontSize: '14px',
                    fontWeight: '500'
                }}>
                    {mensaje.texto}
                </div>
            )}

            <form onSubmit={enviarReport} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* Selector amigable de Maquinaria / Faena */}
                <div>
                    <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', color: '#1e293b', fontSize: '13px' }}>
                        Maquinaria en Faena:
                    </label>
                    <select
                        value={formulario.contratoId}
                        onChange={(e) => alCambiarContratoMaquina(e.target.value)}
                        required
                        style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                    >
                        {contratos.length === 0 ? (
                            <option value="">No hay maquinarias asignadas a faenas</option>
                        ) : (
                            contratos.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.maquinaria_detalle ? `${c.maquinaria_detalle.tipo} (${c.maquinaria})` : `Equipo Patente: ${c.maquinaria}`}
                                </option>
                            ))
                        )}
                    </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                        <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', color: '#1e293b', fontSize: '13px' }}>
                            Hora Inicio:
                        </label>
                        <input
                            type="time"
                            name="hora_entrada"
                            value={formulario.hora_entrada}
                            onChange={manejarCambio}
                            required
                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', color: '#1e293b', fontSize: '13px' }}>
                            Hora Término:
                        </label>
                        <input
                            type="time"
                            name="hora_salida"
                            value={formulario.hora_salida}
                            onChange={manejarCambio}
                            required
                            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                        />
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                        <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', color: '#1e293b', fontSize: '13px' }}>
                            Horómetro Inicial:
                        </label>
                        <input
                            type="number"
                            step="0.1"
                            name="horometro_inicio"
                            value={formulario.horometro_inicio}
                            onChange={manejarCambio}
                            required
                            placeholder="Ej: 1673.1"
                            style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', color: '#1e293b', fontSize: '13px' }}>
                            Horómetro Final:
                        </label>
                        <input
                            type="number"
                            step="0.1"
                            name="horometro_final"
                            value={formulario.horometro_final}
                            onChange={manejarCambio}
                            required
                            placeholder="Ej: 1676.1"
                            style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '6px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }}
                        />
                    </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '15px', fontWeight: '600', color: '#0369a1' }}>
                        Horas Turno: {horasCalculadas} hrs
                    </span>
                </div>

                <div>
                    <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', color: '#1e293b', fontSize: '13px' }}>
                        Carga de Combustible (Litros):
                    </label>
                    <input
                        type="number"
                        step="0.1"
                        name="combustible_litros"
                        value={formulario.combustible_litros}
                        onChange={manejarCambio}
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                </div>

                <div>
                    <label style={{ display: 'block', fontWeight: '600', marginBottom: '6px', color: '#1e293b', fontSize: '13px' }}>
                        Trabajo Realizado en Obra:
                    </label>
                    <textarea
                        name="tarea_observacion"
                        value={formulario.tarea_observacion}
                        onChange={manejarCambio}
                        rows="2"
                        placeholder="Ej: Traslado de material, despeje o excavación..."
                        style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '14px', boxSizing: 'border-box' }}
                    />
                </div>

                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #cbd5e1' }}>
                    <input
                        type="checkbox"
                        id="firmado"
                        name="firmado"
                        checked={formulario.firmado}
                        onChange={manejarCambio}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <label htmlFor="firmado" style={{ fontWeight: '500', color: '#334155', cursor: 'pointer', fontSize: '13px' }}>
                        Confirmar que el reporte cuenta con la firma del supervisor en obra
                    </label>
                </div>

                <button
                    type="submit"
                    disabled={cargando}
                    style={{
                        background: '#0284c7',
                        color: 'white',
                        padding: '12px',
                        fontSize: '15px',
                        fontWeight: '600',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: cargando ? 'not-allowed' : 'pointer'
                    }}
                >
                    {cargando ? 'Procesando...' : 'Enviar Reporte Diario'}
                </button>
            </form>
        </div>
    );
}