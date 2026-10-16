import { test, expect } from '@playwright/test';
test('practice is local, tie aware, editable, exportable, and display controls are reversible', async ({ page }) => {
  const apiCalls: string[] = []; page.on('request', req => { if (req.url().includes('/api/scoreboard')) apiCalls.push(req.url()); });
  await page.goto('/'); await page.getByRole('button', { name: 'Open practice table' }).click();
  await expect(page.getByRole('heading', { name: 'A friendly first round.' })).toBeVisible();
  await expect(page.getByText('2 people tied for the lead at 8 pieces.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add one sushi to Alex', exact: true }).click();
  await expect(page.getByText('Alex leads with 9 pieces.', { exact: true })).toBeVisible();
  await page.getByLabel('Practice nickname').fill('Morgan');
  await page.getByRole('button', { name: 'Add practice player', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Subtract one sushi from Morgan', exact: true })).toBeDisabled();
  const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download standings' }).click();
  const download = await downloaded; expect(download.suggestedFilename()).toBe('sushi-practice-standings.csv');
  const stream = await download.createReadStream(); const chunks: Buffer[] = []; for await (const chunk of stream!) chunks.push(chunk);
  expect(Buffer.concat(chunks).toString()).toContain('"Morgan","0"');
  await page.getByRole('button', { name: 'Table display', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add one sushi to Alex', exact: true })).toHaveCount(0);
  await page.screenshot({ path: 'test-results/table-display.png', fullPage: true });
  await page.getByRole('button', { name: 'Return to controls' }).click();
  await page.getByRole('button', { name: 'Reset practice table' }).click();
  await expect(page.getByText('2 people tied for the lead at 8 pieces.', { exact: true })).toBeVisible();
  expect(apiCalls).toEqual([]);
});
test('practice works at 320px and rejects duplicates without losing scores', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 }); await page.goto('/?practice=1');
  await page.getByLabel('Practice nickname').fill('Alex'); await page.getByRole('button', { name: 'Add practice player', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('already at this practice table');
  expect(await page.locator('.participants li').count()).toBe(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/practice-mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Real rooms' }).click(); await expect(page.getByRole('heading', { name: 'Host a competition' })).toBeVisible();
});
const person = { id: '11111111-1111-4111-8111-111111111111', name: 'Test player', count: 4, version: 1, created_at: 1, claimable: false };
const snapshot = { participants: [person], emotes: [], serverTime: 1, room: { code: 'ABC234' }, role: 'participant', participantId: person.id };
test('polling read started before a save cannot erase the saved identity', async ({ page }) => {
  let reads = 0; let oldRead: (() => Promise<void>) | undefined;
  await page.route('**/api/scoreboard**', async route => {
    if (route.request().method() === 'POST') return route.fulfill({ json: { ...snapshot, participants: [{ ...person, count: 5, version: 2 }] } });
    reads++;
    if (reads === 2) { oldRead = () => route.fulfill({ json: { ...snapshot, role: 'spectator', participantId: null } }); return; }
    return route.fulfill({ json: snapshot });
  });
  await page.goto('/?room=ABC234'); await expect(page.getByRole('button', { name: 'Add one sushi to Test player' })).toBeVisible();
  await expect.poll(() => Boolean(oldRead)).toBe(true);
  await page.getByRole('button', { name: 'Add one sushi to Test player' }).click();
  await expect(page.getByLabel('5 sushi', { exact: true })).toBeVisible();
  await oldRead!();
  await expect(page.getByRole('button', { name: 'Add one sushi to Test player' })).toBeVisible();
  await expect(page.getByText('Pick your profile', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Table display', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add one sushi to Test player' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Return to controls' }).click();
  await expect(page.getByRole('button', { name: 'Add one sushi to Test player' })).toBeVisible();
});
