const params = new URLSearchParams(location.search);
const DESTINOS = ['index.html', 'checkout.html']; // solo se permite volver a estas páginas
const destino = () => (DESTINOS.includes(params.get('volver')) ? params.get('volver') : 'index.html');

if (sesion()) location.replace(destino());

const formIngresar = document.getElementById('form-ingresar');
const formRegistro = document.getElementById('form-registro');
const tabIngresar = document.getElementById('tab-ingresar');
const tabRegistro = document.getElementById('tab-registro');
const mensaje = document.getElementById('mensaje');

function mostrar(cual) {
  const ingresar = cual === 'ingresar';
  formIngresar.hidden = !ingresar;
  formRegistro.hidden = ingresar;
  tabIngresar.classList.toggle('activa', ingresar);
  tabRegistro.classList.toggle('activa', !ingresar);
  mensaje.hidden = true;
}
function aviso(texto) { mensaje.textContent = texto; mensaje.hidden = false; }

async function iniciar(correo, password) {
  const r = await api('/auth/login', { metodo: 'POST', cuerpo: { correo, password }, auth: false });
  guardarSesion({ token: r.token, rol: r.rol, nombre: r.nombre });
  location.href = destino();
}

tabIngresar.addEventListener('click', () => mostrar('ingresar'));
tabRegistro.addEventListener('click', () => mostrar('registro'));

formIngresar.addEventListener('submit', async (e) => {
  e.preventDefault();
  const boton = e.submitter;
  boton.disabled = true;
  const d = Object.fromEntries(new FormData(formIngresar));
  try {
    await iniciar(d.correo.trim(), d.password);
  } catch (error) {
    aviso(error.message);
    boton.disabled = false;
  }
});

formRegistro.addEventListener('submit', async (e) => {
  e.preventDefault();
  const boton = e.submitter;
  boton.disabled = true;
  const d = Object.fromEntries(new FormData(formRegistro));
  d.correo = d.correo.trim();
  try {
    await api('/clientes', { metodo: 'POST', cuerpo: d, auth: false });
    await iniciar(d.correo, d.password);
  } catch (error) {
    aviso(error.message);
    boton.disabled = false;
  }
});