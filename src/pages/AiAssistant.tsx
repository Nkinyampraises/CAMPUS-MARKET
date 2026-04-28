import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/app/components/ui/card';
import { Input } from '@/app/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/app/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
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

const GUEST_AI_CHAT_STORAGE_KEY = 'kori-ai-chat-history-v1';
const GUEST_AI_CHAT_THREADS_STORAGE_KEY = 'kori-ai-chat-threads-v2';
const GUEST_AI_ID_STORAGE_KEY = 'kori-ai-guest-id-v1';
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

          const nextThreads =
            fromConversations.length > 0
              ? fromConversations
              : fromLegacyMessages.length > 0
                ? fromLegacyMessages
                : [createEmptyThread(defaultThreadTitle)];

          const requestedActiveId = isNonEmptyString(data?.activeConversationId) ? data.activeConversationId : '';
          const resolvedActiveId =
            nextThreads.find((thread) => thread.id === requestedActiveId)?.id || nextThreads[0].id;

          setThreads(nextThreads);
          setActiveThreadId(resolvedActiveId);
        } else {
          const storedThreads = normalizeChatThreads(
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
  }, [isAuthenticated, accessToken, currentUser?.id, defaultThreadTitle]);

  useEffect(() => {
    if (isAuthenticated) return;
    localStorage.setItem(
      GUEST_AI_CHAT_THREADS_STORAGE_KEY,
      JSON.stringify(toGuestThreadPayload(threads)),
    );
    localStorage.setItem(
      GUEST_AI_CHAT_STORAGE_KEY,
      JSON.stringify(toHistoryPayload(activeThread?.messages || [])),
    );
  }, [threads, activeThread, isAuthenticated]);

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
          formData.append('audio', audioBlob, 'kori-voice.webm');

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

  return (
    <div className="min-h-screen bg-[#f8f4f2] py-8">
      <div className="mx-auto max-w-7xl px-4 lg:px-6">
        <section className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-[#1f1f1f]">{t('assistant.title', 'Kori AI Assistant')}</h1>
            <p className="mt-2 text-sm text-[#6a6a6a]">
              {t(
                'assistant.subtitle',
                'Chat with AI to discover products, room arrangement ideas, and kitchen essentials.',
              )}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 w-10 rounded-full border-[#e6e0dc] p-0 text-[#5a5a5a] hover:bg-[#f4efec] lg:hidden"
              onClick={() => setIsSidebarMenuOpen(true)}
              aria-label={t('assistant.openChatsMenu', 'Open chats menu')}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              className="rounded-full border-[#e6e0dc] text-[#5a5a5a] hover:bg-[#f4efec]"
              onClick={clearHistory}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {t('assistant.clearCurrent', 'Clear current chat')}
            </Button>
            <Button
              className="rounded-full bg-[#1e7b5a] text-white hover:bg-[#166146]"
              onClick={() => navigate('/marketplace')}
            >
              {t('assistant.backMarketplace', 'Back to marketplace')}
            </Button>
          </div>
        </section>

        <Sheet open={isSidebarMenuOpen} onOpenChange={setIsSidebarMenuOpen}>
          <SheetContent
            side="left"
            className="w-[88vw] max-w-sm border-r border-[#ece4df] bg-[#f8f4f2] p-4 sm:max-w-sm lg:hidden"
          >
            <SheetHeader className="sr-only p-0">
              <SheetTitle>{t('assistant.chatsMenu', 'Chats menu')}</SheetTitle>
            </SheetHeader>
            <Card className="h-fit rounded-3xl border border-[#ece4df] bg-white shadow-sm">
              <CardHeader className="space-y-4 border-b border-[#f1ebe7]">
                <Button
                  type="button"
                  className="w-full rounded-xl bg-[#1e7b5a] text-white hover:bg-[#166146]"
                  onClick={() => {
                    startNewChat();
                    setIsSidebarMenuOpen(false);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {t('assistant.newChat', 'New chat')}
                </Button>

                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg px-1 text-sm font-medium text-[#4b4b4b]"
                  onClick={() => setIsRecentsOpen((prev) => !prev)}
                >
                  <span>{t('assistant.recents', 'Recents')}</span>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${isRecentsOpen ? 'rotate-0' : '-rotate-90'}`}
                  />
                </button>
              </CardHeader>
              <CardContent className="p-3">
                {isRecentsOpen ? (
                  threads.length > 0 ? (
                    <div className="space-y-1">
                      {threads.map((thread) => (
                        <button
                          key={thread.id}
                          type="button"
                          onClick={() => {
                            setActiveThreadId(thread.id);
                            setIsSidebarMenuOpen(false);
                          }}
                          className={`w-full rounded-xl px-3 py-2 text-left transition-colors ${
                            activeThread?.id === thread.id
                              ? 'bg-[#e8f4ef] text-[#195c43]'
                              : 'text-[#333333] hover:bg-[#f7f2ef]'
                          }`}
                        >
                          <p className="truncate text-sm font-medium">
                            {thread.title || t('assistant.newChat', 'New chat')}
                          </p>
                          <p className="mt-1 text-xs text-[#7b7b7b]">{formatRecentTimestamp(thread.updatedAt)}</p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[#8a8a8a]">{t('assistant.noRecents', 'No recent chats yet.')}</p>
                  )
                ) : null}
              </CardContent>
            </Card>
          </SheetContent>
        </Sheet>

        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <Card className="hidden h-fit rounded-3xl border border-[#ece4df] bg-white shadow-sm lg:block">
            <CardHeader className="space-y-4 border-b border-[#f1ebe7]">
              <Button
                type="button"
                className="w-full rounded-xl bg-[#1e7b5a] text-white hover:bg-[#166146]"
                onClick={startNewChat}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t('assistant.newChat', 'New chat')}
              </Button>

              <button
                type="button"
                className="flex w-full items-center justify-between rounded-lg px-1 text-sm font-medium text-[#4b4b4b]"
                onClick={() => setIsRecentsOpen((prev) => !prev)}
              >
                <span>{t('assistant.recents', 'Recents')}</span>
                <ChevronDown
                  className={`h-4 w-4 transition-transform ${isRecentsOpen ? 'rotate-0' : '-rotate-90'}`}
                />
              </button>
            </CardHeader>
            <CardContent className="p-3">
              {isRecentsOpen ? (
                threads.length > 0 ? (
                  <div className="space-y-1">
                    {threads.map((thread) => (
                      <button
                        key={thread.id}
                        type="button"
                        onClick={() => setActiveThreadId(thread.id)}
                        className={`w-full rounded-xl px-3 py-2 text-left transition-colors ${
                          activeThread?.id === thread.id
                            ? 'bg-[#e8f4ef] text-[#195c43]'
                            : 'text-[#333333] hover:bg-[#f7f2ef]'
                        }`}
                      >
                        <p className="truncate text-sm font-medium">
                          {thread.title || t('assistant.newChat', 'New chat')}
                        </p>
                        <p className="mt-1 text-xs text-[#7b7b7b]">{formatRecentTimestamp(thread.updatedAt)}</p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#8a8a8a]">{t('assistant.noRecents', 'No recent chats yet.')}</p>
                )
              ) : null}
            </CardContent>
          </Card>

          <Card className="flex min-h-[70vh] flex-col rounded-3xl border border-[#ece4df] bg-white shadow-sm">
            <CardHeader className="border-b border-[#f1ebe7] pb-4">
              <div className="flex items-center gap-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#e8f4ef] text-[#1e7b5a]">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base text-[#222222]">
                    {activeThread?.title || t('assistant.chatTitle', "Let's plan your setup")}
                  </CardTitle>
                  <p className="text-xs text-[#818181]">
                    {t('assistant.chatHint', 'Ask for products, room styling, kitchen setup, or cheaper alternatives.')}
                  </p>
                </div>
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-4">
              {isHistoryLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-[#8d8d8d]">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('assistant.loading', 'Loading chat history...')}
                </div>
              ) : messages.length > 0 ? (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`max-w-[90%] rounded-2xl px-4 py-3 ${
                        message.role === 'user'
                          ? 'ml-auto bg-[#1e7b5a] text-white'
                          : 'bg-[#f4efec] text-[#232323]'
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>

                      {Array.isArray(message.images) && message.images.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {message.images.map((image, index) => (
                            <img
                              key={`${message.id}-img-${index}`}
                              src={image}
                              alt="Uploaded context"
                              className="h-20 w-20 rounded-lg border border-white/40 object-cover"
                            />
                          ))}
                        </div>
                      )}

                      {message.role === 'assistant' && Array.isArray(message.recommendations) && message.recommendations.length > 0 && (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {message.recommendations.slice(0, 4).map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                void trackRecommendationEvent(item.id, 'recommendation_click', 'chat-bubble');
                                navigate(`/item/${item.id}`);
                              }}
                              className="rounded-xl border border-[#e8dfd9] bg-white p-2 text-left transition-colors hover:bg-[#faf6f3]"
                            >
                              {item.image ? (
                                <img
                                  src={item.image}
                                  alt={item.title}
                                  className="mb-2 h-20 w-full rounded-md object-cover"
                                />
                              ) : null}
                              <p className="line-clamp-1 text-xs font-semibold text-[#202020]">{item.title}</p>
                              <p className="mt-1 text-xs font-semibold text-[#1e7b5a]">{formatCurrency(item.price)}</p>
                              {isNonEmptyString(item.reason) ? (
                                <p className="mt-1 line-clamp-2 text-[11px] text-[#6e6e6e]">{item.reason}</p>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      )}

                      {Array.isArray(message.nextQuestions) && message.nextQuestions.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {message.nextQuestions.map((question, index) => (
                            <Badge
                              key={`${message.id}-q-${index}`}
                              className="cursor-pointer rounded-full bg-white/90 px-3 py-1 text-[11px] text-[#1f1f1f] hover:bg-white"
                              onClick={() => setDraft(question)}
                            >
                              {question}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={chatBottomRef} />
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center px-3 text-center">
                  <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#e8f4ef] text-[#1e7b5a]">
                    <Bot className="h-6 w-6" />
                  </div>
                  <p className="max-w-lg text-sm text-[#646464]">
                    {t(
                      'assistant.empty',
                      'Try: "I want to decorate my room under 150,000 XAF" or "Build a kitchen list for a student apartment."',
                    )}
                  </p>
                </div>
              )}
            </CardContent>

            <CardFooter className="border-t border-[#f1ebe7] p-4">
              <div className="w-full space-y-3">
                {pendingImages.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {pendingImages.map((image) => (
                      <div key={image.id} className="group relative">
                        <img
                          src={image.dataUrl}
                          alt={image.name}
                          className="h-16 w-16 rounded-lg border border-[#e9dfda] object-cover"
                        />
                        <button
                          type="button"
                          className="absolute -right-1 -top-1 rounded-full bg-[#1f1f1f] px-1.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={() => setPendingImages((prev) => prev.filter((entry) => entry.id !== image.id))}
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      void handlePickImages(event.target.files);
                      event.target.value = '';
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-full border-[#e4dbd6] px-3"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSending || isDailyLimitReached}
                  >
                    <ImagePlus className="h-4 w-4" />
                  </Button>

                  <Button
                    type="button"
                    variant={isRecording ? 'default' : 'outline'}
                    className={`h-10 rounded-full border-[#e4dbd6] px-3 ${isRecording ? 'bg-[#d94c57] text-white hover:bg-[#c53e49]' : ''}`}
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isTranscribing || isSending || isDailyLimitReached}
                  >
                    {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </Button>

                  <Input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder={t('assistant.placeholder', 'Ask Kori for product ideas, room style, or kitchen essentials...')}
                    className="h-10 rounded-full border-[#e4dbd6] bg-[#faf8f6]"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void sendMessage();
                      }
                    }}
                  />

                  <Button
                    type="button"
                    className="h-10 rounded-full bg-[#1e7b5a] px-4 text-white hover:bg-[#166146]"
                    onClick={() => void sendMessage()}
                    disabled={isSending || isTranscribing || isDailyLimitReached}
                  >
                    {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                  </Button>
                </div>

                {dailyUsage && (
                  <p className="text-xs text-[#7a7a7a]">
                    {dailyUsage.remaining > 0
                      ? `AI requests left in this 24-hour window: ${dailyUsage.remaining}/${dailyUsage.limit}`
                      : `24-hour AI request limit reached (${dailyUsage.limit}/${dailyUsage.limit}).`}
                  </p>
                )}

                {isTranscribing && (
                  <p className="text-xs text-[#7a7a7a]">
                    <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                    {t('assistant.transcribing', 'Transcribing voice...')}
                  </p>
                )}
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
