import bcrypt from "bcryptjs";
export const hash = (pw) => bcrypt.hash(pw, 12);
export const verify = (pw, hashStr) => bcrypt.compare(pw, hashStr);
