import React from 'react';
import { motion } from 'framer-motion';

export default function AnimatedText({ text, className, delay = 0 }) {
  const words = text.split(" ");
  return (
    <span className={className} style={{ display: 'inline-block' }}>
      {words.map((word, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay + index * 0.15, duration: 0.6, ease: "easeOut" }}
          style={{ display: 'inline-block', marginRight: '0.3em' }}
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
}
