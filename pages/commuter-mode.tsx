/**
 * CommuterModePage - Dedicated route for hands‑free voice‑driven practice
 *
 * Renders the CommuterMode component with appropriate layout and navigation.
 */

import React, { useEffect } from 'react';
import { CommuterMode } from '@/config/lazyComponents';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes';

const CommuterModePage: React.FC = () => {
  const navigate = useNavigate();
  useEffect(() => { document.title = 'Commuter Mode | PANaCEa'; }, []);

  const handleExit = () => {
    navigate(ROUTES.STUDY);
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <CommuterMode onExit={handleExit} />
    </div>
  );
};

export default CommuterModePage;