export type ResponseType = "message" | "error" | "approval_required";

export const RESPONSE_TYPES: ResponseType[] = ["message", "error", "approval_required"];

export interface FrameworkResponse {
  type: ResponseType;
  content: string;
  metadata?: Record<string, unknown>;
}

export class ResponseSchemaFactory {
  public static getBaseSchema(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: RESPONSE_TYPES
        },
        content: {
          type: "string"
        },
        metadata: {
          type: "object",
          additionalProperties: true
        }
      },
      required: ["type", "content"]
    };
  }
}
