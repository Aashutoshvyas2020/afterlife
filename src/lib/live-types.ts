export type Candidate = { repository: string; capability: string; license: string; evidence: string; recommendation: string; productHypothesis: string; risks: string; activity: string };
export type LiveProduct = { name: string; description: string; repository: string; revision: string; capability: string; url: string; priceCents: number; limitations: string[]; temporary: boolean };
export type LiveRun = { id: string; thesis: string; createdAt: number; updatedAt?: number; state: string; stages: {kind:string;label:string;status:string;taskId:string;startedAt:string;resultStatus?:string}[]; candidates: Candidate[]; decision?: {decision:string;repository:string;reason:string;productHypothesis:string}; repair?: {status:string;summary:string;repository:string;revision:string}; product?: LiveProduct; events: {id:string;time:string;text:string;status:string;stage?:string}[]; error?:string; refreshError?:string; billing?:{configured:boolean;mode:string} };
export type RunSummary = Pick<LiveRun,'id'|'thesis'|'state'|'createdAt'|'product'>;
export async function liveApi<T>(path: string, init?: RequestInit): Promise<T> {
 const response = await fetch(path, { ...init, headers: { 'content-type':'application/json', ...init?.headers }, signal: init?.signal || AbortSignal.timeout(60000) });
 const data = await response.json();
 if (!response.ok) throw Error(data.error || 'The service is unavailable. Try again.');
 return data;
}
