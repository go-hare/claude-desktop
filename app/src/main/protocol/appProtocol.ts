import { app, net, protocol } from 'electron';
import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const API_PREFIXES = ['/api/', '/edge-api/', '/v1/'];
const LOCAL_ACCOUNT_UUID = '00000000-0000-4000-8000-000000000001';
const LOCAL_ORG_UUID = '00000000-0000-4000-8000-000000000002';
const LOCAL_AVAILABLE_FEATURES = [
  'chat',
  'claude_code',
  'claude_code_desktop',
  'claude_code_desktop_auto_permissions',
  'claude_code_desktop_bypass_permissions',
  'claude_code_fast_mode',
  'claude_code_remote_control',
  'claude_code_routines',
  'claude_code_web',
  'cowork',
  'interactive_content',
  'skills',
  'web_search',
  'wiggle',
];

const CODE_DESKTOP_ACTIVATION_CHECKLIST_CONFIG = {
  set_folder: false,
  first_prompt: false,
  first_pr: false,
  add_claude_md: false,
  setup_routine: false,
  plan_mode: false,
  enable_notifications: false,
  install_cli: false,
  add_mcp: false,
  max_visible: 3,
  pages: [
    {
      header_key: 'get_started',
      item_ids: ['set_folder', 'first_prompt', 'first_pr'],
      shuffle: false,
    },
    {
      header_key: 'go_further',
      item_ids: [
        'add_claude_md',
        'setup_routine',
        'plan_mode',
        'enable_notifications',
        'install_cli',
        'add_mcp',
      ],
      shuffle: true,
    },
  ],
};

function growthBookFeature(defaultValue: unknown) {
  return { defaultValue };
}

const LOCAL_GROWTHBOOK = {
  features: {
    // djb2-hashed key for `claudified_code_desktop_activation_checklist`.
    // The SPA hashes feature names before lookup, so raw names are ignored.
    '2742738700': growthBookFeature(CODE_DESKTOP_ACTIVATION_CHECKLIST_CONFIG),
    // Code/Cowork desktop gates used by the /epitaxy sidebar and first-run UI.
    '1336781366': growthBookFeature(true), // chilling_sloth_clocks
    '2276854292': growthBookFeature(true), // claude_code_waffles
    '2649778212': growthBookFeature(true), // cowork_default_landing_enabled
    '3396924463': growthBookFeature(true), // yukon_silver
    '3588541099': growthBookFeature({
      show_free_user_cowork_tab_upsell: false,
      cowork_upsell_modal_variant: '',
    }),
    '4174416060': growthBookFeature(true), // dittos
  },
};

const localCurrentUserAccess = {
  account_permissions: [],
  features: LOCAL_AVAILABLE_FEATURES.map((feature) => ({
    feature,
    status: 'available',
  })),
};

const localOrganizationSettings = {
  chat_enabled: true,
  claude_code_desktop_auto_permissions_enabled: true,
  claude_code_desktop_bypass_permissions_enabled: true,
  claude_code_desktop_enabled: true,
  claude_code_metrics_logging_enabled: true,
  claude_code_remote_control_enabled: true,
  claude_code_routines_enabled: true,
  claude_code_web_enabled: true,
  enabled_wiggle: true,
  skills_enabled: true,
  web_search_enabled: true,
};

const localOrganization = {
  uuid: LOCAL_ORG_UUID,
  name: 'Local Claude Desktop',
  capabilities: [
    'api',
    'chat',
    'claude_code',
    'claude_code_web',
    'commercial_use',
    'cowork',
    'raven',
  ],
  visibility_status: 'active',
  rate_limit_tier: 'default_claude_max_20x',
  billing_type: 'internal',
  settings: localOrganizationSettings,
};

const localAccount = {
  uuid: LOCAL_ACCOUNT_UUID,
  email_address: 'local@claude.desktop',
  full_name: 'Local User',
  display_name: 'Local User',
  is_verified: true,
  age_is_verified: true,
  avatar: 0,
  settings: {
    has_finished_claudeai_onboarding: true,
    enabled_saffron: false,
    enabled_monkeys_in_a_barrel: false,
    grove_enabled: false,
  },
  memberships: [
    {
      role: 'owner',
      organization: localOrganization,
    },
  ],
  invites: [],
};

function createLocalBootstrapPayload() {
  return {
    account: localAccount,
    activeOrganization: localOrganization,
    active_organization: localOrganization,
    statsig: {},
    growthbook: LOCAL_GROWTHBOOK,
    // The no-org bootstrap path is used before the SPA has a last-active-org
    // cookie. If this is set, the account provider treats it as a stale org
    // bootstrap and immediately refetches forever because the cookie is absent.
    statsigOrgUuid: undefined,
    intercom_account_hash: null,
    locale: 'en-US',
    system_prompts: [],
    current_user_access: localCurrentUserAccess,
    gated_messages: [],
    gated_imports: [],
    messageLimits: {},
  };
}

/**
 * Per-org bootstrap shape. ion-dist's `Sb()` checks for `org_statsig` in the
 * response when called with an `n` (orgUuid) — it then projects the response
 * via `{statsig: l.org_statsig, growthbook: l.org_growthbook, ...}`. So the
 * wire shape MUST use `org_statsig`/`org_growthbook` when the URL has an org.
 */
function createOrgBootstrapPayload() {
  return {
    account: localAccount,
    org_statsig: {},
    org_growthbook: LOCAL_GROWTHBOOK,
    intercom_account_hash: null,
    locale: 'en-US',
    system_prompts: [],
    current_user_access: localCurrentUserAccess,
    gated_messages: [],
    gated_imports: [],
  };
}

export function registerAppProtocolScheme() {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'app',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
        // ion-dist registers a service worker for offline asset caching;
        // without this flag the call throws InvalidStateError.
        allowServiceWorkers: true,
      },
    },
  ]);
}

async function pathExists(filePath: string) {
  try {
    await access(filePath, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function findIonDistRoot() {
  const candidates = [
    resolve(process.cwd(), 'ion-dist'),
    resolve(app.getAppPath(), 'ion-dist'),
    resolve(moduleDir, '../../ion-dist'),
    resolve(moduleDir, '../../../ion-dist'),
  ];

  for (const candidate of candidates) {
    if (await pathExists(resolve(candidate, 'index.html'))) {
      return candidate;
    }
  }

  throw new Error(`Unable to locate ion-dist. Checked: ${candidates.join(', ')}`);
}

function resolveContainedPath(root: string, relativePath: string) {
  const filePath = resolve(root, relativePath);
  const rootWithSep = root.endsWith(sep) ? root : `${root}${sep}`;

  if (filePath !== root && !filePath.startsWith(rootWithSep)) {
    throw new Error(`Blocked app:// path traversal: ${relativePath}`);
  }

  return filePath;
}

async function resolveIonDistPath(root: string, requestUrl: string) {
  const url = new URL(requestUrl);
  const pathname = decodeURIComponent(url.pathname);
  const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const requestedFilePath = resolveContainedPath(root, relativePath);

  if (await pathExists(requestedFilePath)) {
    return requestedFilePath;
  }

  if (API_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  if (pathname === '/' || pathname.endsWith('/') || extname(pathname) === '') {
    return resolveContainedPath(root, 'index.html');
  }

  return null;
}

function createApiStubResponse(request: Request) {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method.toUpperCase();

  // ---------- bootstrap paths ----------
  // ion-dist's bootstrap.ts (Sb function) hits one of:
  //   /edge-api/bootstrap?statsig_hashing_algorithm=djb2&...   (no org)
  //   /edge-api/bootstrap/<orgUuid>/app_start?...              (with org)
  // The main account provider separately hits the same shape under /api:
  //   /api/bootstrap?statsig_hashing_algorithm=djb2&...
  //   /api/bootstrap/<orgUuid>/app_start?...
  // The first call goes without an org; once the SPA picks a "last active
  // org" from the bootstrap result it fires a second call WITH the org.
  // Both responses must be JSON — anything else (e.g. our index.html
  // fallback) lets `await response.json()` blow up with "Unexpected token '<'".
  if (pathname === '/edge-api/bootstrap' || pathname === '/api/bootstrap') {
    return Response.json(createLocalBootstrapPayload());
  }
  if (pathname.startsWith('/edge-api/bootstrap/') || pathname.startsWith('/api/bootstrap/')) {
    return Response.json(createOrgBootstrapPayload());
  }

  // ---------- /api/* ----------
  if (pathname === '/api/account_profile') {
    return Response.json({
      ...createLocalBootstrapPayload(),
      work_function: 'Engineering',
      onboarding_topics: ['coding_development'],
      conversation_preferences: '',
    });
  }

  if (pathname === `/api/bootstrap/${LOCAL_ORG_UUID}/current_user_access`) {
    return Response.json(localCurrentUserAccess);
  }

  if (pathname === `/api/bootstrap/${LOCAL_ORG_UUID}/system_prompts`) {
    return Response.json([]);
  }

  if (pathname === `/api/organizations/${LOCAL_ORG_UUID}`) {
    return Response.json(localOrganization);
  }

  if (pathname === '/api/account/settings') {
    return Response.json(localAccount.settings);
  }

  if (pathname === `/api/organizations/${LOCAL_ORG_UUID}/feature_settings`) {
    return Response.json({
      disabled_features: [],
      forced_settings: [],
    });
  }

  if (pathname === '/api/banners' || pathname.startsWith('/api/banners/')) {
    return Response.json([]);
  }

  // ---------- /v1/sessions/<id> + /v1/sessions/<id>/events ----------
  // The SPA's session view loads transcript by paging
  //   GET /v1/sessions/<id>/events?after=<cursor> → {data:[...], has_more:false, last_id:<uuid|null>}
  // and session metadata via
  //   GET /v1/sessions/<id> → {id, title, created_at, ...}.
  // Returning a bare [] (our generic GET fallback) breaks the events
  // pager because it spreads `response.data` — undefined → not iterable.
  // Real session content flows over the IPC `LocalSessions.onEvent`
  // broadcast, so these HTTP endpoints can stay empty for local sessions;
  // the SPA just renders no historical messages and waits for live events.
  if (pathname.startsWith('/v1/sessions/') && method === 'GET') {
    const tail = pathname.slice('/v1/sessions/'.length);
    if (tail.endsWith('/events')) {
      return Response.json({ data: [], has_more: false, last_id: null });
    }
    // session metadata — return a minimal record. The id segment after
    // /v1/sessions/ is the session UUID up to the next slash.
    const id = tail.split('/')[0] ?? '';
    return Response.json({
      id,
      title: 'Untitled session',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  if (pathname === `/api/organizations/${LOCAL_ORG_UUID}/code/repos` && method === 'GET') {
    return Response.json({
      repos: [],
      sso_required_org_ids: [],
      sso_required_orgs: [],
      sso_authorize_url: null,
    });
  }

  if (pathname === `/api/organizations/${LOCAL_ORG_UUID}/code/repos/resync` && method === 'POST') {
    return Response.json({
      app_installed: true,
      branch_exists: false,
      pull_request: null,
    });
  }

  // ---------- /v1/privacy-consents ----------
  // ion-dist's consent flow (see c5f4e1303):
  //   GET /v1/privacy-consents?prefix=cookies. → expects {consents: [...]}.
  //     If consents.length > 0 it treats user as having opted in and stops.
  //     If empty → falls through to dx() PUT calls every time → infinite loop.
  //   PUT /v1/privacy-consents → response body irrelevant, just needs to be ok.
  // We pretend the user has already opted in to all cookie categories (this is
  // a local-only desktop app, no analytics shipped from us anyway).
  if (pathname === '/v1/privacy-consents' && method === 'GET') {
    return Response.json({
      consents: [
        { consent_type: 'cookies.essential', consent_decision: 'CONSENT_DECISION_OPT_IN' },
        { consent_type: 'cookies.analytics', consent_decision: 'CONSENT_DECISION_OPT_IN' },
        { consent_type: 'cookies.marketing', consent_decision: 'CONSENT_DECISION_OPT_OUT' },
      ],
    });
  }
  if (pathname === '/v1/privacy-consents' && method === 'PUT') {
    return Response.json({ ok: true });
  }

  // ---------- /api/organizations/<id>/dust/generate_title_and_branch ----------
  // SPA calls this POST during session start to auto-generate a session
  // title + git branch name from the first prompt. Returning a static
  // placeholder lets the start flow proceed; phase 0.4 can wire up real
  // generation via @anthropic-ai/claude-agent-sdk.
  if (
    pathname.startsWith('/api/organizations/') &&
    pathname.endsWith('/dust/generate_title_and_branch')
  ) {
    return Response.json({
      title: 'Untitled session',
      branch_name: `claude/session-${Date.now().toString(36)}`,
    });
  }

  // unmatched /api/* /v1/* /edge-api/* fallback. Return a shape-appropriate
  // empty body so the SPA's `await response.json()` succeeds and it can
  // gracefully treat the result as "nothing to show". Logged so we know
  // what to stub next.
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/v1/') ||
    pathname.startsWith('/edge-api/')
  ) {
    console.warn('[rebuild:api-stub] unhandled', method, pathname);
    if (method === 'GET') {
      return Response.json([]);
    }
    return Response.json({}, { status: 200 });
  }

  // No /i18n/*.json catch-all here on purpose. Real locale files live
  // inside ion-dist (e.g. ion-dist/i18n/zh-CN.json) and must be served
  // by the file resolver, NOT replaced with an empty map. Returning {}
  // here would suppress translations and silently break components that
  // require them to render (e.g. the sidebar 协作/代码 toggle).
  // If the requested locale file genuinely doesn't exist, the file
  // resolver will return 404 — that's the correct signal to ion-dist.

  return null;
}

/**
 * Byte-level patches applied to specific ion-dist chunks before serving.
 *
 * Used as a last resort when an SPA gate can't be flipped via IPC / feature
 * flags within reasonable effort. Each patch must use a same-length
 * replacement so source-map offsets and chunk hashes stay consistent.
 *
 * Phase 0 currently has no active patches — the previous "force-push
 * cowork into modes" entry was reverted because we don't implement the
 * cowork (协作) backend, and unhiding the tab only let users land on a
 * dead-empty Cowork page. With no patch, `nMe()` returns just `["code"]`,
 * `Ws` falls back to null, the toggle is gone entirely, and the sidebar
 * is single-mode Code — exactly what we ship.
 *
 * To re-enable a patch later (e.g. once Cowork backend lands), add an
 * entry back to PATCHES_BY_FILENAME with `find` / `replace` / `reason`.
 */
type Patch = { find: string; replace: string; reason: string };

const PATCHES_BY_FILENAME: Record<string, Patch[]> = {};

const patchedCache = new Map<string, Buffer>();

async function readMaybePatched(filePath: string): Promise<Buffer | null> {
  const filename = filePath.split(sep).pop() ?? '';
  const patches = PATCHES_BY_FILENAME[filename];
  if (!patches) return null;

  const cached = patchedCache.get(filePath);
  if (cached) return cached;

  const { readFile } = await import('node:fs/promises');
  let text: string;
  try {
    text = await readFile(filePath, 'utf8');
  } catch {
    return null;
  }

  let modified = text;
  for (const { find, replace, reason } of patches) {
    if (find.length !== replace.length) {
      console.warn('[rebuild:patch] skipped (length mismatch)', filename, reason);
      continue;
    }
    if (!modified.includes(find)) {
      console.warn('[rebuild:patch] needle not found', filename, reason);
      continue;
    }
    modified = modified.replaceAll(find, replace);
    console.log('[rebuild:patch] applied', filename, '—', reason);
  }

  const buf = Buffer.from(modified, 'utf8');
  patchedCache.set(filePath, buf);
  return buf;
}

export async function installAppProtocolHandler() {
  const ionDistRoot = await findIonDistRoot();

  protocol.handle('app', async (request) => {
    try {
      const stubResponse = createApiStubResponse(request);
      if (stubResponse) {
        return stubResponse;
      }

      const filePath = await resolveIonDistPath(ionDistRoot, request.url);
      if (!filePath) {
        return new Response('Not found', { status: 404 });
      }

      const patched = await readMaybePatched(filePath);
      if (patched) {
        return new Response(patched, {
          status: 200,
          headers: { 'Content-Type': 'application/javascript; charset=utf-8' },
        });
      }

      return net.fetch(pathToFileURL(filePath).toString());
    } catch (error) {
      return new Response(String(error), { status: 404 });
    }
  });
}
