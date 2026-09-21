import { useState, useRef, useEffect, useCallback } from "react";
import {
  FaTimes,
  FaPaperPlane,
  FaRobot,
  FaQuestionCircle,
  FaRegTrashAlt,
} from "react-icons/fa";

/* ── Tipos ──────────────────────────────────────────────────────── */
interface Message {
  id: string;
  sender: "bot" | "user" | "system";
  text: string;
  time: string;
}

interface GeminiHistoryEntry {
  role: "user" | "model";
  parts: { text: string }[];
}

/* ── Constantes ─────────────────────────────────────────────────── */
const API_URL = "http://localhost:3000/api/chatbot";
const MAX_MESSAGES_PER_SESSION = 40;
const SESSION_KEY = "losabot_session";

const PREGUNTAS_SUGERIDAS = [
  "¿Qué necesito para reservar?",
  "¿Cuáles son los horarios?",
  "¿Cómo veo mis permisos?",
  "¿Qué deportes puedo jugar?",
];

const WELCOME_MESSAGE: Message = {
  id: "welcome",
  sender: "bot",
  text: "¡Hola! 👋 Soy **LosaBot**, tu asistente virtual para las losas deportivas de la UNHEVAL. ¿En qué puedo ayudarte?",
  time: new Date().toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  }),
};

/* ── Helpers ────────────────────────────────────────────────────── */
function now() {
  return new Date().toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Render básico de negritas en texto plano con ** */
function renderBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/* ── Componente principal ───────────────────────────────────────── */
export function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [history, setHistory] = useState<GeminiHistoryEntry[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [hasUnread, setHasUnread] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Scroll automático al final
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isTyping, isOpen]);

  // Focus en el input al abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Restaurar sesión
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.messages?.length > 0) {
          setMessages(parsed.messages);
          setHistory(parsed.history || []);
          setMessageCount(parsed.messageCount || 0);
        }
      }
    } catch {
      // Sesión corrupta, empezar limpio
    }
  }, []);

  // Guardar sesión
  useEffect(() => {
    try {
      sessionStorage.setItem(
        SESSION_KEY,
        JSON.stringify({ messages, history, messageCount })
      );
    } catch {
      // sessionStorage lleno, ignorar
    }
  }, [messages, history, messageCount]);

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setHasUnread(false);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    // Cancelar petición pendiente al cerrar
    abortRef.current?.abort();
  }, []);

  const handleClearChat = useCallback(() => {
    setMessages([WELCOME_MESSAGE]);
    setHistory([]);
    setMessageCount(0);
    sessionStorage.removeItem(SESSION_KEY);
  }, []);

  /* ── Enviar mensaje ───────────────────────────────────────────── */
  const handleSendMessage = useCallback(
    async (textToSend?: string) => {
      const text = (textToSend || inputMessage).trim();
      if (!text || isTyping) return;

      // Verificar límite de mensajes
      if (messageCount >= MAX_MESSAGES_PER_SESSION) {
        const limitMsg: Message = {
          id: uid(),
          sender: "system",
          text: "Has alcanzado el límite de consultas de esta sesión. Recarga la página para continuar.",
          time: now(),
        };
        setMessages((prev) => [...prev, limitMsg]);
        return;
      }

      // Agregar mensaje del usuario
      const userMsg: Message = {
        id: uid(),
        sender: "user",
        text,
        time: now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      if (!textToSend) setInputMessage("");
      setIsTyping(true);
      setMessageCount((c) => c + 1);

      // Preparar petición con historial
      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        const response = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, history }),
          signal: abortController.signal,
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || "Error del servidor");
        }

        const botReply = data.reply || "No se recibió respuesta.";

        const botMsg: Message = {
          id: uid(),
          sender: "bot",
          text: botReply,
          time: now(),
        };

        setMessages((prev) => [...prev, botMsg]);

        // Actualizar historial para mantener contexto
        setHistory((prev) => [
          ...prev,
          { role: "user", parts: [{ text }] },
          { role: "model", parts: [{ text: botReply }] },
        ]);

        // Notificar si está cerrado
        if (!isOpen) {
          setHasUnread(true);
        }
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return; // Petición cancelada, no hacer nada
        }

        const errorText =
          error instanceof Error && error.message
            ? error.message
            : "LosaBot no está disponible en este momento. Intenta de nuevo.";

        const errorMsg: Message = {
          id: uid(),
          sender: "system",
          text: errorText,
          time: now(),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setIsTyping(false);
        abortRef.current = null;
      }
    },
    [inputMessage, isTyping, messageCount, history, isOpen]
  );

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans" id="losabot-widget">
      {/* ─── Botón flotante ─────────────────────────────────────── */}
      {!isOpen && (
        <button
          type="button"
          onClick={handleOpen}
          id="losabot-open-btn"
          aria-label="Abrir LosaBot - Asistente virtual"
          className="group relative flex items-center justify-center w-[60px] h-[60px] rounded-full text-white shadow-xl hover:shadow-2xl hover:scale-110 active:scale-95 transition-all duration-300"
          style={{
            background:
              "linear-gradient(135deg, #1B6EB6 0%, #144a7e 60%, #0e3a66 100%)",
            boxShadow: "0 8px 32px rgba(27, 110, 182, 0.35)",
          }}
        >
          <FaRobot className="text-[26px] group-hover:rotate-12 transition-transform duration-300" />

          {/* Indicador de estado online + unread */}
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                hasUnread ? "bg-amber-400" : "bg-emerald-400"
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-4 w-4 border-2 border-white ${
                hasUnread ? "bg-amber-500" : "bg-emerald-500"
              }`}
            />
          </span>

          {/* Tooltip */}
          <span className="absolute right-[72px] bg-slate-800/95 text-white text-xs font-semibold px-3 py-2 rounded-xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none shadow-lg backdrop-blur-sm">
            LosaBot 🤖
            <span className="absolute top-1/2 -right-1 -translate-y-1/2 w-2 h-2 bg-slate-800/95 rotate-45" />
          </span>
        </button>
      )}

      {/* ─── Ventana del chat ───────────────────────────────────── */}
      {isOpen && (
        <div
          className="flex flex-col w-[370px] sm:w-[400px] h-[540px] rounded-3xl shadow-2xl border overflow-hidden"
          id="losabot-window"
          style={{
            background: "#ffffff",
            borderColor: "rgba(0,0,0,0.08)",
            boxShadow:
              "0 25px 60px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)",
            animation: "chatbotSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* ── Header ─────────────────────────────────────────── */}
          <div
            className="flex items-center justify-between px-5 py-3.5"
            style={{
              background:
                "linear-gradient(135deg, #1B6EB6 0%, #144a7e 60%, #0e3a66 100%)",
            }}
          >
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
                <FaRobot className="text-lg text-cyan-200" />
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#1B6EB6] rounded-full" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">
                  LosaBot - UNHEVAL
                </h3>
                <p className="text-[11px] text-cyan-200/90 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  En línea • Asistente IA
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {/* Botón limpiar chat */}
              <button
                type="button"
                onClick={handleClearChat}
                aria-label="Limpiar conversación"
                title="Limpiar chat"
                className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <FaRegTrashAlt size={13} />
              </button>
              {/* Botón cerrar */}
              <button
                type="button"
                onClick={handleClose}
                aria-label="Cerrar chat"
                className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-colors"
              >
                <FaTimes size={15} />
              </button>
            </div>
          </div>

          {/* ── Mensajes ───────────────────────────────────────── */}
          <div className="flex-1 px-4 py-3 overflow-y-auto space-y-3 bg-slate-50/80">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${
                  msg.sender === "user" ? "justify-end" : "justify-start"
                }`}
                style={{
                  animation: "chatbotFadeIn 0.25s ease-out",
                }}
              >
                {/* Avatar del bot */}
                {msg.sender === "bot" && (
                  <div className="w-7 h-7 rounded-full bg-[#1B6EB6] text-white flex items-center justify-center shrink-0 text-xs shadow-sm mt-0.5">
                    <FaRobot size={12} />
                  </div>
                )}

                {/* Burbuja del mensaje */}
                <div
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm whitespace-pre-line ${
                    msg.sender === "user"
                      ? "text-white rounded-br-sm"
                      : msg.sender === "system"
                        ? "bg-amber-50 text-amber-800 border border-amber-200/80 rounded-bl-sm text-xs italic"
                        : "bg-white text-slate-700 border border-slate-200/80 rounded-bl-sm"
                  }`}
                  style={
                    msg.sender === "user"
                      ? {
                          background:
                            "linear-gradient(135deg, #1B6EB6 0%, #165b9a 100%)",
                        }
                      : undefined
                  }
                >
                  <p>
                    {msg.sender === "bot" ? renderBold(msg.text) : msg.text}
                  </p>
                  <span
                    className={`block text-[9px] mt-1 text-right ${
                      msg.sender === "user"
                        ? "text-blue-100/80"
                        : msg.sender === "system"
                          ? "text-amber-400"
                          : "text-slate-400"
                    }`}
                  >
                    {msg.time}
                  </span>
                </div>
              </div>
            ))}

            {/* Indicador de "escribiendo..." */}
            {isTyping && (
              <div
                className="flex gap-2.5 justify-start"
                style={{ animation: "chatbotFadeIn 0.2s ease-out" }}
              >
                <div className="w-7 h-7 rounded-full bg-[#1B6EB6] text-white flex items-center justify-center shrink-0 text-xs shadow-sm mt-0.5">
                  <FaRobot size={12} />
                </div>
                <div className="bg-white border border-slate-200/80 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-1.5">
                    <div className="flex gap-1">
                      <span
                        className="w-2 h-2 rounded-full bg-[#1B6EB6]/60"
                        style={{
                          animation: "chatbotBounce 1.4s infinite ease-in-out",
                        }}
                      />
                      <span
                        className="w-2 h-2 rounded-full bg-[#1B6EB6]/60"
                        style={{
                          animation:
                            "chatbotBounce 1.4s infinite ease-in-out 0.2s",
                        }}
                      />
                      <span
                        className="w-2 h-2 rounded-full bg-[#1B6EB6]/60"
                        style={{
                          animation:
                            "chatbotBounce 1.4s infinite ease-in-out 0.4s",
                        }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 ml-1">
                      LosaBot está escribiendo…
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Preguntas sugeridas ────────────────────────────── */}
          {messages.length <= 2 && !isTyping && (
            <div className="px-3 py-2 bg-white border-t border-slate-100">
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
                {PREGUNTAS_SUGERIDAS.map((faq, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSendMessage(faq)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-blue-50 hover:text-[#1B6EB6] text-slate-600 text-[11px] font-medium whitespace-nowrap transition-colors border border-slate-200/60 hover:border-blue-200"
                  >
                    <FaQuestionCircle
                      size={10}
                      className="text-[#1B6EB6]/60"
                    />
                    {faq}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Footer: input + counter ────────────────────────── */}
          <div className="bg-white border-t border-slate-200">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2 p-3"
            >
              <input
                ref={inputRef}
                type="text"
                id="losabot-input"
                placeholder={
                  messageCount >= MAX_MESSAGES_PER_SESSION
                    ? "Límite de mensajes alcanzado"
                    : "Escribe tu consulta aquí..."
                }
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={isTyping || messageCount >= MAX_MESSAGES_PER_SESSION}
                maxLength={500}
                className="flex-1 px-3.5 py-2.5 text-[13px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#1B6EB6] focus:ring-2 focus:ring-[#1B6EB6]/10 focus:bg-white text-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={
                  !inputMessage.trim() ||
                  isTyping ||
                  messageCount >= MAX_MESSAGES_PER_SESSION
                }
                aria-label="Enviar mensaje"
                id="losabot-send-btn"
                className="p-2.5 rounded-xl text-white hover:opacity-90 disabled:opacity-30 shadow-sm transition-all active:scale-95"
                style={{
                  background:
                    "linear-gradient(135deg, #1B6EB6 0%, #165b9a 100%)",
                }}
              >
                <FaPaperPlane size={13} />
              </button>
            </form>
            {/* Contador de mensajes */}
            <div className="flex justify-between items-center px-4 pb-2 -mt-1">
              <span className="text-[9px] text-slate-400">
                {messageCount}/{MAX_MESSAGES_PER_SESSION} consultas
              </span>
              <span className="text-[9px] text-slate-400">
                Powered by LosaBot IA
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Keyframes inyectados inline (scoped) ────────────────── */}
      <style>{`
        @keyframes chatbotSlideUp {
          from { opacity: 0; transform: translateY(24px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes chatbotFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes chatbotBounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
