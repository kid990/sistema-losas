export interface User {
  id: number;
  nombre: string;
  tipo: "trabajador" | "usuario";
  rol: string;
  codigo?: string;
  email?: string;
}

export interface Losa {
  id_l: number;
  nombre: string;
  descripcion?: string;
  id_d?: number;
  disciplina_nombre?: string;
}

export interface Disciplina {
  id_d: number;
  nombre: string;
  descripcion?: string;
}

export interface Trabajador {
  id_t: number;
  nombre: string;
  email: string;
  rol: string;
  telefono?: string;
  dni?: string;
}

export interface Permiso {
  id_p: number;
  id_usuario: number;
  id_t?: number;
  estado: "Pendiente" | "Aceptado" | "Rechazado";
  fecha_solicitud: string;
  fecha_inicio: string;
  fecha_fin: string;
  motivo: string;
  documento?: string;
  usuario_nombre?: string;
  trabajador_nombre?: string;
}

export interface PermisoDetalle {
  id_pd: number;
  id_p: number;
  id_l: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  losa_nombre?: string;
}

export interface Configuracion {
  id_c: number;
  max_permisos_dia: number;
  hora_inicio: string;
  hora_fin: string;
}

export interface DiaBloqueado {
  id_db: number;
  fecha: string;
  motivo: string;
}

export interface Imagen {
  id_i: number;
  id_l: number;
  url: string;
  losa_nombre?: string;
}

export interface Usuario {
  id_usuario: number;
  codigo: string;
  nombre: string;
  apellido?: string;
  dni?: string;
  email?: string;
  tipo?: string;
}
