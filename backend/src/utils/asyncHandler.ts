import type { Request, RequestHandler, Response } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import type { ParsedQs } from "qs";

export function asyncHandler<
  Params extends ParamsDictionary = ParamsDictionary,
  ResponseBody = unknown,
  RequestBody = unknown,
  Query extends ParsedQs = ParsedQs,
  Locals extends Record<string, unknown> = Record<string, unknown>,
>(
  handler: (
    request: Request<Params, ResponseBody, RequestBody, Query, Locals>,
    response: Response<ResponseBody, Locals>,
  ) => Promise<void>,
): RequestHandler<Params, ResponseBody, RequestBody, Query, Locals> {
  return (request, response, next) => {
    void handler(request, response).catch(next);
  };
}
