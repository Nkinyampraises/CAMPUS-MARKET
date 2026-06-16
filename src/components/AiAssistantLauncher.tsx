import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Bot, Loader2, MessageCircle, SendHorizontal, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { API_URL } from '@/lib/api';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';

const HIDDEN_ROUTES = new Set([
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/confirm-email',
  '/ai-assistant',
]);

type MiniMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

type DailyUsage = {
  limit: number;
  used: number;
  remaining: number;
};

const MINI_CHAT_STORAGE_KEY = 'sasha-mini-chat-v1';
const GUEST_AI_ID_STORAGE_KEY = 'sasha-ai-guest-id-v1';

// Migrate any data stored under the old "kori" keys so returning users don't lose history.
try {
  const OLD_MINI_KEY  = 'kori-mini-chat-v1';
  const OLD_GUEST_KEY = 'kori-ai-guest-id-v1';
  if (localStorage.getItem(OLD_MINI_KEY) && !localStorage.getItem(MINI_CHAT_STORAGE_KEY)) {
    localStorage.setItem(MINI_CHAT_STORAGE_KEY, localStorage.getItem(OLD_MINI_KEY)!);
  }
  if (localStorage.getItem(OLD_GUEST_KEY) && !localStorage.getItem(GUEST_AI_ID_STORAGE_KEY)) {
    localStorage.setItem(GUEST_AI_ID_STORAGE_KEY, localStorage.getItem(OLD_GUEST_KEY)!);
  }
} catch { /* ignore storage errors */ }

const createId = () => `mini-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const toUsageInt = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback;
};
const parseDailyUsage = (value: any): DailyUsage | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const limit = toUsageInt(value.limit, 0);
  if (limit <= 0) {
    return null;
  }
  const used = Math.min(limit, toUsageInt(value.used, 0));
  const remaining = Math.min(limit, toUsageInt(value.remaining, Math.max(0, limit - used)));
  return { limit, used, remaining };
};
const getGuestAiId = () => {
  if (typeof window === 'undefined') {
    return 'guest-server';
  }

  const existing = localStorage.getItem(GUEST_AI_ID_STORAGE_KEY);
  if (existing && /^[A-Za-z0-9._:-]{8,120}$/.test(existing)) {
    return existing;
  }

  const generated = createId().replace(/[^A-Za-z0-9._:-]/g, '');
  localStorage.setItem(GUEST_AI_ID_STORAGE_KEY, generated);
  return generated;
};

const parseMessages = (value: string | null) => {
  if (!value) return [] as MiniMessage[];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [] as MiniMessage[];
    return parsed
      .map((entry) => {
        const role = entry?.role === 'assistant' ? 'assistant' : 'user';
        const content = typeof entry?.content === 'string' ? entry.content.trim() : '';
        if (!content) return null;
        return {
          id: typeof entry?.id === 'string' ? entry.id : createId(),
          role,
          content,
          createdAt: typeof entry?.createdAt === 'string' ? entry.createdAt : new Date().toISOString(),
        } as MiniMessage;
      })
      .filter(Boolean);
  } catch {
    return [] as MiniMessage[];
  }
};

export function AiAssistantLauncher() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, accessToken, refreshAuthToken } = useAuth();
  const { t } = useLanguage();
  const isHiddenRoute = HIDDEN_ROUTES.has(location.pathname);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<MiniMessage[]>([]);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage | null>(null);

  const requestWithAuthRetry = async (path: string, init?: RequestInit) => {
    const token =
      accessToken || localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    const guestId = getGuestAiId();

    const makeRequest = (authToken?: string, includeGuestHeader = true) =>
      fetch(`${API_URL}${path}`, {
        ...init,
        headers: {
          ...(init?.headers || {}),
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          ...(!authToken && includeGuestHeader ? { 'x-ai-guest-id': guestId } : {}),
        },
      });

    let response: Response;
    try {
      response = await makeRequest(token || undefined, true);
    } catch (error) {
      // Fallback for backend builds that do not yet allow x-ai-guest-id in CORS.
      if (!token) {
        response = await makeRequest(undefined, false);
      } else {
        throw error;
      }
    }
    if (response.status === 401 && token) {
      const refreshed = await refreshAuthToken();
      if (refreshed) {
        response = await makeRequest(refreshed, false);
      }
    }
    return response;
  };
  const isDailyLimitReached = Boolean(dailyUsage && dailyUsage.remaining <= 0);

  useEffect(() => {
    if (isHiddenRoute) return;
    if (!isOpen) return;

    const loadHistory = async () => {
      if (isAuthenticated) {
        setIsLoadingHistory(true);
        try {
          const response = await requestWithAuthRetry('/ai-chat/history');
          const data = await response.json().catch(() => ({}));
          const usage = parseDailyUsage(data?.usage);
          if (usage) {
            setDailyUsage(usage);
          }
          if (response.ok && Array.isArray(data.messages)) {
            const mapped = data.messages
              .map((entry: any) => {
                const content = typeof entry?.content === 'string' ? entry.content.trim() : '';
                if (!content) return null;
                return {
                  id: typeof entry?.id === 'string' ? entry.id : createId(),
                  role: entry?.role === 'assistant' ? 'assistant' : 'user',
                  content,
                  createdAt: typeof entry?.createdAt === 'string' ? entry.createdAt : new Date().toISOString(),
                } as MiniMessage;
              })
              .filter(Boolean);
            setMessages(mapped.slice(-8));
            return;
          }
        } finally {
          setIsLoadingHistory(false);
        }
      }

      setMessages(parseMessages(localStorage.getItem(MINI_CHAT_STORAGE_KEY)).slice(-8));
    };

    void loadHistory();
  }, [isOpen, isAuthenticated, accessToken, isHiddenRoute]);

  useEffect(() => {
    if (isHiddenRoute) return;
    if (isAuthenticated) return;
    localStorage.setItem(MINI_CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-12)));
  }, [messages, isAuthenticated, isHiddenRoute]);

  const sendQuickMessage = async () => {
    if (isSending) return;
    if (isDailyLimitReached) return;
    const text = draft.trim();
    if (!text) return;

    const userMessage: MiniMessage = {
      id: createId(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    const nextHistory = [...messages, userMessage].slice(-12);

    setMessages(nextHistory);
    setDraft('');
    setIsSending(true);

    try {
      const response = await requestWithAuthRetry('/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: text,
          clientHistory: !isAuthenticated ? nextHistory : undefined,
          location: {
            country: 'Cameroon',
          },
        }),
      });

      const data = await response.json().catch(() => ({}));
      const usage = parseDailyUsage(data?.usage);
      if (usage) {
        setDailyUsage(usage);
      }
      if (!response.ok) {
        throw new Error(data.error || 'Failed to contact assistant');
      }

      const reply =
        typeof data?.assistantMessage === 'string' && data.assistantMessage.trim()
          ? data.assistantMessage.trim()
          : "I'm Sasha! I can help with products, advice, science, tech, or any question you have.";

      setMessages((prev) =>
        [
          ...prev,
          {
            id: createId(),
            role: 'assistant',
            content: reply,
            createdAt: new Date().toISOString(),
          },
        ].slice(-12),
      );
    } catch (error) {
      const fallbackMessage =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : 'I could not respond right now. Open the full assistant for advanced chat.';
      setMessages((prev) =>
        [
          ...prev,
          {
            id: createId(),
            role: 'assistant',
            content: fallbackMessage,
            createdAt: new Date().toISOString(),
          },
        ].slice(-12),
      );
    } finally {
      setIsSending(false);
    }
  };

  if (isHiddenRoute) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-5 z-40">
      {isOpen && (
        <div className="mb-3 w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card p-3 shadow-modal">
          <div className="mb-2 flex items-center justify-between">
            <p className="inline-flex items-center gap-1 text-sm font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              {t('assistant.quickChat', 'Quick chat with Sasha')}
            </p>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setIsOpen(false)}
            >
              {t('assistant.close', 'Close')}
            </button>
          </div>

          <div className="mb-2 max-h-56 space-y-2 overflow-y-auto rounded-xl bg-muted/40 p-2.5">
            {isLoadingHistory ? (
              <p className="inline-flex items-center text-xs text-muted-foreground">
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                {t('assistant.loading', 'Loading chat history...')}
              </p>
            ) : messages.length > 0 ? (
              messages.slice(-6).map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                      message.role === 'user'
                        ? 'rounded-br-md bg-primary-soft text-foreground'
                        : 'rounded-bl-md border border-border bg-card text-foreground'
                    }`}
                  >
                    {message.content}
                  </div>
                </div>
              ))
            ) : (
              <p className="px-1 py-2 text-xs text-muted-foreground">
                {t('assistant.quickEmpty', 'Ask me anything — products, advice, science, tech, or anything else!')}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={t('assistant.quickPlaceholder', 'Ask Sasha anything...')}
              className="h-9 rounded-full border-border bg-input focus-visible:ring-ring"
              disabled={isDailyLimitReached}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void sendQuickMessage();
                }
              }}
            />
            <Button
              type="button"
              size="icon"
              onClick={() => void sendQuickMessage()}
              disabled={isSending || isDailyLimitReached}
              className="h-9 w-9 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary-strong"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
            </Button>
          </div>

          {dailyUsage && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {dailyUsage.remaining > 0
                ? `AI requests left today: ${dailyUsage.remaining}/${dailyUsage.limit}`
                : `Daily AI request limit reached (${dailyUsage.limit}/${dailyUsage.limit}).`}
            </p>
          )}

          <div className="mt-2 flex items-center justify-between">
            <button
              type="button"
              className="text-xs font-medium text-primary hover:text-primary-strong"
              onClick={() => navigate('/ai-assistant')}
            >
              {t('assistant.openFull', 'Open full assistant')}
            </button>
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              <MessageCircle className="h-3 w-3" />
              {t('assistant.quickMode', 'Quick mode')}
            </span>
          </div>
        </div>
      )}

      <div className="group flex flex-col items-center">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="rounded-full border border-border bg-card px-4 py-1.5 text-base font-semibold text-foreground shadow-card transition-transform duration-200 hover:-translate-y-0.5"
          aria-label={t('assistant.launchQuick', 'Toggle Sasha quick chat')}
        >
          {t('assistant.launchLabel', "Hi! I'm Sasha")}
        </button>
        <button
          type="button"
          onClick={() => navigate('/ai-assistant')}
          className="mt-2 inline-flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-elevated transition-transform hover:-translate-y-0.5 hover:bg-primary-strong"
          aria-label={t('assistant.launch', 'Open Sasha AI assistant')}
        >
          <Bot className="h-10 w-10" />
        </button>
      </div>
    </div>
  );
}
