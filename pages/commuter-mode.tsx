/**
 * CommuterModePage - Dedicated route for hands‑free voice‑driven practice
 *
 * Renders the CommuterMode component with appropriate layout and navigation.
 */

import React from 'react';
import { CommuterMode } from '@/config/lazyComponents';
import { useNavigate } from 'react-router-dom';

const CommuterModePage: React.FC = () => {
  const navigate = useNavigate();

  const handleExit = () => {
    navigate('/command-center');
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <CommuterMode onExit={handleExit} />
    </div>
  );
};

export default CommuterModePage;