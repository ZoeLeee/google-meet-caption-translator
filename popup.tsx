import { useEffect, useState } from "react"

import "./popup.css"

function Popup() {
  const [targetLang, setTargetLang] = useState("ZH")
  const [deepApiKey, setDeepApiKey] = useState("")
  const [enabled, setEnabled] = useState(true)

  const handleDeepApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const key = e.target.value
    setDeepApiKey(key)
    chrome.storage.sync.set({ deepApiKey: key }, () => {
      console.log("API key set to:", key)
    })
  }
  useEffect(() => {
    chrome.storage.sync.get(["targetLang","deepApiKey","enabled"], (result) => {
      if (result.targetLang) {
        setTargetLang(result.targetLang)
      }
      if (result.deepApiKey) {
        setDeepApiKey(result.deepApiKey)
      }
      if (result.enabled !== undefined) {
        setEnabled(result.enabled)
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

  const handleEnabledChange = () => {
    const newEnabled = !enabled
    setEnabled(newEnabled)
    chrome.storage.sync.set({ enabled: newEnabled }, () => {
      console.log("Translation enabled:", newEnabled)
    })
  }

  return (
    <div className="p-4 w-64 font-sans">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          <span className="mr-2 text-sm">{enabled ? "开启" : "关闭"}</span>
          <button 
            onClick={handleEnabledChange}
            className={`w-10 h-5 rounded-full flex items-center ${enabled ? 'bg-blue-500 justify-end' : 'bg-gray-300 justify-start'}`}
          >
            <span className="w-4 h-4 bg-white rounded-full m-0.5"></span>
          </button>
        </div>
      </div>
      {/* <label className="block mb-2">
        Target Language:
        <select
          value={targetLang}
          onChange={handleLangChange}
          className="mt-1 block w-full border rounded p-1">
          <option value="ZH">Chinese</option>
          <option value="ES">Spanish</option>
          <option value="FR">French</option>
        </select>
      </label> */}
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
