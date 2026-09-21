require("dotenv").config();

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "3000", 10),

  DB_HOST: process.env.DB_HOST || "localhost",
  DB_USER: process.env.DB_USER || "root",
  DB_PASSWORD: process.env.DB_PASSWORD || "",
  DB_NAME: process.env.DB_NAME || "sistema_losa",

  JWT_SECRET: process.env.JWT_SECRET || "default_jwt_secret_key_change_me",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "default_refresh_secret_key_change_me",
  COOKIE_SECRET: process.env.COOKIE_SECRET || "default_cookie_secret_change_me",
  ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL || "15m",
  REFRESH_TOKEN_TTL_DIAS: parseInt(process.env.REFRESH_TOKEN_TTL_DIAS || "7", 10),

  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5173",
  UNHEVAL_API_URL: process.env.UNHEVAL_API_URL || "http://localhost:3001/api",

  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || "",
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || "",
  S3_ENDPOINT: process.env.S3_ENDPOINT || "",
  S3_REGION: process.env.S3_REGION || "us-west-004",
  S3_BUCKET: process.env.S3_BUCKET || "",
  S3_KEY_PREFIX: process.env.S3_KEY_PREFIX || "documentos",
  S3_IMAGE_KEY_PREFIX: process.env.S3_IMAGE_KEY_PREFIX || "imagenes",
  S3_DOCUMENT_KEY_PREFIX: process.env.S3_DOCUMENT_KEY_PREFIX || "documentos",
  S3_FORCE_PATH_STYLE: parseBoolean(process.env.S3_FORCE_PATH_STYLE, false),
  S3_SIGNED_URL_EXPIRES_SECONDS: parseInt(process.env.S3_SIGNED_URL_EXPIRES_SECONDS || "900", 10),

  MAIL_HOST: process.env.MAIL_HOST || "",
  MAIL_PORT: parseInt(process.env.MAIL_PORT || "587", 10),
  MAIL_SECURE: parseBoolean(process.env.MAIL_SECURE, false),
  MAIL_USER: process.env.MAIL_USER || "",
  MAIL_PASSWORD: process.env.MAIL_PASSWORD || "",
  MAIL_FROM: process.env.MAIL_FROM || "noreply@unheval.edu",
  MAIL_LOG_FILE: process.env.MAIL_LOG_FILE || "mail.log",

  RENIEC_API_TOKEN: process.env.RENIEC_API_TOKEN || "",
  RENIEC_API_URL: process.env.RENIEC_API_URL || "",

  // Gemini AI - LosaBot (RF-IA-01)
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || "",
};

const isProd = env.NODE_ENV === "production";

module.exports = { env, isProd };
