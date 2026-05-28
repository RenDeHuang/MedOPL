export const PORTAL_DATA_UNAVAILABLE_MESSAGE = "Portal 数据暂时不可用，请稍后重试。";
export const OPL_GATEWAY_UNAVAILABLE_MESSAGE = "OPL 网关暂不可用，请稍后重试；如持续失败，请联系管理员。";

export class PortalDisplayError extends Error {
  readonly userMessage: string;

  constructor(userMessage: string) {
    super(userMessage);
    this.name = "PortalDisplayError";
    this.userMessage = userMessage;
  }
}

export function portalDisplayMessage(error: unknown) {
  if (error instanceof PortalDisplayError) return error.userMessage;
  return PORTAL_DATA_UNAVAILABLE_MESSAGE;
}
