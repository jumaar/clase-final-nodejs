// --- Lógica del Cliente del Chat ---

// Importamos la librería de cliente de Socket.IO desde un CDN.
import { io } from 'https://cdn.socket.io/4.3.2/socket.io.esm.min.js'

// --- Obtención del Nombre de Usuario Real ---
// ¡Adiós al nombre de usuario aleatorio! Ahora leemos la identidad del DOM.
// El servidor, a través de EJS, ha incrustado el nombre de usuario en este elemento.
const userInfo = document.getElementById('user-info')
const username = userInfo.dataset.username // Leemos el atributo 'data-username'.

// Nos conectamos al servidor de Socket.IO.
const socket = io({
  auth: {
    // Pasamos el nombre de usuario real en el 'handshake' (apretón de manos) inicial.
    // Aunque nuestro servidor ahora lo validará por su cuenta usando la cookie,
    // es una buena práctica enviarlo para tenerlo disponible en el 'handshake'.
    username: username,
    serverOffset: 0
  }
})

// Obtenemos los elementos del DOM con los que vamos a interactuar.
const form = document.getElementById('form')
const input = document.getElementById('input')
const messages = document.getElementById('messages')

// Guardamos nuestro propio nombre de usuario para poder diferenciar nuestros mensajes.
// Este valor ahora es el nombre de usuario con el que se hizo login.
const selfUsername = username

// --- Manejo de Eventos de Socket.IO ---

// Se ejecuta cuando el servidor nos envía un evento 'chat message'.
socket.on('chat message', (msg, serverOffset, msgUsername, timestamp) => {
  const item = document.createElement('li')
  const time = new Date(timestamp).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })

  // Guardamos el ID del mensaje en el propio elemento LI para encontrarlo fácilmente después.
  item.dataset.id = serverOffset

  let messageHTML = `
    <header class="message-header">
      <strong>${msgUsername}</strong>
      <time>${time}</time>
    </header>
    <p>${msg}</p>
  `

  // Comparamos el nombre de usuario del mensaje con el nuestro para el estilo y para añadir el botón.
  if (msgUsername === selfUsername) {
    item.classList.add('sent')
    // Solo añadimos el botón de borrar a nuestros propios mensajes.
    messageHTML += `<button class="delete-button" data-id="${serverOffset}">🗑️</button>`
  } else {
    item.classList.add('received')
  }

  item.innerHTML = messageHTML
  messages.appendChild(item)
  socket.auth.serverOffset = serverOffset
  messages.scrollTop = messages.scrollHeight
})

// Escuchamos clics en la lista de mensajes (delegación de eventos)
messages.addEventListener('click', (e) => {
  // Si el elemento clickeado es un botón de borrar
  if (e.target.classList.contains('delete-button')) {
    // Obtenemos el ID del mensaje del atributo data-id del botón.
    const messageId = e.target.dataset.id
    // Enviamos el evento al servidor para que borre el mensaje.
    socket.emit('delete message', messageId)
  }
})

// Escuchamos el evento del servidor que nos informa que un mensaje ha sido borrado.
socket.on('message deleted', (messageId) => {
  // Buscamos el elemento del mensaje en el DOM usando su data-id.
  const messageElement = document.querySelector(`li[data-id="${messageId}"]`)
  if (messageElement) {
    // Si lo encontramos, lo eliminamos.
    messageElement.remove()
  }
})

// --- Manejo de Eventos del DOM ---

// Se ejecuta cuando el usuario envía el formulario.
form.addEventListener('submit', (e) => {
  e.preventDefault()

  if (input.value) {
    // Enviamos el mensaje al servidor.
    socket.emit('chat message', input.value)
    input.value = ''
  }
})

// --- Lógica para Cerrar Sesión ---
const logoutButton = document.getElementById('logout-button')

logoutButton.addEventListener('click', () => {
  fetch('/logout', {
    method: 'POST'
  }).then(res => {
    if (res.ok) {
      // Si el logout es exitoso, redirigimos a la página principal.
      window.location.href = '/'
    }
  }).catch(error => {
    console.error('Error al cerrar sesión:', error)
  })
})
