import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User, Loader2, Sparkles, Trash2 } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const INITIAL_MESSAGE = {
  role: 'assistant',
  content: 'Hello! I\'m the LokSetu AI Assistant. I can help you with election administration, fraud detection insights, voter management, and system monitoring. How can I assist you today?',
};

const QUICK_PROMPTS = [
  'Summarize fraud alerts',
  'Show system health',
  'Voter turnout stats',
  'Explain blockchain',
];

const Chatbot = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    const userMessage = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${API}/api/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          history: messages.slice(-10),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Sorry, I encountered an error processing your request. Please try again.',
        }]);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Unable to connect to the server. Please check your connection and try again.',
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([INITIAL_MESSAGE]);
  };

  return (
    <>
      {/* Floating Circular Button - Bottom Right */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-dash-primary to-dash-accent text-white rounded-full shadow-lg hover:shadow-xl transition-all hover:scale-110 flex items-center justify-center z-50 group"
          title="AI Assistant"
        >
          <Sparkles size={24} className="group-hover:rotate-12 transition-transform" />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-dash-success rounded-full border-2 border-white" />
        </button>
      )}

      {/* Chat Window */}
      {open && (
        <div className="fixed bottom-6 right-6 w-[400px] h-[560px] bg-white rounded-2xl shadow-2xl border border-dash-border z-50 flex flex-col animate-slide-up overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-dash-primary to-dash-primary-light text-white">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold">Admin AI Assistant</h3>
                <p className="text-[10px] text-blue-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full" /> Online
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                title="Clear chat"
              >
                <Trash2 size={15} />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/80">
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                  msg.role === 'user'
                    ? 'bg-dash-primary text-white'
                    : 'bg-white border border-dash-border text-dash-accent shadow-sm'
                }`}>
                  {msg.role === 'user' ? <User size={14} /> : <Sparkles size={13} />}
                </div>
                <div className={`max-w-[280px] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-dash-primary text-white rounded-br-sm'
                    : 'bg-white border border-dash-border text-dash-text rounded-bl-sm shadow-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-white border border-dash-border text-dash-accent shadow-sm">
                  <Sparkles size={13} />
                </div>
                <div className="bg-white border border-dash-border rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-dash-muted rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-dash-muted rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-dash-muted rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts - show only at start */}
          {messages.length <= 1 && !loading && (
            <div className="px-3 pb-2 bg-white border-t border-dash-border">
              <p className="text-[10px] text-dash-muted font-semibold uppercase tracking-wider mb-1.5 pt-2">Quick Actions</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PROMPTS.map(q => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="px-3 py-1.5 text-xs font-medium bg-slate-100 text-dash-text-secondary rounded-full hover:bg-dash-primary hover:text-white transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-dash-border p-3 bg-white">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about elections, fraud, voters..."
                className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-dash-border rounded-full text-sm text-dash-text placeholder-dash-muted focus:outline-none focus:ring-2 focus:ring-dash-accent/20 focus:border-dash-accent"
                disabled={loading}
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
                className="p-2.5 bg-dash-primary text-white rounded-full hover:bg-dash-primary-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Chatbot;
