// --- Variables de Entorno y Configuración Centralizada ---

// Este archivo centraliza la configuración de la aplicación.
// Utiliza la desestructuración para extraer variables del objeto `process.env`.
// Si una variable de entorno no está definida, se le asigna un valor por defecto.
// Esto facilita la configuración del servidor en diferentes entornos (desarrollo, producción)
// sin tener que modificar el código fuente.

export const {
  // PORT: El puerto en el que se ejecutará el servidor web.
  // Por defecto, se usará el puerto 3000 si no se especifica uno en las variables de entorno.
  PORT = 3000,

  // SALT_ROUND: El "costo" o número de rondas para el algoritmo de hashing de contraseñas (bcrypt).
  // Un número más alto implica un hash más seguro, pero también consume más recursos y tiempo.
  // Un valor de 10 es un buen punto de partida para la seguridad.
  SALT_ROUND = 10,

  // SECRET_JWT_KEY: La clave secreta utilizada para firmar y verificar los JSON Web Tokens (JWT).
  // Esta clave es CRUCIAL para la seguridad. Debe ser larga, compleja y mantenerse en secreto absoluto.
  // En un entorno de producción, esta clave NUNCA debería estar directamente en el código,
  // sino que se debería cargar de forma segura desde las variables de entorno.
  SECRET_JWT_KEY = 'this-is-an-awesome-secret-key-mucho-mas-largo-y-muy-seguro',

  // MONGODB_URI: La cadena de conexión (URI) para la base de datos de MongoDB.
  // Especifica el protocolo, la dirección del servidor, el puerto y el nombre de la base de datos
  // a la que la aplicación se conectará para persistir los mensajes del chat.
  MONGODB_URI = 'mongodb://localhost:27017/chatdb'
} = process.env
