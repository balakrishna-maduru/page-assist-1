// Default SSO + Gemini configuration
// This file contains hardcoded values that will be automatically applied

export const DEFAULT_SSO_CONFIG = {
  // SSO Credentials
  credentials: {
    userid: "testuser",
    password: "testpass123",
    otp_type: "PUSH"
  },
  
  // Gemini API Configuration
  geminiConfig: {
    ssoUrl: "http://localhost:3001/service-login",
    geminiApiUrl: "http://localhost:3001",
    projectId: "test-project-123",
    location: "asia-southeast1",
    model: "gemini-2.5-flash"
  },
  
  // Model Configuration
  modelConfig: {
    modelId: "gemini-2.5-flash",
    modelName: "gemini-2.5-flash (SSO)",
    providerName: "SSO Gemini API",
    modelType: "chat"
  },
  
  // Auto-apply configuration
  autoApply: true,
  
  // Auto-select model
  autoSelectModel: true
} as const

// Export types for TypeScript
export type DefaultSSOConfigType = typeof DEFAULT_SSO_CONFIG