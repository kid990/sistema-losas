const axios = require("axios");
const pool = require("../../config/db");
const { AppError } = require("../../shared/middlewares/error.middleware");
const { env } = require("../../config/env");
const { uploadFile, deleteFile, getSignedDownloadUrl } = require("../../utils/storage");
const { enviarCorreo } = require("../../utils/email");

// =========================================
// Verificar día bloqueado
// =========================================
function fechaLocal() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function normalizarFecha(value) {
  if (value instanceof Date) {
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${value.getFullYear()}-${month}-${day}`;
  }
  return String(value || "").slice(0, 10);
}

function minutos(value) {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(String(value));
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

// =========================================
// Verificar permisos de grupo desde API externa
// =========================================
async function verificarPermisoGrupoDesdeApi(conn, id_u, detalles, config) {
  const [userRows] = await conn.query("SELECT codigo FROM users WHERE id_u = ? LIMIT 1", [id_u]);
  if (!userRows[0]) return { permitido: false, mensaje: "Usuario no encontrado", code: "USER_NOT_FOUND", statusCode: 404 };

  try {
    const { data: usuarioRes } = await axios.get(`${env.UNHEVAL_API_URL}/usuario/${userRows[0].codigo}`);
    if (!usuarioRes.success) return { permitido: false, mensaje: "No se pudo verificar al usuario en la API UNHEVAL", code: "ACADEMIC_VALIDATION_UNAVAILABLE", statusCode: 502 };
    if (usuarioRes.data.rol !== "Alumno") return { permitido: true };

    const { año_academico, escuela } = usuarioRes.data;
    if (!año_academico || !escuela) return { permitido: false, mensaje: "Faltan el año académico o la escuela del alumno", code: "ACADEMIC_DATA_MISSING" };

    const { data: vista } = await axios.get(`${env.UNHEVAL_API_URL}/usuarios`);
    const grupo = (vista.data || []).filter(
      (u) => u.rol === "Alumno" && u.año_academico === año_academico && u.escuela === escuela
    );
    if (grupo.length === 0) return { permitido: true };

    const codigosGrupo = grupo.map((u) => u.codigo);
    const maxHoras = parseFloat(config?.max_horas_semana || "3");
    const restriccionHora = config?.restriccion_hoy || "09:00";
    const fechaReserva = detalles.map((item) => item.fecha).sort()[0];
    const inicioSemana = new Date(`${fechaReserva}T12:00:00`);
    const diaSemana = (inicioSemana.getDay() + 6) % 7;
    inicioSemana.setDate(inicioSemana.getDate() - diaSemana);
    const fechaInicioSemana = `${inicioSemana.getFullYear()}-${String(inicioSemana.getMonth() + 1).padStart(2, "0")}-${String(inicioSemana.getDate()).padStart(2, "0")}`;
    const finSemana = new Date(inicioSemana);
    finSemana.setDate(finSemana.getDate() + 7);
    const fechaFinSemana = `${finSemana.getFullYear()}-${String(finSemana.getMonth() + 1).padStart(2, "0")}-${String(finSemana.getDate()).padStart(2, "0")}`;

    const placeholders = codigosGrupo.map(() => "?").join(",");
    const [usersDelGrupo] = await conn.query(`SELECT id_u FROM users WHERE codigo IN (${placeholders})`, codigosGrupo);
    const userIdsGrupo = usersDelGrupo.map((u) => u.id_u);
    if (userIdsGrupo.length === 0) return { permitido: true };
    const lockPlaceholders = userIdsGrupo.map(() => "?").join(",");
    await conn.query(
      `SELECT id_u FROM users WHERE id_u IN (${lockPlaceholders}) ORDER BY id_u FOR UPDATE`,
      userIdsGrupo
    );

    const userPlaceholders = userIdsGrupo.map(() => "?").join(",");

    // Verificar si ya hay permiso HOY del grupo
    const [hoyRows] = await conn.query(
      `SELECT COUNT(*) AS total FROM permisos p
       INNER JOIN detalle_permisos dp ON dp.id_p = p.id_p
       WHERE p.id_u IN (${userPlaceholders})
         AND dp.fecha = ?
         AND p.tipo = 'Normal' AND p.estado = 'Aceptado'`,
      [...userIdsGrupo, fechaReserva]
    );

    if (Number(hoyRows[0].total) > 0) {
      return {
        permitido: false,
        code: "GROUP_DAILY_LIMIT",
        mensaje: `No se puede reservar: el grupo de ${escuela}, año ${año_academico}, ya tiene un permiso normal aceptado para ${fechaReserva}`,
        details: { escuela, año_academico, fecha: fechaReserva, max_permisos_dia: 1 },
      };
    }

    // Sumar horas semanales del grupo
    const [horasRows] = await conn.query(
      `SELECT COALESCE(SUM(dp.duracion), 0) AS total FROM permisos p
       INNER JOIN detalle_permisos dp ON dp.id_p = p.id_p
       WHERE p.id_u IN (${userPlaceholders})
         AND dp.fecha >= ? AND dp.fecha < ?
         AND p.tipo = 'Normal' AND p.estado = 'Aceptado'`,
      [...userIdsGrupo, fechaInicioSemana, fechaFinSemana]
    );

    const totalHoras = Number(horasRows[0].total);
    const horasSolicitadas = detalles.reduce((sum, item) => sum + item.duracion, 0);
    if (totalHoras + horasSolicitadas > maxHoras) {
      return {
        permitido: false,
        code: "GROUP_WEEKLY_LIMIT",
        mensaje: `No se puede reservar: el grupo de ${escuela}, año ${año_academico}, tiene ${totalHoras} de ${maxHoras} horas usadas esta semana y solicita ${horasSolicitadas} más`,
        details: {
          escuela,
          año_academico,
          horas_usadas: totalHoras,
          horas_solicitadas: horasSolicitadas,
          limite_semanal: maxHoras,
          semana_inicio: fechaInicioSemana,
          semana_fin: fechaFinSemana,
        },
      };
    }

    // Verificar si hubo permisos anteriores esta semana
    const [anterioresRows] = await conn.query(
      `SELECT COUNT(DISTINCT p.id_p) AS total FROM permisos p
       INNER JOIN detalle_permisos dp ON dp.id_p = p.id_p
       WHERE p.id_u IN (${userPlaceholders})
         AND dp.fecha >= ? AND dp.fecha < ?
         AND p.tipo = 'Normal' AND p.estado = 'Aceptado'`,
      [...userIdsGrupo, fechaInicioSemana, fechaReserva]
    );

    const yaHuboAntes = Number(anterioresRows[0].total) > 0;
    const horaActual = new Date().toTimeString().slice(0, 5);

    if (yaHuboAntes && horaActual < restriccionHora) {
      return {
        permitido: false,
        code: "GROUP_REQUEST_TIME_RESTRICTION",
        mensaje: `No se puede reservar: el grupo de ${escuela}, año ${año_academico}, ya tuvo permisos esta semana y solo puede volver a solicitar después de las ${restriccionHora}`,
        details: { escuela, año_academico, hora_permitida: restriccionHora, hora_actual: horaActual },
      };
    }

    return { permitido: true };
  } catch (error) {
    console.error("Error al verificar permisos del grupo:", error.message);
    return { permitido: false, mensaje: "No se pudo verificar las restricciones académicas en la API UNHEVAL", code: "ACADEMIC_VALIDATION_UNAVAILABLE", statusCode: 502 };
  }
}

// =========================================
// Verificar conflictos de horario
// =========================================
async function validarReserva(conn, tipo, detalles, { excludePermissionId = null, enforceRequestWindow = true } = {}) {
  if (!Array.isArray(detalles) || detalles.length === 0) {
    throw new AppError("Debe incluir al menos un bloque de reserva", 400);
  }

  await conn.query("INSERT IGNORE INTO configuracion_global (id) VALUES (1)");
  const [configRows] = await conn.query("SELECT * FROM configuracion_global WHERE id = 1 LIMIT 1");
  const config = configRows[0];
  const horaActual = new Date();
  const minutoActual = horaActual.getHours() * 60 + horaActual.getMinutes();
  if (
    enforceRequestWindow &&
    (minutoActual < minutos(config.hora_min_solicitud) || minutoActual > minutos(config.hora_max_solicitud))
  ) {
    throw new AppError(
      `Las solicitudes solo se reciben entre ${config.hora_min_solicitud} y ${config.hora_max_solicitud}`,
      400,
      "REQUEST_WINDOW_CLOSED",
      { hora_inicio: config.hora_min_solicitud, hora_fin: config.hora_max_solicitud }
    );
  }

  const hoy = fechaLocal();
  const normalizados = detalles.map((detalle) => {
    const fecha = normalizarFecha(detalle.fecha);
    const parsedDate = new Date(`${fecha}T12:00:00`);
    const idLosa = Number(detalle.id_l);
    const inicio = minutos(detalle.hora_inicio);
    const fin = minutos(detalle.hora_fin);
    if (
      !Number.isInteger(idLosa) || idLosa <= 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(fecha) ||
      Number.isNaN(parsedDate.getTime()) || normalizarFecha(parsedDate) !== fecha ||
      inicio === null || fin === null || fin <= inicio
    ) {
      throw new AppError("Fecha u horario de reserva inválido", 400, "INVALID_RESERVATION_SLOT");
    }
    if ((fin - inicio) % 60 !== 0) {
      throw new AppError("Los bloques deben tener una duración exacta en horas", 400, "INVALID_BLOCK_DURATION");
    }
    if (tipo === "Normal" && fecha !== hoy) {
      throw new AppError("Los permisos normales solo pueden solicitarse para hoy", 400, "NORMAL_PERMISSION_TODAY_ONLY");
    }
    if (fecha < hoy) throw new AppError("No se pueden reservar fechas pasadas", 400, "PAST_DATE");
    if (inicio < minutos(config.hora_min_apertura) || fin > minutos(config.hora_max_apertura)) {
      throw new AppError(
        `El horario debe estar entre ${config.hora_min_apertura} y ${config.hora_max_apertura}`,
        400,
        "OUTSIDE_OPENING_HOURS",
        { hora_apertura: config.hora_min_apertura, hora_cierre: config.hora_max_apertura }
      );
    }
    return {
      id_l: idLosa,
      fecha,
      hora_inicio: String(detalle.hora_inicio),
      hora_fin: String(detalle.hora_fin),
      duracion: (fin - inicio) / 60,
      _inicio: inicio,
      _fin: fin,
    };
  });

  const fechas = [...new Set(normalizados.map((item) => item.fecha))];
  const placeholders = fechas.map(() => "?").join(",");
  const [blockedRows] = await conn.query(
    `SELECT fecha, motivo FROM dias_bloqueados WHERE fecha IN (${placeholders})`,
    fechas
  );
  if (blockedRows[0]) {
    const fecha = normalizarFecha(blockedRows[0].fecha);
    throw new AppError(
      `No se permiten solicitudes para ${fecha}: ${blockedRows[0].motivo}`,
      400,
      "BLOCKED_DATE",
      { fecha, motivo: blockedRows[0].motivo }
    );
  }

  const ordered = [...normalizados].sort((a, b) =>
    a.id_l - b.id_l || a.fecha.localeCompare(b.fecha) || a._inicio - b._inicio
  );
  for (let i = 1; i < ordered.length; i += 1) {
    const previous = ordered[i - 1];
    const current = ordered[i];
    if (previous.id_l === current.id_l && previous.fecha === current.fecha && current._inicio < previous._fin) {
      throw new AppError(
        "La solicitud contiene bloques horarios que se cruzan entre sí",
        400,
        "OVERLAPPING_REQUEST_BLOCKS",
        {
          primer_bloque: { id_l: previous.id_l, fecha: previous.fecha, hora_inicio: previous.hora_inicio, hora_fin: previous.hora_fin },
          segundo_bloque: { id_l: current.id_l, fecha: current.fecha, hora_inicio: current.hora_inicio, hora_fin: current.hora_fin },
        }
      );
    }
  }

  const conflicts = [];
  const courtIds = [...new Set(normalizados.map((item) => item.id_l))].sort((a, b) => a - b);
  const courts = new Map();
  for (const id_l of courtIds) {
    const [losaRows] = await conn.query(
      `SELECT l.id_l, l.nombre, l.estado, d.estado AS disciplina_estado
       FROM losas l INNER JOIN disciplinas d ON d.id_d = l.id_d
       WHERE l.id_l = ? LIMIT 1 FOR UPDATE`,
      [id_l]
    );
    const losa = losaRows[0];
    if (losa) courts.set(id_l, losa);
  }

  for (const detalle of normalizados) {
    const losa = courts.get(detalle.id_l);
    const publicDetail = {
      id_l: detalle.id_l,
      fecha: detalle.fecha,
      hora_inicio: detalle.hora_inicio,
      hora_fin: detalle.hora_fin,
      duracion: detalle.duracion,
    };
    if (!losa) { conflicts.push({ detalle: publicDetail, error: "Losa no encontrada" }); continue; }
    if (losa.estado !== "Disponible") {
      conflicts.push({ detalle: publicDetail, error: `La losa "${losa.nombre}" no está disponible (estado: ${losa.estado})` });
      continue;
    }
    if (losa.disciplina_estado !== "Activo") {
      conflicts.push({ detalle: publicDetail, error: "La disciplina de la losa está inactiva" });
      continue;
    }

    const excludeSql = excludePermissionId ? " AND p.id_p <> ?" : "";
    const params = [detalle.id_l, detalle.fecha, detalle.hora_fin, detalle.hora_inicio];
    if (excludePermissionId) params.push(excludePermissionId);
    const [existing] = await conn.query(
      `SELECT dp.* FROM detalle_permisos dp
       INNER JOIN permisos p ON dp.id_p = p.id_p
       WHERE dp.id_l = ? AND dp.fecha = ?
         AND p.estado IN ('Pendiente', 'Aceptado')
         AND (dp.hora_inicio < ? AND dp.hora_fin > ?)
         ${excludeSql}
       LIMIT 1`,
      params
    );

    if (existing.length > 0) {
      conflicts.push({
        detalle: publicDetail,
        error: `La losa "${losa.nombre}" ya tiene una reserva entre ${detalle.hora_inicio} y ${detalle.hora_fin} el ${detalle.fecha}`,
        conflictos: existing,
      });
    }
  }
  if (conflicts.length > 0) {
    const error = new AppError(
      "No se puede reservar porque uno o más horarios ya están ocupados o no están disponibles",
      409,
      "SCHEDULE_CONFLICT"
    );
    error.conflicts = conflicts;
    throw error;
  }
  return { detalles: normalizados.map(({ _inicio, _fin, ...item }) => item), config };
}

// =========================================
// Obtener datos de usuario desde API externa
// =========================================
async function obtenerDatosUsuarioPorId(id_u) {
  const [rows] = await pool.query("SELECT codigo FROM users WHERE id_u = ? LIMIT 1", [id_u]);
  if (!rows[0]) return null;
  try {
    const { data: usuarioRes } = await axios.get(`${env.UNHEVAL_API_URL}/usuario/${rows[0].codigo}`);
    if (!usuarioRes.success || !usuarioRes.data) return null;
    return usuarioRes.data;
  } catch { return null; }
}

// =========================================
// Crear notificación
// =========================================
async function crearNotificacionDb({ mensaje, tipo, id_p }) {
  await pool.query("INSERT INTO notificacion (mensaje, tipo, id_p, leido) VALUES (?, ?, ?, FALSE)", [mensaje, tipo, id_p]);
}

// =========================================
// SERVICIOS EXPORTADOS
// =========================================

async function registrarPermiso({ tipo, id_u, duracion_t, detalles, file }) {
  if (!tipo || !id_u || !duracion_t || !detalles || detalles.length === 0) {
    throw new AppError("Faltan datos requeridos", 400);
  }
  if (!["Normal", "Especial"].includes(tipo)) throw new AppError("Tipo de permiso inválido", 400);

  if (tipo === "Especial") {
    if (!file || !file.buffer) throw new AppError("El documento es obligatorio para permisos especiales", 400);
    if (file.size === 0) throw new AppError("El documento PDF está vacío", 400);
    if (file.mimetype !== "application/pdf" || !file.originalname.toLowerCase().endsWith(".pdf")) {
      throw new AppError("Solo se permiten archivos PDF", 400);
    }
    if (file.size > 10 * 1024 * 1024) throw new AppError("El archivo no debe superar 10 MB", 413);
    if (file.buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new AppError("El contenido del archivo no corresponde a un PDF", 400);
    }
  }

  const conn = await pool.getConnection();
  let uploadedKey = null;
  try {
    await conn.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
    await conn.beginTransaction();
    const validated = await validarReserva(conn, tipo, detalles);
    detalles = validated.detalles;
    duracion_t = detalles.reduce((sum, item) => sum + item.duracion, 0);

    if (tipo === "Normal") {
      const restricciones = await verificarPermisoGrupoDesdeApi(conn, id_u, detalles, validated.config);
      if (!restricciones.permitido) {
        throw new AppError(
          restricciones.mensaje || "No se permite registrar el permiso",
          restricciones.statusCode || 400,
          restricciones.code || "RESERVATION_REJECTED",
          restricciones.details
        );
      }
    }

    let idArch = null;
    if (tipo === "Especial") {
      const uploadResult = await uploadFile(file, env.S3_DOCUMENT_KEY_PREFIX);
      uploadedKey = uploadResult.key;
      const [archResult] = await conn.query(
        "INSERT INTO archivos (nombre_original, nombre_unico, mimetype, url, tamanio) VALUES (?, ?, ?, ?, ?)",
        [file.originalname, uploadResult.key, file.mimetype, uploadResult.url, file.size]
      );
      idArch = archResult.insertId;
    }

    const estadoFinal = tipo === "Normal" ? "Aceptado" : "Pendiente";

    const [permisoResult] = await conn.query(
      "INSERT INTO permisos (id_u, tipo, duracion_t, estado, id_arch) VALUES (?, ?, ?, ?, ?)",
      [id_u, tipo, duracion_t, estadoFinal, idArch]
    );
    const id_p = permisoResult.insertId;

    for (const detalle of detalles) {
      await conn.query(
        "INSERT INTO detalle_permisos (id_p, id_l, fecha, hora_inicio, hora_fin, duracion) VALUES (?, ?, ?, ?, ?, ?)",
        [id_p, detalle.id_l, detalle.fecha, detalle.hora_inicio, detalle.hora_fin, detalle.duracion]
      );
    }

    await conn.query("INSERT INTO notificacion (mensaje, tipo, id_p, leido) VALUES (?, ?, ?, FALSE)",
      [`Se creó un nuevo permiso de tipo ${tipo}`, estadoFinal, id_p]);

    await conn.commit();

    // Enviar correo en segundo plano
    if (tipo === "Normal" || tipo === "Especial") {
      obtenerDatosUsuarioPorId(id_u).then(async (usuario) => {
        if (usuario?.email) {
          if (tipo === "Normal") {
            const detallesConLosa = await Promise.all(detalles.map(async (d, i) => {
              const [lRows] = await pool.query("SELECT * FROM losas WHERE id_l = ? LIMIT 1", [d.id_l]);
              const losa = lRows[0];
              return `<tr><td>${i+1}</td><td>${id_p}</td><td>${d.fecha}</td><td>${d.hora_inicio} - ${d.hora_fin}</td><td>${losa?.numero_l || "N/A"}</td><td>${losa?.ubicacion || "N/A"}</td></tr>`;
            }));
            const tabla = `<table border="1" cellpadding="5" cellspacing="0"><thead><tr><th>#</th><th>Id Permiso</th><th>Fecha</th><th>Horario</th><th>N° Losa</th><th>Ubicación</th></tr></thead><tbody>${detallesConLosa.join("")}</tbody></table>`;
            await enviarCorreo({ para: usuario.email, asunto: "Permiso registrado", texto: `Su permiso tipo ${tipo} fue ${estadoFinal}`, html: `<p>Hola <b>${usuario.nombre_completo}</b>,</p><p>Tu permiso de tipo <b>${tipo}</b> fue registrado exitosamente.</p>${tabla}` }).catch(() => {});
          } else {
            await enviarCorreo({ para: usuario.email, asunto: "Permiso especial registrado", texto: `Hola ${usuario.nombre_completo}, tu permiso especial fue registrado exitosamente.`, html: `<p>Hola <b>${usuario.nombre_completo}</b>,</p><p>Tu permiso de tipo <b>Especial</b> fue registrado exitosamente.</p>` }).catch(() => {});
          }
        }
      }).catch(() => {});
    }

    return { id_p, tipo, estado: estadoFinal, total_detalles: detalles.length };
  } catch (error) {
    await conn.rollback();
    if (uploadedKey) await deleteFile(uploadedKey).catch(() => {});
    throw error;
  } finally {
    conn.release();
  }
}

async function obtenerPermisos(estado) {
  let query = `SELECT p.id_p, p.fecha_creacion, p.tipo, p.duracion_t, p.estado, p.autor,
                      (p.id_arch IS NOT NULL) AS tiene_documento
               FROM permisos p`;
  const params = [];
  if (estado) { query += " WHERE p.estado = ?"; params.push(estado); }
  query += " ORDER BY p.fecha_creacion DESC";
  const [rows] = await pool.query(query, params);
  return rows;
}

async function obtenerDetallesPermisoEspecifico(id_p, id_u) {
  if (!id_p) throw new AppError("Falta id del permiso", 400);
  const ownerFilter = id_u ? " AND p.id_u = ?" : "";
  const params = id_u ? [id_p, id_u] : [id_p];
  const [rows] = await pool.query(
    `SELECT p.id_p, p.tipo, p.estado, p.fecha_creacion, dp.id_l, dp.fecha, dp.hora_inicio, dp.hora_fin, dp.duracion, l.ubicacion, d.nombre AS disciplina
     FROM permisos p INNER JOIN detalle_permisos dp ON p.id_p = dp.id_p
     INNER JOIN losas l ON dp.id_l = l.id_l
     LEFT JOIN disciplinas d ON l.id_d = d.id_d
     WHERE p.id_p = ?${ownerFilter} ORDER BY dp.fecha ASC, dp.hora_inicio ASC`,
    params
  );
  if (rows.length === 0) throw new AppError("Permiso no encontrado", 404);
  return rows;
}

async function getAllPermisosDetalleBloqueados() {
  const [rows] = await pool.query(
    `SELECT dp.id_l, DATE_FORMAT(dp.fecha, '%Y-%m-%d') AS fecha, dp.hora_inicio, dp.hora_fin
     FROM detalle_permisos dp
     INNER JOIN permisos p ON p.id_p = dp.id_p
     WHERE p.estado IN ('Pendiente', 'Aceptado')
       AND dp.fecha >= CURDATE()
     ORDER BY dp.fecha ASC, dp.hora_inicio ASC`
  );
  return rows;
}

async function getAllPermisosDetalleAceptados() {
  const [rows] = await pool.query(
    `SELECT dp.id_l, dp.fecha, dp.hora_inicio, dp.hora_fin, p.estado, l.numero_l, d.nombre,
            p.id_p, p.tipo, (p.id_arch IS NOT NULL) AS tiene_documento
     FROM detalle_permisos dp LEFT JOIN permisos p ON p.id_p = dp.id_p
     LEFT JOIN losas l ON dp.id_l = l.id_l
     LEFT JOIN disciplinas d ON d.id_d = l.id_d
     WHERE p.estado = 'Aceptado'
       AND dp.fecha = CURDATE() AND dp.hora_fin > CURTIME()
     ORDER BY p.id_p DESC, dp.fecha ASC, dp.hora_inicio ASC`
  );
  return rows;
}

async function getAllPermisosAceptados() {
  const [rows] = await pool.query(
    `SELECT DISTINCT p.id_p, p.tipo, p.estado, (p.id_arch IS NOT NULL) AS tiene_documento
     FROM permisos p JOIN detalle_permisos dp ON dp.id_p = p.id_p
     WHERE p.estado = 'Aceptado'
       AND (dp.fecha > CURDATE() OR (dp.fecha = CURDATE() AND dp.hora_fin > CURTIME()))
     ORDER BY p.id_p DESC`
  );
  return rows;
}

async function actualizarEstado(id_p, estado, id_t) {
  if (!estado || !id_t) throw new AppError("Estado o ID del trabajador aprobador faltante", 400);
  if (!["Pendiente", "Aceptado", "Rechazado", "Cancelado"].includes(estado)) {
    throw new AppError("Estado de decisión inválido", 400);
  }

  const conn = await pool.getConnection();
  let permiso;
  try {
    await conn.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
    await conn.beginTransaction();

    const [workerRows] = await conn.query(
      "SELECT id_t FROM trabajadores WHERE id_t = ? AND estado = 'Activo' LIMIT 1",
      [id_t]
    );
    if (!workerRows[0]) throw new AppError("Administrador aprobador no encontrado o inactivo", 403);

    const [permissionRows] = await conn.query(
      "SELECT * FROM permisos WHERE id_p = ? LIMIT 1 FOR UPDATE",
      [id_p]
    );
    permiso = permissionRows[0];
    if (!permiso) throw new AppError("Permiso no encontrado", 404);

    const transiciones = {
      Pendiente: ["Aceptado", "Rechazado", "Cancelado"],
      Aceptado: ["Cancelado"],
      Rechazado: ["Pendiente"],
      Cancelado: ["Pendiente"],
    };
    if (permiso.estado === estado) {
      throw new AppError(`El permiso ya se encuentra ${estado.toLowerCase()}`, 400);
    }
    if (!(transiciones[permiso.estado] || []).includes(estado)) {
      throw new AppError(`No se puede cambiar un permiso ${permiso.estado} a ${estado}`, 400);
    }

    if (estado === "Aceptado" || estado === "Pendiente") {
      const [storedDetails] = await conn.query(
        "SELECT id_l, fecha, hora_inicio, hora_fin, duracion FROM detalle_permisos WHERE id_p = ?",
        [id_p]
      );
      await validarReserva(conn, permiso.tipo, storedDetails, {
        excludePermissionId: id_p,
        enforceRequestWindow: false,
      });
    }

    if (estado === "Pendiente") {
      await conn.query(
        "UPDATE permisos SET estado = ?, id_t_decision = NULL, fecha_decision = NULL WHERE id_p = ?",
        [estado, id_p]
      );
    } else {
      await conn.query(
        "UPDATE permisos SET estado = ?, id_t_decision = ?, fecha_decision = NOW() WHERE id_p = ?",
        [estado, id_t, id_p]
      );
    }
    await conn.query("INSERT INTO notificacion (mensaje, tipo, id_p, leido) VALUES (?, ?, ?, FALSE)",
      [`El estado de tu permiso ha cambiado a: ${estado}`, estado, id_p]);

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  const detalles = await obtenerDetallesPermisoEspecifico(id_p);
  let destinatario = "", nombreCompleto = "";
  if (permiso.autor === "Administrador" && permiso.id_t) {
    const [tRows] = await pool.query(
      "SELECT email, nombres, apellido_p FROM trabajadores WHERE id_t = ? LIMIT 1",
      [permiso.id_t]
    );
    if (tRows[0]) {
      destinatario = tRows[0].email;
      nombreCompleto = `${tRows[0].nombres} ${tRows[0].apellido_p}`;
    }
  } else if (permiso.id_u) {
    const usuario = await obtenerDatosUsuarioPorId(permiso.id_u);
    if (usuario) { destinatario = usuario.email; nombreCompleto = usuario.nombre_completo; }
  }
  if (destinatario) {
    const filas = detalles.map((d, i) => `<tr><td>${i+1}</td><td>${d.id_p}</td><td>${d.fecha}</td><td>${d.hora_inicio} - ${d.hora_fin}</td><td>${d.ubicacion}</td><td>${d.disciplina || "N/A"}</td><td>${d.estado || "N/A"}</td></tr>`).join("");
    const tablaHtml = `<table border="1" cellpadding="5" cellspacing="0"><tbody>${filas}</tbody></table>`;
    enviarCorreo({ para: destinatario, asunto: "Estado de permiso actualizado", texto: `Tu permiso ${permiso.tipo} fue actualizado a: ${estado}.`, html: `<p>Estimado/a <b>${nombreCompleto}</b>, tu permiso fue actualizado a <b>${estado}</b>.</p>${tablaHtml}` }).catch(() => {});
  }
  return { success: true, message: "Permiso actualizado correctamente" };
}

async function obtenerDocumento(id, id_u) {
  if (!id || isNaN(id)) throw new AppError("ID de permiso inválido", 400);
  const ownerFilter = id_u ? " AND p.id_u = ?" : "";
  const params = id_u ? [id, id_u] : [id];
  const [rows] = await pool.query(
    `SELECT a.nombre_unico FROM permisos p LEFT JOIN archivos a ON p.id_arch = a.id_arch WHERE p.id_p = ?${ownerFilter} LIMIT 1`,
    params
  );
  if (!rows[0] || !rows[0].nombre_unico) throw new AppError("Permiso o documento no encontrado", 404);
  return getSignedDownloadUrl(rows[0].nombre_unico);
}

async function obtenerPermisosPorUsuario(id_u) {
  if (!id_u) throw new AppError("Falta id de usuario", 400);
  const [rows] = await pool.query(
    "SELECT id_p, tipo, duracion_t, estado, fecha_creacion FROM permisos WHERE id_u = ? ORDER BY fecha_creacion DESC",
    [id_u]
  );
  return rows;
}

async function createPermisoTrabajador({ id_t, tipo, duracion_t, detalles, file, approverId }) {
  if (!Array.isArray(detalles) || !id_t || !tipo || !duracion_t || detalles.length === 0) {
    throw new AppError("Faltan datos requeridos", 400);
  }
  if (!["Normal", "Especial"].includes(tipo)) throw new AppError("Tipo de permiso inválido", 400);
  if (tipo === "Especial") {
    if (!file?.buffer) throw new AppError("El documento es obligatorio para permisos especiales", 400);
    if (
      file.size === 0 ||
      file.mimetype !== "application/pdf" ||
      !file.originalname.toLowerCase().endsWith(".pdf") ||
      file.buffer.subarray(0, 5).toString("ascii") !== "%PDF-"
    ) {
      throw new AppError("Solo se permiten documentos PDF válidos", 400);
    }
  }

  const conn = await pool.getConnection();
  let uploadedKey = null;
  try {
    await conn.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED");
    await conn.beginTransaction();
    const [workers] = await conn.query(
      "SELECT id_t FROM trabajadores WHERE id_t = ? AND estado = 'Activo' LIMIT 1",
      [id_t]
    );
    if (!workers[0]) throw new AppError("Trabajador no encontrado o inactivo", 404);
    const validated = await validarReserva(conn, tipo, detalles);
    detalles = validated.detalles;
    duracion_t = detalles.reduce((sum, item) => sum + item.duracion, 0);

    let idArch = null;
    if (tipo === "Especial") {
      const uploadResult = await uploadFile(file, env.S3_DOCUMENT_KEY_PREFIX);
      uploadedKey = uploadResult.key;
      const [archiveResult] = await conn.query(
        "INSERT INTO archivos (nombre_original, nombre_unico, mimetype, url, tamanio) VALUES (?, ?, ?, ?, ?)",
        [file.originalname, uploadResult.key, file.mimetype, uploadResult.url, file.size]
      );
      idArch = archiveResult.insertId;
    }

    const [result] = await conn.query(
      `INSERT INTO permisos
       (id_t, id_t_decision, tipo, id_arch, duracion_t, estado, autor, fecha_decision)
       VALUES (?, ?, ?, ?, ?, 'Aceptado', 'Administrador', NOW())`,
      [id_t, approverId, tipo, idArch, duracion_t]
    );
    const id_p = result.insertId;

    for (const detalle of detalles) {
      await conn.query(
        "INSERT INTO detalle_permisos (id_p, id_l, fecha, hora_inicio, hora_fin, duracion) VALUES (?, ?, ?, ?, ?, ?)",
        [id_p, detalle.id_l, detalle.fecha, detalle.hora_inicio, detalle.hora_fin, detalle.duracion]
      );
    }

    await conn.query("INSERT INTO notificacion (mensaje, tipo, id_p, leido) VALUES (?, 'Aceptado', ?, FALSE)",
      [`Permiso tipo ${tipo} registrado por trabajador`, id_p]);

    await conn.commit();

    // Enviar correo
    const [tRows] = await pool.query("SELECT * FROM trabajadores WHERE id_t = ? LIMIT 1", [id_t]);
    if (tRows[0]?.email) {
      const detallesPermiso = await obtenerDetallesPermisoEspecifico(id_p);
      const tablaHtml = detallesPermiso.map((d, i) => `<tr><td>${i+1}</td><td>${d.id_p || "N/A"}</td><td>${d.fecha}</td><td>${d.hora_inicio} - ${d.hora_fin}</td><td>${d.ubicacion || "N/A"}</td><td>${d.disciplina || "N/A"}</td><td>${d.estado || "N/A"}</td></tr>`).join("");
      enviarCorreo({ para: tRows[0].email, asunto: "Permiso registrado", texto: `Se ha registrado un permiso de tipo ${tipo}`, html: `<p>Estimado/a <b>${tRows[0].nombres} ${tRows[0].apellido_p}</b>,</p><table border="1" cellpadding="5" cellspacing="0">${tablaHtml}</table>` }).catch(() => {});
    }

    return { id_p, tipo, estado: "Aceptado", duracion_t, detalles };
  } catch (error) {
    await conn.rollback();
    if (uploadedKey) await deleteFile(uploadedKey).catch(() => {});
    throw error;
  } finally {
    conn.release();
  }
}

module.exports = { registrarPermiso, obtenerPermisos, obtenerDetallesPermisoEspecifico, getAllPermisosDetalleBloqueados, getAllPermisosDetalleAceptados, getAllPermisosAceptados, actualizarEstado, obtenerDocumento, obtenerPermisosPorUsuario, createPermisoTrabajador };
