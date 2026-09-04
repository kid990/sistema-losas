const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
const { env } = require("../config/env");

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD,
      },
    });
  } else {
    transporter = nodemailer.createTransport({
      streamTransport: true,
      buffer: true,
    });
  }

  return transporter;
}

async function enviarCorreo({ para, asunto, texto, html }) {
  try {
    const transport = getTransporter();
    const mailOptions = {
      from: env.SMTP_FROM,
      to: para,
      subject: asunto,
      text: texto,
      html: html || texto,
    };

    const info = await transport.sendMail(mailOptions);

    if (transport.transporter?.name === "StreamTransport") {
      const logDir = path.dirname(env.MAIL_LOG_FILE);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      const logLine = `[${new Date().toISOString()}] TO: ${para} | SUBJECT: ${asunto}\n`;
      fs.appendFileSync(env.MAIL_LOG_FILE, logLine);
      console.log(`[EMAIL LOG] ${logLine.trim()}`);
    } else {
      console.log(`[EMAIL] Correo enviado a ${para}: ${info.messageId}`);
    }

    return true;
  } catch (err) {
    console.error(`[EMAIL ERROR] Error enviando correo a ${para}:`, err.message);
    return false;
  }
}

module.exports = { enviarCorreo };
