class StorageProvider {
  get name() {
    throw new Error(
      "Storage provider name is not implemented.",
    );
  }

  async store({
    temporaryPath,
    userId,
    extension,
  }) {
    void temporaryPath;
    void userId;
    void extension;

    throw new Error(
      "Storage provider store() is not implemented.",
    );
  }

  async remove({
    storageKey,
  }) {
    void storageKey;

    throw new Error(
      "Storage provider remove() is not implemented.",
    );
  }
}

export default StorageProvider;