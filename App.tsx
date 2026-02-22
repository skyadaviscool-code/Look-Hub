import React, { useState, useRef, useEffect } from 'react';
import Header from './components/Header';
import SearchInput from './components/SearchInput';
import ChatMessageBubble from './components/ResultDisplay';
import Sidebar from './components/Sidebar';
import SettingsModal from './components/SettingsModal';
import AuthModal from './components/AuthModal';
import { sendChatMessage } from './services/aiService';
import { getUserSession, saveUserSession, clearUserSession } from './services/authService';
import { ChatMessage, AISettings, DEFAULT_SETTINGS, User } from './types';

const CATEGORY_CHIPS = ['All', 'Grants', 'Hackathons', 'Accelerators', 'Pitch Contests', 'VC Funding', 'Fellowships'];

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [user, setUser] = useState<User | null>(() => getUserSession());
  const [activeCategory, setActiveCategory] = useState('Home');
  const [settings, setSettings] = useState<AISettings>(() => {
    // FORCE CLEAR stale settings on every load
    const saved = localStorage.getItem('ai_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // If the saved settings use a dead model, force reset to defaults
        if (parsed.model?.includes('gemini-2.0-flash-exp') ||
          (parsed.provider === 'openrouter' && !parsed.openrouterKey)) {
          localStorage.setItem('ai_settings', JSON.stringify(DEFAULT_SETTINGS));
          return DEFAULT_SETTINGS;
        }
        return parsed;
      } catch {
        return DEFAULT_SETTINGS;
      }
    }
    return DEFAULT_SETTINGS;
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSaveSettings = (newSettings: AISettings) => {
    setSettings(newSettings);
    localStorage.setItem('ai_settings', JSON.stringify(newSettings));
  };

  const handleHomeClick = () => {
    setMessages([]);
    setActiveCategory('Home');
  };

  const handleAuthSuccess = (email: string) => {
    const newUser = { email, isVerified: true };
    setUser(newUser);
    saveUserSession(email);
  };

  const handleLogout = () => {
    setUser(null);
    clearUserSession();
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;

    // Always ensure OpenRouter has the community key
    let activeSettings = { ...settings };
    if (activeSettings.provider === 'openrouter') {
      if (!activeSettings.openrouterKey) {
        activeSettings.openrouterKey = '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';
      }
      if (!activeSettings.model || activeSettings.model.includes('gemini') || !activeSettings.model.includes('/')) {
        activeSettings.model = 'arcee-ai/trinity-large-preview:free';
      }
      setSettings(activeSettings);
      localStorage.setItem('ai_settings', JSON.stringify(activeSettings));
    }

    // Determine category from query
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('grant')) setActiveCategory('Grants');
    else if (lowerQuery.includes('hackathon')) setActiveCategory('Hackathons');
    else if (lowerQuery.includes('accelerator')) setActiveCategory('Accelerators');
    else if (lowerQuery.includes('pitch') || lowerQuery.includes('contest')) setActiveCategory('Pitch Contests');
    else if (lowerQuery.includes('fellowship')) setActiveCategory('Fellowships');

    // Detect if this is a research query
    const researchKeywords = ["find", "search", "grants", "hackathons", "discoveries", "funding", "accelerators", "fellowships", "pitch contests", "apply", "open", "scout", "list"];
    const isResearchQuery = researchKeywords.some(keyword => lowerQuery.includes(keyword)) || query.length > 50;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: query
    };

    const placeholderAiMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: '',
      isTyping: true,
      isResearching: isResearchQuery
    };

    const newMessages = [...messages, userMsg];
    setMessages([...newMessages, placeholderAiMsg]);
    setLoading(true);

    try {
      const data = await sendChatMessage(query, activeSettings, newMessages);
      setMessages(prev => prev.map(msg =>
        msg.id === placeholderAiMsg.id
          ? {
            ...msg,
            text: data.text,
            discoveries: data.discoveries,
            sources: data.sources,
            isTyping: false
          }
          : msg
      ));
    } catch (err: any) {
      console.error(err);
      setMessages(prev => prev.map(msg =>
        msg.id === placeholderAiMsg.id
          ? { ...msg, text: `⚠️ Error: ${err.message || "Something went wrong. Please try again."}`, isTyping: false }
          : msg
      ));
    } finally {
      setLoading(false);
    }
  };

  const isChatActive = messages.length > 0;

  return (
    <div className="flex flex-col h-screen bg-white text-slate-900 font-sans overflow-hidden">
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveSettings}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      <Header
        onHomeClick={handleHomeClick}
        onSettingsClick={() => setIsSettingsOpen(true)}
        onLoginClick={() => setIsAuthOpen(true)}
        user={user}
      />

      <div className="flex flex-1 pt-14 overflow-hidden">
        <Sidebar
          onCategorySelect={handleSearch}
          onHomeClick={handleHomeClick}
          onSettingsClick={() => setIsSettingsOpen(true)}
          onLoginClick={() => setIsAuthOpen(true)}
          onLogoutClick={handleLogout}
          activeCategory={activeCategory}
          user={user}
        />

        <main className="flex-1 flex flex-col min-w-0 bg-surface relative overflow-hidden">
          {/* Category Bar */}
          <div className="sticky top-0 z-30 bg-white border-b border-border py-2.5 px-6">
            <div className="flex space-x-2 overflow-x-auto no-scrollbar scroll-smooth">
              {CATEGORY_CHIPS.map(chip => (
                <button
                  key={chip}
                  onClick={() => {
                    setActiveCategory(chip);
                    handleSearch(chip === 'All' ? 'Find the best grants, hackathons, and startup funding discoveries currently open' : `Find ${chip.toLowerCase()} discoveries currently accepting applications`);
                  }}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${activeCategory === chip
                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                    : 'bg-surface border border-border text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scroll-smooth">
            {!isChatActive ? (
              <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 space-y-8">
                <div
                  className="relative w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl"
                  style={{
                    backgroundImage: 'url(/Gemini_Generated_Image_5gxcas5gxcas5gxc.png)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    minHeight: '30px',
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60"></div>
                  <div className="relative z-10 flex flex-col items-center justify-end h-full min-h-[340px] p-8 text-center">
                    <p className="text-white/90 font-medium text-sm max-w-md mx-auto drop-shadow-lg">
                      Look Hub searches the web in real-time to find grants, hackathons, accelerators, and startup discoveries that are open right now.
                    </p>
                  </div>
                </div>
                <SearchInput onSearch={handleSearch} isLoading={loading} isChatActive={false} />
              </div>
            ) : (
              <div className="w-full max-w-[1200px] mx-auto px-6 py-6">
                {messages.map((msg) => (
                  <ChatMessageBubble key={msg.id} message={msg} />
                ))}
                <div ref={messagesEndRef} className="h-24" />
              </div>
            )}
          </div>

          {isChatActive && (
            <div className="sticky bottom-0 bg-gradient-to-t from-surface via-surface to-transparent pt-6 pb-3 px-6">
              <SearchInput onSearch={handleSearch} isLoading={loading} isChatActive={true} />
              <button
                onClick={handleHomeClick}
                className="mx-auto block mt-3 text-xs font-medium text-muted hover:text-primary transition-colors"
              >
                ← Back to Home
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;