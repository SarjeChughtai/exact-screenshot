import { describe, expect, it } from 'vitest';
import { parseMbsQuotePages, parseSilvercoteQuotePages } from '@/lib/pdfParsers';

describe('pdfParsers', () => {
  it('extracts steel quote summary data from MBS layout', () => {
    const pages = [
      'JOB :1110  FILE:Cost.out',
      '2026-03-23 Page 1 Cost.out BUILDING WEIGHT & PRICE SUMMARY FOR Harley Earl 32849489 High River, AB, T1V 1N2 1110 BUILDING LAYOUT Width (ft)= 40.0 Length (ft)= 60.0 Eave Height (ft)= 16.0/ 16.0 Roof Slope (rise/12 )= 2.00/ 2.00 Snow Load (psf )= 23.8 Wind Load 1:50 (psf )= 13.6 Wind Code = ABBC 23 (NBC 20) Seismic Category = 2',
      'BUILDING WEIGHT & PRICE SUMMARY VERSION: 1.00 Description Weight(lb) Price Rigid Frames & Endwall Frames 5025.9 9423.57 Door Jambs & Headers 787.7 1181.57 Purlins, Girts & Eave Struts 8029.7 12044.65 Roof & Wall Sheeting 10391.9 22083.36 Total: 27236.6 59076.74 PRICE PER WEIGHT(lb) 2.17 PRICE PER FLOOR AREA(ft2) 24.62 WEIGHT PER FLOOR AREA(ft2) 11.35',
    ];

    const parsed = parseMbsQuotePages(pages);
    expect(parsed).not.toBeNull();
    expect(parsed?.projectId).toBe('1110');
    expect(parsed?.clientName).toContain('Harley Earl');
    expect(parsed?.widthFt).toBe(40);
    expect(parsed?.lengthFt).toBe(60);
    expect(parsed?.totalWeightLb).toBeCloseTo(27236.6);
    expect(parsed?.totalCost).toBeCloseTo(59076.74);
    expect(parsed?.pricePerLb).toBeCloseTo(2.17);
    expect(parsed?.costPerSqft).toBeCloseTo(24.62);
  });

  it('extracts insulation quote summary data from Silvercote layout', () => {
    const pages = [
      'Page 1 of 2 QUOTATION CUSTOMER INFORMATION: PROJECT INFORMATION: CANADA STEEL BUILDINGS-SC 301 CHRISLEA RD WOODBRIDGE, ON L4L 8N4 High River, AB T1V 1N2 CONFIGURED BUILDING SECTION 1110: 40 ft W X 60 ft L X 16 ft H DS: 2:12 QUANTITY: ROOF MATERIAL: 6" R-20 - Faced Blanket - Canada w/PSKP 50 w/1-6 in Seal Tab(s) Right Handed 2604 sf WALLS MATERIAL: 6" R-20 - Faced Blanket - Canada w/PSKP 50 w/1-6 in Seal Tab(s) Right Handed *See Diagram Page for Wall Deduction Information (if applicable) 3662 sf BUILDING ACCESSORIES: QUANTITY: 25\' EAVE STRUT KIT ECOSE 1110 5 RL CHARGES AND DISCOUNTS DESCRIPTION: VALUE: Freight $450.00 Fuel Surcharge $190.05 Quote Date: 03/24/2026 Quote #: SQACHYN000069- 1 Shipping Branch: Calgary, AB (M32)',
      'TOTAL (CAD): $13,310.28 Total Weight: 2267.98 Truckloads: 0.21',
    ];

    const parsed = parseSilvercoteQuotePages(pages);
    expect(parsed).not.toBeNull();
    expect(parsed?.projectId).toBe('1110');
    expect(parsed?.widthFt).toBe(40);
    expect(parsed?.lengthFt).toBe(60);
    expect(parsed?.roofSlope).toBe(2);
    expect(parsed?.roofAreaSqft).toBe(2604);
    expect(parsed?.wallAreaSqft).toBe(3662);
    expect(parsed?.freightCost).toBe(450);
    expect(parsed?.fuelSurcharge).toBeCloseTo(190.05);
    expect(parsed?.totalCost).toBeCloseTo(13310.28);
    expect(parsed?.quoteNumber).toBe('SQACHYN000069-1');
  });
});
