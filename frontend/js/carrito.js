const Carrito = {
  leer() {
    try { return JSON.parse(localStorage.getItem('carrito')) || []; } catch { return []; }
  },
  guardar(lineas) { localStorage.setItem('carrito', JSON.stringify(lineas)); },
  agregar(p) {
    const lineas = this.leer();
    const linea = lineas.find((l) => l.idProducto === p.idProducto);
    if (linea) {
      if (linea.cantidad < p.stock) linea.cantidad += 1;
    } else {
      lineas.push({ idProducto: p.idProducto, nombre: p.nombre, precio: p.precio, stock: p.stock, cantidad: 1 });
    }
    this.guardar(lineas);
  },
  cambiar(id, delta) {
    let lineas = this.leer();
    const linea = lineas.find((l) => l.idProducto === id);
    if (!linea) return;
    linea.cantidad = Math.min(linea.cantidad + delta, linea.stock);
    if (linea.cantidad <= 0) lineas = lineas.filter((l) => l !== linea);
    this.guardar(lineas);
  },
  quitar(id) { this.guardar(this.leer().filter((l) => l.idProducto !== id)); },
  vaciar() { localStorage.removeItem('carrito'); },
  cantidadTotal() { return this.leer().reduce((suma, l) => suma + l.cantidad, 0); },
  totalCentavos() { return this.leer().reduce((suma, l) => suma + centavos(l.precio) * l.cantidad, 0); },
};