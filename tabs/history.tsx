import { useEffect, useState } from "react"
import type { PlasmoCSConfig } from "plasmo"

// 导入 Tailwind CSS 样式
import "../popup.css"

// Plasmo Tab Page 配置
export const config: PlasmoCSConfig = {
  matches: ["<all_urls>"]
}

interface MeetingRecord {
  id: string
  title: string
  date: string
  duration: string
  participants: number
  transcript: string[]
}

function HistoryTab() {
  const [meetingRecords, setMeetingRecords] = useState<MeetingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedRecord, setSelectedRecord] = useState<MeetingRecord | null>(null)

  useEffect(() => {
    // 从存储中获取历史会议记录
    chrome.storage.local.get(["meetingHistory"], (result) => {
      const history = result.meetingHistory || []
      setMeetingRecords(history)
      setLoading(false)
    })
  }, [])

     const clearHistory = () => {
     chrome.storage.local.remove(["meetingHistory"], () => {
       setMeetingRecords([])
       setSelectedRecord(null)
       console.log("历史记录已清除")
     })
   }

     const exportHistory = () => {
     const dataStr = JSON.stringify(meetingRecords, null, 2)
     const dataBlob = new Blob([dataStr], { type: 'application/json' })
     const url = URL.createObjectURL(dataBlob)
     const link = document.createElement('a')
     link.href = url
     link.download = `meeting-history-${new Date().toISOString().split('T')[0]}.json`
     document.body.appendChild(link)
     link.click()
     document.body.removeChild(link)
     URL.revokeObjectURL(url)
   }

   const copyTranscript = () => {
     if (selectedRecord && selectedRecord.transcript.length > 0) {
       const transcriptText = selectedRecord.transcript.join('\n')
       navigator.clipboard.writeText(transcriptText).then(() => {
         console.log("对话内容已复制到剪贴板")
       }).catch(err => {
         console.error("复制失败:", err)
       })
     }
   }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString("zh-CN")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto p-6">
          <div className="flex justify-center items-center h-64">
            <div className="text-gray-500">加载中...</div>
          </div>
        </div>
      </div>
    )
  }

     return (
     <div className="min-h-screen bg-gray-50">
       <div className="max-w-7xl mx-auto p-6">
         {/* 页面头部 */}
         <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
           <div className="flex justify-between items-center">
             <div>
               <h1 className="text-2xl font-bold text-gray-900">会议历史记录</h1>
               <p className="text-gray-600 mt-1">查看您的 Google Meet 会议记录和字幕翻译历史</p>
             </div>
             <div className="flex items-center space-x-3">
               <span className="text-sm text-gray-500">
                 共 {meetingRecords.length} 条记录
               </span>
               {meetingRecords.length > 0 && (
                 <>
                   <button
                     onClick={exportHistory}
                     className="px-4 py-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-md transition-colors"
                   >
                     导出记录
                   </button>
                   <button
                     onClick={clearHistory}
                     className="px-4 py-2 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors"
                   >
                     清除历史
                   </button>
                 </>
               )}
             </div>
           </div>
         </div>

                          {/* 主要内容区域 */}
          <div className="flex flex-col lg:flex-row gap-6">
           {/* 左侧会议记录列表 */}
           <div className="flex-1">
             {meetingRecords.length === 0 ? (
               <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                 <div className="text-gray-400 text-6xl mb-4">📋</div>
                 <h3 className="text-lg font-medium text-gray-900 mb-2">暂无会议记录</h3>
                 <p className="text-gray-500">参加会议并开启字幕时，会在会议结束时自动记录完整对话内容</p>
               </div>
             ) : (
               <div className="space-y-4">
                 {meetingRecords.map((record) => (
                   <div
                     key={record.id}
                     onClick={() => setSelectedRecord(record)}
                     className={`bg-white rounded-lg shadow-sm p-6 hover:shadow-md transition-shadow cursor-pointer ${
                       selectedRecord?.id === record.id ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                     }`}
                   >
                     <div className="flex justify-between items-start mb-4">
                       <div className="flex-1">
                         <h3 className="text-lg font-semibold text-gray-900 mb-1">
                           {record.title || "未命名会议"}
                         </h3>
                         <div className="flex items-center space-x-4 text-sm text-gray-500">
                           <span>📅 {formatDate(record.date)}</span>
                           <span>⏱️ {record.duration}</span>
                           <span>👥 {record.participants} 人参与</span>
                         </div>
                       </div>
                     </div>

                     {record.transcript.length > 0 && (
                       <div className="border-t pt-4">
                         <h4 className="text-sm font-medium text-gray-700 mb-3">对话记录：</h4>
                         <div className="bg-gray-50 rounded-lg p-4 max-h-32 overflow-y-auto">
                           <div className="space-y-2">
                             {record.transcript.slice(-3).map((line, index) => (
                               <div key={index} className="text-sm">
                                 <span className="text-gray-600">{line}</span>
                               </div>
                             ))}
                           </div>
                           {record.transcript.length > 3 && (
                             <div className="text-xs text-gray-400 mt-2">
                               显示最近 3 条记录，共 {record.transcript.length} 条对话
                             </div>
                           )}
                         </div>
                       </div>
                     )}
                   </div>
                 ))}
               </div>
             )}
           </div>

           {/* 右侧详细对话面板 */}
           <div className="w-full lg:w-96">
             {selectedRecord ? (
               <div className="bg-white rounded-lg shadow-sm p-6 sticky top-6">
                 <div className="flex justify-between items-center mb-4">
                   <h2 className="text-xl font-semibold text-gray-900">详细对话</h2>
                   <div className="flex items-center space-x-2">
                     {selectedRecord.transcript.length > 0 && (
                       <button
                         onClick={copyTranscript}
                         className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                         title="复制对话内容"
                       >
                         复制
                       </button>
                     )}
                     <button
                       onClick={() => setSelectedRecord(null)}
                       className="text-gray-400 hover:text-gray-600"
                       title="关闭"
                     >
                       ✕
                     </button>
                   </div>
                 </div>
                 
                 <div className="mb-4">
                   <h3 className="text-lg font-medium text-gray-900 mb-2">
                     {selectedRecord.title}
                   </h3>
                   <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                     <span>📅 {formatDate(selectedRecord.date)}</span>
                     <span>⏱️ {selectedRecord.duration}</span>
                     <span>👥 {selectedRecord.participants} 人参与</span>
                   </div>
                 </div>

                 {selectedRecord.transcript.length > 0 ? (
                   <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                     <div className="space-y-3">
                       {selectedRecord.transcript.map((line, index) => (
                         <div key={index} className="text-sm p-2 bg-white rounded border-l-4 border-blue-500">
                           <span className="text-gray-800">{line}</span>
                         </div>
                       ))}
                     </div>
                   </div>
                 ) : (
                   <div className="text-center py-8 text-gray-500">
                     <div className="text-4xl mb-2">💬</div>
                     <p>暂无对话记录</p>
                   </div>
                 )}
               </div>
             ) : (
               <div className="bg-white rounded-lg shadow-sm p-6 text-center text-gray-500">
                 <div className="text-4xl mb-2">👈</div>
                 <p>点击左侧记录查看详细对话</p>
               </div>
             )}
           </div>
         </div>

                 {/* 页面底部 */}
         <div className="mt-8 text-center text-sm text-gray-500">
           <p>会议记录会在会议结束时自动保存，包含完整的对话内容</p>
         </div>
      </div>
    </div>
  )
}

export default HistoryTab
