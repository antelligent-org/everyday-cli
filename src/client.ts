import type { EsClientConfig, FlowNode, FlowResponse, RunFlowResult, FlowValue, NodeType } from './types.js';

const DEFAULT_BASE_URL = 'https://app.everydayseries.ai';

export class EsClient {
  private apiKey: string; 
  private baseUrl: string;
  private slug: string;

  constructor(config: EsClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || DEFAULT_BASE_URL) + '/api/trpc';
    this.slug = config.slug ;
  }

  /**
   * Run a flow by ID with given parameters
   * @param id - Flow ID string
   * @param value - Flow value key-value object where all values are strings
   */
  async run(id: string, value: FlowValue): Promise<RunFlowResult> {
    try {
      const url = `${this.baseUrl}/flows.runFlowById`;
      const options = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          json: {
            id: id,
            value: [value],
            slug: this.slug,
          },
        }),
      };

      const response = await fetch(url, options);

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data: FlowResponse = await response.json();
      const nodes = data?.result?.data?.json?.nodes || [];

      return {
        success: true,
        nodes,
        data: nodes.map(node => node.data),
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
   * Find flows by name (placeholder - requires flow listing API)
   * @param name - Name of the flow to search for
   */
  async findFlowByName(name: string): Promise<any> {
    // This would require a flows.list or flows.search endpoint
    // Placeholder implementation
    throw new Error('findFlowByName not yet implemented - requires flows.list API endpoint');
  }
}

export default EsClient;
