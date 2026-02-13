import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
}

interface ChatState {
  conversations: Conversation[];
  activeConversationId: string | null;
  addConversation: () => string;
  deleteConversation: (id: string) => void;
  setActiveConversation: (id: string) => void;
  addMessage: (conversationId: string, message: Omit<Message, "id" | "timestamp">) => void;
  updateConversationTitle: (id: string, title: string) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      conversations: [],
      activeConversationId: null,

      addConversation: () => {
        const newConv: Conversation = {
          id: crypto.randomUUID(),
          title: "New Chat",
          messages: [],
          createdAt: Date.now(),
        };
        set((state) => ({
          conversations: [newConv, ...state.conversations],
          activeConversationId: newConv.id,
        }));
        return newConv.id;
      },

      deleteConversation: (id) => {
        set((state) => {
          const newConvs = state.conversations.filter((c) => c.id !== id);
          return {
            conversations: newConvs,
            activeConversationId:
              state.activeConversationId === id
                ? newConvs[0]?.id || null
                : state.activeConversationId,
          };
        });
      },

      setActiveConversation: (id) => {
        set({ activeConversationId: id });
      },

      addMessage: (conversationId, message) => {
        set((state) => ({
          conversations: state.conversations.map((c) => {
            if (c.id !== conversationId) return c;
            
            const newMessage: Message = {
              ...message,
              id: crypto.randomUUID(),
              timestamp: Date.now(),
            };
            
            // Auto-update title for first user message
            let title = c.title;
            if (c.messages.length === 0 && message.role === "user") {
              title = message.content.slice(0, 30) || "New Chat";
            }

            return {
              ...c,
              title,
              messages: [...c.messages, newMessage],
            };
          }),
        }));
      },

      updateConversationTitle: (id, title) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, title } : c
          ),
        }));
      },
    }),
    {
      name: "omni-chat-storage",
    }
  )
);
