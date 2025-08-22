"use client";
import { useState, useCallback } from 'react';
import { buildAgent } from '@/agent/index';

type StreamMessage = {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'response' | 'done' | 'error';
  content: string;
  toolCalls?: any[];
  timestamp: number;
};

export function useAgent() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamMessages, setStreamMessages] = useState<StreamMessage[]>([]);

  const sendMessage = useCallback(async (messages: any[]) => {
    setIsStreaming(true);
    setStreamMessages([]);
    
    try {
      const { agent, client } = await buildAgent();
      
      // Stream the agent execution and capture each step
      const streamResult = await agent.stream({ messages });
      
      for await (const chunk of streamResult) {
        console.log('Stream chunk:', chunk);
        
        if (chunk && Array.isArray(chunk.messages)) {
          const lastMessage = chunk.messages[chunk.messages.length - 1];
          
          if (lastMessage) {
            let stepType: StreamMessage['type'] = 'thinking';
            let content = '';
            let toolCalls = null;
            
            if (lastMessage._getType?.() === 'ai' || lastMessage.role === 'assistant') {
              if (lastMessage.tool_calls && lastMessage.tool_calls.length > 0) {
                stepType = 'tool_call';
                toolCalls = lastMessage.tool_calls;
                content = `Calling ${lastMessage.tool_calls.map((tc: any) => tc.name).join(', ')}`;
              } else if (lastMessage.content && lastMessage.content.trim()) {
                stepType = 'response';
                content = typeof lastMessage.content === 'string' 
                  ? lastMessage.content 
                  : JSON.stringify(lastMessage.content);
              }
            } else if (lastMessage._getType?.() === 'tool' || lastMessage.role === 'tool') {
              stepType = 'tool_result';
              content = typeof lastMessage.content === 'string' 
                ? lastMessage.content 
                : JSON.stringify(lastMessage.content);
            }
            
            if (content || toolCalls) {
              const streamMessage: StreamMessage = {
                type: stepType,
                content,
                toolCalls,
                timestamp: Date.now()
              };
              
              setStreamMessages(prev => [...prev, streamMessage]);
              
              // Add delay for visual effect
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        }
      }
      
      // Get final result
      const finalResult = await agent.invoke({ messages });
      const out = Array.isArray((finalResult as any)?.messages) ? (finalResult as any).messages : [];
      const lastMessage = [...out].reverse().find((m: any) => m?.role === "assistant" || m?._getType?.() === "ai") ?? out[out.length - 1];
      const finalContent = typeof lastMessage?.content === 'string' 
        ? lastMessage.content 
        : JSON.stringify(lastMessage?.content);
      
      await client.close();
      setIsStreaming(false);
      
      return finalContent;
      
    } catch (error) {
      console.error('Agent error:', error);
      setIsStreaming(false);
      setStreamMessages([]);
      throw error;
    }
  }, []);

  return {
    sendMessage,
    isStreaming,
    streamMessages,
  };
}
