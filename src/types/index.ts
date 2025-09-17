export enum UserRole {
  GUEST = 'guest',
  MEMBER = 'member',
  VERIFIED = 'verified',
  ADMIN = 'admin'
}

export type GuardianTab = 'family' | 'volunteer' | 'apply';

export interface User {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  verificationStatus?: {
    isVerified: boolean;
    verifiedAt?: string;
    method?: 'mobile-id' | 'document';
  };
  notifications?: {
    volunteer?: number;
    family?: number;
  };
}

export interface Binding {
  id: string;
  name: string;
  relationship: string;
  idNumber: string;
  createdAt: string;
  status: 'active' | 'inactive';
  lastLocation?: {
    lat: number;
    lng: number;
    timestamp: string;
  };
  battery?: number;
  isOnline?: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  location: {
    address: string;
    lat: number;
    lng: number;
  };
  urgency: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'assigned' | 'in_progress' | 'completed';
  assignedTo?: string;
  createdAt: string;
  dueTime?: string;
  points: number;
}

export interface Application {
  id: string;
  userId: string;
  status: 'draft' | 'submitted' | 'reviewing' | 'approved' | 'rejected';
  submittedAt?: string;
  reviewedAt?: string;
  data?: {
    applicantName: string;
    applicantId: string;
    careReceiverName: string;
    careReceiverId: string;
    relationship: string;
    diagnosis?: string;
    documents?: Array<{
      type: string;
      url: string;
      uploadedAt: string;
    }>;
  };
  mydataConsent?: {
    granted: boolean;
    grantedAt?: string;
    scope?: string[];
  };
}

export interface NavigationItem {
  id: string;
  name: string;
  icon: string;
  path: string;
  visibility: UserRole[];
  badge?: string | number;
  subtitle?: string;
  requiresVerification?: boolean;
}

export interface Feature {
  id: string;
  name: string;
  icon: string;
  requires: UserRole;
  enabled?: boolean;
  onClick?: () => void;
}

export interface TabConfig {
  id: GuardianTab;
  name: string;
  icon: string;
  path: string;
  default?: boolean;
  badge?: string | number;
  features?: Feature[];
}

export interface EmptyStateConfig {
  icon: string;
  title: string;
  description: string;
  primaryAction?: {
    text: string;
    onClick: () => void;
  };
  secondaryAction?: {
    text: string;
    onClick: () => void;
  };
  steps?: string[];
  benefits?: string[];
  helperText?: string;
  infoCards?: Array<{
    title: string;
    items: string[];
  }>;
  processSteps?: Array<{
    number: number;
    title: string;
    time: string;
  }>;
  estimatedTime?: string;
  saveDraft?: {
    text: string;
  };
  downloadSection?: {
    title: string;
    files: Array<{
      name: string;
      format: string;
      size: string;
    }>;
  };
  statusTimeline?: Array<{
    date: string;
    time?: string;
    status: string;
    current: boolean;
  }>;
  notification?: {
    text: string;
    icon: string;
  };
  notificationStatus?: {
    enabled: boolean;
    text: string;
  };
  settingsHint?: string;
  onboardingSteps?: Array<{
    title: string;
    description: string;
    completed: boolean;
  }>;
}

export interface LoadingStateConfig {
  message?: string;
  type?: 'skeleton' | 'progress' | 'spinner';
  showItems?: number;
  animation?: 'pulse' | 'wave';
  stages?: Array<{
    text: string;
    progress: number;
  }>;
}