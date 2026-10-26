import type { EsClientConfig, FlowNode, FlowResponse, FlowSummary, RunFlowResult, FlowValue, NodeType, RunOptions } from './types';

const DEFAULT_BASE_URL = 'https://app.everydayseries.ai';

/** How long run() waits for the server by default: a series can take a while. */
const DEFAULT_TIMEOUT_MS = 120_000;

/** Why a run that answered `complete: false` stopped, in one line. */
function stoppedReason(json: { nodes?: FlowNode[]; checkoutRequiredFor?: string; dependenciesNode?: FlowNode | null } | undefined): string {
  const waiting = json?.dependenciesNode;
  if (json?.checkoutRequiredFor || waiting?.data?.checkoutRequired) {
    return `The run is waiting for approval${waiting?.data?.label ? ` at "${waiting.data.label}"` : ''}.`;
  }
  const failed = (json?.nodes || []).find(
    node => typeof node.data?.value === 'string' && /^error\b/i.test(node.data.value.trim())
  );
  if (failed) return `The run stopped at "${failed.data?.label ?? failed.id}": ${failed.data.value}`;
  return 'The run stopped before the end.';
}

/**
 * The server's own reason for a refused request ("Insufficient AI credits...",
 * "The inputs provided don't match..."), not only the status.
 */
function errorMessage(response: { status: number }, body: any): string {
  const message = body?.error?.json?.message ?? body?.error?.message;
  return message ? String(message) : `API request failed with status ${response.status}`;
}

export class EsClient {
  private apiKey: string; 
  private baseUrl: string;
  private slug: string;
  private timeoutMs: number;

  constructor(config: EsClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || DEFAULT_BASE_URL) + '/api/trpc';
    this.slug = config.slug ;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * Run a flow by ID with given parameters
   * @param id - Flow ID string
   * @param value - Flow value key-value object where all values are strings
   * @param options - `timeoutMs` (default: the client's, 120000) and/or an
   *   AbortSignal to cancel the request
   *
   * `success` is true only when the run reached the end. A run that stopped
   * at an approval or a failed step returns `success: false`, `complete:
   * false` and says why in `error`; `hisId` names the run either way.
   */
  async run(id: string, value: FlowValue, options: RunOptions = {}): Promise<RunFlowResult> {
    try {
      const { response, body } = await this.request(
        `${this.baseUrl}/flows.runFlowById`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            json: {
              id: id,
              value: [value],
              slug: this.slug,
            },
          }),
        },
        options
      );
      if (!response.ok) {
        return { success: false, nodes: [], status: response.status, error: errorMessage(response, body) };
      }

      const json = (body as FlowResponse | null)?.result?.data?.json;
      const nodes = json?.nodes || [];
      const complete = json?.complete !== false;
      return {
        success: complete,
        complete,
        hisId: json?.hisId,
        nodes,
        data: nodes.map(node => node.data),
        ...(complete ? {} : { error: stoppedReason(json) }),
      };
    } catch (error) {
      return {
        success: false,
        nodes: [],
        error: error instanceof Error ? error.message : 'Failed to run flow',
      };
    }
  }

  /**
   * fetch with the API key, a timeout and the caller's AbortSignal. A timeout
   * or a cancel throws with a plain message; the body is parsed when it is JSON.
   */
  private async request(
    url: string,
    init: { method: string; headers?: Record<string, string>; body?: string },
    options: RunOptions
  ): Promise<{ response: Response; body: any }> {
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    options.signal?.addEventListener('abort', onAbort);
    if (options.signal?.aborted) controller.abort();
    try {
      const response = await fetch(url, {
        ...init,
        headers: { ...init.headers, Authorization: `Bearer ${this.apiKey}` },
        signal: controller.signal,
      });
      const body: any = await response.json().catch(() => null);
      return { response, body };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(options.signal?.aborted ? 'The request was cancelled' : `No answer within ${timeoutMs} ms`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', onAbort);
    }
  }

  /**
   * Get nodes of a specific type from flow result
   * @param nodes - Array of flow nodes
   * @param nodeType - Type of node to filter for
   */
  getNodesByType(nodes: FlowNode[], nodeType: NodeType): FlowNode[] {
    return nodes.filter((node) => node.type === nodeType);
  }

  /**
   * Get the first node of a specific type
   * @param nodes - Array of flow nodes
   * @param nodeType - Type of node to find
   */
  getNodeByType(nodes: FlowNode[], nodeType: NodeType): FlowNode | undefined {
    return nodes.find((node) => node.type === nodeType);
  }

  /**
   * Extract value from a text_output node
   * @param node - The node to extract value from
   */
  getNodeValue(node: FlowNode): any {
    if (!node) return null;

    const value = node.data?.value;

    // Try to parse as JSON if it's a string
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }

    return value;
  }

  /**
   * Get only the data from nodes (excludes metadata, source, target, etc.)
   * @param nodes - Array of flow nodes
   */
  getNodesData(nodes: FlowNode[]): FlowNode['data'][] {
    return nodes.map(node => node.data);
  }

  /**
   * Get data from nodes of a specific type
   * @param nodes - Array of flow nodes
   * @param nodeType - Type of node to filter for
   */
  getNodesDataByType(nodes: FlowNode[], nodeType: NodeType): FlowNode['data'][] {
    return this.getNodesByType(nodes, nodeType).map(node => node.data);
  }

  /**
   * Find a flow (series) of this team by its name: an exact match, ignoring
   * case and surrounding spaces. Pages through flows.get; null when none.
   * Throws with the server's message when the list can't be read.
   * @param name - Name of the flow to search for
   */
  async findFlowByName(name: string, options: RunOptions = {}): Promise<FlowSummary | null> {
    const wanted = name.trim().toLowerCase();
    if (!wanted) return null;
    const pageSize = 100;
    for (let offset = 0; ; offset += pageSize) {
      const page = await this.listFlows({ limit: pageSize, offset }, options);
      const match = page.find(flow => typeof flow?.name === 'string' && flow.name.trim().toLowerCase() === wanted);
      if (match) return match;
      if (page.length < pageSize) return null;
    }
  }

  /** One page of this team's flows (series), as flows.get returns them. */
  async listFlows(
    page: { limit?: number; offset?: number } = {},
    options: RunOptions = {}
  ): Promise<FlowSummary[]> {
    const input = encodeURIComponent(
      JSON.stringify({ json: { limit: page.limit ?? 50, offset: page.offset ?? 0, slug: this.slug } })
    );
    const { response, body } = await this.request(`${this.baseUrl}/flows.get?input=${input}`, { method: 'GET' }, options);
    if (!response.ok) throw new Error(errorMessage(response, body));
    const flows = body?.result?.data?.json;
    return Array.isArray(flows) ? flows : [];
  }
}

export default EsClient;
