// Central configuration. Change the domain or event filter here only.

export const DOMAIN = "platform.zone01.gr";

export const SIGNIN_URL = `https://${DOMAIN}/api/auth/signin`;
export const GRAPHQL_URL = `https://${DOMAIN}/api/graphql-engine/v1/graphql`;

// sessionStorage key for the JWT (survives refresh, cleared when the tab closes).
export const TOKEN_KEY = "zone01_jwt";

// Module event (div-01), from /intra/athens/div-01?event=585
export const MODULE_EVENT_ID = 585;
