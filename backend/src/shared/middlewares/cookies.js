const { env, isProd } = require("../../config/env");

const ACCESS_COOKIE_NAME = "accessToken";
const REFRESH_COOKIE_NAME = "refreshToken";

const SHARED_OPTIONS = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "strict" : "lax",
  signed: true,
  path: "/",
};

const ACCESS_COOKIE_OPTIONS = {
  ...SHARED_OPTIONS,
  maxAge: 15 * 60 * 1000,
};

const refreshMaxAge = env.REFRESH_TOKEN_TTL_DIAS * 24 * 60 * 60 * 1000;
const REFRESH_COOKIE_OPTIONS = {
  ...SHARED_OPTIONS,
  maxAge: refreshMaxAge,
};

function setAccessCookie(res, token) {
  res.cookie(ACCESS_COOKIE_NAME, token, ACCESS_COOKIE_OPTIONS);
}

function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE_NAME, token, REFRESH_COOKIE_OPTIONS);
}

function clearAccessCookie(res) {
  res.clearCookie(ACCESS_COOKIE_NAME, ACCESS_COOKIE_OPTIONS);
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, REFRESH_COOKIE_OPTIONS);
  // Elimina también cookies emitidas antes de ampliar el alcance al SSR.
  res.clearCookie(REFRESH_COOKIE_NAME, { ...REFRESH_COOKIE_OPTIONS, path: "/api/auth" });
}

function getAccessCookie(req) {
  return req.signedCookies?.[ACCESS_COOKIE_NAME] || null;
}

function getRefreshCookie(req) {
  return req.signedCookies?.[REFRESH_COOKIE_NAME] || null;
}

module.exports = {
  setAccessCookie,
  setRefreshCookie,
  clearAccessCookie,
  clearRefreshCookie,
  getAccessCookie,
  getRefreshCookie,
};
