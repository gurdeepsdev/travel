class CitySavesMapper {
  static toResponse({
    cityId,
    state,
  }) {
    const viewerHasSaved =
      state?.is_active === true;

    return {
      cityId,
      viewerHasSaved,
      savedItem: viewerHasSaved
        ? {
            id: state.id,
            savedAt:
              state.created_at,
          }
        : null,
    };
  }
}

export default CitySavesMapper;
