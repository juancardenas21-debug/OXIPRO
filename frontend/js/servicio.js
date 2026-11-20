const hoy = new Date().toLocaleDateString('en-CA'); // AAAA-MM-DD en hora local

async function cargarEquipos() {
  const equipos = await api(`/clientes/${usuarioId()}/equipos`);
  document.getElementById('equipos').replaceChildren(
    equipos.length === 0
      ? el('p', { class: 'sub' }, 'Aún no tienes equipos registrados.')
      : tabla(['Tipo', 'Marca', 'N.° de serie'], equipos.map((e) => [e.tipoEquipo, e.marca, e.numeroSerie]))
  );
  const sel = document.getElementById('sel-equipo');
  sel.replaceChildren(...equipos.map((e) => el('option', { value: String(e.idEquipo) }, `${e.tipoEquipo} · ${e.marca} · ${e.numeroSerie}`)));
  document.getElementById('enviar-orden').disabled = equipos.length === 0;
}

async function agregarEquipo(fd, form) {
  await api(`/clientes/${usuarioId()}/equipos`, {
    metodo: 'POST',
    cuerpo: { tipoEquipo: String(fd.get('tipoEquipo')).trim(), marca: String(fd.get('marca')).trim(), numeroSerie: String(fd.get('numeroSerie')).trim() },
  });
  form.reset();
  await cargarEquipos();
  mostrarMensaje('Equipo registrado', 'ok');
}

async function solicitar(fd, form) {
  await api('/ordenes', {
    metodo: 'POST',
    cuerpo: {
      idEquipo: Number(fd.get('idEquipo')),
      tipoMantenimiento: fd.get('tipo'),
      descripcionFalla: String(fd.get('falla')).trim(),
      fechaPreferida: fd.get('fecha'),
    },
  });
  form.reset();
  mostrarMensaje('Solicitud enviada. Puedes seguirla en «Mis órdenes».', 'ok');
}

async function iniciar() {
  const panelEquipos = el('div', { class: 'panel' },
    el('h2', {}, 'Mis equipos'),
    el('div', { id: 'equipos' }),
    el('form', { class: 'espacio', onsubmit: enviar(agregarEquipo) },
      el('h3', {}, 'Registrar un equipo'),
      el('label', { for: 'tipoEquipo' }, 'Tipo de equipo (regulador, soplete, manómetro…)'),
      el('input', { id: 'tipoEquipo', name: 'tipoEquipo', required: '' }),
      el('label', { for: 'marca' }, 'Marca'),
      el('input', { id: 'marca', name: 'marca', required: '' }),
      el('label', { for: 'numeroSerie' }, 'Número de serie'),
      el('input', { id: 'numeroSerie', name: 'numeroSerie', required: '' }),
      el('div', { class: 'acciones' }, el('button', { class: 'btn', type: 'submit' }, 'Registrar equipo')))
  );
  const panelSolicitud = el('form', { class: 'panel', onsubmit: enviar(solicitar) },
    el('h2', {}, 'Solicitar servicio'),
    el('label', { for: 'sel-equipo' }, 'Equipo'),
    el('select', { id: 'sel-equipo', name: 'idEquipo', required: '' }),
    el('label', { for: 'tipo' }, 'Tipo de servicio'),
    el('select', { id: 'tipo', name: 'tipo' },
      el('option', { value: 'PREVENTIVO' }, 'Preventivo'),
      el('option', { value: 'CORRECTIVO' }, 'Correctivo'),
      el('option', { value: 'CALIBRACION' }, 'Calibración')),
    el('label', { for: 'falla' }, 'Descripción de la falla'),
    el('textarea', { id: 'falla', name: 'falla', required: '' }),
    el('label', { for: 'fecha' }, 'Fecha preferida de ingreso'),
    el('input', { id: 'fecha', name: 'fecha', type: 'date', required: '', min: hoy }),
    el('p', { class: 'sub' }, 'OxiPro confirmará la fecha y te asignará un técnico.'),
    el('div', { class: 'acciones' }, el('button', { class: 'btn', type: 'submit', id: 'enviar-orden' }, 'Enviar solicitud'))
  );
  document.getElementById('app').replaceChildren(
    el('h1', {}, 'Servicio técnico'),
    el('p', { class: 'sub' }, 'Mantenimiento, reparación o calibración de tus equipos de oxicorte'),
    el('div', { class: 'dos' }, panelEquipos, panelSolicitud)
  );
  await cargarEquipos();
}

if (exigirRol('CLIENTE')) { pintarEncabezado(); iniciar().catch((e) => mostrarMensaje(e.message)); }