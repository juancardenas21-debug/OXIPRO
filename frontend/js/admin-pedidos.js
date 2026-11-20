let todos = [];
const SIGUIENTE = {
  PAGADO: ['EN_PREPARACION', 'Pasar a En preparación'],
  EN_PREPARACION: ['ENVIADO', 'Marcar como enviado'],
  ENVIADO: ['ENTREGADO', 'Marcar como entregado'],
};
const CANCELABLES = ['PENDIENTE', 'PAGADO', 'EN_PREPARACION'];

function pintarLista() {
  const filtro = document.getElementById('filtro').value;
  const filas = todos.filter((p) => !filtro || p.estado === filtro);
  document.getElementById('lista').replaceChildren(el('div', { class: 'panel' },
    filas.length === 0
      ? el('p', { class: 'sub' }, 'No hay pedidos con ese estado.')
      : tabla(['N.°', 'Cliente', 'Fecha', 'Total', 'Estado', ''],
          filas.map((p) => [`#${p.idPedido}`, `n.° ${p.idCliente}`, fechaCorta(p.fecha), moneda(p.total), chip(p.estado),
            boton('Gestionar', accion(() => ver(p.idPedido)), 'claro')]))
  ));
}

async function cargar() { todos = await api('/pedidos'); pintarLista(); }

async function ver(id) {
  const p = await api('/pedidos/' + id);
  const nodo = detallePedido(p);
  const refrescar = async (texto) => { await cargar(); await ver(id); mostrarMensaje(texto, 'ok'); };

  if (p.estado === 'PENDIENTE') {
    nodo.append(el('form', {
      class: 'espacio',
      onsubmit: enviar(async (fd) => {
        const monto = String(fd.get('monto')).trim();
        if (!/^\d+(\.\d{1,2})?$/.test(monto)) throw new Error('Monto no válido');
        await api(`/pedidos/${id}/pago`, {
          metodo: 'POST',
          cuerpo: { metodo: fd.get('metodo'), monto, referencia: String(fd.get('referencia')).trim() },
        });
        await refrescar('Pago registrado: el pedido pasó a Pagado y se generó la factura.');
      }),
    },
      el('h3', {}, 'Registrar pago'),
      el('label', { for: 'metodo' }, 'Método'),
      el('select', { id: 'metodo', name: 'metodo' },
        el('option', { value: 'TRANSFERENCIA' }, 'Transferencia'), el('option', { value: 'EFECTIVO' }, 'Efectivo')),
      el('label', { for: 'monto' }, 'Monto recibido (debe ser igual al total)'),
      el('input', { id: 'monto', name: 'monto', value: String(p.total), required: '' }),
      el('label', { for: 'referencia' }, 'Referencia o comprobante'),
      el('input', { id: 'referencia', name: 'referencia', required: '', maxlength: '60' }),
      el('div', { class: 'acciones' }, el('button', { class: 'btn', type: 'submit' }, 'Registrar pago'))));
  }

  const acciones = el('div', { class: 'acciones' });
  if (SIGUIENTE[p.estado]) {
    const [nuevoEstado, texto] = SIGUIENTE[p.estado];
    acciones.append(boton(texto, accion(async () => {
      await api(`/pedidos/${id}/estado`, { metodo: 'PATCH', cuerpo: { nuevoEstado } });
      await refrescar('Estado actualizado');
    })));
  }
  if (CANCELABLES.includes(p.estado)) {
    acciones.append(boton('Cancelar pedido', accion(async () => {
      const motivo = prompt('Motivo de la cancelación:');
      if (!motivo || !motivo.trim()) return;
      const r = await api(`/pedidos/${id}/cancelacion`, { metodo: 'POST', cuerpo: { motivo: motivo.trim() } });
      await cargar();
      await ver(id);
      mostrarMensaje(r.reembolsoPendiente
        ? 'Pedido cancelado y stock repuesto. Hay un reembolso pendiente que debes gestionar fuera de la plataforma.'
        : 'Pedido cancelado y stock repuesto.', r.reembolsoPendiente ? 'info' : 'ok');
    }), 'peligro'));
  }
  if (acciones.children.length) nodo.append(acciones);

  const detalle = document.getElementById('detalle');
  detalle.replaceChildren(nodo);
  detalle.scrollIntoView({ behavior: 'smooth' });
}

async function iniciar() {
  const filtro = el('select', { id: 'filtro', style: 'max-width:240px', onchange: pintarLista },
    el('option', { value: '' }, 'Todos los estados'),
    ...PASOS_PEDIDO.concat('CANCELADO').map((e) => el('option', { value: e }, etiqueta(e))));
  document.getElementById('app').replaceChildren(
    el('h1', {}, 'Pedidos'),
    el('p', { class: 'sub' }, 'Registra pagos, avanza el estado y cancela pedidos'),
    filtro,
    el('div', { id: 'lista', class: 'espacio' }),
    el('div', { id: 'detalle', class: 'espacio' })
  );
  await cargar();
}

if (exigirRol('ADMIN')) { pintarEncabezado(); iniciar().catch((e) => mostrarMensaje(e.message)); }