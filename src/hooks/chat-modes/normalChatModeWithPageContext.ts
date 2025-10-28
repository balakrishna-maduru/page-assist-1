import { cleanUrl } from "~/libs/clean-url"
import {
  getOllamaURL,
  systemPromptForNonRagOption,
  promptForRag
} from "~/services/ollama"
import { type ChatHistory, type Message } from "~/store/option"
import { generateID, getPromptById } from "@/db/dexie/helpers"
import { generateHistory } from "@/utils/generate-history"
import { pageAssistModel } from "@/models"
import { humanMessageFormatter } from "@/utils/human-message"
import {
  isReasoningEnded,
  isReasoningStarted,
  mergeReasoningContent
} from "@/libs/reasoning"
import { getModelNicknameByID } from "@/db/dexie/nickname"
import { systemPromptFormatter } from "@/utils/system-message"
import { ChatDocument, ChatDocuments } from "@/models/ChatTypes"
import { getTabContents } from "@/libs/get-tab-contents"
import { getModelInfo, isCustomModel } from "@/db/dexie/models"
import { getOpenAIConfigById } from "@/db/dexie/openai"

// Function to get current active tab
const getCurrentTabDocument = async (): Promise<ChatDocuments> => {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true })
    if (tabs.length === 0) return []
    
    const activeTab = tabs[0]
    if (!activeTab.id || !activeTab.title || !activeTab.url) return []
    
    // Filter out browser internal pages
    const url = activeTab.url.toLowerCase()
    if (url.startsWith('chrome://') ||
        url.startsWith('edge://') ||
        url.startsWith('brave://') ||
        url.startsWith('firefox://') ||
        url.startsWith('chrome-extension://') ||
        url.startsWith('moz-extension://')) {
      return []
    }
    
    const document: ChatDocument = {
      title: activeTab.title,
      url: activeTab.url,
      type: "tab",
      tabId: activeTab.id,
      favIconUrl: activeTab.favIconUrl
    }
    
    return [document]
  } catch (error) {
    console.error("Failed to get current tab:", error)
    return []
  }
}

export const normalChatModeWithPageContext = async (
  message: string,
  image: string,
  isRegenerate: boolean,
  messages: Message[],
  history: ChatHistory,
  signal: AbortSignal,
  {
    selectedModel,
    useOCR,
    selectedSystemPrompt,
    currentChatModelSettings,
    setMessages,
    saveMessageOnSuccess,
    saveMessageOnError,
    setHistory,
    setIsProcessing,
    setStreaming,
    setAbortController,
    historyId,
    setHistoryId,
    uploadedFiles,
    includePageContext = true // New option to enable/disable page context
  }: {
    selectedModel: string
    useOCR: boolean
    selectedSystemPrompt: string
    currentChatModelSettings: any
    setMessages: (messages: Message[] | ((prev: Message[]) => Message[])) => void
    saveMessageOnSuccess: (data: any) => Promise<string | null>
    saveMessageOnError: (data: any) => Promise<string | null>
    setHistory: (history: ChatHistory) => void
    setIsProcessing: (value: boolean) => void
    setStreaming: (value: boolean) => void
    setAbortController: (controller: AbortController | null) => void
    historyId: string | null
    setHistoryId: (id: string) => void
    uploadedFiles?: any[]
    includePageContext?: boolean
  }
) => {
  console.log("Using normalChatModeWithPageContext")
  const url = await getOllamaURL()
  let promptId: string | undefined = selectedSystemPrompt
  let promptContent: string | undefined = undefined

  if (image.length > 0) {
    image = `data:image/jpeg;base64,${image.split(",")[1]}`
  }

  // Debug: Log the selected model
  console.log("🔍 DEBUG: Selected model:", selectedModel)
  console.log("🔍 DEBUG: Is custom model:", isCustomModel(selectedModel))

  // FORCE USE SSO GEMINI: Check if SSO Gemini model exists and use it regardless of selectedModel
  let ollama: any
  let isSSO_Gemini = false
  
  try {
    // Try to find SSO Gemini model directly
    const { OpenAIModelDb } = await import("@/db/dexie/openai")
    const openaiDb = new OpenAIModelDb()
    const ssoProvider = await openaiDb.getById("sso-gemini-default")
    
    if (ssoProvider && ssoProvider.provider === "sso-gemini") {
      console.log("🎯 FOUND SSO Gemini provider, forcing CustomGeminiChat usage")
      isSSO_Gemini = true
      
      // Import and use CustomGeminiChat
      const { CustomGeminiChat } = await import("@/models/CustomGeminiChat")
      ollama = new CustomGeminiChat({
        modelName: "gemini-2.5-flash",
        temperature: 0.2,
        topP: 0.8,
        topK: 40,
        streaming: true
      })
    } else {
      console.log("🔍 DEBUG: No SSO Gemini provider found, checking selected model...")
      
      // Fallback to the original logic
      if (isCustomModel(selectedModel)) {
        const modelInfo = await getModelInfo(selectedModel)
        console.log("🔍 DEBUG: Model info:", modelInfo)
        
        const providerInfo = await getOpenAIConfigById(modelInfo.provider_id)
        console.log("🔍 DEBUG: Provider info:", providerInfo)
        
        if (providerInfo?.provider === "sso-gemini") {
          console.log("🎯 Detected SSO Gemini model, using CustomGeminiChat")
          isSSO_Gemini = true
          
          // Import and use CustomGeminiChat
          const { CustomGeminiChat } = await import("@/models/CustomGeminiChat")
          ollama = new CustomGeminiChat({
            modelName: modelInfo.model_id,
            temperature: 0.2,
            topP: 0.8,
            topK: 40,
            streaming: true
          })
        } else {
          console.log("🔍 DEBUG: Not SSO Gemini, using pageAssistModel with provider:", providerInfo?.provider)
          ollama = await pageAssistModel({
            model: selectedModel!,
            baseUrl: cleanUrl(url)
          })
        }
      } else {
        console.log("🔍 DEBUG: Not a custom model, using pageAssistModel")
        ollama = await pageAssistModel({
          model: selectedModel!,
          baseUrl: cleanUrl(url)
        })
      }
    }
  } catch (error) {
    console.error("🔍 DEBUG: Error checking SSO provider:", error)
    // Fallback to regular model
    ollama = await pageAssistModel({
      model: selectedModel!,
      baseUrl: cleanUrl(url)
    })
  }

  // Get current page content if enabled
  let currentTabDocuments: ChatDocuments = []
  let pageContext = ""
  
  if (includePageContext) {
    currentTabDocuments = await getCurrentTabDocument()
    if (currentTabDocuments.length > 0) {
      try {
        pageContext = await getTabContents(currentTabDocuments)
        console.log("Page context extracted:", pageContext ? "Yes" : "No")
      } catch (error) {
        console.error("Failed to extract page context:", error)
        pageContext = ""
      }
    }
  }

  let newMessage: Message[] = []
  let generateMessageId = generateID()
  const modelInfo = await getModelNicknameByID(selectedModel)

  if (!isRegenerate) {
    newMessage = [
      ...messages,
      {
        isBot: false,
        name: "You",
        message,
        sources: [],
        images: image ? [image] : [],
        modelImage: modelInfo?.model_avatar,
        modelName: modelInfo?.model_name || selectedModel,
        documents: uploadedFiles?.map(f => ({
          type: "file",
          filename: f.filename,
          fileSize: f.size,
          processed: f.processed
        })) || []
      },
      {
        isBot: true,
        name: selectedModel,
        message: "▋",
        sources: [],
        id: generateMessageId,
        modelImage: modelInfo?.model_avatar,
        modelName: modelInfo?.model_name || selectedModel
      }
    ]
  } else {
    newMessage = [
      ...messages,
      {
        isBot: true,
        name: selectedModel,
        message: "▋",
        sources: [],
        id: generateMessageId,
        modelImage: modelInfo?.model_avatar,
        modelName: modelInfo?.model_name || selectedModel
      }
    ]
  }
  setMessages(newMessage)
  let fullText = ""
  let contentToSave = ""
  let timetaken = 0

  try {
    let prompt: string | undefined
    let humanMessage: any

    // If we have page context, use RAG-style prompting
    if (pageContext && pageContext.trim().length > 0) {
      const { ragPrompt: systemPrompt } = await promptForRag()
      prompt = systemPrompt
      
      // Create human message with context included in the system prompt
      humanMessage = await humanMessageFormatter({
        content: [
          {
            text: systemPrompt
              .replace("{context}", pageContext)
              .replace("{question}", message),
            type: "text"
          }
        ],
        model: selectedModel,
        useOCR: useOCR
      })
      
      console.log("Using RAG-style prompting with page context")
    } else {
      // Fall back to normal prompting without context
      prompt = await systemPromptForNonRagOption()
      
      humanMessage = await humanMessageFormatter({
        content: [
          {
            text: message,
            type: "text"
          }
        ],
        model: selectedModel,
        useOCR: useOCR
      })
      
      console.log("Using normal prompting without page context")
    }

    // Handle image if present
    if (image.length > 0) {
      if (pageContext && pageContext.trim().length > 0) {
        // With page context, include both context and image
        const { ragPrompt: systemPrompt } = await promptForRag()
        humanMessage = await humanMessageFormatter({
          content: [
            {
              text: systemPrompt
                .replace("{context}", pageContext)
                .replace("{question}", message),
              type: "text"
            },
            {
              image_url: image,
              type: "image_url"
            }
          ],
          model: selectedModel,
          useOCR: useOCR
        })
      } else {
        // Without page context, just include image
        humanMessage = await humanMessageFormatter({
          content: [
            {
              text: message,
              type: "text"
            },
            {
              image_url: image,
              type: "image_url"
            }
          ],
          model: selectedModel,
          useOCR: useOCR
        })
      }
    }

    const applicationChatHistory = generateHistory(history, selectedModel)

    // Add system prompt to history if available and no custom prompt is selected
    const selectedPrompt = await getPromptById(selectedSystemPrompt)
    
    if (prompt && !selectedPrompt && (!pageContext || pageContext.trim().length === 0)) {
      applicationChatHistory.unshift(
        await systemPromptFormatter({
          content: prompt
        })
      )
    }

    const isTempSystemprompt =
      currentChatModelSettings.systemPrompt &&
      currentChatModelSettings.systemPrompt?.trim().length > 0

    if (!isTempSystemprompt && selectedPrompt && (!pageContext || pageContext.trim().length === 0)) {
      applicationChatHistory.unshift(
        await systemPromptFormatter({
          content: selectedPrompt.content
        })
      )
      promptContent = selectedPrompt.content
    }

    if (isTempSystemprompt && (!pageContext || pageContext.trim().length === 0)) {
      applicationChatHistory.unshift(
        await systemPromptFormatter({
          content: currentChatModelSettings.systemPrompt
        })
      )
      promptContent = currentChatModelSettings.systemPrompt
    }

    // If using page context, the prompt is already included in the human message
    if (pageContext && pageContext.trim().length > 0) {
      const { ragPrompt } = await promptForRag()
      promptContent = ragPrompt
    }

    let generationInfo: any | undefined = undefined

    const chunks = await ollama.stream(
      [...applicationChatHistory, humanMessage],
      {
        signal: signal,
        callbacks: [
          {
            handleLLMEnd(output: any): any {
              try {
                generationInfo = output?.generations?.[0][0]?.generationInfo
              } catch (e) {
                console.error("handleLLMEnd error", e)
              }
            }
          }
        ]
      }
    )

    let count = 0
    let reasoningStartTime: Date | null = null
    let reasoningEndTime: Date | null = null
    let apiReasoning: boolean = false

    for await (const chunk of chunks) {
      if (chunk?.additional_kwargs?.reasoning_content) {
        const reasoningContent = mergeReasoningContent(
          fullText,
          chunk?.additional_kwargs?.reasoning_content || ""
        )
        contentToSave = reasoningContent
        fullText = reasoningContent
        apiReasoning = true
      } else {
        if (apiReasoning) {
          fullText += "</think>"
          contentToSave += "</think>"
          apiReasoning = false
        }
      }

      contentToSave += chunk?.content
      fullText += chunk?.content

      if (isReasoningStarted(fullText) && !reasoningStartTime) {
        reasoningStartTime = new Date()
      }

      if (
        reasoningStartTime &&
        !reasoningEndTime &&
        isReasoningEnded(fullText)
      ) {
        reasoningEndTime = new Date()
        const reasoningTime =
          reasoningEndTime.getTime() - reasoningStartTime.getTime()
        timetaken = reasoningTime
      }

      if (count === 0) {
        setIsProcessing(true)
      }
      setMessages((prev) => {
        return prev.map((message) => {
          if (message.id === generateMessageId) {
            return {
              ...message,
              message: fullText + "▋",
              reasoning_time_taken: timetaken
            }
          }
          return message
        })
      })
      count++
    }

    setMessages((prev) => {
      return prev.map((message) => {
        if (message.id === generateMessageId) {
          return {
            ...message,
            message: fullText,
            generationInfo,
            reasoning_time_taken: timetaken
          }
        }
        return message
      })
    })

    setHistory([
      ...history,
      {
        role: "user",
        content: message,
        image
      },
      {
        role: "assistant",
        content: fullText
      }
    ])

    await saveMessageOnSuccess({
      historyId,
      setHistoryId,
      isRegenerate,
      selectedModel: selectedModel,
      message,
      image,
      fullText,
      source: [],
      generationInfo,
      prompt_content: promptContent,
      prompt_id: promptId,
      reasoning_time_taken: timetaken
    })

    setIsProcessing(false)
    setStreaming(false)
  } catch (e) {

    console.log(e)

    const errorSave = await saveMessageOnError({
      e,
      botMessage: fullText,
      history,
      historyId,
      image,
      selectedModel,
      setHistory,
      setHistoryId,
      userMessage: message,
      isRegenerating: isRegenerate,
      prompt_content: promptContent,
      prompt_id: promptId
    })

    if (!errorSave) {
      throw e // Re-throw to be handled by the calling function
    }
    setIsProcessing(false)
    setStreaming(false)
  } finally {
    setAbortController(null)
  }
}