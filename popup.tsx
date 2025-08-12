import { useEffect, useState } from "react"

import "./popup.css"

function Popup() {
  const [targetLang, setTargetLang] = useState("ZH")
  const [deepApiKey, setDeepApiKey] = useState("")
  const [enabled, setEnabled] = useState(true)
  // captionMode: "bilingual"(双语), "floating"(浮动)
  const [captionMode, setCaptionMode] = useState("bilingual")

  const handleDeepApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const key = e.target.value
    setDeepApiKey(key)
    chrome.storage.sync.set({ deepApiKey: key }, () => {
      console.log("API key set to:", key)
    })
  }
  useEffect(() => {
    chrome.storage.sync.get(["targetLang","deepApiKey","enabled","captionMode"], (result) => {
      if (result.targetLang) {
        setTargetLang(result.targetLang)
      }
      if (result.deepApiKey) {
        setDeepApiKey(result.deepApiKey)
      }
      if (result.enabled !== undefined) {
        setEnabled(result.enabled)
      }
      if (result.captionMode) {
        setCaptionMode(result.captionMode)
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
  
  const handleCaptionModeChange = (mode: string) => {
    setCaptionMode(mode)
    chrome.storage.sync.set({ captionMode: mode }, () => {
      console.log("Caption mode set to:", mode)
    })
  }

  const openHistoryPage = () => {
    chrome.tabs.create({
      url: chrome.runtime.getURL("tabs/history.html")
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
        <button
          onClick={openHistoryPage}
          className="text-sm text-blue-500 hover:text-blue-700 flex items-center"
        >
          <span className="mr-1">📋</span>
          历史记录
        </button>
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
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="text-sm font-medium mb-2">字幕模式：</div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleCaptionModeChange("bilingual")}
              className={`px-3 py-1.5 text-sm rounded ${captionMode === "bilingual" ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              双语模式
            </button>
            <button
              onClick={() => handleCaptionModeChange("floating")}
              className={`px-3 py-1.5 text-sm rounded ${captionMode === "floating" ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
            >
              浮动模式
            </button>
          </div>
        </div>
        
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
    </div>
  )
}

export default Popup
