import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Card, CardContent, CardHeader } from '@/app/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar';
import { Badge } from '@/app/components/ui/badge';
import { 
  ArrowDownLeft,
  ArrowUpRight,
  Send, 
  Loader2, 
  Mic, 
  MicOff,
  Square, 
  Play, 
  Pause, 
  Paperclip, 
  X, 
  Image as ImageIcon, 
  Check, 
  CheckCheck, 
  Eye,
  Search,
  MoreVertical,
  MoreHorizontal,
  Flag,
  Phone,
  PhoneOff,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  RefreshCcw,
  ChevronLeft,
  Trash2,
  Edit2
} from 'lucide-react';
import { toast } from 'sonner';

import { API_URL, resolveClientAssetUrl } from '@/lib/api';
const ENABLE_MESSAGES_WEBSOCKET = String(import.meta.env.VITE_ENABLE_MESSAGES_WS || '').toLowerCase() === 'true';
const parseConfiguredIceServers = (): RTCIceServer[] => {
  const raw = String(import.meta.env.VITE_WEBRTC_ICE_SERVERS || '').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry) => entry && typeof entry === 'object') as RTCIceServer[];
  } catch {
    return [];
  }
};

const configuredTurnUrls = String(import.meta.env.VITE_TURN_URLS || '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);
const configuredTurnUsername = String(import.meta.env.VITE_TURN_USERNAME || '').trim();
const configuredTurnCredential = String(import.meta.env.VITE_TURN_CREDENTIAL || '').trim();
const configuredIceTransportPolicy = String(import.meta.env.VITE_WEBRTC_ICE_TRANSPORT_POLICY || '')
  .trim()
  .toLowerCase() === 'relay'
  ? 'relay'
  : 'all';
const defaultRelayServers: RTCIceServer[] = [
  { urls: 'stun:stun.relay.metered.ca:80' },
  { urls: 'stun:global.stun.twilio.com:3478' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:openrelay.metered.ca:80' },
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp',
      'turns:openrelay.metered.ca:443?transport=tcp',
    ],
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
];
const configuredRelayServers: RTCIceServer[] = configuredTurnUrls.length
  ? [{
      urls: configuredTurnUrls,
      ...(configuredTurnUsername && configuredTurnCredential
        ? {
            username: configuredTurnUsername,
            credential: configuredTurnCredential,
          }
        : {}),
    }]
  : [];
const WEBRTC_CONFIGURATION: RTCConfiguration = {
  iceTransportPolicy: configuredIceTransportPolicy as RTCIceTransportPolicy,
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    ...defaultRelayServers,
    ...configuredRelayServers,
    ...parseConfiguredIceServers(),
  ],
  iceCandidatePoolSize: 10,
};

interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  itemId?: string;
  content: string;
  messageType?: 'text' | 'voice' | 'image';
  audioData?: string | null;
  attachmentData?: string | null;
  timestamp: string;
  read: boolean;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  isDeleted?: boolean;
  isEdited?: boolean;
}

interface Conversation {
  otherUser: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    phone?: string;
  };
  item?: {
    id: string;
    title: string;
    price: number;
    images: string[];
    sellerId?: string;
  };
  messages: Message[];
  unreadCount: number;
  lastMessageTime: string;
}

const getUserDisplayName = (
  user?: Partial<Conversation['otherUser']> | null,
  fallback = 'Unknown User',
) => {
  const rawName = typeof user?.name === 'string' ? user.name.trim() : '';
  if (rawName) return rawName;

  const email = typeof user?.email === 'string' ? user.email.trim() : '';
  if (email) {
    const [prefix] = email.split('@');
    if (prefix && prefix.trim()) {
      return prefix.trim();
    }
  }

  return fallback;
};

const getUserInitial = (user?: Partial<Conversation['otherUser']> | null, fallback = 'U') => {
  const displayName = getUserDisplayName(user, '').trim();
  if (!displayName) return fallback;
  return displayName.charAt(0).toUpperCase();
};

const normalizeConversationUser = (user: any) => {
  if (!user || typeof user !== 'object') return user;
  const rawAvatar =
    typeof user?.avatar === 'string'
      ? user.avatar
      : (typeof user?.profilePicture === 'string' ? user.profilePicture : '');
  const normalizedAvatar = resolveClientAssetUrl(rawAvatar);
  return {
    ...user,
    avatar: normalizedAvatar,
    profilePicture: normalizedAvatar,
  };
};

type CallMode = 'audio' | 'video';

type CallSignalType = 'invite' | 'accept' | 'offer' | 'answer' | 'ice' | 'end' | 'decline';
type CallLogOutcome = 'started' | 'no_answer' | 'declined' | 'completed';

interface CallSignalPayload {
  signalType: CallSignalType;
  callId: string;
  mode: CallMode;
  callerId: string;
  callerName: string;
  createdAt: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

interface CallLogPayload {
  callId: string;
  mode: CallMode;
  outcome: CallLogOutcome;
  callerId: string;
  callerName: string;
  createdAt: string;
  durationSeconds?: number;
}

const CALL_SIGNAL_PREFIX = '__CALL_SIGNAL__::';
const LEGACY_CALL_INVITE_PREFIX = '__CALL_INVITE__::';
const CALL_LOG_PREFIX = '__CALL_LOG__::';
const CALL_CONNECTION_WATCHDOG_INTERVAL_MS = 12000;

const buildCallSignalContent = (payload: CallSignalPayload) =>
  `${CALL_SIGNAL_PREFIX}${JSON.stringify(payload)}`;

const buildCallLogContent = (payload: CallLogPayload) =>
  `${CALL_LOG_PREFIX}${JSON.stringify(payload)}`;

const isLegacyCallInviteContent = (content?: string | null) =>
  typeof content === 'string' && content.startsWith(LEGACY_CALL_INVITE_PREFIX);

const parseCallSignal = (content?: string | null): CallSignalPayload | null => {
  if (!content || !content.startsWith(CALL_SIGNAL_PREFIX)) return null;
  try {
    const parsed = JSON.parse(content.slice(CALL_SIGNAL_PREFIX.length));
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.callId || (parsed.mode !== 'audio' && parsed.mode !== 'video')) return null;
    if (!parsed.signalType) return null;
    return parsed as CallSignalPayload;
  } catch {
    return null;
  }
};

const parseCallLog = (content?: string | null): CallLogPayload | null => {
  if (!content || !content.startsWith(CALL_LOG_PREFIX)) return null;
  try {
    const parsed = JSON.parse(content.slice(CALL_LOG_PREFIX.length));
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.callId || (parsed.mode !== 'audio' && parsed.mode !== 'video')) return null;
    if (!parsed.outcome || !parsed.callerId) return null;
    return parsed as CallLogPayload;
  } catch {
    return null;
  }
};

const getCallModeLabel = (mode: CallMode) => (mode === 'video' ? 'Video' : 'Audio');

const canTriggerVibration = () => {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return false;
  }
  const nav = navigator as Navigator & {
    userActivation?: {
      hasBeenActive?: boolean;
      isActive?: boolean;
    };
  };
  if (!nav.userActivation) return true;
  return Boolean(nav.userActivation.hasBeenActive || nav.userActivation.isActive);
};

const formatCallDuration = (durationSeconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(durationSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const formatCallDurationLabel = (durationSeconds: number) => {
  const safeSeconds = Math.max(1, Math.floor(durationSeconds));
  if (safeSeconds < 60) {
    return `${safeSeconds}s`;
  }
  const totalMinutes = Math.floor(safeSeconds / 60);
  const remSeconds = safeSeconds % 60;
  if (totalMinutes < 60) {
    if (remSeconds === 0) {
      return `${totalMinutes} min`;
    }
    return `${totalMinutes} min ${remSeconds}s`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const remMinutes = totalMinutes % 60;
  if (remMinutes === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${remMinutes} min`;
};

const getCallLogStatusText = (payload: CallLogPayload, viewerId?: string) => {
  const isCaller = Boolean(viewerId && viewerId === payload.callerId);
  if (payload.outcome === 'no_answer') {
    return isCaller ? 'No answer' : 'Missed call';
  }
  if (payload.outcome === 'declined') {
    return isCaller ? 'Declined' : 'Call declined';
  }
  if (payload.outcome === 'completed') {
    if (typeof payload.durationSeconds === 'number') {
      return formatCallDurationLabel(payload.durationSeconds);
    }
    return 'Answered';
  }
  if (payload.outcome === 'started') {
    return isCaller ? 'Calling...' : 'Incoming call';
  }
  return 'Call';
};

const getCallLogText = (payload: CallLogPayload, viewerId?: string) => {
  const modeLabel = getCallModeLabel(payload.mode);
  const isCaller = Boolean(viewerId && viewerId === payload.callerId);
  if (payload.outcome === 'completed' && typeof payload.durationSeconds === 'number') {
    return `${modeLabel} call • ${formatCallDurationLabel(payload.durationSeconds)}`;
  }
  if (payload.outcome === 'started') {
    return `${isCaller ? 'Outgoing' : 'Incoming'} ${modeLabel.toLowerCase()} call`;
  }
  return `${modeLabel} call • ${getCallLogStatusText(payload, viewerId)}`;
};

const serializeSessionDescription = (
  description: RTCSessionDescriptionInit | RTCSessionDescription,
): RTCSessionDescriptionInit => ({
  type: description.type,
  sdp: description.sdp ?? '',
});

const serializeIceCandidate = (
  candidate: RTCIceCandidate | RTCIceCandidateInit,
): RTCIceCandidateInit => ({
  candidate: candidate.candidate ?? '',
  sdpMid: candidate.sdpMid ?? null,
  sdpMLineIndex: candidate.sdpMLineIndex ?? null,
});

export function Messages() {
  const { currentUser, isAuthenticated, accessToken, refreshAuthToken, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [placingCall, setPlacingCall] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [recordedAudio, setRecordedAudio] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [conversationFilter, setConversationFilter] = useState<'all' | 'unread' | 'archived'>('all');
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [incomingCall, setIncomingCall] = useState<{
    messageId: string;
    callId: string;
    senderId: string;
    senderName: string;
    mode: CallMode;
    itemId?: string;
  } | null>(null);
  const [activeCall, setActiveCall] = useState<{
    callId: string;
    peerId: string;
    peerName: string;
    callerId: string;
    callerName: string;
    mode: CallMode;
    itemId?: string;
    status: 'calling' | 'ringing' | 'connecting' | 'connected';
    cameraFacing: 'user' | 'environment';
    speakerOn: boolean;
    isMuted: boolean;
    videoEnabled: boolean;
    connectedAt: number | null;
  } | null>(null);
  const [localCallStream, setLocalCallStream] = useState<MediaStream | null>(null);
  const [remoteCallStream, setRemoteCallStream] = useState<MediaStream | null>(null);
  
  // Ref for selectedConversation to avoid dependency cycles in fetchMessages
  const selectedConversationRef = useRef<Conversation | null>(null);
  useEffect(() => {
    selectedConversationRef.current = selectedConversation;
  }, [selectedConversation]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const [attachment, setAttachment] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isMobileView, setIsMobileView] = useState(false);
  const [showConversations, setShowConversations] = useState(true);
  
  const prevConversationIdRef = useRef<string | null>(null);
  const hasCompletedInitialSyncRef = useRef(false);
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const notifiedMessageIdsRef = useRef<Set<string>>(new Set());
  const activeCallRef = useRef<typeof activeCall>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const remoteTrackStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const queuedSignalsRef = useRef<Map<string, CallSignalPayload[]>>(new Map());
  const queuedIceRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const outgoingRingContextRef = useRef<AudioContext | null>(null);
  const outgoingRingIntervalRef = useRef<number | null>(null);
  const incomingRingContextRef = useRef<AudioContext | null>(null);
  const incomingRingIntervalRef = useRef<number | null>(null);
  const callTimeoutRef = useRef<number | null>(null);
  const connectionWatchdogRef = useRef<number | null>(null);
  const connectionRecoveryRef = useRef<{ callId: string | null; attempts: number }>({
    callId: null,
    attempts: 0,
  });
  const authSessionFailedRef = useRef(false);
  // Cache for user and item data to prevent re-fetching on every poll
  const userCache = useRef<Map<string, any>>(new Map());
  const itemCache = useRef<Map<string, any>>(new Map());
  const openParticipantProfile = (userId?: string) => {
    if (!userId) return;
    navigate(`/profile/${userId}`);
  };

  // Check for mobile view
  useEffect(() => {
    const checkMobile = () => {
      setIsMobileView(window.innerWidth < 768);
      if (window.innerWidth >= 768) {
        setShowConversations(true);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    if (isAuthenticated && currentUser) {
      authSessionFailedRef.current = false;
    }
  }, [currentUser, isAuthenticated]);

  useEffect(() => {
    localStreamRef.current = localCallStream;
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localCallStream;
    }
  }, [localCallStream]);

  useEffect(() => {
    remoteStreamRef.current = remoteCallStream;
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteCallStream;
      if (remoteCallStream) {
        void remoteVideoRef.current.play().catch(() => {});
      }
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteCallStream;
      if (remoteCallStream) {
        void remoteAudioRef.current.play().catch(() => {});
      }
    }
  }, [remoteCallStream]);

  // Calculate total unread messages
  const totalUnread = useMemo(() => 
    conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    [conversations]
  );

  // Filter conversations based on search
  const filteredConversations = useMemo(() => {
    const normalizedSearch = searchQuery.toLowerCase();
    return conversations.filter((convo) => {
      const matchesSearch =
        getUserDisplayName(convo.otherUser).toLowerCase().includes(normalizedSearch) ||
        (convo.item?.title || '').toLowerCase().includes(normalizedSearch) ||
        (convo.messages[convo.messages.length - 1]?.content || '').toLowerCase().includes(normalizedSearch);

      if (!matchesSearch) return false;

      if (conversationFilter === 'unread') return convo.unreadCount > 0;
      if (conversationFilter === 'archived') return false;
      return true;
    });
  }, [conversations, searchQuery, conversationFilter]);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!ENABLE_MESSAGES_WEBSOCKET) return;
    if (!accessToken || !isAuthenticated) return;

    const connectWebSocket = () => {
      try {
        const ws = new WebSocket(`${API_URL.replace('http', 'ws')}/messages/ws?token=${accessToken}`);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('WebSocket connected');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
              case 'new_message':
                handleNewMessage(data.message);
                break;
              case 'message_read':
                handleMessageRead(data.messageId, data.conversationId);
                break;
              case 'typing_start':
                setTypingUsers(prev => new Set(prev).add(data.userId));
                break;
              case 'typing_end':
                setTypingUsers(prev => {
                  const next = new Set(prev);
                  next.delete(data.userId);
                  return next;
                });
                break;
            }
          } catch (error) {
            console.error('WebSocket message error:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected, reconnecting...');
          setTimeout(connectWebSocket, 3000);
        };
      } catch (error) {
        console.error('WebSocket connection error:', error);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [accessToken, isAuthenticated]);

  const showBrowserNotification = useCallback((title: string, body: string) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (document.visibilityState === 'visible') return;

    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico',
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  }, []);

  const getMessagePreviewText = useCallback((message: Message) => {
    if (message.isDeleted) return 'This message was deleted';
    const callLog = parseCallLog(message.content);
    if (callLog) {
      return getCallLogText(callLog, currentUser?.id);
    }
    const callSignal = parseCallSignal(message.content);
    if (callSignal?.signalType === 'invite') {
      return callSignal.mode === 'video' ? 'Video call invite' : 'Audio call invite';
    }
    if (isLegacyCallInviteContent(message.content)) return 'Call invite';
    if (message.messageType === 'voice') return 'Voice message';
    if (message.messageType === 'image') return 'Image';
    return message.content || 'New message';
  }, [currentUser?.id]);

  const resolveAccessToken = useCallback(async () => {
    if (authSessionFailedRef.current) {
      return null;
    }
    const fromState = accessToken?.trim();
    if (fromState) return fromState;
    const fromStorage = (localStorage.getItem('accessToken') || '').trim();
    if (fromStorage) return fromStorage;
    const fromSessionStorage = (sessionStorage.getItem('accessToken') || '').trim();
    if (fromSessionStorage) return fromSessionStorage;
    return await refreshAuthToken();
  }, [accessToken, refreshAuthToken]);

  const fetchWithAuth = useCallback(async (url: string, init: RequestInit = {}) => {
    const withTokenHeaders = (token: string, sourceHeaders?: HeadersInit) => {
      const headers = new Headers(sourceHeaders || {});
      headers.set('Authorization', `Bearer ${token}`);
      return headers;
    };

    const token = await resolveAccessToken();
    if (!token) {
      authSessionFailedRef.current = true;
      logout();
      throw new Error('Session expired. Please log in again.');
    }

    let response = await fetch(url, {
      ...init,
      headers: withTokenHeaders(token, init.headers),
    });

    if (response.status === 401) {
      const refreshed = await refreshAuthToken();
      if (!refreshed) {
        authSessionFailedRef.current = true;
        logout();
        throw new Error('Session expired. Please log in again.');
      }
      response = await fetch(url, {
        ...init,
        headers: withTokenHeaders(refreshed, init.headers),
      });
      if (response.status === 401) {
        authSessionFailedRef.current = true;
        logout();
        throw new Error('Session expired. Please log in again.');
      }
    }

    return response;
  }, [logout, refreshAuthToken, resolveAccessToken]);

  const markMessageAsReadSilently = useCallback(async (messageId: string) => {
    try {
      await fetchWithAuth(`${API_URL}/messages/${messageId}/read`, {
        method: 'PUT',
      });
    } catch (_error) {
      // noop
    }
  }, [fetchWithAuth]);

  const stopStreamTracks = (stream: MediaStream | null) => {
    if (!stream) return;
    stream.getTracks().forEach((track) => track.stop());
  };

  const clearCallTimeout = useCallback(() => {
    if (callTimeoutRef.current !== null) {
      window.clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
  }, []);

  const clearConnectionWatchdog = useCallback((resetRecovery = true) => {
    if (connectionWatchdogRef.current !== null) {
      window.clearTimeout(connectionWatchdogRef.current);
      connectionWatchdogRef.current = null;
    }
    if (resetRecovery) {
      connectionRecoveryRef.current = {
        callId: null,
        attempts: 0,
      };
    }
  }, []);

  const stopOutgoingRingtone = useCallback(() => {
    if (outgoingRingIntervalRef.current !== null) {
      window.clearInterval(outgoingRingIntervalRef.current);
      outgoingRingIntervalRef.current = null;
    }
    const context = outgoingRingContextRef.current;
    if (context && context.state === 'running') {
      void context.suspend().catch(() => {});
    }
  }, []);

  const stopIncomingRingtone = useCallback(() => {
    if (incomingRingIntervalRef.current !== null) {
      window.clearInterval(incomingRingIntervalRef.current);
      incomingRingIntervalRef.current = null;
    }
    if (canTriggerVibration()) {
      navigator.vibrate(0);
    }
    const context = incomingRingContextRef.current;
    if (context && context.state === 'running') {
      void context.suspend().catch(() => {});
    }
  }, []);

  const playOutgoingRingBurst = useCallback(() => {
    if (typeof window === 'undefined') return;
    const AudioContextClass =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!outgoingRingContextRef.current) {
      outgoingRingContextRef.current = new AudioContextClass();
    }
    const context = outgoingRingContextRef.current;
    if (!context) return;
    if (context.state === 'suspended') {
      void context.resume().catch(() => {});
    }

    const startAt = context.currentTime;
    const gain = context.createGain();
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.06, startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.36);

    const oscillatorA = context.createOscillator();
    oscillatorA.type = 'sine';
    oscillatorA.frequency.setValueAtTime(440, startAt);
    oscillatorA.connect(gain);
    oscillatorA.start(startAt);
    oscillatorA.stop(startAt + 0.18);

    const oscillatorB = context.createOscillator();
    oscillatorB.type = 'sine';
    oscillatorB.frequency.setValueAtTime(520, startAt + 0.2);
    oscillatorB.connect(gain);
    oscillatorB.start(startAt + 0.2);
    oscillatorB.stop(startAt + 0.36);
  }, []);

  const startOutgoingRingtone = useCallback(() => {
    if (outgoingRingIntervalRef.current !== null) return;
    playOutgoingRingBurst();
    outgoingRingIntervalRef.current = window.setInterval(() => {
      playOutgoingRingBurst();
    }, 1500);
  }, [playOutgoingRingBurst]);

  const playIncomingRingBurst = useCallback(() => {
    if (typeof window === 'undefined') return;
    const AudioContextClass =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!incomingRingContextRef.current) {
      incomingRingContextRef.current = new AudioContextClass();
    }
    const context = incomingRingContextRef.current;
    if (!context) return;
    if (context.state === 'suspended') {
      void context.resume().catch(() => {});
    }

    const startAt = context.currentTime;
    const gain = context.createGain();
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.085, startAt + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.55);

    const oscillatorA = context.createOscillator();
    oscillatorA.type = 'triangle';
    oscillatorA.frequency.setValueAtTime(740, startAt);
    oscillatorA.connect(gain);
    oscillatorA.start(startAt);
    oscillatorA.stop(startAt + 0.24);

    const oscillatorB = context.createOscillator();
    oscillatorB.type = 'triangle';
    oscillatorB.frequency.setValueAtTime(622, startAt + 0.28);
    oscillatorB.connect(gain);
    oscillatorB.start(startAt + 0.28);
    oscillatorB.stop(startAt + 0.55);

    if (canTriggerVibration()) {
      navigator.vibrate([220, 90, 220]);
    }
  }, []);

  const startIncomingRingtone = useCallback(() => {
    if (incomingRingIntervalRef.current !== null) return;
    playIncomingRingBurst();
    incomingRingIntervalRef.current = window.setInterval(() => {
      playIncomingRingBurst();
    }, 1900);
  }, [playIncomingRingBurst]);

  const buildSignalBase = useCallback((signalType: CallSignalType, callId: string, mode: CallMode) => ({
    signalType,
    callId,
    mode,
    callerId: currentUser?.id || '',
    callerName: currentUser?.name || 'UNITRADE User',
    createdAt: new Date().toISOString(),
  }), [currentUser?.id, currentUser?.name]);

  const buildCallLogBase = useCallback((
    callId: string,
    mode: CallMode,
    outcome: CallLogOutcome,
    extra: Partial<CallLogPayload> = {},
  ): CallLogPayload => ({
    callId,
    mode,
    outcome,
    callerId: currentUser?.id || '',
    callerName: currentUser?.name || 'UNITRADE User',
    createdAt: new Date().toISOString(),
    ...extra,
  }), [currentUser?.id, currentUser?.name]);

  const clearCallResources = useCallback((callId?: string) => {
    clearCallTimeout();
    clearConnectionWatchdog();
    stopOutgoingRingtone();
    stopIncomingRingtone();

    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.oniceconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    stopStreamTracks(localStreamRef.current);
    stopStreamTracks(remoteStreamRef.current);

    localStreamRef.current = null;
    remoteStreamRef.current = null;
    remoteTrackStreamRef.current = null;
    activeCallRef.current = null;
    setLocalCallStream(null);
    setRemoteCallStream(null);
    setActiveCall(null);
    setIncomingCall(null);

    if (callId) {
      queuedSignalsRef.current.delete(callId);
      queuedIceRef.current.delete(callId);
    } else {
      queuedSignalsRef.current.clear();
      queuedIceRef.current.clear();
    }
  }, [clearCallTimeout, clearConnectionWatchdog, stopIncomingRingtone, stopOutgoingRingtone]);

  const sendCallSignalMessage = useCallback(async (
    receiverId: string,
    payload: CallSignalPayload,
    itemId?: string,
  ): Promise<{ success: boolean; error?: string }> => {
    const postSignal = (token: string) =>
      fetch(`${API_URL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          receiverId,
          itemId,
          content: buildCallSignalContent(payload),
          messageType: 'text',
        }),
      });

    let token = await resolveAccessToken();
    if (!token) {
      authSessionFailedRef.current = true;
      logout();
      return { success: false, error: 'Session expired. Please log in again.' };
    }

    try {
      let response = await postSignal(token);

      if (response.status === 401) {
        const refreshedToken = await refreshAuthToken();
        if (!refreshedToken) {
          authSessionFailedRef.current = true;
          logout();
          return { success: false, error: 'Session expired. Please log in again.' };
        }
        response = await postSignal(refreshedToken);
      }

      if (response.status === 401) {
        authSessionFailedRef.current = true;
        logout();
        return { success: false, error: 'Session expired. Please log in again.' };
      }

      if (!response.ok) {
        const bodyText = await response.text();
        try {
          const bodyJson = JSON.parse(bodyText);
          return {
            success: false,
            error: bodyJson?.error || bodyJson?.message || `Failed to send call signal (${response.status})`,
          };
        } catch {
          return {
            success: false,
            error: bodyText || `Failed to send call signal (${response.status})`,
          };
        }
      }

      return { success: true };
    } catch (_error) {
      return { success: false, error: 'Network error while sending call signal.' };
    }
  }, [logout, refreshAuthToken, resolveAccessToken]);

  const scheduleConnectionWatchdog = useCallback((
    callId: string,
    peerId: string,
    mode: CallMode,
    itemId?: string,
  ) => {
    const recoveryState = connectionRecoveryRef.current;
    if (recoveryState.callId !== callId) {
      connectionRecoveryRef.current = {
        callId,
        attempts: 0,
      };
    }
    clearConnectionWatchdog(false);

    connectionWatchdogRef.current = window.setTimeout(() => {
      const active = activeCallRef.current;
      if (!active || active.callId !== callId || active.status === 'connected' || active.connectedAt) {
        return;
      }

      const peerConnection = peerConnectionRef.current;
      const attempts = connectionRecoveryRef.current.callId === callId
        ? connectionRecoveryRef.current.attempts
        : 0;

      if (!peerConnection || peerConnection.signalingState === 'closed') {
        scheduleConnectionWatchdog(callId, peerId, mode, itemId);
        return;
      }

      if (attempts >= 3) {
        // Keep the call alive so users can continue trying without forced hang-up.
        scheduleConnectionWatchdog(callId, peerId, mode, itemId);
        return;
      }

      connectionRecoveryRef.current = {
        callId,
        attempts: attempts + 1,
      };

      void (async () => {
        try {
          const restartOffer = await peerConnection.createOffer({ iceRestart: true });
          await peerConnection.setLocalDescription(restartOffer);
          const sent = await sendCallSignalMessage(
            peerId,
            {
              ...buildSignalBase('offer', callId, mode),
              sdp: serializeSessionDescription(restartOffer),
            },
            itemId,
          );
          if (!sent.success) {
            throw new Error(sent.error || 'Failed to send connection recovery signal');
          }
        } catch (error) {
          console.error('Call recovery offer error:', error);
        } finally {
          scheduleConnectionWatchdog(callId, peerId, mode, itemId);
        }
      })();
    }, CALL_CONNECTION_WATCHDOG_INTERVAL_MS);
  }, [buildSignalBase, clearConnectionWatchdog, sendCallSignalMessage]);

  const sendCallLogMessage = useCallback(async (
    receiverId: string,
    payload: CallLogPayload,
    itemId?: string,
  ): Promise<{ success: boolean; error?: string }> => {
    const postLog = (token: string) =>
      fetch(`${API_URL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          receiverId,
          itemId,
          content: buildCallLogContent(payload),
          messageType: 'text',
        }),
      });

    let token = await resolveAccessToken();
    if (!token) {
      authSessionFailedRef.current = true;
      logout();
      return { success: false, error: 'Session expired. Please log in again.' };
    }

    try {
      let response = await postLog(token);

      if (response.status === 401) {
        const refreshedToken = await refreshAuthToken();
        if (!refreshedToken) {
          authSessionFailedRef.current = true;
          logout();
          return { success: false, error: 'Session expired. Please log in again.' };
        }
        response = await postLog(refreshedToken);
      }

      if (response.status === 401) {
        authSessionFailedRef.current = true;
        logout();
        return { success: false, error: 'Session expired. Please log in again.' };
      }

      if (!response.ok) {
        const bodyText = await response.text();
        try {
          const bodyJson = JSON.parse(bodyText);
          return {
            success: false,
            error: bodyJson?.error || bodyJson?.message || `Failed to send call log (${response.status})`,
          };
        } catch {
          return {
            success: false,
            error: bodyText || `Failed to send call log (${response.status})`,
          };
        }
      }

      return { success: true };
    } catch (_error) {
      return { success: false, error: 'Network error while sending call log.' };
    }
  }, [logout, refreshAuthToken, resolveAccessToken]);

  const buildSignalBaseRef = useRef(buildSignalBase);
  const sendCallSignalMessageRef = useRef(sendCallSignalMessage);
  const clearCallResourcesRef = useRef(clearCallResources);

  useEffect(() => {
    buildSignalBaseRef.current = buildSignalBase;
  }, [buildSignalBase]);

  useEffect(() => {
    sendCallSignalMessageRef.current = sendCallSignalMessage;
  }, [sendCallSignalMessage]);

  useEffect(() => {
    clearCallResourcesRef.current = clearCallResources;
  }, [clearCallResources]);

  const flushQueuedIceCandidates = useCallback(async (callId: string, peerConnection: RTCPeerConnection) => {
    const pending = queuedIceRef.current.get(callId) || [];
    if (!pending.length) return;
    queuedIceRef.current.delete(callId);

    for (const candidate of pending) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('Queued ICE candidate error:', error);
      }
    }
  }, []);

  const markCallConnected = useCallback(() => {
    clearCallTimeout();
    clearConnectionWatchdog();
    stopOutgoingRingtone();
    setActiveCall((prev) => {
      if (!prev) return prev;
      const next = prev.connectedAt
        ? { ...prev, status: 'connected' as const }
        : { ...prev, status: 'connected' as const, connectedAt: Date.now() };
      activeCallRef.current = next;
      return next;
    });
  }, [clearCallTimeout, clearConnectionWatchdog, stopOutgoingRingtone]);

  const ensurePeerConnection = useCallback((
    callId: string,
    peerId: string,
    mode: CallMode,
    itemId?: string,
  ) => {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }

    const peerConnection = new RTCPeerConnection(WEBRTC_CONFIGURATION);
    peerConnectionRef.current = peerConnection;

    peerConnection.onicecandidate = (event) => {
      if (!event.candidate) return;
      const active = activeCallRef.current;
      if (!active) return;

      void sendCallSignalMessage(
        peerId,
        {
          ...buildSignalBase('ice', callId, mode),
          candidate: serializeIceCandidate(event.candidate),
        },
        itemId,
      ).then((result) => {
        if (!result.success) {
          console.error('Failed to send ICE signal:', result.error);
        }
      });
    };

    peerConnection.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        setRemoteCallStream(stream);
        markCallConnected();
        return;
      }

      // Some browsers may emit track events without event.streams; build a stream manually.
      const current = remoteTrackStreamRef.current || new MediaStream();
      const alreadyPresent = current.getTracks().some((track) => track.id === event.track.id);
      if (!alreadyPresent) {
        current.addTrack(event.track);
      }
      remoteTrackStreamRef.current = current;
      setRemoteCallStream(new MediaStream(current.getTracks()));
      markCallConnected();
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      if (state === 'connected') {
        markCallConnected();
        return;
      }

      if (state === 'connecting' || state === 'disconnected') {
        const active = activeCallRef.current;
        if (active?.callId === callId) {
          scheduleConnectionWatchdog(callId, peerId, mode, itemId);
        }
        return;
      }

      if (state === 'failed' || state === 'closed') {
        const active = activeCallRef.current;
        if (active) {
          clearCallResources(active.callId);
          toast.error('Call ended');
        }
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      const iceState = peerConnection.iceConnectionState;
      if (iceState === 'connected' || iceState === 'completed') {
        markCallConnected();
        return;
      }
      if (iceState === 'checking' || iceState === 'disconnected') {
        const active = activeCallRef.current;
        if (active?.callId === callId) {
          scheduleConnectionWatchdog(callId, peerId, mode, itemId);
        }
        return;
      }
      if (iceState === 'failed') {
        const active = activeCallRef.current;
        if (active?.callId === callId) {
          clearCallResources(active.callId);
          toast.error('Call failed due to network connectivity.');
        }
      }
    };

    return peerConnection;
  }, [buildSignalBase, clearCallResources, markCallConnected, scheduleConnectionWatchdog, sendCallSignalMessage]);

  const getCallMediaStream = useCallback(async (
    mode: CallMode,
    facingMode: 'user' | 'environment' = 'user',
  ) => {
    const preferredConstraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: mode === 'video' ? { facingMode } : false,
    };
    try {
      return await navigator.mediaDevices.getUserMedia(preferredConstraints);
    } catch (primaryError) {
      const fallbackConstraints: MediaStreamConstraints = {
        audio: true,
        video: mode === 'video' ? true : false,
      };
      try {
        return await navigator.mediaDevices.getUserMedia(fallbackConstraints);
      } catch {
        if (mode === 'video') {
          // Last fallback: keep audio call alive even when camera access fails.
          try {
            return await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          } catch {
            // continue to throw original error below
          }
        }
        throw primaryError;
      }
    }
  }, []);

  const applySignalingPayload = useCallback(async (
    signal: CallSignalPayload,
    senderId: string,
    itemId?: string,
  ) => {
    const active = activeCallRef.current;
    if (!active || active.callId !== signal.callId) {
      const queued = queuedSignalsRef.current.get(signal.callId) || [];
      queued.push(signal);
      queuedSignalsRef.current.set(signal.callId, queued);
      return;
    }

    const peerConnection = peerConnectionRef.current;
    if (!peerConnection) {
      const queued = queuedSignalsRef.current.get(signal.callId) || [];
      queued.push(signal);
      queuedSignalsRef.current.set(signal.callId, queued);
      return;
    }

    if (signal.signalType === 'offer' && signal.sdp) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      await flushQueuedIceCandidates(signal.callId, peerConnection);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      await sendCallSignalMessage(
        senderId,
        {
          ...buildSignalBase('answer', signal.callId, active.mode),
          sdp: serializeSessionDescription(answer),
        },
        itemId,
      );
      setActiveCall((prev) => {
        if (!prev) return prev;
        const next = { ...prev, status: 'connecting' as const };
        activeCallRef.current = next;
        return next;
      });
      scheduleConnectionWatchdog(signal.callId, senderId, active.mode, itemId);
      return;
    }

    if (signal.signalType === 'answer' && signal.sdp) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      await flushQueuedIceCandidates(signal.callId, peerConnection);
      clearCallTimeout();
      stopOutgoingRingtone();
      setActiveCall((prev) => {
        if (!prev) return prev;
        const next = { ...prev, status: 'connecting' as const };
        activeCallRef.current = next;
        return next;
      });
      scheduleConnectionWatchdog(signal.callId, senderId, active.mode, itemId);
      return;
    }

    if (signal.signalType === 'ice' && signal.candidate) {
      if (!peerConnection.remoteDescription) {
        const pending = queuedIceRef.current.get(signal.callId) || [];
        pending.push(signal.candidate);
        queuedIceRef.current.set(signal.callId, pending);
        return;
      }

      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
      } catch (error) {
        console.error('Add ICE candidate error:', error);
      }
    }
  }, [buildSignalBase, clearCallTimeout, flushQueuedIceCandidates, sendCallSignalMessage, stopOutgoingRingtone]);

  const flushQueuedSignalsForCall = useCallback(async (
    callId: string,
    senderId: string,
    itemId?: string,
  ) => {
    const queuedSignals = (queuedSignalsRef.current.get(callId) || [])
      .slice()
      .sort((left, right) => Date.parse(left.createdAt || '') - Date.parse(right.createdAt || ''));
    if (!queuedSignals.length) return;

    queuedSignalsRef.current.delete(callId);
    for (const signal of queuedSignals) {
      await applySignalingPayload(signal, senderId, itemId);
    }
  }, [applySignalingPayload]);

  useEffect(() => {
    const active = activeCallRef.current;
    if (!active) return;
    void flushQueuedSignalsForCall(active.callId, active.peerId, active.itemId).catch((error) => {
      console.error('Flush queued call signals error:', error);
    });
  }, [activeCall?.callId, activeCall?.peerId, activeCall?.itemId, flushQueuedSignalsForCall]);

  const handleCallSignalMessage = useCallback((message: Message, signal: CallSignalPayload) => {
    if (!currentUser || message.senderId === currentUser.id) return;

    if (message.receiverId === currentUser.id && !message.read) {
      void markMessageAsReadSilently(message.id);
    }

    if (signal.signalType === 'invite') {
      if (activeCallRef.current && activeCallRef.current.callId !== signal.callId) {
        void sendCallSignalMessage(
          message.senderId,
          {
            ...buildSignalBase('decline', signal.callId, signal.mode),
          },
          message.itemId,
        );
        return;
      }

      setIncomingCall({
        messageId: message.id,
        callId: signal.callId,
        senderId: message.senderId,
        senderName: signal.callerName || getUserDisplayName(userCache.current.get(message.senderId), 'Incoming call'),
        mode: signal.mode,
        itemId: message.itemId,
      });

      showBrowserNotification(
        'Incoming call',
        `${signal.callerName || 'Someone'} is ${signal.mode} calling`,
      );
      return;
    }

    if (signal.signalType === 'decline') {
      const active = activeCallRef.current;
      if (active?.callId === signal.callId) {
        clearCallResources(signal.callId);
        toast.info(`${active.peerName} declined the call`);
      }
      return;
    }

    if (signal.signalType === 'accept') {
      const active = activeCallRef.current;
      if (active?.callId === signal.callId) {
        clearCallTimeout();
        stopOutgoingRingtone();
        setActiveCall((prev) => {
          if (!prev) return prev;
          const next = { ...prev, status: 'connecting' as const };
          activeCallRef.current = next;
          return next;
        });
        const peerConnection = ensurePeerConnection(
          signal.callId,
          active.peerId,
          active.mode,
          active.itemId,
        );

        void (async () => {
          try {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            const offerSent = await sendCallSignalMessage(
              active.peerId,
              {
                ...buildSignalBase('offer', signal.callId, active.mode),
                sdp: serializeSessionDescription(offer),
              },
              active.itemId,
            );
            if (!offerSent.success) {
              throw new Error(offerSent.error || 'Failed to send call offer');
            }
            scheduleConnectionWatchdog(signal.callId, active.peerId, active.mode, active.itemId);
          } catch (error) {
            console.error('Offer on accept error:', error);
            toast.error('Unable to connect this call. Please try again.');
          }
        })();
      }
      return;
    }

    if (signal.signalType === 'end') {
      const active = activeCallRef.current;
      if (active?.callId === signal.callId) {
        clearCallResources(signal.callId);
        toast.info('Call ended');
      }
      if (incomingCall?.callId === signal.callId) {
        setIncomingCall(null);
      }
      return;
    }

    void applySignalingPayload(signal, message.senderId, message.itemId).catch((error) => {
      console.error('Apply call signal error:', error);
    });
  }, [
    applySignalingPayload,
    buildSignalBase,
    clearCallTimeout,
    clearCallResources,
    currentUser,
    incomingCall?.callId,
    markMessageAsReadSilently,
    ensurePeerConnection,
    scheduleConnectionWatchdog,
    sendCallSignalMessage,
    stopOutgoingRingtone,
    showBrowserNotification,
  ]);

  const notifyIncomingMessage = useCallback((message: Message) => {
    if (!currentUser || message.senderId === currentUser.id) return;
    if (notifiedMessageIdsRef.current.has(message.id)) return;
    notifiedMessageIdsRef.current.add(message.id);

    const callSignal = parseCallSignal(message.content);
    if (callSignal) {
      handleCallSignalMessage(message, callSignal);
      return;
    }
    if (isLegacyCallInviteContent(message.content)) {
      return;
    }

    const senderName = getUserDisplayName(userCache.current.get(message.senderId), 'New message');
    const preview = getMessagePreviewText(message);
    toast.info(`New message from ${senderName}`, {
      description: preview,
    });
    showBrowserNotification(`New message from ${senderName}`, preview);
  }, [currentUser, getMessagePreviewText, handleCallSignalMessage, showBrowserNotification]);

  // Helper to mark messages as read
  const markMessagesAsRead = useCallback(async (messages: Message[]) => {
    const unreadMessages = messages.filter(m => 
      m.receiverId === currentUser?.id && !m.read
    );

    for (const msg of unreadMessages) {
      try {
        await fetchWithAuth(`${API_URL}/messages/${msg.id}/read`, {
          method: 'PUT',
        });
        
        // Notify via WebSocket
        if (wsRef.current?.readyState === WebSocket.OPEN && selectedConversationRef.current) {
          wsRef.current.send(JSON.stringify({
            type: 'message_read',
            messageId: msg.id,
            conversationId: selectedConversationRef.current.otherUser.id
          }));
        }
      } catch (error) {
        console.error('Mark read error:', error);
      }
    }
  }, [currentUser, fetchWithAuth]);

  // Fetch messages function
  const fetchMessages = useCallback(async () => {
    if (!currentUser) return;

    try {
      const endpoint = currentUser.role === 'admin' ? '/admin/messages' : '/messages';
      const response = await fetchWithAuth(`${API_URL}${endpoint}`);

      if (response.ok) {
        const data = await response.json();
        const messages: Message[] = data.messages;
        const visibleMessages = messages.filter((msg) =>
          !parseCallSignal(msg.content) && !isLegacyCallInviteContent(msg.content),
        );

        if (!hasCompletedInitialSyncRef.current) {
          messages.forEach((message) => {
            knownMessageIdsRef.current.add(message.id);
            const callSignal = parseCallSignal(message.content);
            if (!callSignal) return;
            const createdAtMs = Date.parse(callSignal.createdAt || message.timestamp || '');
            const isRecent = Number.isFinite(createdAtMs) && Date.now() - createdAtMs < 120_000;
            if (isRecent) {
              notifyIncomingMessage(message);
            }
          });
          hasCompletedInitialSyncRef.current = true;
        } else {
          const newMessages = messages.filter((message) => !knownMessageIdsRef.current.has(message.id));
          newMessages.forEach((message) => {
            knownMessageIdsRef.current.add(message.id);
            notifyIncomingMessage(message);
          });
        }

        // Populate user cache from response if available (for admin)
        if (data.users && Array.isArray(data.users)) {
            data.users.forEach((u: any) => {
              const normalizedUser = normalizeConversationUser(u);
              userCache.current.set(normalizedUser.id, normalizedUser);
            });
        }

        // 1. Identify missing users and items
        const userIdsToFetch = new Set<string>();
        const itemIdsToFetch = new Set<string>();

        visibleMessages.forEach(msg => {
          if (currentUser.role === 'admin') {
            if (!userCache.current.has(msg.senderId)) userIdsToFetch.add(msg.senderId);
            if (!userCache.current.has(msg.receiverId)) userIdsToFetch.add(msg.receiverId);
          } else {
            const otherUserId = msg.senderId === currentUser.id ? msg.receiverId : msg.senderId;
            if (!userCache.current.has(otherUserId)) {
              userIdsToFetch.add(otherUserId);
            }
          }
          if (msg.itemId && !itemCache.current.has(msg.itemId)) {
            itemIdsToFetch.add(msg.itemId);
          }
        });

        // 2. Fetch missing data in parallel
        await Promise.all([
          ...Array.from(userIdsToFetch).map(async (id) => {
            try {
              const res = await fetchWithAuth(`${API_URL}/users/${id}`);
              if (res.ok) {
                const data = await res.json();
                userCache.current.set(id, normalizeConversationUser(data.user));
              } else {
                 userCache.current.set(id, { id, name: 'Unknown User', email: '' });
              }
            } catch (e) {
              console.error(`Failed to fetch user ${id}`, e);
            }
          }),
          ...Array.from(itemIdsToFetch).map(async (id) => {
            try {
              const res = await fetchWithAuth(`${API_URL}/listings/${id}`);
              if (res.ok) {
                const data = await res.json();
                itemCache.current.set(id, data.listing);
              }
            } catch (e) {
               console.error(`Failed to fetch item ${id}`, e);
            }
          })
        ]);
        
        // Group messages into conversations
        const conversationMap = new Map<string, Message[]>();

        if (currentUser.role === 'admin') {
          for (const msg of visibleMessages) {
            const participants = [msg.senderId, msg.receiverId].sort();
            const key = participants.join('::');
            if (!conversationMap.has(key)) {
              conversationMap.set(key, []);
            }
            conversationMap.get(key)!.push(msg);
          }
        } else {
          for (const msg of visibleMessages) {
            const otherUserId = msg.senderId === currentUser.id ? msg.receiverId : msg.senderId;
            const key = otherUserId;
            
            if (!conversationMap.has(key)) {
              conversationMap.set(key, []);
            }
            conversationMap.get(key)!.push(msg);
          }
        }

        // Convert map to array of conversations
        const convos: Conversation[] = Array.from(conversationMap.entries()).map(([key, msgs]) => {
          let otherUserObj;
          
          if (currentUser.role === 'admin') {
            const [id1, id2] = key.split('::');
            const u1 = userCache.current.get(id1);
            const u2 = userCache.current.get(id2);
            otherUserObj = {
              id: key,
              name: `${u1?.name || 'Unknown'} & ${u2?.name || 'Unknown'}`,
              email: '',
              avatar: undefined
            };
          } else {
            const otherUserId = key;
            otherUserObj = userCache.current.get(otherUserId) || { 
              id: otherUserId, 
              name: 'Unknown User', 
              email: '',
              avatar: undefined
            };
          }

          const sortedMsgs = msgs.sort((a, b) => 
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );
          
          const lastMessage = sortedMsgs[sortedMsgs.length - 1];
          const itemId = lastMessage?.itemId;
          const unreadCount = sortedMsgs.filter(m => 
            m.receiverId === currentUser?.id && !m.read
          ).length;

          return {
            otherUser: otherUserObj,
            item: itemId ? itemCache.current.get(itemId) : undefined,
            messages: sortedMsgs,
            unreadCount,
            lastMessageTime: lastMessage?.timestamp || new Date().toISOString(),
          };
        });

        // Sort by most recent message
        convos.sort((a, b) => {
          return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
        });

        setConversations(convos);

        // Update selected conversation with fresh data if it exists (for polling)
        if (selectedConversationRef.current) {
          const updatedConvo = convos.find(c => 
            c.otherUser.id === selectedConversationRef.current?.otherUser.id
          );
          if (updatedConvo) {
            setSelectedConversation(updatedConvo);
          }
        }

        // Auto-select conversation from URL params if not already selected
        const userId = searchParams.get('userId');
        const itemId = searchParams.get('itemId');
        
        if (userId && itemId && !selectedConversationRef.current) {
          const convo = convos.find(c => 
            c.otherUser.id === userId
          );
          
          if (convo) {
            setSelectedConversation(convo);
            setNewMessage('');
            if (currentUser?.role !== 'admin') {
              markMessagesAsRead(convo.messages);
            }
            if (isMobileView) {
                setShowConversations(false);
            }
          } else if (userId) {
            // Create a new conversation placeholder if none exists
            const newConvo: Conversation = {
              otherUser: userCache.current.get(userId) || { 
                id: userId, 
                name: 'Loading...', 
                email: '',
                avatar: undefined
              },
              item: itemCache.current.get(itemId) || undefined,
              messages: [],
              unreadCount: 0,
              lastMessageTime: new Date().toISOString(),
            };
            setSelectedConversation(newConvo);
            setNewMessage('');
            if (isMobileView) {
              setShowConversations(false);
            }
          }
        }
      }
    } catch (error) {
      console.error('Fetch messages error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [currentUser, fetchWithAuth, isMobileView, markMessagesAsRead, notifyIncomingMessage, searchParams]);

  // Fetch messages with retry logic
  const fetchMessagesWithRetry = useCallback(async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        await fetchMessages();
        break;
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        const isSessionError = message.toLowerCase().includes('session expired');
        if (isSessionError) {
          setLoading(false);
          navigate('/login');
          return;
        }
        if (i === retries - 1) {
          toast.error('Failed to load messages. Please refresh.');
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }, [fetchMessages, navigate]);

  // Handle starting a new conversation
  const handleStartNewConversation = useCallback(async (userId: string, itemId: string) => {
    try {
      // Fetch user info
      const userResponse = await fetchWithAuth(`${API_URL}/users/${userId}`, {
        method: 'GET',
      });
      
      // Fetch item info
      const itemResponse = await fetchWithAuth(`${API_URL}/listings/${itemId}`, {
        method: 'GET',
      });

      const userData = userResponse.ok ? await userResponse.json() : null;
      const itemData = itemResponse.ok ? await itemResponse.json() : null;
      const normalizedUser = userData?.user ? normalizeConversationUser(userData.user) : null;

      // Update cache
      if (normalizedUser) userCache.current.set(userId, normalizedUser);
      if (itemData?.listing) itemCache.current.set(itemId, itemData.listing);

      const newConvo: Conversation = {
        otherUser: normalizedUser || { 
          id: userId, 
          name: 'Unknown User', 
          email: '',
          avatar: undefined
        },
        item: itemData?.listing || undefined,
        messages: [],
        unreadCount: 0,
        lastMessageTime: new Date().toISOString(),
      };

      // Check if conversation already exists
      const existingConvo = conversations.find(c => 
        c.otherUser.id === userId
      );

      if (existingConvo) {
        // Update context to the new item
        const updatedConvo = {
          ...existingConvo,
          item: itemData?.listing || existingConvo.item
        };
        setSelectedConversation(updatedConvo);
        setConversations(prev => prev.map(c => c.otherUser.id === userId ? updatedConvo : c));
      } else {
        setSelectedConversation(newConvo);
        // Add to conversations list
        setConversations(prev => [newConvo, ...prev]);
      }

      if (isMobileView) {
        setShowConversations(false);
      }

    } catch (error) {
      console.error('Error starting new conversation:', error);
      toast.error('Failed to start conversation');
    }
  }, [conversations, fetchWithAuth, isMobileView]);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      navigate('/login');
      return;
    }
    if (authSessionFailedRef.current) {
      setLoading(false);
      navigate('/login');
      return;
    }
    fetchMessagesWithRetry();
    const isCallFlowActive = Boolean(activeCall || incomingCall);
    const pollingIntervalMs = isCallFlowActive ? 800 : 3000;
    
    // Poll for new messages every 3 seconds to ensure seller receives messages
    const pollInterval = setInterval(() => {
      if (!authSessionFailedRef.current && !sending && !isRecording) {
        fetchMessages();
      }
    }, pollingIntervalMs);

    // Check if we have userId and itemId params for starting a new conversation
    const userId = searchParams.get('userId');
    const itemId = searchParams.get('itemId');
    
    if (userId && itemId) {
      // Optimization: Use passed state from ItemDetails for instant load
      if (location.state?.item && location.state.item.seller?.id === userId) {
        const { item } = location.state;
        const seller = item.seller;
        
        const newConvo: Conversation = {
          otherUser: {
            id: seller.id,
            name: seller.name,
            email: seller.email || '',
            phone: seller.phone,
            avatar: undefined
          },
          item: item,
          messages: [],
          unreadCount: 0,
          lastMessageTime: new Date().toISOString(),
        };

        setSelectedConversation(newConvo);
        if (isMobileView) {
          setShowConversations(false);
        }
      } else {
        // Fallback to fetch if no state passed
        // Check if already selected to avoid loop
        if (selectedConversationRef.current?.otherUser.id !== userId) {
          handleStartNewConversation(userId, itemId);
        }
      }
    }

    return () => clearInterval(pollInterval);
  }, [isAuthenticated, navigate, fetchMessagesWithRetry, searchParams, location.state, sending, isRecording, fetchMessages, handleStartNewConversation, activeCall, incomingCall]);

  useEffect(() => {
    if (incomingCall && !activeCall) {
      startIncomingRingtone();
      return;
    }
    stopIncomingRingtone();
  }, [activeCall, incomingCall, startIncomingRingtone, stopIncomingRingtone]);

  useEffect(() => {
    if (isAuthenticated && currentUser && !authSessionFailedRef.current) return;
    if (activeCallRef.current || incomingCall) {
      clearCallResources(activeCallRef.current?.callId || incomingCall?.callId);
    }
  }, [clearCallResources, currentUser, incomingCall, isAuthenticated]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (messagesEndRef.current && selectedConversation) {
      const isNewConversation = prevConversationIdRef.current !== selectedConversation.otherUser.id;
      
      // Instant scroll for new conversation, smooth scroll for new messages
      messagesEndRef.current.scrollIntoView({ behavior: isNewConversation ? 'auto' : 'smooth', block: 'nearest' });
      
      prevConversationIdRef.current = selectedConversation.otherUser.id;
    }
  }, [selectedConversation?.messages.length, selectedConversation?.otherUser.id]);
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !isRecording && !recordedAudio) {
        e.preventDefault();
        handleSendMessage();
      }
      if (e.key === 'Escape' && recordedAudio) {
        cancelRecording();
      }
      if (e.key === 'Escape' && attachment) {
        cancelAttachment();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [newMessage, recordedAudio, attachment, isRecording]);

  useEffect(() => {
    return () => {
      const active = activeCallRef.current;
      if (active) {
        void sendCallSignalMessageRef.current(
          active.peerId,
          {
            ...buildSignalBaseRef.current('end', active.callId, active.mode),
          },
          active.itemId,
        );
      }
      clearCallResourcesRef.current(active?.callId);
      if (outgoingRingContextRef.current) {
        void outgoingRingContextRef.current.close().catch(() => {});
      }
      if (incomingRingContextRef.current) {
        void incomingRingContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  const handleNewMessage = (message: Message) => {
    if (knownMessageIdsRef.current.has(message.id)) return;
    knownMessageIdsRef.current.add(message.id);
    notifyIncomingMessage(message);

    if (parseCallSignal(message.content) || isLegacyCallInviteContent(message.content)) {
      return;
    }

    // Update conversations with new message
    setConversations(prev => {
      const newConversations = [...prev];
      const conversationIndex = newConversations.findIndex(c => 
        c.otherUser.id === message.senderId || c.otherUser.id === message.receiverId
      );

      if (conversationIndex !== -1) {
        // Add to existing conversation
        const updatedConversation = {
          ...newConversations[conversationIndex],
          messages: [...newConversations[conversationIndex].messages, message],
          unreadCount: message.receiverId === currentUser?.id && !message.read 
            ? newConversations[conversationIndex].unreadCount + 1 
            : newConversations[conversationIndex].unreadCount,
          lastMessageTime: message.timestamp
        };
        
        newConversations[conversationIndex] = updatedConversation;
        
        // Move to top
        newConversations.sort((a, b) => {
          return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
        });
      } else {
        // Create new conversation
        const otherUserId = message.senderId === currentUser?.id ? message.receiverId : message.senderId;
        const cachedUser = userCache.current.get(otherUserId);
        const cachedItem = message.itemId ? itemCache.current.get(message.itemId) : undefined;

        const newConvo: Conversation = {
          otherUser: cachedUser || { 
            id: otherUserId, 
            name: 'Loading...', 
            email: '',
            avatar: undefined
          },
          item: cachedItem,
          messages: [message],
          unreadCount: message.receiverId === currentUser?.id && !message.read ? 1 : 0,
          lastMessageTime: message.timestamp
        };
        newConversations.unshift(newConvo);
      }

      return newConversations;
    });

    // If message is in selected conversation, update it
    if (selectedConversation && 
        (selectedConversation.otherUser.id === message.senderId || selectedConversation.otherUser.id === message.receiverId)) {
      setSelectedConversation(prev => prev ? {
        ...prev,
        messages: [...prev.messages, message],
        unreadCount: message.receiverId === currentUser?.id && !message.read 
          ? prev.unreadCount + 1 
          : prev.unreadCount
      } : null);
    }
  };

  const handleMessageRead = (messageId: string, conversationId: string) => {
    // Update message read status
    setConversations(prev => prev.map(convo => {
      if (convo.otherUser.id === conversationId) {
        return {
          ...convo,
          messages: convo.messages.map(msg => 
            msg.id === messageId ? { ...msg, read: true, status: 'read' } : msg
          ),
          unreadCount: Math.max(0, convo.unreadCount - 1)
        };
      }
      return convo;
    }));

    if (selectedConversation) {
      setSelectedConversation(prev => prev ? {
        ...prev,
        messages: prev.messages.map(msg => 
          msg.id === messageId ? { ...msg, read: true, status: 'read' } : msg
        ),
        unreadCount: Math.max(0, prev.unreadCount - 1)
      } : null);
    }
  };

  const sanitizeMessage = (content: string) => {
    return content
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .trim();
  };

  const handleSendMessage = async () => {
    if ((!newMessage.trim() && !attachment && !recordedAudio) || !selectedConversation) return;

    const tempMessageId = `temp-${Date.now()}`;
    const sanitizedContent = sanitizeMessage(newMessage.trim());
    
    // Create optimistic message
    const optimisticMessage: Message = {
      id: tempMessageId,
      senderId: currentUser!.id,
      receiverId: selectedConversation.otherUser.id,
      itemId: selectedConversation.item?.id,
      content: sanitizedContent || (attachment ? 'Sent an image' : recordedAudio ? 'Voice message' : ''),
      messageType: attachment ? 'image' : recordedAudio ? 'voice' : 'text',
      audioData: recordedAudio || null,
      attachmentData: attachment || null,
      timestamp: new Date().toISOString(),
      read: false,
      status: 'sending'
    };

    // Update UI optimistically
    setSelectedConversation(prev => prev ? {
      ...prev,
      messages: [...prev.messages, optimisticMessage]
    } : null);

    setSending(true);

    try {
      const requestBody = {
        receiverId: selectedConversation.otherUser.id,
        itemId: selectedConversation.item?.id,
        content: sanitizedContent || (attachment ? 'Sent an image' : recordedAudio ? 'Voice message' : ''),
        messageType: attachment ? 'image' : recordedAudio ? 'voice' : 'text',
        audioData: recordedAudio,
        attachmentData: attachment,
      };
      const response = await fetchWithAuth(`${API_URL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        const sentMessage = data.message;
        
        // Replace optimistic message with real one
        setSelectedConversation(prev => prev ? {
          ...prev,
          messages: prev.messages.map(msg => 
            msg.id === tempMessageId ? { ...sentMessage, status: 'sent' } : msg
          )
        } : null);

        // Update conversations list
        setConversations(prev => {
          const updated = prev.map(convo => {
            if (convo.otherUser.id === selectedConversation.otherUser.id) {
              return {
                ...convo,
                messages: [...convo.messages, sentMessage],
                lastMessageTime: sentMessage.timestamp
              };
            }
            return convo;
          });
          
          // Sort by most recent
          updated.sort((a, b) => {
            return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
          });
          
          return updated;
        });

        // Notify via WebSocket
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'new_message',
            message: { ...sentMessage, status: 'sent' }
          }));
        }

        setNewMessage('');
        setAttachment(null);
        setRecordedAudio(null);
        toast.success('Message sent');
      } else {
        // Mark message as failed
         setSelectedConversation(prev => prev ? {
            ...prev,
            messages: prev.messages.map(msg =>
              msg.id === tempMessageId ? { ...msg, status: 'failed' } : msg
            )
          } : null);
        const text = await response.text();
        try {
          const errorData = JSON.parse(text);
          toast.error(`Failed to send message: ${errorData.error || 'Unknown error'}`);
        } catch {
          toast.error(`Failed to send message: ${text || 'Unknown error'}`);
        }
      }
    } catch (error) {
      console.error('Send message error:', error);
      setSelectedConversation(prev => prev ? {
        ...prev,
        messages: prev.messages.map(msg => 
          msg.id === tempMessageId ? { ...msg, status: 'failed' } : msg
        ),
      } : null);
      toast.error(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setSending(false);
    }
  };

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setNewMessage('');
    setEditingMessageId(null);
    if (currentUser?.role !== 'admin') {
      markMessagesAsRead(conversation.messages);
    }

      if (isMobileView) {
      setShowConversations(false);
    }
    
    // Notify typing end when switching conversations
    if (isTyping && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'typing_end',
        conversationId: conversation.otherUser.id
      }));
      setIsTyping(false);
    }
  };

  const handleTyping = () => {
    if (!selectedConversation || !newMessage.trim()) return;
    
    setIsTyping(true);
    clearTimeout(typingTimeoutRef.current);
    
    // Notify typing start
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'typing_start',
        conversationId: selectedConversation.otherUser.id
      }));
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      // Notify typing end
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'typing_end',
          conversationId: selectedConversation.otherUser.id
        }));
      }
    }, 1000);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setRecordingStartTime(Date.now());

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          setRecordedAudio(reader.result as string);
        };
        reader.readAsDataURL(audioBlob);
        setRecordingStartTime(null);

        // Stop the stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast.error('Please allow microphone access to record voice messages');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
    setRecordedAudio(null);
    setRecordingStartTime(null);
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendVoiceMessage = async () => {
    if (!recordedAudio || !selectedConversation) return;

    const tempMessageId = `temp-voice-${Date.now()}`;
    
    // Create optimistic voice message
    const optimisticMessage: Message = {
      id: tempMessageId,
      senderId: currentUser!.id,
      receiverId: selectedConversation.otherUser.id,
      itemId: selectedConversation.item?.id,
      content: 'Voice message',
      messageType: 'voice',
      audioData: recordedAudio,
      timestamp: new Date().toISOString(),
      read: false,
      status: 'sending'
    };

    // Update UI optimistically
    setSelectedConversation(prev => prev ? {
      ...prev,
      messages: [...prev.messages, optimisticMessage]
    } : null);

    setSending(true);

    try {
      const requestBody = {
        receiverId: selectedConversation.otherUser.id,
        itemId: selectedConversation.item?.id,
        messageType: 'voice',
        audioData: recordedAudio,
      };
      const response = await fetchWithAuth(`${API_URL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const data = await response.json();
        const sentMessage = data.message;
        
        // Replace optimistic message with real one
        setSelectedConversation(prev => prev ? {
          ...prev,
          messages: prev.messages.map(msg => 
            msg.id === tempMessageId ? { ...sentMessage, status: 'sent' } : msg
          )
        } : null);

        // Update conversations list
        setConversations(prev => {
          const updated = prev.map(convo => {
            if (convo.otherUser.id === selectedConversation.otherUser.id) {
              return {
                ...convo,
                messages: [...convo.messages, sentMessage],
                lastMessageTime: sentMessage.timestamp
              };
            }
            return convo;
          });
          
          updated.sort((a, b) => {
            return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
          });
          
          return updated;
        });

        setRecordedAudio(null);
        toast.success('Voice message sent');
      } else {
        setSelectedConversation(prev => prev ? {
          ...prev,
          messages: prev.messages.map(msg =>
            msg.id === tempMessageId ? { ...msg, status: 'failed' } : msg
          ),
        } : null);
        toast.error('Failed to send voice message');
      }
    } catch (error) {
      console.error('Send voice message error:', error);
      setSelectedConversation(prev => prev ? {
        ...prev,
        messages: prev.messages.map(msg =>
          msg.id === tempMessageId ? { ...msg, status: 'failed' } : msg
        ),
      } : null);
      toast.error(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setSending(false);
    }
  };

  const playAudio = (messageId: string, audioData: string) => {
    if (playingAudioId === messageId && currentAudioRef.current) {
      currentAudioRef.current.pause();
      setPlayingAudioId(null);
      return;
    }

    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
    }

    const audio = new Audio(audioData);
    currentAudioRef.current = audio;
    setPlayingAudioId(messageId);
    audio.onended = () => setPlayingAudioId(null);
    audio.onpause = () => setPlayingAudioId(null);
    audio.play();
  };

  const handleEditMessage = (message: Message) => {
    setEditingMessageId(message.id);
    setEditContent(message.content);
  };
  
  const handleSaveEdit = async () => {
    if (!editingMessageId || !editContent.trim()) return;

    if (!editingMessageId) {
      toast.error('Invalid message ID');
      return;
    }

    try {
      const response = await fetchWithAuth(`${API_URL}/messages/${editingMessageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: editContent.trim() })
      });

      if (response.ok) {
        // Update local state
        if (selectedConversation) {
          const updatedMessages = selectedConversation.messages.map(msg => 
            msg.id === editingMessageId ? { ...msg, content: editContent.trim(), isEdited: true } : msg
          );
          setSelectedConversation({ ...selectedConversation, messages: updatedMessages });

          setConversations(prev => prev.map(c =>
            c.otherUser.id === selectedConversation.otherUser.id 
              ? { ...c, messages: updatedMessages }
              : c
          ));
        }
        setEditingMessageId(null);
        setEditContent('');
        toast.success('Message updated');
      } else {
        const text = await response.text();
        try {
          const data = JSON.parse(text);
          toast.error(data.error || 'Failed to update message');
        } catch {
          toast.error(text || 'Failed to update message');
        }
      }
    } catch (error) {
      console.error('Update message error:', error);
      toast.error(error instanceof Error ? error.message : 'An error occurred');
    }
  };
  
  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Delete this message?')) return;

    if (!messageId) {
      toast.error('Invalid message ID');
      return;
    }

    try {
      const response = await fetchWithAuth(`${API_URL}/messages/${messageId}`, {
        method: 'DELETE',
      });

     if (response.ok) {
        // Update local state to show deleted
        if (selectedConversation) {
          const updatedMessages = selectedConversation.messages.map(msg => 
            msg.id === messageId ? { ...msg, isDeleted: true, content: "This message was deleted", messageType: 'text', audioData: null, attachmentData: null } : msg
          );
          setSelectedConversation({ ...selectedConversation, messages: updatedMessages });
        }
        toast.success('Message deleted');
      } else {
        const text = await response.text();
        try {
          const data = JSON.parse(text);
          toast.error(data.error || 'Failed to delete message');
        } catch {
          toast.error(text || 'Failed to delete message');
        }
      }
    } catch (error) {
      console.error('Delete message error:', error);
      toast.error(error instanceof Error ? error.message : 'An error occurred');
    }
  };
  
  const handleDeleteConversation = async () => {
    if (!selectedConversation || !confirm('Delete this entire conversation? This cannot be undone.')) return;

    if (!selectedConversation.otherUser?.id) {
      toast.error('Invalid conversation user');
      return;
    }

    try {
      const response = await fetchWithAuth(`${API_URL}/conversations/${selectedConversation.otherUser.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setConversations(prev => prev.filter(c => c.otherUser.id !== selectedConversation.otherUser.id));
        setSelectedConversation(null);
        toast.success('Conversation deleted');
      } else {
        const text = await response.text();
        try {
          const data = JSON.parse(text);
          toast.error(data.error || 'Failed to delete conversation');
        } catch {
          toast.error(text || 'Failed to delete conversation');
        }
      }
    } catch (error) {
      console.error('Delete conversation error:', error);
      toast.error(error instanceof Error ? error.message : 'An error occurred');
    }
  };
  
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size too large. Maximum size is 10MB.');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachment(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const cancelAttachment = () => {
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatRecordingTime = () => {
    if (!recordingStartTime) return '00:00';
    const seconds = Math.floor((Date.now() - recordingStartTime) / 1000);
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const getMessageStatusIcon = (status?: string) => {
    switch (status) {
      case 'sending':
        return <Loader2 className="h-3 w-3 animate-spin" />;
      case 'sent':
        return <Check className="h-3 w-3" />;
      case 'delivered':
        return <CheckCheck className="h-3 w-3" />;
      case 'read':
        return <Eye className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    if (diffHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const startCall = async (mode: CallMode) => {
    if (!selectedConversation || !currentUser) return;
    if (activeCallRef.current) {
      toast.error('Finish your current call first');
      return;
    }

    const peerId = selectedConversation.otherUser.id;
    const peerName = getUserDisplayName(selectedConversation.otherUser, 'Participant');
    const itemId = selectedConversation.item?.id;
    const callId = `call-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    setPlacingCall(true);
    try {
      const stream = await getCallMediaStream(mode, 'user');
      setLocalCallStream(stream);

      const peerConnection = ensurePeerConnection(callId, peerId, mode, itemId);
      stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

      const nextActiveCall = {
        callId,
        peerId,
        peerName,
        callerId: currentUser.id,
        callerName: currentUser.name || 'UNITRADE User',
        mode,
        itemId,
        status: 'calling',
        cameraFacing: 'user',
        speakerOn: true,
        isMuted: false,
        videoEnabled: mode === 'video',
        connectedAt: null,
      };
      activeCallRef.current = nextActiveCall;
      setActiveCall(nextActiveCall);

      const inviteSent = await sendCallSignalMessage(
        peerId,
        {
          ...buildSignalBase('invite', callId, mode),
        },
        itemId,
      );

      if (!inviteSent.success) {
        throw new Error(inviteSent.error || 'Failed to send call invite');
      }

      setActiveCall((prev) => {
        if (!prev) return prev;
        const next = { ...prev, status: 'ringing' as const };
        activeCallRef.current = next;
        return next;
      });
      startOutgoingRingtone();
      void fetchMessages();
      toast.success(`${mode === 'video' ? 'Video' : 'Audio'} calling...`);
    } catch (error) {
      console.error('Start call error:', error);
      clearCallResources(callId);
      toast.error(error instanceof Error ? error.message : 'Unable to start call');
    } finally {
      setPlacingCall(false);
    }
  };

  const endActiveCall = useCallback(async (notifyPeer = true) => {
    const active = activeCallRef.current;
    if (!active) return;
    const connectedAt = active.connectedAt;
    const hasConnected = Boolean(connectedAt || active.status === 'connected');
    const durationSeconds = connectedAt ? Math.max(1, Math.round((Date.now() - connectedAt) / 1000)) : undefined;

    if (notifyPeer) {
      await sendCallSignalMessage(
        active.peerId,
        {
          ...buildSignalBase('end', active.callId, active.mode),
        },
        active.itemId,
      );
    }

    await sendCallLogMessage(
      active.peerId,
      hasConnected
        ? buildCallLogBase(active.callId, active.mode, 'completed', {
            durationSeconds,
            callerId: active.callerId,
            callerName: active.callerName,
          })
        : buildCallLogBase(active.callId, active.mode, 'no_answer', {
            callerId: active.callerId,
            callerName: active.callerName,
          }),
      active.itemId,
    );

    clearCallResources(active.callId);
    toast.info(hasConnected ? 'Call ended' : 'No answer');
  }, [buildCallLogBase, buildSignalBase, clearCallResources, sendCallLogMessage, sendCallSignalMessage]);

  const acceptIncomingCall = async () => {
    if (!incomingCall || !currentUser || placingCall || activeCallRef.current) return;
    const acceptedCall = incomingCall;

    const existingConversation = conversations.find(
      (conversation) => conversation.otherUser.id === acceptedCall.senderId,
    );
    if (existingConversation) {
      handleSelectConversation(existingConversation);
    } else if (acceptedCall.itemId) {
      await handleStartNewConversation(acceptedCall.senderId, acceptedCall.itemId);
    }

    setPlacingCall(true);
    try {
      let stream: MediaStream;
      try {
        stream = await getCallMediaStream(acceptedCall.mode, 'user');
        setLocalCallStream(stream);
      } catch (mediaError) {
        console.warn('Incoming call accepted without local media stream:', mediaError);
        stream = new MediaStream();
        setLocalCallStream(null);
        toast.warning('Camera or microphone unavailable. Joining in listen-only mode.');
      }

      const peerConnection = ensurePeerConnection(
        acceptedCall.callId,
        acceptedCall.senderId,
        acceptedCall.mode,
        acceptedCall.itemId,
      );
      stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));
      const hasMicrophoneTrack = stream.getAudioTracks().length > 0;
      const hasVideoTrack = stream.getVideoTracks().length > 0;

      const nextActiveCall = {
        callId: acceptedCall.callId,
        peerId: acceptedCall.senderId,
        peerName: acceptedCall.senderName || 'Participant',
        callerId: acceptedCall.senderId,
        callerName: acceptedCall.senderName || 'UNITRADE User',
        mode: acceptedCall.mode,
        itemId: acceptedCall.itemId,
        status: 'connecting',
        cameraFacing: 'user',
        speakerOn: true,
        isMuted: !hasMicrophoneTrack,
        videoEnabled: acceptedCall.mode === 'video' ? hasVideoTrack : false,
        connectedAt: null,
      };
      activeCallRef.current = nextActiveCall;
      setActiveCall(nextActiveCall);
      scheduleConnectionWatchdog(
        acceptedCall.callId,
        acceptedCall.senderId,
        acceptedCall.mode,
        acceptedCall.itemId,
      );

      await flushQueuedSignalsForCall(
        acceptedCall.callId,
        acceptedCall.senderId,
        acceptedCall.itemId,
      );

      const acceptSignalResult = await sendCallSignalMessage(
        acceptedCall.senderId,
        {
          ...buildSignalBase('accept', acceptedCall.callId, acceptedCall.mode),
        },
        acceptedCall.itemId,
      );
      if (!acceptSignalResult.success) {
        throw new Error(acceptSignalResult.error || 'Failed to send call acceptance');
      }

      setIncomingCall(null);
      void fetchMessages();
    } catch (error) {
      console.error('Accept call error:', error);
      await sendCallSignalMessage(
        acceptedCall.senderId,
        {
          ...buildSignalBase('decline', acceptedCall.callId, acceptedCall.mode),
        },
        acceptedCall.itemId,
      );
      clearCallResources(acceptedCall.callId);
      toast.error('Unable to join this call');
    } finally {
      setPlacingCall(false);
    }
  };

  const declineIncomingCall = async () => {
    if (!incomingCall) return;

    await sendCallSignalMessage(
      incomingCall.senderId,
      {
        ...buildSignalBase('decline', incomingCall.callId, incomingCall.mode),
      },
      incomingCall.itemId,
    );
    await sendCallLogMessage(
      incomingCall.senderId,
      buildCallLogBase(incomingCall.callId, incomingCall.mode, 'declined', {
        callerId: incomingCall.senderId,
        callerName: incomingCall.senderName || 'UNITRADE User',
      }),
      incomingCall.itemId,
    );

    queuedSignalsRef.current.delete(incomingCall.callId);
    queuedIceRef.current.delete(incomingCall.callId);
    setIncomingCall(null);
    toast.info('Call declined');
  };

  const toggleMute = () => {
    setActiveCall((prev) => {
      if (!prev) return prev;
      const nextMuted = !prev.isMuted;
      localStreamRef.current?.getAudioTracks().forEach((track) => {
        track.enabled = !nextMuted;
      });
      return {
        ...prev,
        isMuted: nextMuted,
      };
    });
  };

  const toggleVideoTrack = () => {
    setActiveCall((prev) => {
      if (!prev || prev.mode !== 'video') return prev;
      const nextVideoEnabled = !prev.videoEnabled;
      localStreamRef.current?.getVideoTracks().forEach((track) => {
        track.enabled = nextVideoEnabled;
      });
      return {
        ...prev,
        videoEnabled: nextVideoEnabled,
      };
    });
  };

  const switchCamera = async () => {
    const active = activeCallRef.current;
    if (!active || active.mode !== 'video') return;

    const nextFacing: 'user' | 'environment' = active.cameraFacing === 'user' ? 'environment' : 'user';

    try {
      const replacement = await getCallMediaStream('video', nextFacing);
      const replacementVideoTrack = replacement.getVideoTracks()[0];
      if (!replacementVideoTrack) {
        throw new Error('Video track not available');
      }

      const peerConnection = peerConnectionRef.current;
      const videoSender = peerConnection?.getSenders().find((sender) => sender.track?.kind === 'video');
      if (videoSender) {
        await videoSender.replaceTrack(replacementVideoTrack);
      }

      const currentStream = localStreamRef.current;
      if (currentStream) {
        currentStream.getVideoTracks().forEach((track) => {
          currentStream.removeTrack(track);
          track.stop();
        });
        currentStream.addTrack(replacementVideoTrack);
        setLocalCallStream(new MediaStream(currentStream.getTracks()));
      } else {
        setLocalCallStream(new MediaStream([replacementVideoTrack]));
      }

      replacement.getAudioTracks().forEach((track) => track.stop());
      setActiveCall((prev) => (prev ? { ...prev, cameraFacing: nextFacing } : prev));
    } catch (error) {
      console.error('Switch camera error:', error);
      toast.error('Unable to switch camera');
    }
  };

  const toggleSpeaker = async () => {
    const active = activeCallRef.current;
    if (!active) return;
    const nextSpeakerOn = !active.speakerOn;

    const remoteAudio = remoteAudioRef.current;
    if (remoteAudio) {
      remoteAudio.volume = nextSpeakerOn ? 1 : 0.55;
      const candidateAudio = remoteAudio as HTMLAudioElement & { setSinkId?: (value: string) => Promise<void> };
      if (typeof candidateAudio.setSinkId === 'function') {
        try {
          await candidateAudio.setSinkId('default');
        } catch (_error) {
          // ignore: output routing depends on device/browser support
        }
      }
    }

    setActiveCall((prev) => (prev ? { ...prev, speakerOn: nextSpeakerOn } : prev));
  };

  return (
    <div className="min-h-screen bg-[#f1f3f5] text-foreground dark:bg-slate-950">
      <div className="w-full px-0">
        <Card className="w-full overflow-hidden border border-[#e6eaee] bg-white shadow-[0_24px_55px_-45px_rgba(15,23,42,0.45)] dark:border-white/10 dark:bg-slate-950/85">
          <CardHeader className="hidden border-b border-[#e6eaee] bg-white px-5 py-4 dark:border-white/10 dark:bg-slate-950/95 md:block">
            <div className="flex items-center gap-4">
              <h1 className="text-lg font-semibold text-[#0f5f4c] dark:text-emerald-300">
                Unitrade Messages
              </h1>
              <div className="flex items-center gap-1 rounded-md bg-[#f4f6f8] p-1 dark:bg-slate-900">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConversationFilter('all')}
                  className={`${conversationFilter === 'all' ? 'bg-white text-[#0f5f4c] shadow-sm dark:bg-slate-800 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'} h-7 px-3 text-xs`}
                >
                  All Chats
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConversationFilter('unread')}
                  className={`${conversationFilter === 'unread' ? 'bg-white text-[#0f5f4c] shadow-sm dark:bg-slate-800 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'} h-7 px-3 text-xs`}
                >
                  Unread
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConversationFilter('archived')}
                  className={`${conversationFilter === 'archived' ? 'bg-white text-[#0f5f4c] shadow-sm dark:bg-slate-800 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'} h-7 px-3 text-xs`}
                >
                  Archived
                </Button>
              </div>
              <div className="relative ml-auto w-full max-w-xs">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 border-[#d8dee5] bg-[#f8fafb] pl-9 text-sm focus-visible:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900/90"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex h-[55vh] min-h-[320px] items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex h-[calc(100dvh-76px)] sm:h-[calc(100dvh-88px)] md:h-[calc(100vh-190px)]">
                {/* Conversations List - WhatsApp style sidebar */}
                {(showConversations || !isMobileView) && (
                  <div className={`${isMobileView ? 'absolute inset-0 z-50 w-full' : 'w-full md:w-[320px] lg:w-[340px]'} border-r border-[#e6eaee] bg-[#f7f8f9] dark:border-white/10 dark:bg-slate-950/90 flex flex-col`}>
                    {/* Mobile header for conversations list */}
                    {isMobileView && (
                      <div className="space-y-3 border-b border-[#e6eaee] bg-white p-4 dark:border-white/10 dark:bg-slate-950">
                        <div className="flex items-center">
                        <h1 className="text-xl font-bold text-[#143d3a] dark:text-slate-100">Messages</h1>
                        {totalUnread > 0 && (
                          <Badge className="ml-2 border-0 bg-[#0f766e] text-white shadow-sm">
                            {totalUnread}
                          </Badge>
                        )}
                      </div>
                        <div className="flex items-center gap-1 rounded-md bg-[#f4f6f8] p-1 dark:bg-slate-900">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConversationFilter('all')}
                            className={`${conversationFilter === 'all' ? 'bg-white text-[#0f5f4c] shadow-sm dark:bg-slate-800 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'} h-7 px-3 text-xs`}
                          >
                            All Chats
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConversationFilter('unread')}
                            className={`${conversationFilter === 'unread' ? 'bg-white text-[#0f5f4c] shadow-sm dark:bg-slate-800 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'} h-7 px-3 text-xs`}
                          >
                            Unread
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setConversationFilter('archived')}
                            className={`${conversationFilter === 'archived' ? 'bg-white text-[#0f5f4c] shadow-sm dark:bg-slate-800 dark:text-emerald-300' : 'text-slate-500 dark:text-slate-400'} h-7 px-3 text-xs`}
                          >
                            Archived
                          </Button>
                        </div>
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <Input
                            placeholder="Search conversations..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-9 border-[#d8dee5] bg-[#f8fafb] pl-9 text-sm focus-visible:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900/90"
                          />
                        </div>
                      </div>
                    )}

                    {/* Conversations */}
                    <div className="flex-1 overflow-y-auto">
                      {filteredConversations.length === 0 ? (
                        <div className="px-4 py-12 text-center">
                          <p className="text-muted-foreground mb-4">
                            {conversationFilter === 'archived'
                              ? 'No archived conversations'
                              : searchQuery
                                ? 'No conversations found'
                                : 'No messages yet'}
                          </p>
                          {!searchQuery && (
                            <Button 
                              className="mt-4 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-600 hover:to-cyan-600"
                              onClick={() => navigate('/marketplace')}
                            >
                              Browse Marketplace
                            </Button>
                          )}
                        </div>
                      ) : (
                        filteredConversations.map((convo, index) => {
                          const lastMessage = convo.messages[convo.messages.length - 1];
                          const isSelected = selectedConversation?.otherUser.id === convo.otherUser.id;
                          
                          return (
                            <div
                              key={index}
                              className={`group cursor-pointer border-b border-[#eceff3] p-3 transition-all duration-200 hover:bg-[#f4fbf8] dark:border-white/5 dark:hover:bg-emerald-900/20 sm:p-4 ${
                                isSelected ? 'bg-[#e8f7f0] dark:bg-emerald-900/35' : ''
                              }`}
                              onClick={() => handleSelectConversation(convo)}
                            >
                              <div className="flex items-start gap-3">
                                <Avatar className="h-12 w-12">
                                  {convo.otherUser.avatar && (
                                    <AvatarImage src={convo.otherUser.avatar} />
                                  )}
                                  <AvatarFallback className="bg-[#0f766e] text-lg text-white">
                                    {getUserInitial(convo.otherUser)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-1">
                                    <p className="truncate font-semibold text-slate-900 dark:text-slate-100">
                                      {getUserDisplayName(convo.otherUser)}
                                    </p>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                      {formatTime(convo.lastMessageTime)}
                                    </p>
                                  </div>
                                  {convo.item && (
                                    <p className="text-xs text-muted-foreground mb-1 truncate">
                                      Re: {convo.item.title}
                                    </p>
                                  )}
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm text-muted-foreground truncate flex-1 mr-2">
                                      {lastMessage ? (
                                        <>
                                          {lastMessage.senderId === currentUser?.id && (
                                            <span className="text-muted-foreground">You: </span>
                                          )}
                                          {getMessagePreviewText(lastMessage)}
                                        </>
                                      ) : 'Start a conversation...'}
                                    </p>
                                    {convo.unreadCount > 0 && (
                                      <Badge className="flex h-5 min-w-5 items-center justify-center rounded-full border-0 bg-[#0f766e] p-0 text-white shadow-sm">
                                        {convo.unreadCount}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* Chat Area */}
                {(!isMobileView || !showConversations) && (
                  <div className={`${isMobileView ? 'w-full' : 'w-full md:flex-1'} flex flex-col bg-[#f5f5f5] dark:bg-slate-900/65 ${!isMobileView && selectedConversation ? 'lg:border-r lg:border-[#e6eaee] lg:dark:border-white/10' : ''}`}>
                    {selectedConversation ? (
                      <>
                        {/* Chat Header */}
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#e6eaee] bg-white p-3 dark:border-white/10 dark:bg-slate-950/95 sm:p-4">
                          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                            {isMobileView && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowConversations(true)}
                              >
                                <ChevronLeft className="h-5 w-5" />
                              </Button>
                            )}
                            <button
                              type="button"
                              onClick={() => openParticipantProfile(selectedConversation.otherUser.id)}
                              className="flex items-center gap-3 text-left"
                              title="View profile"
                            >
                              <Avatar className="h-10 w-10">
                                {selectedConversation.otherUser.avatar && (
                                  <AvatarImage src={selectedConversation.otherUser.avatar} />
                                )}
                                <AvatarFallback>
                                  {getUserInitial(selectedConversation.otherUser)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                  <p className="font-semibold text-[#1f2937] dark:text-slate-100">
                                    {getUserDisplayName(selectedConversation.otherUser)}
                                  </p>
                                  {typingUsers.has(selectedConversation.otherUser.id) && (
                                    <span className="animate-pulse text-xs text-cyan-600 dark:text-cyan-300">
                                      typing...
                                    </span>
                                  )}
                                </div>
                                {selectedConversation.otherUser.phone && (
                                  <div className="mb-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                                    <Phone className="h-3 w-3" />
                                    {selectedConversation.otherUser.phone}
                                  </div>
                                )}
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  {selectedConversation.item ? 'Active conversation' : 'Click to view profile'}
                                </p>
                              </div>
                            </button>
                          </div>
                          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="border border-cyan-200 bg-white text-cyan-700 hover:bg-cyan-50 dark:border-cyan-500/35 dark:bg-cyan-500/10 dark:text-cyan-200 dark:hover:bg-cyan-500/20"
                              onClick={() => startCall('audio')}
                              disabled={placingCall || currentUser?.role === 'admin' || Boolean(activeCall)}
                              title="Audio Call"
                            >
                              <Phone className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/35 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
                              onClick={() => startCall('video')}
                              disabled={placingCall || currentUser?.role === 'admin' || Boolean(activeCall)}
                              title="Video Call"
                            >
                              <Video className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost"
                              className="border border-rose-200 bg-rose-50/80 text-rose-600 hover:bg-rose-100 dark:border-rose-500/35 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20"
                              onClick={handleDeleteConversation}
                              title="Delete Conversation"
                              disabled={currentUser?.role === 'admin'}
                            >
                              <Trash2 className="h-5 w-5 text-red-500" />
                            </Button>
                          </div>
                        </div>

                        {/* Messages */}
                        <div 
                          ref={scrollContainerRef} 
                          className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.1),_transparent_52%),linear-gradient(180deg,_rgba(255,255,255,0.9)_0%,_rgba(236,253,245,0.55)_48%,_rgba(224,242,254,0.45)_100%)] p-3 dark:bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.2),_transparent_54%),linear-gradient(180deg,_rgba(15,23,42,0.92)_0%,_rgba(6,78,59,0.26)_50%,_rgba(7,89,133,0.2)_100%)] sm:p-4"
                        >
                          {selectedConversation.messages.length === 0 ? (
                            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                              <Avatar className="mb-4 h-20 w-20 ring-4 ring-white/80 shadow-xl dark:ring-white/10">
                                {selectedConversation.otherUser.avatar && (
                                  <AvatarImage src={selectedConversation.otherUser.avatar} />
                                )}
                                <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-cyan-500 text-2xl text-white">
                                  {getUserInitial(selectedConversation.otherUser)}
                                </AvatarFallback>
                              </Avatar>
                              <h3 className="text-xl font-semibold mb-2">
                                {getUserDisplayName(selectedConversation.otherUser)}
                              </h3>
                              {selectedConversation.item && (
                                <p className="text-sm text-muted-foreground mb-4">
                                  You're messaging about "{selectedConversation.item.title}"
                                </p>
                              )}
                              <p className="text-sm text-muted-foreground">
                                Start the conversation by sending a message
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {selectedConversation.messages.map((msg) => {
                                const isMe = msg.senderId === currentUser?.id;
                                const isAdmin = currentUser?.role === 'admin';
                                const isVoice = msg.messageType === 'voice';
                                const isImage = msg.messageType === 'image';
                                const isDeleted = msg.isDeleted;
                                const senderProfile = userCache.current.get(msg.senderId);
                                const callLog = parseCallLog(msg.content);

                                if (callLog) {
                                  const isOutgoingCall = Boolean(currentUser?.id && currentUser.id === callLog.callerId);
                                  const title = `${getCallModeLabel(callLog.mode)} call`;
                                  const statusText = getCallLogStatusText(callLog, currentUser?.id);
                                  const timeText = new Date(msg.timestamp).toLocaleTimeString([], {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  });
                                  const bubbleClass = isOutgoingCall
                                    ? 'bg-gradient-to-br from-emerald-500 to-teal-600 border-emerald-300/30 rounded-tr-none'
                                    : 'bg-gradient-to-br from-slate-700 to-slate-800 border-white/15 rounded-tl-none';
                                  return (
                                    <div
                                      key={msg.id}
                                      className={`flex items-end ${isOutgoingCall ? 'justify-end' : 'justify-start'}`}
                                    >
                                      <div className={`relative max-w-[86%] rounded-2xl border p-3 text-white shadow-md sm:max-w-[78%] md:max-w-[70%] ${bubbleClass}`}>
                                        <div className="flex items-center gap-3">
                                          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10">
                                            {callLog.mode === 'video' ? (
                                              <Video className="h-5 w-5" />
                                            ) : (
                                              <Phone className="h-5 w-5" />
                                            )}
                                            <span className="absolute -bottom-1 -right-1 rounded-full bg-black/35 p-0.5">
                                              {isOutgoingCall ? (
                                                <ArrowUpRight className="h-3 w-3" />
                                              ) : (
                                                <ArrowDownLeft className="h-3 w-3" />
                                              )}
                                            </span>
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <p className="text-[clamp(1rem,2.9vw,1.2rem)] font-semibold leading-tight">{title}</p>
                                            <div className="mt-1 flex items-end justify-between gap-3">
                                              <p className="text-sm text-white/85">{statusText}</p>
                                              <p className="shrink-0 text-sm text-white/70">{timeText}</p>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                }

                                // Determine alignment and styling
                                let isRightAligned = isMe;
                                let bubbleClass = isMe
                                  ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white rounded-tr-none shadow-md'
                                  : 'bg-white/95 border border-emerald-100 text-slate-900 rounded-tl-none shadow-sm dark:bg-slate-900/85 dark:border-slate-700 dark:text-slate-100';

                                if (isAdmin) {
                                  // For admin, align based on participants order in ID
                                  const [id1] = selectedConversation.otherUser.id.split('::');
                                  if (msg.senderId === id1) {
                                    isRightAligned = false;
                                      bubbleClass = 'bg-white/95 border border-slate-200 text-slate-900 rounded-tl-none shadow-sm dark:bg-slate-900/85 dark:border-slate-700 dark:text-slate-100';
                                    } else {
                                      isRightAligned = true;
                                      bubbleClass = 'bg-gradient-to-r from-sky-500 to-cyan-500 text-white rounded-tr-none shadow-md';
                                    }
                                  }

                                return (
                                  <div
                                    key={msg.id}
                                    className={`flex items-end gap-2 group ${isRightAligned ? 'justify-end' : 'justify-start'}`}
                                  >
                                    {!isRightAligned && (
                                      <Avatar className="h-8 w-8 mb-1">
                                        {senderProfile?.avatar && (
                                          <AvatarImage src={senderProfile.avatar} />
                                        )}
                                        <AvatarFallback>
                                          {(senderProfile?.name || '?').charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                    )}
                                    <div
                                      className={`relative max-w-[85%] rounded-2xl p-3 sm:max-w-[78%] md:max-w-[70%] ${
                                        isDeleted ? 'bg-slate-100/85 text-slate-500 italic dark:bg-slate-800/60 dark:text-slate-400' : bubbleClass
                                      }`}
                                    >
                                      {isAdmin && (
                                        <p className="text-xs text-muted-foreground mb-1 font-medium">
                                          {senderProfile?.name || 'Unknown'}
                                        </p>
                                      )}
                                      {isDeleted ? (
                                        <p className="text-sm">{msg.content}</p>
                                      ) : isVoice ? (
                                        <div className="space-y-2">
                                          <div className="flex items-center gap-3">
                                            <Button
                                              size="sm"
                                              variant={isMe || (isAdmin && isRightAligned) ? 'secondary' : 'ghost'}
                                              className={isMe || (isAdmin && isRightAligned) ? '' : 'text-cyan-600 hover:text-cyan-700 dark:text-cyan-300 dark:hover:text-cyan-200'}
                                              onClick={() => msg.audioData && playAudio(msg.id, msg.audioData)}
                                            >
                                              {playingAudioId === msg.id ? (
                                                <Pause className="h-4 w-4" />
                                              ) : (
                                                <Play className="h-4 w-4" />
                                              )}
                                            </Button>
                                            <span className={`text-xs ${isMe || (isAdmin && isRightAligned) ? 'text-white/80' : 'text-muted-foreground'}`}>
                                              Voice Message
                                            </span>
                                          </div>
                                        </div>
                                      ) : isImage ? (
                                        <div className="space-y-2">
                                          {msg.attachmentData && (
                                            <img 
                                              src={msg.attachmentData}
                                              alt="Attachment" 
                                              className="max-w-full rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                                              onClick={() => window.open(msg.attachmentData!, '_blank')}
                                            />
                                          )}
                                          {msg.content && msg.content !== 'Sent an image' && (
                                            <p className="text-sm">
                                              {msg.content}
                                              {msg.isEdited && <span className="text-[10px] opacity-70 ml-1">(edited)</span>}
                                            </p>
                                          )}
                                        </div>
                                      ) : (
                                        <div>
                                          {editingMessageId === msg.id ? (
                                            <div className="flex gap-2">
                                              <Input 
                                                value={editContent} 
                                                onChange={(e) => setEditContent(e.target.value)}
                                                className="h-8 border-emerald-200 bg-white/95 text-slate-900 focus-visible:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100"
                                              />
                                              <Button size="sm" onClick={handleSaveEdit} className="h-8 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-600 hover:to-cyan-600">Save</Button>
                                              <Button size="sm" variant="ghost" onClick={() => setEditingMessageId(null)} className="h-8">Cancel</Button>
                                            </div>
                                          ) : (
                                            <p className="text-sm">
                                              {msg.content}
                                              {msg.isEdited && <span className="text-[10px] opacity-70 ml-1">(edited)</span>}
                                            </p>
                                          )}
                                        </div>
                                      )}
                                      <div className={`flex items-center justify-end mt-1 ${
                                        isDeleted ? 'text-slate-400' : (isMe || (isAdmin && isRightAligned)) ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'
                                      }`}>
                                        <p className="text-xs">
                                          {new Date(msg.timestamp).toLocaleTimeString([], { 
                                            hour: '2-digit', 
                                            minute: '2-digit' 
                                          })}
                                        </p>
                                        {isMe && (
                                          <span className="ml-1">
                                            {getMessageStatusIcon(msg.status)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {isAdmin && isRightAligned && (
                                      <Avatar className="h-8 w-8 mb-1">
                                        {senderProfile?.avatar && (
                                          <AvatarImage src={senderProfile.avatar} />
                                        )}
                                        <AvatarFallback>
                                          {(senderProfile?.name || '?').charAt(0).toUpperCase()}
                                        </AvatarFallback>
                                      </Avatar>
                                    )}
                                    {isMe && !isDeleted && !editingMessageId && currentUser?.role !== 'admin' && msg.status !== 'sending' && (
                                      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {msg.messageType === 'text' && !parseCallSignal(msg.content) && (
                                          <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            className="h-6 w-6" 
                                            onClick={() => handleEditMessage(msg)}
                                          >
                                            <Edit2 className="h-3 w-3 text-muted-foreground" />
                                          </Button>
                                        )}
                                        <Button 
                                          size="icon" 
                                          variant="ghost" 
                                          className="h-6 w-6" 
                                          onClick={() => handleDeleteMessage(msg.id)}
                                        >
                                          <Trash2 className="h-3 w-3 text-red-500" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              <div ref={messagesEndRef} />
                              
                              {/* Typing indicator */}
                              {typingUsers.has(selectedConversation.otherUser.id) && (
                                <div className="flex items-end gap-2">
                                  <Avatar className="h-8 w-8 mb-1">
                                    {selectedConversation.otherUser.avatar && (
                                      <AvatarImage src={selectedConversation.otherUser.avatar} />
                                    )}
                                    <AvatarFallback>
                                      {getUserInitial(selectedConversation.otherUser)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="rounded-2xl rounded-tl-none border border-emerald-100 bg-white/90 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900/85">
                                    <div className="flex gap-1">
                                      <div className="h-2 w-2 rounded-full bg-emerald-500 animate-bounce" />
                                      <div className="h-2 w-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                                      <div className="h-2 w-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Message Input */}
                        <div className="space-y-3 border-t border-white/60 bg-gradient-to-r from-white/90 via-emerald-50/60 to-cyan-50/60 p-3 dark:border-white/10 dark:from-slate-950/85 dark:via-emerald-950/20 dark:to-cyan-950/20 sm:p-4">
                          {attachment && (
                            <div className="relative inline-block">
                              <img 
                                src={attachment} 
                                alt="Preview" 
                                className="h-20 w-20 cursor-pointer rounded-md border border-emerald-200 object-cover shadow-sm hover:opacity-90 dark:border-emerald-500/40"
                                onClick={() => window.open(attachment, '_blank')}
                              />
                              <button
                                onClick={cancelAttachment}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          )}

                          {recordedAudio && (
                            <div className="rounded-lg border border-cyan-200 bg-gradient-to-r from-sky-50 to-cyan-50 p-3 dark:border-cyan-500/35 dark:from-cyan-900/25 dark:to-sky-900/20 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-full bg-gradient-to-r from-cyan-500 to-sky-500 flex items-center justify-center">
                                  <Mic className="h-4 w-4 text-white" />
                                </div>
                                <div className="space-y-1">
                                  <span className="text-sm text-cyan-700 font-medium dark:text-cyan-200">Voice message recorded</span>
                                  <audio 
                                    src={recordedAudio} 
                                    controls 
                                    className="h-6"
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={cancelRecording}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="sm"
                                  className="bg-gradient-to-r from-cyan-500 to-sky-500 text-white hover:from-cyan-600 hover:to-sky-600"
                                  onClick={sendVoiceMessage}
                                  disabled={sending}
                                >
                                  {sending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Send className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          )}

                          {isRecording && (
                            <div className="rounded-lg border border-rose-200 bg-rose-50/95 p-3 dark:border-rose-500/35 dark:bg-rose-950/25 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex items-center gap-2">
                                <div className="h-3 w-3 rounded-full bg-red-600 animate-pulse"></div>
                                <div>
                                  <span className="text-sm text-rose-700 font-medium dark:text-rose-300">Recording...</span>
                                  <p className="text-xs text-rose-600 dark:text-rose-300/80">{formatRecordingTime()}</p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                className="bg-rose-600 text-white hover:bg-rose-700"
                                onClick={stopRecording}
                              >
                                <Square className="h-4 w-4 mr-1" />
                                Stop
                              </Button>
                            </div>
                          )}

                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <input
                              type="file"
                              ref={fileInputRef}
                              className="hidden"
                              accept="image/*"
                              onChange={handleFileSelect}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="shrink-0 border border-emerald-200 bg-white/85 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/40 dark:bg-slate-900/80 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={sending || isRecording || !!recordedAudio}
                            >
                              <Paperclip className="h-5 w-5" />
                            </Button>
                            <Input
                              placeholder={currentUser?.role === 'admin' ? "Monitoring mode (Read-only)" : "Type a message..."}
                              value={newMessage}
                              onChange={(e) => {
                                setNewMessage(e.target.value);
                                handleTyping();
                              }}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey && !isRecording && !recordedAudio) {
                                  e.preventDefault();
                                  handleSendMessage();
                                }
                              }}
                              disabled={sending || isRecording || !!recordedAudio || currentUser?.role === 'admin'}
                              className="min-w-0 flex-1 border-emerald-200 bg-white/90 shadow-sm focus-visible:ring-emerald-500 dark:border-slate-700 dark:bg-slate-900/85"
                            />
                            <Button
                              onClick={isRecording ? stopRecording : startRecording}
                              variant={isRecording ? 'destructive' : 'ghost'}
                              size="icon"
                              className={`shrink-0 ${isRecording ? '' : 'border border-cyan-200 bg-white/85 text-cyan-700 hover:bg-cyan-50 dark:border-cyan-500/40 dark:bg-slate-900/80 dark:text-cyan-300 dark:hover:bg-cyan-500/10'}`}
                              disabled={sending || !!recordedAudio || !!attachment || currentUser?.role === 'admin'}
                            >
                              <Mic className="h-5 w-5" />
                            </Button>
                            <Button
                              onClick={handleSendMessage}
                              disabled={sending || (!newMessage.trim() && !recordedAudio && !attachment) || currentUser?.role === 'admin'}
                              className="shrink-0 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-600 hover:to-cyan-600"
                            >
                              {sending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                        <div className="max-w-md">
                          <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 shadow-xl">
                            <ImageIcon className="h-10 w-10 text-white" />
                          </div>
                          <h3 className="mb-2 text-xl font-semibold text-slate-900 dark:text-slate-100">No conversation selected</h3>
                          <p className="text-sm text-muted-foreground mb-6">
                            Select a conversation from the list to start messaging, or browse the marketplace to contact sellers.
                          </p>
                          <Button
                            onClick={() => navigate('/marketplace')}
                            className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-600 hover:to-cyan-600"
                          >
                            Browse Marketplace
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!isMobileView && selectedConversation && (
                  <aside className="hidden w-[260px] flex-col bg-white dark:bg-slate-950/95 lg:flex xl:w-[290px]">
                    <div className="border-b border-[#e6eaee] px-4 py-5 text-center dark:border-white/10">
                      <button
                        type="button"
                        onClick={() => openParticipantProfile(selectedConversation.otherUser.id)}
                        className="mx-auto block"
                        title="View profile"
                      >
                        <Avatar className="mx-auto h-20 w-20 border-2 border-white shadow-md dark:border-slate-800">
                          {selectedConversation.otherUser.avatar && (
                            <AvatarImage src={selectedConversation.otherUser.avatar} />
                          )}
                          <AvatarFallback className="bg-[#0f766e] text-xl text-white">
                            {getUserInitial(selectedConversation.otherUser)}
                          </AvatarFallback>
                        </Avatar>
                        <h3 className="mt-3 text-xl font-semibold text-slate-900 dark:text-slate-100">
                          {getUserDisplayName(selectedConversation.otherUser)}
                        </h3>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {selectedConversation.otherUser.email || 'Campus Member'}
                        </p>
                      </button>
                      <Badge className="mt-3 border-0 bg-[#f7efe0] px-3 py-1 text-[#7a5b1f] dark:bg-amber-500/15 dark:text-amber-200">
                        Verified Student
                      </Badge>
                    </div>
                    <div className="space-y-3 px-4 py-5 text-sm">
                      <div className="rounded-xl border border-[#edf1f4] bg-[#f8fafb] p-3 dark:border-white/10 dark:bg-slate-900">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Email</p>
                        <p className="mt-1 truncate text-slate-700 dark:text-slate-200">
                          {selectedConversation.otherUser.email || 'Not available'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-[#edf1f4] bg-[#f8fafb] p-3 dark:border-white/10 dark:bg-slate-900">
                        <p className="text-xs uppercase tracking-wide text-slate-400">Phone</p>
                        <p className="mt-1 text-slate-700 dark:text-slate-200">
                          {selectedConversation.otherUser.phone || 'Not available'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-auto border-t border-[#e6eaee] p-4 dark:border-white/10">
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-500/10"
                        onClick={() => navigate(currentUser?.userType === 'seller' ? '/seller/reports' : '/buyer/report')}
                      >
                        <Flag className="mr-2 h-4 w-4" />
                        Report User
                      </Button>
                    </div>
                  </aside>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {incomingCall && (
          <div
            className="fixed inset-x-3 z-[110] mx-auto w-full max-w-md rounded-xl border border-emerald-200/70 bg-gradient-to-r from-white/95 to-cyan-50/90 p-4 shadow-[0_24px_60px_-35px_rgba(14,116,144,0.6)] backdrop-blur-xl dark:border-emerald-500/35 dark:from-slate-950/95 dark:to-cyan-950/35 sm:inset-x-auto sm:right-4"
            style={{ bottom: 'max(1rem, calc(env(safe-area-inset-bottom) + 1rem))' }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  Incoming {incomingCall.mode === 'video' ? 'video' : 'audio'} call
                </p>
                <p className="truncate text-sm text-slate-600 dark:text-slate-300">{incomingCall.senderName}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={declineIncomingCall} disabled={placingCall}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="outline" className="border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/20" onClick={declineIncomingCall} disabled={placingCall}>
                Decline
              </Button>
              <Button className="bg-gradient-to-r from-emerald-500 to-cyan-500 text-white hover:from-emerald-600 hover:to-cyan-600" onClick={acceptIncomingCall} disabled={placingCall}>
                {incomingCall.mode === 'video' ? <Video className="mr-1 h-4 w-4" /> : <Phone className="mr-1 h-4 w-4" />}
                Accept
              </Button>
            </div>
          </div>
        )}

        {activeCall && (
          <div className="fixed inset-0 z-[100] overflow-hidden bg-black text-white">
            <audio ref={remoteAudioRef} autoPlay playsInline />

            <div className="absolute inset-0">
              {activeCall.mode === 'video' ? (
                remoteCallStream ? (
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                    <p className="text-sm text-white/80">Waiting for video...</p>
                  </div>
                )
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.18),_transparent_55%),linear-gradient(180deg,_#081322_0%,_#030712_100%)] px-4 text-center">
                  <Avatar className="mb-6 h-36 w-36 border border-white/20 shadow-2xl">
                    <AvatarImage src={selectedConversation?.otherUser.avatar} />
                    <AvatarFallback className="bg-white/10 text-4xl text-white">
                      {(activeCall.peerName || '?').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}

              {activeCall.mode === 'video' && localCallStream && (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="absolute right-3 top-20 h-40 w-28 rounded-xl border border-white/25 bg-black/60 object-cover shadow-xl sm:right-5 sm:h-48 sm:w-36"
                />
              )}

              <div className="pointer-events-none absolute inset-x-0 top-10 text-center">
                <p className="text-2xl font-semibold drop-shadow">{activeCall.peerName}</p>
                <p className="mt-1 text-sm text-white/80">
                  {activeCall.status === 'calling' && 'Calling...'}
                  {activeCall.status === 'ringing' && 'Ringing...'}
                  {activeCall.status === 'connecting' && 'Connecting...'}
                  {activeCall.status === 'connected' && 'Connected'}
                </p>
              </div>

              {activeCall.mode === 'video' && (
                <div className="absolute right-4 top-36 flex flex-col gap-3">
                  <Button
                    type="button"
                    size="icon"
                    className="h-12 w-12 rounded-full bg-black/45 text-white hover:bg-black/65"
                    onClick={switchCamera}
                  >
                    <RefreshCcw className="h-5 w-5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    className="h-12 w-12 rounded-full bg-black/45 text-white hover:bg-black/65"
                    onClick={toggleVideoTrack}
                  >
                    {activeCall.videoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                  </Button>
                </div>
              )}

              <div className="absolute bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-black/55 p-2 shadow-xl backdrop-blur">
                <Button
                  type="button"
                  size="icon"
                  className="h-12 w-12 rounded-full bg-white/10 text-white hover:bg-white/20"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  className="h-12 w-12 rounded-full bg-white/10 text-white hover:bg-white/20"
                  onClick={toggleSpeaker}
                >
                  {activeCall.speakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                </Button>
                <Button
                  type="button"
                  size="icon"
                  className="h-12 w-12 rounded-full bg-white/10 text-white hover:bg-white/20"
                  onClick={toggleMute}
                >
                  {activeCall.isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>
                <Button
                  type="button"
                  size="icon"
                  className="h-12 w-12 rounded-full bg-red-600 text-white hover:bg-red-700"
                  onClick={() => endActiveCall(true)}
                >
                  <PhoneOff className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
