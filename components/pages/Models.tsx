'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAIModels } from '@/hooks/useModels';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ModelsEmpty } from '@/components/states/Empty';
import { ErrorComponent } from '@/components/states/Error';
import { useHaptic } from '@/hooks/useHaptic';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';

const CAT_ICON: Record<string, string> = {
  text: '✦',
  image: '◈',
  video: '▶',
  audio: '♫',
};
const CAT_COLOR: Record<string, string> = {
  text: 'text-blue-400/60',
  image: 'text-purple-400/60',
  video: 'text-rose-400/60',
  audio: 'text-emerald-400/60',
};

const SkeletonRow = () => (
  <div className="flex items-center gap-3.5 px-4 py-3.5">
    <div className="w-11 h-11 rounded-[14px] flex-shrink-0 bg-white/[.04] border border-white/[.06] animate-pulse" />
    <div className="flex-1 flex flex-col gap-2">
      <div className="w-[42%] h-3 rounded-md bg-white/[.05] animate-pulse" />
      <div className="w-[24%] h-2.5 rounded-md bg-white/[.04] animate-pulse" />
    </div>
    <div className="w-10 h-5 rounded-full bg-white/[.04] animate-pulse" />
  </div>
);

export const Models = () => {
  const [tab, setTab] = useState<string>('all');
  const router = useRouter();
  const haptic = useHaptic();
  const t = useTranslations('Models');
  const { data: models, isLoading, isError, refetch } = useAIModels();

  const TABS = [
    { key: 'all', label: t('tabAll') },
    { key: 'text', label: t('tabText') },
    { key: 'image', label: t('tabImage') },
    { key: 'video', label: t('tabVideo') },
    { key: 'audio', label: t('tabAudio') },
  ] as const;

  const CATEGORY_LABEL: Record<string, string> = {
    text: t('catText'),
    image: t('catImage'),
    video: t('catVideo'),
    audio: t('catAudio'),
  };

  if (isError)
    return (
      <div className="flex items-center justify-center min-h-svh p-6">
        <ErrorComponent
          title={t('error')}
          description={t('errorDescription')}
          onRetry={refetch}
        />
      </div>
    );

  const filtered =
    tab === 'all'
      ? models || []
      : (models || []).filter(
          (m) => m.categories?.includes(tab) || m.mainCategory === tab
        );

  const handleModelClick = (techName: string, mainCategory?: string) => {
    haptic.light();
    mainCategory === 'text'
      ? router.push(`/chats?model=${techName}`)
      : router.push(`/generate?model=${techName}`);
  };

  return (
    <div className="flex flex-col min-h-svh pb-[calc(80px+max(16px,env(safe-area-inset-bottom)))]">
      {/* ── Header ── */}
      <header
        className="sticky top-0 z-40 px-5 pt-5 pb-4
        bg-gradient-to-b from-zinc-950/95 to-zinc-950/0
        backdrop-blur-2xl border-b border-white/[.05]"
      >
        <div className="max-w-2xl mx-auto">
          <span className="text-[22px] font-bold tracking-[-0.5px] text-white/90">
            {t('title')}
          </span>
        </div>
      </header>

      {/* ── Tabs ── */}
      <div className="sticky top-[61px] z-30 bg-zinc-950/80 backdrop-blur-xl border-b border-white/[.05]">
        <div
          className="max-w-2xl mx-auto flex gap-1.5 px-4 py-2.5 overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
        >
          {TABS.map((t_tab) => {
            const active = tab === t_tab.key;
            return (
              <button
                key={t_tab.key}
                onClick={() => {
                  haptic.selection();
                  setTab(t_tab.key);
                }}
                className={cn(
                  'shrink-0 px-4 py-1.5 rounded-full text-[12px] font-semibold cursor-pointer whitespace-nowrap',
                  'transition-all duration-200 active:scale-[0.93]',
                  active
                    ? 'bg-white/[.12] border border-white/[.18] text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
                    : 'bg-white/[.04] border border-white/[.07] text-white/35 hover:text-white/50 hover:bg-white/[.06]'
                )}
              >
                {t_tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── List ── */}
      <div className="flex-1">
        <div className="max-w-2xl mx-auto px-3 pt-3 flex flex-col gap-1">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
          ) : filtered.length === 0 ? (
            <div className="p-12">
              <ModelsEmpty />
            </div>
          ) : (
            filtered.map((m) => {
              const defVersion =
                m.versions?.find((v) => v.default) || m.versions?.[0];
              const cost = defVersion?.cost ?? 1;
              const catKey = m.mainCategory || '';
              const catLabel = CATEGORY_LABEL[catKey] || 'AI';
              const catIcon = CAT_ICON[catKey] || '✦';
              const catColor = CAT_COLOR[catKey] || 'text-white/40';
              const avatarUrl =
                m.avatar ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(m.model_name)}&background=18181b&color=ffffff&size=128`;

              return (
                <button
                  key={m.tech_name}
                  onClick={() => handleModelClick(m.tech_name, m.mainCategory)}
                  className="group flex items-center gap-3.5 px-4 py-3.5 w-full text-left rounded-2xl
                    bg-white/[.02] border border-white/[.05]
                    hover:bg-white/[.05] hover:border-white/[.09]
                    active:scale-[0.985] transition-all duration-150 backdrop-blur-sm"
                >
                  <div
                    className="w-11 h-11 rounded-[14px] overflow-hidden flex-shrink-0
                    border border-white/[.09] shadow-[0_2px_8px_rgba(0,0,0,0.3)]"
                  >
                    <Avatar className="size-full">
                      <AvatarImage src={avatarUrl} />
                      <AvatarFallback className="text-[11px] font-semibold bg-transparent text-white/50">
                        {m.model_name.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-white/85 truncate tracking-[-0.2px]">
                      {m.model_name}
                    </p>
                    <p className="text-[11px] text-white/35 mt-0.5 flex items-center gap-1.5">
                      <span className={cn('text-[10px]', catColor)}>
                        {catIcon}
                      </span>
                      <span>{catLabel}</span>
                      {m.versions && m.versions.length > 1 && (
                        <>
                          <span className="opacity-40">·</span>
                          <span>
                            {t('versions', { count: m.versions.length })}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div
                      className="px-2.5 py-[3px] rounded-full text-[11px] font-medium text-white/30
                      bg-white/[.04] border border-white/[.07]"
                    >
                      ◈ {cost}
                    </div>
                    <ChevronRight className="size-4 text-white/20 group-hover:text-white/40 transition-colors" />
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Models;
