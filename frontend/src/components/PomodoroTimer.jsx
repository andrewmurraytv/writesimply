import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, RotateCcw, Coffee } from "lucide-react";
import { toast } from "sonner";

const WORK_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export default function PomodoroTimer() {
  const [mode, setMode] = useState("idle"); // idle | work | break
  const [secondsLeft, setSecondsLeft] = useState(WORK_SECONDS);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);

  const totalSeconds = mode === "break" ? BREAK_SECONDS : WORK_SECONDS;
  const progress = 1 - secondsLeft / totalSeconds;

  const tick = useCallback(() => {
    setSecondsLeft((prev) => {
      if (prev <= 1) {
        if (mode === "work") {
          toast.success("Session done! Take a 5-minute break.", { duration: 6000 });
          setMode("break");
          return BREAK_SECONDS;
        } else {
          toast("Break over. Ready for another round?", { duration: 6000 });
          setMode("idle");
          setRunning(false);
          return WORK_SECONDS;
        }
      }
      return prev - 1;
    });
  }, [mode]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(tick, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, tick]);

  const startWork = () => {
    setMode("work");
    setSecondsLeft(WORK_SECONDS);
    setRunning(true);
  };

  const toggle = () => {
    if (mode === "idle") {
      startWork();
    } else {
      setRunning(!running);
    }
  };

  const reset = () => {
    setRunning(false);
    setMode("idle");
    setSecondsLeft(WORK_SECONDS);
  };

  // SVG ring
  const size = 30;
  const strokeWidth = 2.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progress);

  const ringColor = mode === "break" ? "#78716C" : "#C96442";
  const bgColor = "#E6E4DD";

  if (mode === "idle") {
    return (
      <button
        data-testid="pomodoro-start"
        onClick={startWork}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[#78716C] hover:text-[#1F1E1D] hover:bg-[#F0EFEB] transition-colors"
        title="Start 25-min writing session"
      >
        <Play className="w-3 h-3" strokeWidth={2} fill="currentColor" />
        <span className="text-[0.65rem] font-[Manrope] font-medium">25:00</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5" data-testid="pomodoro-timer">
      {/* Ring */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={bgColor} strokeWidth={strokeWidth} />
          <circle
            cx={size / 2} cy={size / 2} r={radius} fill="none"
            stroke={ringColor} strokeWidth={strokeWidth}
            strokeDasharray={circumference} strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        {mode === "break" && (
          <Coffee className="absolute inset-0 m-auto w-3 h-3 text-[#78716C]" strokeWidth={1.5} />
        )}
      </div>

      {/* Time */}
      <span className={`text-[0.65rem] font-[Manrope] font-medium tabular-nums ${mode === "break" ? "text-[#78716C]" : "text-[#C96442]"}`}>
        {formatTime(secondsLeft)}
      </span>

      {/* Controls */}
      <button
        data-testid="pomodoro-toggle"
        onClick={toggle}
        className="w-5 h-5 flex items-center justify-center rounded text-[#78716C] hover:text-[#1F1E1D] transition-colors"
        title={running ? "Pause" : "Resume"}
      >
        {running ? <Pause className="w-3 h-3" strokeWidth={2} /> : <Play className="w-3 h-3" strokeWidth={2} fill="currentColor" />}
      </button>
      <button
        data-testid="pomodoro-reset"
        onClick={reset}
        className="w-5 h-5 flex items-center justify-center rounded text-[#78716C] hover:text-[#1F1E1D] transition-colors"
        title="Reset"
      >
        <RotateCcw className="w-3 h-3" strokeWidth={2} />
      </button>
    </div>
  );
}
