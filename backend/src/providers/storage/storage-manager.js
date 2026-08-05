import storage from "../../config/storage.js";

import LocalStorageProvider from "./local.provider.js";

const providers =
  new Map([
    [
      "local",
      LocalStorageProvider,
    ],
  ]);

class StorageManager {
  getProvider() {
    const provider =
      providers.get(
        storage.provider,
      );

    if (!provider) {
      throw new Error(
        `Storage provider "${storage.provider}" is not implemented.`,
      );
    }

    return provider;
  }

  get name() {
    return this
      .getProvider()
      .name;
  }

  async store(options) {
    return this
      .getProvider()
      .store(options);
  }

  async remove(options) {
    return this
      .getProvider()
      .remove(options);
  }
}

export default new StorageManager();