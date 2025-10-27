# SSO + Gemini API Integration Guide

This integration provides SSO authentication with automatic token refresh and seamless Gemini API access in Page Assist.

## 🚀 Quick Setup

### 1. Configure SSO Settings

1. Open Page Assist extension
2. Go to **Settings** → **SSO Gemini**
3. Fill in your SSO credentials:
   - **User ID**: Your enterprise username (e.g., `balakrishnam1`)
   - **Password**: Your enterprise password
   - **OTP Type**: `PUSH` (default)

### 2. Configure Gemini API Settings

Fill in your enterprise API configuration:
- **SSO Login URL**: `https://edsf-sso.edsf-pas.ocp.uat.abc.com/service-login`
- **Gemini API Base URL**: `https://stork.apps.ocp8.uat.abc.com`
- **Project ID**: `dbs-mod-adag-d4q9v`
- **Location**: `asia-southeast1`
- **Model Name**: `gemini-2.5-flash`

### 3. Test Connection

Click **"Test SSO Login & API Connection"** to verify everything works.

## 🔧 Adding SSO Gemini as a Model Provider

### Option 1: Through OpenAI Compatible API Settings

1. Go to **Settings** → **OpenAI Compatible API**
2. Click **"Add Provider"**
3. Select **"SSO Gemini"** from the dropdown
4. Save the configuration

### Option 2: Through Custom Model Addition

1. Go to **Settings** → **Models**
2. Click **"Add Custom Model"**
3. Select your SSO Gemini provider
4. Enter model name: `gemini-2.5-flash`
5. Save

## 🌊 API Features

### Streaming Support
- Real-time response streaming
- Automatic token refresh on 401 errors
- Seamless integration with Page Assist's chat interface

### Token Management
- Automatic SSO token refresh
- 5-minute expiry buffer for reliability
- Persistent credential storage (local to browser)

### Error Handling
- Automatic retry on authentication failures
- Graceful degradation on network issues
- Detailed error logging for debugging

## 🔒 Security Features

- **Local Storage**: Credentials stored locally in browser extension
- **Token Refresh**: Automatic refresh prevents session timeouts
- **Secure Headers**: Proper authentication headers for enterprise APIs
- **Error Protection**: No credential exposure in error messages

## 📝 Usage Examples

### Basic Chat
```typescript
// The CustomGeminiChat model handles all authentication automatically
const model = new CustomGeminiChat({
  modelName: "gemini-2.5-flash",
  temperature: 0.2,
  streaming: true
});

const response = await model.invoke([
  new HumanMessage("Explain quantum computing")
]);
```

### Direct API Usage
```typescript
import { geminiClient } from "@/services/gemini-api";

// Simple generation
const response = await geminiClient.generateContent(
  "Write a recipe for banana bread"
);

// Streaming generation
for await (const chunk of geminiClient.streamGenerateContent("Tell me a story")) {
  console.log(chunk);
}

// Conversation with history
const response = await geminiClient.generateContentWithHistory([
  { role: "user", content: "What is AI?" },
  { role: "model", content: "AI is..." },
  { role: "user", content: "Give me examples" }
]);
```

## 🧪 Testing

### Browser Console Testing
```javascript
// Test full integration
await testSSOGeminiIntegration();

// Test SSO login only
await testSSOLogin();
```

### Manual Testing Steps

1. **SSO Authentication**:
   ```bash
   curl -X POST 'https://edsf-sso.edsf-pas.ocp.uat.abc.com/service-login' \
     -H 'Content-Type: application/json' \
     -d '{"userid":"your_username","password":"your_password","otp":"NONE","otp_type":"PUSH"}'
   ```

2. **API Call with Token**:
   ```bash
   curl -X POST 'https://stork.apps.ocp8.uat.abc.com/v1/projects/dbs-mod-adag-d4q9v/locations/asia-southeast1/publishers/google/models/gemini-2.5-flash:streamGenerateContent' \
     -H 'Authorization: Bearer YOUR_TOKEN' \
     -H 'Content-Type: application/json' \
     -d '{"contents":[{"role":"user","parts":[{"text":"Hello"}]}]}'
   ```

## 🔄 API Response Handling

The integration automatically handles the streaming JSON response format:

```json
[
  {
    "candidates": [
      {
        "content": {
          "role": "model",
          "parts": [{"text": "Response chunk 1"}]
        }
      }
    ]
  },
  {
    "candidates": [
      {
        "content": {
          "role": "model", 
          "parts": [{"text": "Response chunk 2"}]
        }
      }
    ]
  }
]
```

## 🚨 Troubleshooting

### Common Issues

1. **401 Authentication Error**
   - Check username/password
   - Verify SSO URL is correct
   - Test SSO login manually

2. **Token Expired**
   - Automatic refresh should handle this
   - If persistent, clear stored tokens and re-authenticate

3. **API Connection Failed**
   - Verify Gemini API URL and project details
   - Check network connectivity
   - Ensure project has proper permissions

4. **Model Not Available**
   - Verify model name: `gemini-2.5-flash`
   - Check if model is enabled in your project
   - Confirm location parameter is correct

### Debug Mode
Enable debug logging in browser console:
```javascript
localStorage.setItem('pageassist-debug', 'true');
```

## 🔧 Configuration Reference

### SSO Credentials
```typescript
interface SSOCredentials {
  userid: string;        // Your enterprise username
  password: string;      // Your enterprise password
  otp?: string;         // OTP code (default: "NONE")
  otp_type?: string;    // OTP type (default: "PUSH")
}
```

### Gemini API Config
```typescript
interface GeminiAPIConfig {
  ssoUrl: string;        // SSO authentication endpoint
  geminiApiUrl: string;  // Gemini API base URL
  projectId: string;     // GCP project ID
  location: string;      // API location (default: "asia-southeast1")
  model: string;         // Model name (default: "gemini-2.5-flash")
}
```

### Generation Options
```typescript
interface GenerationOptions {
  temperature?: number;      // 0.0 - 1.0 (default: 0.2)
  topP?: number;            // 0.0 - 1.0 (default: 0.8)
  topK?: number;            // 1 - 40 (default: 40)
  maxOutputTokens?: number; // Max response length
  safetySettings?: Array<{
    category: string;
    threshold: string;
  }>;
}
```

## 📚 Integration Points

### LangChain Compatibility
The `CustomGeminiChat` class extends LangChain's `BaseChatModel`, making it compatible with:
- LangChain chains and agents
- Page Assist's existing chat system
- Memory and conversation history
- Tool calling and function execution

### Page Assist Features
Supports all Page Assist features:
- Chat history
- System prompts
- Model switching
- Settings persistence
- Sidebar and web UI modes

## 📈 Performance Considerations

- **Token Caching**: Tokens are cached to avoid unnecessary authentication
- **Stream Processing**: Efficient streaming response handling
- **Error Recovery**: Graceful handling of network and auth errors
- **Memory Management**: Proper cleanup of resources and connections

---

**Need Help?** Check the browser console for detailed error logs or test the integration using the provided test functions.