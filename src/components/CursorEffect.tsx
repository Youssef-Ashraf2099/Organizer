import { useEffect, useRef } from "react";

interface TrailParticle {
  id: number;
  x: number;
  y: number;
}

export const CursorEffect = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<TrailParticle[]>([]);
  const particleIdRef = useRef(0);
  const lastTimeRef = useRef(Date.now());

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();

      // Create trail particles every 30ms for smooth effect
      if (now - lastTimeRef.current > 30) {
        const particle: TrailParticle = {
          id: particleIdRef.current++,
          x: e.clientX,
          y: e.clientY,
        };

        particlesRef.current.push(particle);
        lastTimeRef.current = now;

        // Create and add trail element
        if (containerRef.current) {
          const trail = document.createElement("div");
          trail.className = "cursor-trail";
          trail.style.left = `${particle.x}px`;
          trail.style.top = `${particle.y}px`;
          containerRef.current.appendChild(trail);

          // Fade out and remove
          setTimeout(() => {
            trail.classList.add("fade");
          }, 0);

          setTimeout(() => {
            trail.remove();
            particlesRef.current = particlesRef.current.filter(
              (p) => p.id !== particle.id
            );
          }, 500);
        }
      }
    };

    const handleMouseLeave = () => {
      // Clean up all particles when mouse leaves window
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
      particlesRef.current = [];
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, []);

  return <div ref={containerRef} className="cursor-effect-container" />;
};
