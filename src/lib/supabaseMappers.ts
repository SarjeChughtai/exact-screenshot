import type {
  Quote,
  Deal,
  InternalCost,
  PaymentEntry,
  CommissionPayout,
  ProductionRecord,
  FreightRecord,
  Client,
  Vendor,
  ManufacturerRFQ,
  ManufacturerBid,
  QuoteFileRecord,
  SteelCostEntry,
  Estimate,
  UserProfileSettings,
  StoredDocument,
  SteelCostDataRecord,
  InsulationCostDataRecord,
  Opportunity,
  DealMilestone,
  JobProfile,
  JobStreamAttachment,
  JobStreamEntry,
  JobStreamUserState,
  VisibleJobStreamSummary,
  CommissionRecipientSetting,
  ConstructionRFQ,
  ConstructionBid,
} from '@/types';

// --- Deal ---
export function dealFromRow(r: any): Deal {
  return {
    jobId: r.job_id ?? '',
    jobName: r.job_name ?? '',
    clientName: r.client_name ?? '',
    clientId: r.client_id ?? '',
    salesRep: r.sales_rep ?? '',
    estimator: r.estimator ?? '',
    teamLead: r.team_lead ?? '',
    province: r.province ?? '',
    city: r.city ?? '',
    address: r.address ?? '',
    postalCode: r.postal_code ?? '',
    width: Number(r.width) || 0,
    length: Number(r.length) || 0,
    height: Number(r.height) || 0,
    leftEaveHeight: r.left_eave_height != null ? Number(r.left_eave_height) : undefined,
    rightEaveHeight: r.right_eave_height != null ? Number(r.right_eave_height) : undefined,
    isSingleSlope: r.is_single_slope ?? undefined,
    sqft: Number(r.sqft) || 0,
    weight: Number(r.weight) || 0,
    taxRate: Number(r.tax_rate) || 0,
    taxType: r.tax_type ?? '',
    orderType: r.order_type ?? '',
    dateSigned: r.date_signed ?? '',
    dealStatus: r.deal_status ?? 'Lead',
    paymentStatus: r.payment_status ?? 'UNPAID',
    productionStatus: r.production_status ?? 'Submitted',
    freightStatus: r.freight_status ?? 'Pending',
    insulationStatus: r.insulation_status ?? '',
    engineeringDrawingsStatus: r.engineering_drawings_status ?? 'not_requested',
    foundationDrawingsStatus: r.foundation_drawings_status ?? 'not_requested',
    opportunityId: r.opportunity_id ?? null,
    cxPaymentStageOverride: r.cx_payment_stage_override ?? '',
    factoryPaymentStageOverride: r.factory_payment_stage_override ?? '',
    deliveryDate: r.delivery_date ?? '',
    pickupDate: r.pickup_date ?? '',
    notes: r.notes ?? '',
  };
}

export function dealToRow(d: Partial<Deal>): Record<string, any> {
  const map: Record<string, string> = {
    jobId: 'job_id', jobName: 'job_name', clientName: 'client_name', clientId: 'client_id',
    salesRep: 'sales_rep', estimator: 'estimator', teamLead: 'team_lead', province: 'province',
    city: 'city', address: 'address', postalCode: 'postal_code', width: 'width', length: 'length',
    height: 'height', sqft: 'sqft', weight: 'weight', taxRate: 'tax_rate', taxType: 'tax_type',
    orderType: 'order_type', dateSigned: 'date_signed', dealStatus: 'deal_status',
    paymentStatus: 'payment_status', productionStatus: 'production_status',
    freightStatus: 'freight_status', insulationStatus: 'insulation_status',
    engineeringDrawingsStatus: 'engineering_drawings_status',
    foundationDrawingsStatus: 'foundation_drawings_status',
    opportunityId: 'opportunity_id',
    cxPaymentStageOverride: 'cx_payment_stage_override',
    factoryPaymentStageOverride: 'factory_payment_stage_override',
    deliveryDate: 'delivery_date', pickupDate: 'pickup_date', notes: 'notes',
    leftEaveHeight: 'left_eave_height', rightEaveHeight: 'right_eave_height', isSingleSlope: 'is_single_slope',
  };
  const row: Record<string, any> = {};
  for (const [k, v] of Object.entries(d)) {
    if (map[k]) row[map[k]] = v;
  }
  return row;
}

// --- Quote ---
export function quoteFromRow(r: any): Quote {
  return {
    id: r.id ?? '',
    date: r.date ?? '',
    jobId: r.job_id ?? '',
    jobName: r.job_name ?? '',
    clientName: r.client_name ?? '',
    clientId: r.client_id ?? '',
    salesRep: r.sales_rep ?? '',
    estimator: r.estimator ?? '',
    province: r.province ?? '',
    city: r.city ?? '',
    address: r.address ?? '',
    postalCode: r.postal_code ?? '',
    width: Number(r.width) || 0,
    length: Number(r.length) || 0,
    height: Number(r.height) || 0,
    leftEaveHeight: r.left_eave_height != null ? Number(r.left_eave_height) : undefined,
    rightEaveHeight: r.right_eave_height != null ? Number(r.right_eave_height) : undefined,
    isSingleSlope: r.is_single_slope ?? undefined,
    pitch: r.pitch != null ? Number(r.pitch) : undefined,
    sqft: Number(r.sqft) || 0,
    weight: Number(r.weight) || 0,
    baseSteelCost: Number(r.base_steel_cost) || 0,
    steelAfter12: Number(r.steel_after_12) || 0,
    markup: Number(r.markup) || 0,
    adjustedSteel: Number(r.adjusted_steel) || 0,
    engineering: Number(r.engineering) || 0,
    foundation: Number(r.foundation) || 0,
    foundationType: r.foundation_type ?? 'slab',
    gutters: Number(r.gutters) || 0,
    liners: Number(r.liners) || 0,
    insulation: Number(r.insulation) || 0,
    insulationGrade: r.insulation_grade ?? '',
    freight: Number(r.freight) || 0,
    combinedTotal: Number(r.combined_total) || 0,
    perSqft: Number(r.per_sqft) || 0,
    perLb: Number(r.per_lb) || 0,
    contingencyPct: Number(r.contingency_pct) || 5,
    contingency: Number(r.contingency) || 0,
    gstHst: Number(r.gst_hst) || 0,
    qst: Number(r.qst) || 0,
    grandTotal: Number(r.grand_total) || 0,
    status: r.status ?? 'Draft',
    documentType: r.document_type ?? 'external_quote',
    workflowStatus: r.workflow_status ?? 'draft',
    sourceDocumentId: r.source_document_id ?? null,
    opportunityId: r.opportunity_id ?? null,
    assignedEstimatorUserId: r.assigned_estimator_user_id ?? null,
    assignedOperationsUserId: r.assigned_operations_user_id ?? null,
    pdfStoragePath: r.pdf_storage_path ?? '',
    pdfFileName: r.pdf_file_name ?? '',
    payload: r.payload ?? {},
    createdByUserId: r.created_by_user_id ?? null,
    createdAt: r.created_at ?? '',
    updatedAt: r.updated_at ?? '',
    isDeleted: r.is_deleted ?? false,
  };
}

export function quoteToRow(q: Partial<Quote>): Record<string, any> {
  const map: Record<string, string> = {
    id: 'id', date: 'date', jobId: 'job_id', jobName: 'job_name', clientName: 'client_name',
    clientId: 'client_id', salesRep: 'sales_rep', estimator: 'estimator', province: 'province',
    city: 'city', address: 'address', postalCode: 'postal_code', width: 'width', length: 'length',
    height: 'height', sqft: 'sqft', weight: 'weight', baseSteelCost: 'base_steel_cost',
    steelAfter12: 'steel_after_12', markup: 'markup', adjustedSteel: 'adjusted_steel',
    engineering: 'engineering', foundation: 'foundation', foundationType: 'foundation_type',
    gutters: 'gutters', liners: 'liners', insulation: 'insulation', insulationGrade: 'insulation_grade',
    freight: 'freight', combinedTotal: 'combined_total', perSqft: 'per_sqft', perLb: 'per_lb',
    gstHst: 'gst_hst',
    qst: 'qst', grandTotal: 'grand_total', status: 'status',
    documentType: 'document_type', workflowStatus: 'workflow_status',
    sourceDocumentId: 'source_document_id',
    opportunityId: 'opportunity_id',
    assignedEstimatorUserId: 'assigned_estimator_user_id',
    assignedOperationsUserId: 'assigned_operations_user_id',
    pdfStoragePath: 'pdf_storage_path', pdfFileName: 'pdf_file_name',
    payload: 'payload', createdByUserId: 'created_by_user_id', updatedAt: 'updated_at',
    leftEaveHeight: 'left_eave_height', rightEaveHeight: 'right_eave_height', isSingleSlope: 'is_single_slope', pitch: 'pitch',
    isDeleted: 'is_deleted',
  };
  const row: Record<string, any> = {};
  for (const [k, v] of Object.entries(q)) {
    if (map[k]) row[map[k]] = v;
  }
  return row;
}

// --- InternalCost ---
export function internalCostFromRow(r: any): InternalCost {
  return {
    jobId: r.job_id ?? '',
    trueMaterial: Number(r.true_material) || 0,
    trueStructuralDrawing: Number(r.true_structural_drawing) || 0,
    trueFoundationDrawing: Number(r.true_foundation_drawing) || 0,
    trueFreight: Number(r.true_freight) || 0,
    trueInsulation: Number(r.true_insulation) || 0,
    repMaterial: Number(r.rep_material) || 0,
    repStructuralDrawing: Number(r.rep_structural_drawing) || 0,
    repFoundationDrawing: Number(r.rep_foundation_drawing) || 0,
    repFreight: Number(r.rep_freight) || 0,
    repInsulation: Number(r.rep_insulation) || 0,
    salePrice: Number(r.sale_price) || 0,
    showRepCosts: r.show_rep_costs ?? false,
  };
}

export function internalCostToRow(ic: Partial<InternalCost>): Record<string, any> {
  const map: Record<string, string> = {
    jobId: 'job_id', trueMaterial: 'true_material', trueStructuralDrawing: 'true_structural_drawing',
    trueFoundationDrawing: 'true_foundation_drawing', trueFreight: 'true_freight',
    trueInsulation: 'true_insulation', repMaterial: 'rep_material',
    repStructuralDrawing: 'rep_structural_drawing', repFoundationDrawing: 'rep_foundation_drawing',
    repFreight: 'rep_freight', repInsulation: 'rep_insulation', salePrice: 'sale_price',
    showRepCosts: 'show_rep_costs',
  };
  const row: Record<string, any> = {};
  for (const [k, v] of Object.entries(ic)) {
    if (map[k]) row[map[k]] = v;
  }
  return row;
}

// --- PaymentEntry ---
export function paymentFromRow(r: any): PaymentEntry {
  return {
    id: r.id ?? '',
    date: r.date ?? '',
    jobId: r.job_id ?? '',
    clientVendorName: r.client_vendor_name ?? '',
    clientId: r.client_id ?? undefined,
    vendorId: r.vendor_id ?? undefined,
    direction: r.direction ?? 'Client Payment IN',
    type: r.type ?? 'Deposit',
    partyType: r.party_type ?? 'client',
    commissionRecipientType: r.commission_recipient_type ?? null,
    linkedUserId: r.linked_user_id ?? null,
    amountExclTax: Number(r.amount_excl_tax) || 0,
    province: r.province ?? '',
    taxRate: Number(r.tax_rate) || 0,
    taxAmount: Number(r.tax_amount) || 0,
    totalInclTax: Number(r.total_incl_tax) || 0,
    taxOverride: r.tax_override ?? false,
    taxOverrideRate: r.tax_override_rate != null ? Number(r.tax_override_rate) : undefined,
    vendorProvinceOverride: r.vendor_province_override ?? undefined,
    recurrenceFrequency: r.recurrence_frequency ?? null,
    recurrenceStartDate: r.recurrence_start_date ?? null,
    recurrenceEndDate: r.recurrence_end_date ?? null,
    includeInProjection: r.include_in_projection ?? false,
    paymentMethod: r.payment_method ?? '',
    referenceNumber: r.reference_number ?? '',
    qbSynced: r.qb_synced ?? false,
    notes: r.notes ?? '',
  };
}

export function paymentToRow(p: Partial<PaymentEntry>): Record<string, any> {
  const map: Record<string, string> = {
    id: 'id', date: 'date', jobId: 'job_id', clientVendorName: 'client_vendor_name',
    clientId: 'client_id', vendorId: 'vendor_id',
    direction: 'direction', type: 'type', partyType: 'party_type',
    commissionRecipientType: 'commission_recipient_type', linkedUserId: 'linked_user_id',
    amountExclTax: 'amount_excl_tax', province: 'province',
    taxRate: 'tax_rate', taxAmount: 'tax_amount', totalInclTax: 'total_incl_tax',
    taxOverride: 'tax_override', taxOverrideRate: 'tax_override_rate',
    vendorProvinceOverride: 'vendor_province_override',
    recurrenceFrequency: 'recurrence_frequency', recurrenceStartDate: 'recurrence_start_date',
    recurrenceEndDate: 'recurrence_end_date', includeInProjection: 'include_in_projection',
    paymentMethod: 'payment_method', referenceNumber: 'reference_number',
    qbSynced: 'qb_synced', notes: 'notes',
  };
  const row: Record<string, any> = {};
  for (const [k, v] of Object.entries(p)) {
    if (map[k]) row[map[k]] = v;
  }
  return row;
}

// --- CommissionPayout ---
export function commissionPayoutFromRow(r: any): CommissionPayout {
  return {
    id: r.id ?? '',
    jobId: r.job_id ?? '',
    recipientRole: r.recipient_role ?? 'sales_rep',
    recipientName: r.recipient_name ?? '',
    payoutStage: r.payout_stage ?? 'rep_stage_1',
    amount: Number(r.amount) || 0,
    linkedUserId: r.linked_user_id ?? null,
    basisUsed: r.basis_used ?? null,
    scheduleRule: r.schedule_rule ?? null,
    paymentLedgerId: r.payment_ledger_id ?? null,
    eligibleOnDate: r.eligible_on_date ?? null,
    paidOn: r.paid_on ?? '',
    paymentMethod: r.payment_method ?? '',
    referenceNumber: r.reference_number ?? '',
    notes: r.notes ?? '',
    confirmedByUserId: r.confirmed_by_user_id ?? null,
    confirmedByName: r.confirmed_by_name ?? null,
    createdAt: r.created_at ?? '',
    updatedAt: r.updated_at ?? '',
  };
}

export function commissionPayoutToRow(p: Partial<CommissionPayout>): Record<string, any> {
  const map: Record<string, string> = {
    id: 'id',
    jobId: 'job_id',
    recipientRole: 'recipient_role',
    recipientName: 'recipient_name',
    payoutStage: 'payout_stage',
    amount: 'amount',
    linkedUserId: 'linked_user_id',
    basisUsed: 'basis_used',
    scheduleRule: 'schedule_rule',
    paymentLedgerId: 'payment_ledger_id',
    eligibleOnDate: 'eligible_on_date',
    paidOn: 'paid_on',
    paymentMethod: 'payment_method',
    referenceNumber: 'reference_number',
    notes: 'notes',
    confirmedByUserId: 'confirmed_by_user_id',
    confirmedByName: 'confirmed_by_name',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  };
  const row: Record<string, any> = {};
  for (const [k, v] of Object.entries(p)) {
    if (map[k]) row[map[k]] = v;
  }
  return row;
}

// --- Client ---
export function clientFromRow(r: any): Client {
  return {
    id: r.id ?? '',
    clientId: r.client_id ?? '',
    clientName: r.client_name ?? r.name ?? '',
    name: r.client_name ?? r.name ?? '',
    jobIds: r.job_ids ?? [],
    contactEmail: r.contact_email ?? '',
    contactPhone: r.contact_phone ?? '',
    notes: r.notes ?? '',
    createdAt: r.created_at ?? '',
  };
}

export function clientToRow(c: Partial<Client>): Record<string, any> {
  const map: Record<string, string> = {
    id: 'id', clientId: 'client_id', clientName: 'client_name', name: 'name',
    jobIds: 'job_ids', contactEmail: 'contact_email',
    contactPhone: 'contact_phone', notes: 'notes',
  };
  const row: Record<string, any> = {};
  for (const [k, v] of Object.entries(c)) {
    if (map[k]) row[map[k]] = v;
  }
  return row;
}

// --- Vendor ---
export function vendorFromRow(r: any): Vendor {
  return {
    id: r.id ?? '',
    name: r.name ?? '',
    province: r.province ?? 'ON',
    contactEmail: r.contact_email ?? '',
    contactPhone: r.contact_phone ?? '',
    notes: r.notes ?? '',
    createdAt: r.created_at ?? '',
  };
}

export function vendorToRow(v: Partial<Vendor>): Record<string, any> {
  const map: Record<string, string> = {
    id: 'id', name: 'name', province: 'province',
    contactEmail: 'contact_email', contactPhone: 'contact_phone', notes: 'notes',
  };
  const row: Record<string, any> = {};
  for (const [k, val] of Object.entries(v)) {
    if (map[k]) row[map[k]] = val;
  }
  return row;
}

// --- ProductionRecord ---
export function productionFromRow(r: any): ProductionRecord {
  return {
    jobId: r.job_id ?? '',
    submitted: r.submitted ?? false,
    acknowledged: r.acknowledged ?? false,
    inProduction: r.in_production ?? false,
    qcComplete: r.qc_complete ?? false,
    shipReady: r.ship_ready ?? false,
    shipped: r.shipped ?? false,
    delivered: r.delivered ?? false,
    drawingsStatus: r.drawings_status ?? '',
    insulationStatus: r.insulation_status ?? '',
    engineeringDrawingsStatus: r.engineering_drawings_status ?? 'not_requested',
    foundationDrawingsStatus: r.foundation_drawings_status ?? 'not_requested',
  };
}

export function productionToRow(pr: Partial<ProductionRecord>): Record<string, any> {
  const map: Record<string, string> = {
    jobId: 'job_id', submitted: 'submitted', acknowledged: 'acknowledged',
    inProduction: 'in_production', qcComplete: 'qc_complete', shipReady: 'ship_ready',
    shipped: 'shipped', delivered: 'delivered', drawingsStatus: 'drawings_status',
    insulationStatus: 'insulation_status',
    engineeringDrawingsStatus: 'engineering_drawings_status',
    foundationDrawingsStatus: 'foundation_drawings_status',
  };
  const row: Record<string, any> = {};
  for (const [k, v] of Object.entries(pr)) {
    if (map[k]) row[map[k]] = v;
  }
  return row;
}

// --- FreightRecord ---
export function freightFromRow(r: any): FreightRecord {
  return {
    jobId: r.job_id ?? '',
    clientName: r.client_name ?? '',
    buildingSize: r.building_size ?? '',
    opportunityId: r.opportunity_id ?? null,
    province: r.province ?? '',
    weight: Number(r.weight) || 0,
    pickupAddress: r.pickup_address ?? '',
    deliveryAddress: r.delivery_address ?? '',
    dropOffLocation: r.drop_off_location ?? '',
    pickupDate: r.pickup_date ?? '',
    deliveryDate: r.delivery_date ?? '',
    estimatedPickupDate: r.estimated_pickup_date ?? '',
    estimatedDeliveryDate: r.estimated_delivery_date ?? '',
    actualPickupDate: r.actual_pickup_date ?? '',
    actualDeliveryDate: r.actual_delivery_date ?? '',
    mode: r.mode ?? 'execution',
    estDistance: Number(r.est_distance) || 0,
    estFreight: Number(r.est_freight) || 0,
    actualFreight: Number(r.actual_freight) || 0,
    paid: r.paid ?? false,
    carrier: r.carrier ?? '',
    moffettIncluded: r.moffett_included ?? false,
    assignedFreightUserId: r.assigned_freight_user_id ?? null,
    status: r.status ?? 'Pending',
  };
}

export function freightToRow(fr: Partial<FreightRecord>): Record<string, any> {
  const map: Record<string, string> = {
    jobId: 'job_id', clientName: 'client_name', buildingSize: 'building_size',
    opportunityId: 'opportunity_id',
    province: 'province', weight: 'weight', pickupAddress: 'pickup_address', deliveryAddress: 'delivery_address',
    dropOffLocation: 'drop_off_location', pickupDate: 'pickup_date', deliveryDate: 'delivery_date',
    estimatedPickupDate: 'estimated_pickup_date', estimatedDeliveryDate: 'estimated_delivery_date',
    actualPickupDate: 'actual_pickup_date', actualDeliveryDate: 'actual_delivery_date', mode: 'mode',
    estDistance: 'est_distance', estFreight: 'est_freight', actualFreight: 'actual_freight',
    paid: 'paid', carrier: 'carrier', moffettIncluded: 'moffett_included', assignedFreightUserId: 'assigned_freight_user_id', status: 'status',
  };
  const row: Record<string, any> = {};
  for (const [k, v] of Object.entries(fr)) {
    if (map[k]) row[map[k]] = v;
  }
  return row;
}

// --- ManufacturerRFQ ---
export function manufacturerRFQFromRow(r: any): ManufacturerRFQ {
  return {
    id: r.id ?? '',
    jobId: r.job_id ?? '',
    title: r.title ?? '',
    buildingSpec: r.building_spec ?? '',
    width: Number(r.width) || 0,
    length: Number(r.length) || 0,
    height: Number(r.height) || 0,
    weight: Number(r.weight) || 0,
    province: r.province ?? '',
    city: r.city ?? '',
    deliveryAddress: r.delivery_address ?? '',
    requiredByDate: r.required_by_date ?? '',
    notes: r.notes ?? '',
    status: r.status ?? 'Open',
    createdBy: r.created_by ?? '',
    createdAt: r.created_at ?? '',
    closingDate: r.closing_date ?? '',
    awardedBidId: r.awarded_bid_id ?? '',
  };
}

export function manufacturerRFQToRow(m: Partial<ManufacturerRFQ>): Record<string, any> {
  const map: Record<string, string> = {
    id: 'id', jobId: 'job_id', title: 'title', buildingSpec: 'building_spec',
    width: 'width', length: 'length', height: 'height', weight: 'weight',
    province: 'province', city: 'city', deliveryAddress: 'delivery_address',
    requiredByDate: 'required_by_date', notes: 'notes', status: 'status',
    createdBy: 'created_by', createdAt: 'created_at', closingDate: 'closing_date',
    awardedBidId: 'awarded_bid_id',
  };
  const row: Record<string, any> = {};
  for (const [k, v] of Object.entries(m)) {
    if (map[k]) row[map[k]] = v;
  }
  return row;
}

// --- ManufacturerBid ---
export function manufacturerBidFromRow(r: any): ManufacturerBid {
  return {
    id: r.id ?? '',
    rfqId: r.rfq_id ?? '',
    manufacturerId: r.manufacturer_id ?? '',
    manufacturerName: r.manufacturer_name ?? '',
    pricePerLb: Number(r.price_per_lb) || 0,
    totalPrice: Number(r.total_price) || 0,
    leadTimeDays: Number(r.lead_time_days) || 0,
    notes: r.notes ?? '',
    status: r.status ?? 'Submitted',
    submittedAt: r.submitted_at ?? '',
  };
}

export function manufacturerBidToRow(b: Partial<ManufacturerBid>): Record<string, any> {
  const map: Record<string, string> = {
    id: 'id', rfqId: 'rfq_id', manufacturerId: 'manufacturer_id',
    manufacturerName: 'manufacturer_name', pricePerLb: 'price_per_lb',
    totalPrice: 'total_price', leadTimeDays: 'lead_time_days',
    notes: 'notes', status: 'status', submittedAt: 'submitted_at',
  };
  const row: Record<string, any> = {};
  for (const [k, v] of Object.entries(b)) {
    if (map[k]) row[map[k]] = v;
  }
  return row;
}

// --- QuoteFileRecord ---
export function quoteFileFromRow(r: any): QuoteFileRecord {
  return {
    id: r.id ?? '',
    documentId: r.document_id ?? null,
    storedDocumentId: r.stored_document_id ?? null,
    jobId: r.job_id ?? '',
    clientName: r.client_name ?? '',
    clientId: r.client_id ?? '',
    fileName: r.file_name ?? '',
    fileSize: Number(r.file_size) || 0,
    fileType: r.file_type ?? 'unknown',
    fileCategory: r.file_category ?? 'support_file',
    storagePath: r.storage_path ?? '',
    buildingLabel: r.building_label ?? '',
    extractionSource: r.extraction_source ?? 'unknown',
    aiOutput: r.ai_output ?? null,
    reviewStatus: r.review_status ?? 'pending',
    parseError: r.parse_error ?? null,
    reviewedBy: r.reviewed_by ?? null,
    reviewedAt: r.reviewed_at ?? null,
    correctedData: r.corrected_data ?? null,
    duplicateGroupKey: r.duplicate_group_key ?? null,
    isPrimaryDocument: r.is_primary_document ?? true,
    gdriveStatus: r.gdrive_status ?? 'pending',
    gdriveFileId: r.gdrive_file_id ?? null,
    uploadedBy: r.uploaded_by ?? null,
    createdAt: r.created_at ?? '',
  };
}

export function quoteFileToRow(qf: Partial<QuoteFileRecord>): Record<string, any> {
  const map: Record<string, string> = {
    id: 'id', documentId: 'document_id', storedDocumentId: 'stored_document_id', jobId: 'job_id', clientName: 'client_name', clientId: 'client_id',
    fileName: 'file_name', fileSize: 'file_size', fileType: 'file_type',
    fileCategory: 'file_category',
    storagePath: 'storage_path', buildingLabel: 'building_label',
    extractionSource: 'extraction_source', aiOutput: 'ai_output',
    reviewStatus: 'review_status', parseError: 'parse_error',
    reviewedBy: 'reviewed_by', reviewedAt: 'reviewed_at',
    correctedData: 'corrected_data', gdriveStatus: 'gdrive_status',
    duplicateGroupKey: 'duplicate_group_key', isPrimaryDocument: 'is_primary_document',
    gdriveFileId: 'gdrive_file_id', uploadedBy: 'uploaded_by',
  };
  const row: Record<string, any> = {};
  for (const [k, v] of Object.entries(qf)) {
    if (map[k]) row[map[k]] = v;
  }
  return row;
}

// --- Estimate ---
export function estimateFromRow(r: any): Estimate {
  return {
    id: r.id ?? '',
    label: r.label ?? '',
    date: r.date ?? '',
    jobId: r.job_id ?? null,
    clientName: r.client_name ?? '',
    clientId: r.client_id ?? '',
    salesRep: r.sales_rep ?? '',
    width: Number(r.width) || 0,
    length: Number(r.length) || 0,
    height: Number(r.height) || 0,
    pitch: Number(r.pitch) || 0,
    province: r.province ?? 'ON',
    city: r.city ?? '',
    postalCode: r.postal_code ?? '',
    grandTotal: Number(r.grand_total) || 0,
    sqft: Number(r.sqft) || 0,
    estimatedTotal: Number(r.estimated_total) || 0,
    notes: r.notes ?? '',
    auditNotes: Array.isArray(r.audit_notes) ? r.audit_notes : [],
    payload: r.payload ?? {},
    createdByUserId: r.created_by_user_id ?? null,
    createdAt: r.created_at ?? '',
    updatedAt: r.updated_at ?? '',
  };
}

export function estimateToRow(e: Partial<Estimate>): Record<string, any> {
  const map: Record<string, string> = {
    id: 'id', label: 'label', date: 'date', jobId: 'job_id', clientName: 'client_name', clientId: 'client_id',
    salesRep: 'sales_rep', width: 'width', length: 'length', height: 'height', pitch: 'pitch',
    province: 'province', city: 'city', postalCode: 'postal_code',
    grandTotal: 'grand_total', sqft: 'sqft', estimatedTotal: 'estimated_total',
    notes: 'notes', auditNotes: 'audit_notes', payload: 'payload', createdByUserId: 'created_by_user_id',
    updatedAt: 'updated_at',
  };
  const row: Record<string, any> = {};
  for (const [k, v] of Object.entries(e)) {
    if (map[k]) row[map[k]] = v;
  }
  return row;
}

// --- UserProfileSettings ---
export function userProfileFromRow(r: any): UserProfileSettings {
  return {
    userId: r.user_id ?? '',
    phone: r.phone ?? '',
    address: r.address ?? '',
    emailNotifications: r.email_notifications ?? true,
    smsNotifications: r.sms_notifications ?? false,
    canViewAllFreightBoard: r.can_view_all_freight_board ?? false,
    canUseMessaging: r.can_use_messaging ?? false,
    lastSeenAt: r.last_seen_at ?? null,
    createdAt: r.created_at ?? '',
    updatedAt: r.updated_at ?? '',
  };
}

export function userProfileToRow(p: Partial<UserProfileSettings>): Record<string, any> {
  const map: Record<string, string> = {
    userId: 'user_id',
    phone: 'phone',
    address: 'address',
    emailNotifications: 'email_notifications',
    smsNotifications: 'sms_notifications',
    canViewAllFreightBoard: 'can_view_all_freight_board',
    canUseMessaging: 'can_use_messaging',
    lastSeenAt: 'last_seen_at',
    updatedAt: 'updated_at',
  };
  const row: Record<string, any> = {};
  for (const [k, v] of Object.entries(p)) {
    if (map[k]) row[map[k]] = v;
  }
  return row;
}

// --- SteelCostEntry ---
export function steelCostEntryFromRow(r: any): SteelCostEntry {
  return {
    id: r.id ?? '',
    quoteFileId: r.quote_file_id ?? null,
    jobId: r.job_id ?? '',
    clientName: r.client_name ?? '',
    clientId: r.client_id ?? '',
    buildingLabel: r.building_label ?? '',
    documentType: r.document_type ?? '',
    fileName: r.file_name ?? '',
    weightLbs: Number(r.weight_lbs) || 0,
    costPerLb: Number(r.cost_per_lb) || 0,
    totalCost: Number(r.total_cost) || 0,
    width: r.width != null ? Number(r.width) : null,
    length: r.length != null ? Number(r.length) : null,
    height: r.height != null ? Number(r.height) : null,
    roofPitch: r.roof_pitch != null ? Number(r.roof_pitch) : null,
    province: r.province ?? null,
    city: r.city ?? null,
    components: r.components ?? null,
    insulationTotal: Number(r.insulation_total) || 0,
    insulationGrade: r.insulation_grade ?? null,
    extractionSource: r.extraction_source ?? '',
    aiRawOutput: r.ai_raw_output ?? null,
    uploadedBy: r.uploaded_by ?? null,
    createdAt: r.created_at ?? '',
  };
}

export function steelCostEntryToRow(e: Partial<SteelCostEntry>): Record<string, any> {
  const map: Record<string, string> = {
    id: 'id', quoteFileId: 'quote_file_id', jobId: 'job_id',
    clientName: 'client_name', clientId: 'client_id', buildingLabel: 'building_label',
    documentType: 'document_type', fileName: 'file_name', weightLbs: 'weight_lbs',
    costPerLb: 'cost_per_lb', totalCost: 'total_cost', width: 'width', length: 'length',
    height: 'height', roofPitch: 'roof_pitch', province: 'province', city: 'city',
    components: 'components', insulationTotal: 'insulation_total',
    insulationGrade: 'insulation_grade', extractionSource: 'extraction_source',
    aiRawOutput: 'ai_raw_output', uploadedBy: 'uploaded_by',
  };
  const row: Record<string, any> = {};
  for (const [k, v] of Object.entries(e)) {
    if (map[k]) row[map[k]] = v;
  }
  return row;
}

// --- JobProfile ---
export function jobProfileFromRow(r: any): JobProfile {
  return {
    jobId: r.job_id ?? '',
    jobName: r.job_name ?? '',
    clientId: r.client_id ?? '',
    clientName: r.client_name ?? '',
    salesRep: r.sales_rep ?? '',
    estimator: r.estimator ?? '',
    teamLead: r.team_lead ?? '',
    province: r.province ?? '',
    city: r.city ?? '',
    address: r.address ?? '',
    postalCode: r.postal_code ?? '',
    width: Number(r.width) || 0,
    length: Number(r.length) || 0,
    height: Number(r.height) || 0,
    leftEaveHeight: r.left_eave_height != null ? Number(r.left_eave_height) : undefined,
    rightEaveHeight: r.right_eave_height != null ? Number(r.right_eave_height) : undefined,
    isSingleSlope: r.is_single_slope ?? undefined,
    pitch: r.pitch != null ? Number(r.pitch) : undefined,
    structureType: r.structure_type ?? null,
    lastSource: r.last_source ?? null,
    createdAt: r.created_at ?? '',
    updatedAt: r.updated_at ?? '',
  };
}

export function jobProfileToRow(profile: Partial<JobProfile>): Record<string, any> {
  const map: Record<string, string> = {
    jobId: 'job_id', jobName: 'job_name', clientId: 'client_id', clientName: 'client_name',
    salesRep: 'sales_rep', estimator: 'estimator', teamLead: 'team_lead',
    province: 'province', city: 'city', address: 'address', postalCode: 'postal_code',
    width: 'width', length: 'length', height: 'height',
    leftEaveHeight: 'left_eave_height', rightEaveHeight: 'right_eave_height',
    isSingleSlope: 'is_single_slope', pitch: 'pitch', structureType: 'structure_type',
    lastSource: 'last_source', updatedAt: 'updated_at',
  };
  const row: Record<string, any> = {};
  for (const [k, v] of Object.entries(profile)) {
    if (map[k]) row[map[k]] = v;
  }
  return row;
}

// --- JobStreamEntry ---
export function jobStreamEntryFromRow(r: any): JobStreamEntry {
  return {
    id: r.id ?? '',
    jobId: r.job_id ?? '',
    entryType: r.entry_type ?? 'post',
    eventKey: r.event_key ?? null,
    parentEntryId: r.parent_entry_id ?? null,
    body: r.body ?? '',
    metadata: r.metadata ?? {},
    createdByUserId: r.created_by_user_id ?? null,
    createdByName: r.created_by_name ?? '',
    createdAt: r.created_at ?? '',
    updatedAt: r.updated_at ?? '',
    deletedAt: r.deleted_at ?? null,
  };
}

export function jobStreamEntryToRow(entry: Partial<JobStreamEntry>): Record<string, any> {
  const map: Record<string, string> = {
    id: 'id',
    jobId: 'job_id',
    entryType: 'entry_type',
    eventKey: 'event_key',
    parentEntryId: 'parent_entry_id',
    body: 'body',
    metadata: 'metadata',
    createdByUserId: 'created_by_user_id',
    createdByName: 'created_by_name',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  };
  const row: Record<string, any> = {};
  for (const [k, v] of Object.entries(entry)) {
    if (map[k]) row[map[k]] = v;
  }
  return row;
}

// --- JobStreamAttachment ---
export function jobStreamAttachmentFromRow(r: any): JobStreamAttachment {
  return {
    id: r.id ?? '',
    entryId: r.entry_id ?? '',
    jobId: r.job_id ?? '',
    fileName: r.file_name ?? '',
    fileType: r.file_type ?? 'application/octet-stream',
    fileSize: r.file_size != null ? Number(r.file_size) : 0,
    storagePath: r.storage_path ?? '',
    createdByUserId: r.created_by_user_id ?? null,
    createdAt: r.created_at ?? '',
  };
}

export function jobStreamAttachmentToRow(attachment: Partial<JobStreamAttachment>): Record<string, any> {
  const map: Record<string, string> = {
    id: 'id',
    entryId: 'entry_id',
    jobId: 'job_id',
    fileName: 'file_name',
    fileType: 'file_type',
    fileSize: 'file_size',
    storagePath: 'storage_path',
    createdByUserId: 'created_by_user_id',
    createdAt: 'created_at',
  };
  const row: Record<string, any> = {};
  for (const [k, v] of Object.entries(attachment)) {
    if (map[k]) row[map[k]] = v;
  }
  return row;
}

// --- JobStreamUserState ---
export function jobStreamUserStateFromRow(r: any): JobStreamUserState {
  return {
    jobId: r.job_id ?? '',
    userId: r.user_id ?? '',
    lastReadAt: r.last_read_at ?? '',
    updatedAt: r.updated_at ?? '',
  };
}

export function jobStreamUserStateToRow(state: Partial<JobStreamUserState>): Record<string, any> {
  const map: Record<string, string> = {
    jobId: 'job_id',
    userId: 'user_id',
    lastReadAt: 'last_read_at',
    updatedAt: 'updated_at',
  };
  const row: Record<string, any> = {};
  for (const [k, v] of Object.entries(state)) {
    if (map[k]) row[map[k]] = v;
  }
  return row;
}

export function visibleJobStreamSummaryFromRow(r: any): VisibleJobStreamSummary {
  return {
    jobId: r.job_id ?? '',
    clientName: r.client_name ?? '',
    jobName: r.job_name ?? '',
    state: r.state ?? 'estimate',
    latestEntryId: r.latest_entry_id ?? null,
    latestEntryType: r.latest_entry_type ?? null,
    latestEventKey: r.latest_event_key ?? null,
    latestBody: r.latest_body ?? null,
    latestCreatedAt: r.latest_created_at ?? null,
    unreadCount: Number(r.unread_count) || 0,
  };
}

// --- CommissionRecipientSetting ---
export function commissionRecipientSettingFromRow(r: any): CommissionRecipientSetting {
  return {
    id: r.id ?? '',
    recipientType: r.recipient_type ?? 'sales_rep',
    recipientName: r.recipient_name ?? '',
    linkedUserId: r.linked_user_id ?? null,
    basisOverride: r.basis_override ?? 'auto',
    scheduleRule: r.schedule_rule ?? 'manual',
    createdAt: r.created_at ?? '',
    updatedAt: r.updated_at ?? '',
  };
}

export function commissionRecipientSettingToRow(setting: Partial<CommissionRecipientSetting>): Record<string, any> {
  const map: Record<string, string> = {
    id: 'id', recipientType: 'recipient_type', recipientName: 'recipient_name',
    linkedUserId: 'linked_user_id', basisOverride: 'basis_override', scheduleRule: 'schedule_rule',
    createdAt: 'created_at', updatedAt: 'updated_at',
  };
  const row: Record<string, any> = {};
  for (const [k, v] of Object.entries(setting)) {
    if (map[k]) row[map[k]] = v;
  }
  return row;
}

// --- ConstructionRFQ ---
export function constructionRFQFromRow(r: any): ConstructionRFQ {
  return {
    id: r.id ?? '',
    jobId: r.job_id ?? '',
    title: r.title ?? '',
    scope: r.scope ?? 'install',
    buildingDetails: r.building_details ?? '',
    jobName: r.job_name ?? '',
    province: r.province ?? '',
    city: r.city ?? '',
    postalCode: r.postal_code ?? '',
    address: r.address ?? '',
    width: Number(r.width) || 0,
    length: Number(r.length) || 0,
    height: Number(r.height) || 0,
    notes: r.notes ?? '',
    requiredByDate: r.required_by_date ?? '',
    closingDate: r.closing_date ?? '',
    status: r.status ?? 'Open',
    createdByUserId: r.created_by_user_id ?? null,
    createdAt: r.created_at ?? '',
    awardedBidId: r.awarded_bid_id ?? null,
  };
}

export function constructionRFQToRow(rfq: Partial<ConstructionRFQ>): Record<string, any> {
  const map: Record<string, string> = {
    id: 'id', jobId: 'job_id', title: 'title', scope: 'scope',
    buildingDetails: 'building_details', jobName: 'job_name', province: 'province',
    city: 'city', postalCode: 'postal_code', address: 'address',
    width: 'width', length: 'length', height: 'height', notes: 'notes',
    requiredByDate: 'required_by_date', closingDate: 'closing_date', status: 'status',
    createdByUserId: 'created_by_user_id', createdAt: 'created_at', awardedBidId: 'awarded_bid_id',
  };
  const row: Record<string, any> = {};
  for (const [k, v] of Object.entries(rfq)) {
    if (map[k]) row[map[k]] = v;
  }
  return row;
}

// --- ConstructionBid ---
export function constructionBidFromRow(r: any): ConstructionBid {
  return {
    id: r.id ?? '',
    rfqId: r.rfq_id ?? '',
    vendorId: r.vendor_id ?? '',
    vendorName: r.vendor_name ?? '',
    bidScope: r.bid_scope ?? 'install_only',
    installAmount: Number(r.install_amount) || 0,
    concreteAmount: Number(r.concrete_amount) || 0,
    totalAmount: Number(r.total_amount) || 0,
    notes: r.notes ?? '',
    status: r.status ?? 'Submitted',
    submittedAt: r.submitted_at ?? '',
  };
}

export function constructionBidToRow(bid: Partial<ConstructionBid>): Record<string, any> {
  const map: Record<string, string> = {
    id: 'id', rfqId: 'rfq_id', vendorId: 'vendor_id', vendorName: 'vendor_name',
    bidScope: 'bid_scope', installAmount: 'install_amount', concreteAmount: 'concrete_amount',
    totalAmount: 'total_amount', notes: 'notes', status: 'status', submittedAt: 'submitted_at',
  };
  const row: Record<string, any> = {};
  for (const [k, v] of Object.entries(bid)) {
    if (map[k]) row[map[k]] = v;
  }
  return row;
}

// --- StoredDocument ---
export function storedDocumentFromRow(r: any): StoredDocument {
  return {
    id: r.id ?? '',
    quoteFileId: r.quote_file_id ?? null,
    documentId: r.document_id ?? null,
    jobId: r.job_id ?? null,
    projectId: r.project_id ?? null,
    clientId: r.client_id ?? null,
    vendorId: r.vendor_id ?? null,
    structureType: r.structure_type ?? null,
    sourceType: r.source_type ?? 'uploaded',
    sourceFilename: r.source_filename ?? null,
    sourceFileExtension: r.source_file_extension ?? null,
    fileName: r.file_name ?? '',
    fileSize: r.file_size != null ? Number(r.file_size) : null,
    fileType: r.file_type ?? 'unknown',
    storagePath: r.storage_path ?? '',
    extractedDocumentType: r.extracted_document_type ?? null,
    parserName: r.parser_name ?? null,
    parserVersion: r.parser_version ?? null,
    parseError: r.parse_error ?? null,
    reviewStatus: r.review_status ?? 'pending',
    parsedData: r.parsed_data ?? null,
    metadata: r.metadata ?? {},
    duplicateGroupKey: r.duplicate_group_key ?? null,
    isPrimaryDocument: r.is_primary_document ?? true,
    parsedSuccessfully: r.parsed_successfully ?? null,
    reviewedBy: r.reviewed_by ?? null,
    reviewedAt: r.reviewed_at ?? null,
    uploadedBy: r.uploaded_by ?? null,
    uploadedAt: r.uploaded_at ?? null,
    createdAt: r.created_at ?? '',
  };
}

export function storedDocumentToRow(d: Partial<StoredDocument>): Record<string, any> {
  const map: Record<string, string> = {
    id: 'id',
    quoteFileId: 'quote_file_id',
    documentId: 'document_id',
    jobId: 'job_id',
    projectId: 'project_id',
    clientId: 'client_id',
    vendorId: 'vendor_id',
    structureType: 'structure_type',
    sourceType: 'source_type',
    sourceFilename: 'source_filename',
    sourceFileExtension: 'source_file_extension',
    fileName: 'file_name',
    fileSize: 'file_size',
    fileType: 'file_type',
    storagePath: 'storage_path',
    extractedDocumentType: 'extracted_document_type',
    parserName: 'parser_name',
    parserVersion: 'parser_version',
    parseError: 'parse_error',
    reviewStatus: 'review_status',
    parsedData: 'parsed_data',
    metadata: 'metadata',
    duplicateGroupKey: 'duplicate_group_key',
    isPrimaryDocument: 'is_primary_document',
    parsedSuccessfully: 'parsed_successfully',
    reviewedBy: 'reviewed_by',
    reviewedAt: 'reviewed_at',
    uploadedBy: 'uploaded_by',
    uploadedAt: 'uploaded_at',
  };
  const row: Record<string, any> = {};
  for (const [k, v] of Object.entries(d)) {
    if (map[k]) row[map[k]] = v;
  }
  return row;
}

// --- SteelCostDataRecord ---
export function steelCostDataFromRow(r: any): SteelCostDataRecord {
  return {
    id: r.id ?? '',
    storedDocumentId: r.stored_document_id ?? null,
    quoteFileId: r.quote_file_id ?? null,
    documentId: r.document_id ?? null,
    jobId: r.job_id ?? null,
    projectId: r.project_id ?? null,
    clientId: r.client_id ?? null,
    vendorId: r.vendor_id ?? null,
    structureType: r.structure_type ?? null,
    widthFt: r.width_ft != null ? Number(r.width_ft) : null,
    lengthFt: r.length_ft != null ? Number(r.length_ft) : null,
    eaveHeightFt: r.eave_height_ft != null ? Number(r.eave_height_ft) : null,
    roofSlope: r.roof_slope != null ? Number(r.roof_slope) : null,
    floorAreaSqft: r.floor_area_sqft != null ? Number(r.floor_area_sqft) : null,
    totalWeightLb: r.total_weight_lb != null ? Number(r.total_weight_lb) : null,
    totalCost: r.total_cost != null ? Number(r.total_cost) : null,
    costPerSqft: r.cost_per_sqft != null ? Number(r.cost_per_sqft) : null,
    weightPerSqft: r.weight_per_sqft != null ? Number(r.weight_per_sqft) : null,
    pricePerLb: r.price_per_lb != null ? Number(r.price_per_lb) : null,
    snowLoadPsf: r.snow_load_psf != null ? Number(r.snow_load_psf) : null,
    windLoadPsf: r.wind_load_psf != null ? Number(r.wind_load_psf) : null,
    windCode: r.wind_code ?? null,
    province: r.province ?? null,
    city: r.city ?? null,
    seismicCat: r.seismic_cat ?? null,
    dataSource: r.data_source ?? null,
    sourceType: r.source_type ?? null,
    sourceFileName: r.source_file_name ?? null,
    sourceFilePath: r.source_file_path ?? null,
    reviewStatus: r.review_status ?? 'pending',
    parserVersion: r.parser_version ?? null,
    rawExtraction: r.raw_extraction ?? null,
    components: r.components ?? [],
    addedBy: r.added_by ?? null,
    reviewedBy: r.reviewed_by ?? null,
    reviewedAt: r.reviewed_at ?? null,
    dateAdded: r.date_added ?? null,
    createdAt: r.created_at ?? '',
  };
}

export function steelCostDataToRow(d: Partial<SteelCostDataRecord>): Record<string, any> {
  const map: Record<string, string> = {
    id: 'id',
    storedDocumentId: 'stored_document_id',
    quoteFileId: 'quote_file_id',
    documentId: 'document_id',
    jobId: 'job_id',
    projectId: 'project_id',
    clientId: 'client_id',
    vendorId: 'vendor_id',
    structureType: 'structure_type',
    widthFt: 'width_ft',
    lengthFt: 'length_ft',
    eaveHeightFt: 'eave_height_ft',
    roofSlope: 'roof_slope',
    floorAreaSqft: 'floor_area_sqft',
    totalWeightLb: 'total_weight_lb',
    totalCost: 'total_cost',
    costPerSqft: 'cost_per_sqft',
    weightPerSqft: 'weight_per_sqft',
    pricePerLb: 'price_per_lb',
    snowLoadPsf: 'snow_load_psf',
    windLoadPsf: 'wind_load_psf',
    windCode: 'wind_code',
    province: 'province',
    city: 'city',
    seismicCat: 'seismic_cat',
    dataSource: 'data_source',
    sourceType: 'source_type',
    sourceFileName: 'source_file_name',
    sourceFilePath: 'source_file_path',
    reviewStatus: 'review_status',
    parserVersion: 'parser_version',
    rawExtraction: 'raw_extraction',
    components: 'components',
    addedBy: 'added_by',
    reviewedBy: 'reviewed_by',
    reviewedAt: 'reviewed_at',
    dateAdded: 'date_added',
  };
  const row: Record<string, any> = {};
  for (const [k, v] of Object.entries(d)) {
    if (map[k]) row[map[k]] = v;
  }
  return row;
}

// --- InsulationCostDataRecord ---
export function insulationCostDataFromRow(r: any): InsulationCostDataRecord {
  return {
    id: r.id ?? '',
    storedDocumentId: r.stored_document_id ?? null,
    quoteFileId: r.quote_file_id ?? null,
    documentId: r.document_id ?? null,
    jobId: r.job_id ?? null,
    projectId: r.project_id ?? null,
    clientId: r.client_id ?? null,
    vendorId: r.vendor_id ?? null,
    structureType: r.structure_type ?? null,
    widthFt: r.width_ft != null ? Number(r.width_ft) : null,
    lengthFt: r.length_ft != null ? Number(r.length_ft) : null,
    eaveHeightFt: r.eave_height_ft != null ? Number(r.eave_height_ft) : null,
    roofSlope: r.roof_slope != null ? Number(r.roof_slope) : null,
    floorAreaSqft: r.floor_area_sqft != null ? Number(r.floor_area_sqft) : null,
    location: r.location ?? null,
    roofRValue: r.roof_r_value ?? null,
    wallRValue: r.wall_r_value ?? null,
    grade: r.grade ?? null,
    roofAreaSqft: r.roof_area_sqft != null ? Number(r.roof_area_sqft) : null,
    wallAreaSqft: r.wall_area_sqft != null ? Number(r.wall_area_sqft) : null,
    totalInsulatedSqft: r.total_insulated_sqft != null ? Number(r.total_insulated_sqft) : null,
    materialCost: r.material_cost != null ? Number(r.material_cost) : null,
    freightCost: r.freight_cost != null ? Number(r.freight_cost) : null,
    fuelSurcharge: r.fuel_surcharge != null ? Number(r.fuel_surcharge) : null,
    totalDelivery: r.total_delivery != null ? Number(r.total_delivery) : null,
    totalCost: r.total_cost != null ? Number(r.total_cost) : null,
    materialPerSqft: r.material_per_sqft != null ? Number(r.material_per_sqft) : null,
    totalPerSqft: r.total_per_sqft != null ? Number(r.total_per_sqft) : null,
    weightLb: r.weight_lb != null ? Number(r.weight_lb) : null,
    shipBranch: r.ship_branch ?? null,
    quoteNumber: r.quote_number ?? null,
    quoteDate: r.quote_date ?? null,
    dataSource: r.data_source ?? null,
    sourceType: r.source_type ?? null,
    sourceFileName: r.source_file_name ?? null,
    sourceFilePath: r.source_file_path ?? null,
    reviewStatus: r.review_status ?? 'pending',
    parserVersion: r.parser_version ?? null,
    rawExtraction: r.raw_extraction ?? null,
    accessories: r.accessories ?? [],
    addedBy: r.added_by ?? null,
    reviewedBy: r.reviewed_by ?? null,
    reviewedAt: r.reviewed_at ?? null,
    dateAdded: r.date_added ?? null,
    createdAt: r.created_at ?? '',
  };
}

export function insulationCostDataToRow(d: Partial<InsulationCostDataRecord>): Record<string, any> {
  const map: Record<string, string> = {
    id: 'id',
    storedDocumentId: 'stored_document_id',
    quoteFileId: 'quote_file_id',
    documentId: 'document_id',
    jobId: 'job_id',
    projectId: 'project_id',
    clientId: 'client_id',
    vendorId: 'vendor_id',
    structureType: 'structure_type',
    widthFt: 'width_ft',
    lengthFt: 'length_ft',
    eaveHeightFt: 'eave_height_ft',
    roofSlope: 'roof_slope',
    floorAreaSqft: 'floor_area_sqft',
    location: 'location',
    roofRValue: 'roof_r_value',
    wallRValue: 'wall_r_value',
    grade: 'grade',
    roofAreaSqft: 'roof_area_sqft',
    wallAreaSqft: 'wall_area_sqft',
    totalInsulatedSqft: 'total_insulated_sqft',
    materialCost: 'material_cost',
    freightCost: 'freight_cost',
    fuelSurcharge: 'fuel_surcharge',
    totalDelivery: 'total_delivery',
    totalCost: 'total_cost',
    materialPerSqft: 'material_per_sqft',
    totalPerSqft: 'total_per_sqft',
    weightLb: 'weight_lb',
    shipBranch: 'ship_branch',
    quoteNumber: 'quote_number',
    quoteDate: 'quote_date',
    dataSource: 'data_source',
    sourceType: 'source_type',
    sourceFileName: 'source_file_name',
    sourceFilePath: 'source_file_path',
    reviewStatus: 'review_status',
    parserVersion: 'parser_version',
    rawExtraction: 'raw_extraction',
    accessories: 'accessories',
    addedBy: 'added_by',
    reviewedBy: 'reviewed_by',
    reviewedAt: 'reviewed_at',
    dateAdded: 'date_added',
  };
  const row: Record<string, any> = {};
  for (const [k, v] of Object.entries(d)) {
    if (map[k]) row[map[k]] = v;
  }
  return row;
}

export function opportunityFromRow(r: any): Opportunity {
  return {
    id: r.id ?? '',
    jobId: r.job_id ?? '',
    clientId: r.client_id ?? '',
    clientName: r.client_name ?? '',
    name: r.name ?? '',
    potentialRevenue: Number(r.potential_revenue) || 0,
    status: r.status ?? 'open',
    createdByUserId: r.created_by_user_id ?? null,
    ownerUserId: r.owner_user_id ?? null,
    salesRep: r.sales_rep ?? null,
    estimator: r.estimator ?? null,
    source: r.source ?? 'manual',
    createdAt: r.created_at ?? '',
    updatedAt: r.updated_at ?? '',
  };
}

export function opportunityToRow(opportunity: Partial<Opportunity>): Record<string, any> {
  const map: Record<string, string> = {
    id: 'id',
    jobId: 'job_id',
    clientId: 'client_id',
    clientName: 'client_name',
    name: 'name',
    potentialRevenue: 'potential_revenue',
    status: 'status',
    createdByUserId: 'created_by_user_id',
    ownerUserId: 'owner_user_id',
    salesRep: 'sales_rep',
    estimator: 'estimator',
    source: 'source',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  };
  const row: Record<string, any> = {};
  for (const [k, v] of Object.entries(opportunity)) {
    if (map[k]) row[map[k]] = v;
  }
  return row;
}

export function dealMilestoneFromRow(r: any): DealMilestone {
  return {
    id: r.id ?? '',
    jobId: r.job_id ?? '',
    milestoneKey: r.milestone_key ?? 'order_form_sent',
    isComplete: r.is_complete ?? false,
    completedAt: r.completed_at ?? null,
    completedByUserId: r.completed_by_user_id ?? null,
    notes: r.notes ?? '',
    createdAt: r.created_at ?? '',
    updatedAt: r.updated_at ?? '',
  };
}

export function dealMilestoneToRow(milestone: Partial<DealMilestone>): Record<string, any> {
  const map: Record<string, string> = {
    id: 'id',
    jobId: 'job_id',
    milestoneKey: 'milestone_key',
    isComplete: 'is_complete',
    completedAt: 'completed_at',
    completedByUserId: 'completed_by_user_id',
    notes: 'notes',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  };
  const row: Record<string, any> = {};
  for (const [k, v] of Object.entries(milestone)) {
    if (map[k]) row[map[k]] = v;
  }
  return row;
}
