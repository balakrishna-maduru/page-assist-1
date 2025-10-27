import React, { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Form, Input, Button, message, Card, Typography, Space, Divider } from "antd"
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
import { SSOGeminiTestComponent } from "./sso-gemini-test"

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
    loadSettings()
    checkTokenStatus()
  }, [])

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
      }

      if (config) {
        geminiForm.setFieldsValue({
          ssoUrl: config.ssoUrl,
          geminiApiUrl: config.geminiApiUrl,
          projectId: config.projectId,
          location: config.location || "asia-southeast1",
          model: config.model || "gemini-2.5-flash"
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
        model: values.model || "gemini-2.5-flash"
      }

      await setGeminiConfig(config)
      message.success("Gemini API configuration saved successfully")
      
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

      <Card title="SSO Credentials" size="small">
        <Form
          form={ssoForm}
          layout="vertical"
          onFinish={handleSSOSave}
          autoComplete="off"
        >
          <Form.Item
            name="userid"
            label="User ID"
            rules={[{ required: true, message: "Please enter your user ID" }]}
          >
            <Input placeholder="Enter your SSO user ID" />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: "Please enter your password" }]}
          >
            <Input.Password placeholder="Enter your SSO password" />
          </Form.Item>

          <Form.Item
            name="otp_type"
            label="OTP Type"
            initialValue="PUSH"
          >
            <Input placeholder="OTP type (default: PUSH)" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              Save SSO Credentials
            </Button>
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
            label="SSO Login URL"
            rules={[{ required: true, message: "Please enter the SSO URL" }]}
            extra="Example: https://edsf-sso.edsf-pas.ocp.uat.abc.com/service-login"
          >
            <Input placeholder="Enter SSO login endpoint URL" />
          </Form.Item>

          <Form.Item
            name="geminiApiUrl"
            label="Gemini API Base URL"
            rules={[{ required: true, message: "Please enter the Gemini API URL" }]}
            extra="Example: https://stork.apps.ocp8.uat.abc.com"
          >
            <Input placeholder="Enter Gemini API base URL" />
          </Form.Item>

          <Form.Item
            name="projectId"
            label="Project ID"
            rules={[{ required: true, message: "Please enter the project ID" }]}
            extra="Example: dbs-mod-adag-d4q9v"
          >
            <Input placeholder="Enter your project ID" />
          </Form.Item>

          <Form.Item
            name="location"
            label="Location"
            initialValue="asia-southeast1"
          >
            <Input placeholder="API location (default: asia-southeast1)" />
          </Form.Item>

          <Form.Item
            name="model"
            label="Model Name"
            initialValue="gemini-2.5-flash"
          >
            <Input placeholder="Model name (default: gemini-2.5-flash)" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              Save Gemini Configuration
            </Button>
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

      <SSOGeminiTestComponent />
    </div>
  )
}