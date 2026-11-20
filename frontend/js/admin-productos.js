let productos = [];
let editando = null;

function campo(nombre, texto, tipo = 'text') {
  const atributos = { id: 'p-' + nombre, name: nombre, type: tipo };
  if (tipo === 'number') { atributos.min = '0'; atributos.step = '1'; }
  if (nombre !== 'descripcion') atributos.required = '';
  return el('div', {}, el('label', { for: 'p-' + nombre }, texto), el('input', atributos));
}

function limpiar() {
  document.getElementById('form-producto').reset();
  document.getElementById('titulo-form').textContent = 'Nuevo producto';
  editando = null;
}

function editar(p) {
  editando = p.idProducto;
  document.getElementById('titulo-form').textContent = `Editar producto #${p.idProducto}`;
  for (const [campoId, valor] of [['nombre', p.nombre], ['categoria', p.categoria], ['descripcion', p.descripcion || ''],
    ['precio', p.precio], ['stock', p.stock], ['stockMinimo', p.stockMinimo]]) {
    document.getElementById('p-' + campoId).value = String(valor);
  }
  document.getElementById('form-producto').scrollIntoView({ behavior: 'smooth' });
}

async function guardar(fd) {
  const precio = String(fd.get('precio')).trim().replace(',', '.');
  const stock = Number(fd.get('stock'));
  const stockMinimo = Number(fd.get('stockMinimo'));
  if (!/^\d+(\.\d{1,2})?$/.test(precio) || Number(precio) <= 0) {
    throw new Error('El precio debe ser un número mayor a cero, con máximo 2 decimales');
  }
  if (!Number.isInteger(stock) || stock < 0 || !Number.isInteger(stockMinimo) || stockMinimo < 0) {
    throw new Error('El stock y el stock mínimo deben ser enteros mayores o iguales a cero');
  }
  const cuerpo = {
    nombre: String(fd.get('nombre')).trim(), categoria: String(fd.get('categoria')).trim(),
    descripcion: String(fd.get('descripcion')).trim(), precio, stock, stockMinimo,
  };
  const actualizando = editando !== null;
  if (actualizando) await api('/productos/' + editando, { metodo: 'PUT', cuerpo });
  else await api('/productos', { metodo: 'POST', cuerpo });
  limpiar();
  await cargar();
  mostrarMensaje(actualizando ? 'Producto actualizado' : 'Producto registrado', 'ok');
}

async function cargar() {
  productos = await api('/productos');
  const bajos = productos.filter((p) => p.estado === 'ACTIVO' && p.stockBajo).length;
  const alerta = document.getElementById('alerta');
  alerta.hidden = bajos === 0;
  alerta.textContent = `${bajos} producto(s) con stock igual o menor al mínimo.`;
  document.getElementById('lista').replaceChildren(el('div', { class: 'panel' },
    tabla(['Producto', 'Categoría', 'Precio', 'Stock', 'Mín.', 'Estado', ''],
      productos.map((p) => [p.nombre, p.categoria, moneda(p.precio),
        el('strong', { style: p.stockBajo ? 'color:#9B1C1C' : '' }, String(p.stock)),
        String(p.stockMinimo), chip(p.estado),
        el('div', { class: 'acciones', style: 'margin:0' },
          boton('Editar', () => editar(p), 'claro'),
          p.estado === 'ACTIVO'
            ? boton('Inactivar', accion(async () => {
                if (!confirm(`¿Inactivar «${p.nombre}»? Dejará de verse en el catálogo.`)) return;
                await api(`/productos/${p.idProducto}/inactivar`, { metodo: 'PATCH' });
                await cargar();
                mostrarMensaje('Producto inactivado', 'ok');
              }), 'peligro')
            : '')]))
  ));
}

async function iniciar() {
  const form = el('form', { id: 'form-producto', class: 'panel', onsubmit: enviar(guardar) },
    el('h2', { id: 'titulo-form' }, 'Nuevo producto'),
    campo('nombre', 'Nombre'), campo('categoria', 'Categoría'), campo('descripcion', 'Descripción'),
    el('div', { class: 'fila' }, campo('precio', 'Precio (COP)'), campo('stock', 'Stock', 'number'), campo('stockMinimo', 'Stock mínimo', 'number')),
    el('div', { class: 'acciones' },
      el('button', { class: 'btn', type: 'submit' }, 'Guardar'),
      boton('Limpiar', limpiar, 'claro')));
  document.getElementById('app').replaceChildren(
    el('h1', {}, 'Gestión de productos'),
    el('p', { class: 'sub' }, 'Registra, actualiza e inactiva productos del catálogo'),
    el('p', { id: 'alerta', class: 'mensaje info', hidden: '' }),
    el('div', { id: 'lista' }),
    el('div', { class: 'espacio' }, form)
  );
  await cargar();
}

if (exigirRol('ADMIN')) { pintarEncabezado(); iniciar().catch((e) => mostrarMensaje(e.message)); }