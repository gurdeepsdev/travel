import { z } from "zod";

export const uuid = z.string().uuid();

export const phone = z
    .string()
    .min(8)
    .max(20);

export const email = z
    .string()
    .email();

export const otp = z
    .string()
    .length(6);

export default {
    uuid,
    phone,
    email,
    otp
};