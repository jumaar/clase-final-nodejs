// =============================================================================
// --- ARCHIVO PRINCIPAL DEL SERVIDOR ---
// Este archivo es el corazón de la aplicación. Orquesta todas las partes:
// 1. Configuración del servidor Express.
// 2. Inicialización del servidor de WebSockets (Socket.IO).
// 3. Conexión a la base de datos (MongoDB).
// 4. Definición de middlewares, incluyendo la autenticación por JWT.
// 5. Creación de las rutas HTTP (API y vistas).
// 6. Lógica del chat en tiempo real.
// =============================================================================

// --- Dependencias del Servidor ---
import express from 'express' // Framework para construir el servidor web y las APIs.
import { PORT, SECRET_JWT_KEY, MONGODB_URI } from './config.js' // Variables de entorno y configuración.
import cookieParser from 'cookie-parser' // Middleware para parsear cookies en las peticiones.
import jwt from 'jsonwebtoken' // Para crear y verificar JSON Web Tokens.
import { UserRepository } from './user-repository.js' // Capa de acceso a datos de usuarios.
import logger from 'morgan' // Middleware para registrar las peticiones HTTP en la consola.
import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb' // Driver oficial de MongoDB.
import { Server } from 'socket.io' // Librería para la comunicación por WebSockets.
import { createServer } from 'node:http' // Módulo nativo de Node.js para crear servidores HTTP.

// --- Inicialización del Servidor ---
const app = express() // Creamos una instancia de la aplicación Express.

// Creamos un servidor HTTP nativo usando el módulo 'http' de Node.js.
// Le pasamos la app de Express para que maneje las peticiones.
// Hacemos esto porque Socket.IO necesita engancharse a un servidor 'http' base,
// no directamente a la aplicación de Express.
const server = createServer(app)

// Inicializamos Socket.IO, vinculándolo a nuestro servidor HTTP.
// La opción `connectionStateRecovery` habilita una característica de Socket.IO
// que permite a un cliente que se desconecta temporalmente (ej. por mala conexión)
// recuperar los mensajes que se perdió durante ese tiempo.
const io = new Server(server, {
  connectionStateRecovery: {}
})

// --- Conexión a la Base de Datos de Chat (MongoDB) ---
const client = new MongoClient(MONGODB_URI, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true }
})
await client.connect() // Conectamos a la base de datos de forma asíncrona.
console.log('Conectado exitosamente a MongoDB (chat)')
const db = client.db('chatdb')
const messagesCollection = db.collection('messages') // Colección para guardar los mensajes del chat.

// --- Configuración de Middlewares de Express ---
app.set('view engine', 'ejs') // Configuramos EJS como motor de plantillas para renderizar vistas.
app.use(logger('dev')) // Usamos morgan para logging de peticiones en modo 'dev'.
app.use(express.json()) // Middleware para que Express pueda parsear cuerpos de petición en formato JSON.
app.use(cookieParser()) // Middleware para parsear cookies y hacerlas accesibles en `req.cookies`.
app.use(express.static('public')) // Sirve archivos estáticos (CSS, JS de cliente, imágenes) desde la carpeta 'public'.

// --- Middleware de Autenticación para RUTAS HTTP ---
// Este middleware se ejecuta en CADA petición HTTP que llega al servidor.
// Su función es verificar si el usuario está autenticado a través de un JWT en una cookie.
app.use((req, res, next) => {
  const token = req.cookies.access_token // 1. Intenta obtener el token de la cookie llamada 'access_token'.
  req.session = { user: null } // 2. Inicializa la sesión del usuario como nula en el objeto `req`.

  if (!token) return next() // Si no hay token, simplemente continuamos. `req.session.user` seguirá siendo `null`.

  try {
    // 3. Si hay un token, intenta verificarlo usando la clave secreta.
    const data = jwt.verify(token, SECRET_JWT_KEY)
    // 4. Si el token es válido, `jwt.verify` devuelve el payload decodificado (los datos del usuario).
    //    Guardamos estos datos en `req.session.user` para que las rutas posteriores tengan acceso a ellos.
    req.session.user = data
  } catch (error) {
    // 5. Si `jwt.verify` falla (token inválido, expirado, etc.), se lanza un error.
    //    En este caso, no hacemos nada y `req.session.user` permanece `null`.
    console.error('Error al verificar el token:', error.message)
  }

  // 6. Llama a `next()` para pasar el control a la siguiente función de middleware o a la ruta correspondiente.
  next()
})

// --- Middleware de Autenticación para WEBSOCKETS (Socket.IO) ---
// Este middleware es específico para Socket.IO y protege las conexiones WebSocket.
// Se ejecuta una sola vez por cliente, cuando este intenta establecer la conexión inicial (el "handshake").
io.use((socket, next) => {
  // 1. A diferencia de Express, el acceso a las cookies se hace a través de `socket.handshake.headers.cookie`.
  const cookies = socket.handshake.headers.cookie
  if (!cookies) {
    return next(new Error('Error de autenticación: No se proporcionaron cookies.'))
  }

  // 2. El string de cookies contiene todas las cookies (ej. "cookie1=valor1; cookie2=valor2").
  //    Lo parseamos para encontrar nuestra 'access_token'.
  const tokenCookie = cookies.split(';').find(c => c.trim().startsWith('access_token='))
  if (!tokenCookie) {
    return next(new Error('Error de autenticación: No se encontró el token.'))
  }

  // 3. Extraemos el valor del token del string "access_token=VALOR".
  const token = tokenCookie.split('=')[1]

  try {
    // 4. Verificamos el token con la misma lógica que en el middleware de Express.
    const user = jwt.verify(token, SECRET_JWT_KEY)
    // 5. Si el token es válido, adjuntamos la información del usuario DIRECTAMENTE al objeto `socket`.
    //    Este objeto `socket` es persistente durante toda la vida de la conexión del cliente,
    //    por lo que siempre sabremos quién está enviando los mensajes.
    socket.user = user
    // 6. Llamamos a `next()` sin error para permitir la conexión.
    next()
  } catch (err) {
    // 7. Si el token es inválido, llamamos a `next` con un error, lo que rechazará la conexión.
    //    El cliente recibirá un evento 'connect_error'.
    next(new Error('Error de autenticación: Token inválido.'))
  }
})

// --- Lógica Principal de Socket.IO (Chat en Tiempo Real) ---
io.on('connection', async (socket) => {
  // Este bloque se ejecuta cada vez que un cliente se conecta exitosamente (después de pasar el middleware).
  // Gracias a nuestro middleware, aquí podemos estar seguros de que `socket.user` existe y contiene los datos del usuario.
  console.log(`✅ Usuario conectado al chat: ${socket.user.username}`)

  // Evento que se dispara cuando el cliente se desconecta.
  socket.on('disconnect', () => {
    console.log(`❌ Usuario desconectado: ${socket.user.username}`)
  })

  // Evento que se dispara cuando un cliente envía un mensaje ('chat message').
  socket.on('chat message', async (msg) => {
    const message = {
      content: msg,
      user: socket.user.username, // Usamos el username verificado del socket.
      timestamp: new Date()
    }

    try {
      // 1. Persistimos el mensaje en la base de datos de MongoDB.
      const result = await messagesCollection.insertOne(message)
      // 2. Emitimos el mensaje a TODOS los clientes conectados, incluyéndonos a nosotros mismos.
      //    Enviamos el contenido, el ID del mensaje desde la DB, el usuario y el timestamp.
      io.emit('chat message', message.content, result.insertedId.toString(), message.user, message.timestamp)
    } catch (e) {
      console.error('Error al guardar o emitir el mensaje:', e)
    }
  })

  // Evento para borrar un mensaje, solicitado por un cliente.
  socket.on('delete message', async (messageId) => {
    try {
      const objectId = new ObjectId(messageId)
      const message = await messagesCollection.findOne({ _id: objectId })

      // IMPORTANTE: Medida de seguridad.
      // Verificamos que el mensaje existe y que el usuario que intenta borrarlo (`socket.user.username`)
      // es el mismo que el autor original del mensaje (`message.user`).
      if (message && message.user === socket.user.username) {
        await messagesCollection.deleteOne({ _id: objectId })
        // Notificamos a TODOS los clientes que este mensaje debe ser eliminado de su vista.
        io.emit('message deleted', messageId)
      } else {
        console.warn(`Intento de borrado no autorizado por ${socket.user.username} para el mensaje ${messageId}`)
      }
    } catch (e) {
      console.error('Error al borrar el mensaje:', e)
    }
  })

  // Lógica para recuperar mensajes perdidos (si el cliente se reconecta).
  // `socket.recovered` es `true` si la conexión es una reconexión exitosa.
  if (!socket.recovered) {
    try {
      // El cliente nos envía el ID del último mensaje que recibió (`serverOffset`).
      const serverOffset = socket.handshake.auth.serverOffset
      // Buscamos en la DB todos los mensajes posteriores a ese ID.
      const query = serverOffset ? { _id: { $gt: new ObjectId(serverOffset) } } : {}
      const results = await messagesCollection.find(query).toArray()
      // Enviamos los mensajes perdidos solo a ese cliente.
      results.forEach(row => {
        socket.emit('chat message', row.content, row._id.toString(), row.user, row.timestamp)
      })
    } catch (e) {
      console.error('Error al recuperar mensajes:', e)
    }
  }
})

// --- Rutas HTTP (Endpoints de la API y Vistas) ---

// Ruta principal: Muestra la página de inicio de sesión/registro.
app.get('/', (req, res) => {
  const { user } = req.session // El middleware de autenticación ya pobló `req.session`.
  res.render('index', { user }) // Pasamos el usuario a la vista (puede ser `null`).
})

// Ruta para iniciar sesión.
app.post('/login', async (req, res) => {
  const { username, password } = req.body
  try {
    const user = await UserRepository.login({ username, password }) // 1. Valida credenciales en el repositorio.

    // 2. Si las credenciales son correctas, creamos (firmamos) un JWT.
    const token = jwt.sign(
      { id: user._id, username: user.username }, // Payload: Datos que guardamos en el token.
      SECRET_JWT_KEY, // Clave secreta para la firma.
      { expiresIn: '1h' } // Opciones: El token expirará en 1 hora.
    )

    // 3. Enviamos el token al cliente dentro de una cookie.
    res
      .cookie('access_token', token, {
        httpOnly: true, // La cookie no es accesible por JavaScript en el cliente (previene ataques XSS).
        secure: process.env.NODE_ENV === 'production', // Enviar solo sobre HTTPS en producción.
        sameSite: 'strict', // La cookie solo se envía en peticiones del mismo sitio (previene ataques CSRF).
        maxAge: 1000 * 60 * 60 // Tiempo de vida de la cookie en milisegundos (1 hora).
      })
      .status(200).json({ message: 'Login exitoso', user })
  } catch (error) {
    res.status(401).json({ error: error.message })
  }
})

// Ruta para registrar un nuevo usuario.
app.post('/register', async (req, res) => {
  const { username, password } = req.body
  try {
    const id = await UserRepository.create({ username, password }) // 1. Crea el usuario.

    // 2. Después de crear, inicia sesión automáticamente firmando un JWT.
    const token = jwt.sign({ id, username }, SECRET_JWT_KEY, { expiresIn: '1h' })

    // 3. Establece la cookie y envía una respuesta de éxito.
    return res
      .cookie('access_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 1000 * 60 * 60
      })
      .status(201)
      .json({ id, username })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
})

// Ruta para cerrar sesión.
app.post('/logout', (req, res) => {
  // Simplemente le decimos al navegador que elimine la cookie 'access_token'.
  res
    .clearCookie('access_token')
    .json({ message: 'Logout exitoso' })
})

// Ruta protegida de ejemplo.
app.get('/protected', (req, res) => {
  const { user } = req.session
  // Gracias a nuestro middleware, solo tenemos que comprobar si `req.session.user` existe.
  if (!user) return res.status(403).send('Acceso no autorizado. Debes iniciar sesión.')
  res.render('protected', { user })
})

// Ruta para la vista del chat.
app.get('/chat', (req, res) => {
  const { user } = req.session // 1. Obtenemos el usuario de la sesión.

  // 2. Si no hay usuario, significa que no ha iniciado sesión o su token es inválido.
  if (!user) {
    // 3. Lo redirigimos a la página principal para que inicie sesión.
    return res.redirect('/')
  }

  // 4. Si el usuario está autenticado, renderizamos la vista del chat ('chat.ejs').
  //    Le pasamos los datos del usuario a la vista para que pueda, por ejemplo, mostrar su nombre.
  res.render('chat', { user })
})

// --- Arranque del Servidor ---
// Usamos `server.listen` en lugar de `app.listen` para asegurar que tanto
// Express como Socket.IO están escuchando en el mismo puerto.
server.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`)
})
