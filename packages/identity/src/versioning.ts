export type VersionEnvelope = {
  schemaVersion: string;
  systemModelVersion: string;
  explanationSchemaVersion: string;
  policyVersion?: number;
  registryVersion?: number;
  auditBundleVersion?: string;
};

export const CURRENT_SCHEMA_VERSION = "phase4/v1";
export const CURRENT_SYSTEM_MODEL_VERSION = "system-model/v2";
export const CURRENT_EXPLANATION_SCHEMA_VERSION = "explanation/v2";
export const CURRENT_AUDIT_BUNDLE_VERSION = "audit-bundle/v2";

export function createVersionEnvelope(input: Partial<VersionEnvelope> = {}): VersionEnvelope {
  return {
    schemaVersion: input.schemaVersion ?? CURRENT_SCHEMA_VERSION,
    systemModelVersion: input.systemModelVersion ?? CURRENT_SYSTEM_MODEL_VERSION,
    explanationSchemaVersion: input.explanationSchemaVersion ?? CURRENT_EXPLANATION_SCHEMA_VERSION,
    policyVersion: input.policyVersion,
    registryVersion: input.registryVersion,
    auditBundleVersion: input.auditBundleVersion,
  };
}

export function withAuditBundleVersion(version: VersionEnvelope, auditBundleVersion = CURRENT_AUDIT_BUNDLE_VERSION): VersionEnvelope {
  return {
    ...version,
    auditBundleVersion,
  };
}
