import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { Chat } from '@google/genai';
import { createChatSession, sendMessage, sendMessageWithSearch } from '../services/geminiService';
import { Message, MessageAuthor, ContentType, Project, Snapshot, BlastHit, ContentBlock, Pipeline, AiResponse, ToolCall, RecentChat } from '../types';
import { GREETINGS } from '../constants';
import { useAppContext } from '../App';

import ChatWindow from '../components/ChatWindow';
import ChatInput from '../components/ChatInput';
import PDBViewer from '../components/PDBViewer';
import MarkdownRenderer from '../components/MarkdownRenderer';
import BlastViewer from '../components/BlastChart';
import { PinIcon, ShareIcon, CheckIcon } from '../components/icons';

declare const window: any; // For SpeechRecognition

const Caption: React.FC<{ text: string }> = ({ text }) => (
    <p className="text-xs text-center font-semibold text-[var(--muted-foreground-color)] mb-2 uppercase tracking-wider">{text}</p>
);

const ChatbotPage: React.FC = () => {
  const { 
      projects, setProjects, pipelines, setApiStatus, 
      activeProjectId, activeProjectName, recentChats, setRecentChats,
      isNewChat, setIsNewChat
  } = useAppContext();
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Input & Voice State
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  // New Feature States
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  // Modals State
  const [isProjectModalOpen, setProjectModalOpen] = useState(false);
  const [isPipelineModalOpen, setPipelineModalOpen] = useState(false);
  const [contentToSave, setContentToSave] = useState<ContentBlock | null>(null);
  const [showCopiedTooltip, setShowCopiedTooltip] = useState(false);
  
  const historyKey = useMemo(() => activeProjectId ? `chatHistory_${activeProjectId}` : 'chatHistory_general', [activeProjectId]);
  
  const handleSaveToActiveProject = useCallback((contentBlock: ContentBlock) => {
    if (!activeProjectId) return;
    setProjects(prevProjects => 
        prevProjects.map(p => {
            if (p.id === activeProjectId) {
                const newBlock: ContentBlock = { id: `cb-${Date.now()}`, type: contentBlock.type, data: contentBlock.data };
                return { ...p, contentBlocks: [...p.contentBlocks, newBlock], lastModified: new Date().toISOString() };
            }
            return p;
        })
    );
    const systemMessage: Message = { id: `sys-${Date.now()}`, author: MessageAuthor.SYSTEM, content: `Content saved to project: "${activeProjectName}"`, rawContent: `Content saved to project: "${activeProjectName}"` };
    setMessages(prev => [...prev, systemMessage]);
  }, [activeProjectId, activeProjectName, setProjects]);
  
  const handleSaveContent = useCallback((contentBlock: ContentBlock) => {
    if (activeProjectId) {
        handleSaveToActiveProject(contentBlock);
    } else {
        setContentToSave(contentBlock);
        setProjectModalOpen(true);
    }
  }, [activeProjectId, handleSaveToActiveProject]);

  const handleShareContent = useCallback((contentBlock: ContentBlock) => {
    const id = `snap-${Date.now()}`;
    const snapshot: Snapshot = {
        id,
        createdAt: new Date().toISOString(),
        contentBlock: { ...contentBlock, id: `cb-${id}`},
    };

    localStorage.setItem(`snapshot_${id}`, JSON.stringify(snapshot));
    const url = `${window.location.origin}${window.location.pathname}#snapshot/${id}`;
    navigator.clipboard.writeText(url);
    setShowCopiedTooltip(true);
    setTimeout(() => setShowCopiedTooltip(false), 2000);
  }, []);

  const parseAndRenderResponse = useCallback((rawContent: string) => {
    try {
        const jsonStart = rawContent.indexOf('{');
        const jsonEnd = rawContent.lastIndexOf('}');
        if (jsonStart === -1 || jsonEnd === -1) throw new Error("No JSON object found");

        const jsonString = rawContent.substring(jsonStart, jsonEnd + 1);
        const response: AiResponse = JSON.parse(jsonString);
        const componentParts: React.ReactNode[] = [];

        if (response.prose) {
            componentParts.push(<MarkdownRenderer key="prose" content={response.prose} />);
        }

        if (response.tool_calls) {
            response.tool_calls.forEach((tool_call, index) => {
                try {
                    const { type, data } = tool_call;
                    const contentBlock: ContentBlock = { id: `tool-${Date.now()}-${index}`, type, data };
                    let contentWithCaption: React.ReactNode = null;

                    switch (type) {
                        case ContentType.PDB_VIEWER:
                            contentWithCaption = (<div><Caption text={`3D Structure: ${data.pdbId}`} /><PDBViewer pdbId={data.pdbId} /></div>);
                            break;
                        case ContentType.PUBMED_SUMMARY:
                            contentWithCaption = (<div className="p-4 bg-[var(--input-background-color)] rounded-lg border border-[var(--border-color)]"><Caption text="Literature Summary" /><h3 className="font-bold mb-2 primary-text">Summary</h3><MarkdownRenderer content={data.summary} /></div>);
                            break;
                        case ContentType.BLAST_RESULT:
                            contentWithCaption = (<div className="p-4 bg-[var(--input-background-color)] rounded-lg border border-[var(--border-color)]"><Caption text="BLAST Results" />{Array.isArray(data) ? <BlastViewer data={data} /> : <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(data, null, 2)}</pre>}</div>);
                            break;
                    }
                    
                    if (contentWithCaption) {
                         componentParts.push(
                            <div key={contentBlock.id} className="relative group my-2 first:mt-0 last:mb-0">
                                {contentWithCaption}
                                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                    <button onClick={() => handleSaveContent(contentBlock)} className="p-1.5 bg-slate-700/80 text-white rounded-full hover:bg-slate-600"><PinIcon /></button>
                                    <button onClick={() => handleShareContent(contentBlock)} className="p-1.5 bg-slate-700/80 text-white rounded-full hover:bg-slate-600"><ShareIcon /></button>
                                </div>
                            </div>
                        );
                    }
                } catch (renderError) {
                    console.error("Error rendering tool_call:", tool_call, renderError);
                    componentParts.push(<div key={`error-${index}`} className="text-red-500 text-sm">Error displaying tool output.</div>);
                }
            });
        }
        return <div>{componentParts}</div>;

    } catch (e) {
        console.error("Failed to parse AI response as JSON:", e, "Raw content:", rawContent);
        return <MarkdownRenderer content={rawContent} />;
    }
  }, [handleSaveContent, handleShareContent]);

  const rehydrateMessages = useCallback((storedMessages: any[]) => {
      return storedMessages.map(msg => ({
          ...msg,
          content: msg.author === MessageAuthor.RHESUS && msg.rawContent ? parseAndRenderResponse(msg.rawContent) : <MarkdownRenderer content={msg.rawContent || ''} />,
      }));
  }, [parseAndRenderResponse]);
  
  const handleToggleAudio = useCallback((messageId: string, text: string) => {
    if (speakingMessageId === messageId) {
        window.speechSynthesis.cancel();
        setSpeakingMessageId(null);
    } else {
        try {
            window.speechSynthesis.cancel();
            const utteranceText = JSON.parse(text).prose || text;
            const utterance = new SpeechSynthesisUtterance(utteranceText);
            utterance.onend = () => setSpeakingMessageId(null);
            setSpeakingMessageId(messageId);
            window.speechSynthesis.speak(utterance);
        } catch(e) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.onend = () => setSpeakingMessageId(null);
            setSpeakingMessageId(messageId);
            window.speechSynthesis.speak(utterance);
        }
    }
  }, [speakingMessageId]);
  
  const processSlashCommand = (command: string): string => {
    const parts = command.split(' ');
    const cmd = parts[0];
    const arg = parts.slice(1).join(' ');

    switch (cmd) {
        case '/visualize': return `Show me the 3D structure for PDB ID ${arg}`;
        case '/blast': return `Run a BLAST search for the following: ${arg}`;
        case '/search': return `Search the web for: ${arg}`;
        default: return command;
    }
  };

  const isLoadingRef = useRef(isLoading);
  useEffect(() => { isLoadingRef.current = isLoading; }, [isLoading]);

  const handleSendMessage = useCallback(async (messageContent: string, file?: File, replyToMessage?: Message | null): Promise<void> => {
      if (!chat || isLoadingRef.current) return;
      
      let finalPrompt = messageContent;
      if (file) {
          finalPrompt = `Analyze this uploaded PDB file: ${await file.text()}`;
      }
      
      if (finalPrompt.startsWith('/')) {
        finalPrompt = processSlashCommand(finalPrompt);
      }
      
      if (replyToMessage) {
          finalPrompt = `In reply to "${replyToMessage.rawContent}", ${finalPrompt}`;
      }
      
      if (!finalPrompt.trim()) return;
      
      const isStartingANewConversation = isNewChat;
      setIsNewChat(false); // Any message sent makes it an existing chat

      const displayedMessage = messageContent || `Uploaded ${file?.name}`;
      const newUserMessage: Message = { 
          id: Date.now().toString(), 
          author: MessageAuthor.USER, 
          content: <MarkdownRenderer content={displayedMessage} />, 
          rawContent: displayedMessage,
          replyTo: replyToMessage ? { id: replyToMessage.id, author: replyToMessage.author === MessageAuthor.USER ? "you" : "Dr. Rhesus", content: replyToMessage.rawContent || ''} : undefined
      };
      
      setMessages(prev => [...prev, newUserMessage]);
      setIsLoading(true);
      setInput('');
      setReplyingTo(null);
      
      if (isStartingANewConversation) {
          const chatId = activeProjectId || 'general';
          let title = finalPrompt.substring(0, 40);
          if (finalPrompt.length > 40) title += '...';
          const newChat: RecentChat = activeProjectId
              ? { id: activeProjectId, title, type: 'project', projectName: activeProjectName }
              : { id: 'general', title, type: 'general' };
          setRecentChats(prev => [newChat, ...prev.filter(c => c.id !== newChat.id)]);
      }

      try {
          const fullResponse = await sendMessage(chat, finalPrompt);

          let actions: any[] = [];
          try {
              const parsed: AiResponse = JSON.parse(fullResponse);
              actions = parsed.actions || [];
          } catch (e) { /* Ignore if not valid JSON */ }

          const rhesusMessage: Message = {
            id: `rhesus-${Date.now()}`,
            author: MessageAuthor.RHESUS,
            content: parseAndRenderResponse(fullResponse),
            rawContent: fullResponse,
            actions
          };

          setMessages(prev => [...prev, rhesusMessage]);
          setApiStatus('healthy');
      } catch (error) {
          setApiStatus('error');
          const errorMsg: Message = { id: `error-${Date.now()}`, author: MessageAuthor.SYSTEM, content: "Sorry, an error occurred communicating with the AI.", rawContent: "Sorry, an error occurred communicating with the AI." };
          setMessages(prev => [...prev, errorMsg]);
      } finally {
          setIsLoading(false);
      }
  }, [chat, setApiStatus, parseAndRenderResponse, activeProjectId, activeProjectName, recentChats, setRecentChats, isNewChat, setIsNewChat]);

  const handleSendMessageRef = useRef(handleSendMessage);
  useEffect(() => { handleSendMessageRef.current = handleSendMessage; }, [handleSendMessage]);

  const replyingToRef = useRef(replyingTo);
  useEffect(() => { replyingToRef.current = replyingTo; }, [replyingTo]);
  
  useEffect(() => {
    setChat(createChatSession());

    let initialMessages: Message[] = [];
    if (isNewChat) {
      const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
      initialMessages = [{ id: 'initial', author: MessageAuthor.RHESUS, content: <MarkdownRenderer content={greeting}/>, rawContent: greeting }];
    } else {
        const stored = localStorage.getItem(historyKey);
        if (stored) {
            try {
                const storedMessages = JSON.parse(stored);
                if (Array.isArray(storedMessages) && storedMessages.length > 0) {
                    initialMessages = rehydrateMessages(storedMessages);
                }
            } catch (e) {
                localStorage.removeItem(historyKey);
            }
        }
    }
    // If after all checks, messages are still empty, add initial greeting
    if(initialMessages.length === 0) {
        const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
        initialMessages = [{ id: 'initial', author: MessageAuthor.RHESUS, content: <MarkdownRenderer content={greeting}/>, rawContent: greeting }];
    }

    setMessages(initialMessages);

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
        setIsSpeechSupported(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.onstart = () => setIsRecording(true);
        recognition.onend = () => setIsRecording(false);
        recognition.onerror = (event: any) => { 
            console.error('Speech recognition error:', event.error); 
            setIsRecording(false); 
        };
        recognition.onresult = (event: any) => {
            const transcript = Array.from(event.results).map((result: any) => result[0].transcript).join('');
            setInput(transcript);
            if (event.results[0].isFinal) {
              handleSendMessageRef.current(transcript.trim(), undefined, replyingToRef.current);
              setInput('');
            }
        };
        recognitionRef.current = recognition;
    }
  }, [historyKey, rehydrateMessages, isNewChat]);

  useEffect(() => {
    const initialQuery = sessionStorage.getItem('initialQuery');
    if (initialQuery && chat) {
        sessionStorage.removeItem('initialQuery');
        handleSendMessage(initialQuery);
    }
  }, [chat, handleSendMessage]);

  useEffect(() => {
    // Don't save if it's a new chat that hasn't had any user interaction yet.
    if (isNewChat) return;

    const serializableMessages = messages.map(({ id, author, rawContent, actions, replyTo }) => ({ id, author, rawContent, actions, replyTo }));
    localStorage.setItem(historyKey, JSON.stringify(serializableMessages));
  }, [messages, historyKey, isNewChat]);
  
  const handleToggleRecording = () => {
    if (!recognitionRef.current) return;
    if (isRecording) {
        recognitionRef.current.stop();
    } else {
        setInput('');
        recognitionRef.current.start();
    }
  };
  
  const handleReply = useCallback((message: Message) => { setReplyingTo(message); }, []);
  const handleCancelReply = useCallback(() => { setReplyingTo(null); }, []);

  const handleSaveToProject = (projectId: string) => {
    if (!contentToSave) return;
    setProjects(prevProjects => 
        prevProjects.map(p => {
            if (p.id === projectId) {
                const newBlock: ContentBlock = { id: `cb-${Date.now()}`, type: contentToSave.type, data: contentToSave.data };
                return { ...p, contentBlocks: [...p.contentBlocks, newBlock], lastModified: new Date().toISOString() };
            }
            return p;
        })
    );
    setProjectModalOpen(false);
    setContentToSave(null);
    const savedProject = projects.find(p => p.id === projectId);
    if (savedProject) {
        const systemMessage: Message = { id: `sys-${Date.now()}`, author: MessageAuthor.SYSTEM, content: `Content saved to project: "${savedProject.title}"`, rawContent: `Content saved to project: "${savedProject.title}"` };
        setMessages(prev => [...prev, systemMessage]);
    }
  };

  const handleRunPipeline = async (pipeline: Pipeline, target: string) => {
    if (!target) { alert("Please provide a target for the pipeline (e.g., a protein name or PDB ID)."); return; }
    setPipelineModalOpen(false);
    const systemMessage: Message = { id: `sys-${Date.now()}`, author: MessageAuthor.SYSTEM, content: `Running pipeline "${pipeline.name}" with target "${target}"...`, rawContent: `Running pipeline "${pipeline.name}" with target "${target}"...` };
    setMessages(prev => [...prev, systemMessage]);
    for (const step of pipeline.steps) {
        const prompt = step.prompt.replace(/\{protein_name\}/g, target);
        await handleSendMessage(prompt);
    }
    const completionMessage: Message = { id: `sys-${Date.now()}-done`, author: MessageAuthor.SYSTEM, content: `Pipeline "${pipeline.name}" finished.`, rawContent: `Pipeline "${pipeline.name}" finished.` };
    setMessages(prev => [...prev, completionMessage]);
  };
  
  return (
    <div className="relative overflow-hidden flex flex-col h-full bg-[var(--background-color)]">
      <ChatWindow 
        messages={messages} 
        isLoading={isLoading} 
        onPromptClick={(prompt) => handleSendMessage(prompt)}
        onToggleAudio={handleToggleAudio}
        onReply={handleReply}
        speakingMessageId={speakingMessageId}
      />
      <ChatInput 
        onSendMessage={handleSendMessage} 
        isLoading={isLoading} 
        onRunPipeline={() => setPipelineModalOpen(true)}
        input={input}
        setInput={setInput}
        isRecording={isRecording}
        onToggleRecording={handleToggleRecording}
        isSpeechSupported={isSpeechSupported}
        replyingTo={replyingTo}
        onCancelReply={handleCancelReply}
      />
      
      {isProjectModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" onClick={() => setProjectModalOpen(false)}>
              <div className="bg-[var(--popover-background-color)] p-6 rounded-lg w-full max-w-md" onClick={e => e.stopPropagation()}>
                  <h3 className="font-bold text-lg mb-4 text-[var(--popover-foreground-color)]">Save to Project</h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                      {projects.length > 0 ? projects.map(p => <button key={p.id} onClick={() => handleSaveToProject(p.id)} className="w-full text-left p-3 bg-[var(--input-background-color)] hover:bg-[var(--border-color)] rounded-md text-[var(--popover-foreground-color)]">{p.title}</button>) : <p className="text-sm text-[var(--muted-foreground-color)]">No projects yet.</p>}
                  </div>
              </div>
          </div>
      )}
      {isPipelineModalOpen && (
          <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" onClick={() => setPipelineModalOpen(false)}>
              <PipelineRunnerModal pipelines={pipelines} onRun={handleRunPipeline} onClose={() => setPipelineModalOpen(false)} />
          </div>
      )}
      {showCopiedTooltip && <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-4 py-2 rounded-full text-sm z-50 flex items-center gap-2"><CheckIcon /> Copied sharing link to clipboard!</div>}
    </div>
  );
};

const PipelineRunnerModal: React.FC<{pipelines: any[], onRun: (p: any, t: string) => void, onClose: () => void}> = ({ pipelines, onRun, onClose }) => {
    const [selectedPipeline, setSelectedPipeline] = useState<any | null>(null);
    const [target, setTarget] = useState('');
    if (!selectedPipeline) {
        return (
            <div className="bg-[var(--popover-background-color)] p-6 rounded-lg w-full max-w-md" onClick={e => e.stopPropagation()}>
                <h3 className="font-bold text-lg mb-4 text-[var(--popover-foreground-color)]">Run a Pipeline</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                    {pipelines.length > 0 ? pipelines.map(p => <button key={p.id} onClick={() => setSelectedPipeline(p)} className="w-full text-left p-3 bg-[var(--input-background-color)] hover:bg-[var(--border-color)] rounded-md text-[var(--popover-foreground-color)]">{p.name}</button>) : <p className="text-[var(--muted-foreground-color)] text-sm">No pipelines created yet. Go to Settings to create one.</p>}
                </div>
            </div>
        )
    }
    return (
        <div className="bg-[var(--popover-background-color)] p-6 rounded-lg w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-1 text-[var(--popover-foreground-color)]">Run: {selectedPipeline.name}</h3>
            <p className="text-sm text-[var(--muted-foreground-color)] mb-4">{selectedPipeline.description}</p>
            <input type="text" value={target} onChange={e => setTarget(e.target.value)} placeholder="Enter target (e.g., PDB ID, protein name)" className="w-full bg-[var(--input-background-color)] p-3 rounded-md border border-[var(--border-color)] focus:primary-ring focus:outline-none mb-4" />
            <div className="flex justify-end gap-2">
                <button onClick={onClose} className="px-4 py-2 bg-slate-200 dark:bg-slate-600 rounded-md text-sm">Cancel</button>
                <button onClick={() => onRun(selectedPipeline, target)} className="px-4 py-2 primary-bg text-white rounded-md text-sm">Run</button>
            </div>
        </div>
    )
};

export default ChatbotPage;
