import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  // TIMEZONE: z.string(),

  // OTP_PROVIDER: z.string(),

  // SIMPLEVERIFY_API_KEY: z.string().optional(),
  
  // SIMPLEVERIFY_BASE_URL: z.string().default(
  //     "https://api.simpleverify.io/v1"
  // ),


  NODE_ENV: z.string(),

  APP_NAME: z.string(),

  APP_PORT: z.coerce.number(),

  API_PREFIX: z.string(),

  LOG_LEVEL: z.string(),

  DB_HOST: z.string(),
  DB_PORT: z.coerce.number(),
  DB_NAME: z.string(),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),

  REDIS_HOST: z.string(),
  REDIS_PORT: z.coerce.number(),

  JWT_ACCESS_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),

  JWT_ACCESS_EXPIRES: z.string(),
  JWT_REFRESH_EXPIRES: z.string(),

  STORAGE_PROVIDER: z.string(),

  UPLOAD_PATH: z.string(),

  TIMEZONE: z.string(),

  // OTP_PROVIDER: z.string(),

  // TWILIO_ACCOUNT_SID: z.string().optional(),

    OTP_PROVIDER: z.string(),

  FIXED_TEST_OTP_ENABLED:
    z.enum(["true", "false"])
      .default("false"),

  FIXED_TEST_OTP:
    z.string()
      .regex(
        /^\d{6}$/,
        "FIXED_TEST_OTP must contain exactly six digits.",
      )
      .optional(),

  TWILIO_ACCOUNT_SID: z.string().optional(),

  TWILIO_AUTH_TOKEN: z.string().optional(),
  
  TWILIO_VERIFY_SERVICE_SID: z.string().optional(),

  
});


const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(parsed.error.format());
  process.exit(1);
}

const fixedTestOtpEnabled =
  parsed.data
    .FIXED_TEST_OTP_ENABLED ===
  "true";

if (fixedTestOtpEnabled) {
  const allowedEnvironment =
    parsed.data.NODE_ENV ===
      "development" ||
    parsed.data.NODE_ENV ===
      "test" || parsed.data.NODE_ENV ==="uat";


  const usesFakeProvider =
    parsed.data.OTP_PROVIDER ===
    "fake";

  const fixedOtpIsConfigured =
    typeof parsed.data
      .FIXED_TEST_OTP ===
      "string";

  if (
    !allowedEnvironment ||
    !usesFakeProvider ||
    !fixedOtpIsConfigured
  ) {
    console.error(
      [
        "Unsafe fixed OTP configuration.",
        "FIXED_TEST_OTP_ENABLED=true requires:",
"- NODE_ENV=development, test, or uat",
        "- OTP_PROVIDER=fake",
        "- FIXED_TEST_OTP containing exactly six digits",
      ].join("\n"),
    );

    process.exit(1);
  }
}

export default parsed.data;