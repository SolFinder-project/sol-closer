'use client';

import Image from 'next/image';

/** Same horizontal gradient as the SP monogram asset (purple → magenta → cyan → Solana teal). */
const LOGO_WORDMARK_GRADIENT =
  'linear-gradient(90deg, #8B5CF6 0%, #D946EF 28%, #06B6D4 62%, #14F195 100%)';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export default function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
  const sizes = {
    sm: { container: 'w-12 h-12', text: 'text-base', tagline: 'hidden' },
    md: { container: 'w-16 h-16', text: 'text-2xl', tagline: 'text-[10px]' },
    lg: { container: 'w-28 h-28', text: 'text-4xl', tagline: 'text-sm' },
  };

  const textColClass =
    sizes[size].tagline === 'hidden'
      ? 'flex h-12 flex-col justify-center min-w-0'
      : 'flex flex-col min-w-0 justify-center';

  return (
    <div className={`flex items-center gap-2 md:gap-3 ${className}`}>
      <div
        className={`relative group flex-shrink-0 flex items-center justify-center ${sizes[size].container}`}
      >
        <Image
          src="/branding/solpit-logo.png"
          alt="SolPit"
          width={1024}
          height={1024}
          className="max-h-full max-w-full w-full h-full object-contain object-center transition-all duration-300 group-hover:scale-110 drop-shadow-2xl"
          priority
        />
      </div>

      {showText && (
        <div className={textColClass}>
          <h1
            className={`${sizes[size].text} font-bold font-[family-name:var(--font-orbitron)] leading-none truncate [line-height:1]`}
          >
            <span
              className="text-transparent bg-clip-text"
              style={{
                backgroundImage: LOGO_WORDMARK_GRADIENT,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
              }}
            >
              SolPit
            </span>
          </h1>
          {sizes[size].tagline !== 'hidden' && (
            <p className={`${sizes[size].tagline} text-gray-400 uppercase tracking-widest font-mono mt-1`}>
              RECLAIM • REFUEL • RACE
            </p>
          )}
        </div>
      )}
    </div>
  );
}
