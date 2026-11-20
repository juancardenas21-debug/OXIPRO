async function listar() {
  const pedidos = await api('/pedidos');
  const lista = document.getElementById('lista');
  if (pedidos.length === 0) {
    lista.replaceChildren(el('p', { class: 'mensaje info' }, 'Aún no tienes pedidos. ', el('a', { href: 'index.html' }, 'Ir al catálogo')));
    return;
  }
  lista.replaceChildren(el('div', { class: 'panel' },
    tabla(['N.°', 'Fecha', 'Total', 'Estado', ''],
      pedidos.map((p) => [`#${p.idPedido}`, fechaCorta(p.fecha), moneda(p.total), chip(p.estado),
        boton('Ver detalle', accion(() => ver(p.idPedido)), 'claro')]))
  ));
}

async function ver(id) {
  const p = await api('/pedidos/' + id);
  const nodo = detallePedido(p);
  if (p.estado === 'PENDIENTE') {
    nodo.append(el('div', { class: 'acciones' },
      boton('Cancelar pedido', accion(async () => {
        const motivo = prompt('¿Por qué cancelas el pedido?');
        if (!motivo || !motivo.trim()) return;
        await api(`/pedidos/${id}/cancelacion`, { metodo: 'POST', cuerpo: { motivo: motivo.trim() } });
        await listar();
        await ver(id);
        mostrarMensaje('Pedido cancelado', 'ok');
      }), 'peligro')));
  }
  const detalle = document.getElementById('detalle');
  detalle.replaceChildren(nodo);
  detalle.scrollIntoView({ behavior: 'smooth' });
}

async function iniciar() {
  document.getElementById('app').replaceChildren(
    el('h1', {}, 'Mis pedidos'),
    el('p', { class: 'sub' }, 'Consulta el estado de tus compras'),
    el('div', { id: 'lista' }),
    el('div', { id: 'detalle', class: 'espacio' })
  );
  await listar();
}

if (exigirRol('CLIENTE')) { pintarEncabezado(); iniciar().catch((e) => mostrarMensaje(e.message)); }