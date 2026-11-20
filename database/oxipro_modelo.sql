-- OxiPro Soluciones Industriales: modelo de datos (MySQL 8 / MariaDB)
CREATE DATABASE IF NOT EXISTS oxipro CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE oxipro;

CREATE TABLE usuario (
  id_usuario BIGINT AUTO_INCREMENT,
  nombre VARCHAR(60) NOT NULL,
  apellido VARCHAR(60) NOT NULL,
  tipo_doc VARCHAR(5) NOT NULL,
  documento VARCHAR(20) NOT NULL,
  telefono VARCHAR(15) NOT NULL,
  correo VARCHAR(100) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol ENUM('ADMIN', 'CLIENTE', 'TECNICO') NOT NULL,
  estado ENUM('ACTIVO', 'INACTIVO') NOT NULL,
  PRIMARY KEY (id_usuario),
  UNIQUE KEY uq_usuario_documento (documento),
  UNIQUE KEY uq_usuario_correo (correo)
) ENGINE=InnoDB;

CREATE TABLE cliente (
  id_cliente BIGINT,
  direccion VARCHAR(150) NOT NULL,
  PRIMARY KEY (id_cliente),
  CONSTRAINT fk_cliente_id_cliente FOREIGN KEY (id_cliente) REFERENCES usuario(id_usuario) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE tecnico (
  id_tecnico BIGINT,
  especialidad VARCHAR(80) NOT NULL,
  PRIMARY KEY (id_tecnico),
  CONSTRAINT fk_tecnico_id_tecnico FOREIGN KEY (id_tecnico) REFERENCES usuario(id_usuario) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE producto (
  id_producto BIGINT AUTO_INCREMENT,
  nombre VARCHAR(100) NOT NULL,
  categoria VARCHAR(50) NOT NULL,
  descripcion TEXT NOT NULL,
  precio DECIMAL(12,2) NOT NULL,
  stock INT NOT NULL,
  stock_minimo INT NOT NULL,
  estado ENUM('ACTIVO', 'INACTIVO') NOT NULL,
  PRIMARY KEY (id_producto),
  CONSTRAINT ck_producto_stock CHECK (stock >= 0),
  CONSTRAINT ck_producto_stock_minimo CHECK (stock_minimo >= 0),
  CONSTRAINT ck_producto_precio CHECK (precio > 0)
) ENGINE=InnoDB;

CREATE TABLE pedido (
  id_pedido BIGINT AUTO_INCREMENT,
  id_cliente BIGINT NOT NULL,
  fecha DATETIME NOT NULL,
  estado ENUM('PENDIENTE', 'PAGADO', 'EN_PREPARACION', 'ENVIADO', 'ENTREGADO', 'CANCELADO') NOT NULL,
  direccion_entrega VARCHAR(150) NOT NULL,
  total DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (id_pedido),
  CONSTRAINT fk_pedido_id_cliente FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE detalle_pedido (
  id_detalle BIGINT AUTO_INCREMENT,
  id_pedido BIGINT NOT NULL,
  id_producto BIGINT NOT NULL,
  cantidad INT NOT NULL,
  precio_unitario DECIMAL(12,2) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (id_detalle),
  CONSTRAINT fk_detalle_pedido_id_pedido FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido) ON DELETE RESTRICT,
  CONSTRAINT fk_detalle_pedido_id_producto FOREIGN KEY (id_producto) REFERENCES producto(id_producto) ON DELETE RESTRICT,
  CONSTRAINT ck_detalle_pedido_cantidad CHECK (cantidad > 0)
) ENGINE=InnoDB;

CREATE TABLE pago (
  id_pago BIGINT AUTO_INCREMENT,
  id_pedido BIGINT NOT NULL,
  registrado_por BIGINT NULL,
  monto DECIMAL(12,2) NOT NULL,
  metodo ENUM('PASARELA', 'TRANSFERENCIA', 'EFECTIVO') NOT NULL,
  estado ENUM('PENDIENTE', 'APROBADO', 'RECHAZADO') NOT NULL,
  fecha_pago DATETIME NULL,
  referencia VARCHAR(60) NULL,
  PRIMARY KEY (id_pago),
  UNIQUE KEY uq_pago_id_pedido (id_pedido),
  CONSTRAINT fk_pago_id_pedido FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido) ON DELETE RESTRICT,
  CONSTRAINT fk_pago_registrado_por FOREIGN KEY (registrado_por) REFERENCES usuario(id_usuario) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE factura (
  id_factura BIGINT AUTO_INCREMENT,
  id_pedido BIGINT NOT NULL,
  fecha_emision DATETIME NOT NULL,
  impuestos DECIMAL(12,2) NOT NULL,
  total_a_pagar DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (id_factura),
  UNIQUE KEY uq_factura_id_pedido (id_pedido),
  CONSTRAINT fk_factura_id_pedido FOREIGN KEY (id_pedido) REFERENCES pedido(id_pedido) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE equipo_cliente (
  id_equipo INT AUTO_INCREMENT,
  id_cliente BIGINT NOT NULL,
  tipo_equipo VARCHAR(50) NOT NULL,
  marca VARCHAR(50) NOT NULL,
  numero_serie VARCHAR(50) NOT NULL,
  PRIMARY KEY (id_equipo),
  CONSTRAINT fk_equipo_cliente_id_cliente FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente) ON DELETE RESTRICT,
  UNIQUE KEY uq_equipo_cliente_serie (id_cliente, numero_serie)
) ENGINE=InnoDB;

CREATE TABLE orden_servicio (
  id_orden BIGINT AUTO_INCREMENT,
  id_cliente BIGINT NOT NULL,
  id_equipo INT NOT NULL,
  id_tecnico BIGINT NULL,
  fecha_solicitud DATE NOT NULL,
  fecha_agendada DATE NULL,
  tipo_mantenimiento ENUM('PREVENTIVO', 'CORRECTIVO', 'CALIBRACION') NOT NULL,
  descripcion_falla TEXT NOT NULL,
  estado ENUM('SOLICITADA', 'AGENDADA', 'EN_PROCESO', 'FINALIZADA', 'ENTREGADA', 'CANCELADA') NOT NULL,
  PRIMARY KEY (id_orden),
  CONSTRAINT fk_orden_servicio_id_cliente FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente) ON DELETE RESTRICT,
  CONSTRAINT fk_orden_servicio_id_equipo FOREIGN KEY (id_equipo) REFERENCES equipo_cliente(id_equipo) ON DELETE RESTRICT,
  CONSTRAINT fk_orden_servicio_id_tecnico FOREIGN KEY (id_tecnico) REFERENCES tecnico(id_tecnico) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE informe_tecnico (
  id_informe INT AUTO_INCREMENT,
  id_orden BIGINT NOT NULL,
  diagnostico TEXT NOT NULL,
  repuestos_cambiados TEXT NOT NULL,
  resultado_hermeticidad ENUM('APROBADO', 'NO_APROBADO') NOT NULL,
  fecha_informe DATE NOT NULL,
  PRIMARY KEY (id_informe),
  UNIQUE KEY uq_informe_tecnico_id_orden (id_orden),
  CONSTRAINT fk_informe_tecnico_id_orden FOREIGN KEY (id_orden) REFERENCES orden_servicio(id_orden) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE certificado (
  id_certificado BIGINT AUTO_INCREMENT,
  id_informe INT NOT NULL,
  codigo VARCHAR(30) NOT NULL,
  fecha_emision DATETIME NOT NULL,
  PRIMARY KEY (id_certificado),
  UNIQUE KEY uq_certificado_id_informe (id_informe),
  UNIQUE KEY uq_certificado_codigo (codigo),