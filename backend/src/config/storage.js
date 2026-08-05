import {
  parse,
  resolve,
} from "node:path";

import env from "./env.js";

const uploadPath =
  env.UPLOAD_PATH.trim();

if (!uploadPath) {
  throw new Error(
    "UPLOAD_PATH must not be empty.",
  );
}

const uploadRoot =
  resolve(
    process.cwd(),
    uploadPath,
  );

if (
  uploadRoot ===
  parse(uploadRoot).root
) {
  throw new Error(
    "UPLOAD_PATH must not resolve to a filesystem root.",
  );
}

const storage = Object.freeze({
  provider:
    env.STORAGE_PROVIDER
      .trim()
      .toLowerCase(),

  local: Object.freeze({
    root:
      uploadRoot,

    bucket:
      "local",
  }),
});

export default storage;