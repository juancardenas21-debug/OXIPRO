async function listar() {
  const ordenes = await api('/ordenes');
  const lista = document.getElementById('lista');
  if (ordenes.length === 0) {
    lista.replaceChildren(el('p', { class: 'mensaje info' }, 'Aún no tienes órdenes de servicio. ', el('a', { href: 'servicio.html' }, 'Solicitar un servicio')));
    return;
  }
  lista.replaceChildren(el('div', { class: 'panel' },
    tabla(['N.°', 'Tipo', 'Solicitada', 'Estado', ''],
      ordenes.map((o) => [`#${o.idOrden}`, etiqueta(o.tipoMantenimiento), fechaCorta(o.fechaSolicitud), chip(o.estado),
        boton('Ver detalle', accion(() => ver(o.idOrden)), 'claro')]))
  ));
}

async function ver(id) {
  const o = await api('/ordenes/' + id);
  const nodo = detalleOrden(o);
  if (o.estado === 'SOLICITADA' || o.estado === 'AGENDADA') {
    nodo.append(el('div', { class: 'acciones' },
      boton('Cancelar orden', accion(async () => {
        const motivo = prompt('¿Por qué cancelas la orden?');
        if (!motivo || !motivo.trim()) return;
        await api(`/ordenes/${id}/cancelacion`, { metodo: 'POST', cuerpo: { motivo: motivo.trim() } });
        await listar();
        await ver(id);
        mostrarMensaje('Orden cancelada', 'ok');
      }), 'peligro')));
  }
  const detalle = document.getElementById('detalle');
  detalle.replaceChildren(nodo);
  detalle.scrollIntoView({ behavior: 'smooth' });
}

async function iniciar() {
  document.getElementById('app').replaceChildren(
    el('h1', {}, 'Mis órdenes de servicio'),
    el('p', { class: 'sub' }, 'Sigue el estado de tus mantenimientos y descarga tu informe'),
    el('div', { id: 'lista' }),
    el('div', { id: 'detalle', class: 'espacio' })
  );
  await listar();
}

if (exigirRol('CLIENTE')) { pintarEncabezado(); iniciar().catch((e) => mostrarMensaje(e.message)); }