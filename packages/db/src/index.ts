export interface StoredRun {
  id: string;
  agentId: string;
  status: string;
  createdAt: string;
}

export interface RunRepository {
  save(run: StoredRun): Promise<void>;
  list(agentId: string): Promise<StoredRun[]>;
}

export class MemoryRunRepository implements RunRepository {
  private readonly runs: StoredRun[] = [];
  async save(run: StoredRun) { this.runs.push(run); }
  async list(agentId: string) { return this.runs.filter((run) => run.agentId === agentId); }
}
