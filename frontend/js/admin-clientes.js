let editando = null;
const TIPOS = ['CC', 'NIT', 'CE'];

function campo(nombre, texto, extra = {}) {
  return el('div', {},
    el('label', { for: 'c-' + nombre }, texto),
    el('input', { id: 'c-' + nombre, name: nombre, required: '', ...extra }));
}

function cerrarFormulario() {
  document.getElementById('form-cliente').hidden = true;
  editando = null;
}

function editar(c) {
  editando = c.idCliente;
  document.getElementById('titulo-form').textContent = `Editar cliente #${c.idCliente}`;
  const valores = {
    nombre: c.nombre, apellido: c.apellido, tipoDoc: c.tipoDoc, documento: c.documento,
    telefono: c.telefono, correo: c.correo, direccion: c.direccion,
  };
  for (const [clave, valor] of Object.entries(valores)) document.getElementById('c-' + clave).value = valor;
  const form = document.getElementById('form-cliente');
  form.hidden = false;
  form.scrollIntoView({ behavior: 'smooth' });
}

async function guardar(fd) {
  const cuerpo = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v).trim()]));
  await api('/clientes/' + editando, { metodo: 'PUT', cuerpo });
  cerrarFormulario();
  await cargar();
  mostrarMensaje('Cliente actualizado', 'ok');
}

async function cargar() {
  const q = new URLSearchParams();
  const texto = document.getElementById('buscar').value.trim();
  const estado = document.getElementById('estado').value;
  if (texto) q.set('texto', texto);
  if (estado) q.set('estado', estado);
  const clientes = await api('/clientes' + (q.toString() ? '?' + q : ''));
  document.getElementById('lista').replaceChildren(el('div', { class: 'panel' },
    clientes.length === 0
      ? el('p', { class: 'sub' }, 'No se encontraron clientes.')
      : tabla(['Cliente', 'Documento', 'Contacto', 'Estado', ''],
          clientes.map((c) => [
            el('strong', {}, `${c.nombre} ${c.apellido}`),
            `${c.tipoDoc} ${c.documento}`,
            el('div', {}, c.correo, el('br'), c.telefono),
            chip(c.estado),
            el('div', { class: 'acciones', style: 'margin:0' },
              boton('Editar', () => editar(c), 'claro'),
              c.estado === 'ACTIVO'
                ? boton('Inactivar', accion(async () => {
                    if (!confirm(`¿Inactivar a ${c.nombre} ${c.apellido}? Ya no podrá iniciar sesión.`)) return;
                    await api(`/clientes/${c.idCliente}/inactivar`, { metodo: 'PATCH' });
                    await cargar();
                    mostrarMensaje('Cliente inactivado', 'ok');
                  }), 'peligro')
                : ''),
          ]))
  ));
}

async function iniciar() {
  const buscador = el('form', { class: 'panel', onsubmit: enviar(cargar) },
    el('div', { class: 'fila' },
      el('div', {},
        el('label', { for: 'buscar', style: 'margin-top:0' }, 'Buscar'),
        el('input', { id: 'buscar', type: 'search', placeholder: 'Nombre, documento o correo' })),
      el('div', { style: 'flex:0 0 200px' },
        el('label', { for: 'estado', style: 'margin-top:0' }, 'Estado'),
        el('select', { id: 'estado' },
          el('option', { value: '' }, 'Todos'),
          el('option', { value: 'ACTIVO' }, 'Activos'),
          el('option', { value: 'INACTIVO' }, 'Inactivos')))),
    el('div', { class: 'acciones' }, el('button', { class: 'btn', type: 'submit' }, 'Buscar')));

  const form = el('form', { id: 'form-cliente', class: 'panel espacio', hidden: '', onsubmit: enviar(guardar) },
    el('h2', { id: 'titulo-form' }, 'Editar cliente'),
    el('div', { class: 'fila' }, campo('nombre', 'Nombre', { maxlength: '60' }), campo('apellido', 'Apellido', { maxlength: '60' })),
    el('div', { class: 'fila' },
      el('div', { style: 'flex:0 0 110px' },
        el('label', { for: 'c-tipoDoc' }, 'Tipo'),
        el('select', { id: 'c-tipoDoc', name: 'tipoDoc' }, ...TIPOS.map((t) => el('option', { value: t }, t)))),
      campo('documento', 'Número de documento', { maxlength: '20' })),
    el('div', { class: 'fila' },
      campo('telefono', 'Teléfono', { maxlength: '15', type: 'tel' }),
      campo('correo', 'Correo electrónico', { maxlength: '100', type: 'email' })),
    campo('direccion', 'Dirección', { maxlength: '150' }),
    el('div', { class: 'acciones' },
      el('button', { class: 'btn', type: 'submit' }, 'Guardar cambios'),
      boton('Cancelar', cerrarFormulario, 'claro')));

  document.getElementById('app').replaceChildren(
    el('h1', {}, 'Clientes'),
    el('p', { class: 'sub' }, 'Consulta, corrige e inactiva clientes'),
    buscador,
    el('div', { id: 'lista', class: 'espacio' }),
    form
  );
  await cargar();
}

if (exigirRol('ADMIN')) { pintarEncabezado(); iniciar().catch((e) => mostrarMensaje(e.message)); }