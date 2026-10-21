export interface EsClientConfig {
  apiKey: string;
  slug: string;
  baseUrl?: string;
}

export interface FlowValue {
  [key: string]: string;
}

export interface NodeError {
  message: string;
  [key: string]: any;
}

export interface MultiValueTypes {
  [key: string]: any;
}

export interface ModelInputType {
  [key: string]: any;
}

export interface SourceTarget {
  [key: string]: any;
}

export type NodeType =
  | 'text_output'
  | 'md_output'
  | 'multi_text_input'
  | 'img_output'
  | 'prompt_ai'
  | 'image_to_text'
  | 'text_to_image'
  | 'ghost_post'
  | 'tool_ai'
  | 'webhook_output'
  | 'timer'
  | 'cron'
  | 'delay'
  | 'concat'
  | 'api_call'
  | 'super_node'
  | 'airtable'
  | 'email_output'
  | 'okr_output'
  | 'note'
  | 'read_pdf'
  | 'python_run'
  | 'integration_output'
  | 'validation'
  | 'sql'
  | 'sql_output'
  | 'writer_output'
  | 'writer_create'
  | 'csv'
  | 'selection'
  | 'replicate_ai'
  | 'video_output'
  | 'audio_output'
  | 'html_output'
  | 'markdown'
  | 'pass_on'
  | 'language_detection'
  | 'entity_recognition'
  | 'key_phrase_extraction'
  | 'sentiment_analysis'
  | 'pii_entity_recognition'
  | 'json_splitter'
  | 'series_symbol'
  | 'github'
  | 'gmail'
  | 'notion'
  | 'slack'
  | 'jira';

export interface FlowNode {
  type: NodeType;
  icon?: string;
  multiGenerate?: number;
  data: {
    feature_image?: string;
    label: string;
    text?: string;
    json?: string;
    value?: string;
    error?: NodeError;
    assignTo?: string;
    assignBy?: string;
    assignAt?: string;
    multivalue?: MultiValueTypes[];
    checkoutRequired?: boolean;
    prompt?: string;
    promptText?: string;
    file?: string;
    css?: string;
    code?: string;
    html?: string;
    intData?: any;
    triger: boolean;
    complete: boolean;
    completedNumbers: number;
    loading: boolean;
    template?: string;
    flowPosition?: number;
    defaultSelectedNode?: string;
    apiKey?: string;
    endpoint?: string;
    model?: string;
    modelInputSchema?: ModelInputType;
    joinWith?: string;
    isWriterUpdate?: boolean;
    writer_title?: string;
    config?: {
      cron?: string;
      repeat?: number;
      remain?: number;
      interval?: number;
      timezone?: string;
      base?: string;
      table?: string;
      api_key?: string;
      team_slug?: string;
      method?: string;
      headers?: {
        key: string;
        value: string;
      }[];
      params?: any[];
      body?: string;
      response?: any[];
      responsePath?: string;
      responsePathType?: string;
      responsePathValue?: string;
      urlType?: string;
      selectUrlFrom?: string;
      lastModifiedIdentifier?: string;
      host?: string;
      user?: string;
      password?: string;
      database?: string;
      query?: string;
      fileUrl?: string;
      currentNumberPos?: number;
      tabledata?: any[];
      email?: string;
      subject?: string;
      content?: string;
      okrId?: string;
      updateFrequency?: number;
      url?: string;
      baseId?: string;
      tableId?: string;
      selectedBase?: string;
      selectedTable?: string;
      isDataAvailable?: boolean;
      dbType?: string;
      username?: string;
      port?: number;
      dbName?: string;
      isValidate?: boolean;
      textdata?: string;
      schema?: string;
      code?: string;
      admin_url?: string;
      admin_api_key?: string;
      postId?: string;
      postTitle?: string;
      postContent?: string;
      selectedIntId?: string;
      intType?: string;
      integrationId?: string;
      envs?: {
        key: string;
        value: string;
      }[];
    };
    notes?: {
      text?: string;
      from?: string;
      noteFor?: string;
      time?: string;
    }[];
    isUpdate?: boolean;
    reportUrl?: string;
  };
  metadata?: {
    title?: string;
    description?: string;
    image?: string;
    notes?: {
      sports?: string;
    };
    updatedAt?: string;
    creator?: {
      name: string;
      img: string;
    };
  };
  source?: SourceTarget[];
  target?: SourceTarget[];
  [key: string]: any;
}

export interface FlowResponse {
  result: {
    data: {
      json: {
        nodes: FlowNode[];
        [key: string]: any;
      };
    };
  };
}

export interface RunFlowResult {
  success: boolean;
  nodes: FlowNode[];
  data?: FlowNode['data'][];
  error?: string;
}









// ES DB Types

export interface EsDbClientConfig {
  endpoint?: string;
  projectId: string;
  apiKey: string;
}

export interface EsRecord {
  uid: string;
  tableId: string;
  storeId: string;
  createdAt: string;
  modifiedAt: string;
  accessRules: string[];
  payload: Record<string, any>;
}

export interface EsRecordSet {
  count: number;
  items: EsRecord[];
}

export interface EsAccount {
  uid: string;
  emailAddress: string;
  displayName?: string;
  phone?: string;
  isActive: boolean;
  emailConfirmed: boolean;
  phoneConfirmed: boolean;
  createdAt: string;
  modifiedAt: string;
  /** Labels set on the account by an admin (e.g. "admin"). Server-side reads only. */
  labels?: string[];
}

export interface EsAccountSet {
  count: number;
  items: EsAccount[];
}

export interface EsMembership {
  uid: string;
  userId: string;
  userName: string;
  userEmail: string;
  teamId: string;
  teamName: string;
  roles: string[];
  createdAt: string;
  /** When the invitation was sent. */
  invited?: string;
  /** When the invitation was accepted (empty while pending). */
  joined?: string;
  /** Whether the invitation has been accepted. */
  confirm?: boolean;
}

export interface EsMembershipSet {
  count: number;
  items: EsMembership[];
}

export interface EsAsset {
  uid: string;
  containerId: string;
  filename: string;
  byteSize: number;
  contentType: string;
  createdAt: string;
  modifiedAt: string;
}

export interface EsAssetSet {
  count: number;
  items: EsAsset[];
}

export interface EsQueryConfig {
  maxResults?: number;
  skipCount?: number;
  sortBy?: Array<{
    key: string;
    order: 'ascending' | 'descending';
  }>;
  rules?: Array<{
    key: string;
    condition: 'equals' | 'notEquals' | 'below' | 'belowOrEquals' | 'above' | 'aboveOrEquals' | 'contains' | 'isEmpty' | 'isNotEmpty' | 'inRange' | 'beginsWith' | 'endsWith';
    match: any;
  }>;
}

// Team Types
export interface EsTeam {
  uid: string;
  name: string;
  totalMembers: number;
  createdAt: string;
}

export interface EsTeamSet {
  count: number;
  items: EsTeam[];
}

export interface EsTeamMember {
  uid: string;
  teamId: string;
  teamName: string;
  userId: string;
  userName: string;
  userEmail: string;
  roles: string[];
  joined: string;
}

export interface EsTeamMemberSet {
  count: number;
  items: EsTeamMember[];
}

export interface EsTeamMembership {
  uid: string;
  userId: string;
  teamId: string;
  teamName: string;
  roles: string[];
  joined: string;
}

// ==================== PREFERENCES ====================

export interface EsAccountPreferences {
  [key: string]: any;
}

export interface EsTeamPreferences {
  [key: string]: any;
}

// ==================== REALTIME ====================

export type RealtimeChannel = 'documents' | 'collections' | 'databases' | 'files' | 'buckets' | 'teams' | 'memberships' | 'executions' | 'functions';

export type RealtimeResponseEvent<T = any> = {
  events: string[];
  channels: string[];
  timestamp: number;
  payload: T;
};

export type RealtimeCallback<T = any> = (response: RealtimeResponseEvent<T>) => void;

export type UnsubscribeFunction = () => void;
