import { GRAPHQL_URL } from "./config.js";
import { AuthError, getToken, clearSession } from "./auth.js";

// Messages / codes Hasura uses when the JWT is missing, invalid or expired.
const AUTH_ERROR_RE = /jwt|token|unauthori[sz]ed|access-denied|invalid-headers/i;

// Run a GraphQL query with the stored JWT as Bearer token.
// Throws AuthError when the session is no longer valid.
export async function gql(query, variables = {}) {
  const token = getToken();
  if (!token) throw new AuthError();

  let res;
  try {
    res = await fetch(GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new Error("Can't reach the server. Check your internet connection.");
  }

  if (res.status === 401 || res.status === 403) {
    clearSession();
    throw new AuthError();
  }
  if (!res.ok) throw new Error(`GraphQL request failed (HTTP ${res.status}).`);

  const body = await res.json();
  if (body.errors?.length) {
    const err = body.errors[0];
    const code = err.extensions?.code || "";
    if (AUTH_ERROR_RE.test(code) || AUTH_ERROR_RE.test(err.message)) {
      clearSession();
      throw new AuthError();
    }
    throw new Error(`GraphQL error: ${err.message}`);
  }
  return body.data;
}
