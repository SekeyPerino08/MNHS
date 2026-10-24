import jwt, { type SignOptions } from "jsonwebtoken";
import { Role } from "@prisma/client";
import { env } from "../config/env.js";

export interface AuthTokenPayload {
  sub: string;
  role: Role;
  ver: number;
}

export function signToken(payload: AuthTokenPayload): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as NonNullable<SignOptions["expiresIn"]>,
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export function verifyToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET);
  if (
    typeof decoded === "string" ||
    typeof decoded.sub !== "string" ||
    typeof decoded.ver !== "number" ||
    !Number.isInteger(decoded.ver) ||
    !Object.values(Role).includes(decoded.role as Role)
  ) {
    throw new jwt.JsonWebTokenError("Invalid token payload");
  }

  return { sub: decoded.sub, role: decoded.role as Role, ver: decoded.ver };
}
