import React from 'react';
import { ContentGrid, ContentGridProps, ContentGridHeader } from './ContentGrid';

export const CardGrid: React.FC<ContentGridProps> = (props) => (
  <ContentGrid
    columns={{ default: 1, md: 2, lg: 3 }}
    gap={6}
    {...props}
  />
);

export { ContentGridHeader as CardGridHeader };
