import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export const ThinkingAnimation = () => {
  const [textIndex, setTextIndex] = useState(0);
  const texts = ["Memuat", "Working", "Menghubung"];

  useEffect(() => {
    const interval = setInterval(() => {
      setTextIndex((prev) => (prev + 1) % texts.length);
    }, 1200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full w-fit">
      <div className="flex gap-1 items-center">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1 h-1 bg-white/50 rounded-full"
            animate={{
              y: [0, -2, 0],
              opacity: [0.4, 1, 0.4]
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.15,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
      <div className="relative w-[70px] h-[14px] flex items-center overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.span
            key={textIndex}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className="text-[10px] text-white/50 uppercase tracking-widest absolute left-0"
          >
            {texts[textIndex]}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
};
