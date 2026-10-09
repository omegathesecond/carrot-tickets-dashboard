// Local/deployer release automation: signing stays on this machine and the
// contracts Cloudflare token is read from Secret Manager only for R2 requests.
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {prepareRelease,uploadApk,promoteRelease,RELEASE_URL} from './r2-pos-release.mjs';
const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i < 0 ? undefined : args[i+1]; };
const to = option('--notify-to');
const apiDir = option('--api-dir');
const posDir = option('--build-pos-dir');
if (!to || !(/^\+\d{8,15}$/.test(to) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) || !apiDir) {
  throw new Error('Supply --notify-to (email or SMS number) and --api-dir (built Carrot API repository)');
}
const gc = values => execFileSync('gcloud',['--configuration=deployer',...values,'--project=contracts-470406'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
const secret = (name,version='latest') => gc(['secrets','versions','access',version,'--secret='+name]).trim();
const token = secret('CONTRACTS_CLOUDFLARE__API_TOKEN');
const service = JSON.parse(gc(['run','services','describe','carrot-tickets-api','--region=europe-west1','--format=json']));
const env = service.spec.template.spec.containers[0].env;
const binding = env.find(item=>item.name==='YEBOLINK_API_KEY')?.valueFrom?.secretKeyRef;
if(!binding)throw new Error('Carrot messaging secret binding missing');
process.env.YEBOLINK_API_KEY = secret(binding.name,binding.key);
const messagingUrl = env.find(item=>item.name==='YEBOLINK_API_URL')?.value;
if(messagingUrl)process.env.YEBOLINK_API_URL = messagingUrl;
// Reuse the product's existing messaging client, sender identity and envelope.
const {YeboLinkClient} = await import(pathToFileURL(resolve(apiDir,'dist/services/yebolink.client.js')));
const notify = async (stage,result,detail) => {
  const text = `Carrot POS ${stage}: ${result}. ${detail}`;
  const sent = to.includes('@')
    ? await YeboLinkClient.sendEmail(to,`Carrot POS ${stage}: ${result}`,`<p>${text.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</p>`)
    : await YeboLinkClient.sendSMS(to,text);
  if(!sent.messageId)throw new Error('Release notification returned no message ID');
  console.log(`Release notification accepted: ${sent.messageId}`);
};
let stage = posDir ? 'build' : 'publication';
try {
  let apkPath=option('--apk'), metadataPath=option('--metadata');
  if(posDir) {
    // This flag is an explicit APK-build request; it is never used by push CI.
    execFileSync('bash',[resolve(posDir,'scripts/build-release.sh')],{cwd:resolve(posDir),stdio:'inherit'});
    metadataPath=resolve(posDir,'release/release.json');
    const built=JSON.parse(readFileSync(metadataPath,'utf8'));
    apkPath=resolve(posDir,`release/carrot-pos-v${built.version}+${built.buildNumber}.apk`);
    await notify('build','success',`Signed POS ${built.version}+${built.buildNumber}`);
  }
  stage='publication';
  if(!apkPath || !metadataPath)throw new Error('Supply --apk and --metadata, or explicitly request --build-pos-dir');
  const response=await fetch(RELEASE_URL,{cache:'no-store',signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error(`Cannot read current POS release (${response.status})`);
  const previous=await response.json();
  const apk=readFileSync(apkPath), metadata=JSON.parse(readFileSync(metadataPath,'utf8'));
  const release=prepareRelease(metadata,apk,previous,args.includes('--migrate-storage'));
  await uploadApk(token,release,apk);
  await promoteRelease(token,release);
  await notify('publication','success',`POS ${release.record.version}: ${release.record.apkUrl}`);
  console.log(JSON.stringify(release.record));
} catch(error) {
  try {await notify(stage,'failed',error.message);} catch(notificationError) {console.error(`Failure notification also failed: ${notificationError.message}`);}
  throw error;
}
