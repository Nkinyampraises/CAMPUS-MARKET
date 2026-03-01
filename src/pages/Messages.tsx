import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Card, CardContent, CardHeader } from '@/app/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar';
import { Badge } from '@/app/components/ui/badge';
import { Separator } from '@/app/components/ui/separator';
import { 
  ArrowLeft, 
  Send, 
  Loader2, 
  Package, 
  Mic, 
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
  Phone,
  Video,
  Info,
  ChevronLeft,
  Trash2,
  Edit2
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:8002'}/make-server-50b25a4f`;
const ENABLE_MESSAGES_WEBSOCKET = String(import.meta.env.VITE_ENABLE_MESSAGES_WS || '').toLowerCase() === 'true';

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

export function Messages() {
  const { currentUser, isAuthenticated, accessToken } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [recordedAudio, setRecordedAudio] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  
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
  // Cache for user and item data to prevent re-fetching on every poll
  const userCache = useRef<Map<string, any>>(new Map());
  const itemCache = useRef<Map<string, any>>(new Map());

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

  // Calculate total unread messages
  const totalUnread = useMemo(() => 
    conversations.reduce((sum, c) => sum + c.unreadCount, 0),
    [conversations]
  );

  // Filter conversations based on search
  const filteredConversations = useMemo(() => {
    return conversations.filter(convo => 
      convo.otherUser.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      convo.item?.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      convo.messages[convo.messages.length - 1]?.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [conversations, searchQuery]);

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

  // Helper to mark messages as read
  const markMessagesAsRead = useCallback(async (messages: Message[]) => {
    const unreadMessages = messages.filter(m => 
      m.receiverId === currentUser?.id && !m.read
    );

    for (const msg of unreadMessages) {
      try {
        await fetch(`${API_URL}/messages/${msg.id}/read`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
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
  }, [currentUser, accessToken]);

  // Fetch messages function
  const fetchMessages = useCallback(async () => {
    if (!currentUser) return;

    try {
      const endpoint = currentUser.role === 'admin' ? '/admin/messages' : '/messages';
      const response = await fetch(`${API_URL}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const messages: Message[] = data.messages;

        // Populate user cache from response if available (for admin)
        if (data.users && Array.isArray(data.users)) {
            data.users.forEach((u: any) => userCache.current.set(u.id, u));
        }

        // 1. Identify missing users and items
        const userIdsToFetch = new Set<string>();
        const itemIdsToFetch = new Set<string>();

        messages.forEach(msg => {
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
              const res = await fetch(`${API_URL}/users/${id}`, {
                 headers: { 'Authorization': `Bearer ${accessToken}` }
              });
              if (res.ok) {
                const data = await res.json();
                userCache.current.set(id, data.user);
              } else {
                 userCache.current.set(id, { id, name: 'Unknown User', email: '' });
              }
            } catch (e) {
              console.error(`Failed to fetch user ${id}`, e);
            }
          }),
          ...Array.from(itemIdsToFetch).map(async (id) => {
            try {
              const res = await fetch(`${API_URL}/listings/${id}`, {
                 headers: { 'Authorization': `Bearer ${accessToken}` }
              });
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
          for (const msg of messages) {
            const participants = [msg.senderId, msg.receiverId].sort();
            const key = participants.join('::');
            if (!conversationMap.has(key)) {
              conversationMap.set(key, []);
            }
            conversationMap.get(key)!.push(msg);
          }
        } else {
          for (const msg of messages) {
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
  }, [currentUser, accessToken, searchParams, isMobileView, markMessagesAsRead]);

  // Fetch messages with retry logic
  const fetchMessagesWithRetry = useCallback(async (retries = 3) => {
    for (let i = 0; i < retries; i++) {
      try {
        await fetchMessages();
        break;
      } catch (error) {
        if (i === retries - 1) {
          toast.error('Failed to load messages. Please refresh.');
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }, [fetchMessages]);

  // Handle starting a new conversation
  const handleStartNewConversation = useCallback(async (userId: string, itemId: string) => {
    try {
      // Fetch user info
      const userResponse = await fetch(`${API_URL}/users/${userId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });
      
      // Fetch item info
      const itemResponse = await fetch(`${API_URL}/listings/${itemId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      });

      const userData = userResponse.ok ? await userResponse.json() : null;
      const itemData = itemResponse.ok ? await itemResponse.json() : null;

      // Update cache
      if (userData?.user) userCache.current.set(userId, userData.user);
      if (itemData?.listing) itemCache.current.set(itemId, itemData.listing);

      const newConvo: Conversation = {
        otherUser: userData?.user || { 
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
  }, [accessToken, conversations, isMobileView]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchMessagesWithRetry();
    
    // Poll for new messages every 3 seconds to ensure seller receives messages
    const pollInterval = setInterval(() => {
      if (!sending && !isRecording) {
        fetchMessages();
      }
    }, 3000);

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
        if (selectedConversationRef.current?.otherUser.id === userId) {
           return;
        }
        handleStartNewConversation(userId, itemId);
      }
    }

    return () => clearInterval(pollInterval);
  }, [isAuthenticated, navigate, fetchMessagesWithRetry, searchParams, location.state, sending, isRecording, fetchMessages, handleStartNewConversation]);

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

  const handleNewMessage = (message: Message) => {
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
      const response = await fetch(`${API_URL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          receiverId: selectedConversation.otherUser.id,
          itemId: selectedConversation.item?.id,
          content: sanitizedContent || (attachment ? 'Sent an image' : recordedAudio ? 'Voice message' : ''),
          messageType: attachment ? 'image' : recordedAudio ? 'voice' : 'text',
          audioData: recordedAudio,
          attachmentData: attachment,
        }),
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
      const response = await fetch(`${API_URL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          receiverId: selectedConversation.otherUser.id,
          itemId: selectedConversation.item?.id,
          messageType: 'voice',
          audioData: recordedAudio,
        }),
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
      } else {
        toast.error('Failed to send voice message');
      }
    } catch (error) {
      console.error('Send voice message error:', error);
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

    if (!accessToken) {
      toast.error('You must be logged in');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/messages/${editingMessageId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
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

    if (!accessToken) {
      toast.error('You must be logged in');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/messages/${messageId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` },
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

    if (!accessToken) {
      toast.error('You must be logged in');
      return;
    }

    if (!selectedConversation.otherUser?.id) {
      toast.error('Invalid conversation user');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/conversations/${selectedConversation.otherUser.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` },
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

  return (
    <div className="bg-gray-50 min-h-screen">
      <div className="container mx-auto px-0">
        <div className="hidden md:block p-4">
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>

        <Card className="md:mx-4">
          <CardHeader className="hidden md:block">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">Messages</h1>
                {totalUnread > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {totalUnread} unread message{totalUnread !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center items-center py-12 h-[600px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="flex h-[calc(100vh-140px)] md:h-[calc(100vh-180px)]">
                {/* Conversations List - WhatsApp style sidebar */}
                {(showConversations || !isMobileView) && (
                  <div className={`${isMobileView ? 'absolute inset-0 z-50 bg-white' : 'w-full md:w-1/3'} border-r flex flex-col`}>
                    {/* Mobile header for conversations list */}
                    {isMobileView && (
                      <div className="p-4 border-b flex items-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate('/dashboard')}
                        >
                          <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <h1 className="ml-4 text-xl font-bold">Messages</h1>
                        {totalUnread > 0 && (
                          <Badge className="ml-2 bg-green-600">
                            {totalUnread}
                          </Badge>
                        )}
                      </div>
                    )}
                    
                    {/* Search bar */}
                    <div className="p-4 border-b">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Search messages..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>

                    {/* Conversations */}
                    <div className="flex-1 overflow-y-auto">
                      {filteredConversations.length === 0 ? (
                        <div className="text-center py-12 px-4">
                          <p className="text-muted-foreground mb-4">
                            {searchQuery ? 'No conversations found' : 'No messages yet'}
                          </p>
                          {!searchQuery && (
                            <Button 
                              className="mt-4"
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
                              className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors border-b ${
                                isSelected ? 'bg-gray-100' : ''
                              }`}
                              onClick={() => handleSelectConversation(convo)}
                            >
                              <div className="flex items-start gap-3">
                                <Avatar className="h-12 w-12">
                                  {convo.otherUser.avatar && (
                                    <AvatarImage src={convo.otherUser.avatar} />
                                  )}
                                  <AvatarFallback className="text-lg">
                                    {convo.otherUser.name.charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-1">
                                    <p className="font-semibold truncate">
                                      {convo.otherUser.name}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {formatTime(convo.lastMessageTime)}
                                    </p>
                                  </div>
                                  {convo.item && (
                                    <p className="text-xs text-muted-foreground mb-1 truncate">
                                      Re: {convo.item.title}
                                    </p>
                                  )}
                                  <div className="flex items-center justify-between">
                                    <p className="text-sm text-gray-600 truncate flex-1 mr-2">
                                      {lastMessage ? (
                                        <>
                                          {lastMessage.senderId === currentUser?.id && (
                                            <span className="text-gray-500">You: </span>
                                          )}
                                          {lastMessage.messageType === 'voice' ? '🎤 Voice message' : 
                                           lastMessage.messageType === 'image' ? '📷 Image' : 
                                           lastMessage.content}
                                        </>
                                      ) : 'Start a conversation...'}
                                    </p>
                                    {convo.unreadCount > 0 && (
                                      <Badge className="bg-green-600 text-white h-5 w-5 min-w-5 p-0 flex items-center justify-center">
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
                  <div className={`${isMobileView ? 'w-full' : 'w-full md:w-2/3'} flex flex-col`}>
                    {selectedConversation ? (
                      <>
                        {/* Chat Header */}
                        <div className="p-4 border-b bg-white flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {isMobileView && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setShowConversations(true)}
                              >
                                <ChevronLeft className="h-5 w-5" />
                              </Button>
                            )}
                            <Avatar className="h-10 w-10">
                              {selectedConversation.otherUser.avatar && (
                                <AvatarImage src={selectedConversation.otherUser.avatar} />
                              )}
                              <AvatarFallback>
                                {selectedConversation.otherUser.name.charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold">
                                  {selectedConversation.otherUser.name}
                                </p>
                                {typingUsers.has(selectedConversation.otherUser.id) && (
                                  <span className="text-xs text-green-600 animate-pulse">
                                    typing...
                                  </span>
                                )}
                                {selectedConversation.item && (
                                  <Badge variant="outline" className="text-xs h-5 ml-2">
                                    {selectedConversation.item.sellerId === selectedConversation.otherUser.id ? 'Seller' : 'Buyer'}
                                  </Badge>
                                )}
                              </div>
                              {selectedConversation.otherUser.phone && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                                  <Phone className="h-3 w-3" />
                                  {selectedConversation.otherUser.phone}
                                </div>
                              )}
                              {selectedConversation.item ? (
                                <div className="flex items-center gap-2 mt-1">
                                  <Package className="h-3 w-3 text-muted-foreground" />
                                  <p className="text-xs text-muted-foreground">
                                    {selectedConversation.item.title}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">
                                  Click to view profile
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {selectedConversation.item && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => navigate(`/item/${selectedConversation.item!.id}`)}
                              >
                                View Item
                              </Button>
                            )}
                            <Button 
                              size="icon" 
                              variant="ghost"
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
                          className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-gray-50 to-white"
                        >
                          {selectedConversation.messages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-8">
                              <Avatar className="h-20 w-20 mb-4">
                                {selectedConversation.otherUser.avatar && (
                                  <AvatarImage src={selectedConversation.otherUser.avatar} />
                                )}
                                <AvatarFallback className="text-2xl">
                                  {selectedConversation.otherUser.name.charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <h3 className="text-xl font-semibold mb-2">
                                {selectedConversation.otherUser.name}
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

                                // Determine alignment and styling
                                let isRightAligned = isMe;
                                let bubbleClass = isMe 
                                  ? 'bg-green-600 text-white rounded-tr-none' 
                                  : 'bg-gray-100 text-gray-900 rounded-tl-none';

                                if (isAdmin) {
                                  // For admin, align based on participants order in ID
                                  const [id1] = selectedConversation.otherUser.id.split('::');
                                  if (msg.senderId === id1) {
                                    isRightAligned = false;
                                    bubbleClass = 'bg-white border border-gray-200 text-gray-900 rounded-tl-none';
                                  } else {
                                    isRightAligned = true;
                                    bubbleClass = 'bg-blue-50 border border-blue-100 text-gray-900 rounded-tr-none';
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
                                      className={`max-w-[70%] rounded-2xl p-3 relative ${
                                        isDeleted ? 'bg-gray-200 text-gray-500 italic' : bubbleClass
                                      }`}
                                    >
                                      {isAdmin && (
                                        <p className="text-xs text-gray-500 mb-1 font-medium">
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
                                              className={isMe || (isAdmin && isRightAligned) ? '' : 'text-green-600 hover:text-green-700'}
                                              onClick={() => msg.audioData && playAudio(msg.id, msg.audioData)}
                                            >
                                              {playingAudioId === msg.id ? (
                                                <Pause className="h-4 w-4" />
                                              ) : (
                                                <Play className="h-4 w-4" />
                                              )}
                                            </Button>
                                            <span className={`text-xs ${isMe || (isAdmin && isRightAligned) ? 'text-green-100' : 'text-gray-500'}`}>
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
                                                className="h-8 text-black"
                                              />
                                              <Button size="sm" onClick={handleSaveEdit} className="h-8">Save</Button>
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
                                        isDeleted ? 'text-gray-400' : (isMe || (isAdmin && isRightAligned)) ? 'text-green-100' : 'text-gray-400'
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
                                        {msg.messageType === 'text' && (
                                          <Button 
                                            size="icon" 
                                            variant="ghost" 
                                            className="h-6 w-6" 
                                            onClick={() => handleEditMessage(msg)}
                                          >
                                            <Edit2 className="h-3 w-3 text-gray-500" />
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
                                      {selectedConversation.otherUser.name.charAt(0).toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="bg-gray-100 rounded-2xl rounded-tl-none p-3">
                                    <div className="flex gap-1">
                                      <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" />
                                      <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                      <div className="h-2 w-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Message Input */}
                        <div className="p-4 border-t bg-white space-y-3">
                          {attachment && (
                            <div className="relative inline-block">
                              <img 
                                src={attachment} 
                                alt="Preview" 
                                className="h-20 w-20 object-cover rounded-md border cursor-pointer hover:opacity-90"
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
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
                                  <Mic className="h-4 w-4 text-white" />
                                </div>
                                <div className="space-y-1">
                                  <span className="text-sm text-blue-700 font-medium">Voice message recorded</span>
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
                                  className="bg-blue-600 hover:bg-blue-700"
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
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="h-3 w-3 rounded-full bg-red-600 animate-pulse"></div>
                                <div>
                                  <span className="text-sm text-red-700 font-medium">Recording...</span>
                                  <p className="text-xs text-red-600">{formatRecordingTime()}</p>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                className="bg-red-600 hover:bg-red-700"
                                onClick={stopRecording}
                              >
                                <Square className="h-4 w-4 mr-1" />
                                Stop
                              </Button>
                            </div>
                          )}

                          <div className="flex gap-2">
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
                              onClick={() => fileInputRef.current?.click()}
                              disabled={sending || isRecording || !!recordedAudio}
                            >
                              <Paperclip className="h-5 w-5" />
                            </Button>
                            <Input
                              placeholder={currentUser.role === 'admin' ? "Monitoring mode (Read-only)" : "Type a message..."}
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
                              disabled={sending || isRecording || !!recordedAudio || currentUser.role === 'admin'}
                              className="flex-1"
                            />
                            <Button
                              onClick={isRecording ? stopRecording : startRecording}
                              variant={isRecording ? 'destructive' : 'ghost'}
                              size="icon"
                              disabled={sending || !!recordedAudio || !!attachment || currentUser.role === 'admin'}
                            >
                              <Mic className="h-5 w-5" />
                            </Button>
                            <Button
                              onClick={handleSendMessage}
                              disabled={sending || (!newMessage.trim() && !recordedAudio && !attachment) || currentUser.role === 'admin'}
                              className="bg-green-600 hover:bg-green-700"
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
                      <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                        <div className="max-w-md">
                          <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                            <ImageIcon className="h-10 w-10 text-gray-400" />
                          </div>
                          <h3 className="text-xl font-semibold mb-2">No conversation selected</h3>
                          <p className="text-sm text-muted-foreground mb-6">
                            Select a conversation from the list to start messaging, or browse the marketplace to contact sellers.
                          </p>
                          <Button
                            onClick={() => navigate('/marketplace')}
                            className="bg-green-600 hover:bg-green-700"
                          >
                            Browse Marketplace
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
