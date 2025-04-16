import { useEffect, useState } from "react"

import "./popup.css"

function Popup() {
  const [targetLang, setTargetLang] = useState("ZH")
  const [deepApiKey, setDeepApiKey] = useState("")

  const handleDeepApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const key = e.target.value
    setDeepApiKey(key)
    chrome.storage.sync.set({ deepApiKey: key }, () => {
      console.log("API key set to:", key)
    })
  }
  useEffect(() => {
    chrome.storage.sync.get(["targetLang","deepApiKey"], (result) => {
      if (result.targetLang) {
        setTargetLang(result.targetLang)
      }
      if (result.deepApiKey) {
        setDeepApiKey(result.deepApiKey)
      }
    })
  }, [])

  const handleLangChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const lang = e.target.value
    setTargetLang(lang)
    chrome.storage.sync.set({ targetLang: lang }, () => {
      console.log("Target language set to:", lang)
    })
  }

  return (
    <div className="p-4 w-64 font-sans">
      <h2 className="text-lg font-bold mb-4">Caption Translator</h2>
      <label className="block mb-2">
        Target Language:
        <select
          value={targetLang}
          onChange={handleLangChange}
          className="mt-1 block w-full border rounded p-1">
          <option value="ZH">Chinese</option>
          <option value="ES">Spanish</option>
          <option value="FR">French</option>
        </select>
      </label>
      <label>
        DeepL API Key:
        <input
          type="password"
          className="mt-1 block w-full border rounded p-1"
          value={deepApiKey}
          onChange={handleDeepApiKeyChange}
        />
      </label>
    </div>
  )
}

export default Popup
