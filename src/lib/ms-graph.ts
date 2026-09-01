/** Microsoft Graph — 앱 전용(client credentials) 토큰. 서버에서만 사용. */

export interface MsConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  targetUser: string; // 드라이브/메일함 소유자 (예: hr@aromatica.co)
  rootFolder: string; // 아카이브 루트 (예: "채용/처우산정")
}

export function getMsConfig(): MsConfig | null {
  const {
    MS_TENANT_ID,
    MS_CLIENT_ID,
    MS_CLIENT_SECRET,
    MS_TARGET_USER,
    MS_ROOT_FOLDER,
  } = process.env;
  if (!MS_TENANT_ID || !MS_CLIENT_ID || !MS_CLIENT_SECRET || !MS_TARGET_USER) {
    return null;
  }
  return {
    tenantId: MS_TENANT_ID,
    clientId: MS_CLIENT_ID,
    clientSecret: MS_CLIENT_SECRET,
    targetUser: MS_TARGET_USER,
    rootFolder: MS_ROOT_FOLDER || "채용/처우산정",
  };
}

let cachedToken: { token: string; exp: number } | null = null;

export async function getGraphToken(cfg: MsConfig): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const res = await fetch(
    `https://login.microsoftonline.com/${cfg.tenantId}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        scope: "https://graph.microsoft.com/.default",
        grant_type: "client_credentials",
      }),
    },
  );
  if (!res.ok) {
    throw new Error(`Graph 토큰 실패: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: json.access_token,
    exp: Date.now() + json.expires_in * 1000,
  };
  return json.access_token;
}

export async function graph(
  cfg: MsConfig,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const token = await getGraphToken(cfg);
  return fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

/** OneDrive 폴더 경로 보장 (없으면 생성). path 는 "/A/B/C" 형태(루트 기준) */
export async function ensureFolderPath(
  cfg: MsConfig,
  segments: string[],
): Promise<string> {
  const parts = [cfg.rootFolder, ...segments].flatMap((s) =>
    s.split("/").filter(Boolean),
  );
  let parentPath = ""; // graph path suffix
  for (const seg of parts) {
    const listUrl = parentPath
      ? `/users/${cfg.targetUser}/drive/root:${parentPath}:/children`
      : `/users/${cfg.targetUser}/drive/root/children`;
    const res = await graph(cfg, listUrl);
    const found =
      res.ok &&
      ((await res.json()) as { value: { name: string; folder?: unknown }[] }).value.find(
        (c) => c.name === seg && c.folder,
      );
    if (!found) {
      const createUrl = parentPath
        ? `/users/${cfg.targetUser}/drive/root:${parentPath}:/children`
        : `/users/${cfg.targetUser}/drive/root/children`;
      const cr = await graph(cfg, createUrl, {
        method: "POST",
        body: JSON.stringify({
          name: seg,
          folder: {},
          "@microsoft.graph.conflictBehavior": "rename",
        }),
      });
      if (!cr.ok) throw new Error(`폴더 생성 실패(${seg}): ${await cr.text()}`);
    }
    parentPath += `/${seg}`;
  }
  return parentPath;
}
