export interface Client {
  id: string;
  clientId: string;
  clientName: string;
  name?: string;
  jobIds: string[];
  contactEmail?: string;
  contactPhone?: string;
  notes?: string;
  createdAt: string;
}

export type FoundationType = 'slab' | 'frost_wall' | 'none';
export type StructureType = 'steel_building' | 'container_cover' | 'canopy' | 'other';

export type DocumentType = 'rfq' | 'dealer_rfq' | 'internal_quote' | 'external_quote';
export type WorkflowStatus =
  | 'draft'
  | 'submitted'
  | 'estimate_needed'
  | 'estimating'
  | 'estimate_complete'
  | 'internal_quote_in_progress'
  | 'internal_quote_ready'
  | 'external_quote_ready'
  | 'quote_sent'
  | 'won'
  | 'lost'
  | 'converted_to_deal'
  | 'cancelled';

export interface Quote {
  id: string;
  date: string;
  jobId: string;
  jobName: string;
  clientName: string;
  clientId: string;
  salesRep: string;
  estimator: string;
  province: string;
  city: string;
  address: string;
  postalCode: string;
  width: number;
  length: number;
  height: number;
  leftEaveHeight?: number;
  rightEaveHeight?: number;
  isSingleSlope?: boolean;
  pitch?: number;
  sqft: number;
  weight: number;
  baseSteelCost: number;
  steelAfter12: number;
  markup: number;
  adjustedSteel: number;
  engineering: number;
  foundation: number;
  foundationType: FoundationType;
  gutters: number;
  liners: number;
  insulation: number;
  insulationGrade: string;
  freight: number;
  combinedTotal: number;
  perSqft: number;
  perLb: number;
  contingencyPct: number;
  contingency: number;
  gstHst: number;
  qst: number;
  grandTotal: number;
  status: QuoteStatus;
  documentType: DocumentType;
  workflowStatus: WorkflowStatus;
  sourceDocumentId?: string | null;
  opportunityId?: string | null;
  assignedEstimatorUserId?: string | null;
  assignedOperationsUserId?: string | null;
  pdfStoragePath?: string;
  pdfFileName?: string;
  payload?: Record<string, unknown>;
  createdByUserId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  isDeleted?: boolean;
}

export type QuoteStatus = 'Draft' | 'Sent' | 'Follow Up' | 'Won' | 'Lost' | 'Expired';

export type DealStatus = 'Lead' | 'Quoted' | 'Pending Payment' | 'In Progress' | 'In Production' | 'Shipped' | 'Delivered' | 'Complete' | 'Cancelled' | 'On Hold';
export type PaymentStatus = 'PAID' | 'PARTIAL' | 'UNPAID';
export type FreightStatus = 'Pending' | 'RFQ' | 'Quoted' | 'Booked' | 'In Transit' | 'Delivered';
export type ProductionStage = 'Submitted' | 'Acknowledged' | 'In Production' | 'QC Complete' | 'Ship Ready' | 'Shipped' | 'Delivered';
export type DrawingStatus = 'not_requested' | 'requested' | 'received' | 'signed' | 'not_required';

export interface Deal {
  jobId: string;
  jobName: string;
  clientName: string;
  clientId: string;
  salesRep: string;
  estimator: string;
  teamLead: string;
  province: string;
  city: string;
  address: string;
  postalCode: string;
  width: number;
  length: number;
  height: number;
  leftEaveHeight?: number;
  rightEaveHeight?: number;
  isSingleSlope?: boolean;
  sqft: number;
  weight: number;
  taxRate: number;
  taxType: string;
  orderType: string;
  dateSigned: string;
  dealStatus: DealStatus;
  paymentStatus: PaymentStatus;
  productionStatus: ProductionStage;
  freightStatus: FreightStatus;
  insulationStatus: string;
  engineeringDrawingsStatus?: DrawingStatus;
  foundationDrawingsStatus?: DrawingStatus;
  opportunityId?: string | null;
  cxPaymentStageOverride?: string;
  factoryPaymentStageOverride?: string;
  deliveryDate: string;
  pickupDate: string;
  notes: string;
}

export interface InternalCost {
  jobId: string;
  trueMaterial: number;
  trueStructuralDrawing: number;
  trueFoundationDrawing: number;
  trueFreight: number;
  trueInsulation: number;
  repMaterial: number;
  repStructuralDrawing: number;
  repFoundationDrawing: number;
  repFreight: number;
  repInsulation: number;
  salePrice: number;
  showRepCosts: boolean;
}

export type PaymentDirection =
  | 'Client Payment IN'
  | 'Vendor Payment OUT'
  | 'Refund IN'
  | 'Refund OUT'
  | 'Commission Payment OUT'
  | 'Expense OUT';
export type PaymentType =
  | 'Deposit'
  | 'Progress Payment'
  | 'Final Payment'
  | 'Freight'
  | 'Insulation'
  | 'Drawings'
  | 'Commission'
  | 'Expense'
  | 'Other';
export type PaymentPartyType = 'client' | 'vendor' | 'commission' | 'general_expense';
export type CommissionRecipientType = 'sales_rep' | 'estimator' | 'operations' | 'team_lead' | 'marketing' | 'owner';
export type RecurrenceFrequency = 'monthly' | 'quarterly' | 'annual';
export type CommissionBasis = 'true_gp' | 'rep_gp' | 'auto';
export type CommissionScheduleRule = 'rep_schedule' | 'stage_2' | 'manual';

export interface Vendor {
  id: string;
  name: string;
  province: string;
  contactEmail: string;
  contactPhone: string;
  notes: string;
  createdAt: string;
}

export interface PaymentEntry {
  id: string;
  date: string;
  jobId?: string | null;
  clientVendorName: string;
  clientId?: string;
  vendorId?: string;
  direction: PaymentDirection;
  type: PaymentType;
  partyType?: PaymentPartyType;
  commissionRecipientType?: CommissionRecipientType | null;
  linkedUserId?: string | null;
  amountExclTax: number;
  province: string;
  taxRate: number;
  taxAmount: number;
  totalInclTax: number;
  taxOverride: boolean;
  taxOverrideRate?: number;
  vendorProvinceOverride?: string;
  recurrenceFrequency?: RecurrenceFrequency | null;
  recurrenceStartDate?: string | null;
  recurrenceEndDate?: string | null;
  includeInProjection?: boolean;
  paymentMethod: string;
  referenceNumber: string;
  qbSynced: boolean;
  notes: string;
}

export type CommissionRecipientRole = CommissionRecipientType;
export type CommissionPayoutStage =
  | 'rep_stage_1'
  | 'rep_stage_2'
  | 'rep_stage_3'
  | 'stage_2'
  | 'manual';

export interface CommissionPayout {
  id: string;
  jobId?: string | null;
  recipientRole: CommissionRecipientRole;
  recipientName: string;
  payoutStage: CommissionPayoutStage;
  amount: number;
  linkedUserId?: string | null;
  basisUsed?: CommissionBasis | null;
  scheduleRule?: CommissionScheduleRule | null;
  paymentLedgerId?: string | null;
  eligibleOnDate?: string | null;
  paidOn: string;
  paymentMethod: string;
  referenceNumber: string;
  notes: string;
  confirmedByUserId?: string | null;
  confirmedByName?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductionRecord {
  jobId: string;
  submitted: boolean;
  acknowledged: boolean;
  inProduction: boolean;
  qcComplete: boolean;
  shipReady: boolean;
  shipped: boolean;
  delivered: boolean;
  drawingsStatus: string;
  insulationStatus: string;
  engineeringDrawingsStatus?: DrawingStatus;
  foundationDrawingsStatus?: DrawingStatus;
}

export interface FreightRecord {
  jobId: string;
  clientName: string;
  buildingSize: string;
  opportunityId?: string | null;
  province?: string;
  weight: number;
  pickupAddress: string;
  deliveryAddress: string;
  dropOffLocation?: string;
  pickupDate?: string;
  deliveryDate?: string;
  estimatedPickupDate?: string;
  estimatedDeliveryDate?: string;
  actualPickupDate?: string;
  actualDeliveryDate?: string;
  mode?: 'pre_sale' | 'execution';
  estDistance: number;
  estFreight: number;
  actualFreight: number;
  paid: boolean;
  carrier: string;
  moffettIncluded?: boolean;
  assignedFreightUserId?: string | null;
  status: FreightStatus;
}

export interface Estimate {
  id: string;
  label: string;
  date: string;
  jobId?: string | null;
  clientName: string;
  clientId: string;
  salesRep: string;
  width: number;
  length: number;
  height: number;
  pitch: number;
  province: string;
  city: string;
  postalCode: string;
  grandTotal: number;
  sqft: number;
  estimatedTotal: number;
  notes: string;
  auditNotes: string[];
  payload: Record<string, unknown>;
  createdByUserId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type RFQStatus = 'Draft' | 'Sent' | 'Quoted' | 'Accepted' | 'Declined' | 'Expired';

export interface RFQ {
  id: string;
  jobId: string;
  clientName: string;
  buildingSize: string;
  weight: number;
  pickupAddress: string;
  deliveryAddress: string;
  carriers: string[];
  quotedPrices: Record<string, number>; // carrier → price
  selectedCarrier: string;
  selectedPrice: number;
  status: RFQStatus;
  sentDate: string;
  responseDate: string;
  notes: string;
  createdAt: string;
}

// --- Manufacturer RFQ / Bidding ---
export type ManufacturerRFQStatus = 'Open' | 'Closed' | 'Awarded' | 'Cancelled';
export type ManufacturerBidStatus = 'Submitted' | 'Under Review' | 'Accepted' | 'Rejected' | 'Withdrawn';

export interface ManufacturerRFQ {
  id: string;
  jobId: string;
  title: string;
  buildingSpec: string;
  width: number;
  length: number;
  height: number;
  weight: number;
  province: string;
  city: string;
  deliveryAddress: string;
  requiredByDate: string;
  notes: string;
  status: ManufacturerRFQStatus;
  createdBy: string;
  createdAt: string;
  closingDate: string;
  awardedBidId: string;
}

export interface ManufacturerBid {
  id: string;
  rfqId: string;
  manufacturerId: string;
  manufacturerName: string;
  pricePerLb: number;
  totalPrice: number;
  leadTimeDays: number;
  notes: string;
  status: ManufacturerBidStatus;
  submittedAt: string;
}

export type ConstructionRFQScope = 'install' | 'install_plus_concrete';
export type ConstructionRFQStatus = 'Open' | 'Closed' | 'Awarded' | 'Cancelled';
export type ConstructionBidScope = 'install_only' | 'concrete_only' | 'both';
export type ConstructionBidStatus = 'Submitted' | 'Under Review' | 'Accepted' | 'Rejected' | 'Withdrawn';

export interface ConstructionRFQ {
  id: string;
  jobId: string;
  title: string;
  scope: ConstructionRFQScope;
  buildingDetails: string;
  jobName: string;
  province: string;
  city: string;
  postalCode: string;
  address: string;
  width: number;
  length: number;
  height: number;
  notes: string;
  requiredByDate: string;
  closingDate: string;
  status: ConstructionRFQStatus;
  createdByUserId?: string | null;
  createdAt?: string;
  awardedBidId?: string | null;
}

export interface ConstructionBid {
  id: string;
  rfqId: string;
  vendorId: string;
  vendorName: string;
  bidScope: ConstructionBidScope;
  installAmount: number;
  concreteAmount: number;
  totalAmount: number;
  notes: string;
  status: ConstructionBidStatus;
  submittedAt?: string;
}

// --- Import Review ---
export type ImportReviewStatus = 'pending' | 'approved' | 'needs_review' | 'corrected' | 'rejected';

export interface QuoteFileRecord {
  id: string;
  documentId?: string | null;
  storedDocumentId?: string | null;
  jobId: string;
  clientName: string;
  clientId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  fileCategory?: 'generated_pdf' | 'cost_file' | 'support_file';
  storagePath: string;
  buildingLabel: string;
  extractionSource: string;
  aiOutput: Record<string, unknown> | null;
  reviewStatus: ImportReviewStatus;
  parseError: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  correctedData: Record<string, unknown> | null;
  duplicateGroupKey?: string | null;
  isPrimaryDocument?: boolean;
  gdriveStatus: string;
  gdriveFileId: string | null;
  uploadedBy: string | null;
  createdAt: string;
}

export interface UserProfileSettings {
  userId: string;
  phone: string;
  address: string;
  emailNotifications: boolean;
  smsNotifications: boolean;
  canViewAllFreightBoard: boolean;
  canUseMessaging: boolean;
  lastSeenAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type SharedJobState = 'estimate' | 'rfq' | 'internal_quote' | 'external_quote' | 'deal';

export interface SharedJobRecord {
  jobId: string;
  clientName: string;
  jobName: string;
  state: SharedJobState;
  salesRep?: string;
  salesRepUserId?: string | null;
  estimator?: string;
  assignedEstimatorUserId?: string | null;
  assignedFreightUserId?: string | null;
  dealerUserId?: string | null;
  vendorUserIds: string[];
  sourceDocumentType?: DocumentType | 'deal';
  sourceDocumentId?: string | null;
}

export interface JobProfile {
  jobId: string;
  jobName: string;
  clientId: string;
  clientName: string;
  salesRep: string;
  estimator: string;
  teamLead: string;
  province: string;
  city: string;
  address: string;
  postalCode: string;
  width: number;
  length: number;
  height: number;
  leftEaveHeight?: number;
  rightEaveHeight?: number;
  isSingleSlope?: boolean;
  pitch?: number;
  structureType?: StructureType | null;
  lastSource?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CommissionRecipientSetting {
  id: string;
  recipientType: CommissionRecipientType;
  recipientName: string;
  linkedUserId?: string | null;
  basisOverride: CommissionBasis;
  scheduleRule: CommissionScheduleRule;
  createdAt?: string;
  updatedAt?: string;
}

export interface TeamLeadOverrideTeam {
  id: string;
  leadName: string;
  memberNames: string[];
}

export type MessagingConversationKind = 'direct' | 'group' | 'team' | 'deal';
export type MessagingMembershipSource = 'manual' | 'direct' | 'auto_team' | 'auto_deal';
export type TeamConversationKey = 'leadership' | 'sales' | 'operations' | 'estimating' | 'accounting' | 'freight';

export interface MessagingDirectoryUser {
  id: string;
  email: string;
  displayName: string;
  roles: string[];
  canUseMessaging: boolean;
  lastSeenAt?: string | null;
}

export interface MessagingConversationMember {
  conversationId: string;
  userId: string;
  joinedAt: string;
  lastReadAt?: string | null;
  isAdmin: boolean;
  notificationsMuted: boolean;
  membershipSource: MessagingMembershipSource;
}

export interface MessagingMessage {
  id: string;
  conversationId: string;
  senderUserId: string;
  body: string;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
}

export interface MessagingConversation {
  id: string;
  kind: MessagingConversationKind;
  title: string;
  jobId?: string | null;
  teamKey?: TeamConversationKey | null;
  directKey?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string | null;
  members: MessagingConversationMember[];
  latestMessage?: MessagingMessage | null;
  unreadCount: number;
}

export interface PresenceState {
  userId: string;
  isOnline: boolean;
  lastSeenAt?: string | null;
}

export interface SteelCostEntry {
  id: string;
  quoteFileId: string | null;
  jobId: string;
  clientName: string;
  clientId: string;
  buildingLabel: string;
  documentType: string;
  fileName: string;
  weightLbs: number;
  costPerLb: number;
  totalCost: number;
  width: number | null;
  length: number | null;
  height: number | null;
  roofPitch: number | null;
  province: string | null;
  city: string | null;
  components: { name: string; weight?: number; cost: number }[] | null;
  insulationTotal: number;
  insulationGrade: string | null;
  extractionSource: string;
  aiRawOutput: Record<string, unknown> | null;
  uploadedBy: string | null;
  createdAt: string;
}

export type CostDocumentReviewStatus =
  | 'pending'
  | 'needs_review'
  | 'approved'
  | 'corrected'
  | 'rejected'
  | 'unparsed';

export interface StoredDocument {
  id: string;
  quoteFileId?: string | null;
  documentId?: string | null;
  jobId?: string | null;
  projectId?: string | null;
  clientId?: string | null;
  vendorId?: string | null;
  structureType?: StructureType | null;
  sourceType: 'uploaded' | 'seed_json' | 'seed_csv' | 'seed_xlsx' | 'seed_zip' | 'legacy_backfill';
  sourceFilename?: string | null;
  sourceFileExtension?: string | null;
  fileName: string;
  fileSize?: number | null;
  fileType: string;
  storagePath: string;
  extractedDocumentType?: string | null;
  parserName?: string | null;
  parserVersion?: string | null;
  parseError?: string | null;
  reviewStatus: CostDocumentReviewStatus;
  parsedData?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  duplicateGroupKey?: string | null;
  isPrimaryDocument?: boolean;
  parsedSuccessfully?: boolean | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  uploadedBy?: string | null;
  uploadedAt?: string | null;
  createdAt?: string;
}

export interface SteelCostDataRecord {
  id: string;
  storedDocumentId?: string | null;
  quoteFileId?: string | null;
  documentId?: string | null;
  jobId?: string | null;
  projectId?: string | null;
  clientId?: string | null;
  vendorId?: string | null;
  structureType?: StructureType | null;
  widthFt?: number | null;
  lengthFt?: number | null;
  eaveHeightFt?: number | null;
  roofSlope?: number | null;
  floorAreaSqft?: number | null;
  totalWeightLb?: number | null;
  totalCost?: number | null;
  costPerSqft?: number | null;
  weightPerSqft?: number | null;
  pricePerLb?: number | null;
  snowLoadPsf?: number | null;
  windLoadPsf?: number | null;
  windCode?: string | null;
  province?: string | null;
  city?: string | null;
  seismicCat?: string | null;
  dataSource?: string | null;
  sourceType?: string | null;
  sourceFileName?: string | null;
  sourceFilePath?: string | null;
  reviewStatus?: CostDocumentReviewStatus;
  parserVersion?: string | null;
  rawExtraction?: Record<string, unknown> | null;
  components?: Record<string, unknown>[] | null;
  addedBy?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  dateAdded?: string | null;
  createdAt?: string;
}

export interface InsulationCostDataRecord {
  id: string;
  storedDocumentId?: string | null;
  quoteFileId?: string | null;
  documentId?: string | null;
  jobId?: string | null;
  projectId?: string | null;
  clientId?: string | null;
  vendorId?: string | null;
  structureType?: StructureType | null;
  widthFt?: number | null;
  lengthFt?: number | null;
  eaveHeightFt?: number | null;
  roofSlope?: number | null;
  floorAreaSqft?: number | null;
  location?: string | null;
  roofRValue?: string | null;
  wallRValue?: string | null;
  grade?: string | null;
  roofAreaSqft?: number | null;
  wallAreaSqft?: number | null;
  totalInsulatedSqft?: number | null;
  materialCost?: number | null;
  freightCost?: number | null;
  fuelSurcharge?: number | null;
  totalDelivery?: number | null;
  totalCost?: number | null;
  materialPerSqft?: number | null;
  totalPerSqft?: number | null;
  weightLb?: number | null;
  shipBranch?: string | null;
  quoteNumber?: string | null;
  quoteDate?: string | null;
  dataSource?: string | null;
  sourceType?: string | null;
  sourceFileName?: string | null;
  sourceFilePath?: string | null;
  reviewStatus?: CostDocumentReviewStatus;
  parserVersion?: string | null;
  rawExtraction?: Record<string, unknown> | null;
  accessories?: Record<string, unknown>[] | null;
  addedBy?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  dateAdded?: string | null;
  createdAt?: string;
}

export type OpportunityStatus = 'open' | 'won' | 'lost' | 'abandoned';

export interface Opportunity {
  id: string;
  jobId: string;
  clientId: string;
  clientName: string;
  name: string;
  potentialRevenue: number;
  status: OpportunityStatus;
  createdByUserId?: string | null;
  ownerUserId?: string | null;
  salesRep?: string | null;
  estimator?: string | null;
  source?: DocumentType | 'dealer_quote' | 'deal' | 'manual' | 'ghl_sync';
  createdAt?: string;
  updatedAt?: string;
}

export type DealMilestoneKey =
  | 'order_form_sent'
  | 'signed_order_form_received'
  | 'first_client_invoice_issued'
  | 'first_client_payment_received'
  | 'design_file_requested_from_estimator'
  | 'design_file_sent_to_factory'
  | 'vendor_rfq_sent'
  | 'factory_quote_received'
  | 'factory_quote_added_to_true_cost'
  | 'first_factory_invoice_issued'
  | 'first_factory_invoice_paid'
  | 'design_file_sent_for_stamp'
  | 'second_client_invoice_issued'
  | 'second_client_payment_received'
  | 'second_factory_invoice_requested'
  | 'second_factory_invoice_paid'
  | 'freight_ready_achieved';

export interface DealMilestone {
  id: string;
  jobId: string;
  milestoneKey: DealMilestoneKey;
  isComplete: boolean;
  completedAt?: string | null;
  completedByUserId?: string | null;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}
