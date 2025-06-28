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

function createFloatingCaptionContainer() {
  console.log("Creating floating caption container")

  FloatCaptionContainer = document.createElement("div")

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
  // 获取启用状态和字幕模式
  const result = await chrome.storage.sync.get(["enabled", "captionMode"])
  isEnabled = result.enabled !== undefined ? result.enabled : true
  captionMode = result.captionMode || "bilingual"

  // 根据启用状态决定是否启动监视器
  if (isEnabled) {
    startObservingCaptions()
  }
}

initialize()

function dummy() {}
