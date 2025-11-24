"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Send, MessageCircle, Sparkles, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface CCPIChatModalProps {
  isOpen: boolean
  onClose: () => void
  ccpiContext: {
    ccpi: number
    certainty: number
    regime: { name: string; description: string }
    pillars: {
      momentum: number
      riskAppetite: number
      valuation: number
      macro: number
    }
    activeWarnings: number
    totalIndicators: number
    crashAmplifiers?: string[]
    activeSignals?: Array<{ name: string; severity: string }>
  }
}

export function CCPIChatModal({ isOpen, onClose, ccpiContext }: CCPIChatModalProps) {
  const [inputValue, setInputValue] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/ccpi/chat",
      body: { ccpiContext },
    }),
  })

  const isLoading = status === "streaming" || status === "submitted"

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Reset messages when modal opens
  useEffect(() => {
    if (isOpen) {
      setMessages([])
    }
  }, [isOpen, setMessages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || isLoading) return

    sendMessage({ text: inputValue })
    setInputValue("")
  }

  const suggestedQuestions = [
    "What does my current CCPI score mean?",
    "Which pillar is most concerning right now?",
    "What options strategies work in this regime?",
    "How is the certainty score calculated?",
  ]

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] h-[600px] flex flex-col p-0 gap-0 bg-white border border-gray-200 shadow-2xl">
        <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
          <DialogTitle className="flex items-center gap-2 text-blue-900">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            Ask AI about CCPI
          </DialogTitle>
          <p className="text-sm text-gray-600">
            Get insights about your current CCPI score of {ccpiContext.ccpi}/100 ({ccpiContext.regime.name})
          </p>
        </DialogHeader>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
          {messages.length === 0 ? (
            <div className="space-y-4">
              <div className="text-center text-gray-500 text-sm py-4">
                <MessageCircle className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p>Ask me anything about your CCPI data, market crash risk, or options strategies.</p>
              </div>

              {/* Suggested Questions */}
              <div className="space-y-2">
                <p className="text-xs text-gray-500 font-medium">Suggested questions:</p>
                <div className="grid grid-cols-1 gap-2">
                  {suggestedQuestions.map((question, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        sendMessage({ text: question })
                      }}
                      className="text-left text-sm px-3 py-2 rounded-lg border border-gray-200 bg-white hover:bg-blue-50 hover:border-blue-300 transition-colors text-gray-700"
                    >
                      {question}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-2 ${
                    message.role === "user" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-900"
                  }`}
                >
                  {message.role === "assistant" && (
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-5 h-5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded flex items-center justify-center">
                        <Sparkles className="h-3 w-3 text-white" />
                      </div>
                      <span className="text-xs font-medium text-gray-500">CCPI Assistant</span>
                    </div>
                  )}
                  <div className="text-sm whitespace-pre-wrap">
                    {message.parts?.map((part, index) => {
                      if (part.type === "text") {
                        return <span key={index}>{part.text}</span>
                      }
                      return null
                    })}
                  </div>
                </div>
              </div>
            ))
          )}

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-lg px-4 py-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <span className="text-sm text-gray-500">Analyzing...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={handleSubmit} className="p-4 border-t bg-gray-50">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask about CCPI, crash risk, strategies..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
              disabled={isLoading}
            />
            <Button type="submit" disabled={!inputValue.trim() || isLoading} className="bg-blue-600 hover:bg-blue-700">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">Powered by Grok xAI • Educational purposes only</p>
        </form>
      </DialogContent>
    </Dialog>
  )
}
