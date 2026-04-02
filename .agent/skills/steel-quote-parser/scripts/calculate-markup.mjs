#!/usr/bin/env node
/**
 * calculate-markup.mjs
 * Canada Steel Buildings — Internal Markup Calculator
 *
 * Computes contingency and all standard markup tiers from a factory quote total.
 * Outputs structured JSON for use by the AI agent or manual inspection.
 *
 * Usage:
 *   node scripts/calculate-markup.mjs --total 168693.46 --area 9600
 *   node scripts/calculate-markup.mjs --total 168693.46 --area 9600 --contingency 10
 *   node scripts/calculate-markup.mjs --total 168693.46 --area 9600 --contingency 12 --target-margin 22
 *   node scripts/calculate-markup.mjs --help
 *
 * Options:
 *   --total           Combined total internal cost from the quote (required)
 *   --area            Total building area in sq ft (required)
 *   --contingency     Contingency rate as a percentage, default: 10
 *   --target-margin   Highlight a specific margin tier in output (optional)
 *   --format          Output format: "json" (default) or "table"
 *   --help            Show usage
 */

import { parseArgs } from 'node:util';

// ─── Standard markup tiers (gross margin %) ──────────────────────────────────
const STANDARD_TIERS = [18, 20, 22, 25, 28, 30];

// ─── Argument parsing ─────────────────────────────────────────────────────────
function showHelp() {
  console.log(`
Canada Steel Buildings — Markup Calculator
==========================================

Usage:
  node scripts/calculate-markup.mjs --total <number> --area <number> [options]

Required:
  --total           Combined total internal cost from the factory quote (e.g. 168693.46)
  --area            Total building area in sq ft (e.g. 9600)

Optional:
  --contingency     Contingency rate as a whole number percentage (default: 10)
  --target-margin   Highlight a specific margin tier, e.g. 22 for 22%
  --format          Output format: "json" (default) or "table"
  --help            Show this help message

Examples:
  node scripts/calculate-markup.mjs --total 168693.46 --area 9600
  node scripts/calculate-markup.mjs --total 168693.46 --area 9600 --contingency 12
  node scripts/calculate-markup.mjs --total 168693.46 --area 9600 --target-margin 22 --format table
`);
  process.exit(0);
}

function parseArguments() {
  const { values } = parseArgs({
    options: {
      total:           { type: 'string' },
      area:            { type: 'string' },
      contingency:     { type: 'string', default: '10' },
      'target-margin': { type: 'string' },
      format:          { type: 'string', default: 'json' },
      help:            { type: 'boolean', default: false },
    },
    allowPositionals: false,
  });

  if (values.help) showHelp();

  if (!values.total || !values.area) {
    console.error('Error: --total and --area are required.\nRun with --help for usage.');
    process.exit(1);
  }

  const total = parseFloat(values.total.replace(/,/g, ''));
  const area  = parseFloat(values.area.replace(/,/g, ''));
  const contingencyRate = parseFloat(values.contingency) / 100;
  const targetMargin = values['target-margin'] ? parseFloat(values['target-margin']) : null;
  const format = values.format.toLowerCase();

  if (isNaN(total) || total <= 0) {
    console.error('Error: --total must be a positive number.');
    process.exit(1);
  }
  if (isNaN(area) || area <= 0) {
    console.error('Error: --area must be a positive number.');
    process.exit(1);
  }
  if (isNaN(contingencyRate) || contingencyRate < 0 || contingencyRate > 1) {
    console.error('Error: --contingency must be a number between 0 and 100.');
    process.exit(1);
  }

  return { total, area, contingencyRate, targetMargin, format };
}

// ─── Core calculations ────────────────────────────────────────────────────────

/**
 * Round a number to N decimal places (avoids floating-point drift).
 */
function round(value, decimals = 2) {
  return Math.round(value * 10 ** decimals) / 10 ** decimals;
}

/**
 * Format a number as a currency string.
 */
function formatCurrency(value) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Calculate a single markup tier.
 * Sell price is derived from gross margin: Sell Price = Cost ÷ (1 − margin%)
 */
function calcTier(costBase, area, marginPct) {
  const marginDecimal = marginPct / 100;
  const sellPrice    = round(costBase / (1 - marginDecimal), 2);
  const grossProfit  = round(sellPrice - costBase, 2);
  const grossMargin  = round((grossProfit / sellPrice) * 100, 4); // keep 4 dp for verification
  const sqftPrice    = round(sellPrice / area, 2);

  return {
    markup_pct:    marginPct,
    sell_price:    sellPrice,
    gross_profit:  grossProfit,
    gross_margin_pct: grossMargin,
    sqft_price:    sqftPrice,
  };
}

/**
 * Main calculation function.
 */
function calculate({ total, area, contingencyRate, targetMargin }) {
  const contingencyAmount    = round(total * contingencyRate, 2);
  const totalWithContingency = round(total + contingencyAmount, 2);
  const baseCostPerSqft      = round(total / area, 2);
  const contingencyPct       = round(contingencyRate * 100, 2);

  // Flag unusual steel weight per sqft — not calculable here without weight,
  // but included as a reminder field in output schema
  const tiers = STANDARD_TIERS.map((pct) => {
    const tier = calcTier(totalWithContingency, area, pct);
    tier.is_target = targetMargin !== null && pct === targetMargin;
    return tier;
  });

  return {
    input: {
      combined_total:      total,
      area_sqft:           area,
      contingency_rate_pct: contingencyPct,
      target_margin_pct:   targetMargin,
    },
    contingency: {
      rate_pct:   contingencyPct,
      amount:     contingencyAmount,
    },
    cost_base: {
      total_with_contingency: totalWithContingency,
      cost_per_sqft:          baseCostPerSqft,
    },
    markup_tiers: tiers,
    meta: {
      generated_at: new Date().toISOString(),
      note: 'Sell prices derived from gross margin back-calculation: Sell Price = Cost ÷ (1 − Margin%). Standard tiers: 18, 20, 22, 25, 28, 30%.',
    },
  };
}

// ─── Output formatters ────────────────────────────────────────────────────────

function printJSON(result) {
  console.log(JSON.stringify(result, null, 2));
}

function printTable(result) {
  const { input, contingency, cost_base, markup_tiers } = result;

  console.log('\n════════════════════════════════════════════════════════════');
  console.log('  CANADA STEEL BUILDINGS — Internal Markup Calculator');
  console.log('════════════════════════════════════════════════════════════');
  console.log(`  Combined total:            ${formatCurrency(input.combined_total)}`);
  console.log(`  Building area:             ${input.area_sqft.toLocaleString('en-CA')} sq ft`);
  console.log(`  Base cost/sqft:            ${formatCurrency(cost_base.cost_per_sqft)}/sq ft`);
  console.log('────────────────────────────────────────────────────────────');
  console.log(`  Contingency (${contingency.rate_pct}%):              ${formatCurrency(contingency.amount)}`);
  console.log(`  Cost floor (with cont.):   ${formatCurrency(cost_base.total_with_contingency)}`);
  console.log('════════════════════════════════════════════════════════════');
  console.log('\n  MARKUP OPTIONS\n');
  console.log('  ┌──────────┬────────────────┬────────────────┬─────────┬───────────┐');
  console.log('  │ Margin % │ Sell Price     │ Gross Profit   │ Margin  │ $/sq ft   │');
  console.log('  ├──────────┼────────────────┼────────────────┼─────────┼───────────┤');

  for (const tier of markup_tiers) {
    const marker   = tier.is_target ? ' ◄' : '  ';
    const pct      = `${tier.markup_pct}%`.padEnd(8);
    const sell     = formatCurrency(tier.sell_price).padEnd(14);
    const profit   = formatCurrency(tier.gross_profit).padEnd(14);
    const margin   = `${tier.gross_margin_pct.toFixed(2)}%`.padEnd(7);
    const sqft     = formatCurrency(tier.sqft_price).padEnd(9);
    console.log(`  │ ${pct} │ ${sell} │ ${profit} │ ${margin} │ ${sqft} │${marker}`);
  }

  console.log('  └──────────┴────────────────┴────────────────┴─────────┴───────────┘');

  if (input.target_margin_pct !== null) {
    console.log(`\n  ◄ = Target margin (${input.target_margin_pct}%)`);
  }

  console.log('\n  NOTE: Do not share sell prices with the client in writing without rep approval.');
  console.log(`  Generated: ${new Date().toLocaleString('en-CA', { timeZone: 'America/Toronto' })}\n`);
}

// ─── Entry point ──────────────────────────────────────────────────────────────

const args   = parseArguments();
const result = calculate(args);

if (args.format === 'table') {
  printTable(result);
} else {
  printJSON(result);
}
