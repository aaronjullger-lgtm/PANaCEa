/**
 * Icon Barrel — centralized re-exports for consistent icon usage.
 *
 * Primary:  Lucide React (shadcn/ui default, 1500+ general icons)
 * Medical:  healthicons-react (400+ clinical/medical icons)
 *
 * Usage:
 *   import { Stethoscope, Heart, Activity } from '@/components/ui/icons';
 *   import { Syringe, Microscope } from '@/components/ui/icons';
 */

// ── Lucide: commonly used across PANaCEa ──
export {
  // Navigation & UI
  Search,
  Settings,
  Menu,
  X,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  MoreHorizontal,
  MoreVertical,
  Plus,
  Minus,
  Check,
  Copy,
  Filter,
  SlidersHorizontal,
  Command,
  // Clinical & Medical
  Stethoscope,
  Heart,
  HeartPulse,
  Brain,
  Pill,
  Activity,
  Thermometer,
  Syringe,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  // Data & Analytics
  BarChart3,
  LineChart,
  TrendingUp,
  TrendingDown,
  Target,
  Timer,
  Clock,
  Calendar,
  // Study & Learning
  BookOpen,
  GraduationCap,
  Lightbulb,
  Zap,
  Star,
  Trophy,
  Flame,
  // Status & Feedback
  CheckCircle2,
  XCircle,
  Info,
  Loader2,
  RefreshCw,
  Eye,
  EyeOff,
  // Navigation extended
  Home,
  LayoutDashboard,
  Sparkles,
  // Data extended
  Database,
  FlaskConical,
  Inbox,
  FileQuestion,
  // Dashboard-specific
  Award,
  Layers,
  FolderTree,
  Droplets,
  Beaker,
  Wind,
  Bone,
  Bug,
  // Type export for consumers
  type LucideIcon,
} from 'lucide-react';

// ── Health Icons: medical-specific icons ──
// These provide domain-specific visuals for clinical education UI.
// See https://healthicons.org for the full catalog.
export {
  BloodDrop,
  Microscope,
  Stethoscope as HealthStethoscope,
  Inpatient,
  Ambulance,
  Skull,
  Lungs,
  Kidneys,
  Liver,
  Stomach,
  CommunityHealthworker,
  BloodPressure,
  BloodCells,
} from 'healthicons-react/filled';
