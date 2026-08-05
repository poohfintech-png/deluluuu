export type UserRole = 'admin' | 'reader' | 'writer'

export interface Profile {
  id: string
  email: string
  display_name: string
  avatar_url: string | null
  bio: string | null
  role: UserRole
  created_at: string
  username: string | null
  coins: number
  is_suspended: boolean
  password_changed_at: string | null
}

export type BookStatus = 'draft' | 'published'

export interface Book {
  id: string
  title: string
  description: string
  cover_url: string | null
  tags: string[]
  status: BookStatus
  author_id: string | null
  created_at: string
  updated_at: string
  genre: string | null
  genre_id: string | null
  view_count: number
  like_count: number
  favorite_count: number
  is_featured: boolean
  is_trending: boolean
  deleted_at: string | null
  deleted_by: string | null
  author?: Profile | null
  chapter_count?: number
  genre_data?: Genre | null
  is_liked?: boolean
}

export type ChapterStatus = 'draft' | 'published'

export interface Chapter {
  id: string
  book_id: string
  title: string
  content: TipTapDoc | string | null
  audio_url: string | null
  video_url: string | null
  is_free: boolean
  status: ChapterStatus
  order_index: number
  created_at: string
  updated_at: string
  banner_url: string | null
}

export interface TipTapDoc {
  type: 'doc'
  content: TipTapNode[]
}

export interface TipTapNode {
  type: string
  attrs?: Record<string, unknown>
  content?: TipTapNode[]
  marks?: { type: string; attrs?: Record<string, unknown> }[]
  text?: string
}

export type BlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'quote'
  | 'divider'
  | 'image'
  | 'audio'
  | 'video'

export interface TextBlock {
  type: 'paragraph' | 'heading1' | 'heading2' | 'heading3' | 'quote'
  text: string
}

export interface DividerBlock {
  type: 'divider'
}

export interface ImageBlock {
  type: 'image'
  url: string
  caption?: string
}

export interface AudioBlock {
  type: 'audio'
  url: string
  title?: string
}

export interface VideoBlock {
  type: 'video'
  url: string
  title?: string
}

export type Block = TextBlock | DividerBlock | ImageBlock | AudioBlock | VideoBlock

export type SubscriptionPlanName = 'monthly' | 'yearly'

export interface SubscriptionPlan {
  id: string
  name: SubscriptionPlanName
  price_inr: number
  duration_days: number
  is_active: boolean
}

export type SubscriptionStatus = 'pending' | 'active' | 'rejected' | 'expired'

export interface Subscription {
  id: string
  user_id: string
  plan_id: string
  status: SubscriptionStatus
  payment_screenshot_url: string | null
  upi_ref_id: string | null
  start_date: string | null
  end_date: string | null
  approved_by: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
  plan?: SubscriptionPlan
  user?: Profile
}

export interface LibraryEntry {
  id: string
  user_id: string
  book_id: string
  created_at: string
  book?: Book
}

export interface Follow {
  id: string
  follower_id: string
  following_id: string
  created_at: string
}

export interface ChapterLike {
  id: string
  user_id: string
  chapter_id: string
  created_at: string
}

export interface Comment {
  id: string
  chapter_id: string
  user_id: string
  content: string
  created_at: string
  user?: Profile
}

export interface ReadingHistoryEntry {
  id: string
  user_id: string
  chapter_id: string
  book_id: string
  progress: number
  last_read_at: string
  chapter?: Chapter
  book?: Book
}

export interface ListeningHistoryEntry {
  id: string
  user_id: string
  chapter_id: string
  book_id: string
  progress: number
  last_listened_at: string
  chapter?: Chapter
  book?: Book
}

export interface Genre {
  id: string
  name: string
  slug: string | null
  description: string | null
  icon: string | null
  sort_order: number
  created_at: string
  deleted_at: string | null
  deleted_by: string | null
}

export type ReelStatus = 'draft' | 'published'

export interface Reel {
  id: string
  related_book_id: string | null
  is_independent_drama: boolean
  title: string
  description: string | null
  episode_number: number
  bunny_video_url: string
  thumbnail_url: string | null
  duration: string | null
  genre_id: string | null
  is_premium: boolean
  coin_unlock_price: number
  status: ReelStatus
  view_count: number
  created_by: string | null
  created_at: string
  updated_at: string
  drama_series_id: string | null
  book?: Book | null
  genre_data?: Genre | null
  is_unlocked?: boolean
}

export type WriterApplicationStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested'

export interface WriterApplication {
  id: string
  user_id: string
  name: string
  username: string
  email: string
  about: string | null
  writing_experience: string | null
  genres: string[]
  previous_work_links: string[]
  sample_writing_url: string | null
  profile_picture_url: string | null
  status: WriterApplicationStatus
  review_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
  user?: Profile | null
}

export type CoinTransactionType = 'purchase' | 'spend' | 'admin_grant' | 'admin_deduct'

export interface CoinTransaction {
  id: string
  user_id: string
  amount: number
  type: CoinTransactionType
  description: string | null
  reel_id: string | null
  created_at: string
}

export interface UnlockedContent {
  id: string
  user_id: string
  reel_id: string
  coins_spent: number
  unlocked_at: string
}

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'system' | 'payment' | 'content'

export interface Notification {
  id: string
  user_id: string | null
  type: NotificationType
  title: string
  body: string | null
  link: string | null
  is_read: boolean
  created_at: string
  read_at: string | null
  action_url: string | null
  data: Record<string, unknown> | null
}

export type FeaturedSection = 'featured' | 'trending' | 'popular' | 'new_releases' | 'recommended'

export interface FeaturedBook {
  id: string
  book_id: string
  section: FeaturedSection
  position: number
  created_at: string
  book?: Book
}

export type FeaturedReelSection = 'featured' | 'trending' | 'popular' | 'new_reels'

export interface FeaturedReel {
  id: string
  reel_id: string
  section: FeaturedReelSection
  position: number
  created_at: string
  reel?: Reel
}

export type DramaSeriesStatus = 'draft' | 'published'

export interface DramaSeries {
  id: string
  title: string
  description: string
  poster_url: string | null
  genre_id: string | null
  related_book_id: string | null
  is_independent: boolean
  status: DramaSeriesStatus
  created_by: string | null
  created_at: string
  updated_at: string
  genre_data?: Genre | null
  book?: Book | null
  episodes?: Reel[]
  episode_count?: number
}

export interface FeaturedDrama {
  id: string
  drama_id: string
  section: FeaturedReelSection
  position: number
  created_at: string
  drama?: DramaSeries
}

export type FeatureFlagStatus = 'disabled' | 'coming_soon' | 'enabled'

export interface FeatureFlag {
  id: string
  feature_key: string
  feature_name: string
  description: string
  status: FeatureFlagStatus
  created_at: string
  updated_at: string
  updated_by: string | null
}

export type DependencyType = 'requires' | 'optional' | 'dependent'

export interface FeatureDependency {
  id: string
  feature_key: string
  required_feature_key: string
  dependency_type: DependencyType
  created_at: string
}

export type PaymentMode = 'disabled' | 'manual_payment' | 'gateway_payment' | 'both'

// ============================================================
// MEMBERSHIP SYSTEM TYPES
// ============================================================

export type MembershipPlanStatus = 'active' | 'disabled' | 'archived'
export type EntitlementKey = 'premium_books' | 'premium_audiobooks' | 'premium_reels' | 'premium_drama' | 'future_content' | 'all_access'

export type BillingType = 'one_time' | 'recurring'
export type DurationType = 'monthly' | 'yearly' | 'lifetime' | 'custom'

export interface MembershipPlan {
  id: string
  name: string
  description: string | null
  short_description: string | null
  long_description: string | null
  price_inr: number
  price_intl: number | null
  currency: string
  intl_currency: string
  duration_days: number
  duration_type: DurationType
  billing_type: BillingType
  benefits: string[]
  display_order: number
  status: MembershipPlanStatus
  is_visible: boolean
  is_popular: boolean
  is_recommended: boolean
  badge: string | null
  accent_color: string
  plan_version: number
  created_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type PaymentRequestStatus = 'pending' | 'submitted' | 'under_review' | 'approved' | 'rejected' | 'expired' | 'cancelled'
export type BillingRegion = 'india' | 'international'
export type PaymentMethod = 'upi' | 'paypal' | 'gateway' | 'other'

export interface PlanSnapshot {
  name: string
  description: string | null
  price_inr: number
  price_intl: number | null
  duration_days: number
  benefits: string[]
  plan_version: number
}

export interface PaymentSettingsSnapshot {
  upi_id?: string
  upi_qr_url?: string
  business_name?: string
  paypal_email?: string
  paypal_me_link?: string
  paypal_qr_url?: string
  payment_instructions?: string
  support_email?: string
  [key: string]: string | undefined
}

export interface PaymentRequest {
  id: string
  order_ref: string
  user_id: string
  plan_id: string
  plan_version: number
  plan_snapshot: PlanSnapshot
  amount: number
  currency: string
  billing_region: BillingRegion
  country: string | null
  payment_method: PaymentMethod
  transaction_id: string | null
  screenshot_url: string | null
  payment_settings_snapshot: PaymentSettingsSnapshot | null
  status: PaymentRequestStatus
  rejection_reason: string | null
  admin_notes: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  expires_at: string
  created_at: string
  updated_at: string
  submitted_at: string | null
  plan?: MembershipPlan
  user?: Profile
}

export type MembershipStatus = 'active' | 'expired' | 'cancelled'

export interface UserMembership {
  id: string
  user_id: string
  plan_id: string
  plan_snapshot: PlanSnapshot
  payment_request_id: string | null
  entitlements: string[]
  start_date: string
  end_date: string
  status: MembershipStatus
  created_at: string
  updated_at: string
  plan?: MembershipPlan
}

export interface PaymentSetting {
  id: string
  setting_key: string
  setting_value: string | null
  setting_group: 'upi' | 'paypal' | 'general' | 'currency'
  updated_by: string | null
  updated_at: string
}

export interface AdminActivityLog {
  id: string
  admin_id: string
  action: string
  entity_type: string | null
  entity_id: string | null
  details: Record<string, unknown> | null
  created_at: string
  admin?: Profile
}

export interface AdminLoginHistory {
  id: string
  user_id: string | null
  email: string | null
  user_agent: string | null
  ip_address: string | null
  success: boolean
  created_at: string
  user?: Profile
}

// ============================================================
// PERMISSION TYPES
// ============================================================

export type Permission =
  | 'canManageUsers'
  | 'canManageBooks'
  | 'canApprovePayments'
  | 'canViewAnalytics'
  | 'canManageFeatureFlags'
  | 'canManagePlatform'
  | 'canManageReels'
  | 'canManageAudiobooks'
  | 'canSuspendUsers'
  | 'canDeleteBooks'
  | 'canRestoreBooks'
  | 'canManagePlans'
  | 'canManagePaymentSettings'
  | 'canViewSecurity'
  | 'canManageGenres'
  | 'canManageHomepage'
  | 'canManageComments'

export type LibraryContentType = 'book' | 'audiobook' | 'drama'
export type LibraryItemStatus = 'saved' | 'completed' | 'in_progress'

export interface UserLibraryItem {
  id: string
  user_id: string
  content_type: LibraryContentType
  content_id: string
  status: LibraryItemStatus
  created_at: string
  updated_at: string
  book?: Book | null
  reel?: Reel | null
  drama?: DramaSeries | null
}

export type ViewingContentType = 'drama' | 'audiobook'

export interface ViewingHistoryEntry {
  id: string
  user_id: string
  content_type: ViewingContentType
  content_id: string
  episode_id: string | null
  progress: number
  last_watched_at: string
  created_at: string
  reel?: Reel | null
  drama?: DramaSeries | null
}
