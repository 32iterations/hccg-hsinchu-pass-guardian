import React from 'react';

interface InfoCardProps {
  title: string;
  icon: string;
  items: string[];
  className?: string;
}

export const InfoCard: React.FC<InfoCardProps> = ({
  title,
  icon,
  items,
  className = ''
}) => {
  return (
    <div className={`info-card ${className}`}>
      <div className="info-card-header">
        <span className={`info-card-icon icon-${icon}`} />
        <h3 className="info-card-title">{title}</h3>
      </div>

      <div className="info-card-content">
        <ul className="info-card-list">
          {items.map((item, index) => (
            <li key={index} className="info-card-item">
              <span className="item-bullet">•</span>
              <span className="item-text">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};