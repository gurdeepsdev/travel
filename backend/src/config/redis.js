import Redis from "ioredis";
import env from "./env.js";

const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT
});

export default redis;