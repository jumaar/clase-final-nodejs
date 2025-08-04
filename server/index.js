import express from 'express'
import logger from 'morgan'
import dotenv from 'dotenv'
import cors from 'cors'
import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb'

import { Server } from 'socket.io'
import { createServer } from 'node:http'

dotenv.config()

const port = process.env.PORT ?? 3000
const MONGODB_URI = process.env.MONGODB_URI

const app = express()
const server = createServer(app)
const io = new Server(server, {
  connectionStateRecovery: {},
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
})

const client = new MongoClient(MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true
  }
})

async function main () {
  await client.connect()
  console.log('Connected successfully to MongoDB')
  const db = client.db('chatdb')
  const messagesCollection = db.collection('messages')

  // Esto es para limpiar la base de datos en cada reinicio, puedes quitarlo en producción
  // await messagesCollection.deleteMany({})

  io.on('connection', async (socket) => {
    console.log('a user has connected!')

    socket.on('disconnect', () => {
      console.log('an user has disconnected')
    })

    socket.on('chat message', async (msg) => {
      let result
      const username = socket.handshake.auth.username ?? 'anonymous'
      try {
        result = await messagesCollection.insertOne({ content: msg, user: username })
      } catch (e) {
        console.error(e)
        return
      }

      io.emit('chat message', msg, result.insertedId.toString(), username)
    })

    if (!socket.recovered) { // <- recuperase los mensajes sin conexión
      try {
        const serverOffset = socket.handshake.auth.serverOffset
        const query = serverOffset ? { _id: { $gt: new ObjectId(serverOffset) } } : {}

        const results = await messagesCollection.find(query).toArray()

        results.forEach(row => {
          socket.emit('chat message', row.content, row._id.toString(), row.user)
        })
      } catch (e) {
        console.error(e)
      }
    }
  })

  app.use(logger('dev'))

  app.get('/', (req, res) => {
    res.sendFile(process.cwd() + '/client/index.html')
  })

  server.listen(port, () => {
    console.log(`✅ Servidor activo en el puerto ${port}`)
  })
}

main().catch(console.error)
