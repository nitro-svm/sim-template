import {
  AccountCache,
  AccountModifications,
  BacktestSession as Session,
  CreateSessionParams,
} from "@nitro-svm/simulation-bindings";
import {
  AccountInfo,
  Connection,
  PublicKey,
  VersionedTransaction,
} from "@solana/web3.js";

export interface SimulationConfig {
  simulationCreationUrl: string;
  simulationApiKey: string;
  simulationSessionUrl?: string;
}

export interface SimulationParams {
  createSessionParams: CreateSessionParams;
  slotInterval: number;
  runName: string;
  programSubscriptions?: string[];
}

export type Accounts = Map<string, AccountInfo<Buffer>>;

export class Simulation {
  accountCache: AccountCache;
  currentSlot = 0;
  connection?: Connection;

  private session: Session;
  private programSubIds: number[] = [];
  private resolveDone?: () => void;
  private rejectDone?: (err: unknown) => void;
  private done: Promise<void>;

  constructor(
    private params: SimulationParams,
    private config: SimulationConfig,
  ) {
    this.accountCache = new AccountCache({ slotInterval: params.slotInterval });

    this.done = new Promise((resolve, reject) => {
      this.resolveDone = resolve;
      this.rejectDone = reject;
    });

    this.session = new Session({
      baseUrl: config.simulationCreationUrl,
      apiKey: config.simulationApiKey,
      handlers: {
        onSessionCreated: (params) => this.handleSessionCreated(params),
        onReadyForContinue: () => this.handleReadyForContinue(),
        onAccountNotification: ({ pubkey, result }) =>
          this.accountCache.processNotification(pubkey, result),
        onSlot: (slot) => this.handleSlot(slot),
        onCompleted: () => this.handleCompleted(),
        onError: (error) => this.handleError(error),
      },
    });

    this.currentSlot = params.createSessionParams.startSlot;
  }

  async run(): Promise<void> {
    console.log(`Starting simulation: ${this.params.runName}`);
    console.log(
      `Requesting ${this.params.createSessionParams.accountEvents.length} account events:`,
    );
    this.params.createSessionParams.accountEvents.forEach((acc, i) =>
      console.log(`  ${i + 1}. ${acc}`),
    );

    await this.session.startSession(this.params.createSessionParams);
    await this.done;
  }

  private async handleSessionCreated(params: {
    sessionId: string;
    rpcEndpoint: string;
    sessionRpcUrl: string;
  }): Promise<void> {
    console.log("✓ Session created:", params);
    console.log(`  Session ID: ${params.sessionId}`);
    console.log(`  RPC endpoint: ${params.rpcEndpoint}`);

    this.setSessionUrl(params.sessionRpcUrl);

    if (this.params.programSubscriptions?.length) {
      this.setupProgramSubscriptions();
    }
  }

  private async handleReadyForContinue(): Promise<void> {
    // Custom logic can be added here for each slot progression
    console.log(`<Insert custom logic at slot ${this.currentSlot}>`);

    this.accountCache.clear();
    await this.sendUpdates();
  }

  async handleSlot(slot: number): Promise<void> {
    this.currentSlot = slot;
    if (process.stdout.isTTY) {
      process.stdout.clearLine(0);
      process.stdout.cursorTo(0);
    }
    process.stdout.write(`--- Slot ${slot} ---\n`);
  }

  private async handleCompleted(): Promise<void> {
    this.session.close();
    await this.removeProgramSubscriptions();
    console.log("\n✓ Simulation completed.");
    this.resolveDone?.();
  }

  private handleError(error: unknown): void {
    console.error(`  Server error: ${JSON.stringify(error)}`);
    this.session.close();
    void this.removeProgramSubscriptions();
    this.rejectDone?.(error);
  }

  private async removeProgramSubscriptions(): Promise<void> {
    for (const id of this.programSubIds) {
      await this.connection?.removeProgramAccountChangeListener(id);
    }
    this.programSubIds = [];
    // Force-close the underlying rpc-websockets client to stop its reconnect loop
    // once the ephemeral session has ended.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.connection as any)?._rpcWebSocket?.close();
  }

  private buildAccountModifications(
    accountUpdates?: Map<string, AccountInfo<Buffer>>,
  ): AccountModifications {
    const modifyAccountStates: AccountModifications = {};
    if (!accountUpdates) return modifyAccountStates;

    for (const [address, account] of accountUpdates) {
      modifyAccountStates[address] = {
        data: { data: account.data.toString("base64"), encoding: "base64" },
        executable: account.executable,
        lamports: account.lamports,
        owner: account.owner.toString(),
        space: account.data.length,
      };
    }

    return modifyAccountStates;
  }

  async sendUpdates(
    transactions?: VersionedTransaction[],
    accountUpdates?: Map<string, AccountInfo<Buffer>>,
  ): Promise<void> {
    const modifyAccountStates = this.buildAccountModifications(accountUpdates);
    const transactionsList = transactions ?? [];

    const continueParams = {
      advanceCount: this.params.slotInterval,
      transactions: transactionsList.map((tx) =>
        Buffer.from(tx.serialize()).toString("base64"),
      ),
      modifyAccountStates,
    };

    await this.session.sendContinue(continueParams);
  }

  private setupProgramSubscriptions(): void {
    if (!this.connection) throw new Error("Connection not initialized");

    for (const program of this.params.programSubscriptions ?? []) {
      console.log(`  Subscribing to program events: ${program}`);
      const id = this.connection.onProgramAccountChange(
        new PublicKey(program),
        (keyedAccountInfo, context) => {
          const pubkey = keyedAccountInfo.accountId.toBase58();
          const { lamports, owner } = keyedAccountInfo.accountInfo;
          console.log(`[Program event] slot=${context.slot} pubkey=${pubkey} lamports=${lamports} owner=${owner.toBase58()}`);
        },
      );
      this.programSubIds.push(id);
    }
  }

  private setSessionUrl(rpcUrl: string): void {
    console.log(`  Switching RPC to simulator session: ${rpcUrl}`);
    this.connection = new Connection(rpcUrl);
    this.config.simulationSessionUrl = rpcUrl;
  }

  async getAccount(address: string): Promise<AccountInfo<Buffer> | null> {
    const cached = this.accountCache.get(address);
    if (cached) return cached;

    if (!this.connection) {
      throw new Error("Connection not initialized");
    }

    return this.connection.getAccountInfo(new PublicKey(address));
  }

  close(): void {
    this.session.close();
  }
}
