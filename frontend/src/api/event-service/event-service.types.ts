export interface ConfirmationResponseRequest {
  accept: boolean;
  reason?: string;
}

export interface ConfirmationResponseResponse {
  success: boolean;
}

/** The sandbox's security analyzer, as `GET /api/conversations/{id}` returns it. */
export interface V1SecurityAnalyzer {
  kind: string;
  grants?: string[];
  [key: string]: unknown;
}

export interface V1ConfirmationPolicy {
  kind: string;
  threshold?: string;
  confirm_unknown?: boolean;
}

export interface V1ConversationInfo {
  id: string;
  execution_status: string;
  security_analyzer: V1SecurityAnalyzer | null;
  confirmation_policy: V1ConfirmationPolicy | null;
  [key: string]: unknown;
}
