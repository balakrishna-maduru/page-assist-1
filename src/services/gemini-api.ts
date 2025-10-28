import { getValidAccessToken, getGeminiConfig, performSSOLogin, getSSOCredentials } from "./sso-auth"

export interface GeminiContent {
  role: "user" | "model"
  parts: Array<{
    text: string
  }>
}

export interface GeminiSafetySettings {
  category: string
  threshold: string
}

export interface GeminiGenerationConfig {
  temperature?: number
  topP?: number
  topK?: number
  maxOutputTokens?: number
}

export interface GeminiRequest {
  contents: GeminiContent[]
  safety_settings?: GeminiSafetySettings[]
  generation_config?: GeminiGenerationConfig
}

export interface GeminiCandidate {
  content: {
    role: string
    parts: Array<{
      text: string
    }>
  }
  safetyRatings?: Array<{
    category: string
    probability: string
    severity?: string
    probabilityScore?: number
    severityScore?: number
  }>
  finishReason?: string
}

export interface GeminiResponse {
  candidates: GeminiCandidate[]
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    totalTokenCount?: number
    trafficType?: string
    promptTokensDetails?: Array<{
      modality: string
      tokenCount: number
    }>
    candidatesTokensDetails?: Array<{
      modality: string
      tokenCount: number
    }>
    thoughtsTokenCount?: number
  }
  modelVersion?: string
  createTime?: string
  responseId?: string
}

export class GeminiAPIClient {
  private async makeAuthenticatedRequest(url: string, requestBody: GeminiRequest): Promise<Response> {
    let token: string
    
    console.log('🔧 Making authenticated request to:', url)
    
    try {
      token = await getValidAccessToken()
    } catch (error) {
      console.error('Failed to get access token:', error)
      throw new Error('Authentication failed. Please check your SSO credentials.')
    }

    console.log('🔧 Using token:', token ? token.substring(0, 20) + '...' : 'none')

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    })

    console.log('🔧 Response status:', response.status, response.statusText)
    console.log('🔧 Response headers:', Object.fromEntries(response.headers.entries()))

    // Handle 401 - token expired, try to refresh once
    if (response.status === 401) {
      console.log('Token expired, attempting to refresh...')
      
      try {
        const credentials = await getSSOCredentials()
        const config = await getGeminiConfig()
        
        if (!credentials || !config) {
          throw new Error('No stored credentials found')
        }
        
        const tokenResponse = await performSSOLogin(config.ssoUrl, credentials)
        token = tokenResponse.access_token
        
        console.log('🔧 Token refreshed, retrying request')
        
        // Retry request with new token
        const retryResponse = await fetch(url, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        })
        
        console.log('🔧 Retry response status:', retryResponse.status, retryResponse.statusText)
        
        if (!retryResponse.ok) {
          throw new Error(`Gemini API request failed after token refresh: ${retryResponse.status} ${retryResponse.statusText}`)
        }
        
        return retryResponse
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError)
        throw new Error('Authentication failed after token refresh. Please check your credentials.')
      }
    }

    if (!response.ok) {
      // Get response body for better error details
      let errorBody = ''
      try {
        errorBody = await response.text()
        console.log('🔧 Error response body:', errorBody)
      } catch (e) {
        console.log('🔧 Could not read error body')
      }
      
      throw new Error(`Gemini API request failed: ${response.status} ${response.statusText}. Body: ${errorBody}`)
    }

    return response
  }

  /**
   * Generate content using Gemini API with automatic URL format detection
   */
  async generateContent(prompt: string, options?: {
    temperature?: number
    topP?: number
    topK?: number
    maxOutputTokens?: number
    safetySettings?: GeminiSafetySettings[]
  }): Promise<string> {
    const config = await getGeminiConfig()
    
    if (!config) {
      throw new Error('Gemini API not configured. Please set up the configuration.')
    }

    // Define multiple URL formats to try
    const urlFormats = [
      // Format 1: Full Vertex AI path (current)
      `${config.geminiApiUrl}/v1/projects/${config.projectId}/locations/${config.location}/publishers/google/models/${config.model}:generateContent`,
      // Format 2: Simplified path
      `${config.geminiApiUrl}/v1/models/${config.model}:generateContent`,
      // Format 3: Projects without publishers
      `${config.geminiApiUrl}/v1/projects/${config.projectId}/models/${config.model}:generateContent`,
      // Format 4: Enterprise AI path
      `${config.geminiApiUrl}/ai/v1/models/${config.model}:generateContent`,
      // Format 5: Google AI Studio style
      `${config.geminiApiUrl}/v1beta/models/${config.model}:generateContent`,
      // Format 6: Enterprise specific
      `${config.geminiApiUrl}/gemini/v1/models/${config.model}:generateContent`,
    ]
    
    const requestBody: GeminiRequest = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      safety_settings: options?.safetySettings || [
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_LOW_AND_ABOVE"
        }
      ],
      generation_config: {
        temperature: options?.temperature || 0.2,
        topP: options?.topP || 0.8,
        topK: options?.topK || 40,
        maxOutputTokens: options?.maxOutputTokens
      }
    }

    // Try each URL format until one works
    for (let i = 0; i < urlFormats.length; i++) {
      const url = urlFormats[i]
      console.log(`🔧 Trying Gemini API URL Format ${i + 1}: ${url}`)
      
      try {
        const response = await this.makeAuthenticatedRequest(url, requestBody)
        const data: GeminiResponse = await response.json()
        
        if (!data.candidates || data.candidates.length === 0) {
          throw new Error('No response generated from Gemini API')
        }

        console.log(`✅ SUCCESS! Working URL format: ${url}`)
        return data.candidates[0].content.parts[0].text
        
      } catch (error) {
        console.log(`❌ URL Format ${i + 1} failed: ${error.message}`)
        
        // If this is the last format and still failing, throw the error
        if (i === urlFormats.length - 1) {
          throw error
        }
        
        // Continue to next format
        continue
      }
    }

    throw new Error('All Gemini API URL formats failed. Please check your configuration.')
  }

  /**
   * Stream generate content using Gemini API
   */
  async *streamGenerateContent(prompt: string, options?: {
    temperature?: number
    topP?: number
    topK?: number
    maxOutputTokens?: number
    safetySettings?: GeminiSafetySettings[]
  }): AsyncGenerator<string, void, unknown> {
    const config = await getGeminiConfig()
    
    if (!config) {
      throw new Error('Gemini API not configured. Please set up the configuration.')
    }

    const url = `${config.geminiApiUrl}/v1/projects/${config.projectId}/locations/${config.location}/publishers/google/models/${config.model}:streamGenerateContent`
    
    const requestBody: GeminiRequest = {
      contents: [
        {
          role: "user",
          parts: [
            {
              text: prompt
            }
          ]
        }
      ],
      safety_settings: options?.safetySettings || [
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_LOW_AND_ABOVE"
        }
      ],
      generation_config: {
        temperature: options?.temperature || 0.2,
        topP: options?.topP || 0.8,
        topK: options?.topK || 40,
        maxOutputTokens: options?.maxOutputTokens
      }
    }

    const response = await this.makeAuthenticatedRequest(url, requestBody)
    
    if (!response.body) {
      throw new Error('No response body from streaming API')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()

    try {
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          break
        }

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(line => line.trim())
        
        for (const line of lines) {
          try {
            // Parse each JSON object in the response
            const data: GeminiResponse = JSON.parse(line)
            
            if (data.candidates && data.candidates.length > 0) {
              const candidate = data.candidates[0]
              if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                yield candidate.content.parts[0].text
              }
            }
          } catch (parseError) {
            // Skip malformed JSON chunks
            console.warn('Failed to parse streaming chunk:', parseError)
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  /**
   * Generate content with conversation history
   */
  async generateContentWithHistory(
    messages: Array<{ role: "user" | "model"; content: string }>,
    options?: {
      temperature?: number
      topP?: number
      topK?: number
      maxOutputTokens?: number
      safetySettings?: GeminiSafetySettings[]
    }
  ): Promise<string> {
    const config = await getGeminiConfig()
    
    if (!config) {
      throw new Error('Gemini API not configured. Please set up the configuration.')
    }

    const url = `${config.geminiApiUrl}/v1/projects/${config.projectId}/locations/${config.location}/publishers/google/models/${config.model}:generateContent`
    
    const contents: GeminiContent[] = messages.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }]
    }))

    const requestBody: GeminiRequest = {
      contents,
      safety_settings: options?.safetySettings || [
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_LOW_AND_ABOVE"
        }
      ],
      generation_config: {
        temperature: options?.temperature || 0.2,
        topP: options?.topP || 0.8,
        topK: options?.topK || 40,
        maxOutputTokens: options?.maxOutputTokens
      }
    }

    const response = await this.makeAuthenticatedRequest(url, requestBody)
    const data: GeminiResponse = await response.json()
    
    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No response generated from Gemini API')
    }

    return data.candidates[0].content.parts[0].text
  }
}

// Export singleton instance
export const geminiClient = new GeminiAPIClient()