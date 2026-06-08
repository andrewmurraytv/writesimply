import { useState, useRef, useCallback } from "react";
import { Volume2, VolumeX } from "lucide-react";

function createBrownNoise(audioCtx) {
  const bufferSize = 2 * audioCtx.sampleRate;
  const buffer = audioCtx.createBuffer(2, bufferSize, audioCtx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5;
    }
  }
  return buffer;
}

export default function AmbientSound() {
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.4);
  const [showSlider, setShowSlider] = useState(false);
  const audioCtxRef = useRef(null);
  const sourceRef = useRef(null);
  const gainRef = useRef(null);

  const start = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") ctx.resume();

    const buffer = createBrownNoise(ctx);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const gain = ctx.createGain();
    gain.gain.value = volume;

    source.connect(gain);
    gain.connect(ctx.destination);
    source.start();

    sourceRef.current = source;
    gainRef.current = gain;
    setPlaying(true);
  }, [volume]);

  const stop = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch {}
      sourceRef.current = null;
    }
    setPlaying(false);
  }, []);

  const toggle = () => {
    if (playing) stop();
    else start();
  };

  const handleVolume = (e) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (gainRef.current) gainRef.current.gain.value = v;
  };

  return (
    <div
      className="relative flex items-center"
      onMouseEnter={() => setShowSlider(true)}
      onMouseLeave={() => setShowSlider(false)}
    >
      <button
        data-testid="ambient-sound-toggle"
        onClick={toggle}
        className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
          playing ? "bg-[#1F1E1D] text-[#FAF9F5]" : "text-[#78716C] hover:text-[#1F1E1D] hover:bg-[#F0EFEB]"
        }`}
        title={playing ? "Stop brown noise" : "Play brown noise"}
      >
        {playing ? <Volume2 className="w-3.5 h-3.5" strokeWidth={1.5} /> : <VolumeX className="w-3.5 h-3.5" strokeWidth={1.5} />}
      </button>

      {/* Volume slider on hover */}
      {showSlider && playing && (
        <div className="absolute top-full right-0 mt-1 bg-[#1F1E1D] rounded-lg px-3 py-2 shadow-xl z-50 flex items-center gap-2">
          <input
            data-testid="ambient-volume-slider"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={handleVolume}
            className="w-20 h-1 accent-[#C96442] cursor-pointer"
          />
          <span className="text-[0.6rem] text-white/60 font-[Manrope] w-7 text-right">
            {Math.round(volume * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}
