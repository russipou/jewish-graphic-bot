import { expect, test } from "@playwright/test";

test("generates an image for a design request", async ({ page }) => {
  await page.goto("/");

  // Starter deployments gate the chat behind EVE_CHAT_PASSWORD: a "Sign in"
  // button in the header opens a dialog with the password form. Local dev
  // mode has no gate, so only log in if the button shows up. Scoped to the
  // main region: the sidebar renders a second "Sign in" button, and an
  // unscoped locator dies on a strict-mode violation.
  const signInButton = page.getByRole("main").getByRole("button", { name: "Sign in" });
  const appeared = await signInButton
    .waitFor({ state: "visible", timeout: 5_000 })
    .then(() => true)
    .catch(() => false);

  if (appeared) {
    const password = process.env.EVE_CHAT_PASSWORD;
    if (!password) {
      throw new Error("EVE_CHAT_PASSWORD is required to pass the login screen.");
    }

    await signInButton.click();
    await page.locator("#eve-chat-password").fill(password);
    await page.getByRole("button", { name: "Continue" }).click();

    // Successful login reloads the page via window.location.assign. These
    // auto-retrying assertions survive the navigation: the dialog is gone
    // and the header no longer offers "Sign in" once the session cookie
    // is active.
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 20_000 });
    await expect(signInButton).toBeHidden({ timeout: 20_000 });
  }

  const composerInput = page.locator("[data-chat-composer-input]");
  await expect(composerInput).toBeVisible({ timeout: 15_000 });
  await expect(composerInput).toBeEnabled({ timeout: 15_000 });
  await composerInput.fill("create a Chanukah flyer");
  await page.getByRole("button", { name: "Send message" }).click();

  // The sent message must show up in the transcript; if it doesn't, the
  // submission itself failed and the image wait would be misleading.
  await expect(page.getByText("create a Chanukah flyer").first()).toBeVisible({
    timeout: 15_000,
  });

  // The finished image renders as a data-URI <img>; the intermediate
  // review-status snapshots are text-only, so this matches only the result.
  await expect(page.locator('img[src^="data:image"]').first()).toBeVisible({
    timeout: 60_000,
  });
});
