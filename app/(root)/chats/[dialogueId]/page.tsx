'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { useChatHistory, useUpload } from '@/hooks/useApiExtras';
import {
  useGenerateAI,
  convertMediaToInputs,
  normalizeResultMedia,
} from '@/hooks/useGenerations';
import { useAIModels } from '@/hooks/useModels';
import { useRoles } from '@/hooks/useRoles';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import {
  ChevronLeft,
  Send,
  ImagePlus,
  Loader2,
  X,
  Download,
  Pause,
  Play,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { useHaptic } from '@/hooks/useHaptic';
import { cn } from '@/lib/utils';
import { localize } from '@/lib/utils';
import { useTranslations } from 'next-intl';

/* ── Types ── */
interface MediaItem {
  type?: string;
  url?: string;
  input?: string | { type: string; format: string; input: string };
  format?: string;
}
interface Message {
  id: number;
  model: string;
  version: string;
  role_id?: number | null;
  inputs?: {
    text?: string;
    image?: string[];
    video?: string[];
    audio?: string[];
    media?: MediaItem[];
  };
  result?: { text?: string; media?: MediaItem[] };
  status: 'completed' | 'processing' | 'error' | 'pending';
  error?: string | null;
  cost?: number;
  created_at?: string;
}

/* ── sessionStorage helpers ── */
const STORAGE_KEY = (id: string) => `dialogue_model_${id}`;
function readStoredModel(id: string) {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY(id));
    if (raw)
      return JSON.parse(raw) as {
        model: string;
        version: string;
        role_id: number | null;
      };
  } catch { }
  return null;
}
function writeStoredModel(
  id: string,
  model: string,
  version: string,
  role_id: number | null
) {
  try {
    sessionStorage.setItem(
      STORAGE_KEY(id),
      JSON.stringify({ model, version, role_id })
    );
  } catch { }
}

function getDialogueModel(
  dialogueId: string | null,
  messages: Message[],
  urlParams?: {
    model?: string | null;
    version?: string | null;
    role?: string | null;
  }
): { model: string | null; version: string | null; roleId: number | null } {
  if (!dialogueId) return { model: null, version: null, roleId: null };
  let fromHistory = messages.find((m) => m.model);
  if (!fromHistory && messages.length > 0) fromHistory = messages[0];
  if (fromHistory && (fromHistory.model || fromHistory.version)) {
    const model = fromHistory.model || fromHistory.version || '';
    const version = fromHistory.version || '';
    const roleId = fromHistory.role_id ?? null;
    writeStoredModel(dialogueId, model, version, roleId);
    return { model: model || null, version: version || null, roleId };
  }
  const cached = readStoredModel(dialogueId);
  if (cached)
    return {
      model: cached.model,
      version: cached.version,
      roleId: cached.role_id,
    };
  if (dialogueId === 'new' && urlParams?.model) {
    const roleId = urlParams.role ? parseInt(urlParams.role) : null;
    return {
      model: urlParams.model,
      version: urlParams.version ?? null,
      roleId: isNaN(roleId as number) ? null : roleId,
    };
  }
  return { model: null, version: null, roleId: null };
}

function extractDisplayMedia(
  inputs: Message['inputs']
): { url: string; type: string }[] {
  const r: { url: string; type: string }[] = [];
  if (!inputs) return r;
  (inputs.image || []).forEach((url) => r.push({ url, type: 'image' }));
  (inputs.video || []).forEach((url) => r.push({ url, type: 'video' }));
  (inputs.audio || []).forEach((url) => r.push({ url, type: 'audio' }));
  (inputs.media || []).forEach((m) => {
    let url = '',
      type = 'image';
    if (typeof m.input === 'object' && m.input !== null) {
      url = m.input.input || '';
      type = m.input.type || 'image';
    } else {
      url = m.url || m.input || '';
      type = m.type || 'image';
    }
    if (url) r.push({ url, type });
  });
  return r;
}

function extractResultMedia(result: Message['result']) {
  return result?.media ? normalizeResultMedia(result.media) : [];
}

/* ── AudioPlayer ── */
function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = () => {
    const a = audioRef.current;
    if (!a) return;
    if (isPlaying) a.pause();
    else a.play();
  };
  const format = (t: number) => {
    if (!t) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60)
      .toString()
      .padStart(2, '0');
    return `${m}:${s}`;
  };

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const play = () => setIsPlaying(true);
    const pause = () => setIsPlaying(false);
    a.addEventListener('play', play);
    a.addEventListener('pause', pause);
    return () => {
      a.removeEventListener('play', play);
      a.removeEventListener('pause', pause);
    };
  }, []);

  return (
    <div className="flex flex-col gap-2 w-full">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={() => {
          const a = audioRef.current;
          if (a) setProgress(a.currentTime);
        }}
        onLoadedMetadata={() => {
          const a = audioRef.current;
          if (a) setDuration(a.duration);
        }}
      />
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlay}
          className="w-10 h-10 rounded-full flex items-center justify-center
            bg-white/[.08] border border-white/[.14] active:scale-90 transition-transform duration-150"
        >
          {isPlaying ? (
            <Pause size={16} className="text-white/80" />
          ) : (
            <Play size={16} className="text-white/80" />
          )}
        </button>
        <div className="text-[11px] text-white/50 min-w-[60px]">
          {format(progress)} / {format(duration)}
        </div>
      </div>
      <input
        type="range"
        min={0}
        max={duration || 0}
        value={progress}
        onChange={(e) => {
          const a = audioRef.current;
          if (a) {
            a.currentTime = Number(e.target.value);
            setProgress(Number(e.target.value));
          }
        }}
        className="w-full accent-[#0A84FF]"
      />
    </div>
  );
}

export default function ChatPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const t = useTranslations('ChatPage');
  const params = useParams();
  const searchParams = useSearchParams();
  const dialogueId = params?.dialogueId as string | undefined;
  const haptic = useHaptic();
  const [text, setText] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<
    { url: string; type: string; file: File }[]
  >([]);
  const [viewerSrc, setViewerSrc] = useState<{
    url: string;
    type: string;
  } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const urlModel = searchParams.get('model');
  const urlVersion = searchParams.get('version');
  const urlRole = searchParams.get('role');
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(
    urlRole ? parseInt(urlRole) : null
  );

  // Если это новый чат и модель пришла из URL — сразу кешируем
  useEffect(() => {
    // Инициализируем selectedRoleId из URL при монтировании
    if (urlRole) {
      const parsed = parseInt(urlRole);
      if (!isNaN(parsed)) setSelectedRoleId(parsed);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // При смене модели через URL — сбрасываем кеш sessionStorage
    if (!dialogueId || !urlModel) return;
    writeStoredModel(
      dialogueId,
      urlModel,
      urlVersion || '',
      urlRole ? (isNaN(parseInt(urlRole)) ? null : parseInt(urlRole)) : null
    );
  }, [dialogueId, urlModel, urlVersion, urlRole]);

  // ✅ Теперь безопасно делать ранний return
  if (!dialogueId) return null;

  const { data: messages = [], isLoading: isHistoryLoading } = useChatHistory(
    dialogueId === 'new' ? null : dialogueId
  );
  const { data: allModels } = useAIModels();
  const { data: roles } = useRoles();
  const generate = useGenerateAI();
  const upload = useUpload();
  const msgs = (messages as Message[]) || [];

  const {
    model: activeModel,
    version: activeVersion,
    roleId: activeRoleId,
  } = getDialogueModel(dialogueId, msgs, {
    model: urlModel,
    version: urlVersion,
    role: urlRole,
  });

  const isProcessing = msgs.some(
    (m) => m.status === 'processing' || m.status === 'pending'
  );
  const currentModel = allModels?.find((m) => m.tech_name === activeModel);
  const currentVersion = currentModel?.versions?.find(
    (v) => v.label === activeVersion
  );
  const limitMedia = currentVersion?.limit_media ?? null;
  const canAttachMedia =
    currentModel?.input?.some((t) => ['image', 'video', 'audio'].includes(t)) ??
    true;

  const chatTitle = (() => {
    // Если есть реальная история — берём только из неё, игнорируем URL
    if (msgs.length > 0) {
      const modelName = currentModel?.model_name;
      if (modelName && activeVersion) return `${modelName} · ${activeVersion}`;
      if (modelName) return modelName;
      if (activeVersion) return activeVersion;
      return msgs[0].version || msgs[0].model || t('dialogue');
    }

    // Только для пустого/нового чата — смотрим URL
    const modelName = currentModel?.model_name;
    if (modelName && activeVersion) return `${modelName} · ${activeVersion}`;
    if (modelName) return modelName;
    if (urlModel) {
      const ver = urlVersion || activeVersion;
      return ver ? `${urlModel} · ${ver}` : urlModel;
    }

    return t('dialogue');
  })();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);
  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
  }, [text]);

  const prevProcessingRef = useRef(false);
  useEffect(() => {
    if (prevProcessingRef.current && !isProcessing && msgs.length > 0)
      queryClient.invalidateQueries({ queryKey: queryKeys.user });
    prevProcessingRef.current = isProcessing;
  }, [isProcessing, queryClient, msgs.length]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const file = files[0];
    const fileType = file.type.startsWith('image/')
      ? 'image'
      : file.type.startsWith('video/')
        ? 'video'
        : 'audio';
    if (limitMedia !== null) {
      const limit = limitMedia[fileType] ?? 0;
      const currentCount = uploadedFiles.filter(
        (f) => f.type === fileType
      ).length;
      if (limit === 0) {
        toast.error(t('modelNotAccept', { fileType }));
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      if (currentCount >= limit) {
        toast.error(t('maxFiles', { limit, fileType }));
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }
    try {
      const res = await upload.mutateAsync(file);
      setUploadedFiles((prev) => [
        ...prev,
        { url: res.url, type: res.type, file },
      ]);
    } catch {
      toast.error(t('uploadError'));
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (i: number) =>
    setUploadedFiles((prev) => prev.filter((_, idx) => idx !== i));

  const handleSend = () => {
    if (isHistoryLoading) return;
    if (isProcessing) {
      haptic.warning();
      toast(t('waitGeneration'));
      return;
    }
    if (!text.trim() && uploadedFiles.length === 0) return;
    const { model: techName, version } = getDialogueModel(dialogueId, msgs, {
      model: urlModel,
      version: urlVersion,
      role: urlRole,
    });
    if (!techName) {
      haptic.error();
      toast.error(t('modelNotFound'));
      return;
    }
    haptic.light();
    const oldFormatMedia = uploadedFiles.map((f) => ({
      type: f.type,
      format: 'url',
      input: f.url,
    }));
    const safeText = text.trim() || t('describeImage');
    const inputs = convertMediaToInputs(safeText, oldFormatMedia);
    const sentText = text;
    setText('');
    setUploadedFiles([]);
    generate.mutate(
      {
        tech_name: techName,
        version: version || undefined,
        dialogue_id: dialogueId === 'new' ? undefined : dialogueId,
        role_id: selectedRoleId,
        inputs,
      },
      {
        onSuccess: (data) => {
          if (dialogueId === 'new' && data.dialogue_id) {
            queryClient.invalidateQueries({ queryKey: queryKeys.chats });
            router.replace(`/chats/${data.dialogue_id}`);
          } else {
            queryClient.invalidateQueries({
              queryKey: queryKeys.chatHistory(dialogueId),
              refetchType: 'all',
            });
          }
        },
        onError: () => {
          setText(sentText);
        },
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const acceptTypes = (() => {
    if (!currentModel) return 'image/*,.heic,video/*,audio/*';
    const a: string[] = [];
    if (currentModel.input?.includes('image')) a.push('image/*,.heic');
    if (currentModel.input?.includes('video')) a.push('video/*');
    if (currentModel.input?.includes('audio')) a.push('audio/*');
    return a.join(',') || 'image/*,.heic,video/*,audio/*';
  })();

  const isSendDisabled =
    isHistoryLoading ||
    isProcessing ||
    generate.isPending ||
    (!text.trim() && uploadedFiles.length === 0);
  const showRoles =
    msgs.length === 0 && !isHistoryLoading && roles && roles.length > 0;

  return (
    <div className="flex flex-col h-svh bg-zinc-950">
      {/* ── Header ── */}
      <header
        className="shrink-0 sticky top-0 z-10
        flex items-center gap-3 px-4 py-3
        bg-zinc-950/90 backdrop-blur-2xl border-b border-white/[.07]"
      >
        <button
          onClick={() => {
            haptic.light();
            router.back();
          }}
          className="flex items-center justify-center w-9 h-9 rounded-full shrink-0
            bg-white/[.05] border border-white/[.09]
            active:scale-[0.88] transition-all duration-150 hover:bg-white/[.08]"
        >
          <ChevronLeft size={18} className="text-white/60" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-semibold tracking-[-0.2px] text-white/90 truncate">
            {chatTitle}
          </p>
          {isHistoryLoading && (
            <span className="text-[11px] text-white/35">{t('loading')}</span>
          )}
          {!isHistoryLoading && isProcessing && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block animate-pulse" />
              <span className="text-[11px] text-amber-400/80 font-medium">
                {t('generating')}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {isHistoryLoading ? (
          <div className="flex justify-center pt-8">
            <Loader2 size={22} className="animate-spin text-white/30" />
          </div>
        ) : msgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-5 text-center py-10">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center
              bg-white/[.04] border border-white/[.08]"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-white/30"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-[14px] text-white/40 max-w-[200px] leading-relaxed">
              {t('startDialogue')}
            </p>

            {/* Roles */}
            {showRoles && (
              <div className="w-full max-w-sm mt-1">
                <p className="text-[10px] font-semibold tracking-[0.6px] uppercase text-white/30 mb-3">
                  {t('chooseAssistant')}
                </p>
                <div className="flex flex-col gap-1.5">
                  {roles!.slice(0, 5).map((role) => (
                    <button
                      key={role.id}
                      onClick={() => {
                        haptic.light();
                        setSelectedRoleId(role.id);
                        textareaRef.current?.focus();
                      }}
                      className={cn(
                        'flex items-center gap-3 px-3.5 py-3 rounded-2xl w-full text-left',
                        'bg-white/[.03] border border-white/[.06]',
                        'hover:bg-white/[.06] active:scale-[0.97] transition-all duration-150',
                        selectedRoleId === role.id &&
                        'border-white/[.14] bg-white/[.06]'
                      )}
                    >
                      <div className="w-9 h-9 rounded-xl overflow-hidden border border-white/[.10] shrink-0">
                        <Avatar className="size-full rounded-none">
                          <AvatarImage src={role.image || ''} />
                          <AvatarFallback className="text-base rounded-none bg-white/[.06]">
                            {localize(role.label).slice(0, 1)}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-white/80 truncate">
                          {localize(role.label)}
                        </p>
                        <p className="text-[11px] text-white/35 truncate mt-0.5">
                          {localize(role.description)}
                        </p>
                      </div>
                      {selectedRoleId === role.id && (
                        <div className="w-2 h-2 rounded-full bg-white/50 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          msgs.map((msg, idx) => {
            const userMedia = extractDisplayMedia(msg.inputs);
            const resultMedia = extractResultMedia(msg.result);
            return (
              <div key={msg.id || idx} className="flex flex-col gap-2">
                {/* User message */}
                {(msg.inputs?.text || userMedia.length > 0) && (
                  <div className="flex justify-end">
                    <div
                      className="max-w-[78%] px-4 py-3
                      bg-white/[.07] border border-white/[.10]
                      backdrop-blur-xl rounded-[18px_18px_4px_18px] text-white text-[15px] leading-[1.45]"
                    >
                      {msg.inputs?.text && (
                        <p className="whitespace-pre-wrap m-0">
                          {msg.inputs.text}
                        </p>
                      )}
                      {userMedia.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {userMedia.map((m, i) => (
                            <button
                              key={i}
                              onClick={() => setViewerSrc(m)}
                              className="bg-none border-none p-0 cursor-pointer"
                            >
                              {m.type === 'image' ? (
                                <img
                                  src={m.url}
                                  alt=""
                                  className="max-h-36 rounded-xl object-cover"
                                />
                              ) : m.type === 'video' ? (
                                <video
                                  src={m.url}
                                  className="max-h-36 rounded-xl"
                                />
                              ) : (
                                <div className="px-2.5 py-1.5 bg-white/10 rounded-lg text-xs text-white/70">
                                  {t('audioLabel')}
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* AI message */}
                <div className="flex justify-start">
                  <div className="max-w-[82%]">
                    {msg.status === 'processing' || msg.status === 'pending' ? (
                      <div
                        className="flex items-center gap-1.5 px-4 py-3 rounded-[18px_18px_18px_4px]
                        bg-white/[.04] border border-white/[.07]"
                      >
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            style={{ animationDelay: `${i * 0.15}s` }}
                            className="w-1.5 h-1.5 rounded-full bg-white/40 animate-[pulse-dot_1.2s_infinite_ease-in-out]"
                          />
                        ))}
                      </div>
                    ) : msg.status === 'error' ? (
                      <div
                        className="px-4 py-3 rounded-[18px_18px_18px_4px]
                        bg-red-500/10 border border-red-500/20 text-red-400/80 text-[14px]"
                      >
                        {msg.error || t('error')}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {msg.result?.text && (
                          <div
                            className="px-4 py-3 rounded-[18px_18px_18px_4px]
                            bg-white/[.04] border border-white/[.07]
                            text-[15px] leading-normal text-white/85 whitespace-pre-wrap"
                          >
                            {msg.result.text}
                          </div>
                        )}
                        {extractResultMedia(msg.result).length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {extractResultMedia(msg.result).map((m, i) => {
                              if (m.type === 'audio') {
                                return (
                                  <div key={i} className="w-full max-w-[420px]">
                                    <div
                                      className="flex flex-col gap-3 p-4 rounded-2xl
                                      bg-white/[.04] border border-white/[.08]"
                                    >
                                      <AudioPlayer src={m.url} />
                                      <a
                                        href={m.url}
                                        download
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="self-end w-9 h-9 flex items-center justify-center rounded-xl
                                          bg-white/[.06] border border-white/[.10] active:scale-90 transition-transform"
                                      >
                                        <Download
                                          size={16}
                                          className="text-white/60"
                                        />
                                      </a>
                                    </div>
                                  </div>
                                );
                              }
                              return (
                                <div key={i} className="relative group">
                                  {m.type === 'image' ? (
                                    <img
                                      src={m.url}
                                      alt="Generated"
                                      onClick={() => setViewerSrc(m)}
                                      className="max-w-64 max-h-64 rounded-2xl object-cover cursor-pointer
                                        border border-white/[.10] shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
                                    />
                                  ) : (
                                    <video
                                      src={m.url}
                                      controls
                                      className="max-w-64 max-h-64 rounded-2xl"
                                    />
                                  )}
                                  <a
                                    href={m.url}
                                    download
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute top-2 right-2 p-1.5 rounded-full
                                      bg-black/50 backdrop-blur-xl border border-white/[.15] text-white flex
                                      opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Download size={13} />
                                  </a>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {!msg.result?.text &&
                          extractResultMedia(msg.result).length === 0 && (
                            <div
                              className="px-4 py-3 rounded-[18px_18px_18px_4px]
                            bg-white/[.04] border border-white/[.07] text-[13px] text-white/40 italic"
                            >
                              {t('responseReceived')}
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ── Media Viewer ── */}
      {viewerSrc && (
        <div
          onClick={() => setViewerSrc(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4"
        >
          {viewerSrc.type === 'image' ? (
            <img
              src={viewerSrc.url}
              alt=""
              className="max-w-full max-h-full object-contain rounded-2xl"
            />
          ) : viewerSrc.type === 'video' ? (
            <video
              src={viewerSrc.url}
              controls
              autoPlay
              className="max-w-full max-h-full rounded-2xl"
            />
          ) : viewerSrc.type === 'audio' ? (
            <div className="w-full max-w-md bg-white/[.06] backdrop-blur-2xl rounded-3xl p-6">
              <audio src={viewerSrc.url} controls autoPlay className="w-full" />
            </div>
          ) : null}
          <button
            onClick={() => setViewerSrc(null)}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/[.10] backdrop-blur-xl border border-white/[.15] text-white flex"
          >
            <X size={18} />
          </button>
          <a
            href={viewerSrc.url}
            download
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-7 right-5 p-2.5 rounded-full bg-white/[.10] backdrop-blur-xl border border-white/[.15] text-white flex"
          >
            <Download size={18} />
          </a>
        </div>
      )}

      {/* ── Input Bar ── */}
      <div
        className="shrink-0
        bg-zinc-950/90 backdrop-blur-2xl border-t border-white/[.07]
        px-3.5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]"
      >
        {/* Uploaded files preview */}
        {uploadedFiles.length > 0 && (
          <div className="flex gap-2 mb-2.5 flex-wrap">
            {uploadedFiles.map((f, i) => (
              <div
                key={i}
                className="relative w-14 h-14 rounded-xl overflow-hidden border border-white/[.10]"
              >
                {f.type === 'image' ? (
                  <img
                    src={f.url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-white/[.06] flex items-center justify-center text-xl">
                    {f.type === 'video' ? '🎬' : '🎵'}
                  </div>
                )}
                <button
                  onClick={() => removeFile(i)}
                  className="absolute top-0.5 right-0.5 w-4.5 h-4.5 bg-black/60 backdrop-blur-lg rounded-full flex items-center justify-center text-white"
                >
                  <X size={9} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2.5">
          {canAttachMedia && (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={upload.isPending}
              className="flex items-center justify-center w-11 h-11 rounded-2xl shrink-0
                bg-white/[.05] border border-white/[.09]
                active:scale-90 transition-all duration-150 hover:bg-white/[.08] disabled:opacity-50"
            >
              {upload.isPending ? (
                <Loader2 size={20} className="animate-spin text-white/30" />
              ) : (
                <ImagePlus size={20} className="text-white/50" />
              )}
            </button>
          )}
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept={acceptTypes}
            onChange={handleFileUpload}
          />
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('placeholder')}
              className="w-full box-border block resize-none py-[11px] px-4 rounded-2xl
                bg-zinc-900/50 border border-white/[.08] outline-none
                text-[15px] text-white/90 placeholder:text-white/20
                focus:border-white/[.14] transition-all duration-200"
              style={{ maxHeight: '150px' }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={isSendDisabled}
            className={cn(
              'flex items-center justify-center w-11 h-11 rounded-2xl shrink-0',
              'transition-all duration-200 active:scale-90',
              isSendDisabled
                ? 'bg-white/[.03] text-white/10'
                : 'bg-white/[.10] text-white/80 border border-white/[.10] shadow-[0_4px_12px_rgba(255,255,255,0.02)]'
            )}
          >
            {generate.isPending ? (
              <Loader2 size={19} className="animate-spin" />
            ) : (
              <Send size={19} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
