'use client';

import { useRouter } from 'next/navigation';
import { useUser } from '@/hooks/useUser';
import { useRequests } from '@/hooks/useRequests';
import { useAuth } from '@/hooks/useAuth';
import {
  useReferrals,
  useApiTokens,
  useGenerateApiToken,
} from '@/hooks/useApiExtras';
import { useBot } from '@/app/providers/BotProvider';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  LogOut,
  Users,
  Star,
  Loader2,
  ExternalLink,
  Key,
  Copy,
  Check,
  Link as LinkIcon,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { timeAgo } from '@/lib/utils';
import { toast } from 'sonner';
import { useState } from 'react';
import { useHaptic } from '@/hooks/useHaptic';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '../layout/LocaleSwitcher';

const Card = ({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) => {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={cn(
        'rounded-2xl bg-white/[.03] border border-white/[.07]',
        'shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
        onClick &&
          'cursor-pointer hover:bg-white/[.05] active:scale-[0.98] transition-all duration-150',
        className
      )}
    >
      {children}
    </Tag>
  );
};

export const Profile = () => {
  const router = useRouter();
  const haptic = useHaptic();
  const t = useTranslations('Profile');
  const { user: tgUser, logout } = useAuth();
  const { bot } = useBot();
  const { data: userData, isLoading: userLoading } = useUser();
  const { data: refData } = useReferrals();
  const { data: apiTokens } = useApiTokens();
  const generateToken = useGenerateApiToken();
  const {
    data: reqData,
    isLoading: reqLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useRequests();
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);

  const STATUS: Record<string, { icon: string; color: string; label: string }> =
    {
      completed: {
        icon: '✓',
        color: '#6ee7b7',
        label: t('statusCompleted'),
      },
      error: { icon: '✕', color: '#fca5a5', label: t('statusError') },
      processing: {
        icon: '⏳',
        color: '#fde68a',
        label: t('statusProcessing'),
      },
    };

  const tokens = userData?.user?.tokens ?? 0;
  const isPremium = userData?.user?.premium ?? false;
  const premiumEnd = userData?.user?.premium_end;
  const requests = reqData?.pages.flatMap((p) => p) ?? [];
  const refStats = (refData as any)?.stats;
  const name = tgUser
    ? `${tgUser.first_name} ${tgUser.last_name || ''}`.trim()
    : t('user');
  const username = tgUser?.username || '';
  const userId = tgUser?.id;
  const referralLink =
    bot?.bot_username && userId
      ? `https://t.me/${bot.bot_username}?start=${userId}`
      : null;

  const PAYMENT_LINK_KEY = `payment_link_${bot?.bot_id || 'default'}`;

  const handleTopUp = async () => {
    haptic.medium();

    if (!bot?.bot_id) {
      toast.error(t('botNotDefined'));
      return;
    }

    try {
      // 1. Проверяем localStorage
      const saved = localStorage.getItem(PAYMENT_LINK_KEY);

      if (saved) {
        window.open(saved, '_blank', 'noopener,noreferrer');
        return;
      }

      // 2. Если нет — делаем запрос
      const { default: api } = await import('@/lib/api');

      const { data } = await api.get('/api/payment-link', {
        params: { bot_id: bot.bot_id },
      });

      if (data?.success && data?.url) {
        // сохраняем
        localStorage.setItem(PAYMENT_LINK_KEY, data.url);

        // открываем
        window.open(data.url, '_blank', 'noopener,noreferrer');
        return;
      }

      toast.error(t('paymentLinkUnavailable'));
    } catch (error) {
      toast.error(t('paymentLinkError'));
    }
  };

  const handleCopyToken = (token: string) => {
    haptic.success();
    navigator.clipboard.writeText(token).then(() => {
      setCopiedToken(token);
      toast.success(t('tokenCopied'));
      setTimeout(() => setCopiedToken(null), 2000);
    });
  };

  const handleCopyRef = () => {
    if (!referralLink) return;
    haptic.success();
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopiedRef(true);
      toast.success(t('refLinkCopied'));
      setTimeout(() => setCopiedRef(false), 2000);
    });
  };

  const handleGenerateToken = () => {
    haptic.light();
    generateToken.mutate(undefined, {
      onSuccess: (d) => {
        toast.success(t('newTokenCreated'));
        handleCopyToken(d.token);
      },
      onError: () => {
        haptic.error();
        toast.error(t('tokenCreateError'));
      },
    });
  };

  return (
    <div className="pb-[calc(80px+max(16px,env(safe-area-inset-bottom)))] max-w-2xl mx-auto">
      {/* ── Header ── */}
      <header
        className="sticky top-0 z-40 flex items-center justify-between px-5 pt-5 pb-4
        bg-gradient-to-b from-zinc-950/95 to-zinc-950/0 backdrop-blur-2xl border-b border-white/[.05]"
      >
        <span className="text-[24px] font-bold tracking-[-0.5px] text-white/90">
          {t('title')}
        </span>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <button
            onClick={() => {
              haptic.heavy();
              logout();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl
              bg-red-500/10 border border-red-500/20 text-red-400/80 text-[12px] font-semibold
              active:scale-[0.94] transition-all duration-150 hover:bg-red-500/15 h-9"
          >
            <LogOut size={12} /> {t('logout')}
          </button>
        </div>
      </header>

      <div className="px-4 pt-4 flex flex-col gap-4">
        {/* ── User Hero ── */}
        <Card className="p-5">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div
                className="w-16 h-16 rounded-full overflow-hidden border border-white/[.12]
                shadow-[0_4px_16px_rgba(0,0,0,0.4)]"
              >
                <Avatar className="size-full">
                  <AvatarImage src={tgUser?.photo_url} />
                  <AvatarFallback className="text-[20px] font-bold bg-transparent">
                    {name[0]}
                  </AvatarFallback>
                </Avatar>
              </div>
              {isPremium && (
                <div
                  className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full
                  bg-amber-400/20 border border-amber-400/30 flex items-center justify-center"
                >
                  <Star
                    size={10}
                    fill="currentColor"
                    className="text-amber-400"
                  />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[20px] font-bold tracking-[-0.3px] truncate text-white/90">
                {name}
              </p>
              {username && (
                <p className="text-[14px] text-white/35 mt-0.5">@{username}</p>
              )}
              {isPremium && premiumEnd && (
                <p className="text-[12px] text-amber-400/60 mt-0.5">
                  Premium до {new Date(premiumEnd * 1000).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* ── Stats Grid ── */}
        <div className="grid grid-cols-2 gap-3">
          <Card onClick={handleTopUp} className="p-4 w-full text-left">
            <div className="flex justify-between items-center mb-3">
              <span className="text-[12px] font-semibold tracking-[0.5px] uppercase text-white/30">
                {t('tokens')}
              </span>
              <Zap size={12} className="text-amber-400/50" />
            </div>
            {userLoading ? (
              <div className="w-14 h-7 rounded-lg bg-white/[.05] animate-pulse mb-2" />
            ) : (
              <div className="flex items-end gap-1 mb-2">
                <span className="text-[28px] font-bold tracking-[-0.6px] leading-none text-white/90">
                  {tokens}
                </span>
                <span className="text-[12px] mb-0.5 text-white/40">◈</span>
              </div>
            )}
            <span className="text-[12px] font-medium text-white/35 flex items-center gap-1">
              {t('topUp')} <ExternalLink size={9} />
            </span>
          </Card>

          <Card
            onClick={() => {
              haptic.light();
              router.push('/profile/referral');
            }}
            className="p-4 w-full text-left"
          >
            <div className="flex justify-between items-center mb-3">
              <span className="text-[12px] font-semibold tracking-[0.5px] uppercase text-white/30">
                {t('referrals')}
              </span>
              <Users size={12} className="text-white/25" />
            </div>
            {!refStats ? (
              <div className="w-10 h-7 rounded-lg bg-white/[.05] animate-pulse mb-2" />
            ) : (
              <span className="text-[28px] font-bold tracking-[-0.6px] leading-none text-white/90 block mb-2">
                {refStats?.total ?? refStats?.total_referrals ?? 0}
              </span>
            )}
            <span className="text-[12px] text-white/30 flex items-center gap-1">
              {t('earned', {
                amount: refStats?.earned ?? refStats?.total_tokens ?? 0,
              })}{' '}
              ◈
              <ChevronRight size={10} />
            </span>
          </Card>
        </div>

        {/* ── Referral Link ── */}
        {referralLink && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[12px] font-semibold tracking-[0.5px] uppercase text-white/30">
                {t('referralLink')}
              </span>
              <LinkIcon size={12} className="text-white/25" />
            </div>
            <div className="flex items-center gap-2.5 bg-white/[.03] rounded-xl px-3 py-2.5 border border-white/[.05]">
              <span className="flex-1 text-[12px] text-white/45 overflow-hidden text-ellipsis whitespace-nowrap font-mono">
                {referralLink}
              </span>
              <button
                onClick={handleCopyRef}
                className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/[.06] active:scale-[0.88] transition-all duration-150"
              >
                {copiedRef ? (
                  <Check size={12} className="text-emerald-400/80" />
                ) : (
                  <Copy size={12} className="text-white/35" />
                )}
              </button>
            </div>
            <p className="text-[12px] text-white/25 mt-2.5">{t('shareLink')}</p>
          </Card>
        )}

        {/* ── Divider ── */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/[.07] to-transparent" />

        {/* ── API Tokens ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-semibold tracking-[0.6px] uppercase text-white/30">
              {t('apiTokens')}
            </span>
            <button
              onClick={handleGenerateToken}
              disabled={generateToken.isPending}
              className="flex items-center gap-1.5 px-3 py-[5px] rounded-full
                bg-white/[.05] border border-white/[.09] text-white/45 text-[11px] font-semibold
                active:scale-[0.94] transition-all duration-150 hover:bg-white/[.07]"
            >
              {generateToken.isPending ? (
                <Loader2 size={10} className="animate-spin" />
              ) : (
                <Key size={10} />
              )}{' '}
              {t('createToken')}
            </button>
          </div>

          {!apiTokens || apiTokens.length === 0 ? (
            <p className="text-[12px] text-white/30 px-1">{t('noTokens')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {apiTokens.map((t_token: any) => (
                <Card
                  key={t_token.id}
                  className="flex items-center gap-2.5 px-4 py-3"
                >
                  <code className="flex-1 text-[12px] text-white/40 overflow-hidden text-ellipsis whitespace-nowrap font-mono">
                    {t_token.token}
                  </code>
                  <span className="text-[12px] text-white/25 flex-shrink-0">
                    {t_token.generations} req
                  </span>
                  <button
                    onClick={() => handleCopyToken(t_token.token)}
                    className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/[.06] active:scale-[0.88] transition-all duration-150"
                  >
                    {copiedToken === t_token.token ? (
                      <Check size={13} className="text-emerald-400/80" />
                    ) : (
                      <Copy size={13} className="text-white/35" />
                    )}
                  </button>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* ── Divider ── */}
        <div className="h-px bg-gradient-to-r from-transparent via-white/[.07] to-transparent" />

        {/* ── History ── */}
        <div className="pb-2">
          <span className="block text-[12px] font-semibold tracking-[0.6px] uppercase text-white/30 mb-3">
            {t('generationHistory')}
          </span>
          {reqLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex-shrink-0 bg-white/[.04] animate-pulse" />
                  <div className="flex-1 flex flex-col gap-1.5">
                    <div className="w-1/2 h-3 rounded bg-white/[.05] animate-pulse" />
                    <div className="w-1/3 h-2.5 rounded bg-white/[.04] animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : requests.length === 0 ? (
            <p className="text-[14px] text-white/30 py-4">
              {t('noGenerations')}
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {requests.map((req) => {
                const st = STATUS[req.status] || {
                  icon: '⏳',
                  color: 'rgba(255,255,255,0.4)',
                  label: req.status,
                };
                return (
                  <div
                    key={req.id}
                    className="flex items-center gap-3 p-3 rounded-xl
                    bg-white/[.02] border border-white/[.05]"
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-[13px]
                      bg-white/[.04] border border-white/[.06]"
                    >
                      {st.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-white/75 truncate">
                        {req.version}
                      </p>
                      <p className="text-[12px] text-white/35 mt-0.5">
                        {req.id} · {timeAgo(req.created_at)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-[3px] flex-shrink-0">
                      <span
                        className="text-[12px] font-semibold"
                        style={{ color: st.color }}
                      >
                        {st.label}
                      </span>
                      <span className="text-[13px] text-white/25">
                        {req.cost} ◈
                      </span>
                    </div>
                  </div>
                );
              })}

              {hasNextPage && (
                <button
                  onClick={() => {
                    haptic.light();
                    fetchNextPage();
                  }}
                  disabled={isFetchingNextPage}
                  className="w-full py-3 rounded-2xl text-[13px] font-medium text-white/40 mt-1
                    bg-white/[.03] border border-white/[.06]
                    active:scale-[0.97] transition-all duration-150
                    flex items-center justify-center gap-2"
                >
                  {isFetchingNextPage ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />{' '}
                      {t('loading')}
                    </>
                  ) : (
                    t('loadMore')
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
