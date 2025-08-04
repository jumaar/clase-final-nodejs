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
socket.on('chat message', (msg, serverOffset, msgUsername) => {
  const item = document.createElement('li')
  item.innerHTML = `<p>${msg}</p><small>${msgUsername}</small>`

  // Comparamos el nombre de usuario del mensaje con el nuestro para el estilo.
  if (msgUsername === selfUsername) {
    item.classList.add('sent')
  }

  messages.appendChild(item)
  socket.auth.serverOffset = serverOffset
  messages.scrollTop = messages.scrollHeight
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
