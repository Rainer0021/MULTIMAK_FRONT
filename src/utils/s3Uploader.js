import axios from './api/axios'; // Tu instancia de axios configurada
// Importamos axios limpio para la petición directa a S3 (sin headers de auth de tu backend)

export async function subirArchivoAS3(archivo) {
    if (!archivo) return null;

    try {
        // PASO 1: Solicitar la URL presignada a nuestro backend de Django
        const res = await api.post('generar-url-s3/', {
            nombre_archivo: archivo.name,
            tipo_archivo: archivo.type
        });

        const { upload_url, file_url } = res.data;

        // PASO 2: Subir el archivo binario directamente a AWS S3
        // Nota: Aquí se usa axios limpio porque S3 rechaza peticiones con headers de tu backend como Bearer/Token
        await axios.put(upload_url, archivo, {
            headers: {
                'Content-Type': archivo.type
            }
        });

        // PASO 3: Retornar la URL final limpia del archivo para guardarla en el modelo (ej: url_comprobante)
        return file_url;

    } catch (error) {
        console.error('Error al subir el archivo directamente a S3:', error);
        throw new Error('No se pudo completar la subida del documento.');
    }
}