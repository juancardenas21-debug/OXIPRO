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
  if (respuesta.status === 401 && s) localStorage.removeItem('sesion'); // token vencido
  if (!respuesta.ok) {
    throw Object.assign(new Error(datos.error || 'Error inesperado'), { estado: respuesta.status, datos });
  }
  return datos;
}

function pintarEncabezado() {
  const zona = document.getElementById('zona-sesion');
  if (!zona) return;
  zona.replaceChildren();
  const s = sesion();
  if (s) {
    zona.append(
      el('span', {}, 'Hola, ', s.nombre),
      el('button', { class: 'btn claro', type: 'button', onclick: cerrarSesion }, 'Salir')
    );
  } else {
    zona.append(el('a', { class: 'btn', href: 'login.html' }, 'Ingresar'));
  }
}