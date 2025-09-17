import React from 'react';
import { GuardianTab } from '../types';

interface Tab {
  id: GuardianTab;
  name: string;
  icon: string;
  badge?: string | number;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: GuardianTab;
  onTabChange: (tab: GuardianTab) => void;
  className?: string;
}

export const TabBar: React.FC<TabBarProps> = ({ tabs, activeTab, onTabChange, className = '' }) => {
  return (
    <div className={`tab-bar ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab ${activeTab === tab.id ? 'active' : ''}`}
          aria-selected={activeTab === tab.id}
          onClick={() => onTabChange(tab.id)}
        >
          <span className={`icon-${tab.icon}`} />
          {tab.name}
          {tab.badge && <span className="badge" data-badge={tab.badge}>{tab.badge}</span>}
        </button>
      ))}
    </div>
  );
};