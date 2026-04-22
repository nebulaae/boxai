'use client';

import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Home, Brain, Sparkles, MessageCircle, UserRound } from 'lucide-react';
import { useHaptic } from '@/hooks/useHaptic';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';

const items = [
  { id: 1, href: '/', key: 'home', icon: Home },
  { id: 2, href: '/models', key: 'models', icon: Brain },
  { id: 3, href: '/generate', key: 'create', icon: Sparkles },
  { id: 4, href: '/chats', key: 'chats', icon: MessageCircle },
  { id: 5, href: '/profile', key: 'profile', icon: UserRound },
] as const;

export const BottomBar = () => {
  const pathname = usePathname();
  const haptic = useHaptic();
  const t = useTranslations('BottomBar');
  const [visible, setVisible] = useState(true);

  const isChat = /^\/chats\/.+/.test(pathname);

  const handleScroll = useCallback(() => {
    let lastY = 0;
    let timer: ReturnType<typeof setTimeout>;
    const onScroll = () => {
      const curr = window.scrollY;
      setVisible(curr <= lastY || curr < 80);
      lastY = curr;
      clearTimeout(timer);
      timer = setTimeout(() => setVisible(true), 1500);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (isChat) return;
    const cleanup = handleScroll();
    const onActivity = () => setVisible(true);
    ['touchstart', 'mousedown'].forEach((e) =>
      window.addEventListener(e, onActivity, { passive: true })
    );
    return () => {
      cleanup();
      ['touchstart', 'mousedown'].forEach((e) =>
        window.removeEventListener(e, onActivity)
      );
    };
  }, [isChat, handleScroll]);

  if (isChat) return null;

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const homeItem = items[0];
  const midItems = items.slice(1, 4);
  const profileItem = items[4];

  return (
    <nav
      aria-label="Нижняя навигация"
      className={cn(
        'flex sm:hidden fixed bottom-0 left-0 right-0 z-50 justify-center px-4',
        'pb-[max(10px,env(safe-area-inset-bottom))]',
        'transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
        !visible && 'translate-y-[120%]'
      )}
    >
      <div className="flex items-center gap-2 px-2.5 py-2
        rounded-[28px]
        bg-zinc-950/85 backdrop-blur-3xl backdrop-saturate-200
        border border-white/[.13]
        shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_20px_60px_rgba(0,0,0,0.65),0_4px_16px_rgba(0,0,0,0.4)]"
      >
        {/* Home bubble */}
        <Link
          href={homeItem.href}
          onClick={() => haptic.selection()}
          className={cn(
            'w-14 h-14 rounded-full flex flex-col items-center justify-center gap-0.5',
            'select-none no-underline transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
            'active:scale-90',
            'border',
            isActive(homeItem.href)
              ? 'bg-white/[.12] border-white/[.20] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_0_20px_rgba(255,255,255,0.08)]'
              : 'bg-white/[.05] border-white/[.08] hover:bg-white/[.08]'
          )}
        >
          <Home
            size={20}
            strokeWidth={isActive(homeItem.href) ? 2.2 : 1.6}
            className={cn(
              'transition-all duration-250',
              isActive(homeItem.href) ? 'text-white' : 'text-white/45'
            )}
          />
          <span className={cn(
            'text-[9px] font-medium leading-none transition-all duration-250',
            isActive(homeItem.href) ? 'text-white/85' : 'text-white/35'
          )}>
            {t(homeItem.key)}
          </span>
        </Link>

        {/* Divider */}
        <div className="w-px h-7 bg-white/[.10] rounded-full flex-shrink-0" />

        {/* Mid items */}
        <div className="flex items-center">
          {midItems.map((item) => {
            const active = isActive(item.href);
            const isCreate = item.id === 3;
            const Icon = item.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => {
                  if (isCreate) haptic.medium();
                  else haptic.selection();
                }}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-2.5 rounded-2xl',
                  'select-none no-underline transition-all duration-250 ease-[cubic-bezier(0.32,0.72,0,1)]',
                  'active:scale-[0.88]',
                )}
                style={active || isCreate ? {
                  background: 'rgba(255,255,255,0.09)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
                } : {}}
              >
                <Icon
                  size={18}
                  strokeWidth={active || isCreate ? 2.2 : 1.5}
                  className={cn(
                    'transition-all duration-250',
                    active || isCreate ? 'text-white' : 'text-white/40'
                  )}
                />
                <span className={cn(
                  'text-[9.5px] font-medium leading-none whitespace-nowrap transition-all duration-250',
                  active || isCreate ? 'text-white/85' : 'text-white/30'
                )}>
                  {t(item.key)}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Divider */}
        <div className="w-px h-7 bg-white/[.10] rounded-full flex-shrink-0" />

        {/* Profile bubble */}
        <Link
          href={profileItem.href}
          onClick={() => haptic.selection()}
          className={cn(
            'w-14 h-14 rounded-full flex flex-col items-center justify-center gap-0.5',
            'select-none no-underline transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
            'active:scale-90',
            'border',
            isActive(profileItem.href)
              ? 'bg-white/[.12] border-white/[.20] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_0_20px_rgba(255,255,255,0.08)]'
              : 'bg-white/[.05] border-white/[.08] hover:bg-white/[.08]'
          )}
        >
          <UserRound
            size={20}
            strokeWidth={isActive(profileItem.href) ? 2.2 : 1.6}
            className={cn(
              'transition-all duration-250',
              isActive(profileItem.href) ? 'text-white' : 'text-white/45'
            )}
          />
          <span className={cn(
            'text-[9px] font-medium leading-none transition-all duration-250',
            isActive(profileItem.href) ? 'text-white/85' : 'text-white/35'
          )}>
            {t(profileItem.key)}
          </span>
        </Link>
      </div>
    </nav>
  );
};