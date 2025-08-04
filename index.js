// --- Dependencias del Servidor ---
// Importamos Express, el framework principal para crear el servidor web.
import express from 'express'
// Importamos las variables de configuración (puerto, claves secretas, etc.).
import { PORT, SECRET_JWT_KEY, MONGODB_URI } from './config.js'
// cookie-parser nos ayuda a leer las cookies que vienen en las peticiones del cliente.
import cookieParser from 'cookie-parser'
// jsonwebtoken se usa para crear y verificar los tokens de autenticación.
import jwt from 'jsonwebtoken'
// Este es nuestro "repositorio", una capa que se encarga de la lógica de la base de datos de usuarios.
import { UserRepository } from './user-repository.js'
// morgan es un logger, nos muestra en la consola las peticiones HTTP que llegan. Útil para depurar.
import logger from 'morgan'
// Importamos las herramientas de MongoDB para conectarnos y operar con la base de datos.
import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb'
// La clase Server de socket.io para la comunicación en tiempo real.
import { Server } from 'socket.io'
// El módulo http de Node.js, necesario para crear un servidor base sobre el que correrá Express y Socket.IO.
import { createServer } from 'node:http'

// --- Inicialización del Servidor ---
// Creamos la aplicación Express.
const app = express()
// Creamos un servidor HTTP nativo, pasándole nuestra app de Express.
// Hacemos esto para que Socket.IO pueda "engancharse" al mismo servidor.
const server = createServer(app)
// Inicializamos Socket.IO, conectándolo a nuestro servidor HTTP.
const io = new Server(server, {
  connectionStateRecovery: {}
})

// --- Conexión a la Base de Datos de Chat (MongoDB) ---
// Creamos un cliente de MongoDB con la URI de nuestra configuración.
const client = new MongoClient(MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true
  }
})
// Conectamos el cliente a la base de datos. Usamos 'await' en el nivel superior (top-level await).
await client.connect()
console.log('Conectado exitosamente a MongoDB (chat)')
// Obtenemos la base de datos 'chatdb' y la colección 'messages'.
const db = client.db('chatdb')
const messagesCollection = db.collection('messages')

// --- Configuración de Express (Middlewares) ---
// Configuramos EJS como el motor de plantillas para las vistas.
app.set('view engine', 'ejs')
// Usamos el logger 'dev' de morgan para ver las peticiones.
app.use(logger('dev'))
// Middleware para que Express entienda peticiones con cuerpo en formato JSON.
app.use(express.json())
// Middleware para poder parsear y usar las cookies.
app.use(cookieParser())

// Middleware para servir archivos estáticos (como css, js del cliente, imágenes).
// Le decimos a Express que la carpeta 'public' contiene archivos a los que
// se puede acceder directamente desde el navegador.
app.use(express.static('public'))

// --- Middleware de Autenticación ---
// Este es nuestro "portero" personalizado. Se ejecuta en CADA petición.
app.use((req, res, next) => {
  // 1. Intenta obtener el token de la cookie 'access_token'.
  const token = req.cookies.access_token
  // 2. Inicializa la sesión del usuario como nula.
  req.session = { user: null }

  try {
    // 3. Intenta verificar el token usando nuestra clave secreta.
    const data = jwt.verify(token, SECRET_JWT_KEY)
    // 4. Si el token es válido, guardamos los datos del usuario en la sesión de la petición.
    req.session.user = data
  } catch (error) {
    // 5. Si el token no es válido o no existe, la sesión del usuario permanece nula.
    req.session.user = null
  }

  // 6. Llama a next() para que la petición continúe hacia la ruta correspondiente.
  next()
})

// --- Middleware de Autenticación para Socket.IO ---
// Este middleware es el "portero" de nuestras conexiones WebSocket.
// Se ejecuta para cada cliente que intenta conectarse.
io.use((socket, next) => {
  // 1. Leemos las cookies de la petición inicial de conexión (el 'handshake').
  const cookies = socket.handshake.headers.cookie
  if (!cookies) {
    // Si no hay cookies, no hay forma de autenticarse. Rechazamos la conexión.
    return next(new Error('Authentication error: No cookies provided'))
  }

  // 2. Buscamos nuestra 'access_token' específica dentro del string de cookies.
  const tokenCookie = cookies.split(';').find(c => c.trim().startsWith('access_token='))
  if (!tokenCookie) {
    // Si no está el token, rechazamos la conexión.
    return next(new Error('Authentication error: No token provided'))
  }

  // 3. Extraemos el valor del token.
  const token = tokenCookie.split('=')[1]

  try {
    // 4. Verificamos el token usando la misma clave secreta que en Express.
    const user = jwt.verify(token, SECRET_JWT_KEY)
    // 5. Si el token es válido, "adjuntamos" la información del usuario al objeto socket.
    //    Este objeto 'socket' persistirá durante toda la vida de la conexión.
    socket.user = user
    // 6. Llamamos a next() sin error para permitir que la conexión proceda.
    next()
  } catch (err) {
    // 7. Si jwt.verify falla, el token es inválido. Rechazamos la conexión.
    next(new Error('Authentication error: Invalid token'))
  }
})

// --- Lógica de Socket.IO (Chat en Tiempo Real) ---
io.on('connection', async (socket) => {
  // Gracias a nuestro middleware, aquí ya podemos asumir que 'socket.user' existe y es válido.
  console.log(`¡Un usuario se ha conectado al chat!: ${socket.user.username}`)

  socket.on('disconnect', () => {
    console.log(`El usuario ${socket.user.username} se ha desconectado`)
  })

  // Escucha el evento 'chat message' que envía el cliente.
  socket.on('chat message', async (msg) => {
    const username = socket.user.username
      const message = {
        content: msg,
        user: username,
        timestamp: new Date()
      }

    try {
        // Guardamos el objeto de mensaje completo en la base de datos.
        const result = await messagesCollection.insertOne(message)
        // Emitimos el mensaje a todos, incluyendo el nuevo timestamp.
        io.emit('chat message', message.content, result.insertedId.toString(), message.user, message.timestamp)
    } catch (e) {
      console.error(e)
    }
  })

  // Lógica para recuperar mensajes si el cliente se desconectó temporalmente.
  if (!socket.recovered) {
    try {
      const serverOffset = socket.handshake.auth.serverOffset
      const query = serverOffset ? { _id: { $gt: new ObjectId(serverOffset) } } : {}
      const results = await messagesCollection.find(query).toArray()
      results.forEach(row => {
        // Añadimos el timestamp al emitir los mensajes recuperados.
        socket.emit('chat message', row.content, row._id.toString(), row.user, row.timestamp)
      })
    } catch (e) {
      console.error(e)
    }
  }

  // Escucha el evento para borrar un mensaje.
  socket.on('delete message', async (messageId) => {
    try {
      const objectId = new ObjectId(messageId)
      // Buscamos el mensaje en la base de datos.
      const message = await messagesCollection.findOne({ _id: objectId })

      // Medida de seguridad: verificamos que el mensaje existe y que el usuario que solicita el borrado es el autor.
      if (message && message.user === socket.user.username) {
        await messagesCollection.deleteOne({ _id: objectId })
        // Notificamos a todos los clientes que este mensaje debe ser eliminado.
        io.emit('message deleted', messageId)
      } else {
        // Si alguien intenta borrar un mensaje que no es suyo, lo podemos registrar.
        console.log(`Intento de borrado no autorizado por ${socket.user.username} para el mensaje ${messageId}`)
      }
    } catch (e) {
      console.error('Error al borrar el mensaje:', e)
    }
  })
})

// --- Rutas HTTP (Endpoints de la API y Vistas) ---
app.get('/', (req, res) => {
  const { user } = req.session
  res.render('index', user)
})

app.post('/login', async (req, res) => {
  const { username, password } = req.body
  try {
    const user = await UserRepository.login({ username, password })
    const token = jwt.sign(
      { id: user._id, username: user.username },
      SECRET_JWT_KEY,
      { expiresIn: '1h' }
    )
    res
      .cookie('access_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 1000 * 60 * 60
      })
      .status(200).send({ user, token })
  } catch (error) {
    res.status(401).send({ error: error.message })
  }
})

app.post('/register', async (req, res) => {
  const { username, password } = req.body
  try {
    const id = await UserRepository.create({ username, password })
    res.send({ id })
  } catch (error) {
    res.status(400).send({ error: error.message })
  }
})

app.post('/logout', (req, res) => {
  res
    .clearCookie('access_token')
    .json({ message: 'Logout successful' })
})

app.get('/protected', (req, res) => {
  const { user } = req.session
  if (!user) return res.status(403).send('Access not authorized')
  res.render('protected', user)
})

// --- Ruta para la Vista del Chat ---
// Esta es la ruta que servirá nuestra aplicación de chat.
app.get('/chat', (req, res) => {
  // 1. Obtenemos el usuario de la sesión, que nuestro middleware de autenticación ya ha procesado.
  const { user } = req.session

  // 2. Si no hay usuario en la sesión, significa que no ha iniciado sesión.
  if (!user) {
    // 3. Lo redirigimos a la página principal, que es nuestro formulario de login/registro.
    return res.redirect('/')
  }

  // 4. Si hay un usuario, renderizamos la vista 'chat.ejs'.
  //    Le pasamos el objeto de usuario a la vista. De esta forma,
  //    la vista 'chat.ejs' tendrá acceso al nombre de usuario.
  res.render('chat', { user })
})

// --- Arranque del Servidor ---
// Usamos server.listen en lugar de app.listen para que el servidor HTTP
// escuche las peticiones, permitiendo que Socket.IO funcione correctamente.
server.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en el puerto ${PORT}`)
})
