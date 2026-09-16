import { useState, useRef, useEffect } from "react";
import { FaTimes, FaPaperPlane, FaRobot, FaCommentDots, FaQuestionCircle } from "react-icons/fa";

interface Message {
  id: string;
  sender: "bot" | "user";
  text: string;
  time: string;
}

const PREGUNTAS_FRECUENTES = [
  "¿Cómo puedo reservar una losa?",
  "¿Cuáles son los horarios de atención?",
  "¿Dónde veo el estado de mis permisos?",
  "¿Cómo solicito un permiso especial?",
];

const RESPUESTAS_BOT: Record<string, string> = {
  "¿Cómo puedo reservar una losa?":
    "Para reservar una losa:\n1. Ve a la sección 'Losas' en el menú.\n2. Selecciona la disciplina y la losa disponible.\n3. Haz clic en 'Solicitar permiso' y elige el horario de tu preferencia para el día de hoy.\n4. ¡Listo! Tu permiso se registrará de inmediato.",
  "¿Cuáles son los horarios de atención?":
    "El horario habitual del complejo deportivo es de 06:00 a 22:00 horas de lunes a domingo (sujeto a días festivos o mantenimiento programado). Puedes consultar los bloques libres en la sección 'Horarios'.",
  "¿Dónde veo el estado de mis permisos?":
    "En la sección 'Mis permisos' puedes revisar el historial de tus solicitudes: si están Pendientes, Aprobadas o Rechazadas, además de ver el detalle de cada bloque reservado.",
  "¿Cómo solicito un permiso especial?":
    "En la sección 'Horarios', selecciona la losa y bloques deseados, elige la opción 'Permiso Especial' y adjunta tu solicitud en formato PDF (máximo 10 MB) para que la administración lo evalúe.",
};

export function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "bot",
      text: "¡Hola! 👋 Soy el Asistente Virtual de SIRLOD UNHEVAL. ¿En qué te puedo ayudar hoy con tus reservas de losas?",
      time: new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text) return;

    const userTime = new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
    const userMsg: Message = {
      id: String(Date.now()),
      sender: "user",
      text,
      time: userTime,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputMessage("");

    // Respuesta automática inteligente
    setTimeout(() => {
      let botReply =
        "Gracias por tu consulta. Si requieres atención específica sobre reservas institucionales, también puedes acercarte a la administración deportiva o enviar una solicitud especial.";

      // Buscar coincidencia en respuestas predeterminadas o palabras clave
      const qLower = text.toLowerCase();
      if (RESPUESTAS_BOT[text]) {
        botReply = RESPUESTAS_BOT[text];
      } else if (qLower.includes("reserva") || qLower.includes("solicitar") || qLower.includes("pedir")) {
        botReply = RESPUESTAS_BOT["¿Cómo puedo reservar una losa?"];
      } else if (qLower.includes("hora") || qLower.includes("abierto") || qLower.includes("atención")) {
        botReply = RESPUESTAS_BOT["¿Cuáles son los horarios de atención?"];
      } else if (qLower.includes("estado") || qLower.includes("mis permiso") || qLower.includes("aprobado")) {
        botReply = RESPUESTAS_BOT["¿Dónde veo el estado de mis permisos?"];
      } else if (qLower.includes("especial") || qLower.includes("pdf") || qLower.includes("documento")) {
        botReply = RESPUESTAS_BOT["¿Cómo solicito un permiso especial?"];
      } else if (qLower.includes("hola") || qLower.includes("buenas")) {
        botReply = "¡Hola! ¿Deseas consultar sobre cómo reservar losas, ver horarios o revisar tus permisos?";
      }

      const botMsg: Message = {
        id: String(Date.now() + 1),
        sender: "bot",
        text: botReply,
        time: new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, botMsg]);
    }, 600);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans">
      {/* Botón flotante del Robot */}
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Abrir asistente virtual"
          className="group relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-[#1B6EB6] via-[#165b9a] to-cyan-500 text-white shadow-xl shadow-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/50 hover:scale-110 active:scale-95 transition-all duration-300"
        >
          {/* Imagen de robot o fallback */}
          <div className="w-9 h-9 flex items-center justify-center">
            <FaRobot className="text-2xl text-white group-hover:rotate-12 transition-transform duration-300" />
          </div>
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white"></span>
          </span>
          {/* Tooltip */}
          <span className="absolute right-16 bg-slate-800 text-white text-xs font-semibold px-3 py-1.5 rounded-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-lg">
            Asistente SIRLOD 🤖
          </span>
        </button>
      )}

      {/* Ventana flotante del Chatbot */}
      {isOpen && (
        <div className="flex flex-col w-[360px] sm:w-[390px] h-[520px] bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-300">
          {/* Header del Chat */}
          <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-[#1B6EB6] to-[#144a7e] text-white">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
                <FaRobot className="text-xl text-cyan-200" />
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-[#1B6EB6] rounded-full"></span>
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight">SIRLOD Assistant</h3>
                <p className="text-[11px] text-cyan-200/90 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> En línea • IA
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Cerrar chat"
              className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            >
              <FaTimes size={16} />
            </button>
          </div>

          {/* Cuerpo de mensajes */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.sender === "bot" && (
                  <div className="w-7 h-7 rounded-full bg-[#1B6EB6] text-white flex items-center justify-center shrink-0 text-xs shadow-sm mt-0.5">
                    <FaRobot size={13} />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-sm whitespace-pre-line ${
                    msg.sender === "user"
                      ? "bg-gradient-to-r from-[#1B6EB6] to-[#165b9a] text-white rounded-br-none"
                      : "bg-white text-slate-700 border border-slate-200/80 rounded-bl-none"
                  }`}
                >
                  <p>{msg.text}</p>
                  <span
                    className={`block text-[9px] mt-1 text-right ${
                      msg.sender === "user" ? "text-blue-100" : "text-slate-400"
                    }`}
                  >
                    {msg.time}
                  </span>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Preguntas sugeridas */}
          <div className="px-3.5 py-2 bg-white border-t border-slate-100 flex gap-1.5 overflow-x-auto">
            {PREGUNTAS_FRECUENTES.map((faq, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleSendMessage(faq)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 hover:text-[#1B6EB6] text-slate-600 text-[11px] font-medium whitespace-nowrap transition-colors border border-slate-200/60"
              >
                <FaQuestionCircle size={10} className="text-blue-500" />
                {faq}
              </button>
            ))}
          </div>

          {/* Input de texto */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2 p-3 bg-white border-t border-slate-200"
          >
            <input
              type="text"
              placeholder="Escribe tu consulta aquí..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              className="flex-1 px-3.5 py-2 text-xs bg-slate-100 border border-slate-200 rounded-xl focus:outline-none focus:border-[#1B6EB6] focus:bg-white text-slate-800 transition-colors"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim()}
              aria-label="Enviar mensaje"
              className="p-2.5 rounded-xl bg-gradient-to-r from-[#1B6EB6] to-[#165b9a] text-white hover:opacity-95 disabled:opacity-40 shadow-sm transition-all"
            >
              <FaPaperPlane size={12} />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
