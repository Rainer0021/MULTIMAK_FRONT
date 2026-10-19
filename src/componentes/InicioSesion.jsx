import React, { useState } from 'react';
import axios from '../api/axios';

export default function InicioSesion({ alIniciarSesion }) {
    const [rut, setRut] = useState('');
    const [contraseña, setContraseña] = useState('');
    const [error, setError] = useState('');

    const manejarEnvio = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const respuesta = await axios.post('/api/login-operador/', {
                rut: rut,
                contraseña: contraseña,
            });

            if (respuesta.status === 200) {
                alIniciarSesion(respuesta.data);
            }
        } catch (err) {
            setError('Credenciales inválidas. Usa 12345678-9 / operador123');
        }
    };

    return (
        <div style={{ maxWidth: '380px', margin: '50px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', fontFamily: 'sans-serif' }}>
            <h2 style={{ textAlign: 'center' }}>MULTIMAK - Acceso Operador</h2>
            {error && <div style={{ color: 'red', marginBottom: '10px', textAlign: 'center' }}>{error}</div>}
            <form onSubmit={manejarEnvio}>
                <div style={{ marginBottom: '12px' }}>
                    <label style={{ display: 'block', marginBottom: '4px' }}>RUT:</label>
                    <input
                        type="text"
                        value={rut}
                        onChange={(e) => setRut(e.target.value)}
                        placeholder="12345678-9"
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                        required
                    />
                </div>
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '4px' }}>Contraseña:</label>
                    <input
                        type="password"
                        value={contraseña}
                        onChange={(e) => setContraseña(e.target.value)}
                        placeholder="operador123"
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                        required
                    />
                </div>
                <button
                    type="submit"
                    style={{ width: '100%', padding: '10px', backgroundColor: '#0d6efd', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    Ingresar
                </button>
            </form>
        </div>
    );
}