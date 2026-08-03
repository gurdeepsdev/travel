import security from "../../config/security.js";

export const accessCookieOptions = {

    httpOnly: true,

    secure: process.env.NODE_ENV === "production",

    sameSite: "strict",

    maxAge: 15 * 60 * 1000

};

export const refreshCookieOptions = {

    httpOnly: true,

    secure: process.env.NODE_ENV === "production",

    sameSite: "strict",

    maxAge: 30 * 24 * 60 * 60 * 1000

};

export default {

    names: security.cookies,

    accessCookieOptions,

    refreshCookieOptions

};