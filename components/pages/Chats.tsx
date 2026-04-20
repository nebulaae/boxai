'use client';

import { useEffect, useRef } from 'react';
import { useRouter as useChatsRouter, useSearchParams } from 'next/navigation';
import { useChats } from '@/hooks/useChats';
import { useAIModels as useChatsModels } from '@/hooks/useModels';
import { useRoles as useChatsRoles } from '@/hooks/useRoles';
import {
  Avatar as ChatsAvatar,
  AvatarFallback as ChatsFallback,
  AvatarImage as ChatsImage,
} from '@/components/ui/avatar';
import { ChatsLoader } from '@/components/states/Loading';
import { ChatsEmpty } from '@/components/states/Empty';
import { ErrorComponent as ChatsError } from '@/components/states/Error';
import { MessageSquarePlus, Loader2, ChevronRight } from 'lucide-react';
import { cn, timeAgo } from '@/lib/utils';
import { toast as chatsToast } from 'sonner';
import { useHaptic as useChatsHaptic } from '@/hooks/useHaptic';
import { useTranslations } from 'next-intl';

function cacheDialogueModel(
  dialogueId: string,
  model: string,
  version: string,
  roleId: number | null | undefined
) {
  try {
    sessionStorage.setItem(
      `dialogue_model_${dialogueId}`,
      JSON.stringify({ model, version, role_id: roleId ?? null })
    );
  } catch {}
}

export const Chats = () => {
  const router = useChatsRouter();
  const searchParams = useSearchParams();
  const haptic = useChatsHaptic();
  const t = useTranslations('Chats');
  const modelParam = searchParams.get('model');
  const roleParam = searchParams.get('role');
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useChats();
  const { data: models } = useChatsModels();
  const { data: roles } = useChatsRoles();
  const chats = data?.pages.flatMap((p) => p) ?? [];
  const startedRef = useRef(false);

  useEffect(() => {
    if (!modelParam && !roleParam) return;
    if (startedRef.current) return;
    const modelsReady = !!models;
    const rolesReady = roleParam ? !!roles : true;
    if (!modelsReady || !rolesReady) return;

    const role = roleParam
      ? roles?.find((r) => r.id === parseInt(roleParam))
      : null;
    if (roleParam && !role) {
      chatsToast.error(t('assistantNotFound'));
      router.replace('/chats');
      return;
    }

    let techName: string | null = null,
      version: string | undefined;
    if (modelParam) {
      const model = models?.find((m) => m.tech_name === modelParam);
      if (!model) {
        chatsToast.error(t('modelNotFound'));
        router.replace('/chats');
        return;
      }
      techName = model.tech_name;
      version = (model.versions?.find((v) => v.default) || model.versions?.[0])
        ?.label;
    } else if (roleParam && role) {
      const textModel = models?.find(
        (m) => m.categories?.includes('text') || m.mainCategory === 'text'
      );
      techName = textModel?.tech_name || null;
      version = (
        textModel?.versions?.find((v) => v.default) || textModel?.versions?.[0]
      )?.label;
    }
    if (!techName) {
      chatsToast.error(t('suitableModelNotFound'));
      router.replace('/chats');
      return;
    }

    startedRef.current = true;
    const params = new URLSearchParams({
      model: techName,
      ...(version ? { version } : {}),
      ...(role ? { role: String(role.id) } : {}),
    });
    router.replace(`/chats/new?${params.toString()}`);
  }, [modelParam, roleParam, models, roles, t, router]);

  if (isError)
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <ChatsError
          title={t('error')}
          description={t('errorLoadChats')}
          onRetry={refetch}
        />
      </div>
    );

  if ((modelParam || roleParam) && !startedRef.current && (models || roles))
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 rounded-2xl bg-white/[.06] border border-white/[.12] backdrop-blur-xl" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="size-5 animate-spin text-white/40" />
          </div>
        </div>
        <p className="text-[13px] text-white/35 tracking-wide">
          {t('openingChat')}
        </p>
      </div>
    );

  return (
    <div className="flex flex-col h-full pb-[calc(80px+max(16px,env(safe-area-inset-bottom)))] w-full max-w-2xl mx-auto">
      {/* ── Header ── */}
      <div
        className="sticky top-0 z-40 flex items-center justify-between px-5 pt-6 pb-4
        bg-gradient-to-b from-zinc-950/90 via-zinc-950/60 to-transparent
        backdrop-blur-2xl border-b border-white/[.05]"
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-[22px] font-bold tracking-[-0.5px] text-white/90">
            {t('title')}
          </span>
          {!isLoading && chats.length > 0 && (
            <span className="text-[11px] text-white/30 font-medium">
              {chats.length} {t('dialogue')}
            </span>
          )}
        </div>
        <button
          onClick={() => {
            haptic.light();
            router.push('/models');
          }}
          className="group relative w-10 h-10 flex items-center justify-center rounded-2xl
            bg-white/[.06] border border-white/[.10]
            shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]
            transition-all duration-200 active:scale-[0.88] active:bg-white/[.10]"
          title={t('newChat')}
        >
          <MessageSquarePlus className="size-[18px] text-white/50 group-active:text-white/80 transition-colors" />
        </button>
      </div>

      {/* ── List ── */}
      <div className="flex flex-col flex-1 overflow-y-auto px-3 pt-3 gap-1.5">
        {isLoading ? (
          <ChatsLoader />
        ) : chats.length === 0 ? (
          <div className="flex items-center justify-center flex-1 p-8">
            <ChatsEmpty />
          </div>
        ) : (
          <>
            {chats.map((chat) => {
              const displayName =
                chat.version || chat.title || chat.model || t('dialogue');
              return (
                <button
                  key={chat.dialogue_id}
                  onClick={() => {
                    haptic.light();
                    if (chat.model)
                      cacheDialogueModel(
                        chat.dialogue_id,
                        chat.model,
                        chat.version,
                        chat.role_id
                      );
                    router.push(`/chats/${chat.dialogue_id}`);
                  }}
                  className="group flex items-center gap-3.5 px-4 py-3.5 w-full text-left rounded-2xl
                    bg-white/[.03] border border-white/[.06]
                    hover:bg-white/[.06] hover:border-white/[.10]
                    active:scale-[0.985] active:bg-white/[.08]
                    transition-all duration-200 backdrop-blur-sm"
                >
                  <ChatsAvatar className="size-12 rounded-[14px] border border-white/[.10] flex-shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
                    <ChatsImage
                      src={
                        chat.avatar ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=18181b&color=ffffff`
                      }
                    />
                    <ChatsFallback className="rounded-[14px] bg-white/[.06] text-[11px] font-bold text-white/50">
                      {displayName.slice(0, 2).toUpperCase()}
                    </ChatsFallback>
                  </ChatsAvatar>

                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold text-white/85 truncate tracking-[-0.2px]">
                      {displayName}
                    </div>
                    <div className="text-[11px] text-white/30 mt-0.5">
                      {timeAgo(chat.last_activity || chat.started_at)}
                    </div>
                  </div>

                  <ChevronRight className="size-4 text-white/20 group-hover:text-white/40 transition-colors flex-shrink-0" />
                </button>
              );
            })}

            {hasNextPage && (
              <div className="py-3 px-1">
                <button
                  onClick={() => {
                    haptic.light();
                    fetchNextPage();
                  }}
                  disabled={isFetchingNextPage}
                  className="w-full py-3 rounded-2xl text-[13px] font-medium text-white/40
                    bg-white/[.03] border border-white/[.06]
                    hover:bg-white/[.05] transition-all duration-200 active:scale-[0.97]
                    flex items-center justify-center gap-2"
                >
                  {isFetchingNextPage ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      {t('loading')}
                    </>
                  ) : (
                    t('loadMore')
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Chats;
