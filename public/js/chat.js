// =============================================================================
// --- LÓGICA DEL CLIENTE PARA EL CHAT ---
// Este archivo maneja toda la interactividad del lado del cliente:
// 1. Conexión con el servidor de WebSockets (Socket.IO).
// 2. Envío y recepción de mensajes de chat en tiempo real.
// 3. Renderizado de mensajes en el DOM.
// 4. Manejo de la eliminación de mensajes.
// 5. Lógica para cerrar la sesión del usuario.
// =============================================================================

import { io } from 'https://cdn.socket.io/4.3.2/socket.io.esm.min.js'

// --- Obtención de Datos del Usuario desde el DOM ---
// El servidor (usando EJS) ha renderizado la página del chat y ha "inyectado"
// el nombre del usuario autenticado en un atributo `data-username` de un elemento HTML.
const userInfo = document.getElementById('user-info')
const username = userInfo.dataset.username // Leemos el nombre de usuario.

// --- Conexión al Servidor de Socket.IO ---
// Al llamar a `io()`, el cliente intenta establecer una conexión WebSocket con el servidor.
// ¡Importante! El navegador automáticamente adjuntará las cookies del dominio actual
// (incluida nuestra cookie `access_token`) a la petición de conexión (handshake).
// Así es como el servidor puede autenticar la conexión del socket.
const socket = io({
  // El objeto `auth` se envía al servidor durante el handshake.
  auth: {
    // `serverOffset` es parte de la función de recuperación de estado de conexión.
    // Lo inicializamos en 0. El cliente le dice al servidor cuál fue el último
    // mensaje que recibió, y el servidor le reenvía los que se haya perdido.
    serverOffset: 0
  }
})

// --- Selección de Elementos del DOM ---
const form = document.getElementById('form')
const input = document.getElementById('input')
const messages = document.getElementById('messages')

// Guardamos el nombre de usuario propio en una variable para poder identificar
// fácilmente qué mensajes son nuestros y aplicarles un estilo diferente.
const selfUsername = username

// --- Manejo de Eventos de Socket.IO ---

// `socket.on(eventName, callback)`: Escucha eventos provenientes del servidor.

// Se ejecuta cuando el servidor emite un evento 'chat message'.
// Esto puede ser un mensaje nuevo de cualquier usuario o un mensaje antiguo recuperado.
socket.on('chat message', (msg, serverOffset, msgUsername, timestamp) => {
  const item = document.createElement('li')
  const time = new Date(timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

  // Guardamos el ID del mensaje (que es el `serverOffset`) en un atributo `data-id`.
  // Esto nos permitirá encontrar y manipular este elemento `<li>` fácilmente más tarde.
  item.dataset.id = serverOffset

  // Creamos el contenido del mensaje de forma dinámica.
  const messageContent = document.createElement('div')
  messageContent.classList.add('message-content')
  messageContent.innerHTML = `
    <header class="message-header">
      <strong>${msgUsername}</strong>
      <time>${time}</time>
    </header>
    <p>${msg}</p>
  `

  // Comparamos el autor del mensaje con el usuario actual.
  if (msgUsername === selfUsername) {
    // Si somos los autores, añadimos la clase 'sent' para el estilo CSS.
    item.classList.add('sent')

    // Creamos y añadimos un botón de borrar solo a nuestros propios mensajes.
    const deleteButton = document.createElement('button')
    deleteButton.classList.add('delete-button')
    deleteButton.dataset.id = serverOffset // El botón también lleva el ID del mensaje.
    deleteButton.innerHTML = '🗑️'
    item.appendChild(deleteButton)
    item.appendChild(messageContent)
  } else {
    // Si es un mensaje de otro usuario, añadimos la clase 'received'.
    item.classList.add('received')
    item.appendChild(messageContent)
  }

  messages.appendChild(item) // Añadimos el nuevo mensaje a la lista.
  // Actualizamos nuestro `serverOffset` con el ID del último mensaje recibido.
  socket.auth.serverOffset = serverOffset
  // Hacemos scroll automático para que el último mensaje siempre sea visible.
  messages.scrollTop = messages.scrollHeight
})

// Se ejecuta cuando el servidor confirma que un mensaje ha sido borrado.
socket.on('message deleted', (messageId) => {
  // Buscamos el elemento del mensaje en el DOM usando el `data-id` que guardamos.
  const messageElement = document.querySelector(`li[data-id="${messageId}"]`)
  if (messageElement) {
    messageElement.remove() // Si lo encontramos, lo eliminamos del DOM.
  }
})

// --- Manejo de Eventos del DOM ---

// `element.addEventListener(eventName, callback)`: Escucha eventos del usuario en el navegador.

// Se ejecuta cuando el usuario envía el formulario de mensaje.
form.addEventListener('submit', (e) => {
  e.preventDefault() // Prevenimos que la página se recargue.

  if (input.value) {
    // `socket.emit(eventName, data)`: Envía un evento al servidor.
    // Enviamos el contenido del input en un evento 'chat message'.
    socket.emit('chat message', input.value)
    input.value = '' // Limpiamos el campo de texto.
  }
})

// Delegación de eventos para los botones de borrar.
// En lugar de añadir un listener a cada botón (que pueden no existir aún),
// añadimos un único listener al contenedor padre (`messages`).
messages.addEventListener('click', (e) => {
  // Verificamos si el elemento clickeado (`e.target`) es un botón de borrar.
  if (e.target.classList.contains('delete-button')) {
    const messageId = e.target.dataset.id // Obtenemos el ID del mensaje del botón.
    // Emitimos un evento 'delete message' al servidor con el ID del mensaje a borrar.
    socket.emit('delete message', messageId)
  }
})

// --- Lógica para Cerrar Sesión ---
const logoutButton = document.getElementById('logout-button')

logoutButton.addEventListener('click', () => {
  // Hacemos una petición POST a la ruta `/logout` del servidor.
  fetch('/logout', {
    method: 'POST'
  }).then(res => {
    if (res.ok) {
      // Si el servidor responde con éxito (ha borrado la cookie),
      // redirigimos al usuario a la página de inicio.
      window.location.href = '/'
    }
  }).catch(error => {
    console.error('Error al cerrar sesión:', error)
  })
})
