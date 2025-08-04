// Usamos un listener para asegurarnos de que el DOM esté completamente cargado antes de ejecutar el script.
document.addEventListener('DOMContentLoaded', () => {
  // Seleccionamos los elementos con los que vamos a trabajar.
  // Es importante que el botón en el HTML tenga el id="theme-toggle-button".
  const themeToggleButton = document.getElementById('theme-toggle-button')
  const body = document.body

  // La clave que usaremos para guardar la preferencia en el almacenamiento local del navegador.
  const themeKey = 'themePreference'

  /**
   * Aplica un tema a la página.
   * @param {string} theme - El tema a aplicar ('dark' o 'light').
   */
  const applyTheme = (theme) => {
    // Si el tema es oscuro, añade la clase .dark-mode al body y muestra el ícono del sol.
    if (theme === 'dark') {
      body.classList.add('dark-mode')
      if (themeToggleButton) themeToggleButton.textContent = '☀️' // Ícono para cambiar a modo claro
    } else {
      // Si no, quita la clase .dark-mode y muestra el ícono de la luna.
      body.classList.remove('dark-mode')
      if (themeToggleButton) themeToggleButton.textContent = '🌙' // Ícono para cambiar a modo oscuro
    }
  }

  // --- Lógica del Botón ---
  // Añadimos un listener al botón. Solo se ejecuta si el botón existe en la página.
  themeToggleButton?.addEventListener('click', () => {
    // Comprobamos si el body ya tiene la clase .dark-mode.
    const isDarkMode = body.classList.contains('dark-mode')
    // Si la tiene, el nuevo tema será 'light'. Si no, será 'dark'.
    const newTheme = isDarkMode ? 'light' : 'dark'

    // Guardamos la nueva preferencia en localStorage.
    localStorage.setItem(themeKey, newTheme)
    // Aplicamos el nuevo tema.
    applyTheme(newTheme)
  })

  // --- Lógica de Carga Inicial del Tema ---
  // Esto se ejecuta una sola vez, cuando la página carga.

  // 1. Buscamos una preferencia guardada en localStorage.
  const savedTheme = localStorage.getItem(themeKey)

  // 2. Comprobamos la preferencia del sistema operativo del usuario.
  const osPreference = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

  // 3. Decidimos el tema inicial. La preferencia guardada tiene prioridad sobre la del sistema.
  const initialTheme = savedTheme || osPreference

  // 4. Aplicamos el tema inicial.
  applyTheme(initialTheme)
})
