import { motion, useReducedMotion } from "motion/react";

const isConstrainedBrowser = () => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPhone|iPad|iPod|Android|Mobile|MicroMessenger/i.test(ua);
};

function StaticBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 20% 20%, rgba(184, 230, 213, 0.28) 0%, transparent 45%), " +
            "radial-gradient(circle at 80% 25%, rgba(126, 200, 216, 0.24) 0%, transparent 45%), " +
            "radial-gradient(circle at 50% 75%, rgba(44, 95, 127, 0.18) 0%, transparent 55%)",
        }}
      />
    </div>
  );
}

export function FluidBackground() {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion || isConstrainedBrowser()) {
    return <StaticBackground />;
  }

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
      <motion.div
        className="absolute top-[10%] left-[5%] w-[500px] h-[500px] organic-blob opacity-40"
        style={{
          background: "radial-gradient(circle, rgba(184, 230, 213, 0.6) 0%, rgba(168, 216, 232, 0.3) 50%, transparent 100%)",
          filter: "blur(60px)",
        }}
        animate={{ x: [0, 30, 0], y: [0, -20, 0], scale: [1, 1.1, 1], rotate: [0, 10, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-[20%] right-[10%] w-[400px] h-[400px] organic-blob-reverse opacity-40"
        style={{
          background: "radial-gradient(circle, rgba(91, 154, 168, 0.5) 0%, rgba(126, 200, 216, 0.3) 50%, transparent 100%)",
          filter: "blur(50px)",
        }}
        animate={{ x: [0, -25, 0], y: [0, 30, 0], scale: [1, 1.15, 1], rotate: [0, -15, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[10%] left-[15%] w-[450px] h-[450px] organic-blob opacity-35"
        style={{
          background: "radial-gradient(circle, rgba(168, 216, 232, 0.6) 0%, rgba(168, 216, 232, 0.3) 50%, transparent 100%)",
          filter: "blur(70px)",
        }}
        animate={{ x: [0, 40, 0], y: [0, -30, 0], scale: [1, 1.2, 1], rotate: [0, 20, 0] }}
        transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[20%] right-[5%] w-[380px] h-[380px] organic-blob-reverse opacity-30"
        style={{
          background: "radial-gradient(circle, rgba(126, 200, 216, 0.5) 0%, rgba(91, 154, 168, 0.3) 50%, transparent 100%)",
          filter: "blur(55px)",
        }}
        animate={{ x: [0, -35, 0], y: [0, 25, 0], scale: [1, 1.1, 1], rotate: [0, -10, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] organic-blob opacity-20"
        style={{
          background: "radial-gradient(circle, rgba(44, 95, 127, 0.3) 0%, transparent 70%)",
          filter: "blur(80px)",
        }}
        animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.3, 0.2] }}
        transition={{ duration: 35, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}
