require("dotenv").config();

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

  STORAGE_ENDPOINT: process.env.STORAGE_ENDPOINT || "",
  STORAGE_REGION: process.env.STORAGE_REGION || "us-east-1",
  STORAGE_ACCESS_KEY_ID: process.env.STORAGE_ACCESS_KEY_ID || "",
  STORAGE_SECRET_ACCESS_KEY: process.env.STORAGE_SECRET_ACCESS_KEY || "",
  STORAGE_BUCKET: process.env.STORAGE_BUCKET || "",

  SMTP_HOST: process.env.SMTP_HOST || "",
  SMTP_PORT: parseInt(process.env.SMTP_PORT || "587", 10),
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASSWORD: process.env.SMTP_PASSWORD || "",
  SMTP_FROM: process.env.SMTP_FROM || "noreply@unheval.edu",
  MAIL_LOG_FILE: process.env.MAIL_LOG_FILE || "mail.log",

  RENIEC_API_TOKEN: process.env.RENIEC_API_TOKEN || "",
  RENIEC_API_URL: process.env.RENIEC_API_URL || "",
};

const isProd = env.NODE_ENV === "production";

module.exports = { env, isProd };
