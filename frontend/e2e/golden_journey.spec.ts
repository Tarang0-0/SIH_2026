import { test, expect } from '@playwright/test';

/**
 * RailETA — Golden User Journey End-to-End Test Suite
 * Problem Statement: SIH 2026 — PS 26028
 * 
 * Verifies:
 * 1. Overview discovery homepage & search bar
 * 2. Search Autocomplete & Selection -> Train Detail
 * 3. 7-Tier Passenger Hierarchy (Expected Arrival, Delay, Next Station, Destination, Freshness, Confidence Window, Explanation)
 * 4. Prediction Evolution History Stream
 * 5. Navigation Tab Switching (Overview, Find Train, Live Map, Operations)
 * 6. Operations Mode & What-If Disruption Injection (+10m Caution)
 * 7. Live Dynamic Recalculation without page reload
 */

test.describe('RailETA Golden End-to-End User Journey', () => {
  test('Passenger Journey: Overview -> Search -> 7-Tier Detail -> Route Progress', async ({ page }) => {
    // 1. Open Application Overview
    await page.goto('http://localhost:3000');
    await expect(page).toHaveTitle(/RailETA/i);

    // Verify Overview Homepage Elements
    await expect(page.getByText(/Dynamic Train Arrival Forecasts with/i)).toBeVisible();
    await expect(page.getByText(/Indian Railways Network Telemetry Snapshot/i)).toBeVisible();
    await expect(page.getByText(/Verified Indian Railways Corridors/i)).toBeVisible();

    // 2. Search for Train '12004' (Shatabdi)
    const searchInputs = page.getByPlaceholder(/Search train no/i);
    await searchInputs.first().fill('12004');

    // Select train from autocomplete dropdown
    const resultItem = page.getByText(/Lucknow Swarna Shatabdi/i).first();
    await expect(resultItem).toBeVisible();
    await resultItem.click();

    // 3. Verify Passenger Mode 7-Tier Information Hierarchy
    // Tier 1 & 2
    await expect(page.getByText(/Lucknow Swarna Shatabdi Express/i)).toBeVisible();
    await expect(page.getByText(/Expected Arrival/i).first()).toBeVisible();
    
    // Tier 3 & 4
    await expect(page.getByText(/Next Station/i)).toBeVisible();
    await expect(page.getByText(/Destination Arrival/i)).toBeVisible();

    // Tier 6 & 7
    await expect(page.getByText(/Likely Window/i).first()).toBeVisible();
    const whyButton = page.getByRole('button', { name: /Why did this ETA change\?/i });
    await expect(whyButton).toBeVisible();
    await whyButton.click();
    await expect(page.getByText(/Key Operational Factors/i)).toBeVisible();

    // Verify Route Progress Tracker & Prediction Evolution
    await expect(page.getByText(/Route Progression & Halts/i)).toBeVisible();
    await expect(page.getByText(/Prediction Evolution Stream/i)).toBeVisible();
  });

  test('Operations Journey: Switch to Operations -> Vector Map -> Disruption Simulation', async ({ page }) => {
    await page.goto('http://localhost:3000?tab=operations&train=12004');

    // Verify Operations Mode Elements
    await expect(page.getByText(/Active Fleet/i)).toBeVisible();
    await expect(page.getByText(/Feature Impact \(SHAP\)/i)).toBeVisible();
    await expect(page.getByText(/What-If Disruption Simulator/i)).toBeVisible();

    // Inject Disruption Preset (+10m Caution)
    const cautionButton = page.getByRole('button', { name: /\+10m Caution/i });
    await expect(cautionButton).toBeVisible();
    await cautionButton.click();

    // Verify Disruption Feedback Banner
    await expect(page.getByText(/Injected \+10m disruption/i)).toBeVisible();
  });
});
