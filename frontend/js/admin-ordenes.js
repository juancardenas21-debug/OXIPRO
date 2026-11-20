const hoy = new Date().toLocaleDateString('en-CA');
let ordenes = [];

function pintarLista() {
  document.getElementById('lista').replaceChildren(el('div', { class: 'panel' },
    ordenes.length === 0
      ? el('p', { class: 'sub' }, 'No hay órdenes con ese estado.')
      : tabla(['N.°', 'Cliente', 'Tipo', 'Solicitada', 'Estado', ''],
          ordenes.map((o) => [`#${o.idOrden}`, `n.° ${o.idCliente}`, etiqueta(o.tipoMantenimiento), fechaCorta(o.fechaSolicitud), chip(o.estado),
            boton('Gestionar', accion(() => ver(o.idOrden)), 'claro')]))
  ));
}

async function cargar() {
  const estado = document.getElementById('filtro').value;
  ordenes = await api('/ordenes' + (estado ? '?estado=' + estado : ''));
  pintarLista();
}

async function ver(id) {
  const o = await api('/ordenes/' + id);
  const nodo = detalleOrden(o);
  const refrescar = async (texto) => { await cargar(); await ver(id); mostrarMensaje(texto, 'ok'); };

  if (o.estado === 'SOLICITADA') {
    const tecnicos = await api('/tecnicos');
    const sugerida = o.fechaAgendada && o.fechaAgendada >= hoy ? o.fechaAgendada : hoy;
    nodo.append(tecnicos.length === 0
      ? el('p', { class: 'mensaje info' }, 'No hay técnicos activos. Crea uno antes de agendar.')
      : el('form', {
          class: 'espacio',
          onsubmit: enviar(async (fd) => {
            await api('/ordenes/' + id, {
              metodo: 'PATCH',
              cuerpo: { fechaAgendada: fd.get('fecha'), idTecnico: Number(fd.get('idTecnico')) },
            });
            await refrescar('Orden agendada');
          }),
        },
          el('h3', {}, 'Agendar y asignar técnico'),
          el('label', { for: 'fecha' }, 'Fecha de ingreso al taller'),
          el('input', { id: 'fecha', name: 'fecha', type: 'date', required: '', min: hoy, value: sugerida }),
          el('label', { for: 'idTecnico' }, 'Técnico'),
          el('select', { id: 'idTecnico', name: 'idTecnico', required: '' },
            ...tecnicos.map((t) => el('option', { value: String(t.idTecnico) }, `${t.nombre} ${t.apellido} · ${t.especialidad}`))),
          el('div', { class: 'acciones' }, el('button', { class: 'btn', type: 'submit' }, 'Agendar'))));
  }

  const acciones = el('div', { class: 'acciones' });
  if (o.estado === 'FINALIZADA') {
    acciones.append(boton('Marcar como entregada', accion(async () => {
      await api('/ordenes/' + id, { metodo: 'PATCH', cuerpo: { nuevoEstado: 'ENTREGADA' } });
      await refrescar('Orden entregada');
    })));
  }
  if (o.estado === 'SOLICITADA' || o.estado === 'AGENDADA') {
    acciones.append(boton('Cancelar orden', accion(async () => {
      const motivo = prompt('Motivo de la cancelación:');
      if (!motivo || !motivo.trim()) return;
      await api(`/ordenes/${id}/cancelacion`, { metodo: 'POST', cuerpo: { motivo: motivo.trim() } });
      await refrescar('Orden cancelada');
    }), 'peligro'));
  }
  if (acciones.children.length) nodo.append(acciones);

  const detalle = document.getElementById('detalle');
  detalle.replaceChildren(nodo);
  detalle.scrollIntoView({ behavior: 'smooth' });
}

async function iniciar() {
  const filtro = el('select', { id: 'filtro', style: 'max-width:240px', onchange: accion(cargar) },
    el('option', { value: '' }, 'Todos los estados'),
    ...PASOS_ORDEN.concat('CANCELADA').map((e) => el('option', { value: e }, etiqueta(e))));
  document.getElementById('app').replaceChildren(
    el('h1', {}, 'Órdenes de servicio'),
    el('p', { class: 'sub' }, 'Agenda, asigna técnico y entrega los equipos'),
    filtro,
    el('div', { id: 'lista', class: 'espacio' }),
    el('div', { id: 'detalle', class: 'espacio' })
  );
  await cargar();
}

if (exigirRol('ADMIN')) { pintarEncabezado(); iniciar().catch((e) => mostrarMensaje(e.message)); }