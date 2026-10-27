/**
 * Every 15 minutes, tell customers whose unpaid hold has lapsed.
 *
 * The work lives in the Next.js route so it shares the site's storage and
 * email code; this only triggers it. Netlify runs scheduled functions on
 * published deploys only, never on previews. `URL` is the site's main
 * address, set by Netlify.
 */
const releaseHolds = async () => {
  const response = await fetch(`${process.env.URL}/api/cron/release-holds`, {
    method: "POST",
  });
  console.log(
    `[release-holds] ${response.status} ${await response.text()}`,
  );
};

export default releaseHolds;

export const config = { schedule: "*/15 * * * *" };
