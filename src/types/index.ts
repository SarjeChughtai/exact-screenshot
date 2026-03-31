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
  foundationType: 'slab' | 'frost_wall';
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
export type FreightStatus = 'Pending' | 'Booked' | 'In Transit' | 'Delivered';
export type ProductionStage = 'Submitted' | 'Acknowledged' | 'In Production' | 'QC Complete' | 'Ship Ready' | 'Shipped' | 'Delivered';

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

export type PaymentDirection = 'Client Payment IN' | 'Vendor Payment OUT' | 'Refund IN' | 'Refund OUT';
export type PaymentType = 'Deposit' | 'Progress Payment' | 'Final Payment' | 'Freight' | 'Insulation' | 'Drawings' | 'Other';

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
  jobId: string;
  clientVendorName: string;
  clientId?: string;
  vendorId?: string;
  direction: PaymentDirection;
  type: PaymentType;
  amountExclTax: number;
  province: string;
  taxRate: number;
  taxAmount: number;
  totalInclTax: number;
  taxOverride: boolean;
  taxOverrideRate?: number;
  vendorProvinceOverride?: string;
  paymentMethod: string;
  referenceNumber: string;
  qbSynced: boolean;
  notes: string;
}

export type CommissionRecipientRole = 'sales_rep' | 'estimator';
export type CommissionPayoutStage =
  | 'sales_rep_stage_1'
  | 'sales_rep_stage_2'
  | 'sales_rep_stage_3'
  | 'estimator_stage_2';

export interface CommissionPayout {
  id: string;
  jobId: string;
  recipientRole: CommissionRecipientRole;
  recipientName: string;
  payoutStage: CommissionPayoutStage;
  amount: number;
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
}

export interface FreightRecord {
  jobId: string;
  clientName: string;
  buildingSize: string;
  province?: string;
  weight: number;
  pickupAddress: string;
  deliveryAddress: string;
  estDistance: number;
  estFreight: number;
  actualFreight: number;
  paid: boolean;
  carrier: string;
  assignedFreightUserId?: string | null;
  status: FreightStatus;
}

export interface Estimate {
  id: string;
  label: string;
  date: string;
  clientName: string;
  clientId: string;
  salesRep: string;
  width: number;
  length: number;
  height: number;
  pitch: number;
  province: string;
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

// --- Import Review ---
export type ImportReviewStatus = 'pending' | 'approved' | 'needs_review' | 'corrected' | 'rejected';

export interface QuoteFileRecord {
  id: string;
  documentId?: string | null;
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
