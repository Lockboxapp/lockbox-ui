export type Vault = {
  id: string;
  name: string;
  target: number;
  saved: number;
  locked: number;
  dueDate?: Date | null;
  isLocked: boolean;
  requireKeyholder?: boolean;
};
