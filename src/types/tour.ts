export type Language = 'bn' | 'en';
export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export type MemberRole = 'admin' | 'member';

export interface Member {
  id: string;
  slug: string;
  name_en: string;
  name_bn: string;
  nickname_en: string;
  nickname_bn: string;
  role: MemberRole;
  avatar_url?: string | null;
  bio_en: string;
  bio_bn: string;
  badge_title_en: string;
  badge_title_bn: string;
  sort_order: number;
  is_active: boolean;
}

export interface ExplorePhoto {
  url: string;
  caption_bn: string;
  caption_en: string;
}

export interface ExploreDestination {
  id: 'panam-nagar' | 'boro-jomidar-bari' | 'museum-folk-art' | 'puran-dhaka-evening';
  order: number;
  numberLabel: string;
  name_en: string;
  name_bn: string;
  tagline_en: string;
  tagline_bn: string;
  description_en: string;
  description_bn: string;
  highlights_en: string[];
  highlights_bn: string[];
  media_mode: 'gallery' | 'youtube';
  photos: ExplorePhoto[];
  fallback_image_url: string;
  youtube_url: string;
  lat: number;
  lng: number;
  location_label_en: string;
  location_label_bn: string;
}

export interface TourSettings {
  id: number;
  website_name_bn: string;
  website_name_en: string;
  tagline_bn: string;
  tagline_en: string;
  tour_date: string;
  start_location_bn: string;
  start_location_en: string;
  destinations_bn: string;
  destinations_en: string;
  estimated_budget_per_person: number;
  target_contribution_per_person: number;
  budget_warning_threshold_pct: number;
  announcement_bn: string;
  announcement_en: string;
  require_group_passcode: boolean;
  ambient_sound_enabled: boolean;
  hero_video_url: string;
  hero_fallback_image_url: string;
  explore_destinations?: ExploreDestination[];
  updated_at: string;
}

export type ExpenseCategory =
  | 'Transport'
  | 'Food'
  | 'Tickets'
  | 'Shopping'
  | 'Accommodation'
  | 'Miscellaneous'
  | 'Other';

export type FundingSource = 'group_cash' | 'personal_payer';
export type AllocationMode = 'equal' | 'custom';

export interface Contribution {
  id: string;
  member_id: string;
  amount: number;
  payment_method: 'Cash' | 'Adjustment';
  contributed_at: string;
  notes: string;
  reference_code: string;
  is_correction: boolean;
  corrects_id?: string | null;
  created_by: string;
  created_at: string;
}

export interface ExpenseAllocation {
  id?: string;
  expense_id?: string;
  member_id: string;
  allocated_amount: number;
  note?: string;
}

export interface ExpenseItem {
  id?: string;
  expense_id?: string;
  member_id?: string | null;
  item_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface ExpenseEditHistory {
  id: string;
  expense_id: string;
  edited_by: string;
  reason: string;
  previous_snapshot: Record<string, unknown>;
  new_snapshot: Record<string, unknown>;
  created_at: string;
}

export interface Expense {
  id: string;
  title: string;
  category: ExpenseCategory;
  expense_at: string;
  total_amount: number;
  description: string;
  payer_member_id?: string | null;
  funding_source: FundingSource;
  allocation_mode: AllocationMode;
  receipt_url?: string | null;
  is_reimbursed: boolean;
  is_correction: boolean;
  corrects_expense_id?: string | null;
  voided_by_correction: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  allocations: ExpenseAllocation[];
  items: ExpenseItem[];
  edit_history?: ExpenseEditHistory[];
}

export type SegmentType = 'departure' | 'transit' | 'destination' | 'food' | 'return';

export interface ItineraryItem {
  id: string;
  sort_order: number;
  time_label: string;
  duration_label: string;
  title_bn: string;
  title_en: string;
  location_bn: string;
  location_en: string;
  activity_bn: string;
  activity_en: string;
  transport_bn: string;
  transport_en: string;
  estimated_cost: number;
  notes_bn: string;
  notes_en: string;
  image_url: string;
  lat: number | null;
  lng: number | null;
  segment_type: SegmentType;
}

export interface ChecklistItem {
  id: string;
  scope: 'group' | 'personal';
  title_bn: string;
  title_en: string;
  responsible_member_id?: string | null;
  owner_member_id?: string | null;
  is_completed: boolean;
  due_label: string;
  completed_at?: string | null;
  created_by?: string | null;
}

export interface PollOption {
  id: string;
  poll_id: string;
  label_bn: string;
  label_en: string;
  sort_order: number;
}

export interface Vote {
  id: string;
  poll_id: string;
  option_id: string;
  member_id: string;
  created_at: string;
}

export interface Poll {
  id: string;
  question_bn: string;
  question_en: string;
  description_bn: string;
  description_en: string;
  deadline?: string | null;
  is_closed: boolean;
  allow_multiple: boolean;
  created_by: string;
  created_at: string;
  options: PollOption[];
  votes: Vote[];
}

export interface SharedNote {
  id: string;
  author_id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface TourPhoto {
  id: string;
  uploaded_by: string;
  storage_path: string;
  public_url: string;
  caption: string;
  tags: string[];
  taken_at: string;
  created_at: string;
}

export interface TourProgress {
  id: number;
  current_stage_index: number;
  current_stage_bn: string;
  current_stage_en: string;
  current_location_bn: string;
  current_location_en: string;
  current_activity_bn: string;
  current_activity_en: string;
  next_destination_bn: string;
  next_destination_en: string;
  updated_by?: string | null;
  updated_at: string;
}

export interface Badge {
  id: string;
  member_id: string;
  code: string;
  title_bn: string;
  title_en: string;
  description_bn: string;
  description_en: string;
  icon: string;
  awarded_at: string;
}

export interface FunEvent {
  id: string;
  event_type: 'snack_picker' | 'challenge';
  selected_member_id: string;
  prompt_bn: string;
  prompt_en: string;
  completed: boolean;
  created_by: string;
  created_at: string;
}

export interface ActivityLogEntry {
  id: string;
  actor_member_id?: string | null;
  action_type: string;
  entity_type: string;
  entity_id?: string | null;
  summary_bn: string;
  summary_en: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SessionInfo {
  token: string;
  member: Member;
  isAdmin: boolean;
  expiresAt: string;
}

export interface GateStatus {
  website_name_bn: string;
  website_name_en: string;
  tagline_bn: string;
  tagline_en: string;
  require_group_passcode: boolean;
}

export type MoneyNotificationKind =
  | 'expense_created'
  | 'expense_updated'
  | 'expense_voided'
  | 'expense_reimbursed'
  | 'contribution_added'
  | 'contribution_refund';

export type RealtimeConnectionStatus = 'connected' | 'connecting' | 'reconnecting' | 'offline';

export interface RealtimeMoneySignal {
  eventKey: string;
  kind: MoneyNotificationKind | 'tour_sync' | 'reconnect_sync';
  entityId?: string;
  actorMemberId?: string | null;
  occurredAt: string;
}

export interface MoneyNotification {
  eventKey: string;
  id: string;
  kind: MoneyNotificationKind;
  emoji: string;
  title_bn: string;
  title_en: string;
  message_bn: string;
  actorMemberId?: string | null;
  actorNameBn: string;
  actorNameEn: string;
  affectedMemberIds: string[];
  affectedLabelBn: string;
  affectedLabelEn: string;
  amount: number;
  category?: ExpenseCategory;
  fundingSource?: FundingSource;
  relevantBalanceLabelBn: string;
  relevantBalanceLabelEn: string;
  remainingGroupCash: number;
  viewerBalance?: number | null;
  createdAt: string;
  read: boolean;
  dismissed: boolean;
}

export type PushSupportStatus =
  | 'supported'
  | 'ios_install_required'
  | 'unsupported'
  | 'insecure_context'
  | 'not_configured';

export interface PushDeviceSummary {
  id: string;
  device_label: string;
  enabled: boolean;
  endpoint_hint: string;
  updated_at: string;
}

export interface PushStatusSummary {
  push_enabled: boolean;
  device_count: number;
  devices: PushDeviceSummary[];
}
