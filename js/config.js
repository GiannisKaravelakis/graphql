// Central configuration. Change the domain or filters here only.

export const DOMAIN = "platform.zone01.gr";

export const SIGNIN_URL = `https://${DOMAIN}/api/auth/signin`;
export const GRAPHQL_URL = `https://${DOMAIN}/api/graphql-engine/v1/graphql`;

// sessionStorage key for the JWT (survives refresh, cleared when the tab closes).
export const TOKEN_KEY = "zone01_jwt";

// Which transactions count towards the main curriculum (XP, level, projects).
// These are SQL LIKE patterns used as GraphQL variables.
// TODO (numbers pass): verify against the platform dashboard in GraphiQL.
export const MAIN_PATH_LIKE = "/athens/div-01/%";
// Exercises inside the JS piscine live under div-01 but are not module XP.
export const EXCLUDED_PATH_LIKE = "/athens/div-01/piscine-js/%";
