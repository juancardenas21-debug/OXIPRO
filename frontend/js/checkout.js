function opcion(valor, texto, marcada) {
  const radio = el('input', { type: 'radio', name: 'metodo', value: valor, style: 'width:auto' });
  if (marcada) radio.checked = true;
  return el('label', { style: 'font-weight:400' }, radio, ' ', texto);
}

async function confirmar(fd) {
  const lineas = Carrito.leer();
  try {
    const r = await api('/pedidos', {
      metodo: 'POST',
      cuerpo: {
        direccionEntrega: String(fd.get('direccion')).trim(),
        metodoPago: fd.get('metodo'),
        lineas: lineas.map((l) => ({ idProducto: l.idProducto, cantidad: l.cantidad })),
      },
    });
    Carrito.vaciar();
    document.getElementById('app').replaceChildren(
      el('div', { class: 'panel' },
        el('h1', {}, 'Pedido recibido'),
        el('p', {}, `Tu pedido n.° ${r.idPedido} quedó registrado por ${moneda(r.total)}.`),
        el('p', {}, 'Estado: ', chip(r.estado)),
        el('p', { class: 'sub' }, 'Cuando se confirme tu pago, verás la factura en «Mis pedidos».'),
        el('div', { class: 'acciones' }, el('a', { class: 'btn', href: 'mis-pedidos.html' }, 'Ver mis pedidos'))
      )
    );
  } catch (error) {
    if (error.estado === 409 && error.datos && error.datos.idProducto) {
      const p = lineas.find((l) => l.idProducto === error.datos.idProducto);
      throw new Error(`«${p ? p.nombre : 'Un producto'}» ya no tiene stock suficiente. Vuelve al catálogo y ajusta tu carrito.`);
    }
    throw error;
  }
}

function iniciar() {
  const app = document.getElementById('app');
  const lineas = Carrito.leer();
  app.replaceChildren(el('h1', {}, 'Finalizar compra'));
  if (lineas.length === 0) {
    app.append(el('p', { class: 'mensaje info' }, 'Tu carrito está vacío. ', el('a', { href: 'index.html' }, 'Volver al catálogo')));
    return;
  }
  const resumen = el('div', { class: 'panel' },
    el('h2', {}, 'Resumen del pedido'),
    tabla(['Producto', 'Cantidad', 'Subtotal'],
      lineas.map((l) => [l.nombre, String(l.cantidad), monedaCentavos(centavos(l.precio) * l.cantidad)])),
    el('p', { class: 'total' }, el('span', {}, 'Total (IVA incluido)'), el('strong', {}, monedaCentavos(Carrito.totalCentavos())))
  );
  const form = el('form', { class: 'panel', onsubmit: enviar(confirmar) },
    el('h2', {}, 'Entrega y pago'),
    el('label', { for: 'direccion' }, 'Dirección de entrega'),
    el('input', { id: 'direccion', name: 'direccion', required: '', maxlength: '150' }),
    el('label', {}, 'Método de pago'),
    opcion('TRANSFERENCIA', 'Transferencia bancaria: el administrador confirma el pago al recibir tu comprobante', true),
    opcion('EFECTIVO', 'Efectivo: el administrador registra el pago', false),
    el('p', { class: 'sub' }, 'El pedido queda pendiente hasta que se confirme el pago.'),
    el('div', { class: 'acciones' },
      el('button', { class: 'btn', type: 'submit' }, 'Confirmar pedido'),
      el('a', { class: 'btn claro', href: 'index.html' }, 'Seguir comprando'))
  );
  app.append(el('div', { class: 'dos' }, form, resumen));
}

if (exigirRol('CLIENTE')) { pintarEncabezado(); iniciar(); }