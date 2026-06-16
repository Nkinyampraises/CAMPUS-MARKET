import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/app/components/ui/sheet';
import { cn } from '@/app/components/ui/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useHeaderHeight } from '@/hooks/useHeaderHeight';
import { API_URL } from '@/lib/api';
import {
  Bot,
  ChevronDown,
  ImagePlus,
  Loader2,
  Menu,
  Mic,
  MicOff,
  Plus,
  SendHorizontal,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';

type AssistantRecommendation = {
  id: string;
  title: string;
  description?: string;
  price: number;
  category?: string;
  type?: 'sell' | 'rent';
  image?: string;
  location?: string;
  reason?: string;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  images?: string[];
  recommendations?: AssistantRecommendation[];
  nextQuestions?: string[];
  stylePlan?: unknown;
  kitchenList?: unknown;
};

type ChatThread = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
};

type PendingImage = {
  id: string;
  name: string;
  dataUrl: string;
};

type DailyUsage = {
  dayKey?: string;
  limit: number;
  used: number;
  remaining: number;
  timeZone?: string;
};

const GUEST_AI_CHAT_STORAGE_KEY = 'sasha-ai-chat-history-v1';
const GUEST_AI_CHAT_THREADS_STORAGE_KEY = 'sasha-ai-chat-threads-v2';
const GUEST_AI_ID_STORAGE_KEY = 'sasha-ai-guest-id-v1';

// Migrate any data stored under the old "kori" keys so returning users don't lose history.
try {
  const OLD_HISTORY_KEY = 'kori-ai-chat-history-v1';
  const OLD_THREADS_KEY = 'kori-ai-chat-threads-v2';
  const OLD_GUEST_KEY   = 'kori-ai-guest-id-v1';
  if (localStorage.getItem(OLD_HISTORY_KEY) && !localStorage.getItem(GUEST_AI_CHAT_STORAGE_KEY)) {
    localStorage.setItem(GUEST_AI_CHAT_STORAGE_KEY, localStorage.getItem(OLD_HISTORY_KEY)!);
  }
  if (localStorage.getItem(OLD_THREADS_KEY) && !localStorage.getItem(GUEST_AI_CHAT_THREADS_STORAGE_KEY)) {
    localStorage.setItem(GUEST_AI_CHAT_THREADS_STORAGE_KEY, localStorage.getItem(OLD_THREADS_KEY)!);
  }
  if (localStorage.getItem(OLD_GUEST_KEY) && !localStorage.getItem(GUEST_AI_ID_STORAGE_KEY)) {
    localStorage.setItem(GUEST_AI_ID_STORAGE_KEY, localStorage.getItem(OLD_GUEST_KEY)!);
  }
} catch { /* ignore storage errors */ }
const MAX_CHAT_THREADS = 30;

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('fr-CM', {
    style: 'currency',
    currency: 'XAF',
    maximumFractionDigits: 0,
  }).format(amount || 0);

const toIsoNow = () => new Date().toISOString();
const createLocalId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const toUsageInt = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : fallback;
};

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

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
  const dayKey = isNonEmptyString(value.dayKey) ? value.dayKey : undefined;
  const timeZone = isNonEmptyString(value.timeZone) ? value.timeZone : undefined;

  return {
    dayKey,
    limit,
    used,
    remaining,
    timeZone,
  };
};

const getGuestAiId = () => {
  if (typeof window === 'undefined') {
    return 'guest-server';
  }

  const existing = localStorage.getItem(GUEST_AI_ID_STORAGE_KEY);
  if (existing && /^[A-Za-z0-9._:-]{8,120}$/.test(existing)) {
    return existing;
  }

  const generated = createLocalId('guest').replace(/[^A-Za-z0-9._:-]/g, '');
  localStorage.setItem(GUEST_AI_ID_STORAGE_KEY, generated);
  return generated;
};

const toHistoryPayload = (messages: ChatMessage[]) =>
  messages
    .map((entry) => ({
      id: entry.id,
      role: entry.role,
      content: entry.content,
      createdAt: entry.createdAt,
    }))
    .slice(-20);

const parseGuestMessages = (value: string | null): ChatMessage[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => {
        const role = entry?.role === 'assistant' ? 'assistant' : 'user';
        const content = typeof entry?.content === 'string' ? entry.content.trim() : '';
        if (!content) return null;
        return {
          id: typeof entry?.id === 'string' ? entry.id : createLocalId('chat'),
          role,
          content,
          createdAt: typeof entry?.createdAt === 'string' ? entry.createdAt : toIsoNow(),
        } as ChatMessage;
      })
      .filter(Boolean);
  } catch {
    return [];
  }
};

const parseJsonArray = (value: string | null) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const safeDateTime = (value: unknown, fallback = toIsoNow()) => {
  if (typeof value !== 'string') return fallback;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
};

const buildThreadTitleFromMessages = (messages: ChatMessage[], fallback = 'New chat') => {
  const firstUserMessage = messages.find((entry) => entry.role === 'user' && isNonEmptyString(entry.content));
  const source = (firstUserMessage?.content || messages[0]?.content || '').trim();
  if (!source) return fallback;
  return source.length > 60 ? `${source.slice(0, 57)}...` : source;
};

const sortThreadsByUpdatedAt = (threads: ChatThread[]) =>
  [...threads]
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
    .slice(0, MAX_CHAT_THREADS);

const normalizeThreadMessages = (value: unknown): ChatMessage[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const content = isNonEmptyString(entry?.content) ? entry.content.trim() : '';
      if (!content) return null;
      return {
        id: isNonEmptyString(entry?.id) ? entry.id : createLocalId('chat'),
        role: entry?.role === 'assistant' ? 'assistant' : 'user',
        content,
        createdAt: safeDateTime(entry?.createdAt, toIsoNow()),
      } as ChatMessage;
    })
    .filter((entry): entry is ChatMessage => Boolean(entry));
};

const normalizeChatThreads = (value: unknown, fallbackTitle = 'New chat'): ChatThread[] => {
  if (!Array.isArray(value)) return [];
  const deduped = new Map<string, ChatThread>();

  for (const entry of value) {
    const id = isNonEmptyString(entry?.id) ? entry.id : createLocalId('thread');
    const messages = normalizeThreadMessages(entry?.messages);
    const createdAt = safeDateTime(entry?.createdAt, messages[0]?.createdAt || toIsoNow());
    const updatedAt = safeDateTime(entry?.updatedAt, messages[messages.length - 1]?.createdAt || createdAt);
    const title = isNonEmptyString(entry?.title) ? entry.title.trim() : buildThreadTitleFromMessages(messages, fallbackTitle);

    deduped.set(id, {
      id,
      title: title || fallbackTitle,
      createdAt,
      updatedAt,
      messages,
    });
  }

  return sortThreadsByUpdatedAt(Array.from(deduped.values()));
};

const createEmptyThread = (fallbackTitle = 'New chat'): ChatThread => {
  const now = toIsoNow();
  return {
    id: createLocalId('thread'),
    title: fallbackTitle,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
};

const toGuestThreadPayload = (threads: ChatThread[]) =>
  threads.map((thread) => ({
    id: thread.id,
    title: thread.title,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    messages: toHistoryPayload(thread.messages),
  }));

// ── Full-fidelity local persistence (keeps images, recommendations, etc.) ────
const AUTH_CHAT_THREADS_KEY_PREFIX = 'sasha-ai-chat-threads-user-';

const normalizeThreadMessagesFull = (value: unknown): ChatMessage[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const content = isNonEmptyString(entry?.content) ? entry.content.trim() : '';
      if (!content) return null;
      const images = Array.isArray(entry?.images)
        ? entry.images.filter((img: unknown): img is string => typeof img === 'string' && img.length > 0)
        : undefined;
      const recommendations = Array.isArray(entry?.recommendations) ? entry.recommendations : undefined;
      const nextQuestions = Array.isArray(entry?.nextQuestions)
        ? entry.nextQuestions.filter(isNonEmptyString)
        : undefined;
      return {
        id: isNonEmptyString(entry?.id) ? entry.id : createLocalId('chat'),
        role: entry?.role === 'assistant' ? 'assistant' : 'user',
        content,
        createdAt: safeDateTime(entry?.createdAt, toIsoNow()),
        ...(images && images.length ? { images } : {}),
        ...(recommendations && recommendations.length ? { recommendations } : {}),
        ...(nextQuestions && nextQuestions.length ? { nextQuestions } : {}),
        ...(entry?.stylePlan !== undefined ? { stylePlan: entry.stylePlan } : {}),
        ...(entry?.kitchenList !== undefined ? { kitchenList: entry.kitchenList } : {}),
      } as ChatMessage;
    })
    .filter((entry): entry is ChatMessage => Boolean(entry));
};

const normalizeChatThreadsFull = (value: unknown, fallbackTitle = 'New chat'): ChatThread[] => {
  if (!Array.isArray(value)) return [];
  const deduped = new Map<string, ChatThread>();
  for (const entry of value) {
    const id = isNonEmptyString(entry?.id) ? entry.id : createLocalId('thread');
    const messages = normalizeThreadMessagesFull(entry?.messages);
    const createdAt = safeDateTime(entry?.createdAt, messages[0]?.createdAt || toIsoNow());
    const updatedAt = safeDateTime(entry?.updatedAt, messages[messages.length - 1]?.createdAt || createdAt);
    const title = isNonEmptyString(entry?.title) ? entry.title.trim() : buildThreadTitleFromMessages(messages, fallbackTitle);
    deduped.set(id, { id, title: title || fallbackTitle, createdAt, updatedAt, messages });
  }
  return sortThreadsByUpdatedAt(Array.from(deduped.values()));
};

const toFullMessagePayload = (messages: ChatMessage[]) =>
  messages.slice(-40).map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    ...(message.images && message.images.length ? { images: message.images } : {}),
    ...(message.recommendations && message.recommendations.length ? { recommendations: message.recommendations } : {}),
    ...(message.nextQuestions && message.nextQuestions.length ? { nextQuestions: message.nextQuestions } : {}),
  }));

const toFullThreadPayload = (threads: ChatThread[]) =>
  threads.map((thread) => ({
    id: thread.id,
    title: thread.title,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    messages: toFullMessagePayload(thread.messages),
  }));

// Persist the full conversation; if storage is full (base64 images are large),
// retry without image data so text + recommendations are never lost.
const persistThreadsToStorage = (key: string, threads: ChatThread[]) => {
  if (!key) return;
  const full = toFullThreadPayload(threads);
  try {
    localStorage.setItem(key, JSON.stringify(full));
    return;
  } catch {
    /* storage full — fall back to a lighter payload below */
  }
  try {
    const withoutImages = full.map((thread) => ({
      ...thread,
      messages: thread.messages.map(({ images, ...rest }) => rest),
    }));
    localStorage.setItem(key, JSON.stringify(withoutImages));
  } catch {
    /* give up silently — nothing else we can safely do */
  }
};

// Prefer the richer local threads; add any backend-only threads on top.
const mergeAuthThreads = (local: ChatThread[], backend: ChatThread[]): ChatThread[] => {
  if (local.length === 0) return backend;
  const localIds = new Set(local.map((thread) => thread.id));
  const backendOnly = backend.filter((thread) => !localIds.has(thread.id));
  return sortThreadsByUpdatedAt([...local, ...backendOnly]);
};

const formatRecentTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
};

export function AiAssistant() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { isAuthenticated, accessToken, refreshAuthToken, currentUser } = useAuth();

  const defaultThreadTitle = t('assistant.newChat', 'New chat');

  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState('');
  const [draft, setDraft] = useState('');
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [dailyUsage, setDailyUsage] = useState<DailyUsage | null>(null);
  const [isRecentsOpen, setIsRecentsOpen] = useState(true);
  const [isSidebarMenuOpen, setIsSidebarMenuOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) || threads[0] || null,
    [threads, activeThreadId],
  );
  const messages = activeThread?.messages || [];

  // Where the full conversation is cached locally (per user, so accounts don't mix).
  const chatStorageKey = isAuthenticated
    ? currentUser?.id
      ? `${AUTH_CHAT_THREADS_KEY_PREFIX}${currentUser.id}`
      : ''
    : GUEST_AI_CHAT_THREADS_STORAGE_KEY;

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
      // Fallback for older backend deployments that do not allow x-ai-guest-id in CORS preflight.
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

  const createAndActivateThread = () => {
    const thread = createEmptyThread(defaultThreadTitle);
    setThreads((prev) => sortThreadsByUpdatedAt([thread, ...prev]));
    setActiveThreadId(thread.id);
    return thread;
  };

  const upsertThreadMessages = (threadId: string, nextMessages: ChatMessage[]) => {
    const fallbackTitle = defaultThreadTitle;
    setThreads((prev) => {
      const existing = prev.find((thread) => thread.id === threadId);
      if (!existing) return prev;
      const updatedAt = nextMessages[nextMessages.length - 1]?.createdAt || toIsoNow();
      const nextTitle = buildThreadTitleFromMessages(
        nextMessages,
        isNonEmptyString(existing.title) ? existing.title : fallbackTitle,
      );
      return sortThreadsByUpdatedAt(
        prev.map((thread) =>
          thread.id === threadId
            ? {
                ...thread,
                messages: nextMessages,
                updatedAt,
                title: nextTitle || fallbackTitle,
              }
            : thread,
        ),
      );
    });
  };

  const isDailyLimitReached = Boolean(dailyUsage && dailyUsage.remaining <= 0);

  const locationPayload = useMemo(
    () => ({
      country: 'Cameroon',
    }),
    [],
  );

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, pendingImages.length]);

  useEffect(() => {
    const loadHistory = async () => {
      setIsHistoryLoading(true);
      try {
        if (isAuthenticated) {
          const response = await requestWithAuthRetry('/ai-chat/history');
          const data = await response.json().catch(() => ({}));
          const usage = parseDailyUsage(data?.usage);
          if (usage) {
            setDailyUsage(usage);
          }
          const fromConversations = normalizeChatThreads(data?.conversations, defaultThreadTitle);
          const fromLegacyMessages = Array.isArray(data?.messages)
            ? normalizeChatThreads(
                [
                  {
                    id: isNonEmptyString(data?.activeConversationId)
                      ? data.activeConversationId
                      : createLocalId('thread'),
                    title: defaultThreadTitle,
                    messages: data.messages,
                    updatedAt: toIsoNow(),
                    createdAt: toIsoNow(),
                  },
                ],
                defaultThreadTitle,
              )
            : [];

          const backendThreads = fromConversations.length > 0 ? fromConversations : fromLegacyMessages;

          // Restore the full local copy (text + images + recommendations) and
          // prefer it over the backend, which may not return assistant replies.
          const localFull = chatStorageKey
            ? normalizeChatThreadsFull(parseJsonArray(localStorage.getItem(chatStorageKey)), defaultThreadTitle)
            : [];
          const merged = mergeAuthThreads(localFull, backendThreads);
          const nextThreads = merged.length > 0 ? merged : [createEmptyThread(defaultThreadTitle)];

          const requestedActiveId = isNonEmptyString(data?.activeConversationId) ? data.activeConversationId : '';
          const resolvedActiveId =
            nextThreads.find((thread) => thread.id === requestedActiveId)?.id || nextThreads[0].id;

          setThreads(nextThreads);
          setActiveThreadId(resolvedActiveId);
        } else {
          const storedThreads = normalizeChatThreadsFull(
            parseJsonArray(localStorage.getItem(GUEST_AI_CHAT_THREADS_STORAGE_KEY)),
            defaultThreadTitle,
          );
          if (storedThreads.length > 0) {
            setThreads(storedThreads);
            setActiveThreadId(storedThreads[0].id);
            return;
          }

          const legacyMessages = parseGuestMessages(localStorage.getItem(GUEST_AI_CHAT_STORAGE_KEY));
          if (legacyMessages.length > 0) {
            const legacyThread = {
              ...createEmptyThread(defaultThreadTitle),
              title: buildThreadTitleFromMessages(legacyMessages, defaultThreadTitle),
              updatedAt: legacyMessages[legacyMessages.length - 1]?.createdAt || toIsoNow(),
              messages: legacyMessages,
            } satisfies ChatThread;
            setThreads([legacyThread]);
            setActiveThreadId(legacyThread.id);
            return;
          }

          const freshThread = createEmptyThread(defaultThreadTitle);
          setThreads([freshThread]);
          setActiveThreadId(freshThread.id);
        }
      } finally {
        setIsHistoryLoading(false);
      }
    };

    loadHistory();
  }, [isAuthenticated, accessToken, currentUser?.id, defaultThreadTitle, chatStorageKey]);

  useEffect(() => {
    // Don't write until the initial history load has finished — otherwise the
    // empty initial state would overwrite (wipe) the saved cache before it's read.
    if (isHistoryLoading) return;
    // Persist the FULL conversation (text + recommendations + images) for every
    // user so history survives navigation. Backend storage is unchanged.
    persistThreadsToStorage(chatStorageKey, threads);
    if (!isAuthenticated) {
      // Keep the legacy single-history key in sync for the floating launcher.
      try {
        localStorage.setItem(
          GUEST_AI_CHAT_STORAGE_KEY,
          JSON.stringify(toHistoryPayload(activeThread?.messages || [])),
        );
      } catch {
        /* ignore quota errors */
      }
    }
  }, [threads, activeThread, isAuthenticated, chatStorageKey, isHistoryLoading]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const handlePickImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remainingSlots = Math.max(0, 3 - pendingImages.length);
    if (remainingSlots <= 0) {
      toast.error(t('assistant.maxImages', 'You can attach up to 3 images per message.'));
      return;
    }

    const selectedFiles = Array.from(files).slice(0, remainingSlots);
    const nextImages: PendingImage[] = [];

    for (const file of selectedFiles) {
      if (!file.type.startsWith('image/')) {
        toast.error(t('assistant.imageOnly', 'Only image files are allowed.'));
        continue;
      }
      if (file.size > 4 * 1024 * 1024) {
        toast.error(t('assistant.imageLimit', 'Each image must be less than 4MB.'));
        continue;
      }

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read image'));
        reader.readAsDataURL(file);
      }).catch(() => '');

      if (!dataUrl.startsWith('data:image/')) {
        continue;
      }

      nextImages.push({
        id: createLocalId('img'),
        name: file.name,
        dataUrl,
      });
    }

    if (nextImages.length > 0) {
      setPendingImages((prev) => [...prev, ...nextImages].slice(0, 3));
    }
  };

  const clearHistory = async () => {
    const targetThreadId = activeThread?.id;
    if (!targetThreadId) {
      const freshThread = createEmptyThread(defaultThreadTitle);
      setThreads([freshThread]);
      setActiveThreadId(freshThread.id);
      return;
    }

    if (isAuthenticated) {
      const response = await requestWithAuthRetry(
        `/ai-chat/history?conversationId=${encodeURIComponent(targetThreadId)}`,
        { method: 'DELETE' },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        toast.error(data.error || t('assistant.failedClear', 'Failed to clear chat history.'));
        return;
      }

      const data = await response.json().catch(() => ({}));
      const nextThreads = normalizeChatThreads(data?.conversations, defaultThreadTitle);
      if (nextThreads.length > 0) {
        setThreads(nextThreads);
        const nextActiveId = isNonEmptyString(data?.activeConversationId) ? data.activeConversationId : nextThreads[0].id;
        setActiveThreadId(nextActiveId);
      } else {
        const freshThread = createEmptyThread(defaultThreadTitle);
        setThreads([freshThread]);
        setActiveThreadId(freshThread.id);
      }
    } else {
      const remainingThreads = threads.filter((thread) => thread.id !== targetThreadId);
      if (remainingThreads.length > 0) {
        const sortedThreads = sortThreadsByUpdatedAt(remainingThreads);
        setThreads(sortedThreads);
        setActiveThreadId(sortedThreads[0].id);
      } else {
        const freshThread = createEmptyThread(defaultThreadTitle);
        setThreads([freshThread]);
        setActiveThreadId(freshThread.id);
      }
    }

    setDraft('');
    setPendingImages([]);
    toast.success(t('assistant.cleared', 'Chat cleared.'));
  };

  const trackRecommendationEvent = async (
    itemId: string,
    eventType: 'recommendation_click' | 'recommendation_accept' = 'recommendation_click',
    source = 'assistant',
  ) => {
    if (!isAuthenticated || !itemId) return;
    await requestWithAuthRetry('/ai-chat/analytics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventType,
        itemId,
        metadata: {
          source,
          at: new Date().toISOString(),
        },
      }),
    }).catch(() => {});
  };

  const sendMessage = async () => {
    if (isSending) return;
    if (isDailyLimitReached) {
      toast.error('Daily AI limit reached. Please try again tomorrow.');
      return;
    }

    const text = draft.trim();
    const hasImages = pendingImages.length > 0;
    if (!text && !hasImages) return;

    const ensuredThread = activeThread || createAndActivateThread();
    const threadId = ensuredThread.id;
    const existingMessages = ensuredThread.messages || [];

    const userMessage: ChatMessage = {
      id: createLocalId('chat'),
      role: 'user',
      content: text || t('assistant.imageMessage', 'Please analyze the attached image(s).'),
      createdAt: toIsoNow(),
      images: pendingImages.map((entry) => entry.dataUrl),
    };

    const historyForPayload = [...existingMessages, userMessage];
    upsertThreadMessages(threadId, historyForPayload);
    setDraft('');
    const imagePayload = pendingImages.map((entry) => entry.dataUrl);
    setPendingImages([]);
    setIsSending(true);

    try {
      const response = await requestWithAuthRetry('/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          images: imagePayload,
          location: locationPayload,
          conversationId: threadId,
          conversationTitle: buildThreadTitleFromMessages(historyForPayload, defaultThreadTitle),
          clientHistory: !isAuthenticated ? toHistoryPayload(historyForPayload) : undefined,
        }),
      });

      const data = await response.json().catch(() => ({}));
      const usage = parseDailyUsage(data?.usage);
      if (usage) {
        setDailyUsage(usage);
      }
      if (!response.ok) {
        throw new Error(data.error || t('assistant.failedReply', 'Failed to get AI response.'));
      }

      const assistantMessage: ChatMessage = {
        id: createLocalId('chat'),
        role: 'assistant',
        content:
          (isNonEmptyString(data.assistantMessage) && data.assistantMessage.trim()) ||
          t('assistant.defaultReply', 'Here are some options I found for you.'),
        createdAt: toIsoNow(),
        recommendations: Array.isArray(data.recommendedItems) ? data.recommendedItems : [],
        nextQuestions: Array.isArray(data.nextQuestions) ? data.nextQuestions.filter(isNonEmptyString) : [],
        stylePlan: data.stylePlan,
        kitchenList: data.kitchenList,
      };

      upsertThreadMessages(threadId, [...historyForPayload, assistantMessage]);
    } catch (error) {
      const message = error instanceof Error ? error.message : t('assistant.failedReply', 'Failed to get AI response.');
      toast.error(message);
      upsertThreadMessages(threadId, [
        ...historyForPayload,
        {
          id: createLocalId('chat'),
          role: 'assistant',
          content:
            message ||
            t(
              'assistant.retryReply',
              'I could not process that request right now. Please try again in a moment.',
            ),
          createdAt: toIsoNow(),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error(t('assistant.voiceUnsupported', 'Voice recording is not supported on this device.'));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        setIsRecording(false);

        if (!audioBlob.size) {
          return;
        }

        setIsTranscribing(true);
        try {
          const formData = new FormData();
          formData.append('audio', audioBlob, 'sasha-voice.webm');

          const response = await requestWithAuthRetry('/ai-chat/transcribe', {
            method: 'POST',
            body: formData,
          });
          const data = await response.json().catch(() => ({}));

          if (!response.ok) {
            throw new Error(data.error || t('assistant.transcribeFailed', 'Failed to transcribe audio.'));
          }

          const transcript = isNonEmptyString(data?.text) ? data.text.trim() : '';
          if (!transcript) {
            toast.error(t('assistant.emptyTranscript', 'No voice text was detected. Try again.'));
            return;
          }

          setDraft((prev) => (prev ? `${prev} ${transcript}` : transcript));
          toast.success(t('assistant.voiceReady', 'Voice recognized. You can send now.'));
        } catch (error) {
          const message = error instanceof Error ? error.message : t('assistant.transcribeFailed', 'Failed to transcribe audio.');
          toast.error(message);
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      toast.error(t('assistant.voicePermission', 'Microphone permission is required for voice input.'));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const startNewChat = () => {
    const newThread = createEmptyThread(defaultThreadTitle);
    setThreads((prev) => sortThreadsByUpdatedAt([newThread, ...prev]));
    setActiveThreadId(newThread.id);
    setDraft('');
    setPendingImages([]);
  };

  const headerHeight = useHeaderHeight();

  const suggestions = [
    t('assistant.suggest1', 'Decorate my room under 150,000 XAF'),
    t('assistant.suggest2', 'Build a student kitchen essentials list'),
    t('assistant.suggest3', 'Find a cheap laptop for engineering'),
    t('assistant.suggest4', 'Affordable furniture near campus'),
  ];

  const renderThreads = (onPick?: () => void) =>
    threads.length > 0 ? (
      <div className="space-y-0.5">
        {threads.map((thread) => (
          <button
            key={thread.id}
            type="button"
            onClick={() => {
              setActiveThreadId(thread.id);
              onPick?.();
            }}
            className={cn(
              'flex w-full flex-col rounded-lg px-3 py-2 text-left transition-colors',
              activeThread?.id === thread.id
                ? 'bg-accent text-accent-foreground'
                : 'text-foreground hover:bg-secondary',
            )}
          >
            <span className="truncate text-sm font-medium">{thread.title || t('assistant.newChat', 'New chat')}</span>
            <span className="mt-0.5 text-[11px] text-muted-foreground">{formatRecentTimestamp(thread.updatedAt)}</span>
          </button>
        ))}
      </div>
    ) : (
      <p className="px-3 py-2 text-xs text-muted-foreground">{t('assistant.noRecents', 'No recent chats yet.')}</p>
    );

  const composer = (
    <div className="space-y-2">
      {pendingImages.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pendingImages.map((image) => (
            <div key={image.id} className="group relative">
              <img src={image.dataUrl} alt={image.name} className="h-16 w-16 rounded-lg border border-border object-cover" />
              <button
                type="button"
                aria-label="Remove image"
                className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-[11px] text-background opacity-0 transition-opacity group-hover:opacity-100"
                onClick={() => setPendingImages((prev) => prev.filter((entry) => entry.id !== image.id))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-3xl border border-border bg-card p-2 shadow-card transition-shadow focus-within:shadow-elevated">
        <input
          ref={fileInputRef}
          type="file"
          title="Upload image"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            void handlePickImages(event.target.files);
            event.target.value = '';
          }}
        />
        <Input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t('assistant.placeholder', 'Ask Sasha anything — products, advice, tech, or any question...')}
          className="h-11 border-0 bg-transparent px-3 text-sm shadow-none focus-visible:ring-0"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void sendMessage();
            }
          }}
        />
        <div className="flex items-center justify-between px-1 pt-1">
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-muted-foreground hover:text-primary"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending || isDailyLimitReached}
              aria-label={t('assistant.attachImage', 'Attach image')}
            >
              <ImagePlus className="h-[18px] w-[18px]" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn('h-9 w-9 rounded-full', isRecording ? 'text-destructive' : 'text-muted-foreground hover:text-primary')}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isTranscribing || isSending || isDailyLimitReached}
              aria-label={isRecording ? 'Stop recording' : 'Start recording'}
            >
              {isRecording ? <MicOff className="h-[18px] w-[18px]" /> : <Mic className="h-[18px] w-[18px]" />}
            </Button>
          </div>
          <Button
            type="button"
            size="icon"
            className="h-9 w-9 rounded-full bg-primary text-primary-foreground hover:bg-primary-strong"
            onClick={() => void sendMessage()}
            disabled={isSending || isTranscribing || isDailyLimitReached}
            aria-label={t('assistant.send', 'Send')}
          >
            {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {(dailyUsage || isTranscribing) && (
        <div className="px-2 text-center text-[11px] text-muted-foreground">
          {isTranscribing && (
            <span className="mr-2 inline-flex items-center">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              {t('assistant.transcribing', 'Transcribing voice...')}
            </span>
          )}
          {dailyUsage &&
            (dailyUsage.remaining > 0
              ? `${dailyUsage.remaining}/${dailyUsage.limit} ${t('assistant.requestsLeft', 'AI requests left today')}`
              : `${t('assistant.limitReached', 'Daily AI limit reached')} (${dailyUsage.limit}/${dailyUsage.limit})`)}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex bg-background" style={{ height: `calc(100vh - ${headerHeight}px)` }}>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-card lg:flex">
        <div className="p-3">
          <Button
            type="button"
            className="w-full justify-start gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary-strong"
            onClick={startNewChat}
          >
            <Plus className="h-4 w-4" />
            {t('assistant.newChat', 'New chat')}
          </Button>
        </div>
        <div className="flex items-center justify-between px-4 pb-1 pt-2">
          <button
            type="button"
            className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-muted-foreground"
            onClick={() => setIsRecentsOpen((prev) => !prev)}
          >
            {t('assistant.recents', 'Recents')}
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', isRecentsOpen ? 'rotate-0' : '-rotate-90')} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3">{isRecentsOpen && renderThreads()}</div>
        <div className="border-t border-border p-3">
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-primary"
            onClick={() => navigate('/marketplace')}
          >
            {t('assistant.backMarketplace', 'Back to marketplace')}
          </Button>
        </div>
      </aside>

      {/* ── Mobile sidebar sheet ── */}
      <Sheet open={isSidebarMenuOpen} onOpenChange={setIsSidebarMenuOpen}>
        <SheetContent side="left" className="w-[86vw] max-w-xs border-r border-border bg-card p-0 sm:max-w-xs lg:hidden">
          <SheetHeader className="sr-only p-0">
            <SheetTitle>{t('assistant.chatsMenu', 'Chats menu')}</SheetTitle>
          </SheetHeader>
          <div className="p-3">
            <Button
              type="button"
              className="w-full justify-start gap-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary-strong"
              onClick={() => {
                startNewChat();
                setIsSidebarMenuOpen(false);
              }}
            >
              <Plus className="h-4 w-4" />
              {t('assistant.newChat', 'New chat')}
            </Button>
          </div>
          <div className="px-4 pb-1 pt-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {t('assistant.recents', 'Recents')}
            </span>
          </div>
          <div className="overflow-y-auto px-2 pb-3">{renderThreads(() => setIsSidebarMenuOpen(false))}</div>
        </SheetContent>
      </Sheet>

      {/* ── Main column ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="rounded-full lg:hidden"
              onClick={() => setIsSidebarMenuOpen(true)}
              aria-label={t('assistant.openChatsMenu', 'Open chats menu')}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Bot className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">{activeThread?.title || t('ui.sasha', 'Sasha')}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {t('assistant.titleSub', 'Your campus shopping assistant')}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-destructive"
            onClick={clearHistory}
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden sm:inline">{t('assistant.clearCurrent', 'Clear chat')}</span>
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-6">
            {isHistoryLoading ? (
              <div className="flex h-[40vh] items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('assistant.loading', 'Loading chat history...')}
              </div>
            ) : messages.length > 0 ? (
              <div className="space-y-6">
                {messages.map((message) =>
                  message.role === 'user' ? (
                    <div key={message.id} className="flex justify-end">
                      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary-soft px-4 py-3 text-foreground">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                        {Array.isArray(message.images) && message.images.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {message.images.map((image, index) => (
                              <img
                                key={`${message.id}-img-${index}`}
                                src={image}
                                alt="Uploaded context"
                                className="h-20 w-20 rounded-lg border border-border object-cover"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div key={message.id} className="flex gap-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Bot className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1 space-y-3">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{message.content}</p>

                        {Array.isArray(message.recommendations) && message.recommendations.length > 0 && (
                          <div className="grid gap-3 sm:grid-cols-2">
                            {message.recommendations.slice(0, 4).map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  void trackRecommendationEvent(item.id, 'recommendation_click', 'chat-bubble');
                                  navigate(`/item/${item.id}`);
                                }}
                                className="flex gap-3 rounded-xl border border-border bg-card p-2.5 text-left transition-all hover:border-primary/30 hover:shadow-card"
                              >
                                {item.image ? (
                                  <img src={item.image} alt={item.title} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
                                ) : null}
                                <span className="min-w-0 flex-1">
                                  <span className="line-clamp-1 block text-xs font-semibold text-foreground">{item.title}</span>
                                  <span className="mt-0.5 block text-sm font-bold text-primary">{formatCurrency(item.price)}</span>
                                  {isNonEmptyString(item.reason) ? (
                                    <span className="mt-0.5 line-clamp-1 block text-[11px] text-muted-foreground">{item.reason}</span>
                                  ) : null}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}

                        {Array.isArray(message.nextQuestions) && message.nextQuestions.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {message.nextQuestions.map((question, index) => (
                              <button
                                key={`${message.id}-q-${index}`}
                                type="button"
                                onClick={() => setDraft(question)}
                                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary hover:bg-primary-soft hover:text-primary"
                              >
                                {question}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ),
                )}
                <div ref={chatBottomRef} />
              </div>
            ) : (
              <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
                <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-elevated">
                  <Bot className="h-7 w-7" />
                </span>
                <h2 className="text-2xl font-bold text-foreground">{t('assistant.greeting', "Hi, I'm Sasha 👋")}</h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  {t(
                    'assistant.subtitle',
                    'Ask me to find products, plan your room, or build a kitchen list — anything for campus life.',
                  )}
                </p>
                <div className="mt-6 grid w-full max-w-lg gap-2 sm:grid-cols-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setDraft(s)}
                      className="rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-foreground transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-border bg-background">
          <div className="mx-auto max-w-3xl px-4 py-3">{composer}</div>
        </div>
      </div>
    </div>
  );
}
