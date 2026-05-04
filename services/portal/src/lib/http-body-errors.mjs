export class HttpBodyError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.name = "HttpBodyError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export function isHttpBodyError(error) {
  return error instanceof HttpBodyError || (typeof error?.code === "string" && error.code.startsWith("request_body_"));
}
