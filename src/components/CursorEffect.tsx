import { useEffect, useState, useRef } from "react";
import { motion, useSpring, useMotionValue } from "framer-motion";
import { useSettingsStore } from "../core/store/settingsStore";

export const CursorEffect = () => {
  const cursorStyle = useSettingsStore((s) => s.cursorStyle);
  const [isHovering, setIsHovering] = useState(false);
  const [isClicking, setIsClicking] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);

  const springConfig = { damping: 30, stiffness: 400, mass: 0.2 };
  const followerSpring = { damping: 20, stiffness: 150 };

  const posX = useSpring(mouseX, springConfig);
  const posY = useSpring(mouseY, springConfig);

  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const springRotateX = useSpring(rotateX, followerSpring);
  const springRotateY = useSpring(rotateY, followerSpring);

  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (cursorStyle === "default") return;

    const moveCursor = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const deltaX = clientX - lastPos.current.x;
      const deltaY = clientY - lastPos.current.y;

      rotateY.set(Math.max(-30, Math.min(30, deltaX * 0.5)));
      rotateX.set(Math.max(-30, Math.min(30, -deltaY * 0.5)));

      mouseX.set(clientX);
      mouseY.set(clientY);
      lastPos.current = { x: clientX, y: clientY };
      if (!isVisible) setIsVisible(true);
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      setIsHovering(
        !!(
          target.tagName === "BUTTON" ||
          target.tagName === "A" ||
          target.closest("button") ||
          target.closest("a") ||
          target.classList.contains("cursor-pointer") ||
          target.getAttribute("role") === "button"
        ),
      );
    };

    window.addEventListener("mousemove", moveCursor);
    window.addEventListener("mousedown", () => setIsClicking(true));
    window.addEventListener("mouseup", () => setIsClicking(false));
    window.addEventListener("mouseover", handleMouseOver);
    document.addEventListener("mouseleave", () => setIsVisible(false));
    document.addEventListener("mouseenter", () => setIsVisible(true));

    return () => {
      window.removeEventListener("mousemove", moveCursor);
      window.removeEventListener("mouseover", handleMouseOver);
    };
  }, [mouseX, mouseY, isVisible, rotateX, rotateY, cursorStyle]);

  if (cursorStyle === "default" || !isVisible) return null;

  // ── High-Quality "Classic" Vector Pointer ───────────────────
  const PointerSVG = ({ color = "white", outline = "black" }) => (
    <svg
      style={{ marginLeft: -2, marginTop: -2 }}
      width="28"
      height="28"
      viewBox="-2 -2 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M0 0L8 22L12 14L20 10L0 0Z"
        fill={color}
        stroke={outline}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );

  // ── High-Quality Detailed Hand Pointer ────────────────────────────────
  const HandSVG = ({ color = "white", outline = "black" }) => (
    <svg
      style={{ marginLeft: -9, marginTop: -2 }}
      width="28"
      height="28"
      viewBox="-2 -2 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8 3V12L5.5 10.5C4.5 10 3 10.5 3 11.5L7 17.5C8 19 10 21 12 21H15C17.5 21 19 19 19 16.5V11C19 10 18 9 17 9H16V8C16 7 15 6 14 6H13V3C13 1.5 11 1.5 10.5 3Z"
        fill={color}
        stroke={outline}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );

  // ── Rendering Logics ───────────────────────────────────────

  const renderClassic = () => (
    <motion.div
      style={{
        x: mouseX,
        y: mouseY,
        scale: isClicking ? 0.9 : 1,
        transformOrigin: "0 0",
      }}
    >
      <div style={{ filter: "drop-shadow(2px 2px 0px rgba(0,0,0,0.4))" }}>
        {isHovering ? <HandSVG /> : <PointerSVG />}
      </div>
    </motion.div>
  );

  const renderVoxel = (variant: "normal" | "crystal" = "normal") => (
    <motion.div
      style={{
        x: mouseX,
        y: mouseY,
        transformStyle: "preserve-3d",
        rotateX: springRotateX,
        rotateY: springRotateY,
        scale: isClicking ? 0.85 : 1,
        transformOrigin: "0 0",
      }}
    >
      {[...Array(variant === "crystal" ? 12 : 8)].map((_, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            transform: `translateZ(${-i * 1.2}px)`,
            opacity: 1 - i * 0.08,
          }}
        >
          {isHovering ? (
            <HandSVG
              color={
                variant === "crystal"
                  ? i === 0
                    ? "#e879f9"
                    : "#701a75"
                  : i === 0
                    ? "white"
                    : "#d4d4d8"
              }
              outline={variant === "crystal" ? "#2e1065" : "black"}
            />
          ) : (
            <PointerSVG
              color={
                variant === "crystal"
                  ? i === 0
                    ? "#818cf8"
                    : "#312e81"
                  : i === 0
                    ? "white"
                    : "#d4d4d8"
              }
              outline={variant === "crystal" ? "#1e1b4b" : "black"}
            />
          )}
        </div>
      ))}
    </motion.div>
  );

  const renderNeon = () => (
    <motion.div
      style={{
        x: mouseX,
        y: mouseY,
        scale: isClicking ? 0.9 : 1,
        transformOrigin: "0 0",
      }}
    >
      <div className="relative">
        <div className="absolute inset-0 blur-md opacity-40 bg-gradient-to-br from-cyan-400 via-purple-500 to-pink-500 rounded-full" />
        <div style={{ filter: "drop-shadow(0 0 8px rgba(168, 85, 247, 0.5))" }}>
          {isHovering ? (
            <HandSVG color="transparent" outline="url(#neonGrad)" />
          ) : (
            <PointerSVG color="transparent" outline="url(#neonGrad)" />
          )}
        </div>
        <svg width="0" height="0">
          <defs>
            <linearGradient id="neonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="50%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#ec4899" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </motion.div>
  );

  const renderGlitch = () => (
    <motion.div style={{ x: mouseX, y: mouseY, transformOrigin: "0 0" }}>
      <div className="relative">
        <motion.div
          className="absolute top-0 left-0"
          animate={{ x: [-3, 3, -2], y: [2, -2, 3] }}
          transition={{ repeat: Infinity, duration: 0.15 }}
        >
          {isHovering ? (
            <HandSVG color="#ff0080" outline="none" />
          ) : (
            <PointerSVG color="#ff0080" outline="none" />
          )}
        </motion.div>
        <motion.div
          className="absolute top-0 left-0"
          animate={{ x: [3, -3, 2], y: [-2, 2, -3] }}
          transition={{ repeat: Infinity, duration: 0.15, delay: 0.05 }}
        >
          {isHovering ? (
            <HandSVG color="#00fff0" outline="none" />
          ) : (
            <PointerSVG color="#00fff0" outline="none" />
          )}
        </motion.div>
        <div className="relative z-10">
          {isHovering ? (
            <HandSVG color="white" outline="black" />
          ) : (
            <PointerSVG color="white" outline="black" />
          )}
        </div>
      </div>
    </motion.div>
  );

  const renderCircle = () => (
    <>
      <motion.div
        className="fixed w-2 h-2 bg-blue-500 rounded-full"
        style={{ x: mouseX, y: mouseY, translateX: "-50%", translateY: "-50%" }}
      />
      <motion.div
        className="fixed rounded-full border border-blue-400/50"
        style={{
          x: posX,
          y: posY,
          translateX: "-50%",
          translateY: "-50%",
          width: isHovering ? 60 : 32,
          height: isHovering ? 60 : 32,
          backgroundColor: isHovering
            ? "rgba(59, 130, 246, 0.1)"
            : "transparent",
        }}
        animate={{ scale: isClicking ? 0.8 : 1 }}
      />
    </>
  );

  return (
    <div className="fixed inset-0 pointer-events-none z-[99999] no-print">
      {cursorStyle === "classic" && renderClassic()}
      {cursorStyle === "voxel" && renderVoxel("normal")}
      {cursorStyle === "crystal" && renderVoxel("crystal")}
      {cursorStyle === "neon" && renderNeon()}
      {cursorStyle === "glitch" && renderGlitch()}
      {cursorStyle === "circle" && renderCircle()}
    </div>
  );
};
