import {
  AIMessage,
  BaseMessage,
  ChatMessage,
  ChatMessageChunk,
  HumanMessage,
  SystemMessage
} from "@langchain/core/messages"
import { ChatGenerationChunk, ChatResult } from "@langchain/core/outputs"
import {
  BaseChatModel,
  BaseChatModelParams
} from "@langchain/core/language_models/chat_models"
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager"
import { geminiClient, GeminiSafetySettings } from "../services/gemini-api"

export interface CustomGeminiChatInput extends BaseChatModelParams {
  /** Model name to use */
  modelName?: string
  /** Temperature for sampling */
  temperature?: number
  /** Top-p for nucleus sampling */
  topP?: number
  /** Top-k for top-k sampling */
  topK?: number
  /** Maximum number of tokens to generate */
  maxOutputTokens?: number
  /** Safety settings */
  safetySettings?: GeminiSafetySettings[]
  /** Whether to stream responses */
  streaming?: boolean
}

/**
 * Custom Gemini chat model that integrates with Page Assist's SSO authentication
 */
export class CustomGeminiChat extends BaseChatModel<any> {
  static lc_name() {
    return "CustomGeminiChat"
  }

  modelName = "gemini-2.5-flash"
  temperature = 0.2
  topP = 0.8
  topK = 40
  maxOutputTokens?: number
  safetySettings?: GeminiSafetySettings[]
  streaming = false

  constructor(fields?: CustomGeminiChatInput) {
    super(fields ?? {})

    this.modelName = fields?.modelName ?? this.modelName
    this.temperature = fields?.temperature ?? this.temperature
    this.topP = fields?.topP ?? this.topP
    this.topK = fields?.topK ?? this.topK
    this.maxOutputTokens = fields?.maxOutputTokens
    this.safetySettings = fields?.safetySettings
    this.streaming = fields?.streaming ?? this.streaming
  }

  _llmType(): string {
    return "custom-gemini"
  }

  async _generate(
    messages: BaseMessage[],
    options: any,
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    const conversationHistory = this.convertLangChainMessagesToGeminiFormat(messages)
    
    try {
      if (this.streaming) {
        // Handle streaming
        const stream = geminiClient.streamGenerateContent(
          conversationHistory[conversationHistory.length - 1].content,
          {
            temperature: this.temperature,
            topP: this.topP,
            topK: this.topK,
            maxOutputTokens: this.maxOutputTokens,
            safetySettings: this.safetySettings
          }
        )

        let fullContent = ""
        for await (const chunk of stream) {
          fullContent += chunk
          
          if (runManager) {
            await runManager.handleLLMNewToken(chunk)
          }
        }

        const message = new AIMessage(fullContent)
        return {
          generations: [
            {
              text: fullContent,
              message
            }
          ]
        }
      } else {
        // Handle non-streaming
        const content = await geminiClient.generateContentWithHistory(
          conversationHistory,
          {
            temperature: this.temperature,
            topP: this.topP,
            topK: this.topK,
            maxOutputTokens: this.maxOutputTokens,
            safetySettings: this.safetySettings
          }
        )

        const message = new AIMessage(content)
        return {
          generations: [
            {
              text: content,
              message
            }
          ]
        }
      }
    } catch (error) {
      console.error("Gemini API error:", error)
      throw error
    }
  }

  async *_streamResponseChunks(
    messages: BaseMessage[],
    options: any,
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const conversationHistory = this.convertLangChainMessagesToGeminiFormat(messages)
    
    try {
      const stream = geminiClient.streamGenerateContent(
        conversationHistory[conversationHistory.length - 1].content,
        {
          temperature: this.temperature,
          topP: this.topP,
          topK: this.topK,
          maxOutputTokens: this.maxOutputTokens,
          safetySettings: this.safetySettings
        }
      )

      for await (const chunk of stream) {
        const chatGenerationChunk = new ChatGenerationChunk({
          text: chunk,
          message: new ChatMessageChunk({
            content: chunk,
            role: "assistant"
          })
        })

        if (runManager) {
          await runManager.handleLLMNewToken(chunk)
        }

        yield chatGenerationChunk
      }
    } catch (error) {
      console.error("Gemini streaming error:", error)
      throw error
    }
  }

  private convertLangChainMessagesToGeminiFormat(
    messages: BaseMessage[]
  ): Array<{ role: "user" | "model"; content: string }> {
    return messages.map((message) => {
      let role: "user" | "model"
      let content: string

      if (message instanceof HumanMessage) {
        role = "user"
        content = message.content as string
      } else if (message instanceof AIMessage) {
        role = "model"
        content = message.content as string
      } else if (message instanceof SystemMessage) {
        // Gemini doesn't have a system role, so we'll prepend it to the user message
        role = "user"
        content = `System: ${message.content as string}`
      } else if (message instanceof ChatMessage) {
        // Map generic chat messages
        role = message.role === "assistant" ? "model" : "user"
        content = message.content as string
      } else {
        // Default to user for unknown message types
        role = "user"
        content = message.content as string
      }

      return { role, content }
    })
  }

  /** @ignore */
  _combineLLMOutput() {
    return {}
  }
}