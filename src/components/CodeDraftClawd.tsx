import { useState } from 'react';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import clawdLaptopAnimation from '../assets/code/clawd-laptop.json';

type CodeDraftClawdProps = {
  centered?: boolean;
};

export default function CodeDraftClawd({ centered = false }: CodeDraftClawdProps) {
  const [replayKey, setReplayKey] = useState(0);
  const position = centered
    ? 'absolute right-[140px] bottom-[-13px] w-[80px] h-[80px] -scale-x-100'
    : 'absolute right-[-16px] bottom-[-13px] w-[80px] h-[80px] -scale-x-100';

  return (
    <div className="relative h-0 -mb-[var(--g5)] pointer-events-none" data-testid="code-clawd">
      <div className="pointer-events-auto" />
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setReplayKey((current) => current + 1)}
        className={`${position} epitaxy-code-clawd border-0 bg-transparent p-0 outline-none hide-focus-ring cursor-default pointer-events-auto`}
      >
        <DotLottieReact
          key={replayKey}
          data={clawdLaptopAnimation}
          autoplay
          loop={false}
          renderConfig={{ autoResize: true }}
          className="h-full w-full"
        />
      </button>
    </div>
  );
}
