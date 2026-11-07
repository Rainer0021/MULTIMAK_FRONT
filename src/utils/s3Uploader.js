import api from '../api/axios';
import axios from 'axios';

export async function subirArchivoAS3(archivo) {
    if (!archivo) return null;

    try {
        // Pide la URL presignada a Django
        const res = await api.post('generar-url-s3/', {
            nombre_archivo: archivo.name,
            tipo_archivo: archivo.type
        });

        const { upload_url, file_url } = res.data;

        // Sube el archivo directamente a S3 (usando axios limpio sin headers de sesión/token)
        await axios.put(upload_url, archivo, {
            headers: {
                'Content-Type': archivo.type
            }
        });

        // Retorna la URL web lista para guardarse en la columna 'url_archivo'
        return file_url;
    } catch (error) {
        console.error('Error al subir archivo a S3:', error);
        throw new Error('No se pudo subir el archivo a la nube.');
    }
}
// src/utils/s3Uploader.js
// ... (tu función subirArchivoAS3 actual se queda igual)

export async function obtenerUrlLecturaS3(urlGuardada) {
    if (!urlGuardada) return null;
    
    // Si es un archivo local antiguo (no está en AWS), devolvemos la URL tal cual
    if (!urlGuardada.includes('amazonaws.com')) return urlGuardada; 

    try {
        const res = await api.post('generar-url-lectura/', { url_archivo: urlGuardada });
        return res.data.url_lectura;
    } catch (error) {
        console.error('Error al obtener URL temporal de lectura:', error);
        return urlGuardada; // Fallback
    }
}