async function listar() {
  const ordenes = await api('/ordenes');
  document.getElementById('lista').replaceChildren(el('div', { class: 'panel' },
    ordenes.length === 0
      ? el('p', { class: 'sub' }, 'No tienes órdenes asignadas.')
      : tabla(['N.°', 'Tipo', 'Ingreso', 'Estado', ''],
          ordenes.map((o) => [`#${o.idOrden}`, etiqueta(o.tipoMantenimiento), fechaCorta(o.fechaAgendada), chip(o.estado),
            boton('Abrir', accion(() => ver(o.idOrden)), 'claro')]))
  ));
}

async function ver(id) {
  const o = await api('/ordenes/' + id);
  const nodo = detalleOrden(o);
  const refrescar = async (texto) => { await listar(); await ver(id); mostrarMensaje(texto, 'ok'); };

  if (o.estado === 'AGENDADA') {
    nodo.append(el('div', { class: 'acciones' }, boton('Recibir equipo (pasar a En proceso)', accion(async () => {
      await api('/ordenes/' + id, { metodo: 'PATCH', cuerpo: { nuevoEstado: 'EN_PROCESO' } });
      await refrescar('La orden está En proceso');
    }))));
  }

  if (o.estado === 'EN_PROCESO') {
    nodo.append(el('form', {
      class: 'espacio',
      onsubmit: enviar(async (fd) => {
        await api(`/ordenes/${id}/informe`, {
          metodo: 'POST',
          cuerpo: {
            diagnostico: String(fd.get('diagnostico')).trim(),
            repuestosCambiados: String(fd.get('repuestos')).trim(),
            resultadoHermeticidad: fd.get('resultado'),
          },
        });
        await refrescar('Informe guardado: la orden quedó Finalizada');
      }),
    },
      el('h3', {}, 'Registrar informe técnico'),
      el('label', { for: 'diagnostico' }, 'Diagnóstico y trabajo realizado'),
      el('textarea', { id: 'diagnostico', name: 'diagnostico', required: '' }),
      el('label', { for: 'repuestos' }, 'Repuestos cambiados'),
      el('input', { id: 'repuestos', name: 'repuestos', required: '' }),
      el('label', { for: 'resultado' }, 'Prueba de hermeticidad'),
      el('select', { id: 'resultado', name: 'resultado' },
        el('option', { value: 'APROBADO' }, 'Aprobada'), el('option', { value: 'NO_APROBADO' }, 'No aprobada')),
      el('div', { class: 'acciones' }, el('button', { class: 'btn', type: 'submit' }, 'Guardar informe'))));
  }

  const i = o.informe;
  if (i && i.resultadoHermeticidad === 'APROBADO' && !i.idCertificado && o.estado !== 'CANCELADA') {
    nodo.append(el('div', { class: 'acciones' }, boton('Generar certificado', accion(async () => {
      const c = await api(`/informes/${i.idInforme}/certificado`, { metodo: 'POST' });
      await refrescar(`Certificado generado: ${c.codigo}`);
    }))));
  }

  const detalle = document.getElementById('detalle');
  detalle.replaceChildren(nodo);
  detalle.scrollIntoView({ behavior: 'smooth' });
}

async function iniciar() {
  document.getElementById('app').replaceChildren(
    el('h1', {}, 'Mis órdenes'),
    el('p', { class: 'sub' }, 'Órdenes de servicio asignadas a ti'),
    el('div', { id: 'lista' }),
    el('div', { id: 'detalle', class: 'espacio' })
  );
  await listar();
}

if (exigirRol('TECNICO')) { pintarEncabezado(); iniciar().catch((e) => mostrarMensaje(e.message)); }