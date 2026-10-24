import { env } from "./env.js";

const elevatedTestLimits = env.NODE_ENV === "test" && process.env.RATE_LIMIT_TESTING !== "true";
const testLimit = 1_000_000;

export const MAX_EXPORT_ROWS = 20_000;
export const GLOBAL_RATE_LIMIT_PER_MINUTE = elevatedTestLimits ? testLimit : env.RATE_LIMIT_PER_MINUTE;
export const LOGIN_RATE_LIMIT = elevatedTestLimits ? testLimit : 10;
export const CHANGE_PASSWORD_RATE_LIMIT = elevatedTestLimits ? testLimit : 10;
export const EXPORT_RATE_LIMIT_PER_HOUR = elevatedTestLimits ? testLimit : 30;
export const IMPORT_PREVIEW_RATE_LIMIT_PER_HOUR = elevatedTestLimits ? testLimit : 10;
