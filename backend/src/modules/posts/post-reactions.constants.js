const POST_REACTION_TYPES = Object.freeze({
    LIKE: "LIKE",
    LOVE: "LOVE",
    CELEBRATE: "CELEBRATE",
    INSIGHTFUL: "INSIGHTFUL",
    FUNNY: "FUNNY",
  });
  
  const POST_REACTION_VALUES = Object.freeze(
    Object.values(POST_REACTION_TYPES),
  );
  
  export {
    POST_REACTION_TYPES,
    POST_REACTION_VALUES,
  };