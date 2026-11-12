import { SIGNIN_URL, TOKEN_KEY } from "./config.js";

// Error raised when the session is missing, expired or rejected by the API.
// app.js catches it and sends the user back to the login page.
export class AuthError extends Error {
  constructor(message = "Your session has expired. Please sign in again.") {
    super(message);
    this.name = "AuthError";
  }
}

// Base64 that works for any Unicode text: encode to UTF-8 bytes first,
// then turn each byte into a Latin-1 char so btoa() accepts it.
export function base64Utf8(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

// Decode the JWT payload (base64url, UTF-8). No signature check: the server does that.
export function decodeJwt(token) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Malformed token");
  let b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  b64 += "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(b64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

// User id from the JWT: Hasura claims first, then the standard "sub".
export function getUserId(token) {
  const payload = decodeJwt(token);
  const claims = payload["https://hasura.io/jwt/claims"] || {};
  const id = Number(claims["x-hasura-user-id"] ?? payload.sub);
  if (!Number.isInteger(id)) throw new AuthError("Invalid session token.");
  return id;
}

export function isExpired(token) {
  try {
    const { exp } = decodeJwt(token);
    return typeof exp === "number" && exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export function getToken() {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  if (isExpired(token)) {
    clearSession();
    return null;
  }
  return token;
}

export function clearSession() {
  sessionStorage.removeItem(TOKEN_KEY);
}

// POST to /signin with Basic auth. Resolves with the JWT or throws an Error
// whose message is safe to show to the user.
export async function signIn(identifier, password) {
  const credentials = base64Utf8(`${identifier}:${password}`);

  let res;
  try {
    res = await fetch(SIGNIN_URL, {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}` },
    });
  } catch {
    throw new Error("Can't reach the server. Check your internet connection and try again.");
  }

  if (res.status === 401 || res.status === 403) {
    throw new Error("Invalid username/email or password.");
  }
  if (res.status === 429) {
    throw new Error("Too many sign-in attempts. Please wait a moment and try again.");
  }
  if (res.status >= 500) {
    throw new Error("The platform is having problems right now. Please try again later.");
  }
  if (!res.ok) {
    throw new Error(`Sign-in failed (HTTP ${res.status}).`);
  }

  let token;
  try {
    token = await res.json(); // the endpoint returns the JWT as a JSON string
  } catch {
    throw new Error("Unexpected response from the server.");
  }
  if (typeof token !== "string" || token.split(".").length !== 3) {
    throw new Error("Unexpected response from the server.");
  }

  sessionStorage.setItem(TOKEN_KEY, token);
  return token;
}
