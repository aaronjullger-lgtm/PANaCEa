
import React from 'react';

interface LoaderProps {
  message?: string;
}

const Loader: React.FC<LoaderProps> = ({ message = 'Generating...' }) => {
  return (
    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 rounded-2xl">
      <div className="flex space-x-2">
        <div className="w-3 h-3 bg-[#3D1B0E] rounded-full animate-bounce-custom" style={{ animationDelay: '-0.3s' }}></div>
        <div className="w-3 h-3 bg-[#3D1B0E] rounded-full animate-bounce-custom" style={{ animationDelay: '-0.15s' }}></div>
        <div className="w-3 h-3 bg-[#3D1B0E] rounded-full animate-bounce-custom"></div>
      </div>
      <p className="mt-4 text-slate-600 font-semibold">{message}</p>
    </div>
  );
};

export default Loader;
