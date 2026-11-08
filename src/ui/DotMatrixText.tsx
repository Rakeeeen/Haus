import React from 'react';
import { motion } from 'framer-motion';
import { SPRING } from '@/ui/springPose';

// ─── DOT MATRIX DIGITS DEFINITIONS (5x4 Grid) ───
const DIGIT_MATRICES: Record<string, number[][]> = {
  '0': [
    [1, 1, 1, 1],
    [1, 0, 0, 1],
    [1, 0, 0, 1],
    [1, 0, 0, 1],
    [1, 1, 1, 1]
  ],
  '1': [
    [0, 0, 1, 0],
    [0, 1, 1, 0],
    [0, 0, 1, 0],
    [0, 0, 1, 0],
    [0, 1, 1, 1]
  ],
  '2': [
    [1, 1, 1, 1],
    [0, 0, 0, 1],
    [1, 1, 1, 1],
    [1, 0, 0, 0],
    [1, 1, 1, 1]
  ],
  '3': [
    [1, 1, 1, 1],
    [0, 0, 0, 1],
    [0, 1, 1, 1],
    [0, 0, 0, 1],
    [1, 1, 1, 1]
  ],
  '4': [
    [1, 0, 0, 1],
    [1, 0, 0, 1],
    [1, 1, 1, 1],
    [0, 0, 0, 1],
    [0, 0, 0, 1]
  ],
  '5': [
    [1, 1, 1, 1],
    [1, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 1],
    [1, 1, 1, 1]
  ],
  '6': [
    [1, 1, 1, 1],
    [1, 0, 0, 0],
    [1, 1, 1, 1],
    [1, 0, 0, 1],
    [1, 1, 1, 1]
  ],
  '7': [
    [1, 1, 1, 1],
    [0, 0, 0, 1],
    [0, 0, 1, 0],
    [0, 1, 0, 0],
    [0, 1, 0, 0]
  ],
  '8': [
    [1, 1, 1, 1],
    [1, 0, 0, 1],
    [1, 1, 1, 1],
    [1, 0, 0, 1],
    [1, 1, 1, 1]
  ],
  '9': [
    [1, 1, 1, 1],
    [1, 0, 0, 1],
    [1, 1, 1, 1],
    [0, 0, 0, 1],
    [0, 0, 0, 1]
  ]
};

export const DotMatrixText: React.FC<{ 
  text: string; 
  dotSizeClassName?: string;
  gapClassName?: string;
}> = ({ 
  text, 
  dotSizeClassName = 'w-2.5 h-2.5 sm:w-3 sm:h-3',
  gapClassName = 'gap-1 sm:gap-1.5'
}) => {
  const chars = text.split('');
  return (
    <div className="flex gap-4 select-none">
      {chars.map((char, charIdx) => {
        const matrix = DIGIT_MATRICES[char];
        if (!matrix) return null;
        return (
          <div key={charIdx} className={`grid grid-cols-4 ${gapClassName}`}>
            {matrix.map((row, rowIdx) =>
              row.map((val, colIdx) => (
                <motion.div
                  key={`${rowIdx}-${colIdx}`}
                  initial={false}
                  // Square pixels with the unlit ones faintly showing, like an old LED board:
                  // the same display language as the clock's digits.
                  animate={{
                    scale: val ? 1 : 0.9,
                    opacity: val ? 1 : 0.08
                  }}
                  transition={{ ...SPRING, opacity: { duration: 0.2 } }}
                  className={`${dotSizeClassName} bg-ink`}
                />
              ))
            )}
          </div>
        );
      })}
    </div>
  );
};
