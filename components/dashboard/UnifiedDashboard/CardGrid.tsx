import React from 'react';

interface CardGridProps {
  children: React.ReactNode;
  className?: string;
}

const CardGrid: React.FC<CardGridProps> = ({ children, className }) => {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
      {children}
    </div>
  );
};

export default CardGrid;
