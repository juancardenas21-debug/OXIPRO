const ETIQUETA = {
  PENDIENTE: 'Pendiente', PAGADO: 'Pagado', EN_PREPARACION: 'En preparación', ENVIADO: 'Enviado', ENTREGADO: 'Entregado', CANCELADO: 'Cancelado',
  SOLICITADA: 'Solicitada', AGENDADA: 'Agendada', EN_PROCESO: 'En proceso', FINALIZADA: 'Finalizada', ENTREGADA: 'Entregada', CANCELADA: 'Cancelada',
  APROBADO: 'Aprobado', NO_APROBADO: 'No aprobado', RECHAZADO: 'Rechazado', ACTIVO: 'Activo', INACTIVO: 'Inactivo',
  PREVENTIVO: 'Preventivo', CORRECTIVO: 'Correctivo', CALIBRACION: 'Calibración',
  TRANSFERENCIA: 'Transferencia', EFECTIVO: 'Efectivo', PASARELA: 'Pasarela de pagos',
};
const COLOR = {
  PENDIENTE: 'aviso', SOLICITADA: 'aviso', PAGADO: 'info', AGENDADA: 'info',
  EN_PREPARACION: 'proceso', EN_PROCESO: 'proceso', ENVIADO: 'proceso',
  FINALIZADA: 'ok', ENTREGADO: 'ok', ENTREGADA: 'ok', APROBADO: 'ok', ACTIVO: 'ok',
  CANCELADO: 'mal', CANCELADA: 'mal', NO_APROBADO: 'mal', RECHAZADO: 'mal', INACTIVO: 'mal',
};
const PASOS_PEDIDO = ['PENDIENTE', 'PAGADO', 'EN_PREPARACION', 'ENVIADO', 'ENTREGADO'];
const PASOS_ORDEN = ['SOLICITADA', 'AGENDADA', 'EN_PROCESO', 'FINALIZADA', 'ENTREGADA'];

const etiqueta = (codigo) => ETIQUETA[codigo] || codigo;
const chip = (estado) => el('span', { class: 'chip ' + (COLOR[estado] || '') }, etiqueta(estado));
const boton = (texto, alClic, clase = '') =>
  el('button', { class: ('btn ' + clase).trim(), type: 'button', onclick: alClic }, texto);

function mostrarMensaje(texto, tipo = 'error') {
  const m = document.getElementById('mensaje');
  m.textContent = texto;
  m.className = 'mensaje' + (tipo === 'error' ? '' : ' ' + tipo);
  m.hidden = false;
  m.scrollIntoView({ block: 'nearest' });
}
function ocultarMensaje() { document.getElementById('mensaje').hidden = true; }

// Botones: evita doble clic y muestra los errores
function accion(fn) {
  return async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    ocultarMensaje();
    try { await fn(); } catch (error) { mostrarMensaje(error.message); } finally { b.disabled = false; }
  };
}
// Formularios: igual, y entrega los datos del formulario
function enviar(fn) {
  return async (e) => {
    e.preventDefault();
    const b = e.submitter;
    if (b) b.disabled = true;
    ocultarMensaje();
    try { await fn(new FormData(e.currentTarget), e.currentTarget); }
    catch (error) { mostrarMensaje(error.message); }
    finally { if (b) b.disabled = false; }
  };
}

function fechaCorta(v) {
  if (!v) return '—';
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const [a, m, d] = s.split('-'); return `${d}/${m}/${a}`; }
  const f = new Date(s);
  return Number.isNaN(f.getTime()) ? s : f.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
}

function tabla(encabezados, filas) {
  return el('div', { class: 'tabla-scroll' },
    el('table', {},
      el('thead', {}, el('tr', {}, encabezados.map((h) => el('th', {}, h)))),
      el('tbody', {}, filas.map((f) => el('tr', {}, f.map((c) => el('td', {}, c ?? ''))))))
  );
}

function seguimiento(pasos, actual) {
  const i = pasos.indexOf(actual);
  return el('div', { class: 'seguimiento' }, pasos.map((p, k) =>
    el('div', { class: 'paso' + (k <= i ? ' hecho' : '') }, el('div', { class: 'barra' }), el('span', {}, etiqueta(p)))
  ));
}

function detallePedido(p) {
  const nodo = el('div', { class: 'panel' },
    el('h2', {}, `Pedido #${p.idPedido} `, chip(p.estado)),
    el('p', { class: 'sub' }, `Cliente n.° ${p.idCliente} · Fecha: ${fechaCorta(p.fecha)} · Entrega en: ${p.direccionEntrega}`),
    p.estado === 'CANCELADO' ? '' : seguimiento(PASOS_PEDIDO, p.estado),
    tabla(['Producto', 'Cantidad', 'Precio unitario', 'Subtotal'],
      p.lineas.map((l) => [l.nombre, String(l.cantidad), moneda(l.precioUnitario), moneda(l.subtotal)])),
    el('p', { class: 'total' }, el('span', {}, 'Total (IVA incluido)'), el('strong', {}, moneda(p.total)))
  );
  if (p.pago) {
    nodo.append(el('p', {}, `Pago: ${etiqueta(p.pago.metodo)} · `, chip(p.pago.estado), p.pago.referencia ? ` · Ref. ${p.pago.referencia}` : ''));
  }
  if (p.factura) {
    nodo.append(el('p', {}, `Factura n.° ${p.factura.idFactura} · Emitida: ${fechaCorta(p.factura.fechaEmision)} · IVA incluido: ${moneda(p.factura.impuestos)} · Total a pagar: ${moneda(p.factura.totalAPagar)}`));
  }
  return nodo;
}

function detalleOrden(o) {
  const solicitada = o.estado === 'SOLICITADA';
  const nodo = el('div', { class: 'panel' },
    el('h2', {}, `Orden #${o.idOrden} `, chip(o.estado)),
    el('p', { class: 'sub' }, `${etiqueta(o.tipoMantenimiento)} · Equipo n.° ${o.idEquipo} · Cliente n.° ${o.idCliente}`),
    o.estado === 'CANCELADA' ? '' : seguimiento(PASOS_ORDEN, o.estado),
    el('p', {}, el('strong', {}, 'Falla reportada: '), o.descripcionFalla),
    el('p', {}, `${solicitada ? 'Fecha preferida' : 'Fecha de ingreso'}: ${fechaCorta(o.fechaAgendada)} · Solicitada: ${fechaCorta(o.fechaSolicitud)} · ${o.idTecnico ? 'Técnico n.° ' + o.idTecnico : 'Sin técnico asignado'}`)
  );
  const i = o.informe;
  if (i) {
    nodo.append(
      el('h3', {}, 'Informe técnico'),
      el('p', {}, el('strong', {}, 'Diagnóstico: '), i.diagnostico),
      el('p', {}, el('strong', {}, 'Repuestos cambiados: '), i.repuestosCambiados),
      el('p', {}, 'Prueba de hermeticidad: ', chip(i.resultadoHermeticidad), ` · Fecha: ${fechaCorta(i.fechaInforme)}`),
      el('p', {}, i.idCertificado ? `Certificado ${i.codigoCertificado} · emitido ${fechaCorta(i.fechaCertificado)}` : 'Sin certificado emitido')
    );
  }
  return nodo;
}