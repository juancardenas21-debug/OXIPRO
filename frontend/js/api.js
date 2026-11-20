function sesion() {
  try { return JSON.parse(localStorage.getItem('sesion')); } catch { return null; }
}
function guardarSesion(s) { localStorage.setItem('sesion', JSON.stringify(s)); }
function cerrarSesion() { localStorage.removeItem('sesion'); location.href = 'index.html'; }

// Crea elementos del DOM. Los textos se insertan como texto, nunca como HTML.
function el(etiqueta, props = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(props)) {
    if (clave === 'class') nodo.className = valor;
    else if (clave.startsWith('on')) nodo.addEventListener(clave.slice(2), valor);
    else nodo.setAttribute(clave, valor);
  }
  for (const hijo of hijos.flat()) nodo.append(hijo);
  return nodo;
}

const centavos = (precio) => Math.round(Number(precio) * 100);
const moneda = (precio) =>
  new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(precio));
const monedaCentavos = (c) => moneda(c / 100);

async function api(ruta, { metodo = 'GET', cuerpo, auth = true } = {}) {
  const cabeceras = {};
  if (cuerpo) cabeceras['Content-Type'] = 'application/json';
  const s = sesion();
  if (auth && s) cabeceras.Authorization = 'Bearer ' + s.token;
  const respuesta = await fetch(ruta, {
    method: metodo,
    headers: cabeceras,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (respuesta.status === 401 && s) { localStorage.removeItem('sesion'); location.href = 'login.html'; }
  if (!respuesta.ok) {
    throw Object.assign(new Error(datos.error || 'Error inesperado'), { estado: respuesta.status, datos });
  }
  return datos;
}

function usuarioId() {
  const s = sesion();
  if (!s) return null;
  try {
    const base64 = s.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64)).id;
  } catch { return null; }
}

function exigirRol(...roles) {
  const s = sesion();
  if (!s || !roles.includes(s.rol)) { location.replace('login.html'); return false; }
  return true;
}

const MENU = {
  CLIENTE: [['Productos', 'index.html'], ['Mis pedidos', 'mis-pedidos.html'], ['Servicio técnico', 'servicio.html'], ['Mis órdenes', 'mis-ordenes.html']],
  ADMIN: [['Pedidos', 'admin-pedidos.html'], ['Productos', 'admin-productos.html'], ['Órdenes de servicio', 'admin-ordenes.html'], ['Catálogo', 'index.html']],
  TECNICO: [['Mis órdenes', 'tecnico.html']],
};

function pintarEncabezado() {
  const zona = document.getElementById('zona-sesion');
  if (!zona) return;
  zona.replaceChildren();
  const s = sesion();
  if (!s) { zona.append(el('a', { class: 'btn', href: 'login.html' }, 'Ingresar')); return; }
  const actual = location.pathname.split('/').pop() || 'index.html';
  for (const [texto, href] of MENU[s.rol] || []) {
    zona.append(el('a', { class: 'enlace-menu' + (href === actual ? ' activo' : ''), href }, texto));
  }
  zona.append(el('span', {}, 'Hola, ', s.nombre), el('button', { class: 'btn claro', type: 'button', onclick: cerrarSesion }, 'Salir'));
}