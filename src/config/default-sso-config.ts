// Default SSO + Gemini configuration
// This file contains default values for development/testing purposes only

export const DEFAULT_SSO_CONFIG = {
  // SSO Credentials - Replace with your actual credentials
  credentials: {
    userid: process.env.SSO_USERNAME || "",
    password: process.env.SSO_PASSWORD || "",
    otp_type: "PUSH"
  },
  
  // Gemini API Configuration - Update with your actual endpoints
  geminiConfig: {
    ssoUrl: process.env.SSO_URL || "http://localhost:3001/service-login",
    geminiApiUrl: process.env.GEMINI_API_URL || "http://localhost:3001",
    projectId: process.env.GEMINI_PROJECT_ID || "",
    location: process.env.GEMINI_LOCATION || "asia-southeast1",
    model: process.env.GEMINI_MODEL || "gemini-1.5-pro"
  },
  
  // Model Configuration
  modelConfig: {
    modelId: process.env.GEMINI_MODEL || "gemini-1.5-pro",
    modelName: `${process.env.GEMINI_MODEL || "gemini-1.5-pro"} (SSO)`,
    providerName: "SSO Gemini API",
    modelType: "chat"
  },
  
  // Auto-apply configuration (only if credentials are provided)
  autoApply: !!(process.env.SSO_USERNAME && process.env.SSO_PASSWORD),
  
  // Auto-select model (only if configuration is complete)
  autoSelectModel: !!(process.env.SSO_USERNAME && process.env.GEMINI_PROJECT_ID)
} as const

// Export types for TypeScript
export type DefaultSSOConfigType = typeof DEFAULT_SSO_CONFIG