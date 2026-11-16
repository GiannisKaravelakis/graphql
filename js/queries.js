// All GraphQL queries in one place.
// The subject requires three kinds of query; each one is labelled below.

// NORMAL query: no arguments, no nesting.
// The API only returns rows that belong to the signed-in user.
export const USER_QUERY = `
  query User {
    user {
      id
      login
      attrs
      campus
      createdAt
      auditRatio
      totalUp
      totalDown
    }
  }
`;

// Query WITH ARGUMENTS (where / order_by / limit + variables) and NESTED (object { … }).
// $userId comes from the decoded JWT.
export const XP_QUERY = `
  query Xp($userId: Int!, $eventId: Int!) {
    xp: transaction(
      where: {
        userId: { _eq: $userId }
        type: { _eq: "xp" }
        eventId: { _eq: $eventId }
      }
      order_by: { createdAt: asc }
    ) {
      amount
      createdAt
      path
      object {
        name
        type
      }
    }

    level: transaction(
      where: {
        userId: { _eq: $userId }
        type: { _eq: "level" }
        eventId: { _eq: $eventId }
      }
      order_by: { amount: desc }
      limit: 1
    ) {
      amount
    }

    skills: transaction(
      where: { userId: { _eq: $userId }, type: { _like: "skill_%" } }
      order_by: { amount: desc }
    ) {
      type
      amount
    }
  }
`;

// NESTED query with ARGUMENTS: filters progress through the related object's type.
export const PROGRESS_QUERY = `
  query Progress($userId: Int!, $eventId: Int!) {
    progress(
      where: {
        userId: { _eq: $userId }
        object: { type: { _eq: "project" } }
        eventId: { _eq: $eventId }
      }
      order_by: { updatedAt: desc }
    ) {
      grade
      createdAt
      updatedAt
      path
      object {
        name
      }
    }
  }
`;
