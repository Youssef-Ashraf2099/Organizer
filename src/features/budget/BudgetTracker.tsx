import { useMemo, useState } from "react";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Title,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { FaArrowDown } from "@react-icons/all-files/fa/FaArrowDown";
import { FaArrowUp } from "@react-icons/all-files/fa/FaArrowUp";
import { FaChartBar } from "@react-icons/all-files/fa/FaChartBar";
import { FaChartLine } from "@react-icons/all-files/fa/FaChartLine";
import { FaChartPie } from "@react-icons/all-files/fa/FaChartPie";
import { FaCoins } from "@react-icons/all-files/fa/FaCoins";
import { FaDollarSign } from "@react-icons/all-files/fa/FaDollarSign";
import { FaEye } from "@react-icons/all-files/fa/FaEye";
import { FaEyeSlash } from "@react-icons/all-files/fa/FaEyeSlash";
import { FaCheckCircle } from "@react-icons/all-files/fa/FaCheckCircle";
import { FaPlus } from "@react-icons/all-files/fa/FaPlus";
import { FaPercent } from "@react-icons/all-files/fa/FaPercent";
import { FaRedo } from "@react-icons/all-files/fa/FaRedo";
import { FaTrash } from "@react-icons/all-files/fa/FaTrash";
import { FaWallet } from "@react-icons/all-files/fa/FaWallet";
import { FaCalculator } from "@react-icons/all-files/fa/FaCalculator";
import { FaExchangeAlt } from "@react-icons/all-files/fa/FaExchangeAlt";
import { useBudgetStore, type AllocationBucket, type BudgetAccountType, type BudgetCategoryType, type BudgetPeriod } from "../../core/store/budgetStore";
import {
  calculateAccountBalance,
  calculateNetWorth,
  estimateFutureBalance,
  formatCurrency,
  formatDateLabel,
  getCategoryBreakdown,
  getDailySeries,
  getPeriodRange,
  isWithinPeriod,
  smartAllocate,
  sumPeriodTotals,
  toDateKey,
} from "./budgetUtils";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Title,
  Filler,
);

type BudgetSection =
  | "overview"
  | "accounts"
  | "transactions"
  | "allocation"
  | "analytics"
  | "estimator";

const accountTypes: Array<{ value: BudgetAccountType; label: string }> = [
  { value: "bank", label: "Bank" },
  { value: "wallet", label: "Wallet" },
  { value: "e-wallet", label: "E-Wallet" },
  { value: "cash", label: "Cash" },
  { value: "investment", label: "Investment" },
  { value: "savings", label: "Savings" },
  { value: "other", label: "Other" },
];

const categoryTypes: Array<{ value: BudgetCategoryType; label: string }> = [
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
  { value: "both", label: "Both" },
];

const periodOptions: Array<{ value: BudgetPeriod; label: string }> = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

const colorPalette = [
  "#3b82f6",
  "#22c55e",
  "#a855f7",
  "#f97316",
  "#06b6d4",
  "#ec4899",
  "#f59e0b",
  "#ef4444",
];

export const BudgetTracker = () => {
  const [section, setSection] = useState<BudgetSection>("overview");
  const [period, setPeriod] = useState<BudgetPeriod>("month");
  const [previewIncome, setPreviewIncome] = useState(1000);

  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState<BudgetAccountType>("wallet");
  const [accountCurrency, setAccountCurrency] = useState("USD");
  const [accountOpeningBalance, setAccountOpeningBalance] = useState(0);
  const [accountColor, setAccountColor] = useState("#22c55e");

  const [categoryName, setCategoryName] = useState("");
  const [categoryType, setCategoryType] = useState<BudgetCategoryType>("expense");
  const [categoryColor, setCategoryColor] = useState("#ef4444");

  const [transactionType, setTransactionType] = useState<"income" | "expense" | "transfer">("expense");
  const [transactionAccountId, setTransactionAccountId] = useState("");
  const [transactionTargetAccountId, setTransactionTargetAccountId] = useState("");
  const [transactionCategoryId, setTransactionCategoryId] = useState("");
  const [transactionAmount, setTransactionAmount] = useState(0);
  const [transactionDate, setTransactionDate] = useState(toDateKey(new Date()));
  const [transactionNote, setTransactionNote] = useState("");

  const [bucketName, setBucketName] = useState("");
  const [bucketPercent, setBucketPercent] = useState(20);
  const [bucketPriority, setBucketPriority] = useState(1);
  const [bucketColor, setBucketColor] = useState("#3b82f6");
  const [bucketTargetAccountId, setBucketTargetAccountId] = useState("");

  const [initialAmount, setInitialAmount] = useState(1000);
  const [monthlyIncome, setMonthlyIncome] = useState(2500);
  const [monthlyExpenses, setMonthlyExpenses] = useState(1800);
  const [monthsAhead, setMonthsAhead] = useState(12);
  const [annualGrowthRate, setAnnualGrowthRate] = useState(8);

  const accounts = useBudgetStore((state) => state.accounts);
  const categories = useBudgetStore((state) => state.categories);
  const transactions = useBudgetStore((state) => state.transactions);
  const allocationBuckets = useBudgetStore((state) => state.allocationBuckets);
  const autoAllocateIncome = useBudgetStore((state) => state.autoAllocateIncome);

  const addAccount = useBudgetStore((state) => state.addAccount);
  const updateAccount = useBudgetStore((state) => state.updateAccount);
  const setAccountActive = useBudgetStore((state) => state.setAccountActive);
  const removeAccount = useBudgetStore((state) => state.removeAccount);

  const addCategory = useBudgetStore((state) => state.addCategory);
  const setCategoryActive = useBudgetStore((state) => state.setCategoryActive);
  const removeCategory = useBudgetStore((state) => state.removeCategory);

  const addTransaction = useBudgetStore((state) => state.addTransaction);
  const deleteTransaction = useBudgetStore((state) => state.deleteTransaction);
  const clearTransactions = useBudgetStore((state) => state.clearTransactions);

  const addAllocationBucket = useBudgetStore((state) => state.addAllocationBucket);
  const updateAllocationBucket = useBudgetStore((state) => state.updateAllocationBucket);
  const setAllocationBuckets = useBudgetStore((state) => state.setAllocationBuckets);
  const removeAllocationBucket = useBudgetStore((state) => state.removeAllocationBucket);
  const setAutoAllocateIncome = useBudgetStore((state) => state.setAutoAllocateIncome);
  const runAllocationForIncome = useBudgetStore((state) => state.runAllocationForIncome);

  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.active),
    [accounts],
  );

  const inactiveAccounts = useMemo(
    () => accounts.filter((account) => !account.active),
    [accounts],
  );

  const accountBalances = useMemo(
    () =>
      accounts.map((account) => ({
        ...account,
        balance: calculateAccountBalance(account, transactions),
      })),
    [accounts, transactions],
  );

  const netWorth = useMemo(
    () => calculateNetWorth(accounts, transactions),
    [accounts, transactions],
  );

  const periodTotals = useMemo(
    () => sumPeriodTotals(transactions, period),
    [transactions, period],
  );

  const periodTransactions = useMemo(
    () =>
      transactions.filter((transaction) => isWithinPeriod(transaction.date, period)),
    [transactions, period],
  );

  const balanceSeries = useMemo(() => {
    const { start } = getPeriodRange(period);
    const end = new Date();
    const labels: string[] = [];
    const values: number[] = [];

    const days = Math.max(
      1,
      Math.ceil((end.getTime() - start.getTime()) / 86_400_000) + 1,
    );

    for (let i = 0; i < days; i += 1) {
      const cursor = new Date(start);
      cursor.setDate(start.getDate() + i);
      const cutoff = cursor.getTime();

      const balance = accounts.reduce((accountTotal, account) => {
        const accountImpact = transactions.reduce((sum, transaction) => {
          const transactionDate = new Date(transaction.date).getTime();
          if (transactionDate > cutoff) return sum;
          if (transaction.type === "income") {
            return transaction.accountId === account.id ? sum + transaction.amount : sum;
          }
          if (transaction.type === "expense") {
            return transaction.accountId === account.id ? sum - transaction.amount : sum;
          }
          if (transaction.type === "transfer") {
            if (transaction.accountId === account.id) return sum - transaction.amount;
            if (transaction.linkedAccountId === account.id) return sum + transaction.amount;
          }
          return sum;
        }, account.openingBalance);
        return accountTotal + accountImpact;
      }, 0);

      labels.push(cursor.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
      values.push(Number(balance.toFixed(2)));
    }

    return { labels, values };
  }, [accounts, transactions, period]);

  const periodSeries = useMemo(
    () => getDailySeries(periodTransactions, balanceSeries.labels.length),
    [periodTransactions, balanceSeries.labels.length],
  );

  const categoryBreakdown = useMemo(
    () => getCategoryBreakdown(transactions, "expense", period),
    [transactions, period],
  );

  const incomeBreakdown = useMemo(
    () => getCategoryBreakdown(transactions, "income", period),
    [transactions, period],
  );

  const chartData = useMemo(() => {
    const lineColor = "rgba(59,130,246,0.85)";
    return {
      labels: balanceSeries.labels,
      datasets: [
        {
          label: "Income",
          data: periodSeries.income,
          borderColor: "rgba(34,197,94,0.9)",
          backgroundColor: "rgba(34,197,94,0.25)",
          tension: 0.35,
          fill: true,
        },
        {
          label: "Expenses",
          data: periodSeries.expense,
          borderColor: "rgba(239,68,68,0.9)",
          backgroundColor: "rgba(239,68,68,0.22)",
          tension: 0.35,
          fill: true,
        },
        {
          label: "Total Balance",
          data: balanceSeries.values,
          borderColor: lineColor,
          backgroundColor: "rgba(59,130,246,0.12)",
          tension: 0.3,
          fill: false,
        },
      ],
    };
  }, [balanceSeries, periodSeries]);

  const expensePieData = useMemo(() => {
    const entries = [...categoryBreakdown.entries()].sort((a, b) => b[1] - a[1]);
    return {
      labels: entries.map(([categoryId]) => categories.find((category) => category.id === categoryId)?.name || "Unknown"),
      datasets: [
        {
          data: entries.map(([, amount]) => amount),
          backgroundColor: entries.map((entry, index) => {
            const category = categories.find((item) => item.id === entry[0]);
            return category?.color || colorPalette[index % colorPalette.length];
          }),
          borderWidth: 0,
        },
      ],
    };
  }, [categoryBreakdown, categories]);

  const incomePieData = useMemo(() => {
    const entries = [...incomeBreakdown.entries()].sort((a, b) => b[1] - a[1]);
    return {
      labels: entries.map(([categoryId]) => categories.find((category) => category.id === categoryId)?.name || "Unknown"),
      datasets: [
        {
          data: entries.map(([, amount]) => amount),
          backgroundColor: entries.map((entry, index) => {
            const category = categories.find((item) => item.id === entry[0]);
            return category?.color || colorPalette[index % colorPalette.length];
          }),
          borderWidth: 0,
        },
      ],
    };
  }, [incomeBreakdown, categories]);

  const allocationPreview = useMemo(
    () => smartAllocate(previewIncome, allocationBuckets),
    [previewIncome, allocationBuckets],
  );

  const allocationTotal = useMemo(
    () => allocationBuckets.reduce((sum, bucket) => sum + bucket.percent, 0),
    [allocationBuckets],
  );

  const currentBalanceText = formatCurrency(netWorth);
  const incomeText = formatCurrency(periodTotals.income);
  const expenseText = formatCurrency(periodTotals.expense);
  const netText = formatCurrency(periodTotals.income - periodTotals.expense);
  const savingsRate = periodTotals.income > 0 ? ((periodTotals.income - periodTotals.expense) / periodTotals.income) * 100 : 0;

  const sortedTransactions = useMemo(
    () =>
      [...transactions].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [transactions],
  );

  const estimation = useMemo(
    () =>
      estimateFutureBalance({
        startingBalance: initialAmount,
        monthlyIncome,
        monthlyExpenses,
        months: monthsAhead,
        annualGrowthRate,
      }),
    [initialAmount, monthlyIncome, monthlyExpenses, monthsAhead, annualGrowthRate],
  );

  const estimationData = useMemo(
    () => ({
      labels: estimation.labels,
      datasets: [
        {
          label: "Projected Balance",
          data: estimation.values,
          borderColor: "rgba(34,197,94,0.9)",
          backgroundColor: "rgba(34,197,94,0.18)",
          fill: true,
          tension: 0.35,
        },
      ],
    }),
    [estimation],
  );

  const handleAddAccount = () => {
    if (!accountName.trim()) return;
    addAccount({
      name: accountName,
      type: accountType,
      currency: accountCurrency,
      color: accountColor,
      openingBalance: accountOpeningBalance,
      active: true,
    });
    setAccountName("");
    setAccountOpeningBalance(0);
  };

  const handleAddCategory = () => {
    if (!categoryName.trim()) return;
    addCategory({
      name: categoryName,
      type: categoryType,
      color: categoryColor,
      active: true,
      isCustom: true,
    });
    setCategoryName("");
  };

  const handleAddTransaction = () => {
    if (!transactionAccountId || transactionAmount <= 0) return;
    const effectiveCategory =
      transactionType === "transfer"
        ? categories.find((category) => category.type === "both")?.id || categories[0]?.id || "transfer"
        : transactionCategoryId;

    addTransaction({
      type: transactionType,
      accountId: transactionAccountId,
      linkedAccountId:
        transactionType === "transfer" && transactionTargetAccountId
          ? transactionTargetAccountId
          : null,
      categoryId: effectiveCategory,
      amount: transactionAmount,
      date: new Date(transactionDate).toISOString(),
      note: transactionNote,
      sourceTransactionId: null,
      allocationBucketId: null,
      isAllocation: false,
    });

    setTransactionAmount(0);
    setTransactionNote("");
  };

  const handleAddBucket = () => {
    if (!bucketName.trim()) return;
    addAllocationBucket({
      name: bucketName,
      percent: bucketPercent,
      color: bucketColor,
      active: true,
      priority: bucketPriority,
      targetAccountId: bucketTargetAccountId || null,
    });
    setBucketName("");
  };

  const handleAutoAllocateNow = () => {
    const incomeTx = sortedTransactions.find((transaction) => transaction.type === "income");
    if (incomeTx) {
      runAllocationForIncome(incomeTx.id);
    }
  };

  const normalizeBuckets = () => {
    const total = allocationBuckets.reduce((sum, bucket) => sum + bucket.percent, 0);
    if (total <= 0) return;

    setAllocationBuckets(
      allocationBuckets.map((bucket, index) => ({
        ...bucket,
        percent: Number(((bucket.percent / total) * 100).toFixed(2)),
        priority: bucket.priority || index + 1,
      })),
    );
  };

  const applyPreset = (preset: Array<{ name: string; percent: number; color: string }>) => {
    const buckets: AllocationBucket[] = preset.map((item, index) => ({
      id: crypto.randomUUID(),
      name: item.name,
      percent: item.percent,
      color: item.color,
      active: true,
      priority: index + 1,
      targetAccountId: null,
    }));
    setAllocationBuckets(buckets);
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: "#94a3b8",
        },
      },
    },
    scales: {
      x: {
        ticks: { color: "#94a3b8" },
        grid: { color: "rgba(148,163,184,0.12)" },
      },
      y: {
        ticks: {
          color: "#94a3b8",
          callback: (value: string | number) => formatCurrency(Number(value)),
        },
        grid: { color: "rgba(148,163,184,0.12)" },
      },
    },
  };

  return (
    <div className="bg-gradient-to-b from-zinc-50 via-white to-zinc-100 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900">
      <div className="p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              <FaWallet className="text-emerald-500" />
              Budget Tracker
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Track income, expenses, balances, allocation plans, and future estimates in one place.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1 shadow-sm">
            {periodOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => setPeriod(option.value)}
                className={`px-3 py-1.5 text-sm rounded-lg transition ${period === option.value ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900/50 border border-zinc-800/40 rounded-2xl p-6">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-zinc-800/50">
            <div className="flex flex-col xl:pl-0">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <FaDollarSign className="text-emerald-400" size={14} />
                </div>
                <span className="text-sm font-medium text-zinc-400">Net Worth</span>
              </div>
              <div className="text-3xl font-bold text-zinc-100">{currentBalanceText}</div>
              <p className="mt-1 text-xs text-zinc-500">{activeAccounts.length} active accounts</p>
            </div>

            <div className="flex flex-col pt-6 md:pt-0 md:pl-8">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <FaArrowUp className="text-blue-400" size={14} />
                </div>
                <span className="text-sm font-medium text-zinc-400">Income</span>
              </div>
              <div className="text-3xl font-bold text-zinc-100">{incomeText}</div>
              <p className="mt-1 text-xs text-zinc-500">Collected in period</p>
            </div>

            <div className="flex flex-col pt-6 md:pt-0 xl:pl-8">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center">
                  <FaArrowDown className="text-rose-400" size={14} />
                </div>
                <span className="text-sm font-medium text-zinc-400">Expenses</span>
              </div>
              <div className="text-3xl font-bold text-zinc-100">{expenseText}</div>
              <p className="mt-1 text-xs text-zinc-500">Spent in period</p>
            </div>

            <div className="flex flex-col pt-6 md:pt-0 md:pl-8 xl:pl-8">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center">
                  <FaPercent className="text-indigo-400" size={14} />
                </div>
                <span className="text-sm font-medium text-zinc-400">Savings Rate</span>
              </div>
              <div className="text-3xl font-bold text-zinc-100">{formatPercent(savingsRate)}</div>
              <p className="mt-1 text-xs text-zinc-500">Net: {netText}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 pb-4">
          {[
            { key: "overview", label: "Overview", icon: FaChartBar },
            { key: "accounts", label: "Accounts", icon: FaWallet },
            { key: "transactions", label: "Transactions", icon: FaExchangeAlt },
            { key: "allocation", label: "Allocation", icon: FaCoins },
            { key: "analytics", label: "Analytics", icon: FaChartPie },
            { key: "estimator", label: "Estimator", icon: FaCalculator },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => setSection(item.key as BudgetSection)}
                className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all ${section === item.key ? "bg-zinc-800 text-white shadow-md border border-zinc-700" : "bg-zinc-900/50 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 border border-transparent"}`}
              >
                <Icon size={12} />
                {item.label}
              </button>
            );
          })}
        </div>

        {section === "overview" && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <div className="xl:col-span-2 space-y-6">
              <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-6 shadow-sm">
                <div className="flex items-center justify-between gap-3 mb-6">
                  <h2 className="text-lg font-semibold text-zinc-100">Account Balances</h2>
                  <span className="text-xs text-zinc-500">Balances include opening amounts and transfers</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {accountBalances.map((account) => (
                    <div key={account.id} className="rounded-xl border border-zinc-800/60 p-4 bg-zinc-900/60 hover:bg-zinc-800/40 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: account.color }} />
                            {account.name}
                          </div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">{account.type} · {account.currency}</p>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${account.active ? "bg-emerald-500/15 text-emerald-600" : "bg-zinc-500/15 text-zinc-500"}`}>{account.active ? "Active" : "Inactive"}</span>
                      </div>
                      <div className="mt-4 text-xl font-bold text-zinc-900 dark:text-zinc-50">{formatCurrency(account.balance)}</div>
                      <div className="mt-2 flex gap-2 text-xs">
                        <button onClick={() => setAccountActive(account.id, !account.active)} className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-2 py-1 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
                          {account.active ? <><FaEyeSlash className="inline mr-1" />Deactivate</> : <><FaEye className="inline mr-1" />Restore</>}
                        </button>
                        <button onClick={() => removeAccount(account.id)} className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-red-600 hover:bg-red-100 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                          <FaTrash className="inline mr-1" />Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  {accountBalances.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-zinc-400 md:col-span-2 xl:col-span-3">
                      No accounts yet. Add your bank, wallet, or e-wallet to start tracking balances.
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                    <FaChartLine className="text-blue-500" />
                    Period Trend
                  </h2>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Income vs expenses vs balance</span>
                </div>
                <div className="h-80">
                  <Line data={chartData} options={chartOptions as any} />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-3">Quick Allocation Preview</h2>
                <label className="block text-sm text-zinc-500 dark:text-zinc-400 mb-2">Preview income amount</label>
                <input
                  type="number"
                  value={previewIncome}
                  onChange={(e) => setPreviewIncome(Number(e.target.value))}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-50"
                />
                <div className="mt-4 space-y-2">
                  {allocationPreview.map((preview) => (
                    <div key={preview.bucketId} className="flex items-center justify-between rounded-xl bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: allocationBuckets.find((bucket) => bucket.id === preview.bucketId)?.color || "#3b82f6" }} />
                        <span className="text-zinc-700 dark:text-zinc-300">{preview.bucketName}</span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-50">{formatCurrency(preview.amount)}</div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{formatPercent(preview.percent)}</div>
                      </div>
                    </div>
                  ))}
                  {allocationPreview.length === 0 && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Add allocation buckets to see automatic splits.</p>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={handleAutoAllocateNow} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700">
                    Auto-allocate latest income
                  </button>
                  <button onClick={() => setAutoAllocateIncome(!autoAllocateIncome)} className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {autoAllocateIncome ? "Auto-allocation ON" : "Auto-allocation OFF"}
                  </button>
                  <button onClick={normalizeBuckets} className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    <FaRedo size={12} /> Normalize
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-3">Recent Activity</h2>
                <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                  {sortedTransactions.slice(0, 8).map((transaction) => {
                    const account = accounts.find((item) => item.id === transaction.accountId);
                    const category = categories.find((item) => item.id === transaction.categoryId);
                    const color = transaction.type === "income" ? "text-emerald-600" : transaction.type === "expense" ? "text-red-600" : "text-blue-600";
                    return (
                      <div key={transaction.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50 dark:bg-zinc-950/60">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                              {transaction.type === "income" ? <FaArrowUp className="text-emerald-500" /> : transaction.type === "expense" ? <FaArrowDown className="text-red-500" /> : <FaExchangeAlt className="text-blue-500" />}
                              {category?.name || "Transfer"}
                            </div>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">
                              {account?.name || "Unknown account"} · {formatDateLabel(toDateKey(transaction.date))}
                            </p>
                            {transaction.note && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{transaction.note}</p>}
                          </div>
                          <div className={`text-sm font-bold ${color}`}>{transaction.type === "expense" ? "-" : "+"}{formatCurrency(transaction.amount)}</div>
                        </div>
                      </div>
                    );
                  })}
                  {sortedTransactions.length === 0 && (
                    <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-4 text-sm text-zinc-500 dark:text-zinc-400">
                      No transactions yet. Add income or expenses to see activity.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {section === "accounts" && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Add Account</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input value={accountName} onChange={(e) => setAccountName(e.target.value)} placeholder="Bank 1 / App Wallet / Cash" className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm" />
                <select value={accountType} onChange={(e) => setAccountType(e.target.value as BudgetAccountType)} className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm">
                  {accountTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
                <input value={accountCurrency} onChange={(e) => setAccountCurrency(e.target.value.toUpperCase())} placeholder="USD" className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm" />
                <input type="number" value={accountOpeningBalance} onChange={(e) => setAccountOpeningBalance(Number(e.target.value))} placeholder="Opening balance" className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm" />
                <input type="color" value={accountColor} onChange={(e) => setAccountColor(e.target.value)} className="h-11 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1" />
              </div>
              <button onClick={handleAddAccount} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
                <FaPlus size={12} />
                Add account
              </button>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Manage Accounts</h2>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">Deactivate or remove accounts you no longer use</span>
              </div>
              <div className="space-y-3 max-h-[540px] overflow-y-auto pr-1">
                {accounts.map((account) => (
                  <div key={account.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50 dark:bg-zinc-950/60">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: account.color }} />
                          {account.name}
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">{account.type} · {account.currency}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Opening balance: {formatCurrency(account.openingBalance)}</p>
                      </div>
                      <div className={`rounded-full px-2 py-1 text-[11px] font-semibold ${account.active ? "bg-emerald-500/15 text-emerald-600" : "bg-zinc-500/15 text-zinc-500"}`}>{account.active ? "Active" : "Inactive"}</div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button onClick={() => updateAccount(account.id, { name: `${account.name}` })} className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                        Edit later
                      </button>
                      <button onClick={() => setAccountActive(account.id, !account.active)} className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                        {account.active ? "Deactivate" : "Restore"}
                      </button>
                      <button onClick={() => removeAccount(account.id)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                {inactiveAccounts.length > 0 && (
                  <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-4">
                    <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Inactive accounts</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Hidden from active planning but preserved in history.</p>
                  </div>
                )}
                {accounts.length === 0 && <p className="text-sm text-zinc-500 dark:text-zinc-400">No accounts yet.</p>}
              </div>
            </div>
          </div>
        )}

        {section === "transactions" && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Add Transaction</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <select value={transactionType} onChange={(e) => setTransactionType(e.target.value as typeof transactionType)} className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm">
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                  <option value="transfer">Transfer</option>
                </select>
                <select value={transactionAccountId} onChange={(e) => setTransactionAccountId(e.target.value)} className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm">
                  <option value="">Select account</option>
                  {activeAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
                {transactionType === "transfer" ? (
                  <select value={transactionTargetAccountId} onChange={(e) => setTransactionTargetAccountId(e.target.value)} className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm">
                    <option value="">Target account</option>
                    {accounts.filter((account) => account.id !== transactionAccountId).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                  </select>
                ) : (
                  <select value={transactionCategoryId} onChange={(e) => setTransactionCategoryId(e.target.value)} className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm">
                    <option value="">Select category</option>
                    {categories
                      .filter((category) => category.type === transactionType || category.type === "both")
                      .map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                )}
                <input type="number" value={transactionAmount} onChange={(e) => setTransactionAmount(Number(e.target.value))} placeholder="Amount" className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm" />
                <input type="date" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm" />
                <input value={transactionNote} onChange={(e) => setTransactionNote(e.target.value)} placeholder="Note" className="md:col-span-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm" />
              </div>
              <button onClick={handleAddTransaction} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
                <FaPlus size={12} />
                Save transaction
              </button>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Transaction History</h2>
                <button onClick={clearTransactions} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                  Clear all
                </button>
              </div>
              <div className="space-y-3 max-h-[620px] overflow-y-auto pr-1">
                {sortedTransactions.map((transaction) => {
                  const account = accounts.find((item) => item.id === transaction.accountId);
                  const targetAccount = accounts.find((item) => item.id === transaction.linkedAccountId);
                  const category = categories.find((item) => item.id === transaction.categoryId);
                  const amountClass = transaction.type === "income" ? "text-emerald-600" : transaction.type === "expense" ? "text-red-600" : "text-blue-600";
                  return (
                    <div key={transaction.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50 dark:bg-zinc-950/60">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                            {transaction.type === "income" ? <FaArrowUp className="text-emerald-500" /> : transaction.type === "expense" ? <FaArrowDown className="text-red-500" /> : <FaExchangeAlt className="text-blue-500" />}
                            {category?.name || (transaction.type === "transfer" ? "Transfer" : "Uncategorized")}
                          </div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">
                            {account?.name || "Unknown account"}
                            {targetAccount ? ` → ${targetAccount.name}` : ""}
                            {transaction.note ? ` · ${transaction.note}` : ""}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{formatDateLabel(toDateKey(transaction.date))}</p>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-bold ${amountClass}`}>{transaction.type === "expense" ? "-" : "+"}{formatCurrency(transaction.amount)}</div>
                          <button onClick={() => deleteTransaction(transaction.id)} className="mt-2 inline-flex items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 px-2 py-1 text-[11px] text-zinc-500 dark:text-zinc-300">
                            <FaTrash size={10} /> Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {sortedTransactions.length === 0 && <p className="text-sm text-zinc-500 dark:text-zinc-400">No transactions yet.</p>}
              </div>
            </div>
          </div>
        )}

        {section === "allocation" && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Allocation Buckets</h2>
                <div className="flex gap-2">
                  <button onClick={() => applyPreset([
                    { name: "Needs", percent: 50, color: "#3b82f6" },
                    { name: "Savings", percent: 20, color: "#22c55e" },
                    { name: "Investments", percent: 30, color: "#a855f7" },
                  ])} className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                    50/20/30
                  </button>
                  <button onClick={() => applyPreset([
                    { name: "Needs", percent: 50, color: "#3b82f6" },
                    { name: "Savings", percent: 20, color: "#22c55e" },
                    { name: "Investments", percent: 20, color: "#a855f7" },
                    { name: "Fun", percent: 10, color: "#f97316" },
                  ])} className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                    50/20/20/10
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input value={bucketName} onChange={(e) => setBucketName(e.target.value)} placeholder="Bucket name" className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm" />
                <input type="number" value={bucketPercent} onChange={(e) => setBucketPercent(Number(e.target.value))} placeholder="Percent" className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm" />
                <input type="number" value={bucketPriority} onChange={(e) => setBucketPriority(Number(e.target.value))} placeholder="Priority" className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm" />
                <select value={bucketTargetAccountId} onChange={(e) => setBucketTargetAccountId(e.target.value)} className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm">
                  <option value="">No target account</option>
                  {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
                <input type="color" value={bucketColor} onChange={(e) => setBucketColor(e.target.value)} className="h-11 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1" />
              </div>
              <button onClick={handleAddBucket} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700">
                <FaPlus size={12} /> Add bucket
              </button>
              <div className="mt-5 space-y-3">
                {allocationBuckets.map((bucket) => (
                  <div key={bucket.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50 dark:bg-zinc-950/60">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: bucket.color }} />
                          {bucket.name}
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{formatPercent(bucket.percent)} · Priority {bucket.priority}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateAllocationBucket(bucket.id, { active: !bucket.active })} className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-2 py-1 text-xs text-zinc-600 dark:text-zinc-300">
                          {bucket.active ? "On" : "Off"}
                        </button>
                        <button onClick={() => removeAllocationBucket(bucket.id)} className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                      <input type="number" value={bucket.percent} onChange={(e) => updateAllocationBucket(bucket.id, { percent: Number(e.target.value) })} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm" />
                      <input type="number" value={bucket.priority} onChange={(e) => updateAllocationBucket(bucket.id, { priority: Number(e.target.value) })} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm" />
                      <select value={bucket.targetAccountId || ""} onChange={(e) => updateAllocationBucket(bucket.id, { targetAccountId: e.target.value || null })} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm">
                        <option value="">No target account</option>
                        {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
                {allocationBuckets.length === 0 && <p className="text-sm text-zinc-500 dark:text-zinc-400">No allocation buckets yet.</p>}
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-700 px-4 py-3 text-sm">
                <span className="text-zinc-600 dark:text-zinc-300">Total allocation</span>
                <span className={`font-semibold inline-flex items-center gap-2 ${allocationTotal === 100 ? "text-emerald-600" : "text-amber-600"}`}>
                  {allocationTotal.toFixed(1)}%
                  {allocationTotal === 100 && <FaCheckCircle size={12} />}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Smart Split Preview</h2>
              <div className="h-72">
                <Doughnut data={{
                  labels: allocationPreview.map((item) => item.bucketName),
                  datasets: [
                    {
                      data: allocationPreview.map((item) => item.amount),
                      backgroundColor: allocationPreview.map((item) => allocationBuckets.find((bucket) => bucket.id === item.bucketId)?.color || "#3b82f6"),
                      borderWidth: 0,
                    },
                  ],
                }} options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { labels: { color: "#94a3b8" } },
                  },
                } as any} />
              </div>
              <div className="mt-4 space-y-2">
                {allocationPreview.map((item) => (
                  <div key={item.bucketId} className="flex items-center justify-between rounded-xl bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: allocationBuckets.find((bucket) => bucket.id === item.bucketId)?.color || "#3b82f6" }} />
                      <span>{item.bucketName}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatCurrency(item.amount)}</div>
                      <div className="text-[11px] text-zinc-500 dark:text-zinc-400">{formatPercent(item.percent)}</div>
                    </div>
                  </div>
                ))}
                {allocationPreview.length === 0 && <p className="text-sm text-zinc-500 dark:text-zinc-400">No allocation preview available.</p>}
              </div>
            </div>
          </div>
        )}

        {section === "analytics" && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Income vs Expense Distribution</h2>
              <div className="h-80">
                <Bar data={chartData} options={chartOptions as any} />
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Expense Categories</h2>
              <div className="h-72">
                <Doughnut data={expensePieData} options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: "bottom", labels: { color: "#94a3b8" } },
                  },
                } as any} />
              </div>
              <div className="mt-6 h-64">
                <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Income Categories</h3>
                <Doughnut data={incomePieData} options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { position: "bottom", labels: { color: "#94a3b8" } },
                  },
                } as any} />
              </div>
              <div className="mt-5 space-y-2">
                {categories.filter((category) => category.type !== "income").slice(0, 8).map((category) => (
                  <div key={category.id} className="flex items-center justify-between rounded-xl bg-zinc-50 dark:bg-zinc-950/60 px-3 py-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color }} />
                      <span>{category.name}</span>
                    </div>
                    <span className="text-zinc-500 dark:text-zinc-400">{formatCurrency(categoryBreakdown.get(category.id) || 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {section === "estimator" && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Profit / Loss Estimator</h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <input type="number" value={initialAmount} onChange={(e) => setInitialAmount(Number(e.target.value))} placeholder="Starting amount" className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm" />
                <input type="number" value={monthlyIncome} onChange={(e) => setMonthlyIncome(Number(e.target.value))} placeholder="Monthly income" className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm" />
                <input type="number" value={monthlyExpenses} onChange={(e) => setMonthlyExpenses(Number(e.target.value))} placeholder="Monthly expenses" className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm" />
                <input type="number" value={monthsAhead} onChange={(e) => setMonthsAhead(Number(e.target.value))} placeholder="Months ahead" className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm" />
                <input type="number" value={annualGrowthRate} onChange={(e) => setAnnualGrowthRate(Number(e.target.value))} placeholder="Annual growth %" className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm md:col-span-2" />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/30 p-4">
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">Ending Balance</p>
                  <p className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(estimation.endingBalance)}</p>
                </div>
                <div className={`rounded-xl p-4 ${estimation.profitLoss >= 0 ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-red-50 dark:bg-red-950/30"}`}>
                  <p className={`text-xs ${estimation.profitLoss >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>Profit / Loss</p>
                  <p className={`mt-1 text-lg font-bold ${estimation.profitLoss >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>{formatCurrency(estimation.profitLoss)}</p>
                </div>
                <div className="rounded-xl bg-zinc-50 dark:bg-zinc-950/60 p-4">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Monthly Net</p>
                  <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-zinc-50">{formatCurrency(monthlyIncome - monthlyExpenses)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Projection Chart</h2>
              <div className="h-80">
                <Line data={estimationData} options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { labels: { color: "#94a3b8" } } },
                  scales: {
                    x: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(148,163,184,0.12)" } },
                    y: {
                      ticks: {
                        color: "#94a3b8",
                        callback: (value: string | number) => formatCurrency(Number(value)),
                      },
                      grid: { color: "rgba(148,163,184,0.12)" },
                    },
                  },
                } as any} />
              </div>
              <div className="mt-4 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-4 text-sm text-zinc-500 dark:text-zinc-400">
                This estimator projects balance using monthly income, expenses, and an optional annual growth rate. It is useful for checking future profit or loss before making an investment decision.
              </div>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Category Manager</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <input value={categoryName} onChange={(e) => setCategoryName(e.target.value)} placeholder="Custom category" className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm" />
            <select value={categoryType} onChange={(e) => setCategoryType(e.target.value as BudgetCategoryType)} className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-2 text-sm">
              {categoryTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
            <input type="color" value={categoryColor} onChange={(e) => setCategoryColor(e.target.value)} className="h-11 w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1" />
            <button onClick={handleAddCategory} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700">
              <FaPlus size={12} /> Add category
            </button>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {categories.map((category) => (
              <div key={category.id} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50 dark:bg-zinc-950/60">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: category.color }} />
                      {category.name}
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 capitalize">{category.type}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${category.active ? "bg-emerald-500/15 text-emerald-600" : "bg-zinc-500/15 text-zinc-500"}`}>{category.active ? "Active" : "Inactive"}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => setCategoryActive(category.id, !category.active)} className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-2 py-1 text-xs text-zinc-600 dark:text-zinc-300">
                    {category.active ? "Deactivate" : "Restore"}
                  </button>
                  {category.isCustom && (
                    <button onClick={() => removeCategory(category.id)} className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
