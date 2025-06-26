import type { PlasmoMessaging } from "@plasmohq/messaging"

const handler: PlasmoMessaging.MessageHandler<any, any> = async (
  req,
  res
) => {
  const { text, targetLang, id } = req.body
  try {
    const storageKey = await chrome.storage.sync.get(["deepApiKey"])

    const response = await fetch("https://api-free.deepl.com/v2/translate", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        auth_key: storageKey.deepApiKey,
        text,
        target_lang: targetLang,
        source_lang: "EN"
      })
    })
    const data = await response.json()
    const translatedText = data.translations[0].text
    res.send({
      translatedText: translatedText,
      id
    })
  } catch (error) {
    console.error("Background translation error:", error)
    res.send({
      error: "Translation failed"
    })
  }
}

export default handler
