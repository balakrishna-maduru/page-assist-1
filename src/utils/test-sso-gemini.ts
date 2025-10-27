import { geminiClient } from "../services/gemini-api"
import { 
  setSSOCredentials, 
  setGeminiConfig, 
  performSSOLogin, 
  isSSOConfigured 
} from "../services/sso-auth"

/**
 * Test function to verify SSO + Gemini API integration
 * This can be called from the browser console for testing
 */
export const testSSOGeminiIntegration = async () => {
  console.log("🧪 Testing SSO + Gemini API Integration...")

  try {
    // Step 1: Configure SSO credentials (replace with your actual credentials)
    const testCredentials = {
      userid: "balakrishnam1",
      password: "dklj", // ⚠️ Don't use real passwords in production!
      otp: "NONE",
      otp_type: "PUSH"
    }

    console.log("📝 Setting test SSO credentials...")
    await setSSOCredentials(testCredentials)

    // Step 2: Configure Gemini API settings
    const testConfig = {
      ssoUrl: "https://edsf-sso.edsf-pas.ocp.uat.abc.com/service-login",
      geminiApiUrl: "https://stork.apps.ocp8.uat.abc.com",
      projectId: "dbs-mod-adag-d4q9v",
      location: "asia-southeast1", 
      model: "gemini-2.5-flash"
    }

    console.log("⚙️ Setting test Gemini API configuration...")
    await setGeminiConfig(testConfig)

    // Step 3: Check if configuration is complete
    const configured = await isSSOConfigured()
    console.log(`✅ Configuration status: ${configured ? 'Complete' : 'Incomplete'}`)

    if (!configured) {
      throw new Error("Configuration is incomplete")
    }

    // Step 4: Test SSO login
    console.log("🔐 Testing SSO login...")
    const tokenResponse = await performSSOLogin(testConfig.ssoUrl, testCredentials)
    console.log("✅ SSO login successful!")
    console.log(`📄 Token expires in: ${Math.round(tokenResponse.expires_in / 60)} minutes`)

    // Step 5: Test simple Gemini API call
    console.log("🤖 Testing Gemini API call...")
    const response = await geminiClient.generateContent("Hello! Can you tell me about banana bread?")
    console.log("✅ Gemini API call successful!")
    console.log(`📋 Response preview: ${response.substring(0, 100)}...`)

    // Step 6: Test streaming API call
    console.log("🌊 Testing streaming Gemini API call...")
    let streamingResponse = ""
    for await (const chunk of geminiClient.streamGenerateContent("Write a short poem about coding")) {
      streamingResponse += chunk
      process.stdout.write(chunk) // Show streaming in real-time
    }
    console.log("\n✅ Streaming API call successful!")
    console.log(`📋 Full streaming response: ${streamingResponse}`)

    // Step 7: Test conversation with history
    console.log("💬 Testing conversation with history...")
    const conversationResponse = await geminiClient.generateContentWithHistory([
      { role: "user", content: "What is machine learning?" },
      { role: "model", content: "Machine learning is a subset of artificial intelligence..." },
      { role: "user", content: "Can you give me a simple example?" }
    ])
    console.log("✅ Conversation API call successful!")
    console.log(`📋 Conversation response: ${conversationResponse.substring(0, 150)}...`)

    console.log("\n🎉 All tests passed! SSO + Gemini API integration is working correctly.")
    return {
      success: true,
      message: "All tests passed successfully",
      details: {
        ssoConfigured: configured,
        tokenValid: !!tokenResponse.access_token,
        apiWorking: !!response,
        streamingWorking: !!streamingResponse,
        conversationWorking: !!conversationResponse
      }
    }

  } catch (error) {
    console.error("❌ Test failed:", error)
    return {
      success: false,
      message: error.message,
      error
    }
  }
}

/**
 * Test function for basic SSO authentication only
 */
export const testSSOLogin = async () => {
  console.log("🔐 Testing SSO login only...")

  try {
    const testCredentials = {
      userid: "balakrishnam1", // Replace with your actual username
      password: "dklj", // Replace with your actual password
      otp_type: "PUSH"
    }

    const ssoUrl = "https://edsf-sso.edsf-pas.ocp.uat.abc.com/service-login"

    const tokenResponse = await performSSOLogin(ssoUrl, testCredentials)
    
    console.log("✅ SSO login successful!")
    console.log("📄 Token details:", {
      tokenType: tokenResponse.token_type,
      scope: tokenResponse.scope,
      expiresIn: `${Math.round(tokenResponse.expires_in / 60)} minutes`,
      nonce: tokenResponse.nonce
    })

    return {
      success: true,
      tokenResponse
    }

  } catch (error) {
    console.error("❌ SSO login failed:", error)
    return {
      success: false,
      error: error.message
    }
  }
}

// Make test functions available globally for browser console testing
if (typeof window !== 'undefined') {
  (window as any).testSSOGeminiIntegration = testSSOGeminiIntegration;
  (window as any).testSSOLogin = testSSOLogin;
}