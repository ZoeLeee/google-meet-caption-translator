import { sendToBackground } from "@plasmohq/messaging"
import { debounce } from './utils'

let map = new Map<HTMLElement, string>()
let map2 = new Map<string, HTMLElement>()

// 生成UUID
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0
    const v = c == "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// 监控 Google Meet 字幕变化
function observeCaptions() {
  let captionContainer: HTMLElement | null

  for (const s of ["[aria-label='字幕']"]) {
    captionContainer = document.querySelector(s) as HTMLElement | null
    if (captionContainer) {
      break
    }
  }

  if (!captionContainer) {
    console.log("Caption container not found, retrying...")
    setTimeout(observeCaptions, 1000)
    return
  }

  const observer = new MutationObserver((mutations) => {
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

  observer.observe(captionContainer, {
    childList: true,
    subtree: true,
    characterData: true
  })
}

// 调用翻译 API
async function translateCaption(text: string, id: string) {
  try {
    const targetLangObj = await chrome.storage.sync.get(["targetLang"])
    const lang: string =
      (targetLangObj as { targetLang?: string }).targetLang || "ZH"

    const resp = await sendToBackground<{ translatedText?: string }>({
      name: "translate",
      body: { text, targetLang: lang, id }
    } as any)

    if (resp && resp.translatedText) {
      const uuid=resp.id;
      displayTranslatedCaption(resp.translatedText,uuid)
    }
  } catch (error) {
    console.error("Translation error:", error)
  }
}

const debounceTranslateCaption = debounce((caption: string, uuid: string) => {
  translateCaption(caption, uuid)
}, 500)

// 显示翻译后的字幕
function displayTranslatedCaption(translatedText: string, id: string) {
  const node = map2.get(id)
  if (node) {
    const div = document.createElement("div")
    div.setAttribute("data-id", "TRANSLATE")

    div.textContent = translatedText
    
    const existing = node.querySelector("[data-id='TRANSLATE']")
    
    if (existing) {
      existing.textContent = translatedText
      return
    }
    
    node.append(div)
  }
}

// 初始化
observeCaptions()

function dummy() {}
