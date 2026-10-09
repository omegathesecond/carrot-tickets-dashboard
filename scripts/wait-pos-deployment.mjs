import { readFileSync } from 'node:fs';
const { CLOUDFLARE_API_TOKEN, PUBLISHED_COMMIT } = process.env;
if (!CLOUDFLARE_API_TOKEN || !/^[a-f0-9]{40}$/.test(PUBLISHED_COMMIT)) throw new Error('Deployment credentials or commit missing');
const expected = JSON.parse(readFileSync('public/pos-release.json', 'utf8'));
const endpoint = 'https://api.cloudflare.com/client/v4/accounts/9f074c8dd70baaa27e08c1602bdec69a/pages/projects/keshless-tickets-admin/deployments?per_page=100';
for (let attempt = 0; attempt < 60; attempt++) {
  const response = await fetch(endpoint, {headers: {Authorization: `Bearer ${CLOUDFLARE_API_TOKEN}`}, signal: AbortSignal.timeout(30000)});
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(`Cannot read dashboard deployment status (${response.status})`);
  const deployment = data.result.find(item => item.environment === 'production' && item.deployment_trigger.metadata.commit_hash === PUBLISHED_COMMIT);
  if (deployment?.latest_stage.status === 'failure' || deployment?.latest_stage.status === 'canceled') throw new Error('Dashboard deployment failed');
  if (deployment?.latest_stage.name === 'deploy' && deployment.latest_stage.status === 'success') {
    const live = await fetch(`https://manage.carrottickets.com/pos-release.json?commit=${PUBLISHED_COMMIT}`, {cache: 'no-store', signal: AbortSignal.timeout(30000)});
    if (!live.ok) throw new Error(`Published release record unavailable (${live.status})`);
    const record = await live.json();
    if (JSON.stringify(record) !== JSON.stringify(expected)) throw new Error('Live POS release record does not match this deployment');
    console.log(`Dashboard and POS update record deployed: ${deployment.id}`);
    process.exit(0);
  }
  await new Promise(resolve => setTimeout(resolve, 10000));
}
throw new Error('Timed out waiting for the dashboard deployment');
