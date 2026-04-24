export function visibleEmail(page) {
  return page.locator('input[type="email"]:visible, input[name="username"]:visible, input[name="loginName"]:visible').first();
}

export function visiblePassword(page) {
  return page.locator('input[type="password"]:visible').first();
}

export async function completePortalOidc(page, { baseUrl, email, password, timeoutMs = 120000 }) {
  const startedAt = Date.now();
  for (let i = 0; i < 20; i += 1) {
    if (page.url().startsWith(baseUrl) && !page.url().includes("auth.localhost")) {
      return;
    }

    if (page.url().includes("auth.localhost")) {
      if (await visibleEmail(page).count().catch(() => 0)) {
        try {
          await visibleEmail(page).fill(email, { timeout: 4000 });
          await Promise.allSettled([
            page.waitForLoadState("domcontentloaded", { timeout: 15000 }),
            page.locator('button[type="submit"]:visible').first().click(),
          ]);
          await page.waitForTimeout(1200);
        } catch (error) {
          if (page.url().startsWith(baseUrl) && !page.url().includes("auth.localhost")) {
            return;
          }
          throw error;
        }
        continue;
      }

      if (await visiblePassword(page).count().catch(() => 0)) {
        try {
          await visiblePassword(page).fill(password, { timeout: 4000 });
          await Promise.allSettled([
            page.waitForLoadState("domcontentloaded", { timeout: 15000 }),
            page.locator('button[type="submit"]:visible').first().click(),
          ]);
          await page.waitForTimeout(1800);
        } catch (error) {
          if (page.url().startsWith(baseUrl) && !page.url().includes("auth.localhost")) {
            return;
          }
          throw error;
        }
        continue;
      }
    }

    if (Date.now() - startedAt > timeoutMs) {
      break;
    }
    await page.waitForTimeout(1000);
  }

  throw new Error(`Portal OIDC login did not complete: ${page.url()}`);
}

export async function loginPortalOidc(page, { baseUrl, email, password, timeoutMs = 120000 }) {
  await page.goto(`${baseUrl}/login`, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.locator('a[href="/auth/oidc/login"]').click();
  await completePortalOidc(page, { baseUrl, email, password, timeoutMs });
}
