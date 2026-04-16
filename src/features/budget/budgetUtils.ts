import type {
  AllocationBucket,
  BudgetAccount,
  BudgetPeriod,
  BudgetTransaction,
} from "../../core/store/budgetStore";

export const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export const formatCurrency = (value: number) => currencyFormatter.format(value || 0);

export const formatCompactCurrency = (value: number) => {
  const abs = Math.abs(value || 0);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  return `${sign}${currencyFormatter.format(abs)}`;
};

export const toDateKey = (date: string | Date) => {
  const value = typeof date === "string" ? new Date(date) : date;
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const formatDateLabel = (dateKey: string) => {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getStartOfWeek = (date: Date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  const day = value.getDay();
  const diff = value.getDate() - day + (day === 0 ? -6 : 1);
  value.setDate(diff);
  return value;
};

const getStartOfMonth = (date: Date) => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  value.setDate(1);
  return value;
};

export const getPeriodRange = (period: BudgetPeriod, now = new Date()) => {
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (period === "day") {
    return { start, end };
  }

  if (period === "week") {
    return { start: getStartOfWeek(now), end };
  }

  return { start: getStartOfMonth(now), end };
};

export const isWithinPeriod = (
  dateValue: string,
  period: BudgetPeriod,
  now = new Date(),
) => {
  const date = new Date(dateValue);
  const { start, end } = getPeriodRange(period, now);
  return date >= start && date <= end;
};

export const getTransactionImpact = (
  transaction: BudgetTransaction,
  accountId: string,
) => {
  if (transaction.type === "income") {
    return transaction.accountId === accountId ? transaction.amount : 0;
  }

  if (transaction.type === "expense") {
    return transaction.accountId === accountId ? -transaction.amount : 0;
  }

  if (transaction.type === "transfer") {
    if (transaction.accountId === accountId) return -transaction.amount;
    if (transaction.linkedAccountId === accountId) return transaction.amount;
  }

  return 0;
};

export const calculateAccountBalance = (
  account: BudgetAccount,
  transactions: BudgetTransaction[],
) => {
  return transactions.reduce(
    (sum, transaction) => sum + getTransactionImpact(transaction, account.id),
    account.openingBalance,
  );
};

export const calculateNetWorth = (
  accounts: BudgetAccount[],
  transactions: BudgetTransaction[],
) => {
  return accounts
    .filter((account) => account.active)
    .reduce((sum, account) => sum + calculateAccountBalance(account, transactions), 0);
};

export const sumPeriodTotals = (
  transactions: BudgetTransaction[],
  period: BudgetPeriod,
  now = new Date(),
) => {
  return transactions.reduce(
    (acc, transaction) => {
      if (!isWithinPeriod(transaction.date, period, now)) {
        return acc;
      }

      if (transaction.type === "income") {
        acc.income += transaction.amount;
      }

      if (transaction.type === "expense") {
        acc.expense += transaction.amount;
      }

      return acc;
    },
    { income: 0, expense: 0 },
  );
};

export const smartAllocate = (
  amount: number,
  buckets: AllocationBucket[],
) => {
  const activeBuckets = buckets
    .filter((bucket) => bucket.active && bucket.percent > 0)
    .sort((a, b) => a.priority - b.priority || b.percent - a.percent);

  if (amount <= 0 || activeBuckets.length === 0) {
    return [] as Array<{
      bucketId: string;
      bucketName: string;
      percent: number;
      amount: number;
      targetAccountId?: string | null;
    }>;
  }

  const totalPercent = activeBuckets.reduce(
    (sum, bucket) => sum + bucket.percent,
    0,
  );

  if (totalPercent <= 0) {
    return [] as Array<{
      bucketId: string;
      bucketName: string;
      percent: number;
      amount: number;
      targetAccountId?: string | null;
    }>;
  }

  const totalCents = Math.round(amount * 100);
  const rawShares = activeBuckets.map((bucket) => {
    const exact = (totalCents * bucket.percent) / totalPercent;
    const base = Math.floor(exact);
    return {
      bucket,
      exact,
      cents: base,
      remainder: exact - base,
    };
  });

  let remainder = totalCents - rawShares.reduce((sum, item) => sum + item.cents, 0);
  const centMap = new Map<string, number>();
  rawShares.forEach((item) => centMap.set(item.bucket.id, item.cents));

  const ranked = [...rawShares].sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder;
    return a.bucket.priority - b.bucket.priority;
  });

  let index = 0;
  while (remainder > 0 && ranked.length > 0) {
    const target = ranked[index % ranked.length];
    centMap.set(target.bucket.id, (centMap.get(target.bucket.id) || 0) + 1);
    remainder -= 1;
    index += 1;
  }

  return activeBuckets.map((bucket) => ({
    bucketId: bucket.id,
    bucketName: bucket.name,
    percent: bucket.percent,
    amount: (centMap.get(bucket.id) || 0) / 100,
    targetAccountId: bucket.targetAccountId || null,
  }));
};

export const getDailySeries = (
  transactions: BudgetTransaction[],
  days = 30,
) => {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  const labels: string[] = [];
  const income: number[] = [];
  const expense: number[] = [];

  for (let i = 0; i < days; i += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = toDateKey(date);
    labels.push(date.toLocaleDateString("en-US", { month: "short", day: "numeric" }));

    const dayTotals = transactions.reduce(
      (acc, transaction) => {
        if (toDateKey(transaction.date) !== key) return acc;
        if (transaction.type === "income") acc.income += transaction.amount;
        if (transaction.type === "expense") acc.expense += transaction.amount;
        return acc;
      },
      { income: 0, expense: 0 },
    );

    income.push(dayTotals.income);
    expense.push(dayTotals.expense);
  }

  return { labels, income, expense };
};

export const getCategoryBreakdown = (
  transactions: BudgetTransaction[],
  type: "income" | "expense",
  period: BudgetPeriod,
  now = new Date(),
) => {
  const map = new Map<string, number>();

  transactions.forEach((transaction) => {
    if (transaction.type !== type || !isWithinPeriod(transaction.date, period, now)) {
      return;
    }
    map.set(transaction.categoryId, (map.get(transaction.categoryId) || 0) + transaction.amount);
  });

  return map;
};

export const estimateFutureBalance = ({
  startingBalance,
  monthlyIncome,
  monthlyExpenses,
  months,
  annualGrowthRate,
}: {
  startingBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  months: number;
  annualGrowthRate: number;
}) => {
  const monthlyRate = annualGrowthRate / 12 / 100;
  const labels: string[] = [];
  const values: number[] = [];
  let balance = startingBalance;

  for (let i = 0; i <= months; i += 1) {
    if (i > 0) {
      balance = balance * (1 + monthlyRate) + monthlyIncome - monthlyExpenses;
    }
    labels.push(`M${i}`);
    values.push(Number(balance.toFixed(2)));
  }

  return {
    labels,
    values,
    endingBalance: Number(balance.toFixed(2)),
    profitLoss: Number((balance - startingBalance).toFixed(2)),
  };
};
