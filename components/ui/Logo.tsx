'use client';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export default function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
  const sizes = {
    sm: { container: 'w-10 h-10', text: 'text-base', tagline: 'hidden' },
    md: { container: 'w-14 h-14', text: 'text-2xl', tagline: 'text-[10px]' },
    lg: { container: 'w-24 h-24', text: 'text-4xl', tagline: 'text-sm' },
  };

  return (
    <div className={`flex items-center gap-2 md:gap-3 ${className}`}>
      {/* Hexagone avec Diamant + Loupe */}
      <div className="relative group flex-shrink-0">
        <svg
          className={`${sizes[size].container} transition-all duration-300 group-hover:scale-110 drop-shadow-2xl`}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="hexGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A855F7" stopOpacity="1" />
              <stop offset="50%" stopColor="#EC4899" stopOpacity="1" />
              <stop offset="100%" stopColor="#06B6D4" stopOpacity="1" />
            </linearGradient>
            
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>

            <linearGradient id="diamondGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#06B6D4" />
              <stop offset="50%" stopColor="#A855F7" />
              <stop offset="100%" stopColor="#EC4899" />
            </linearGradient>

            <radialGradient id="bgGlow">
              <stop offset="0%" stopColor="#A855F7" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#A855F7" stopOpacity="0" />
            </radialGradient>
          </defs>

          <circle cx="50" cy="50" r="45" fill="url(#bgGlow)" className="animate-pulse-slow" />

          <g className="animate-spin-slow" style={{ transformOrigin: 'center' }}>
            <path
              d="M50 8 L82 27 L82 73 L50 92 L18 73 L18 27 Z"
              stroke="url(#hexGradient)"
              strokeWidth="3.5"
              fill="rgba(168, 85, 247, 0.05)"
              filter="url(#glow)"
            />
          </g>

          <g className="animate-spin-slow" style={{ transformOrigin: 'center', animationDirection: 'reverse', animationDuration: '15s' }}>
            <path
              d="M50 15 L75 30 L75 70 L50 85 L25 70 L25 30 Z"
              stroke="url(#hexGradient)"
              strokeWidth="2"
              fill="none"
              opacity="0.4"
            />
          </g>

          <g className="animate-float">
            <path d="M50 32 L42 48 L50 52 Z" fill="#FFFFFF" opacity="0.6" />
            <path d="M50 32 L65 48 L50 68 L35 48 Z" fill="url(#diamondGradient)" className="drop-shadow-2xl" filter="url(#glow)" />
            <path d="M50 32 L65 48 L50 52 L35 48 Z" fill="#06B6D4" opacity="0.7" />
            <path d="M50 32 L55 48 L50 52 L45 48 Z" fill="#FFFFFF" opacity="0.4" />
            <circle cx="50" cy="40" r="2" fill="#FFFFFF" opacity="0.8" className="animate-ping" />
          </g>

          <g className="group-hover:translate-x-2 group-hover:translate-y-2 transition-transform duration-300">
            <circle cx="68" cy="35" r="11" stroke="#EC4899" strokeWidth="3" fill="rgba(236, 72, 153, 0.1)" filter="url(#glow)" />
            <circle cx="68" cy="35" r="8" stroke="#EC4899" strokeWidth="2" fill="none" opacity="0.5" />
            <line x1="76" y1="43" x2="83" y2="50" stroke="#EC4899" strokeWidth="3.5" strokeLinecap="round" filter="url(#glow)" />
            <path d="M 66 32 Q 68 33 67 35" stroke="#FFFFFF" strokeWidth="1.5" fill="none" opacity="0.6" />
          </g>

          <circle cx="25" cy="25" r="2" fill="#A855F7" className="animate-ping" style={{ animationDelay: '0s' }} opacity="0.8" />
          <circle cx="75" cy="75" r="2" fill="#EC4899" className="animate-ping" style={{ animationDelay: '0.5s' }} opacity="0.8" />
          <circle cx="25" cy="75" r="2" fill="#06B6D4" className="animate-ping" style={{ animationDelay: '1s' }} opacity="0.8" />
          <circle cx="75" cy="25" r="1.5" fill="#FFFFFF" className="animate-ping" style={{ animationDelay: '1.5s' }} opacity="0.6" />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col min-w-0">
          <h1 className={`${sizes[size].text} font-bold font-[family-name:var(--font-orbitron)] leading-none drop-shadow-lg truncate`}>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-purple via-neon-pink to-neon-cyan animate-glow">
              SOLcloser
            </span>
          </h1>
          {sizes[size].tagline !== 'hidden' && (
            <p className={`${sizes[size].tagline} text-gray-400 uppercase tracking-widest font-mono mt-1`}>
              RECLAIM • EARN • GROW
            </p>
          )}
        </div>
      )}
    </div>
  );
}
