// Custom error class for AgentBrain API errors with actionable messages
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public apiMessage: string,
    public details?: unknown
  ) {
    super(`[${statusCode}] ${apiMessage}`);
    this.name = "ApiError";
  }
}

// Map status codes to user-friendly messages with recovery hints
export function formatApiError(err: ApiError): string {
  switch (err.statusCode) {
    case 401:
      return `Authentication failed: ${err.apiMessage}\nAdmin (/cms) endpoints need a bearer token: agentbrain config set token <jwt>\nMCP (/mcp) endpoints need an API key: agentbrain config set apiKey <key>`;
    case 403:
      return `Permission denied: ${err.apiMessage}\nCheck your organization access or API key permissions.`;
    case 404:
      return `Not found: ${err.apiMessage}`;
    case 409:
      return `Conflict: ${err.apiMessage}`;
    case 422:
      return `Validation error: ${err.apiMessage}`;
    case 429:
      return `Rate limited. Please wait and try again.`;
    default:
      if (err.statusCode >= 500) {
        return `Server error (${err.statusCode}): ${err.apiMessage}\nTry again later.`;
      }
      return err.message;
  }
}
