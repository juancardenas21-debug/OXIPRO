pintarEncabezado();
if (sesion()) document.querySelector('.nav-publica').hidden = true;

function tarjeta(p) {
  return el('article', { class: 'tarjeta' },
    el('div', { class: 'imagen-prod' }),
    el('p', { class: 'categoria' }, p.categoria),
    el('h3', {}, p.nombre),
    el('p', { class: 'desc' }, p.descripcion || ''),
    el('p', { class: 'precio' }, moneda(p.precio)),
    el('a', { class: 'btn', href: 'productos.html' }, 'Ver en el catálogo')
  );
}

(async () => {
  const contenedor = document.getElementById('destacados');
  try {
    const productos = await api('/productos?soloDisponibles=true', { auth: false });
    const destacados = productos.slice(0, 3);
    contenedor.replaceChildren(...(destacados.length
      ? destacados.map(tarjeta)
      : [el('p', { class: 'sub' }, 'Pronto agregaremos productos al catálogo.')]));
  } catch {
    contenedor.replaceChildren(el('p', { class: 'sub' }, 'No pudimos cargar los productos en este momento.'));
  }
})();