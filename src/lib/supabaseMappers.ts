import type { Quote, Deal, InternalCost, PaymentEntry, ProductionRecord, FreightRecord, Client, Vendor } from '@/types';

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
    contingencyPct: 'contingency_pct', contingency: 'contingency', gstHst: 'gst_hst',
    qst: 'qst', grandTotal: 'grand_total', status: 'status',
    leftEaveHeight: 'left_eave_height', rightEaveHeight: 'right_eave_height', isSingleSlope: 'is_single_slope', pitch: 'pitch',
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
    amountExclTax: Number(r.amount_excl_tax) || 0,
    province: r.province ?? '',
    taxRate: Number(r.tax_rate) || 0,
    taxAmount: Number(r.tax_amount) || 0,
    totalInclTax: Number(r.total_incl_tax) || 0,
    taxOverride: r.tax_override ?? false,
    taxOverrideRate: r.tax_override_rate != null ? Number(r.tax_override_rate) : undefined,
    vendorProvinceOverride: r.vendor_province_override ?? undefined,
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
    direction: 'direction', type: 'type', amountExclTax: 'amount_excl_tax', province: 'province',
    taxRate: 'tax_rate', taxAmount: 'tax_amount', totalInclTax: 'total_incl_tax',
    taxOverride: 'tax_override', taxOverrideRate: 'tax_override_rate',
    vendorProvinceOverride: 'vendor_province_override',
    paymentMethod: 'payment_method', referenceNumber: 'reference_number',
    qbSynced: 'qb_synced', notes: 'notes',
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
    name: r.name ?? '',
    contactEmail: r.contact_email ?? '',
    contactPhone: r.contact_phone ?? '',
    notes: r.notes ?? '',
    createdAt: r.created_at ?? '',
  };
}

export function clientToRow(c: Partial<Client>): Record<string, any> {
  const map: Record<string, string> = {
    id: 'id', name: 'name', contactEmail: 'contact_email',
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
  };
}

export function productionToRow(pr: Partial<ProductionRecord>): Record<string, any> {
  const map: Record<string, string> = {
    jobId: 'job_id', submitted: 'submitted', acknowledged: 'acknowledged',
    inProduction: 'in_production', qcComplete: 'qc_complete', shipReady: 'ship_ready',
    shipped: 'shipped', delivered: 'delivered', drawingsStatus: 'drawings_status',
    insulationStatus: 'insulation_status',
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
    weight: Number(r.weight) || 0,
    pickupAddress: r.pickup_address ?? '',
    deliveryAddress: r.delivery_address ?? '',
    estDistance: Number(r.est_distance) || 0,
    estFreight: Number(r.est_freight) || 0,
    actualFreight: Number(r.actual_freight) || 0,
    paid: r.paid ?? false,
    carrier: r.carrier ?? '',
    status: r.status ?? 'Pending',
  };
}

export function freightToRow(fr: Partial<FreightRecord>): Record<string, any> {
  const map: Record<string, string> = {
    jobId: 'job_id', clientName: 'client_name', buildingSize: 'building_size',
    weight: 'weight', pickupAddress: 'pickup_address', deliveryAddress: 'delivery_address',
    estDistance: 'est_distance', estFreight: 'est_freight', actualFreight: 'actual_freight',
    paid: 'paid', carrier: 'carrier', status: 'status',
  };
  const row: Record<string, any> = {};
  for (const [k, v] of Object.entries(fr)) {
    if (map[k]) row[map[k]] = v;
  }
  return row;
}
