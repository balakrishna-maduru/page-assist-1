import React, { useState } from "react"
import { Button, Card, Space, Typography, message, Alert } from "antd"
import { testSSOGeminiIntegration, testSSOLogin } from "@/utils/test-sso-gemini"

const { Title, Text, Paragraph } = Typography

export const SSOGeminiTestComponent = () => {
  const [testing, setTesting] = useState(false)
  const [testResults, setTestResults] = useState<any>(null)

  const runIntegrationTest = async () => {
    setTesting(true)
    setTestResults(null)
    
    try {
      const results = await testSSOGeminiIntegration()
      setTestResults(results)
      
      if (results.success) {
        message.success("Integration test completed successfully!")
      } else {
        message.error(`Integration test failed: ${results.message}`)
      }
    } catch (error) {
      const errorResult = {
        success: false,
        message: error.message,
        error
      }
      setTestResults(errorResult)
      message.error(`Test execution failed: ${error.message}`)
    } finally {
      setTesting(false)
    }
  }

  const runSSOTest = async () => {
    setTesting(true)
    setTestResults(null)
    
    try {
      const results = await testSSOLogin()
      setTestResults(results)
      
      if (results.success) {
        message.success("SSO login test completed successfully!")
      } else {
        message.error(`SSO login test failed: ${results.error}`)
      }
    } catch (error) {
      const errorResult = {
        success: false,
        message: error.message,
        error
      }
      setTestResults(errorResult)
      message.error(`SSO test execution failed: ${error.message}`)
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card title="🧪 SSO + Gemini API Integration Test" size="small">
        <div className="space-y-4">
          <Paragraph>
            Use these test buttons to verify that the SSO authentication and Gemini API integration 
            is working correctly. Make sure you have configured your SSO credentials and Gemini API 
            settings first.
          </Paragraph>

          <Alert
            message="Important Note"
            description="These tests use your actual SSO credentials. Make sure they are configured correctly in the SSO Gemini settings page."
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Button 
              type="primary" 
              loading={testing}
              onClick={runSSOTest}
              size="large"
            >
              🔐 Test SSO Login Only
            </Button>

            <Button 
              type="primary" 
              loading={testing}
              onClick={runIntegrationTest}
              size="large"
              style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
            >
              🚀 Test Full Integration (SSO + Gemini API)
            </Button>
          </Space>

          {testResults && (
            <Card 
              title={testResults.success ? "✅ Test Results" : "❌ Test Results"} 
              size="small"
              style={{ 
                marginTop: 16,
                backgroundColor: testResults.success ? '#f6ffed' : '#fff2f0',
                borderColor: testResults.success ? '#b7eb8f' : '#ffccc7'
              }}
            >
              <div className="space-y-3">
                <div>
                  <Text strong>Status: </Text>
                  <Text type={testResults.success ? "success" : "danger"}>
                    {testResults.success ? "SUCCESS" : "FAILED"}
                  </Text>
                </div>

                <div>
                  <Text strong>Message: </Text>
                  <Text>{testResults.message}</Text>
                </div>

                {testResults.details && (
                  <div>
                    <Text strong>Details:</Text>
                    <ul style={{ marginTop: 8 }}>
                      <li>SSO Configured: {testResults.details.ssoConfigured ? "✅" : "❌"}</li>
                      <li>Token Valid: {testResults.details.tokenValid ? "✅" : "❌"}</li>
                      <li>API Working: {testResults.details.apiWorking ? "✅" : "❌"}</li>
                      <li>Streaming Working: {testResults.details.streamingWorking ? "✅" : "❌"}</li>
                      <li>Conversation Working: {testResults.details.conversationWorking ? "✅" : "❌"}</li>
                    </ul>
                  </div>
                )}

                {testResults.tokenResponse && (
                  <div>
                    <Text strong>Token Info:</Text>
                    <ul style={{ marginTop: 8 }}>
                      <li>Type: {testResults.tokenResponse.token_type}</li>
                      <li>Scope: {testResults.tokenResponse.scope}</li>
                      <li>Expires: {Math.round(testResults.tokenResponse.expires_in / 60)} minutes</li>
                    </ul>
                  </div>
                )}

                {testResults.error && (
                  <div>
                    <Text strong>Error Details:</Text>
                    <pre style={{ 
                      marginTop: 8, 
                      padding: 8, 
                      backgroundColor: '#f5f5f5', 
                      borderRadius: 4,
                      fontSize: 12,
                      overflow: 'auto'
                    }}>
                      {typeof testResults.error === 'string' 
                        ? testResults.error 
                        : JSON.stringify(testResults.error, null, 2)
                      }
                    </pre>
                  </div>
                )}
              </div>
            </Card>
          )}

          <Card title="📚 Usage Instructions" size="small" style={{ marginTop: 16 }}>
            <div className="space-y-2">
              <Text strong>Before testing:</Text>
              <ol style={{ paddingLeft: 20 }}>
                <li>Configure your SSO credentials in Settings → SSO Gemini</li>
                <li>Set up your Gemini API configuration with proper URLs and project details</li>
                <li>Ensure you have network access to both SSO and Gemini API endpoints</li>
              </ol>
              
              <Text strong style={{ marginTop: 16, display: 'block' }}>Test sequence:</Text>
              <ol style={{ paddingLeft: 20 }}>
                <li><strong>SSO Test</strong>: Validates your credentials and gets an access token</li>
                <li><strong>Full Integration Test</strong>: Tests SSO + API calls + streaming + conversation</li>
              </ol>
            </div>
          </Card>
        </div>
      </Card>
    </div>
  )
}