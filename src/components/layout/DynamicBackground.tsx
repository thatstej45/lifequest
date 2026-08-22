import React from 'react';
import { motion } from 'motion/react';

const DynamicBackground = React.memo(() => (
  <div className="app-background fixed inset-0 pointer-events-none -z-10 overflow-hidden bg-[#e5ecf6]">
    <motion.div
      animate={{
        scale: [1, 1.2, 1],
        rotate: [0, 90, 0],
        x: ['-5%', '10%', '-5%'],
        y: ['-5%', '5%', '-5%'],
      }}
      transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
      className="app-background-orb absolute top-[-10%] left-[-10%] w-[70%] h-[70%] rounded-full bg-blue-300/25 blur-[90px] will-change-transform"
    />
    <motion.div
      animate={{
        scale: [1.2, 1, 1.2],
        rotate: [0, -45, 0],
        x: ['10%', '-5%', '10%'],
        y: ['5%', '-5%', '5%'],
      }}
      transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
      className="app-background-orb absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-rose-300/25 blur-[90px] will-change-transform"
    />
    <div className="app-background-pattern absolute inset-0 opacity-[0.04] bg-[radial-gradient(circle_at_1px_1px,#475569_1px,transparent_0)] bg-[size:40px_40px]" />
  </div>
));

DynamicBackground.displayName = 'DynamicBackground';

export default DynamicBackground;
