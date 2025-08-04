// --- Repositorio de Usuarios (Capa de Abstracción de Datos) ---

// Este archivo implementa el patrón de diseño "Repository".
// El objetivo de un repositorio es encapsular la lógica de acceso a los datos,
// separándola del resto de la lógica de la aplicación (la lógica de negocio).
// De esta forma, si en el futuro quisiéramos cambiar de una base de datos local (DBLocal)
// a una más robusta como MongoDB o PostgreSQL, solo tendríamos que modificar este archivo,
// sin tocar el resto del código del servidor (como `index.js`).

import DBLocal from 'db-local'
import crypto from 'crypto'
import bcrypt from 'bcrypt'
import { SALT_ROUND } from './config.js'

// Inicializamos la base de datos local, que guardará los datos en un archivo dentro de la carpeta './db'.
const { Schema } = new DBLocal({ path: './db' })

// Definimos el "esquema" para nuestros usuarios.
// Un esquema es la estructura que deben tener los objetos que guardamos en la base de datos.
const User = Schema('User', {
  _id: { type: String, required: true },
  username: { type: String, required: true },
  password: { type: String, required: true }
})

export class UserRepository {
  /**
   * Crea un nuevo usuario en la base de datos.
   * @param {object} params - Los parámetros para crear el usuario.
   * @param {string} params.username - El nombre de usuario.
   * @param {string} params.password - La contraseña en texto plano.
   * @returns {Promise<string>} - El ID del usuario recién creado.
   */
  static async create ({ username, password }) {
    // 1. Validamos las entradas para asegurar que cumplen con los requisitos mínimos.
    Validation.username(username)
    Validation.password(password)

    // 2. Verificamos si el nombre de usuario ya existe para evitar duplicados.
    const user = User.findOne({ username })
    if (user) throw new Error(`El usuario '${username}' ya está registrado.`)

    // 3. Generamos un ID único universal para el nuevo usuario.
    const id = crypto.randomUUID()

    // 4. Hasheamos la contraseña. NUNCA guardamos contraseñas en texto plano.
    //    `bcrypt.hash` toma la contraseña y el "salt round" para crear un hash seguro.
    const hashedPassword = await bcrypt.hash(password, SALT_ROUND)

    // 5. Creamos el nuevo usuario en la base de datos con el ID y la contraseña hasheada.
    User.create({
      _id: id, // Usamos _id para mantener consistencia con MongoDB.
      username,
      password: hashedPassword
    }).save()

    return id
  }

  /**
   * Autentica a un usuario y, si es exitoso, devuelve sus datos.
   * @param {object} params - Los parámetros de login.
   * @param {string} params.username - El nombre de usuario.
   * @param {string} params.password - La contraseña en texto plano para comparar.
   * @returns {Promise<object>} - El objeto del usuario sin la contraseña.
   */
  static async login ({ username, password }) {
    // 1. Validamos las entradas.
    Validation.username(username)
    Validation.password(password)

    // 2. Buscamos al usuario por su nombre de usuario.
    const user = User.findOne({ username })
    if (!user) throw new Error('El usuario no existe en nuestra base de datos.')

    // 3. Comparamos la contraseña proporcionada con el hash almacenado.
    //    `bcrypt.compare` es una función segura que previene ataques de temporización.
    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) throw new Error('La contraseña es incorrecta.')

    // 4. Si la contraseña es válida, preparamos el objeto de usuario para devolverlo.
    //    Es una práctica de seguridad CRÍTICA eliminar la contraseña (incluso el hash)
    //    antes de enviar los datos del usuario a cualquier otra parte de la aplicación.
    const { password: _, ...publicUser } = user
    return publicUser
  }
}

/**
 * Clase de validación interna para centralizar las reglas de negocio
 * sobre los datos de entrada.
 */
class Validation {
  /**
   * Valida la contraseña.
   * @param {string} password - La contraseña a validar.
   */
  static password (password) {
    if (typeof password !== 'string') throw new Error('La contraseña debe ser un texto.')
    if (password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.')
  }

  /**
   * Valida el nombre de usuario.
   * @param {string} username - El nombre de usuario a validar.
   */
  static username (username) {
    if (typeof username !== 'string') throw new Error('El nombre de usuario debe ser un texto.')
    if (username.length < 3) throw new Error('El nombre de usuario debe tener al menos 3 caracteres.')
  }
}
