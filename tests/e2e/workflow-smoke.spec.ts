import { expect, test, type Page } from '../../playwright-fixture';

const INTERNAL_EMAIL = process.env.SMOKE_INTERNAL_EMAIL;
const INTERNAL_PASSWORD = process.env.SMOKE_INTERNAL_PASSWORD;
const DEALER_EMAIL = process.env.SMOKE_DEALER_EMAIL;
const DEALER_PASSWORD = process.env.SMOKE_DEALER_PASSWORD;
const RFQ_ASSIGNEE = process.env.SMOKE_RFQ_ASSIGNEE;
const OPPORTUNITY_OWNER = process.env.SMOKE_OPPORTUNITY_OWNER;
const OPPORTUNITY_ESTIMATOR = process.env.SMOKE_OPPORTUNITY_ESTIMATOR;
const SMOKE_JOB_ID = process.env.SMOKE_JOB_ID;
const SMOKE_MBS_FILE_NAME = process.env.SMOKE_MBS_FILE_NAME;
const SMOKE_INSULATION_FILE_NAME = process.env.SMOKE_INSULATION_FILE_NAME;
const SMOKE_EXPECTED_JOB_ID = process.env.SMOKE_EXPECTED_JOB_ID;
const SMOKE_EXPECTED_CITY = process.env.SMOKE_EXPECTED_CITY;
const SMOKE_EXPECTED_POSTAL_CODE = process.env.SMOKE_EXPECTED_POSTAL_CODE;
const DEALER_SEARCH_JOB_ID = process.env.SMOKE_DEALER_JOB_ID || SMOKE_JOB_ID;

function hasInternalCreds() {
  return Boolean(INTERNAL_EMAIL && INTERNAL_PASSWORD);
}

function hasDealerCreds() {
  return Boolean(DEALER_EMAIL && DEALER_PASSWORD);
}

function attachPageErrorTracker(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', error => {
    errors.push(error.message);
  });
  return errors;
}

async function signIn(page: Page, portal: 'internal' | 'dealer', email: string, password: string) {
  await page.goto('/');
  await page.waitForURL(/\/auth/);
  await expect(page.getByTestId('auth-page')).toBeVisible();
  await page.getByTestId(`auth-portal-${portal}`).click();
  await page.locator('#signin-email').fill(email);
  await page.locator('#signin-password').fill(password);
  await page.getByTestId('auth-signin-submit').click();
  await page.waitForLoadState('networkidle');
  await expect(page).not.toHaveURL(/\/auth/);
}

async function openSelectOption(page: Page, triggerTestId: string, optionLabel: string) {
  await page.getByTestId(triggerTestId).click();
  await page.getByRole('option', { name: optionLabel }).click();
}

async function pullHistoricalFile(page: Page, fileName: string) {
  await page.getByTestId('document-gallery-all-recent').click();
  const fileCard = page.locator('[data-testid^="document-gallery-file-"]').filter({ hasText: fileName }).first();
  await expect(fileCard).toBeVisible();
  await fileCard.getByRole('button', { name: 'Pull Data' }).click();
}

test.describe('workflow smoke', () => {
  test('redirects unauthenticated users to auth without runtime errors', async ({ page }) => {
    const pageErrors = attachPageErrorTracker(page);

    await page.goto('/');
    await page.waitForURL(/\/auth/);
    await expect(page.getByTestId('auth-page')).toBeVisible();
    await expect(page.locator('#signin-email')).toBeHidden();

    await page.getByTestId('auth-portal-internal').click();
    await expect(page.locator('#signin-email')).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test.describe('internal account smoke', () => {
    test.skip(!hasInternalCreds(), 'Set SMOKE_INTERNAL_EMAIL and SMOKE_INTERNAL_PASSWORD to run internal smoke tests.');

    test('renders RFQ workspace, opportunities, deals, production, and freight views', async ({ page }) => {
      const pageErrors = attachPageErrorTracker(page);

      await signIn(page, 'internal', INTERNAL_EMAIL!, INTERNAL_PASSWORD!);

      await page.goto('/quote-log?view=log');
      await expect(page.getByTestId('quote-log-page')).toBeVisible();
      await expect(page.getByTestId('quote-log-page')).toHaveAttribute('data-workspace-view', 'log');

      await page.goto('/quote-log?view=pipeline');
      await expect(page.getByTestId('quote-log-page')).toHaveAttribute('data-workspace-view', 'pipeline');

      const assigneeFilter = page.getByTestId('quote-log-assignee-filter');
      if (await assigneeFilter.isVisible() && RFQ_ASSIGNEE) {
        await openSelectOption(page, 'quote-log-assignee-filter', RFQ_ASSIGNEE);
        await expect(assigneeFilter).toContainText(RFQ_ASSIGNEE);
      }

      await page.goto('/opportunities');
      await expect(page.getByTestId('opportunities-page')).toBeVisible();
      if (OPPORTUNITY_OWNER) {
        await openSelectOption(page, 'opportunities-owner-filter', OPPORTUNITY_OWNER);
        await expect(page.getByTestId('opportunities-owner-filter')).toContainText(OPPORTUNITY_OWNER);
      }
      if (OPPORTUNITY_ESTIMATOR) {
        await openSelectOption(page, 'opportunities-estimator-filter', OPPORTUNITY_ESTIMATOR);
        await expect(page.getByTestId('opportunities-estimator-filter')).toContainText(OPPORTUNITY_ESTIMATOR);
      }

      await page.goto(SMOKE_JOB_ID ? `/deals?jobId=${encodeURIComponent(SMOKE_JOB_ID)}` : '/deals');
      await expect(page.getByTestId('master-deals-page')).toBeVisible();

      await page.goto('/production');
      await expect(page.getByTestId('production-status-page')).toBeVisible();
      if (SMOKE_JOB_ID) {
        await expect(page.getByText(SMOKE_JOB_ID, { exact: false }).first()).toBeVisible();
      }

      await page.goto(SMOKE_JOB_ID ? `/freight?freightMode=execution&freightJobId=${encodeURIComponent(SMOKE_JOB_ID)}` : '/freight');
      await expect(page.getByTestId('freight-board-page')).toBeVisible();

      expect(pageErrors).toEqual([]);
    });

    test('hydrates historical quote data when known file names are configured', async ({ page }) => {
      test.skip(!SMOKE_MBS_FILE_NAME || !SMOKE_INSULATION_FILE_NAME, 'Set SMOKE_MBS_FILE_NAME and SMOKE_INSULATION_FILE_NAME for historical hydration checks.');

      await signIn(page, 'internal', INTERNAL_EMAIL!, INTERNAL_PASSWORD!);
      await page.goto('/internal-quote-builder');
      await expect(page.getByTestId('internal-quote-builder-page')).toBeVisible();

      await pullHistoricalFile(page, SMOKE_MBS_FILE_NAME!);

      if (SMOKE_EXPECTED_JOB_ID) {
        await expect(page.getByTestId('internal-quote-job-id')).toContainText(SMOKE_EXPECTED_JOB_ID);
      }
      if (SMOKE_EXPECTED_POSTAL_CODE) {
        await expect(page.getByTestId('internal-quote-postal-code')).toHaveValue(SMOKE_EXPECTED_POSTAL_CODE);
      }
      if (SMOKE_EXPECTED_CITY) {
        await expect(page.getByTestId('internal-quote-city')).toHaveValue(SMOKE_EXPECTED_CITY);
      }
      await expect(page.getByTestId('internal-quote-weight')).not.toHaveValue('');
      await expect(page.getByTestId('internal-quote-cost-per-lb')).not.toHaveValue('');
      await expect(page.getByTestId('internal-quote-total-cost')).not.toHaveValue('');

      await pullHistoricalFile(page, SMOKE_INSULATION_FILE_NAME!);
      await expect(page.getByTestId('internal-quote-total-cost')).not.toHaveValue('');
    });
  });

  test.describe('dealer account smoke', () => {
    test.skip(!hasDealerCreds(), 'Set SMOKE_DEALER_EMAIL and SMOKE_DEALER_PASSWORD to run dealer smoke tests.');

    test('renders dealer workspace with dealer-safe project visibility', async ({ page }) => {
      const pageErrors = attachPageErrorTracker(page);

      await signIn(page, 'dealer', DEALER_EMAIL!, DEALER_PASSWORD!);
      await page.goto(DEALER_SEARCH_JOB_ID ? `/dealer-log?search=${encodeURIComponent(DEALER_SEARCH_JOB_ID)}` : '/dealer-log');
      await expect(page.getByTestId('dealer-log-page')).toBeVisible();
      await expect(page.getByTestId('dealer-view-cards')).toBeVisible();
      await expect(page.getByTestId('dealer-view-table')).toBeVisible();

      if (DEALER_SEARCH_JOB_ID) {
        await expect(page.getByTestId(`dealer-workspace-${DEALER_SEARCH_JOB_ID}`).first()).toBeVisible();
      }

      await expect(page.locator('text=Cost files')).toHaveCount(0);
      expect(pageErrors).toEqual([]);
    });
  });
});
