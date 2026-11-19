pintarEncabezado();

const s = sesion();
const puedeComprar = !s || s.rol === 'CLIENTE';
document.getElementById('nota-rol').hidden = puedeComprar;

const rejilla = document.getElementById('rejilla');
const aviso = document.getElementById('aviso');
const selCategoria = document.getElementById('categoria');
const cajon = document.getElementById('cajon');
const cortina = document.getElementById('cortina');
const botonCarrito = document.getElementById('boton-carrito');

function abrirCarrito() { pintarCarrito(); cajon.hidden = false; cortina.hidden = false; }
function cerrarCarrito() { cajon.hidden = true; cortina.hidden = true; }

function pintarCarrito() {
  const lineas = Carrito.leer();
  botonCarrito.textContent = `Carrito (${Carrito.cantidadTotal()})`;
  const lista = document.getElementById('lineas');
  lista.replaceChildren();
  if (lineas.length === 0) lista.append(el('p', { class: 'sub' }, 'Tu carrito está vacío.'));
  for (const l of lineas) {
    lista.append(
      el('div', { class: 'linea' },
        el('div', {}, el('strong', {}, l.nombre), el('div', { class: 'stock' }, moneda(l.precio), ' c/u')),
        el('button', { class: 'btn enlace', type: 'button', onclick: () => { Carrito.quitar(l.idProducto); pintarCarrito(); } }, 'Quitar'),
        el('div', { class: 'cantidad' },
          el('button', { class: 'btn claro', type: 'button', 'aria-label': 'Restar uno', onclick: () => { Carrito.cambiar(l.idProducto, -1); pintarCarrito(); } }, '−'),
          el('span', {}, String(l.cantidad)),
          el('button', { class: 'btn claro', type: 'button', 'aria-label': 'Sumar uno', onclick: () => { Carrito.cambiar(l.idProducto, 1); pintarCarrito(); } }, '+')),
        el('strong', {}, monedaCentavos(centavos(l.precio) * l.cantidad))
      )
    );
  }
  document.getElementById('total').textContent = monedaCentavos(Carrito.totalCentavos());
  document.getElementById('finalizar').disabled = lineas.length === 0 || !puedeComprar;
}

function tarjeta(p) {
  const agotado = p.stock <= 0;
  const textoStock = agotado ? 'Agotado' : p.stockBajo ? `Pocas unidades: ${p.stock}` : `Disponible: ${p.stock}`;
  const boton = el('button', {
    class: 'btn', type: 'button',
    onclick: () => { Carrito.agregar(p); abrirCarrito(); },
  }, 'Agregar');
  boton.disabled = agotado || !puedeComprar;
  return el('article', { class: 'tarjeta' },
    el('p', { class: 'categoria' }, p.categoria),
    el('h3', {}, p.nombre),
    el('p', { class: 'desc' }, p.descripcion || ''),
    el('p', { class: 'precio' }, moneda(p.precio)),
    el('p', { class: 'stock' + (agotado ? ' agotado' : p.stockBajo ? ' bajo' : '') }, textoStock),
    boton
  );
}

async function cargar(filtros = {}) {
  const q = new URLSearchParams();
  for (const [clave, valor] of Object.entries(filtros)) if (valor) q.set(clave, valor);
  try {
    const productos = await api('/productos' + (q.toString() ? '?' + q : ''));
    rejilla.replaceChildren(...productos.map(tarjeta));
    aviso.hidden = productos.length > 0;
    aviso.textContent = 'No se encontraron productos con esos criterios.';
    return productos;
  } catch (error) {
    aviso.textContent = error.message;
    aviso.hidden = false;
    return [];
  }
}

document.getElementById('filtros').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = Object.fromEntries(new FormData(e.target));
  cargar({
    texto: f.texto, categoria: f.categoria, precioMin: f.precioMin, precioMax: f.precioMax,
    soloDisponibles: f.soloDisponibles ? 'true' : '',
  });
});

botonCarrito.addEventListener('click', abrirCarrito);
cortina.addEventListener('click', cerrarCarrito);
document.getElementById('cerrar-carrito').addEventListener('click', cerrarCarrito);
document.getElementById('finalizar').addEventListener('click', () => {
  location.href = sesion() ? 'checkout.html' : 'login.html?volver=checkout.html';
});

(async () => {
  const productos = await cargar();
  const categorias = [...new Set(productos.map((p) => p.categoria))].sort();
  for (const c of categorias) selCategoria.append(el('option', { value: c }, c));
  pintarCarrito();
})();