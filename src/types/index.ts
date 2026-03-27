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

export interface PaymentEntry {
  id: string;
  date: string;
  jobId: string;
  clientVendorName: string;
  direction: PaymentDirection;
  type: PaymentType;
  amountExclTax: number;
  province: string;
  taxRate: number;
  taxAmount: number;
  totalInclTax: number;
  paymentMethod: string;
  referenceNumber: string;
  qbSynced: boolean;
  notes: string;
}

export interface PaymentChangeLog {
  id: string;
  paymentId: string;
  changedBy: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  summary: string;
  changedAt: string;
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
  weight: number;
  pickupAddress: string;
  deliveryAddress: string;
  estDistance: number;
  estFreight: number;
  actualFreight: number;
  paid: boolean;
  carrier: string;
  status: FreightStatus;
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

