import React, { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Form, Input, Button, message, Card, Typography, Space, Divider, Alert } from "antd"
import { 
  getSSOCredentials, 
  setSSOCredentials, 
  getGeminiConfig, 
  setGeminiConfig,
  performSSOLogin,
  getAccessToken,
  isSSOConfigured,
  type SSOCredentials,
  type GeminiAPIConfig
} from "@/services/sso-auth"
import { getOptimalConfig, QUICK_DEV_CONFIG } from "@/services/dev-config"
import { createModel } from "@/db/dexie/models"
import { OpenAIModelDb } from "@/db/dexie/openai"
import { DEFAULT_SSO_CONFIG } from "@/config/default-sso-config"
import { initializeDefaultSSO } from "@/services/default-sso-init"

const { Title, Text } = Typography

export const SSOGeminiSettings = () => {
  const { t } = useTranslation(["settings"])
  const [ssoForm] = Form.useForm()
  const [geminiForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [testLoading, setTestLoading] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [tokenStatus, setTokenStatus] = useState<string>("")

  useEffect(() => {
    // Auto-initialize with default configuration
    initializeDefaults()
  }, [])

  const initializeDefaults = async () => {
    try {
      // Initialize default SSO configuration
      await initializeDefaultSSO()
      
      // Load settings (which should now be the defaults)
      await loadSettings()
      await checkTokenStatus()
    } catch (error) {
      console.error("Failed to initialize defaults:", error)
    }
  }

  const loadSettings = async () => {
    try {
      const credentials = await getSSOCredentials()
      const config = await getGeminiConfig()
      const isConfigured = await isSSOConfigured()

      if (credentials) {
        ssoForm.setFieldsValue({
          userid: credentials.userid,
          password: credentials.password,
          otp_type: credentials.otp_type || "PUSH"
        })
      } else {
        // Set default values if no credentials exist
        ssoForm.setFieldsValue({
          userid: DEFAULT_SSO_CONFIG.credentials.userid,
          password: DEFAULT_SSO_CONFIG.credentials.password,
          otp_type: DEFAULT_SSO_CONFIG.credentials.otp_type
        })
      }

      if (config) {
        geminiForm.setFieldsValue({
          ssoUrl: config.ssoUrl,
          geminiApiUrl: config.geminiApiUrl,
          projectId: config.projectId,
          location: config.location,
          model: config.model
        })
      } else {
        // Set default values if no config exists
        geminiForm.setFieldsValue({
          ssoUrl: DEFAULT_SSO_CONFIG.geminiConfig.ssoUrl,
          geminiApiUrl: DEFAULT_SSO_CONFIG.geminiConfig.geminiApiUrl,
          projectId: DEFAULT_SSO_CONFIG.geminiConfig.projectId,
          location: DEFAULT_SSO_CONFIG.geminiConfig.location,
          model: DEFAULT_SSO_CONFIG.geminiConfig.model
        })
      }

      setConfigured(isConfigured)
    } catch (error) {
      console.error("Failed to load settings:", error)
    }
  }

  const checkTokenStatus = async () => {
    try {
      const token = await getAccessToken()
      if (token) {
        setTokenStatus("✅ Valid token available")
      } else {
        setTokenStatus("❌ No valid token")
      }
    } catch (error) {
      setTokenStatus("❌ Token check failed")
    }
  }

  const handleSSOSave = async (values: any) => {
    setLoading(true)
    try {
      const credentials: SSOCredentials = {
        userid: values.userid,
        password: values.password,
        otp_type: values.otp_type || "PUSH"
      }

      await setSSOCredentials(credentials)
      message.success("SSO credentials saved successfully")
      
      // Check if fully configured now
      const isConfigured = await isSSOConfigured()
      setConfigured(isConfigured)
    } catch (error) {
      console.error("Failed to save SSO credentials:", error)
      message.error("Failed to save SSO credentials")
    } finally {
      setLoading(false)
    }
  }

  const handleGeminiSave = async (values: any) => {
    setLoading(true)
    try {
      const config: GeminiAPIConfig = {
        ssoUrl: values.ssoUrl,
        geminiApiUrl: values.geminiApiUrl,
        projectId: values.projectId,
        location: values.location || "asia-southeast1",
        model: values.model || "gemini-1.5-pro"
      }

      await setGeminiConfig(config)
      message.success("Gemini API configuration saved successfully")
      
      // Create SSO Gemini provider and model
      try {
        await createSSOGeminiProviderAndModel()
      } catch (error) {
        console.warn("Failed to create provider/model (may already exist):", error.message)
      }
      
      // Check if fully configured now
      const isConfigured = await isSSOConfigured()
      setConfigured(isConfigured)
    } catch (error) {
      console.error("Failed to save Gemini config:", error)
      message.error("Failed to save Gemini API configuration")
    } finally {
      setLoading(false)
    }
  }

  const handleTestConnection = async () => {
    setTestLoading(true)
    try {
      const credentials = await getSSOCredentials()
      const config = await getGeminiConfig()

      if (!credentials || !config) {
        message.error("Please configure both SSO credentials and Gemini API settings first")
        return
      }

      // Test SSO login
      const tokenResponse = await performSSOLogin(config.ssoUrl, credentials)
      message.success(`SSO login successful! Token expires in ${Math.round(tokenResponse.expires_in / 60)} minutes`)
      
      await checkTokenStatus()
    } catch (error) {
      console.error("Connection test failed:", error)
      message.error(`Connection test failed: ${error.message}`)
    } finally {
      setTestLoading(false)
    }
  }

  const createSSOGeminiProviderAndModel = async () => {
    try {
      const config = await getGeminiConfig()
      if (!config) {
        throw new Error("Gemini API configuration not found")
      }

      // Create provider
      const openaiDb = new OpenAIModelDb()
      const providerId = `sso-gemini-${Date.now()}`
      
      const provider = {
        id: providerId,
        provider: "sso-gemini",
        name: "SSO Gemini API",
        baseUrl: config.geminiApiUrl,
        apiKey: "sso-token", // Will be replaced with actual token
        db_type: "sso_gemini_provider",
        createdAt: Date.now(),
        config: {
          model: config.model,
          projectId: config.projectId,
          location: config.location,
          ssoUrl: config.ssoUrl
        }
      }

      await openaiDb.create(provider)
      console.log("✅ Created SSO Gemini provider:", providerId)

      // Create model
      const model = await createModel(
        config.model,
        `${config.model} (SSO)`,
        providerId,
        "chat"
      )
      
      console.log("✅ Created SSO Gemini model:", model.id)
      message.success("SSO Gemini provider and model created successfully!")
      
      return { provider, model }
    } catch (error) {
      console.error("Failed to create SSO Gemini provider/model:", error)
      message.error(`Failed to create provider/model: ${error.message}`)
      throw error
    }
  }

  const useMockServer = async () => {
    try {
      setLoading(true)
      
      // Set mock server SSO credentials
      const mockCredentials: SSOCredentials = {
        userid: QUICK_DEV_CONFIG.mockCredentials!.username,
        password: QUICK_DEV_CONFIG.mockCredentials!.password,
        otp_type: "PUSH"
      }
      
      // Set mock server configuration
      const mockConfig: GeminiAPIConfig = {
        ssoUrl: QUICK_DEV_CONFIG.ssoEndpoint,
        geminiApiUrl: QUICK_DEV_CONFIG.geminiEndpoint,
        projectId: "mock-project",
        location: "us-central1",
        model: "gemini-1.5-pro"
      }
      
      await setSSOCredentials(mockCredentials)
      await setGeminiConfig(mockConfig)
      
      // Update forms
      ssoForm.setFieldsValue({
        userid: mockCredentials.userid,
        password: mockCredentials.password,
        otp_type: mockCredentials.otp_type
      })
      
      geminiForm.setFieldsValue({
        ssoUrl: mockConfig.ssoUrl,
        geminiApiUrl: mockConfig.geminiApiUrl,
        projectId: mockConfig.projectId,
        location: mockConfig.location,
        model: mockConfig.model
      })
      
      message.success("🧪 Mock server configuration applied! Ready for testing.")
      
      // Create SSO Gemini provider and model
      await createSSOGeminiProviderAndModel()
      
      await loadSettings()
    } catch (error) {
      console.error("Failed to apply mock configuration:", error)
      message.error("Failed to apply mock configuration")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Title level={3}>SSO + Gemini API Configuration</Title>
        <Text type="secondary">
          Configure SSO authentication and Gemini API settings for enterprise AI access.
        </Text>
        <div className="mt-2">
          <Text strong>Status: </Text>
          <Text type={configured ? "success" : "warning"}>
            {configured ? "✅ Configured" : "⚠️ Not configured"}
          </Text>
        </div>
        <div className="mt-1">
          <Text strong>Token: </Text>
          <Text>{tokenStatus}</Text>
        </div>
      </div>

      <Alert
        message="🔧 Auto-Configured SSO + Gemini"
        description="All values are automatically configured with hardcoded defaults. Mock server running on localhost:3003. The system will auto-select the Gemini model for you."
        type="success"
        showIcon
        style={{ marginBottom: 16 }}
      />

      <Card title="SSO Credentials" size="small">
        <Form
          form={ssoForm}
          layout="vertical"
          onFinish={handleSSOSave}
          autoComplete="off"
        >
          <Form.Item
            name="userid"
            label="User ID (Auto-configured)"
            rules={[{ required: true, message: "Please enter your user ID" }]}
          >
            <Input placeholder="Enter your SSO user ID" readOnly disabled />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password (Auto-configured)"
            rules={[{ required: true, message: "Please enter your password" }]}
          >
            <Input.Password placeholder="Enter your SSO password" readOnly disabled />
          </Form.Item>

          <Form.Item
            name="otp_type"
            label="OTP Type (Auto-configured)"
            initialValue="PUSH"
          >
            <Input placeholder="OTP type (default: PUSH)" readOnly disabled />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" onClick={handleTestConnection} loading={testLoading}>
                🧪 Test Connection
              </Button>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                All values auto-configured with defaults
              </Text>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card title="Gemini API Configuration" size="small">
        <Form
          form={geminiForm}
          layout="vertical"
          onFinish={handleGeminiSave}
          autoComplete="off"
        >
          <Form.Item
            name="ssoUrl"
            label="SSO Login URL (Auto-configured)"
            rules={[{ required: true, message: "Please enter the SSO URL" }]}
            extra="Auto-configured for mock server"
          >
            <Input placeholder="Enter SSO login endpoint URL" readOnly disabled />
          </Form.Item>

          <Form.Item
            name="geminiApiUrl"
            label="Gemini API Base URL (Auto-configured)"
            rules={[{ required: true, message: "Please enter the Gemini API URL" }]}
            extra="Auto-configured for mock server"
          >
            <Input placeholder="Enter Gemini API base URL" readOnly disabled />
          </Form.Item>

          <Form.Item
            name="projectId"
            label="Project ID (Auto-configured)"
            rules={[{ required: true, message: "Please enter the project ID" }]}
            extra="Auto-configured project ID"
          >
            <Input placeholder="Enter your project ID" readOnly disabled />
          </Form.Item>

          <Form.Item
            name="location"
            label="Location (Auto-configured)"
            initialValue="us-central1"
          >
            <Input placeholder="API location" readOnly disabled />
          </Form.Item>

          <Form.Item
            name="model"
            label="Model Name (Auto-configured)"
            initialValue="gemini-1.5-pro"
          >
            <Input placeholder="Model name" readOnly disabled />
          </Form.Item>

          <Form.Item>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              ✅ All Gemini API values are auto-configured with hardcoded defaults
            </Text>
          </Form.Item>
        </Form>
      </Card>

      <Card title="Test Connection" size="small">
        <div className="space-y-4">
          <Text>
            Test your SSO login and API configuration to ensure everything is working correctly.
          </Text>
          <Button 
            type="default" 
            onClick={handleTestConnection} 
            loading={testLoading}
            disabled={!configured}
          >
            Test SSO Login & API Connection
          </Button>
        </div>
      </Card>

      <Card title="Usage Instructions" size="small">
        <div className="space-y-2">
          <Text strong>Setup Steps:</Text>
          <ol className="ml-4 space-y-1">
            <li>Configure your SSO credentials (username and password)</li>
            <li>Set up the Gemini API configuration with your enterprise endpoints</li>
            <li>Test the connection to ensure authentication works</li>
            <li>The system will automatically handle token refresh on 401 errors</li>
          </ol>
          
          <Divider />
          
          <Text strong>Security Notes:</Text>
          <ul className="ml-4 space-y-1">
            <li>Credentials are stored locally in the browser extension</li>
            <li>Tokens are automatically refreshed when they expire</li>
            <li>All API calls are made with proper SSO authentication</li>
          </ul>
        </div>
      </Card>
    </div>
  )
}