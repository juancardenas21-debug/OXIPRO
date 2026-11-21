async function guardar(fd) {
  const cuerpo = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v).trim()]));
  const r = await api('/clientes/' + usuarioId(), { metodo: 'PUT', cuerpo });
  guardarSesion({ ...sesion(), nombre: r.nombre });
  pintarEncabezado();
  mostrarMensaje('Tus datos se actualizaron', 'ok');
}

async function iniciar() {
  const c = await api('/clientes/' + usuarioId());
  const campo = (nombre, texto, valor, extra = {}) => el('div', {},
    el('label', { for: 'p-' + nombre }, texto),
    el('input', { id: 'p-' + nombre, name: nombre, required: '', value: valor, ...extra }));

  document.getElementById('app').replaceChildren(
    el('h1', {}, 'Mi perfil'),
    el('p', { class: 'sub' }, 'Actualiza tus datos de contacto y de entrega'),
    el('form', { class: 'panel', style: 'max-width:620px', onsubmit: enviar(guardar) },
      el('div', { class: 'fila' },
        campo('nombre', 'Nombre', c.nombre, { maxlength: '60' }),
        campo('apellido', 'Apellido', c.apellido, { maxlength: '60' })),
      el('label', { for: 'p-documento' }, 'Documento'),
      el('input', { id: 'p-documento', value: `${c.tipoDoc} ${c.documento}`, disabled: '' }),
      el('p', { class: 'sub' }, 'Para corregir tu documento, comunícate con OxiPro.'),
      campo('telefono', 'Teléfono', c.telefono, { maxlength: '15', type: 'tel' }),
      campo('correo', 'Correo electrónico', c.correo, { maxlength: '100', type: 'email' }),
      campo('direccion', 'Dirección', c.direccion, { maxlength: '150' }),
      el('div', { class: 'acciones' }, el('button', { class: 'btn', type: 'submit' }, 'Guardar cambios')))
  );
}

if (exigirRol('CLIENTE')) { pintarEncabezado(); iniciar().catch((e) => mostrarMensaje(e.message)); }