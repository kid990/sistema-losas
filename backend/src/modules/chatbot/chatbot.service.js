const axios = require("axios");
const { env } = require("../../config/env");

/* ── System Prompt institucional de LosaBot ─────────────────────── */
const SYSTEM_PROMPT = `Eres **LosaBot**, el Asistente Virtual Oficial del **Sistema de Reservas de Losas Deportivas (SIRLOD)** de la **Universidad Nacional Hermilio Valdizán (UNHEVAL)**, ubicada en Huánuco, Perú.

## Tu rol
Orientar a estudiantes y personal sobre reservas, permisos, requisitos, horarios y estado de solicitudes de las losas deportivas.

## Conocimiento de dominio

### Requisitos para reservar
- Carnet universitario vigente O constancia de matrícula regular activa.
- DNI del solicitante.

### Gestión y trámites
- Las reservas se gestionan ante la **Dirección de Bienestar Universitario**, Unidad de Deporte y Cultura.
- Para campeonatos, eventos de facultad o aniversarios, se debe presentar **solicitud formal (FUT)** con un mínimo de **48 horas de anticipación**.

### Disciplinas y horarios
- Losas multideportivas disponibles para **fútsal, básquetbol y vóleibol**.
- Turnos recreativos asignados en **bloques de 60 minutos** por grupo.
- Horario habitual del complejo deportivo: **06:00 a 22:00 horas**, de lunes a domingo (sujeto a días festivos o mantenimiento programado).

### Estado de solicitudes
- Si el usuario pregunta por el estado de un trámite o reserva, indícale amablemente que:
  1. Proporcione su **código de estudiante** o **número de solicitud**.
  2. Consulte la sección **"Mis Solicitudes"** o **"Mis Permisos"** en su panel de usuario del sistema SIRLOD.

### Reglas y prioridades
- **Prohibido** el ingreso de alcohol, tabaco y calzado inapropiado (solo zapatillas deportivas).
- Los **talleres oficiales** y **selecciones PRODAC** tienen prioridad sobre reservas recreativas.

## Reglas estrictas de comportamiento
1. **Solo responde** sobre temas relacionados con: reservas de losas deportivas, permisos, requisitos, horarios, disciplinas deportivas, estado de solicitudes y normativas de la UNHEVAL relacionadas al deporte.
2. Si el usuario pregunta sobre **cualquier tema NO relacionado** (política, tareas académicas, clima, tecnología, otros), responde EXACTAMENTE: "Lo siento, solo puedo orientarte sobre la reserva, requisitos, horarios y estado de permisos de las losas deportivas de la UNHEVAL."
3. Respuestas **breves, profesionales y directas**: máximo 2 a 3 oraciones.
4. Usa un tono **amigable y cordial**, pero profesional.
5. Cuando sea pertinente, sugiere al usuario que visite las secciones relevantes del sistema (Losas, Horarios, Mis Permisos).
6. **Nunca inventes información** sobre horarios específicos de reservas ya hechas; redirige siempre al panel del usuario.
7. Responde siempre en **español**.`;

/* ── Llamada a la API de Gemini ─────────────────────────────────── */

/**
 * Envía un mensaje al modelo Gemini a través de la API de Interactions.
 *
 * @param {string} userMessage - El mensaje del usuario.
 * @param {Array<{role: string, parts: Array<{text: string}>}>} history - Historial de conversación previo.
 * @returns {Promise<string>} La respuesta del bot.
 */
async function chat(userMessage, history = []) {
  const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY no está configurada en las variables de entorno.");
  }

  // Construir el prompt completo integrando el System Prompt, historial y consulta actual
  let inputPrompt = `${SYSTEM_PROMPT}\n\n`;
  if (history && history.length > 0) {
    inputPrompt += "Historial previo de la conversación:\n";
    for (const h of history) {
      const role = h.role === "user" ? "Estudiante" : "LosaBot";
      const text = h.parts?.map((p) => p.text).join(" ") || "";
      if (text) {
        inputPrompt += `${role}: ${text}\n`;
      }
    }
    inputPrompt += "\n";
  }
  inputPrompt += `Consulta del estudiante: ${userMessage}\nRespuesta de LosaBot:`;

  const requestBody = {
    model: "models/gemini-3-flash-preview",
    input: inputPrompt,
    generation_config: {
      temperature: 0.2,
      max_output_tokens: 350,
      thinking_level: "low",
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/interactions?key=${apiKey}`;

  const response = await axios.post(url, requestBody, {
    headers: {
      "Content-Type": "application/json",
    },
    timeout: 25_000,
  });

  const data = response.data;
  if (!data) {
    throw new Error("La API de Gemini no devolvió ningún dato.");
  }

  // 1. Formato Interactions API (data.steps -> model_output -> content -> text)
  if (Array.isArray(data.steps)) {
    const outputStep = data.steps.find(
      (s) => s.type === "model_output" || s.type === "output"
    );
    if (outputStep) {
      if (Array.isArray(outputStep.content)) {
        const textParts = outputStep.content
          .filter((c) => c.text)
          .map((c) => c.text);
        if (textParts.length > 0) return textParts.join("").trim();
      }
      if (typeof outputStep.content === "string") {
        return outputStep.content.trim();
      }
    }
  }

  // 2. Extraer texto según otros formatos posibles o directos
  if (typeof data.output === "string") {
    return data.output.trim();
  }
  if (Array.isArray(data.output)) {
    return data.output
      .map((item) => (typeof item === "string" ? item : item.text || item.content || ""))
      .join("")
      .trim();
  }
  if (data.output && typeof data.output === "object") {
    if (typeof data.output.text === "string") return data.output.text.trim();
    if (Array.isArray(data.output.parts)) {
      return data.output.parts.map((p) => p.text || "").join("").trim();
    }
  }
  if (Array.isArray(data.candidates) && data.candidates.length > 0) {
    const parts = data.candidates[0]?.content?.parts;
    if (Array.isArray(parts)) {
      return parts.map((p) => p.text || "").join("").trim();
    }
  }
  if (typeof data.text === "string") {
    return data.text.trim();
  }
  if (typeof data.response === "string") {
    return data.response.trim();
  }

  return typeof data === "string" ? data : JSON.stringify(data);
}

module.exports = { chat };
