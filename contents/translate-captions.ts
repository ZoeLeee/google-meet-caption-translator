import { sendToBackground } from "@plasmohq/messaging"

import { debounce } from "./utils"

let map = new Map<HTMLElement, string>()
let map2 = new Map<string, HTMLElement>()

// 全局变量存储启用状态和字幕模式
let isEnabled = true
let captionMode = "bilingual" // bilingual, floating

// 保存MutationObserver实例
let captionObserver: MutationObserver | null = null

// 原始字幕内容缓存（用于双语模式）
let originalCaptions = new Map<string, string>()

let FloatCaptionContainer: HTMLElement | null = null

// 会议记录相关变量
let currentMeetingId: string | null = null
let meetingStartTime: Date | null = null
let meetingTranscript: string[] = []
let participantCount: number = 0

let currentCaptionContent: string[] = []

// 监听扩展设置变更
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "sync") {
    // 处理启用/禁用状态变化
    if (changes.enabled) {
      isEnabled = changes.enabled.newValue

      if (!isEnabled) {
        // 如果禁用翻译，隐藏所有现有翻译并停止监听
        hideAllTranslations()
        stopObservingCaptions()
      } else {
        // 如果启用翻译，重新开始监听
        startObservingCaptions()
      }
    }

    // 处理字幕模式变化
    if (changes.captionMode) {
      captionMode = changes.captionMode.newValue

      // 如果启用了翻译，刷新字幕显示
      if (isEnabled) {
        // 移除所有当前翻译，会根据新模式重新显示
        hideAllTranslations()
      }
    }
  }
})

// 生成UUID
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c == "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// 会议记录相关函数
function startMeetingRecording() {
  if (!currentMeetingId) {
    currentMeetingId = generateUUID()
    meetingStartTime = new Date()
    meetingTranscript = []
    participantCount = 0

    console.log("开始记录会议:", currentMeetingId)
  }
}

// 从字幕容器中提取完整的对话内容
function extractCaptionContent() {
  // 尝试多种可能的字幕容器选择器
  const captionSelectors = [
    '[aria-label="字幕"]',
    '[aria-label="Caption"]',
    '[aria-label="Captions"]',
    '[aria-label="Subtitles"]'
  ]

  let captionContainer: HTMLElement | null = null
  for (const selector of captionSelectors) {
    captionContainer = document.querySelector(selector) as HTMLElement
    if (captionContainer) break
  }

  if (!captionContainer) {
    console.log("字幕容器未找到")
    return []
  }

  const messages: string[] = []

  // 查找所有的字幕消息容器 - 通过结构路径查找
  // 根据您提供的HTML结构，每个消息容器都有特定的结构
  const messageContainers = captionContainer.children

  if (!messageContainers || messageContainers.length === 0) {
    console.log("未找到字幕消息容器")
    return []
  }

  // 遍历所有子元素，查找消息容器
  Array.from(messageContainers).forEach((container, index) => {
    // 跳过非消息容器（如按钮等）
    // 通过检查是否包含按钮元素来识别非消息容器
    if (container.querySelector("button")) {
      return // 跳过包含按钮的容器
    }

    // 检查是否是消息容器（包含用户信息的div）
    if (container.tagName === "DIV" && container.children.length >= 2) {
      console.log(
        `处理第 ${index + 1} 个容器，子元素数量: ${container.children.length}`
      )
      const children = Array.from(container.children)

      // 查找用户信息容器和内容容器
      let userInfoContainer: Element | null = null
      let contentContainer: Element | null = null

      // 遍历子元素，识别用户信息容器和内容容器
      children.forEach((child) => {
        if (child.tagName === "DIV") {
          const childChildren = Array.from(child.children)

          // 用户信息容器通常包含头像（img）和昵称
          // 检查是否包含图片元素
          if (childChildren.some((c) => c.tagName === "IMG")) {
            userInfoContainer = child
          }
          // 内容容器通常包含文本内容，不包含图片
          // 检查是否包含文本内容且不包含图片
          else if (
            child.textContent?.trim() &&
            childChildren.every((c) => c.tagName !== "IMG")
          ) {
            contentContainer = child
          }
        }
      })

      if (userInfoContainer && contentContainer) {
        // 从用户信息容器中提取昵称
        let nickname = "未知用户"
        const userInfoChildren = Array.from(userInfoContainer.children)

        // 查找包含昵称的元素
        for (const child of userInfoChildren) {
          if (child.tagName === "DIV") {
            // 首先尝试查找 span 元素
            const span = child.querySelector("span")
            if (span && span.textContent?.trim()) {
              nickname = span.textContent.trim()
              break
            }
            // 如果没有 span，直接检查 div 的文本内容
            else if (child.textContent?.trim() && child.children.length === 0) {
              const text = child.textContent.trim()
              // 确保不是图片的 alt 文本或其他无关内容
              if (
                text.length > 0 &&
                text.length < 50 &&
                !text.includes("http")
              ) {
                nickname = text
                break
              }
            }
          }
        }

        // 从内容容器中提取对话内容
        const content = contentContainer.textContent?.trim() || ""

        // 过滤有效内容
        if (
          content &&
          content !== nickname &&
          content.length > 0 &&
          content.length < 500 && // 限制长度避免提取到整个容器
          !content.includes("http") && // 排除链接
          !content.includes("data-iml") && // 排除图片相关属性
          content.split(" ").length > 1
        ) {
          // 确保是完整的句子
          messages.push(`${nickname}: ${content}`)
        }
      }
    }
  })

  console.log(`提取到 ${messages.length} 条对话记录`)

  // 如果主要方法没有提取到内容，尝试备用方法
  if (messages.length === 0) {
    console.log("主要方法未提取到内容，尝试备用方法...")
    return extractCaptionContentFallback(captionContainer)
  }

  // 调试信息：显示提取到的消息
  if (messages.length > 0) {
    console.log("提取到的对话内容:")
    messages.forEach((msg, index) => {
      console.log(`${index + 1}. ${msg}`)
    })
  }

  return messages
}

function addToTranscript(text: string) {
  if (currentMeetingId && meetingStartTime) {
    const timestamp = new Date().toLocaleTimeString("zh-CN")
    meetingTranscript.push(`[${timestamp}] ${text}`)

    // 限制记录长度，只保留最近100条
    if (meetingTranscript.length > 100) {
      meetingTranscript = meetingTranscript.slice(-100)
    }
  }
}

function updateParticipantCount() {
  // 尝试获取参与者数量
  const participantElements = document.querySelectorAll("[data-participant-id]")
  participantCount = participantElements.length
}

function saveMeetingRecord() {
  if (!currentMeetingId || !meetingStartTime) return

  const endTime = new Date()
  const duration = Math.round(
    (endTime.getTime() - meetingStartTime.getTime()) / 1000 / 60
  ) // 分钟

  // 提取完整的对话内容
  const fullTranscript = currentCaptionContent?.length
    ? currentCaptionContent
    : extractCaptionContent()

  // 使用结束时间作为标题
  const title = endTime.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  })

  const meetingRecord = {
    id: currentMeetingId,
    title: `会议记录 - ${title}`,
    date: meetingStartTime.toISOString(),
    duration: `${duration} 分钟`,
    participants: participantCount,
    transcript: fullTranscript.length > 0 ? fullTranscript : meetingTranscript
  }

  // 保存到本地存储
  chrome.storage.local.get(["meetingHistory"], (result) => {
    const history = result.meetingHistory || []
    history.unshift(meetingRecord) // 添加到开头

    // 只保留最近50条记录
    const limitedHistory = history.slice(0, 50)

    chrome.storage.local.set({ meetingHistory: limitedHistory }, () => {
      console.log("会议记录已保存:", meetingRecord.title)
    })
  })

  // 重置变量
  currentMeetingId = null
  meetingStartTime = null
  meetingTranscript = []
  participantCount = 0
}

function createFloatingCaptionContainer() {
  console.log("Creating floating caption container")

  FloatCaptionContainer = document.createElement("pre")

  FloatCaptionContainer.style.position = "absolute"
  FloatCaptionContainer.style.bottom = "10px"
  FloatCaptionContainer.style.left = "50%"
  FloatCaptionContainer.style.transform = "translateX(-50%)"
  FloatCaptionContainer.style.backgroundColor = "rgba(0, 0, 0, 0.7)"
  FloatCaptionContainer.style.color = "white"
  FloatCaptionContainer.style.padding = "8px 16px"
  FloatCaptionContainer.style.borderRadius = "4px"
  FloatCaptionContainer.style.zIndex = "9999"
  FloatCaptionContainer.style.maxWidth = "80%"
  FloatCaptionContainer.style.textAlign = "center"
  FloatCaptionContainer.style.display = "block"

  FloatCaptionContainer.setAttribute("data-id", "FLOATING_CAPTION")
  const main = document.getElementsByTagName("main")[0] || document.body
  main.appendChild(FloatCaptionContainer)
  return FloatCaptionContainer
}

export function updateFloatingCaptionContainer(text: string) {
  if (!FloatCaptionContainer || !FloatCaptionContainer.isConnected) {
    createFloatingCaptionContainer()
  }
  FloatCaptionContainer.textContent = text
}

// 监控 Google Meet 字幕变化
function startObservingCaptions() {
  // 如果已经有一个观察器在运行，先停止它
  stopObservingCaptions()

  let captionContainer: HTMLElement | null

  for (const s of [
    "[aria-label='字幕']",
    "[aria-label='Caption']",
    "[aria-label='Captions']",
    "[aria-label='Subtitles']",
    "[aria-label='Subtítulos']",
    "[aria-label='Untertitel']",
    "[aria-label='字幕']",
    "[aria-label='자막']",
    "[aria-label='キャプション']",
    "[aria-label='Legendas']",
    "[aria-label='Sous-titres']",
    "[aria-label='Titoli']",
    "[aria-label='Titrer']",
    "[aria-label='Napisy']",
    "[aria-label='Текст']",
    "[aria-label='Titulky']",
    "[aria-label='Titlovi']",
    "[aria-label='Felirat']",
    "[aria-label='Titrai']",
    "[aria-label='Titluri']",
    "[aria-label='Undergitter']",
    "[aria-label='Tekstitys']",
    "[aria-label='Subtitluri']",
    "[aria-label='คำบรรยาย']",
    "[aria-label='Altyazılar']",
    "[aria-label='Субтитри']",
    "[aria-label='Субтитри']",
    "[aria-label='字幕']",
    "[aria-label='Podnapisi']"
  ]) {
    captionContainer = document.querySelector(s) as HTMLElement | null
    if (captionContainer) {
      break
    }
  }

  if (!captionContainer) {
    console.log("Caption container not found, retrying...")
    // 只有在启用状态下才继续尝试
    if (isEnabled) {
      setTimeout(startObservingCaptions, 1000)
    }
    return
  }

  if (!FloatCaptionContainer) {
    createFloatingCaptionContainer()
  }

  captionObserver = new MutationObserver((mutations) => {
    // 只有在启用状态下才处理变动
    if (!isEnabled) return

    mutations.forEach((mutation) => {
      if (mutation.type === "characterData") {
        const node = mutation.target as HTMLElement
        const caption = node.textContent
        if (caption) {
          const uuid = generateUUID()
          map2.set(uuid, node.parentElement)
          debounceTranslateCaption(caption, uuid)
        }
      }
    })
  })

  captionObserver.observe(captionContainer, {
    childList: true,
    subtree: true,
    characterData: true
  })

  console.log("Started observing captions")
}

// 停止监控字幕
function stopObservingCaptions() {
  if (captionObserver) {
    captionObserver.disconnect()
    captionObserver = null
    console.log("Stopped observing captions")
  }
}

// 调用翻译 API
async function translateCaption(text: string, id: string) {
  try {
    // 开始会议记录（如果还没有开始）
    startMeetingRecording()

    // 更新参与者数量
    updateParticipantCount()

    // 获取目标语言、启用状态和字幕模式
    const result = await chrome.storage.sync.get([
      "targetLang",
      "enabled",
      "captionMode"
    ])
    const lang: string = (result as { targetLang?: string }).targetLang || "ZH"

    // 更新全局变量
    isEnabled = result.enabled !== undefined ? result.enabled : true
    captionMode = result.captionMode || "bilingual"

    // 保存原始字幕（用于双语模式）
    originalCaptions.set(id, text)

    // 如果翻译功能被禁用，直接返回
    if (!isEnabled) {
      return
    }

    const resp = await sendToBackground<{ translatedText?: string }>({
      name: "translate",
      body: { text, targetLang: lang, id }
    } as any)

    if (resp && resp.translatedText) {
      const uuid = resp.id
      displayTranslatedCaption(resp.translatedText, uuid)
    }
  } catch (error) {
    console.error("Translation error:", error)
  }
}

const debounceTranslateCaption = debounce((caption: string, uuid: string) => {
  translateCaption(caption, uuid)

  currentCaptionContent = extractCaptionContent()
}, 500)

// 隐藏所有翻译字幕
function hideAllTranslations() {
  // 移除所有带有特定数据属性的元素（常规或双语模式中的翻译）
  const translations = document.querySelectorAll("[data-id='TRANSLATE']")
  translations.forEach((element) => {
    element.remove()
  })

  // 确保也清除任何可能添加到body的浮动模式翻译
  const floatingTranslations = document.body.querySelectorAll(
    "[data-id='TRANSLATE']"
  )
  floatingTranslations.forEach((element) => {
    element.remove()
  })
}

// 显示翻译后的字幕
function displayTranslatedCaption(translatedText: string, id: string) {
  // 如果翻译功能已禁用，不显示翻译
  if (!isEnabled) {
    return
  }

  const node = map2.get(id)
  if (!node) return

  // 获取原始字幕文本
  const originalText = originalCaptions.get(id) || ""

  // 移除现有的翻译元素
  const existing = node.querySelector("[data-id='TRANSLATE']")
  if (existing) {
    existing.remove()
  }

  const div = document.createElement("div")
  div.setAttribute("data-id", "TRANSLATE")

  // 根据不同模式显示字幕
  switch (captionMode) {
    case "floating":
      updateFloatingCaptionContainer(translatedText)
      return // 提前返回，不执行后续的node.append

    default: // "bilingual" 默认模式
      // 双语模式：原文 + 翻译
      div.innerHTML = `${originalText}<br>${translatedText}`
      div.style.marginTop = "8px"
      break
  }

  node.append(div)
}

// 初始化
async function initialize() {
  // 确保只在 Google Meet 域名下运行
  if (!window.location.hostname.includes("meet.google.com")) {
    console.log("Not on Google Meet, skipping initialization")
    return
  }

  // 获取启用状态和字幕模式
  const result = await chrome.storage.sync.get(["enabled", "captionMode"])
  isEnabled = result.enabled !== undefined ? result.enabled : true
  captionMode = result.captionMode || "bilingual"

  // 根据启用状态决定是否启动监视器
  if (isEnabled) {
    startObservingCaptions()
  }

  // 添加页面卸载时的保存逻辑
  window.addEventListener("beforeunload", () => {
    if (currentMeetingId && meetingStartTime) {
      saveMeetingRecord()
    }
  })

  // 监听页面可见性变化，当页面隐藏时保存记录
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && currentMeetingId && meetingStartTime) {
      saveMeetingRecord()
    }
  })
}

initialize()

function dummy() {}

// 备用提取方法 - 使用更简单的结构分析
function extractCaptionContentFallback(
  captionContainer: HTMLElement
): string[] {
  const messages: string[] = []

  // 查找所有包含文本的div元素
  const allDivs = captionContainer.querySelectorAll("div")

  allDivs.forEach((div) => {
    const text = div.textContent?.trim()
    if (text && text.length > 0 && text.length < 200) {
      // 限制长度避免提取到整个容器
      // 检查是否包含冒号（可能是昵称:内容的格式）
      if (text.includes(":")) {
        messages.push(text)
      }
      // 或者检查是否是独立的对话内容
      else if (text.length > 5 && !text.includes("http")) {
        messages.push(`用户: ${text}`)
      }
    }
  })

  console.log(`备用方法提取到 ${messages.length} 条对话记录`)
  return messages
}
