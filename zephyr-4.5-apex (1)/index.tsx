import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Modality } from "@google/genai";
import { Message, Role } from './types';
import { selectAgent, generateImageUrl } from './agentManager';

const helperMessages = [
  "Ask anything — concepts, ideas, or doubts.",
  "Stuck on something? Let’s break it down.",
  "Need a clear explanation or example?",
  "Ready to learn something new today?",
  "Homework, ideas, or curiosity — I’ve got you.",
];

// Use marked from CDN
declare var marked: any;

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    copyCode: (encodedCode: string, btn: HTMLElement) => void;
  }
}

// --- Audio Utilities ---
const decodeBase64 = (base64: string) => {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
};

const decodeAudioData = async (
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> => {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
};

// --- Markdown Configuration ---
if (typeof window !== 'undefined') {
  window.copyCode = async (encodedCode: string, btn: HTMLElement) => {
    try {
      const code = decodeURIComponent(encodedCode);
      await navigator.clipboard.writeText(code);
      
      const originalHtml = btn.innerHTML;
      btn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-green-500"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span class="text-green-500">Copied!</span>
      `;
      
      setTimeout(() => {
        btn.innerHTML = originalHtml;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  if (typeof marked !== 'undefined') {
    const renderer = new marked.Renderer();
    renderer.code = (code: string, language: string) => {
      const escapedCode = code.replace(/&/g, '&amp;')
                              .replace(/</g, '&lt;')
                              .replace(/>/g, '&gt;');
      const encodedCode = encodeURIComponent(code);
      const langLabel = language || 'Code';

      return `
        <div class="my-4 rounded-xl overflow-hidden bg-[#1e1e1e] border border-zinc-800 shadow-md">
          <div class="flex items-center justify-between px-4 py-2 bg-[#2d2d2d] border-b border-zinc-700">
            <span class="text-xs font-mono text-zinc-400 select-none">${langLabel}</span>
            <button 
              onclick="window.copyCode('${encodedCode}', this)"
              class="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 px-2 py-1 rounded select-none"
              title="Copy code"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              Copy
            </button>
          </div>
          <div class="p-4 overflow-x-auto">
            <pre><code class="text-sm font-mono text-zinc-300 ${language ? 'language-' + language : ''}">${escapedCode}</code></pre>
          </div>
        </div>
      `;
    };
    marked.use({ renderer });
  }
}

// --- Icons ---
const Icons = {
  Send: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>,
  Mic: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>,
  MicActive: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z"></path></svg>,
  Paperclip: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>,
  X: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
  Menu: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>,
  Sun: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>,
  Moon: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>,
  Plus: () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>,
  Trash: () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2 2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>,
  Bot: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 dark:text-purple-400 drop-shadow-sm"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>,
  User: () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>,
  Sparkles: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.6 7.4L22 12l-7.4 2.6L12 22l-2.6-7.4L2 12l7.4-2.6L12 2z"/><circle cx="18" cy="6" r="1.5"/></svg>,
  logo: () => (<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3a3 3 0 0 0-3 3v1a2 2 0 0 0-1 3v1a2 2 0 0 0 1 3v1a3 3 0 0 0 3 3h1V3H9z"/><path d="M15 3a3 3 0 0 1 3 3v1a2 2 0 0 1 1 3v1a2 2 0 0 1-1 3v1a3 3 0 0 1-3 3h-1V3h1z"/><path d="M10 7c1 .5 1 1.5 0 2M14 7c-1 .5-1 1.5 0 2"/></svg>),
  Newspaper: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>,
  Beaker: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 3h15"/><path d="M6 3v16a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V3"/><path d="M6 14h12"/></svg>,
  Terminal: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>,
  Feather: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path><line x1="16" y1="8" x2="2" y2="22"></line><line x1="17.5" y1="15" x2="9" y2="15"></line></svg>,
  Copy: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>,
  Check: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>,
  CodeCopy: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline></svg>,
  Download: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>,
  Search: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>,
  Speaker: () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>,
  Map: () => <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line></svg>,
};

// --- Components ---

const LoadingScreen = () => (
  <div className="bg-white dark:bg-zinc-950 h-screen flex items-center justify-center font-sans overflow-hidden">
    <div className="loading-container z-10 flex flex-col items-center gap-3 animate-fade-in">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-blue-600 dark:text-purple-400 drop-shadow-sm"
      >
        <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
      </svg>
      <div className="logo-text">Zephyr</div>
      <div className="credit-text flex items-center justify-center gap-2">
        <span className="by-text text-xs sm:text-sm opacity-70">engineered by</span>
        <span className="company-text text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 font-bold tracking-wide">Quantum Coders</span>
      </div>
    </div>
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-100/40 via-transparent to-transparent dark:from-blue-900/10 dark:via-transparent dark:to-transparent pointer-events-none"></div>
  </div>
);

const extractCode = (text: string) => {
    const codeBlockRegex = /```(?:\w+)?\s*([\s\S]*?)```/g;
    let matches = [];
    let match;
    while ((match = codeBlockRegex.exec(text)) !== null) {
        matches.push(match[1].trim());
    }
    return matches.length > 0 ? matches.join('\n\n') : null;
};

const CopyButton = ({ text }: { text: string }) => {
  const [isCopied, setIsCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) { console.error('Failed to copy text: ', err); }
  };
  return (
    <button onClick={handleCopy} className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100" title="Copy to clipboard">
      {isCopied ? <Icons.Check /> : <Icons.Copy />}
    </button>
  );
};

const SpeakerButton = ({ text }: { text: string }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const handlePlay = async () => {
    if (isPlaying) {
      sourceRef.current?.stop();
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        const audioBuffer = await decodeAudioData(
          decodeBase64(base64Audio),
          audioContextRef.current,
          24000,
          1,
        );
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => setIsPlaying(false);
        source.start();
        sourceRef.current = source;
      }
    } catch (err) {
      console.error('Speech synthesis failed:', err);
      setIsPlaying(false);
    }
  };

  return (
    <button onClick={handlePlay} className={`p-1.5 rounded-md transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 flex items-center gap-1.5 ${isPlaying ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/20'}`} title="Listen to message">
      <div className={isPlaying ? 'animate-pulse' : ''}><Icons.Speaker /></div>
      <span className="text-[10px] font-medium">{isPlaying ? 'Playing...' : 'Listen'}</span>
    </button>
  );
};

const CopyAgentCodeButton = ({ text }: { text: string }) => {
  const [isCopied, setIsCopied] = useState(false);
  const code = extractCode(text);
  if (!code) return null;
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) { console.error('Failed to copy code: ', err); }
  };
  return (
    <button onClick={handleCopy} className="p-1.5 rounded-md text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 flex items-center gap-1.5" title="Copy all code">
      {isCopied ? <Icons.Check /> : <Icons.CodeCopy />}
      <span className="text-[10px] font-medium">Copy Code</span>
    </button>
  );
};

const DownloadButton = ({ url }: { url: string }) => {
  const handleDownload = async () => {
    try {
        const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
        if (!response.ok) throw new Error(`Failed to fetch image`);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = `zephyr-image-${Date.now()}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
        console.warn("Direct download failed, falling back to new tab.", e);
        window.open(url, '_blank');
    }
  };
  return (
    <button onClick={handleDownload} className="p-1.5 rounded-md text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 flex items-center gap-1.5" title="Download Image">
      <Icons.Download />
      <span className="text-[10px] font-medium">Download</span>
    </button>
  );
};

const HistorySidebar = ({ isOpen, onClose, history, onLoadChat, onDeleteChat, onNewChat }: {
    isOpen: boolean; onClose: () => void; history: Message[][]; onLoadChat: (index: number) => void; onDeleteChat: (index: number) => void; onNewChat: () => void;
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const filteredHistory = history
    .map((chat, index) => ({ chat, index }))
    .filter(({ chat }) => {
        const firstUserMsg = chat.find(m => m.role === Role.USER);
        const title = firstUserMsg?.text || (firstUserMsg?.image ? "Image uploaded" : "New Conversation");
        return title.toLowerCase().includes(searchTerm.toLowerCase());
    });
  return (
    <>
      <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-r border-zinc-200 dark:border-zinc-800 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'}`} aria-modal="true" role="dialog">
        <div className="flex flex-col h-full">
          <div className="p-4 flex justify-between items-center">
            <h2 className="text-lg font-bold text-zinc-800 dark:text-zinc-100">History</h2>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400" aria-label="Close history">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          <div className="px-4 pb-2">
              <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-blue-500 transition-colors"><Icons.Search /></div>
                  <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-9 pr-4 py-2 bg-zinc-100 dark:bg-zinc-900 border border-transparent focus:border-blue-500/50 rounded-xl text-sm outline-none text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400 transition-all" />
              </div>
          </div>
          <div className="p-4 pt-2 border-b border-zinc-200 dark:border-zinc-800">
             <button onClick={onNewChat} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-medium rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-zinc-500/10"><Icons.Plus />New Chat</button>
          </div>
          <nav className="flex-1 overflow-y-auto px-2 pt-2">
            {filteredHistory.length === 0 ? (
                <div className="text-center text-zinc-400 dark:text-zinc-600 mt-10 text-sm">{searchTerm ? "No matching chats" : "No recent chats"}</div>
            ) : (
                <ul className="space-y-1">
                {filteredHistory.map(({ chat, index }) => (
                    <li key={index}>
                    <a href="#" onClick={(e) => { e.preventDefault(); onLoadChat(index); }} className="flex items-center justify-between p-3 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-900 group transition-colors">
                        <span className="truncate flex-1 pr-3 text-sm text-zinc-700 dark:text-zinc-300">
                        {chat.find(m => m.role === Role.USER)?.text || (chat.find(m => m.role === Role.USER)?.image ? "Image uploaded" : "New Conversation")}
                        </span>
                        <button onClick={(e) => { e.stopPropagation(); onDeleteChat(index); }} className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 opacity-0 group-hover:opacity-100 transition-all" aria-label="Delete chat"><Icons.Trash /></button>
                    </a>
                    </li>
                ))}
                </ul>
            )}
          </nav>
        </div>
      </div>
      {isOpen && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity" onClick={onClose}></div>}
    </>
  );
};

const AgentBadge = ({ name }: { name: string }) => {
    let Icon = Icons.logo;
    let color = "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
    let border = "border-zinc-200 dark:border-zinc-700";
    if (name === "News Agent") { Icon = Icons.Newspaper; color = "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"; border = "border-blue-200 dark:border-blue-800"; }
    else if (name === "Science Agent") { Icon = Icons.Beaker; color = "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300"; border = "border-emerald-200 dark:border-emerald-800"; }
    else if (name === "Coder Agent") { Icon = Icons.Terminal; color = "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300"; border = "border-amber-200 dark:border-amber-800"; }
    else if (name === "Creative Agent") { Icon = Icons.Feather; color = "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300"; border = "border-purple-200 dark:border-purple-800"; }
    return (
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${color} ${border} mb-2`}>
            <Icon />{name}
        </div>
    );
};

const SuggestionCard = ({ text, subtext, onClick, icon: Icon }: { text: string, subtext: string, onClick: () => void, icon?: any }) => (
    <button onClick={onClick} className="flex flex-col items-start text-left p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all group h-full w-full">
        <div className="mb-3 p-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 text-zinc-500 dark:text-zinc-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{Icon ? <Icon /> : <Icons.Sparkles />}</div>
        <span className="font-semibold text-zinc-800 dark:text-zinc-100 text-sm mb-1">{text}</span>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">{subtext}</span>
    </button>
);

const processImage = (file: File): Promise<{ data: string; mimeType: string; url: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width, height = img.height, maxDim = 1536; 
        if (width > maxDim || height > maxDim) { const ratio = Math.min(maxDim / width, maxDim / height); width *= ratio; height *= ratio; }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error("Canvas context unavailable")); return; }
        ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, width, height); ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve({ url: dataUrl, data: dataUrl.split(',')[1], mimeType: 'image/jpeg' });
      };
      img.onerror = () => reject(new Error("Failed to load image"));
      if (typeof e.target?.result === 'string') img.src = e.target.result; else reject(new Error("File read failed"));
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const App = () => {
  const [showLoadingScreen, setShowLoadingScreen] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState<{ url: string; data: string; mimeType: string } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState<Message[][]>([]);
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedTheme = window.localStorage.getItem('zephyr-theme');
      if (storedTheme) return storedTheme;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [helperText, setHelperText] = useState("");

  useEffect(() => { setHelperText(helperMessages[Math.floor(Math.random() * helperMessages.length)]); }, []);
  useEffect(() => {
    if (theme === 'dark') { document.documentElement.classList.add('dark'); localStorage.setItem('zephyr-theme', 'dark'); }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('zephyr-theme', 'light'); }
  }, [theme]);
  useEffect(() => { const timer = setTimeout(() => setShowLoadingScreen(false), 2500); return () => clearTimeout(timer); }, []);
  useEffect(() => { try { const savedHistory = localStorage.getItem('zephyrChatHistory'); if (savedHistory) setChatHistory(JSON.parse(savedHistory)); } catch (e) {} }, []);
  useEffect(() => { try { localStorage.setItem('zephyrChatHistory', JSON.stringify(chatHistory)); } catch (e) {} }, [chatHistory]);
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false; recognition.interimResults = false; recognition.lang = 'en-US';
      recognition.onstart = () => setIsRecording(true);
      recognition.onresult = (event: any) => setInput(event.results[0][0].transcript);
      recognition.onend = () => setIsRecording(false);
      recognition.onerror = () => setIsRecording(false);
      recognitionRef.current = recognition;
    }
  }, []);

  const scrollToBottom = () => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); };
  useEffect(() => { if (!showLoadingScreen) scrollToBottom(); }, [messages, showLoadingScreen, attachment]);

  const archiveCurrentChat = () => { if (messages.length > 0) setChatHistory(prev => [messages, ...prev]); };
  const startNewChat = () => { archiveCurrentChat(); setMessages([]); setAttachment(null); setInput(''); setIsHistoryOpen(false); };
  const loadChat = (index: number) => { archiveCurrentChat(); setMessages(chatHistory[index]); setChatHistory(prev => prev.filter((_, i) => i !== index)); setIsHistoryOpen(false); };
  const deleteChat = (index: number) => { setChatHistory(prev => prev.filter((_, i) => i !== index)); };

  const getCurrentPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
    });
  };

  const sendMessage = async (messageText: string, imageAttachment?: { data: string; mimeType: string; url: string }) => {
    const isBusy = messages.some(m => m.isLoading);
    if ((!messageText.trim() && !imageAttachment) || isBusy) return;

    const userMsgId = Date.now().toString() + '-user';
    const placeholderId = Date.now().toString() + '-model';

    const userMessage: Message = { 
        role: Role.USER, 
        text: messageText.trim(),
        image: imageAttachment?.url,
        id: userMsgId
    };

    const lowerCaseInput = messageText.trim().toLowerCase();
    
    // Image Generation handled locally
    if (lowerCaseInput.startsWith("/image ")) {
        const prompt = messageText.trim().substring(7);
        if (prompt) {
            setMessages(prev => [...prev, userMessage, { 
                role: Role.MODEL, text: generateImageUrl(prompt), type: 'image', agentName: "Creative Agent", id: placeholderId 
            }]);
            setInput(''); setAttachment(null);
            return;
        }
    }

    // Determine Agent
    const selectedAgent = await selectAgent(messageText);
    const agentName = selectedAgent ? selectedAgent.name : "Zephyr";

    // Immediate update: User message + Loading placeholder for Model
    setMessages(prev => [...prev, userMessage, { 
        role: Role.MODEL, 
        text: '', 
        agentName: agentName, 
        id: placeholderId, 
        isLoading: true 
    }]);
    setInput(''); setAttachment(null);
    
    // Hardcoded Client Responses
    if (!imageAttachment) {
        if (/\b(time|date)\b/.test(lowerCaseInput)) {
            setMessages(prev => prev.map(m => m.id === placeholderId ? { ...m, text: `The current date and time is: ${new Date().toLocaleString()}`, isLoading: false } : m));
            return;
        }
        if (/\b(developed you|your developer|your creator|created you|made you)\b/.test(lowerCaseInput) && !lowerCaseInput.includes("quantum coders")) {
            setMessages(prev => prev.map(m => m.id === placeholderId ? { ...m, text: "I was created by **Mohammad Rayyan Ali**.", isLoading: false } : m));
            return;
        }
    }

    // Initialize Gemini API client
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        setMessages(prev => prev.map(m => m.id === placeholderId ? { ...m, text: "Error: API Key missing.", isLoading: false } : m));
        return;
    }

    try {
        const ai = new GoogleGenAI({ apiKey: apiKey });
        const finalSystemInstruction = selectedAgent 
            ? `${selectedAgent.instructions}\n\nCURRENT AGENT MODE: ${agentName}\nROLE: ${selectedAgent.role}\nDESCRIPTION: ${selectedAgent.description}`
            : "You are Zephyr, a helpful AI assistant created by Quantum Coders. Responses should be formatted in Markdown.";

        const historyForAPI = messages.filter(m => !m.isLoading).map(msg => ({ role: msg.role, parts: [{ text: msg.text }] }));
        const currentParts: any[] = [];
        if (messageText.trim()) currentParts.push({ text: messageText.trim() });
        if (imageAttachment) currentParts.push({ inlineData: { mimeType: imageAttachment.mimeType, data: imageAttachment.data } });

        const contents = [...historyForAPI, { role: Role.USER, parts: currentParts }];
        
        // Tool Configuration
        const tools: any[] = [{ googleSearch: {} }];
        let toolConfig: any = undefined;

        // Check if map grounding is needed
        const isMapQuery = /\b(near|nearby|location|place|restaurant|cafe|hotel|park|address|direction|where is|at)\b/i.test(lowerCaseInput);
        if (isMapQuery) {
          tools.push({ googleMaps: {} });
          try {
            const pos = await getCurrentPosition();
            toolConfig = {
              retrievalConfig: {
                latLng: {
                  latitude: pos.coords.latitude,
                  longitude: pos.coords.longitude
                }
              }
            };
          } catch (e) {
            console.warn("Location access denied or unavailable, falling back to standard search.");
          }
        }

        const responseStream = await ai.models.generateContentStream({
            model: 'gemini-2.5-flash', // Using Gemini 2.5 Flash as requested
            contents: contents,
            config: {
                systemInstruction: finalSystemInstruction,
                tools: tools,
                toolConfig: toolConfig
            },
        });
        
        let fullText = "";
        let accumulatedSources: {title: string, uri: string}[] = [];

        for await (const chunk of responseStream) {
            const text = chunk.text;
            if (text) {
                fullText += text;
                setMessages(prev => prev.map(msg => 
                    msg.id === placeholderId ? { ...msg, text: fullText, isLoading: false } : msg
                ));
            }
            const groundingChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
            if (groundingChunks) {
                const sources = groundingChunks.map((c: any) => {
                  if (c.web) return c.web;
                  if (c.maps) return c.maps;
                  return null;
                }).filter((s: any) => !!(s?.uri && s.title));
                
                if (sources.length > 0) {
                     accumulatedSources = [...accumulatedSources, ...sources.filter((s: any) => !accumulatedSources.some(exist => exist.uri === s.uri))];
                     setMessages(prev => prev.map(msg => msg.id === placeholderId ? { ...msg, sources: accumulatedSources } : msg));
                }
            }
        }
    } catch (error: any) {
        setMessages(prev => prev.map(m => m.id === placeholderId ? { ...m, text: `Connection Error: ${error.message || error}`, isLoading: false } : m));
    }
  };

  const handleMicClick = () => {
    if (isRecording) recognitionRef.current?.stop();
    else { setInput(''); try { recognitionRef.current?.start(); } catch (e) { setIsRecording(false); } }
  };
  
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { try { setAttachment(await processImage(file)); } catch (error) { alert("Failed to process image."); } }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const renderText = (text: string) => {
    try { if (typeof marked !== 'undefined' && marked.parse) return { __html: marked.parse(text) }; } catch (e) {}
    return { __html: text.replace(/\n/g, '<br/>') };
  };

  if (showLoadingScreen) {
    return <LoadingScreen />;
  }

  return (
    <div className="bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 h-screen flex flex-col font-sans transition-colors duration-300">
      <HistorySidebar isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} history={chatHistory} onLoadChat={loadChat} onDeleteChat={deleteChat} onNewChat={startNewChat} />
      <header className="h-16 flex items-center justify-between px-4 sm:px-6 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsHistoryOpen(true)} className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"><Icons.Menu /></button>
          <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Zephyr</h1>
        </div>
        <div className="flex items-center gap-2">
           <div className="hidden sm:block text-xs text-zinc-400 dark:text-zinc-500 mr-2">by Quantum Coders</div>
           <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')} className="p-2 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-600 dark:text-zinc-400">{theme === 'light' ? <Icons.Moon /> : <Icons.Sun />}</button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6 scroll-smooth">
        <div className="max-w-3xl mx-auto space-y-8 pb-4">
          {messages.length === 0 ? (
             <div className="relative flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(59,130,246,0.15)_0%,transparent_70%)] dark:bg-[radial-gradient(circle,rgba(59,130,246,0.1)_0%,transparent_70%)] pointer-events-none -z-10 blur-3xl"></div>
                <div className="mb-8 relative group cursor-default">
                    <div className="absolute -inset-1 bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                    <div className="relative w-24 h-24 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl flex items-center justify-center shadow-2xl">
                         <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600 dark:text-purple-400 drop-shadow-sm"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                    </div>
                </div>
                <h2 className="text-2xl font-bold mb-2 text-center bg-clip-text text-transparent bg-gradient-to-r from-zinc-800 to-zinc-500 dark:from-zinc-100 dark:to-zinc-400">How can I help you today?</h2>
                <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 mb-8">{helperText}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-2xl px-2">
                    <SuggestionCard icon={Icons.Map} text="Places nearby" subtext="Find best Italian restaurants near me" onClick={() => sendMessage("What are the best Italian restaurants nearby?")} />
                    <SuggestionCard icon={Icons.Newspaper} text="What's the latest news?" subtext="Get updates on current events" onClick={() => sendMessage("What's the latest news?")} />
                    <SuggestionCard icon={Icons.Terminal} text="Code a calculator" subtext="Make a calculator in python" onClick={() => sendMessage("Code a calculator in python")} />
                    <SuggestionCard icon={Icons.Sparkles} text="Generate Image" subtext="Visualize ideas with AI" onClick={() => sendMessage("/image A futuristic city with flying cars")} />
                </div>
             </div>
          ) : (
              <>
                {messages.map((msg, index) => (
                    <div key={msg.id || index} className={`flex gap-4 ${msg.role === Role.USER ? 'flex-row-reverse' : 'flex-row'} group animate-fade-in`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === Role.USER ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-purple-600 dark:text-purple-400'}`}>
                            {msg.role === Role.USER ? <Icons.User /> : <Icons.Bot />}
                        </div>
                        <div className={`flex flex-col max-w-[85%] ${msg.role === Role.USER ? 'items-end' : 'items-start'}`}>
                            {msg.role === Role.MODEL && msg.agentName && <AgentBadge name={msg.agentName} />}
                            <div className={`rounded-2xl px-5 py-3.5 shadow-sm transition-all ${msg.role === Role.USER ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-tl-sm'}`}>
                                {msg.image && <img src={msg.image} alt="Uploaded" className="max-w-full h-auto rounded-lg mb-3 border border-white/20" />}
                                {msg.isLoading ? (
                                    <div className="flex items-center space-x-1.5 py-1">
                                        <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"></div>
                                        <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                ) : msg.type === 'image' ? (
                                    <img src={msg.text} alt="AI generated" className="rounded-lg mt-1 max-w-full border border-zinc-200 dark:border-zinc-700" />
                                ) : (
                                    <div className={`prose ${msg.role === Role.USER ? 'prose-invert' : 'dark:prose-invert prose-zinc'} max-w-none text-sm sm:text-base leading-relaxed break-words`} dangerouslySetInnerHTML={renderText(msg.text)} />
                                )}
                            </div>
                            <div className={`flex flex-col gap-2 mt-1 ${msg.role === Role.USER ? 'items-end' : 'items-start'} w-full`}>
                                {msg.sources && msg.sources.length > 0 && (
                                    <div className="flex flex-wrap gap-2 py-1">
                                        {msg.sources.map((source, i) => (
                                            <a key={i} href={source.uri} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/50 text-[10px] text-zinc-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all border border-zinc-200 dark:border-zinc-800 backdrop-blur-sm">
                                                {source.uri.includes('google.com/maps') ? <Icons.Map /> : <Icons.Search />}
                                                <span className="truncate max-w-[150px] font-medium">{source.title}</span>
                                            </a>
                                        ))}
                                    </div>
                                )}
                                {msg.text && !msg.isLoading && (
                                    <div className="flex items-center gap-2">
                                      <CopyButton text={msg.text} />
                                      {msg.role === Role.MODEL && <SpeakerButton text={msg.text} />}
                                      {msg.agentName === 'Coder Agent' && <CopyAgentCodeButton text={msg.text} />}
                                      {msg.type === 'image' && <DownloadButton url={msg.text} />}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} className="h-4" />
              </>
          )}
        </div>
      </main>

      <div className="p-4 shrink-0 bg-transparent">
        <div className="max-w-3xl mx-auto">
          {attachment && (
            <div className="mb-3 mx-4 inline-flex items-center gap-2 bg-white dark:bg-zinc-800 px-3 py-2 rounded-xl text-sm border border-zinc-200 dark:border-zinc-700 shadow-sm animate-fade-in">
                <div className="w-8 h-8 rounded bg-zinc-100 dark:bg-zinc-700 overflow-hidden"><img src={attachment.url} alt="preview" className="w-full h-full object-cover" /></div>
                <span className="text-zinc-600 dark:text-zinc-300 font-medium">Image attached</span>
                <button onClick={() => setAttachment(null)} className="ml-2 p-1 text-zinc-400 hover:text-red-500 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"><Icons.X /></button>
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(input, attachment || undefined); }} className="relative flex items-end gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-2 shadow-lg shadow-zinc-200/50 dark:shadow-black/20 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
             <input type="file" accept="image/*" onChange={handleFileSelect} ref={fileInputRef} className="hidden" />
             <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors shrink-0 mb-[1px]" title="Attach Image"><Icons.Paperclip /></button>
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Message Zephyr..." className="w-full bg-transparent text-zinc-900 dark:text-zinc-100 py-3.5 px-2 focus:outline-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600 min-h-[52px]" />
            <div className="shrink-0 mb-[1px]">
            {input.trim() || attachment ? (
                <button type="submit" disabled={messages.some(m => m.isLoading)} className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed"><Icons.Send /></button>
            ) : (
                <button type="button" onClick={handleMicClick} className={`p-3 rounded-full transition-all ${isRecording ? 'bg-red-500 text-white animate-pulse shadow-lg' : 'text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>{isRecording ? <Icons.MicActive /> : <Icons.Mic />}</button>
            )}
            </div>
          </form>
          <div className="mt-3 text-center text-[10px] text-zinc-400 dark:text-zinc-600">Zephyr powered by Gemini 2.5 Flash. To generate image /image then prompt.</div>
        </div>
      </div>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
}
