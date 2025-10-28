import { DEFAULT_SSO_CONFIG } from "@/config/default-sso-config"
import { 
  setSSOCredentials, 
  setGeminiConfig, 
  isSSOConfigured,
  type SSOCredentials,
  type GeminiAPIConfig 
} from "@/services/sso-auth"
import { createModel } from "@/db/dexie/models"
import { OpenAIModelDb } from "@/db/dexie/openai"
import { Storage } from "@plasmohq/storage"

const storage = new Storage()

/**
 * Initialize SSO + Gemini configuration with default values
 * This runs automatically when the extension starts
 */
export const initializeDefaultSSO = async (): Promise<void> => {
  try {
    console.log("🔧 Initializing default SSO configuration...")
    
    // Check if already configured
    const alreadyConfigured = await isSSOConfigured()
    if (alreadyConfigured) {
      console.log("✅ SSO already configured, skipping initialization")
      return
    }

    // Set SSO credentials
    const credentials: SSOCredentials = {
      userid: DEFAULT_SSO_CONFIG.credentials.userid,
      password: DEFAULT_SSO_CONFIG.credentials.password,
      otp_type: DEFAULT_SSO_CONFIG.credentials.otp_type
    }
    await setSSOCredentials(credentials)
    console.log("✅ Default SSO credentials applied")

    // Set Gemini configuration
    const geminiConfig: GeminiAPIConfig = {
      ssoUrl: DEFAULT_SSO_CONFIG.geminiConfig.ssoUrl,
      geminiApiUrl: DEFAULT_SSO_CONFIG.geminiConfig.geminiApiUrl,
      projectId: DEFAULT_SSO_CONFIG.geminiConfig.projectId,
      location: DEFAULT_SSO_CONFIG.geminiConfig.location,
      model: DEFAULT_SSO_CONFIG.geminiConfig.model
    }
    await setGeminiConfig(geminiConfig)
    console.log("✅ Default Gemini configuration applied")

    // Create provider and model
    await createDefaultSSOProvider()
    console.log("✅ Default SSO provider and model created")

    // Set as default selected model
    await setDefaultSelectedModel()
    console.log("✅ Default model auto-selected")

    console.log("🎉 Default SSO configuration initialization complete!")
    
  } catch (error) {
    console.error("❌ Failed to initialize default SSO configuration:", error)
  }
}

/**
 * Create the default SSO Gemini provider and model
 */
const createDefaultSSOProvider = async (): Promise<void> => {
  try {
    // Create provider
    const openaiDb = new OpenAIModelDb()
    const providerId = "sso-gemini-default"
    
    // Check if provider already exists
    const existingProvider = await openaiDb.getById(providerId)
    if (existingProvider) {
      console.log("✅ SSO provider already exists, skipping creation")
      return
    }

    const provider = {
      id: providerId,
      provider: "sso-gemini",
      name: DEFAULT_SSO_CONFIG.modelConfig.providerName,
      baseUrl: DEFAULT_SSO_CONFIG.geminiConfig.geminiApiUrl,
      apiKey: "sso-token",
      db_type: "sso_gemini_provider",
      createdAt: Date.now(),
      config: {
        model: DEFAULT_SSO_CONFIG.geminiConfig.model,
        projectId: DEFAULT_SSO_CONFIG.geminiConfig.projectId,
        location: DEFAULT_SSO_CONFIG.geminiConfig.location,
        ssoUrl: DEFAULT_SSO_CONFIG.geminiConfig.ssoUrl
      }
    }

    await openaiDb.create(provider)
    console.log("✅ Created default SSO provider:", providerId)

    // Create model
    const model = await createModel(
      DEFAULT_SSO_CONFIG.modelConfig.modelId,
      DEFAULT_SSO_CONFIG.modelConfig.modelName,
      providerId,
      DEFAULT_SSO_CONFIG.modelConfig.modelType
    )
    
    console.log("✅ Created default SSO model:", model.id)
    
  } catch (error) {
    console.error("❌ Failed to create default SSO provider/model:", error)
    throw error
  }
}

/**
 * Set the default model as selected
 */
const setDefaultSelectedModel = async (): Promise<void> => {
  try {
    // Store the default model as selected
    await storage.set("selectedModel", DEFAULT_SSO_CONFIG.modelConfig.modelId)
    console.log("✅ Set default selected model:", DEFAULT_SSO_CONFIG.modelConfig.modelId)
  } catch (error) {
    console.error("❌ Failed to set default selected model:", error)
  }
}

/**
 * Check if default SSO is initialized
 */
export const isDefaultSSOInitialized = async (): Promise<boolean> => {
  try {
    const configured = await isSSOConfigured()
    if (!configured) return false

    // Check if our default provider exists
    const openaiDb = new OpenAIModelDb()
    const provider = await openaiDb.getById("sso-gemini-default")
    
    return !!provider
  } catch (error) {
    console.error("❌ Failed to check default SSO initialization:", error)
    return false
  }
}