'use client';

import { useRouter } from 'next/navigation';
import { useAIModels } from '@/hooks/useModels';
import { useRoles } from '@/hooks/useRoles';
import { useUser } from '@/hooks/useUser';
import { useUI, usePaymentLink } from '@/hooks/useApiExtras';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ErrorComponent } from '@/components/states/Error';
import { localize } from '@/lib/utils';
import { Sparkles, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';

const Shimmer = ({
  w,
  h,
  rounded,
}: {
  w: string;
  h: string;
  rounded?: string;
}) => (
  <div
    style={{
      width: w,
      height: h,
      borderRadius: rounded || '12px',
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.06)',
      overflow: 'hidden',
      position: 'relative',
    }}
  >
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background:
          'linear-gradient(90deg,transparent,rgba(255,255,255,0.05),transparent)',
        animation: 'shimmer 2s infinite',
      }}
    />
  </div>
);

const SectionTitle = ({
  children,
  action,
  onAction,
}: {
  children: React.ReactNode;
  action?: string;
  onAction?: () => void;
}) => (
  <div className="flex items-center justify-between mb-4">
    <span className="text-[13px] font-semibold text-white/50 tracking-[0.3px]">
      {children}
    </span>
    {action && (
      <button
        onClick={onAction}
        className="text-[12px] text-white/30 hover:text-white/50 transition-colors font-medium px-2.5 py-1 rounded-lg
          bg-white/[.04] border border-white/[.07] active:scale-95 transition-all duration-150"
      >
        {action}
      </button>
    )}
  </div>
);

export const Home = () => {
  const router = useRouter();
  const t = useTranslations('Home');
  const {
    data: models,
    isLoading: modelsLoading,
    isError,
    refetch,
  } = useAIModels();
  const { data: trends, isLoading: trendsLoading } = useUI('trends');
  const { data: roles, isLoading: rolesLoading } = useRoles();
  const { data: userData } = useUser();
  const { data: paymentUrl } = usePaymentLink();

  const displayModels = models?.slice(0, 8) || [];
  const displayRoles = roles?.slice(0, 5) || [];
  const tokens = userData?.user?.tokens ?? 0;

  const handleModelClick = (techName: string, mainCategory?: string) =>
    mainCategory === 'text'
      ? router.push(`/chats?model=${techName}`)
      : router.push(`/generate?model=${techName}`);

  const handleRoleClick = (id: number) => router.push(`/chats?role=${id}`);

  const handleTrendClick = (item: any) => {
    if (item.tech_name) {
      const model = models?.find((m) => m.tech_name === item.tech_name);
      if (model) {
        model.mainCategory === 'text'
          ? router.push(`/chats?model=${item.tech_name}`)
          : router.push(`/generate?model=${item.tech_name}`);
      } else {
        const textKeywords = [
          'gpt',
          'claude',
          'gemini',
          'llama',
          'mistral',
          'chat',
        ];
        const isText = textKeywords.some((kw) =>
          item.tech_name.toLowerCase().includes(kw)
        );
        router.push(
          isText
            ? `/chats?model=${item.tech_name}`
            : `/generate?model=${item.tech_name}`
        );
      }
    } else if (item.model) {
      router.push(`/generate?model=${item.model}`);
    } else if (item.role_id) {
      router.push(`/chats?role=${item.role_id}`);
    }
  };

  if (isError)
    return (
      <div className="flex items-center justify-center min-h-screen p-6">
        <ErrorComponent
          title={t('error')}
          description={t('errorLoadData')}
          onRetry={refetch}
        />
      </div>
    );

  return (
    <div className="pb-[calc(80px+max(16px,env(safe-area-inset-bottom)))] max-w-2xl mx-auto">
      {/* ── Header ── */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-5 pt-5 pb-4
        bg-gradient-to-b from-zinc-950/95 to-zinc-950/0 backdrop-blur-2xl border-b border-white/[.04]"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-[10px] bg-white/[.06] border border-white/[.10]
            flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
          >
            <Sparkles size={14} className="text-white/60" />
          </div>
          <span className="text-[18px] font-bold tracking-[-0.4px] text-white/90">
            BoxAI
          </span>
        </div>

        <button
          onClick={() => paymentUrl && window.open(paymentUrl, '_blank')}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl
            bg-white/[.05] border border-white/[.09]
            hover:bg-white/[.08] active:scale-[0.94]
            transition-all duration-150 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
        >
          <Zap size={12} className="text-amber-400/70" />
          <span className="text-[13px] font-semibold text-white/70">
            {tokens}
          </span>
        </button>
      </header>

      <div className="px-4 pt-5 flex flex-col gap-8">
        {/* ── Models ── */}
        <section>
          <SectionTitle
            action={`${t('all')} →`}
            onAction={() => router.push('/models')}
          >
            {t('models')}
          </SectionTitle>
          <div className="grid grid-cols-4 gap-3">
            {modelsLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-2">
                    <Shimmer w="56px" h="56px" rounded="18px" />
                    <Shimmer w="38px" h="8px" rounded="6px" />
                  </div>
                ))
              : displayModels.map((m) => (
                  <button
                    key={m.tech_name}
                    onClick={() =>
                      handleModelClick(m.tech_name, m.mainCategory)
                    }
                    className="flex flex-col items-center gap-2 bg-transparent border-none cursor-pointer
                    active:scale-[0.88] transition-transform duration-150"
                  >
                    <div
                      className="w-14 h-14 rounded-[18px] overflow-hidden
                    bg-white/[.05] border border-white/[.09]
                    shadow-[0_2px_12px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.07)]"
                    >
                      <Avatar className="size-full">
                        <AvatarImage
                          src={
                            m.avatar ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(m.model_name)}&background=18181b&color=fff`
                          }
                        />
                        <AvatarFallback className="text-[12px] font-semibold bg-transparent text-white/50">
                          {m.model_name.slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <span className="text-[10px] font-medium text-white/45 max-w-[60px] text-center truncate leading-tight">
                      {m.model_name}
                    </span>
                  </button>
                ))}
          </div>
        </section>

        {/* ── Divider ── */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/[.08] to-transparent" />

        {/* ── Assistants ── */}
        <section>
          <SectionTitle
            action={`${t('all')} →`}
            onAction={() => router.push('/chats')}
          >
            {t('aiAssistants')}
          </SectionTitle>
          <div
            className="flex gap-3 overflow-x-auto -mx-1 px-1"
            style={{ scrollbarWidth: 'none' }}
          >
            {rolesLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-shrink-0 flex flex-col items-center gap-2"
                  >
                    <Shimmer w="60px" h="60px" rounded="16px" />
                    <Shimmer w="46px" h="8px" rounded="6px" />
                  </div>
                ))
              : displayRoles.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => handleRoleClick(role.id)}
                    className="flex-shrink-0 flex flex-col items-center gap-2 bg-transparent border-none cursor-pointer
                    active:scale-[0.88] transition-transform duration-150"
                  >
                    <div
                      className="w-[60px] h-[60px] rounded-[16px] overflow-hidden
                    bg-white/[.05] border border-white/[.09]
                    shadow-[0_2px_12px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.07)]"
                    >
                      <Avatar className="size-full rounded-none">
                        <AvatarImage src={role.image || ''} />
                        <AvatarFallback className="text-[22px] bg-transparent">
                          {localize(role.label).slice(0, 1)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <span className="text-[10px] font-medium text-white/45 w-[60px] text-center truncate">
                      {localize(role.label)}
                    </span>
                  </button>
                ))}
          </div>
        </section>

        {/* ── Divider ── */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/[.08] to-transparent" />

        {/* ── Trending ── */}
        <section className="pb-2">
          <SectionTitle>{t('trending')}</SectionTitle>
          <div className="flex flex-col gap-2">
            {trendsLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Shimmer key={i} w="100%" h="58px" rounded="18px" />
                ))
              : ((trends as any[]) || []).length === 0
                ? (
                    [
                      {
                        icon: '✦',
                        title: t('trend1'),
                        href: '/generate',
                      },
                      {
                        icon: '◈',
                        title: t('trend2'),
                        href: '/chats',
                      },
                      {
                        icon: '▶',
                        title: t('trend3'),
                        href: '/generate',
                      },
                      {
                        icon: '♫',
                        title: t('trend4'),
                        href: '/generate',
                      },
                    ] as any[]
                  ).map((item) => (
                    <button
                      key={item.title}
                      onClick={() => router.push(item.href)}
                      className="flex items-center gap-4 px-4 py-4 rounded-2xl w-full text-left
                      bg-white/[.03] border border-white/[.06]
                      hover:bg-white/[.05] hover:border-white/[.09]
                      active:scale-[0.985] transition-all duration-150
                      backdrop-blur-sm"
                    >
                      <span className="text-white/30 text-[16px] w-6 text-center flex-shrink-0">
                        {item.icon}
                      </span>
                      <span className="text-[14px] font-medium text-white/75 flex-1">
                        {item.title}
                      </span>
                      <span className="text-white/20 text-[13px]">›</span>
                    </button>
                  ))
                : (trends as any[]).map((item: any, i: number) => (
                    <button
                      key={i}
                      onClick={() => handleTrendClick(item)}
                      className="flex items-center gap-4 px-4 py-4 rounded-2xl w-full text-left
                      bg-white/[.03] border border-white/[.06]
                      hover:bg-white/[.05] hover:border-white/[.09]
                      active:scale-[0.985] transition-all duration-150
                      backdrop-blur-sm"
                    >
                      {item.image ? (
                        <img
                          src={item.image}
                          alt=""
                          className="w-8 h-8 rounded-[10px] object-cover flex-shrink-0"
                        />
                      ) : (
                        <span className="text-white/30 text-[16px] w-6 text-center flex-shrink-0">
                          ✦
                        </span>
                      )}
                      <span className="text-[14px] font-medium text-white/75 flex-1">
                        {localize(item.title)}
                      </span>
                      <span className="text-white/20 text-[13px]">›</span>
                    </button>
                  ))}
          </div>
        </section>
      </div>

      <style>{`@keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}`}</style>
    </div>
  );
};

export default Home;
