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

  OTP_PROVIDER: z.string(),

  TWILIO_ACCOUNT_SID: z.string().optional(),

  TWILIO_AUTH_TOKEN: z.string().optional(),
  
  TWILIO_VERIFY_SERVICE_SID: z.string().optional(),

  
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(parsed.error.format());
  process.exit(1);
}

export default parsed.data;