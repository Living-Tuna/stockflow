
"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useInventoryStore } from '@/hooks/use-inventory-store';
import { useAppData } from '@/contexts/app-data-context';
import type { ChatMessage } from '@/types';
import { ChatMessageItem } from './ChatMessageItem';
import { LogoSpinner } from '@/components/common/logo-spinner';
import { Send } from 'lucide-react';

interface ChatInterfaceProps {
  storeId: string;
  currentUserId: 'admin' | string;
  currentUserName: string;
}

export function ChatInterface({ storeId, currentUserId, currentUserName }: ChatInterfaceProps) {
  const { 
    messagesByStore, 
    addChatMessage, 
    getMessagesForStore,
  } = useInventoryStore((state) => ({
    messagesByStore: state.messagesByStore,
    addChatMessage: state.addChatMessage,
    getMessagesForStore: state.getMessagesForStore,
  }));
  const { ensureStoreChatLoaded } = useAppData();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const companyIdFromStorage = localStorage.getItem('companyId');
    if (companyIdFromStorage) {
      setCurrentCompanyId(companyIdFromStorage);
    } else {
      console.error("ChatInterface: Company ID not found in localStorage.");
      setIsLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (storeId && currentCompanyId) {
      setIsLoadingMessages(true);
      ensureStoreChatLoaded(storeId, currentCompanyId).finally(() => {
        setIsLoadingMessages(false);
      });
    } else if (!currentCompanyId) {
        setIsLoadingMessages(false); // No companyId, can't fetch
    }
  }, [storeId, currentCompanyId, ensureStoreChatLoaded]);
  
  useEffect(() => {
    setMessages(getMessagesForStore(storeId));
  }, [storeId, getMessagesForStore, messagesByStore]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollViewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (scrollViewport) {
        scrollViewport.scrollTop = scrollViewport.scrollHeight;
      }
    }
  }, [messages]); // Scroll on new messages

  useEffect(() => {
    if(!isLoadingMessages) inputRef.current?.focus();
  }, [isLoadingMessages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (newMessage.trim() && currentCompanyId && !isSending) {
      setIsSending(true);
      try {
        await addChatMessage(storeId, currentUserId, currentUserName, newMessage.trim(), currentCompanyId);
        setNewMessage('');
      } catch (error) {
        // Toast or error handling can be added here if addChatMessage throws
        console.error("Failed to send message:", error);
      } finally {
        setIsSending(false);
        // Refocus input after sending
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    } else if (!currentCompanyId) {
        console.error("Cannot send message: Company ID is missing.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-card text-card-foreground">
      <ScrollArea className="flex-1 p-4 space-y-4" ref={scrollAreaRef}>
        {isLoadingMessages ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <LogoSpinner size={32} className="mb-2" />
            <p>Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">No messages yet. Start the conversation!</p>
        ) : (
          messages.map((msg) => (
            <ChatMessageItem key={msg.id} message={msg} currentUserId={currentUserId} />
          ))
        )}
      </ScrollArea>
      <form onSubmit={handleSendMessage} className="p-3 border-t bg-background">
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            type="text"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="flex-1"
            autoComplete="off"
            disabled={!currentCompanyId || isLoadingMessages || isSending}
          />
          <Button type="submit" size="icon" aria-label="Send message" disabled={!currentCompanyId || isLoadingMessages || isSending || !newMessage.trim()}>
            {isSending ? <LogoSpinner size={20} className="h-5 w-5" alt="" /> : <Send className="h-5 w-5" />}
          </Button>
        </div>
      </form>
    </div>
  );
}
