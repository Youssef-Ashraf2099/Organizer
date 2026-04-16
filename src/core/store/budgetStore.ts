import { create } from "zustand";
import { persist } from "zustand/middleware";

export type BudgetAccountType =
  | "bank"
  | "wallet"
  | "e-wallet"
  | "cash"
  | "investment"
  | "savings"
  | "other";

export type BudgetTransactionType = "income" | "expense" | "transfer";
export type BudgetCategoryType = "income" | "expense" | "both";

export interface BudgetAccount {
  id: string;
  name: string;
  type: BudgetAccountType;
  currency: string;
  color: string;
  openingBalance: number;
  active: boolean;
  createdAt: number;
}

export interface BudgetCategory {
  id: string;
  name: string;
  type: BudgetCategoryType;
  color: string;
  active: boolean;
  isCustom: boolean;
}

export interface BudgetTransaction {
  id: string;
  type: BudgetTransactionType;
  accountId: string;
  linkedAccountId?: string | null;
  categoryId: string;
  amount: number;
  date: string;
  note: string;
  sourceTransactionId?: string | null;
  allocationBucketId?: string | null;
  isAllocation?: boolean;
}

export interface AllocationBucket {
  id: string;
  name: string;
  percent: number;
  color: string;
  active: boolean;
  priority: number;
  targetAccountId?: string | null;
}

export type BudgetPeriod = "day" | "week" | "month";

export interface BudgetAllocationPreview {
  bucketId: string;
  bucketName: string;
  percent: number;
  amount: number;
  targetAccountId?: string | null;
}

interface BudgetState {
  accounts: BudgetAccount[];
  categories: BudgetCategory[];
  transactions: BudgetTransaction[];
  allocationBuckets: AllocationBucket[];
  autoAllocateIncome: boolean;

  addAccount: (account: Omit<BudgetAccount, "id" | "createdAt">) => string;
  updateAccount: (
    id: string,
    updates: Partial<Omit<BudgetAccount, "id" | "createdAt">>,
  ) => void;
  setAccountActive: (id: string, active: boolean) => void;
  removeAccount: (id: string) => void;

  addCategory: (category: Omit<BudgetCategory, "id">) => string;
  updateCategory: (
    id: string,
    updates: Partial<Omit<BudgetCategory, "id">>,
  ) => void;
  setCategoryActive: (id: string, active: boolean) => void;
  removeCategory: (id: string) => void;

  addTransaction: (transaction: Omit<BudgetTransaction, "id">) => string;
  deleteTransaction: (id: string) => void;
  clearTransactions: () => void;

  addAllocationBucket: (bucket: Omit<AllocationBucket, "id">) => string;
  updateAllocationBucket: (
    id: string,
    updates: Partial<Omit<AllocationBucket, "id">>,
  ) => void;
  setAllocationBuckets: (buckets: AllocationBucket[]) => void;
  removeAllocationBucket: (id: string) => void;

  setAutoAllocateIncome: (enabled: boolean) => void;
  runAllocationForIncome: (transactionId: string) => BudgetAllocationPreview[];
}

const defaultCategories: BudgetCategory[] = [
  { id: "income-salary", name: "Salary", type: "income", color: "#22c55e", active: true, isCustom: false },
  { id: "income-freelance", name: "Freelance", type: "income", color: "#16a34a", active: true, isCustom: false },
  { id: "income-investment", name: "Investment", type: "income", color: "#10b981", active: true, isCustom: false },
  { id: "income-gift", name: "Gift", type: "income", color: "#34d399", active: true, isCustom: false },
  { id: "expense-rent", name: "Rent", type: "expense", color: "#ef4444", active: true, isCustom: false },
  { id: "expense-food", name: "Food", type: "expense", color: "#f97316", active: true, isCustom: false },
  { id: "expense-transport", name: "Transport", type: "expense", color: "#f59e0b", active: true, isCustom: false },
  { id: "expense-utilities", name: "Utilities", type: "expense", color: "#dc2626", active: true, isCustom: false },
  { id: "expense-shopping", name: "Shopping", type: "expense", color: "#ec4899", active: true, isCustom: false },
  { id: "expense-health", name: "Health", type: "expense", color: "#8b5cf6", active: true, isCustom: false },
  { id: "expense-entertainment", name: "Entertainment", type: "expense", color: "#06b6d4", active: true, isCustom: false },
];

const defaultAllocationBuckets: AllocationBucket[] = [
  { id: "bucket-needs", name: "Needs", percent: 50, color: "#3b82f6", active: true, priority: 1, targetAccountId: null },
  { id: "bucket-savings", name: "Savings", percent: 20, color: "#22c55e", active: true, priority: 2, targetAccountId: null },
  { id: "bucket-investments", name: "Investments", percent: 20, color: "#a855f7", active: true, priority: 3, targetAccountId: null },
  { id: "bucket-fun", name: "Fun", percent: 10, color: "#f97316", active: true, priority: 4, targetAccountId: null },
];

const defaultState = {
  accounts: [] as BudgetAccount[],
  categories: defaultCategories,
  transactions: [] as BudgetTransaction[],
  allocationBuckets: defaultAllocationBuckets,
  autoAllocateIncome: true,
};

const toCents = (value: number) => Math.round(value * 100);
const fromCents = (value: number) => Math.round(value) / 100;

const smartAllocateInternal = (
  amount: number,
  buckets: AllocationBucket[],
): BudgetAllocationPreview[] => {
  const activeBuckets = buckets
    .filter((bucket) => bucket.active && bucket.percent > 0)
    .sort((a, b) => a.priority - b.priority || b.percent - a.percent);

  if (activeBuckets.length === 0 || amount <= 0) {
    return [];
  }

  const totalPercent = activeBuckets.reduce((sum, bucket) => sum + bucket.percent, 0);
  if (totalPercent <= 0) {
    return [];
  }

  const totalCents = toCents(amount);
  const rawShares = activeBuckets.map((bucket) => {
    const exact = (totalCents * bucket.percent) / totalPercent;
    const cents = Math.floor(exact);
    return {
      bucket,
      exact,
      cents,
      remainder: exact - cents,
    };
  });

  let used = rawShares.reduce((sum, share) => sum + share.cents, 0);
  let remainder = totalCents - used;

  const ranked = [...rawShares].sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder;
    return a.bucket.priority - b.bucket.priority;
  });

  const allocationMap = new Map<string, number>();
  rawShares.forEach((share) => allocationMap.set(share.bucket.id, share.cents));

  let index = 0;
  while (remainder > 0 && ranked.length > 0) {
    const target = ranked[index % ranked.length];
    allocationMap.set(target.bucket.id, (allocationMap.get(target.bucket.id) || 0) + 1);
    remainder -= 1;
    index += 1;
  }

  return activeBuckets.map((bucket) => ({
    bucketId: bucket.id,
    bucketName: bucket.name,
    percent: bucket.percent,
    amount: fromCents(allocationMap.get(bucket.id) || 0),
    targetAccountId: bucket.targetAccountId || null,
  }));
};

export const smartAllocate = smartAllocateInternal;

const ensureUniqueName = (name: string, existingNames: string[]) => {
  const trimmed = name.trim();
  if (!trimmed) return trimmed;
  if (!existingNames.includes(trimmed)) return trimmed;

  let suffix = 2;
  while (existingNames.includes(`${trimmed} ${suffix}`)) {
    suffix += 1;
  }
  return `${trimmed} ${suffix}`;
};

export const useBudgetStore = create<BudgetState>()(
  persist(
    (set, get) => ({
      ...defaultState,

      addAccount: (account) => {
        const id = crypto.randomUUID();
        set((state) => ({
          accounts: [
            ...state.accounts,
            {
              ...account,
              id,
              name: ensureUniqueName(
                account.name,
                state.accounts.map((item) => item.name),
              ),
              openingBalance: Number(account.openingBalance || 0),
              createdAt: Date.now(),
            },
          ],
        }));
        return id;
      },

      updateAccount: (id, updates) =>
        set((state) => ({
          accounts: state.accounts.map((account) =>
            account.id === id
              ? {
                  ...account,
                  ...updates,
                  name: updates.name
                    ? ensureUniqueName(
                        updates.name,
                        state.accounts
                          .filter((item) => item.id !== id)
                          .map((item) => item.name),
                      )
                    : account.name,
                  openingBalance:
                    updates.openingBalance === undefined
                      ? account.openingBalance
                      : Number(updates.openingBalance),
                }
              : account,
          ),
        })),

      setAccountActive: (id, active) =>
        set((state) => ({
          accounts: state.accounts.map((account) =>
            account.id === id ? { ...account, active } : account,
          ),
        })),

      removeAccount: (id) =>
        set((state) => ({
          accounts: state.accounts.filter((account) => account.id !== id),
          allocationBuckets: state.allocationBuckets.map((bucket) =>
            bucket.targetAccountId === id
              ? { ...bucket, targetAccountId: null }
              : bucket,
          ),
        })),

      addCategory: (category) => {
        const id = crypto.randomUUID();
        set((state) => ({
          categories: [
            ...state.categories,
            {
              ...category,
              id,
              name: ensureUniqueName(
                category.name,
                state.categories.map((item) => item.name),
              ),
            },
          ],
        }));
        return id;
      },

      updateCategory: (id, updates) =>
        set((state) => ({
          categories: state.categories.map((category) =>
            category.id === id
              ? {
                  ...category,
                  ...updates,
                  name: updates.name
                    ? ensureUniqueName(
                        updates.name,
                        state.categories
                          .filter((item) => item.id !== id)
                          .map((item) => item.name),
                      )
                    : category.name,
                }
              : category,
          ),
        })),

      setCategoryActive: (id, active) =>
        set((state) => ({
          categories: state.categories.map((category) =>
            category.id === id ? { ...category, active } : category,
          ),
        })),

      removeCategory: (id) =>
        set((state) => ({
          categories: state.categories.filter((category) => category.id !== id),
        })),

      addTransaction: (transaction) => {
        const id = crypto.randomUUID();
        const nextTransaction: BudgetTransaction = {
          ...transaction,
          id,
          amount: Number(transaction.amount || 0),
        };

        set((state) => ({
          transactions: [nextTransaction, ...state.transactions],
        }));

        if (nextTransaction.type === "income" && get().autoAllocateIncome) {
          queueMicrotask(() => {
            get().runAllocationForIncome(id);
          });
        }

        return id;
      },

      deleteTransaction: (id) =>
        set((state) => ({
          transactions: state.transactions.filter((transaction) => transaction.id !== id),
        })),

      clearTransactions: () => set({ transactions: [] }),

      addAllocationBucket: (bucket) => {
        const id = crypto.randomUUID();
        set((state) => ({
          allocationBuckets: [
            ...state.allocationBuckets,
            {
              ...bucket,
              id,
              percent: Number(bucket.percent || 0),
              priority: Number(bucket.priority || state.allocationBuckets.length + 1),
            },
          ],
        }));
        return id;
      },

      updateAllocationBucket: (id, updates) =>
        set((state) => ({
          allocationBuckets: state.allocationBuckets.map((bucket) =>
            bucket.id === id
              ? {
                  ...bucket,
                  ...updates,
                  percent:
                    updates.percent === undefined
                      ? bucket.percent
                      : Number(updates.percent),
                  priority:
                    updates.priority === undefined
                      ? bucket.priority
                      : Number(updates.priority),
                }
              : bucket,
          ),
        })),

      setAllocationBuckets: (buckets) =>
        set({
          allocationBuckets: buckets.map((bucket, index) => ({
            ...bucket,
            percent: Number(bucket.percent || 0),
            priority: Number(bucket.priority || index + 1),
          })),
        }),

      removeAllocationBucket: (id) =>
        set((state) => ({
          allocationBuckets: state.allocationBuckets.filter((bucket) => bucket.id !== id),
        })),

      setAutoAllocateIncome: (enabled) => set({ autoAllocateIncome: enabled }),

      runAllocationForIncome: (transactionId) => {
        const state = get();
        const transaction = state.transactions.find((item) => item.id === transactionId);
        if (!transaction || transaction.type !== "income" || transaction.amount <= 0) {
          return [];
        }

        const activeBuckets = state.allocationBuckets.filter(
          (bucket) => bucket.active && bucket.percent > 0,
        );
        const previews = smartAllocateInternal(transaction.amount, activeBuckets);

        if (previews.length === 0) {
          return [];
        }

        set((current) => ({
          transactions: current.transactions.filter(
            (item) =>
              item.sourceTransactionId !== transactionId || !item.isAllocation,
          ),
        }));

        const allocationTransactions: BudgetTransaction[] = previews
          .filter((preview) => preview.targetAccountId)
          .map((preview) => ({
            id: crypto.randomUUID(),
            type: "transfer",
            accountId: transaction.accountId,
            linkedAccountId: preview.targetAccountId,
            categoryId: transaction.categoryId,
            amount: preview.amount,
            date: transaction.date,
            note: `Auto-allocation: ${preview.bucketName}`,
            sourceTransactionId: transactionId,
            allocationBucketId: preview.bucketId,
            isAllocation: true,
          }));

        if (allocationTransactions.length > 0) {
          set((current) => ({
            transactions: [...allocationTransactions, ...current.transactions],
          }));
        }

        return previews;
      },
    }),
    {
      name: "omni-budget-storage",
      partialize: (state) => ({
        accounts: state.accounts,
        categories: state.categories,
        transactions: state.transactions,
        allocationBuckets: state.allocationBuckets,
        autoAllocateIncome: state.autoAllocateIncome,
      }),
    },
  ),
);
